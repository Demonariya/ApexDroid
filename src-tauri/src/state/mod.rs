use crate::adb::AdbClient;
use crate::backup::BackupManager;
use crate::devices::DeviceManager;
use crate::errors::{AppError, AppResult};
use crate::filesystem::FilesystemManager;
use crate::logging::LogRingBuffer;
use crate::monitoring::DeviceMonitor;
use crate::packages::PackageManager;
use crate::scrcpy::ScrcpyManager;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String, // "en" or "fa"
    pub adb_path: String,
    pub scrcpy_path: String,
    pub default_download_path: String,
    pub polling_interval_ms: u64,
    pub auto_connect_wireless: bool,
    pub confirm_destructive_actions: bool,
    pub theme: String,
    pub log_level: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            adb_path: "adb".to_string(),
            scrcpy_path: "scrcpy".to_string(),
            default_download_path: "~/Downloads/ApexDroid".to_string(),
            polling_interval_ms: 2500,
            auto_connect_wireless: false,
            confirm_destructive_actions: true,
            theme: "dark".to_string(),
            log_level: "info".to_string(),
        }
    }
}

pub struct AppState {
    pub config_dir: Option<PathBuf>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub adb_client: Arc<AdbClient>,
    pub device_manager: Arc<DeviceManager>,
    pub device_monitor: Arc<DeviceMonitor>,
    pub filesystem_manager: Arc<FilesystemManager>,
    pub package_manager: Arc<PackageManager>,
    pub scrcpy_manager: Arc<ScrcpyManager>,
    pub backup_manager: Arc<BackupManager>,
    pub logs: Arc<LogRingBuffer>,
}

impl AppState {
    pub fn new(config_dir: Option<PathBuf>) -> Self {
        let initial_settings = if let Some(ref dir) = config_dir {
            load_settings_from_disk(dir)
        } else {
            AppSettings::default()
        };

        let custom_adb = if initial_settings.adb_path != "adb" && !initial_settings.adb_path.trim().is_empty() {
            Some(initial_settings.adb_path.clone())
        } else {
            None
        };

        let custom_scrcpy = if initial_settings.scrcpy_path != "scrcpy" && !initial_settings.scrcpy_path.trim().is_empty() {
            Some(initial_settings.scrcpy_path.clone())
        } else {
            None
        };

        let settings = Arc::new(RwLock::new(initial_settings));
        let adb = Arc::new(AdbClient::new(custom_adb));
        let dev_mgr = Arc::new(DeviceManager::new(adb.clone()));
        let dev_monitor = Arc::new(DeviceMonitor::new(adb.clone()));
        let fs_mgr = Arc::new(FilesystemManager::new(adb.clone()));
        let pkg_mgr = Arc::new(PackageManager::new(adb.clone()));
        let scrcpy_mgr = Arc::new(ScrcpyManager::new(custom_scrcpy));
        let backup_mgr = Arc::new(BackupManager::new(adb.clone()));
        let logs = Arc::new(LogRingBuffer::new(500));

        logs.push("INFO", "system", "ApexDroid initialized. Persistent configuration loaded.", None);

        Self {
            config_dir,
            settings,
            adb_client: adb,
            device_manager: dev_mgr,
            device_monitor: dev_monitor,
            filesystem_manager: fs_mgr,
            package_manager: pkg_mgr,
            scrcpy_manager: scrcpy_mgr,
            backup_manager: backup_mgr,
            logs,
        }
    }

    pub fn save_settings(&self, new_settings: AppSettings) -> AppResult<()> {
        // Validate interval
        let mut validated = new_settings;
        if validated.polling_interval_ms < 500 {
            validated.polling_interval_ms = 500;
        }

        // Apply new executable paths dynamically to existing managers
        let custom_adb = if validated.adb_path != "adb" && !validated.adb_path.trim().is_empty() {
            Some(validated.adb_path.clone())
        } else {
            None
        };
        self.adb_client.set_custom_path(custom_adb);

        let custom_scrcpy = if validated.scrcpy_path != "scrcpy" && !validated.scrcpy_path.trim().is_empty() {
            Some(validated.scrcpy_path.clone())
        } else {
            None
        };
        self.scrcpy_manager.set_custom_path(custom_scrcpy);

        // Update memory state
        *self.settings.write() = validated.clone();

        // Persist to disk if config_dir is available
        if let Some(ref dir) = self.config_dir {
            save_settings_to_disk(dir, &validated)?;
        }

        self.logs.push("INFO", "settings", "Application settings updated and persisted.", None);
        Ok(())
    }
}

pub fn load_settings_from_disk(config_dir: &Path) -> AppSettings {
    let settings_file = config_dir.join("settings.json");
    if settings_file.exists() {
        if let Ok(content) = std::fs::read_to_string(&settings_file) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                info!(path = ?settings_file, "Loaded existing configuration");
                return settings;
            } else {
                warn!(path = ?settings_file, "Corrupt settings.json, reverting to safe defaults");
            }
        }
    }
    let default = AppSettings::default();
    let _ = save_settings_to_disk(config_dir, &default);
    default
}

pub fn save_settings_to_disk(config_dir: &Path, settings: &AppSettings) -> AppResult<()> {
    std::fs::create_dir_all(config_dir)
        .map_err(|e| AppError::Io(format!("Cannot create config directory {:?}: {}", config_dir, e)))?;

    let settings_file = config_dir.join("settings.json");
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| AppError::Io(format!("Failed to serialize settings: {}", e)))?;

    std::fs::write(&settings_file, json)
        .map_err(|e| AppError::Io(format!("Failed to write settings to {:?}: {}", settings_file, e)))?;

    info!(path = ?settings_file, "Persisted settings to disk");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_serde() {
        let temp_dir = std::env::temp_dir().join("apexdroid_test_cfg");
        let settings = AppSettings {
            language: "fa".to_string(),
            adb_path: "C:\\platform-tools\\adb.exe".to_string(),
            scrcpy_path: "C:\\scrcpy\\scrcpy.exe".to_string(),
            default_download_path: "C:\\Downloads".to_string(),
            polling_interval_ms: 3000,
            auto_connect_wireless: true,
            confirm_destructive_actions: false,
            theme: "dark".to_string(),
            log_level: "debug".to_string(),
        };

        assert!(save_settings_to_disk(&temp_dir, &settings).is_ok());
        let loaded = load_settings_from_disk(&temp_dir);
        assert_eq!(loaded.language, "fa");
        assert_eq!(loaded.adb_path, "C:\\platform-tools\\adb.exe");
        assert_eq!(loaded.polling_interval_ms, 3000);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
