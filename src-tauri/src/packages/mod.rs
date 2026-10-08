use crate::adb::{validate_identifier, AdbClient};
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPackage {
    pub package_name: String,
    pub display_name: String,
    pub apk_path: String,
    pub is_system: bool,
    pub is_enabled: bool,
    pub version_name: Option<String>,
    pub version_code: Option<u64>,
    pub install_time: Option<String>,
    pub icon_base64: Option<String>,
    pub size_bytes: Option<u64>,
}

pub struct PackageManager {
    adb: Arc<AdbClient>,
    icon_cache: Arc<parking_lot::RwLock<std::collections::HashMap<String, String>>>,
}

impl PackageManager {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        Self {
            adb,
            icon_cache: Arc::new(parking_lot::RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub async fn list_packages(&self, serial: &str, filter: &str) -> AppResult<Vec<AppPackage>> {
        // Query disabled packages first to accurately determine enabled status
        let disabled_raw = self.adb.run_shell(serial, "pm list packages -d").await.unwrap_or_default();
        let disabled_set: HashSet<String> = disabled_raw
            .lines()
            .filter_map(|l| l.trim().strip_prefix("package:").map(|p| p.trim().to_string()))
            .collect();

        // filter: "all", "user" (-3), "system" (-s), "disabled" (-d)
        let arg = match filter {
            "user" => "-3 -f",
            "system" => "-s -f",
            "disabled" => "-d -f",
            _ => "-f",
        };

        let cmd = format!("pm list packages {}", arg);
        let output = self.adb.run_shell(serial, &cmd).await?;

        Ok(parse_pm_list_output(&output, &disabled_set))
    }

    pub async fn install_apk(&self, serial: &str, apk_path: &str, reinstall: bool) -> AppResult<String> {
        let trimmed_path = apk_path.trim();
        if trimmed_path.is_empty() {
            return Err(AppError::Validation("APK file path cannot be empty".to_string()));
        }

        let path = Path::new(trimmed_path);
        if !path.exists() {
            return Err(AppError::Package(format!("File does not exist: '{}'", trimmed_path)));
        }

        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension == "apks" || extension == "xapk" {
            return Err(AppError::Package(format!(
                "Split-APK bundles (.{ext}) cannot be installed via direct ADB install. ApexDroid supports standard standalone .apk packages.",
                ext = extension
            )));
        }

        if extension != "apk" {
            return Err(AppError::Package(format!("Invalid package file extension '.{}'. Expected a standard '.apk' file.", extension)));
        }

        let bin = self.adb.get_adb_binary();
        let mut cmd = crate::adb::create_adb_command(&bin);
        cmd.args(["-s", serial, "install"]);
        if reinstall {
            cmd.arg("-r");
        }
        cmd.arg(trimmed_path);

        let output = cmd.output().await
            .map_err(|e| AppError::Package(format!("Failed to execute adb install: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let combined = format!("{} {}", stdout, stderr);

        if !output.status.success() || !stdout.contains("Success") || combined.contains("Failure [") {
            return Err(AppError::Package(format!("APK installation failed: {}", combined.trim())));
        }

        Ok("Installation Success".to_string())
    }

    pub async fn uninstall_package(&self, serial: &str, package_name: &str, keep_data: bool) -> AppResult<()> {
        validate_identifier(package_name)?;
        let mut cmd = "pm uninstall ".to_string();
        if keep_data {
            cmd.push_str("-k ");
        }
        cmd.push_str(package_name);

        let out = self.adb.run_shell(serial, &cmd).await?;
        if !out.contains("Success") {
            return Err(AppError::Package(format!("Uninstall failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn force_stop(&self, serial: &str, package_name: &str) -> AppResult<()> {
        validate_identifier(package_name)?;
        let cmd = format!("am force-stop {}", package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        if out.contains("Error") || out.contains("Exception") {
            return Err(AppError::Package(format!("Force stop failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn clear_data(&self, serial: &str, package_name: &str) -> AppResult<()> {
        validate_identifier(package_name)?;
        let cmd = format!("pm clear {}", package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        if !out.contains("Success") {
            return Err(AppError::Package(format!("Clear data failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn set_enabled(&self, serial: &str, package_name: &str, enabled: bool) -> AppResult<()> {
        validate_identifier(package_name)?;
        let action = if enabled { "enable" } else { "disable-user --user 0" };
        let cmd = format!("pm {} {}", action, package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        let lower = out.to_lowercase();
        if lower.contains("error") || lower.contains("exception") || lower.contains("failure") || lower.contains("killed") {
            return Err(AppError::Package(format!("Set enabled status failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn launch_app(&self, serial: &str, package_name: &str) -> AppResult<()> {
        validate_identifier(package_name)?;
        let cmd = format!("monkey -p {} -c android.intent.category.LAUNCHER 1", package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        if out.contains("No activities found") || out.contains("** Error") || out.contains("Cannot find") {
            return Err(AppError::Package(format!("Cannot launch {}: No default launcher activity found", package_name)));
        }
        Ok(())
    }

    pub async fn get_app_icon(&self, serial: &str, package_name: &str, apk_path: &str) -> AppResult<Option<String>> {
        validate_identifier(package_name)?;
        let cache_key = format!("{}:{}:{}", serial, package_name, apk_path);
        if let Some(cached) = self.icon_cache.read().get(&cache_key) {
            return Ok(Some(cached.clone()));
        }

        let escaped_apk = crate::adb::escape_shell_arg(apk_path);
        let list_cmd = format!(
            "unzip -l {} | grep -E 'res/(mipmap|drawable)[^/]+/.*(ic_launcher|icon|app_icon).*\\.(png|webp)'",
            escaped_apk
        );
        let list_out = self.adb.run_shell(serial, &list_cmd).await.unwrap_or_default();

        let mut candidates: Vec<String> = list_out
            .lines()
            .filter_map(|line| {
                line.split_whitespace().last().map(|s| s.trim().to_string())
            })
            .filter(|path| path.ends_with(".png") || path.ends_with(".webp"))
            .collect();

        candidates.sort_by_key(|c| {
            if c.contains("xxxhdpi") { 0 }
            else if c.contains("xxhdpi") { 1 }
            else if c.contains("xhdpi") { 2 }
            else if c.contains("hdpi") { 3 }
            else if c.contains("mdpi") { 4 }
            else { 5 }
        });

        if let Some(best_entry) = candidates.first() {
            let escaped_entry = crate::adb::escape_shell_arg(best_entry);
            let cat_cmd = format!("unzip -p {} {} | base64", escaped_apk, escaped_entry);
            if let Ok(b64_out) = self.adb.run_shell(serial, &cat_cmd).await {
                let b64_clean: String = b64_out.chars().filter(|c| !c.is_whitespace()).collect();
                if b64_clean.len() > 100 {
                    let mime = if best_entry.ends_with(".webp") { "image/webp" } else { "image/png" };
                    let data_url = format!("data:{};base64,{}", mime, b64_clean);
                    self.icon_cache.write().insert(cache_key, data_url.clone());
                    return Ok(Some(data_url));
                }
            }
        }

        Ok(None)
    }
}

pub fn parse_pm_list_output(output: &str, disabled_set: &HashSet<String>) -> Vec<AppPackage> {
    let mut packages = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        // format: package:/data/app/~~.../base.apk=com.example.app
        if let Some(rest) = trimmed.strip_prefix("package:") {
            if let Some((apk_path, pkg_name)) = rest.rsplit_once('=') {
                let package_name = pkg_name.trim().to_string();
                let is_system = apk_path.starts_with("/system") || apk_path.starts_with("/product") || apk_path.starts_with("/apex");
                let is_enabled = !disabled_set.contains(&package_name);

                // Infer clean human display name from package reverse domain
                let display_name = package_name.rsplit('.').next().unwrap_or(&package_name)
                    .split('_')
                    .map(|w| {
                        let mut c = w.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                        }
                    })
                    .collect::<Vec<String>>()
                    .join(" ");

                packages.push(AppPackage {
                    package_name,
                    display_name,
                    apk_path: apk_path.to_string(),
                    is_system,
                    is_enabled,
                    version_name: None,
                    version_code: None,
                    install_time: None,
                    icon_base64: None,
                    size_bytes: None,
                });
            }
        }
    }

    packages.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    packages
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pm_list_with_disabled() {
        let sample = "package:/data/app/~~abc/base.apk=com.example.normal\npackage:/system/app/SysApp.apk=com.android.sys\npackage:/data/app/~~def/base.apk=com.example.frozen\n";
        let mut disabled = HashSet::new();
        disabled.insert("com.example.frozen".to_string());

        let pkgs = parse_pm_list_output(sample, &disabled);
        assert_eq!(pkgs.len(), 3);

        let frozen = pkgs.iter().find(|p| p.package_name == "com.example.frozen").unwrap();
        assert_eq!(frozen.is_enabled, false);

        let normal = pkgs.iter().find(|p| p.package_name == "com.example.normal").unwrap();
        assert_eq!(normal.is_enabled, true);
        assert_eq!(normal.is_system, false);

        let sys = pkgs.iter().find(|p| p.package_name == "com.android.sys").unwrap();
        assert_eq!(sys.is_system, true);
        assert_eq!(sys.is_enabled, true);
    }
}
