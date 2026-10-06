pub mod adb;
pub mod backup;
pub mod commands;
pub mod devices;
pub mod errors;
pub mod filesystem;
pub mod logging;
pub mod monitoring;
pub mod packages;
pub mod scrcpy;
pub mod state;

use std::sync::Arc;
use state::AppState;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn run() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info,apexdroid=debug"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app_state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state.clone())
        .setup(move |app| {
            let monitor = Arc::new(monitoring::DeviceMonitor::new(app_state.adb_client.as_ref().clone_internal()));
            monitor.start_polling(app.handle().clone(), 2500);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_adb_status,
            commands::restart_adb_server,
            commands::get_devices,
            commands::get_device_details,
            commands::execute_shell,
            commands::reboot_device,
            commands::connect_wireless_device,
            commands::pair_wireless_device,
            commands::list_files,
            commands::create_directory,
            commands::delete_file,
            commands::rename_file,
            commands::list_packages,
            commands::install_apk,
            commands::uninstall_app,
            commands::force_stop_app,
            commands::clear_app_data,
            commands::set_app_enabled,
            commands::launch_app,
            commands::send_key_event,
            commands::take_screenshot,
            commands::is_scrcpy_running,
            commands::run_backup,
            commands::restore_backup,
            commands::cancel_backup,
            commands::start_scrcpy,
            commands::stop_scrcpy,
            commands::get_logs,
            commands::clear_logs,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ApexDroid desktop application");
}

// Helper to clone adb client
impl adb::AdbClient {
    pub fn clone_internal(&self) -> Self {
        Self::new(None)
    }
}
