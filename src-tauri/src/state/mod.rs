use crate::adb::AdbClient;
use crate::backup::BackupManager;
use crate::devices::DeviceManager;
use crate::filesystem::FilesystemManager;
use crate::logging::LogRingBuffer;
use crate::packages::PackageManager;
use crate::scrcpy::ScrcpyManager;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

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
    pub settings: Arc<RwLock<AppSettings>>,
    pub adb_client: Arc<AdbClient>,
    pub device_manager: Arc<DeviceManager>,
    pub filesystem_manager: Arc<FilesystemManager>,
    pub package_manager: Arc<PackageManager>,
    pub scrcpy_manager: Arc<ScrcpyManager>,
    pub backup_manager: Arc<BackupManager>,
    pub logs: Arc<LogRingBuffer>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = Arc::new(RwLock::new(AppSettings::default()));
        let adb = AdbClient::new(None);
        let adb_arc = Arc::new(adb);
        let dev_mgr = Arc::new(DeviceManager::new(AdbClient::new(None)));
        let fs_mgr = Arc::new(FilesystemManager::new(AdbClient::new(None)));
        let pkg_mgr = Arc::new(PackageManager::new(AdbClient::new(None)));
        let scrcpy_mgr = Arc::new(ScrcpyManager::new(None));
        let backup_mgr = Arc::new(BackupManager::new(AdbClient::new(None)));
        let logs = Arc::new(LogRingBuffer::new(500));

        // Seed initial log
        logs.push("INFO", "system", "ApexDroid initialized. Rust Tokio runtime active.", None);

        Self {
            settings,
            adb_client: adb_arc,
            device_manager: dev_mgr,
            filesystem_manager: fs_mgr,
            package_manager: pkg_mgr,
            scrcpy_manager: scrcpy_mgr,
            backup_manager: backup_mgr,
            logs,
        }
    }
}
