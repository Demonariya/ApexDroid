use crate::adb::{AdbVersion, DeviceConnectionStatus, RawAdbDevice};
use crate::devices::DeviceDetails;
use crate::errors::AppError;
use crate::filesystem::FileEntry;
use crate::logging::LogMessage;
use crate::packages::AppPackage;
use crate::scrcpy::ScrcpyConfig;
use crate::state::{AppSettings, AppState};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn check_adb_status(state: State<'_, Arc<AppState>>) -> Result<AdbVersion, String> {
    state.adb_client.check_version().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_adb_server(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    state.logs.push("INFO", "adb", "Restarting ADB daemon via Tauri command", None);
    state.adb_client.restart_server().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_devices(state: State<'_, Arc<AppState>>) -> Result<Vec<DeviceDetails>, String> {
    state.device_manager.fetch_all_devices().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_device_details(state: State<'_, Arc<AppState>>, serial: String) -> Result<DeviceDetails, String> {
    state.device_manager.inspect_device(&serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_shell(
    state: State<'_, Arc<AppState>>,
    serial: String,
    command: String,
) -> Result<String, String> {
    state.logs.push("DEBUG", "shell", &format!("exec [{}]: {}", serial, command), Some(&serial));
    state.adb_client.run_shell(&serial, &command).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reboot_device(
    state: State<'_, Arc<AppState>>,
    serial: String,
    mode: Option<String>,
) -> Result<String, String> {
    state.logs.push("WARN", "device", &format!("Rebooting device {} (mode: {:?})", serial, mode), Some(&serial));
    state.adb_client.reboot(&serial, mode.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connect_wireless_device(
    state: State<'_, Arc<AppState>>,
    host_port: String,
) -> Result<String, String> {
    state.logs.push("INFO", "wireless", &format!("Connecting wireless: {}", host_port), None);
    state.adb_client.connect_wireless(&host_port).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pair_wireless_device(
    state: State<'_, Arc<AppState>>,
    host_port: String,
    pairing_code: String,
) -> Result<String, String> {
    state.adb_client.pair_wireless(&host_port, &pairing_code).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_files(
    state: State<'_, Arc<AppState>>,
    serial: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    state.filesystem_manager.list_directory(&serial, &path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_directory(
    state: State<'_, Arc<AppState>>,
    serial: String,
    path: String,
) -> Result<(), String> {
    state.filesystem_manager.create_directory(&serial, &path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(
    state: State<'_, Arc<AppState>>,
    serial: String,
    path: String,
    recursive: bool,
) -> Result<(), String> {
    state.logs.push("WARN", "fs", &format!("Deleting {} (recursive: {})", path, recursive), Some(&serial));
    state.filesystem_manager.delete_entry(&serial, &path, recursive).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_file(
    state: State<'_, Arc<AppState>>,
    serial: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    state.filesystem_manager.rename_entry(&serial, &old_path, &new_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_packages(
    state: State<'_, Arc<AppState>>,
    serial: String,
    filter: String,
) -> Result<Vec<AppPackage>, String> {
    state.package_manager.list_packages(&serial, &filter).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_apk(
    state: State<'_, Arc<AppState>>,
    serial: String,
    apk_path: String,
    reinstall: bool,
) -> Result<String, String> {
    state.logs.push("INFO", "pm", &format!("Installing APK: {}", apk_path), Some(&serial));
    state.package_manager.install_apk(&serial, &apk_path, reinstall).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uninstall_app(
    state: State<'_, Arc<AppState>>,
    serial: String,
    package_name: String,
    keep_data: bool,
) -> Result<(), String> {
    state.logs.push("WARN", "pm", &format!("Uninstalling package: {}", package_name), Some(&serial));
    state.package_manager.uninstall_package(&serial, &package_name, keep_data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn force_stop_app(
    state: State<'_, Arc<AppState>>,
    serial: String,
    package_name: String,
) -> Result<(), String> {
    state.package_manager.force_stop(&serial, &package_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_app_data(
    state: State<'_, Arc<AppState>>,
    serial: String,
    package_name: String,
) -> Result<(), String> {
    state.package_manager.clear_data(&serial, &package_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_app_enabled(
    state: State<'_, Arc<AppState>>,
    serial: String,
    package_name: String,
    enabled: bool,
) -> Result<(), String> {
    state.package_manager.set_enabled(&serial, &package_name, enabled).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn launch_app(
    state: State<'_, Arc<AppState>>,
    serial: String,
    package_name: String,
) -> Result<(), String> {
    state.package_manager.launch_app(&serial, &package_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_scrcpy(
    state: State<'_, Arc<AppState>>,
    serial: String,
    config: ScrcpyConfig,
) -> Result<bool, String> {
    state.logs.push("INFO", "scrcpy", &format!("Starting mirror for {}", serial), Some(&serial));
    state.scrcpy_manager.start_mirroring(&serial, config).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_scrcpy(
    state: State<'_, Arc<AppState>>,
    serial: String,
) -> Result<bool, String> {
    state.scrcpy_manager.stop_mirroring(&serial).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_logs(state: State<'_, Arc<AppState>>) -> Result<Vec<LogMessage>, String> {
    Ok(state.logs.get_all())
}

#[tauri::command]
pub async fn clear_logs(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.logs.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, Arc<AppState>>) -> Result<AppSettings, String> {
    Ok(state.settings.read().clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<(), String> {
    *state.settings.write() = settings;
    Ok(())
}
