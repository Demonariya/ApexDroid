use crate::adb::AdbClient;
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};

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
    adb: AdbClient,
}

impl PackageManager {
    pub fn new(adb: AdbClient) -> Self {
        Self { adb }
    }

    pub async fn list_packages(&self, serial: &str, filter: &str) -> AppResult<Vec<AppPackage>> {
        // filter: "all", "user" (-3), "system" (-s), "disabled" (-d)
        let arg = match filter {
            "user" => "-3 -f",
            "system" => "-s -f",
            "disabled" => "-d -f",
            _ => "-f",
        };

        let cmd = format!("pm list packages {}", arg);
        let output = self.adb.run_shell(serial, &cmd).await?;

        Ok(parse_pm_list_output(&output))
    }

    pub async fn install_apk(&self, serial: &str, apk_path: &str, reinstall: bool) -> AppResult<String> {
        let bin = self.adb.get_adb_binary();
        let mut cmd = tokio::process::Command::new(&bin);
        cmd.args(["-s", serial, "install"]);
        if reinstall {
            cmd.arg("-r");
        }
        cmd.arg(apk_path);

        let output = cmd.output().await
            .map_err(|e| AppError::Package(format!("Failed to execute adb install: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if !stdout.contains("Success") {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(AppError::Package(format!("APK installation failed: {} {}", stdout, stderr)));
        }

        Ok("Installation Success".to_string())
    }

    pub async fn uninstall_package(&self, serial: &str, package_name: &str, keep_data: bool) -> AppResult<()> {
        let mut cmd = format!("pm uninstall ");
        if keep_data {
            cmd.push_str("-k ");
        }
        cmd.push_str(package_name);

        let out = self.adb.run_shell(serial, &cmd).await?;
        if !out.contains("Success") {
            return Err(AppError::Package(format!("Uninstall failed: {}", out)));
        }
        Ok(())
    }

    pub async fn force_stop(&self, serial: &str, package_name: &str) -> AppResult<()> {
        let cmd = format!("am force-stop {}", package_name);
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }

    pub async fn clear_data(&self, serial: &str, package_name: &str) -> AppResult<()> {
        let cmd = format!("pm clear {}", package_name);
        let out = self.adb.run_shell(serial, &cmd).await?;
        if !out.contains("Success") {
            return Err(AppError::Package(format!("Clear data failed: {}", out)));
        }
        Ok(())
    }

    pub async fn set_enabled(&self, serial: &str, package_name: &str, enabled: bool) -> AppResult<()> {
        let action = if enabled { "enable" } else { "disable-user --user 0" };
        let cmd = format!("pm {} {}", action, package_name);
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }

    pub async fn launch_app(&self, serial: &str, package_name: &str) -> AppResult<()> {
        let cmd = format!("monkey -p {} -c android.intent.category.LAUNCHER 1", package_name);
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }
}

pub fn parse_pm_list_output(output: &str) -> Vec<AppPackage> {
    let mut packages = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        // format: package:/data/app/~~.../base.apk=com.example.app
        if let Some(rest) = trimmed.strip_prefix("package:") {
            if let Some((apk_path, pkg_name)) = rest.rsplit_once('=') {
                let package_name = pkg_name.trim().to_string();
                let is_system = apk_path.starts_with("/system") || apk_path.starts_with("/product") || apk_path.starts_with("/apex");

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
                    is_enabled: true,
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
    fn test_parse_pm_list() {
        let sample = "package:/data/app/~~abc/com.google.android.youtube-xyz/base.apk=com.google.android.youtube\npackage:/system/app/Calculator/Calculator.apk=com.android.calculator2";
        let parsed = parse_pm_list_output(sample);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].package_name, "com.android.calculator2");
        assert_eq!(parsed[0].is_system, true);
        assert_eq!(parsed[1].package_name, "com.google.android.youtube");
        assert_eq!(parsed[1].is_system, false);
    }
}
