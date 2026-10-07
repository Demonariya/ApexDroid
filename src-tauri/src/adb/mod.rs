use crate::errors::{AppError, AppResult};
use parking_lot::RwLock;
use std::path::Path;
use std::sync::Arc;
use tokio::process::Command;
use tracing::{debug, info};

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
    custom_adb_path: Arc<RwLock<Option<String>>>,
}

impl AdbClient {
    pub fn new(custom_path: Option<String>) -> Self {
        Self {
            custom_adb_path: Arc::new(RwLock::new(custom_path)),
        }
    }

    pub fn set_custom_path(&self, path: Option<String>) {
        *self.custom_adb_path.write() = path;
    }

    pub fn get_adb_binary(&self) -> String {
        let guard = self.custom_adb_path.read();
        if let Some(ref path) = *guard {
            let trimmed = path.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
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
            .map_err(|e| AppError::Adb(format!("Failed to execute '{} version': {}. Ensure ADB is installed or configured in Settings.", bin, e)))?;

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
        validate_serial(serial)?;
        let bin = self.get_adb_binary();
        debug!(serial, shell_command, "Executing ADB shell command");

        let output = Command::new(&bin)
            .args(["-s", serial, "shell", shell_command])
            .output()
            .await
            .map_err(|e| AppError::ProcessExecution(format!("Shell command error on device {}: {}", serial, e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            // Some tools exit non-zero but return useful output
            if stdout.is_empty() && !stderr.is_empty() {
                return Err(AppError::Adb(format!("Shell error: {}", stderr.trim())));
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

        if !start.status.success() {
            let err = String::from_utf8_lossy(&start.stderr);
            return Err(AppError::Adb(format!("ADB server start failed: {}", err)));
        }

        let out = String::from_utf8_lossy(&start.stdout).to_string();
        info!("ADB server restarted");
        Ok(if out.trim().is_empty() { "ADB daemon started successfully".to_string() } else { out })
    }

    pub async fn connect_wireless(&self, host_port: &str) -> AppResult<String> {
        validate_host_port(host_port)?;
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["connect", host_port])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to connect to wireless device: {}", e)))?;

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let err_text = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() || text.contains("failed") || text.contains("unable") || text.contains("cannot") {
            let combined = if err_text.is_empty() { text } else { format!("{} {}", text, err_text) };
            return Err(AppError::Adb(format!("Wireless connection failed: {}", combined.trim())));
        }
        Ok(text.trim().to_string())
    }

    pub async fn pair_wireless(&self, host_port: &str, code: &str) -> AppResult<String> {
        validate_host_port(host_port)?;
        if code.trim().is_empty() || code.len() > 16 {
            return Err(AppError::Validation("Pairing code must be 1 to 16 characters".to_string()));
        }

        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["pair", host_port, code.trim()])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to pair with wireless device: {}", e)))?;

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let err_text = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() || text.contains("failed") || text.contains("error") || text.contains("unable") {
            let combined = if err_text.is_empty() { text } else { format!("{} {}", text, err_text) };
            return Err(AppError::Adb(format!("Wireless pairing failed: {}", combined.trim())));
        }
        Ok(text.trim().to_string())
    }

    pub async fn reboot(&self, serial: &str, mode: Option<&str>) -> AppResult<String> {
        validate_serial(serial)?;
        let bin = self.get_adb_binary();
        let mut cmd = Command::new(&bin);
        cmd.args(["-s", serial, "reboot"]);

        if let Some(m) = mode {
            let trimmed = m.trim();
            if !trimmed.is_empty() {
                match trimmed {
                    "bootloader" | "recovery" | "sideload" | "edl" => {
                        cmd.arg(trimmed);
                    }
                    _ => {
                        return Err(AppError::Validation(format!("Unsupported reboot mode: '{}'. Supported modes: bootloader, recovery, sideload, edl", trimmed)));
                    }
                }
            }
        }

        let output = cmd.output().await
            .map_err(|e| AppError::Adb(format!("Failed to execute reboot command on {}: {}", serial, e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("Reboot failed: {}", err)));
        }

        Ok("Reboot signal sent successfully".to_string())
    }

    pub async fn send_key_event(&self, serial: &str, keycode: &str) -> AppResult<()> {
        validate_serial(serial)?;
        validate_identifier(keycode)?;

        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["-s", serial, "shell", "input", "keyevent", keycode])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to send keyevent: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("Key event {} failed: {}", keycode, err)));
        }
        Ok(())
    }

    pub async fn take_screenshot(&self, serial: &str, destination_path: &str) -> AppResult<u64> {
        validate_serial(serial)?;
        if destination_path.trim().is_empty() {
            return Err(AppError::Validation("Destination path cannot be empty".to_string()));
        }

        let dest = Path::new(destination_path);
        if let Some(parent) = dest.parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| AppError::Filesystem(format!("Failed to create screenshot destination directory {:?}: {}", parent, e)))?;
            }
        }

        let bin = self.get_adb_binary();
        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let remote_tmp = format!("/sdcard/.apexdroid_screencap_{}.png", unique_id);

        // Step 1: capture on device
        let cap = Command::new(&bin)
            .args(["-s", serial, "shell", "screencap", "-p", &remote_tmp])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Screencap process failed: {}", e)))?;

        if !cap.status.success() {
            let err = String::from_utf8_lossy(&cap.stderr);
            // Attempt remote cleanup
            let _ = Command::new(&bin).args(["-s", serial, "shell", "rm", "-f", &remote_tmp]).output().await;
            return Err(AppError::Adb(format!("Screenshot capture failed on device: {}", err.trim())));
        }

        // Step 2: pull to destination
        let pull = Command::new(&bin)
            .args(["-s", serial, "pull", &remote_tmp, destination_path])
            .output()
            .await
            .map_err(|e| {
                AppError::Adb(format!("Pulling screenshot file failed: {}", e))
            });

        // Step 3: ALWAYS clean up remote temp file
        let _ = Command::new(&bin)
            .args(["-s", serial, "shell", "rm", "-f", &remote_tmp])
            .output()
            .await;

        let pull_output = pull?;
        if !pull_output.status.success() {
            let err = String::from_utf8_lossy(&pull_output.stderr);
            return Err(AppError::Adb(format!("Failed to transfer screenshot: {}", err.trim())));
        }

        // Step 4: Verify local file actually exists and is non-empty
        let meta = std::fs::metadata(dest)
            .map_err(|e| AppError::Filesystem(format!("Screenshot file verification failed at {:?}: {}", dest, e)))?;

        if meta.len() == 0 {
            let _ = std::fs::remove_file(dest);
            return Err(AppError::Filesystem("Captured screenshot is 0 bytes (empty file)".to_string()));
        }

        info!(serial, destination_path, size_bytes = meta.len(), "Screenshot successfully captured and verified");
        Ok(meta.len())
    }

    pub async fn get_logcat(&self, serial: &str, max_lines: u32, filter: Option<&str>) -> AppResult<Vec<String>> {
        validate_serial(serial)?;
        let bin = self.get_adb_binary();
        let limit = if max_lines == 0 || max_lines > 2000 { 200 } else { max_lines };

        let mut cmd = Command::new(&bin);
        cmd.args(["-s", serial, "logcat", "-d", "-v", "time", "-t", &limit.to_string()]);

        if let Some(f) = filter {
            let trimmed = f.trim();
            if !trimmed.is_empty() {
                cmd.arg(trimmed);
            }
        }

        let output = cmd.output().await
            .map_err(|e| AppError::Adb(format!("Failed to retrieve logcat from {}: {}", serial, e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("Logcat query failed: {}", err.trim())));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines = stdout.lines().map(|s| s.to_string()).collect();
        Ok(lines)
    }

    pub async fn clear_logcat(&self, serial: &str) -> AppResult<()> {
        validate_serial(serial)?;
        let bin = self.get_adb_binary();
        let output = Command::new(&bin)
            .args(["-s", serial, "logcat", "-c"])
            .output()
            .await
            .map_err(|e| AppError::Adb(format!("Failed to clear logcat: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Adb(format!("Clear logcat failed: {}", err.trim())));
        }
        Ok(())
    }
}

pub fn validate_serial(serial: &str) -> AppResult<()> {
    if serial.is_empty()
        || serial.len() > 128
        || serial.chars().any(|c| c.is_whitespace() || c == ';' || c == '&' || c == '|' || c == '$' || c == '`' || c == '"' || c == '\'')
    {
        return Err(AppError::Validation(format!("Invalid device serial: '{}'", serial)));
    }
    Ok(())
}

pub fn validate_host_port(host_port: &str) -> AppResult<()> {
    let trimmed = host_port.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err(AppError::Validation("Host:port cannot be empty or exceed 128 characters".to_string()));
    }
    if trimmed.chars().any(|c| c.is_whitespace() || c == ';' || c == '&' || c == '|' || c == '$' || c == '`' || c == '"' || c == '\'') {
        return Err(AppError::Validation(format!("Invalid characters in host:port: '{}'", host_port)));
    }
    Ok(())
}

pub fn validate_identifier(ident: &str) -> AppResult<()> {
    if ident.is_empty()
        || ident.len() > 128
        || !ident.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
    {
        return Err(AppError::Validation(format!("Invalid identifier: '{}'", ident)));
    }
    Ok(())
}

pub fn escape_shell_arg(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "'\\''"))
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

    #[test]
    fn test_validation() {
        assert!(validate_serial("emulator-5554").is_ok());
        assert!(validate_serial("192.168.1.50:5555").is_ok());
        assert!(validate_serial("device;rm -rf /").is_err());
        assert!(validate_serial("device$foo").is_err());
        assert!(validate_serial("").is_err());

        assert!(validate_host_port("192.168.1.50:5555").is_ok());
        assert!(validate_host_port("localhost:5555").is_ok());
        assert!(validate_host_port("192.168.1.50:5555; rm -rf").is_err());

        assert_eq!(escape_shell_arg("/sdcard/My Pictures/file.png"), "'/sdcard/My Pictures/file.png'");
        assert_eq!(escape_shell_arg("O'Reilly.apk"), "'O'\\''Reilly.apk'");
    }
}
