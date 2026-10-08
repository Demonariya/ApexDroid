use crate::adb::{create_adb_command, validate_identifier, validate_serial, AdbClient};
use crate::errors::{AppError, AppResult};
use axml_parser::{AXMLPrinter, ARSCParser};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;
use zip::ZipArchive;

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
    icon_cache: Arc<RwLock<HashMap<String, Option<String>>>>,
}

impl PackageManager {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        Self {
            adb,
            icon_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_app_icon(
        &self,
        serial: &str,
        package_name: &str,
        apk_path: &str,
    ) -> AppResult<Option<String>> {
        validate_serial(serial)?;
        validate_identifier(package_name)?;

        let key = format!("{}::{}::{}", serial, package_name, apk_path);
        if let Some(cached) = self.icon_cache.read().get(&key) {
            return Ok(cached.clone());
        }

        if apk_path.trim().is_empty() {
            self.icon_cache.write().insert(key, None);
            return Ok(None);
        }

        let temp_name = format!(
            "apexdroid_icon_{}_{}_{}.apk",
            sanitize_temp_component(serial),
            sanitize_temp_component(package_name),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let temp_path = std::env::temp_dir().join(temp_name);

        let bin = self.adb.get_adb_binary();
        let destination = temp_path.to_string_lossy().to_string();
        let output = create_adb_command(&bin)
            .args(["-s", serial, "pull", apk_path, &destination])
            .output()
            .await
            .map_err(|e| AppError::Package(format!("Failed to extract APK for {}: {}", package_name, e)))?;

        if !output.status.success() || !temp_path.exists() {
            let _ = fs::remove_file(&temp_path);
            self.icon_cache.write().insert(key, None);
            return Ok(None);
        }

        let parse_path = temp_path.clone();
        let icon = tokio::task::spawn_blocking(move || extract_icon_from_apk(&parse_path))
            .await
            .map_err(|e| AppError::Package(format!("Icon extraction task failed: {}", e)))??;

        let _ = fs::remove_file(&temp_path);
        self.icon_cache.write().insert(key, icon.clone());
        Ok(icon)
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
        self.adb.run_shell(serial, &cmd).await?;
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
        if out.contains("Error") || out.contains("Exception") {
            return Err(AppError::Package(format!("Set enabled status failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn launch_app(&self, serial: &str, package_name: &str) -> AppResult<()> {
        validate_identifier(package_name)?;
        let cmd = format!("monkey -p {} -c android.intent.category.LAUNCHER 1", package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        if out.contains("No activities found") {
            return Err(AppError::Package(format!("Cannot launch {}: No default launcher activity found", package_name)));
        }
        Ok(())
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


fn sanitize_temp_component(value: &str) -> String {
    value
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' { c } else { '_' })
        .take(80)
        .collect()
}

fn extract_icon_from_apk(apk_path: &Path) -> AppResult<Option<String>> {
    let file = fs::File::open(apk_path)
        .map_err(|e| AppError::Package(format!("Cannot open APK for icon extraction: {}", e)))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::Package(format!("Cannot read APK archive: {}", e)))?;

    let manifest = {
        let mut entry = archive
            .by_name("AndroidManifest.xml")
            .map_err(|_| AppError::Package("APK does not contain AndroidManifest.xml".to_string()))?;
        let mut data = Vec::new();
        entry.read_to_end(&mut data)
            .map_err(|e| AppError::Package(format!("Cannot read AndroidManifest.xml: {}", e)))?;
        data
    };

    let printer = AXMLPrinter::new(&manifest);
    let xml = String::from_utf8_lossy(&printer.get_xml(false)).to_string();
    let icon_refs = extract_icon_references(&xml);
    let mut candidates = Vec::<String>::new();

    if let Ok(mut resources_entry) = archive.by_name("resources.arsc") {
        let mut arsc_data = Vec::new();
        resources_entry.read_to_end(&mut arsc_data)
            .map_err(|e| AppError::Package(format!("Cannot read resources.arsc: {}", e)))?;

        if let Ok(arsc) = ARSCParser::new(&arsc_data) {
            for icon_ref in &icon_refs {
                if let Ok((id, _)) = ARSCParser::parse_id(icon_ref) {
                    for entry in arsc.all_entries.iter().filter(|e| e.id == id) {
                        if let Some(value) = &entry.value {
                            if is_image_path(value) {
                                candidates.push(value.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    for icon_ref in &icon_refs {
        if let Some((resource_type, resource_name)) = parse_named_resource(icon_ref) {
            for i in 0..archive.len() {
                let entry = archive.by_index(i)
                    .map_err(|e| AppError::Package(format!("Cannot inspect APK entry: {}", e)))?;
                let name = entry.name().to_string();
                if name.starts_with("res/")
                    && is_image_path(&name)
                    && name.contains(&format!("/{resource_name}."))
                    && (resource_type.is_empty() || name.contains(&format!("/{resource_type}-")))
                {
                    candidates.push(name);
                }
            }
        }
    }

    if candidates.is_empty() {
        for i in 0..archive.len() {
            let entry = archive.by_index(i)
                .map_err(|e| AppError::Package(format!("Cannot inspect APK entry: {}", e)))?;
            let name = entry.name().to_ascii_lowercase();
            if name.starts_with("res/mipmap")
                && (name.contains("ic_launcher") || name.contains("launcher"))
                && is_image_path(&name)
            {
                candidates.push(entry.name().to_string());
            }
        }
    }

    candidates.sort_by_key(|path| icon_rank(path));
    candidates.dedup();

    for path in candidates {
        if let Ok(data) = read_zip_file(&mut archive, &path) {
            return Ok(Some(format!(
                "data:{};base64,{}",
                mime_for_path(&path),
                BASE64.encode(data)
            )));
        }
    }

    Ok(None)
}

fn extract_icon_references(xml: &str) -> Vec<String> {
    let mut refs = Vec::new();
    if let Some(app_start) = xml.find("<application") {
        if let Some(end) = xml[app_start..].find('>') {
            let app_tag = &xml[app_start..app_start + end];
            for attr in ["android:icon", "android:roundIcon"] {
                if let Some(pos) = app_tag.find(&format!("{attr}=\"")) {
                    let start = pos + attr.len() + 2;
                    if let Some(rest) = app_tag.get(start..) {
                        if let Some(end_quote) = rest.find('"') {
                            let value = rest[..end_quote].to_string();
                            if value.starts_with('@') {
                                refs.push(value);
                            }
                        }
                    }
                }
            }
        }
    }
    refs
}

fn parse_named_resource(reference: &str) -> Option<(String, String)> {
    let value = reference.strip_prefix('@')?.split_once('/')?;
    let resource_type = value.0.trim().to_string();
    let resource_name = value.1.trim().to_string();
    if resource_type.is_empty() || resource_name.is_empty() {
        None
    } else {
        Some((resource_type, resource_name))
    }
}

fn is_image_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".png")
        || lower.ends_with(".webp")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
}

fn icon_rank(path: &str) -> u8 {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") {
        if lower.contains("xxxhdpi") { return 0; }
        if lower.contains("xxhdpi") { return 1; }
        if lower.contains("xhdpi") { return 2; }
        if lower.contains("hdpi") { return 3; }
        if lower.contains("mdpi") { return 4; }
        return 5;
    }
    10
}

fn mime_for_path(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "image/png"
    }
}

fn read_zip_file(archive: &mut ZipArchive<fs::File>, path: &str) -> std::io::Result<Vec<u8>> {
    let mut entry = archive.by_name(path)?;
    let mut data = Vec::new();
    entry.read_to_end(&mut data)?;
    Ok(data)
}
