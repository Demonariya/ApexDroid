use crate::errors::{AppError, AppResult};
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AdbVersion {
    pub version_string: String,
    pub revision: String,
    pub installed_path: String,
    pub is_running: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub enum DeviceConnectionStatus {
    Device,
    Unauthorized,
    Offline,
    Bootloader,
    Recovery,
    Sideload,
    Unknown(String),
}

impl From<&str> for DeviceConnectionStatus {
    fn from(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "device" => DeviceConnectionStatus::Device,
            "unauthorized" => DeviceConnectionStatus::Unauthorized,
            "offline" => DeviceConnectionStatus::Offline,
            "bootloader" => DeviceConnectionStatus::Bootloader,
            "recovery" => DeviceConnectionStatus::Recovery,
            "sideload" => DeviceConnectionStatus::Sideload,
            other => DeviceConnectionStatus::Unknown(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RawAdbDevice {
    pub serial: String,
    pub state: DeviceConnectionStatus,
    pub product: Option<String>,
    pub model: Option<String>,
    pub device: Option<String>,
    pub transport_id: Option<String>,
    pub is_wireless: bool,
}

pub struct AdbClient {
    custom_adb_path: Option<String>,
}

impl AdbClient {
    pub fn new(custom_path: Option<String>) -> Self {
        Self {
            custom_adb_path: custom_path,
        }
    }

    pub fn get_adb_binary(&self) -> String {
        if let Some(ref path) = self.custom_adb_path {
            if !path.trim().is_empty() {
                return path.clone();
            }
        }
        "adb".to_string()
    }

    pub async fn check_version(&self) -> AppResult<AdbVersion> {
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .arg("version")
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to execute '{} version': {}", bin, e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("ADB version check failed: {}", stderr)));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = parse_adb_version(&stdout, &bin);
        Ok(parsed)
    }

    pub async fn list_devices(&self) -> AppResult<Vec<RawAdbDevice>> {
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["devices", "-l"])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to list ADB devices: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("ADB devices error: {}", stderr)));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(parse_adb_devices_output(&stdout))
    }

    pub async fn run_shell(&self, serial: &str, shell_command: &str) -> AppResult<String> {
        let bin = self.get_adb_binary();
        debug!(serial, shell_command, "Executing ADB shell command");

        let output = Command::new(&bin)
            .args(["-s", serial, "shell", shell_command])
            .output()
            .await
            .map_err(|e| AppError::ProcessExecution(format!("Shell command error: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            // Some shell tools exit with non-zero but return useful info (like grep)
            if stdout.is_empty() && !stderr.is_empty() {
                return Err(AppError::Adb(format!("Shell error: {}", stderr)));
            }
        }

        Ok(stdout)
    }

    pub async fn restart_server(&self) -> AppResult<String> {
        let bin = self.get_adb_binary();
        info!("Restarting ADB server...");
        let _ = Command::new(&bin).arg("kill-server").output().await;
        let start = Command::new(&bin).arg("start-server").output().await
            .map_err(|e| AppError::Adb(format!("Failed to start ADB server: {}", e)))?;

        let out = String::from_utf8_lossy(&start.stdout).to_string();
        info!("ADB server restarted");
        Ok(out)
    }

    pub async fn connect_wireless(&self, host_port: &str) -> AppResult<String> {
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["connect", host_port])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to connect to wireless device: {}", e)))?;

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        if text.contains("failed") || text.contains("unable") {
            return Err(AppError::Adb(text));
        }
        Ok(text)
    }

    pub async fn pair_wireless(&self, host_port: &str, code: &str) -> AppResult<String> {
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["pair", host_port, code])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to pair with wireless device: {}", e)))?;

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        if text.contains("failed") || text.contains("error") {
            return Err(AppError::Adb(text));
        }
        Ok(text)
    }

    pub async fn reboot(&self, serial: &str, mode: Option<&str>) -> AppResult<String> {
        let bin = self.get_adb_binary();
        let mut cmd = Command::new(&bin);
        cmd.args(["-s", serial, "reboot"]);
        if let Some(m) = mode {
            if !m.is_empty() {
                cmd.arg(m);
            }
        }

        let output = cmd.output().await
            .map_err(|e| AppError::Adb(format!("Failed to reboot device {}: {}", serial, e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("Reboot failed: {}", err)));
        }

        Ok("Reboot signal sent successfully".to_string())
    }
}

pub fn parse_adb_version(output: &str, path: &str) -> AdbVersion {
    let mut version = "Unknown".to_string();
    let mut revision = "Unknown".to_string();

    for line in output.lines() {
        if line.contains("Android Debug Bridge version") {
            if let Some(v) = line.split("version").nth(1) {
                version = v.trim().to_string();
            }
        } else if line.contains("Version") || line.contains("revision") {
            revision = line.trim().to_string();
        }
    }

    AdbVersion {
        version_string: version,
        revision,
        installed_path: path.to_string(),
        is_running: true,
    }
}

pub fn parse_adb_devices_output(output: &str) -> Vec<RawAdbDevice> {
    let mut devices = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("List of devices") || trimmed.starts_with('*') {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let status = DeviceConnectionStatus::from(parts[1]);
        let is_wireless = serial.contains(':') && serial.chars().any(|c| c.is_ascii_digit());

        let mut product = None;
        let mut model = None;
        let mut device = None;
        let mut transport_id = None;

        for part in &parts[2..] {
            if let Some((k, v)) = part.split_once(':') {
                match k {
                    "product" => product = Some(v.to_string()),
                    "model" => model = Some(v.to_string()),
                    "device" => device = Some(v.to_string()),
                    "transport_id" => transport_id = Some(v.to_string()),
                    _ => {}
                }
            }
        }

        devices.push(RawAdbDevice {
            serial,
            state: status,
            product,
            model,
            device,
            transport_id,
            is_wireless,
        });
    }

    devices
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_adb_devices_output() {
        let sample = r#"
List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
RFCW31C928F            device product:dm3qxxx model:SM_S928B device:dm3q transport_id:2
192.168.1.140:5555     device product:husky model:Pixel_9_Pro device:husky transport_id:3
TEST_UNAUTH            unauthorized
TEST_OFFLINE           offline
"#;

        let parsed = parse_adb_devices_output(sample);
        assert_eq!(parsed.len(), 5);

        assert_eq!(parsed[0].serial, "emulator-5554");
        assert_eq!(parsed[0].state, DeviceConnectionStatus::Device);
        assert_eq!(parsed[0].is_wireless, false);

        assert_eq!(parsed[1].serial, "RFCW31C928F");
        assert_eq!(parsed[1].model.as_deref(), Some("SM_S928B"));

        assert_eq!(parsed[2].serial, "192.168.1.140:5555");
        assert_eq!(parsed[2].is_wireless, true);
        assert_eq!(parsed[2].model.as_deref(), Some("Pixel_9_Pro"));

        assert_eq!(parsed[3].state, DeviceConnectionStatus::Unauthorized);
        assert_eq!(parsed[4].state, DeviceConnectionStatus::Offline);
    }

    #[test]
    fn test_parse_adb_version() {
        let sample = "Android Debug Bridge version 1.0.41\nVersion 34.0.5-10900870\nInstalled as /usr/bin/adb";
        let parsed = parse_adb_version(sample, "/usr/bin/adb");
        assert_eq!(parsed.version_string, "1.0.41");
        assert!(parsed.revision.contains("34.0.5"));
    }
}
