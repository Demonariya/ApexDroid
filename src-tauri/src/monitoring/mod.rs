use crate::adb::{AdbClient, DeviceConnectionStatus};
use crate::devices::DeviceManager;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tracing::{debug, error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceChangeEvent {
    pub serial: String,
    pub event_type: String, // "connected", "disconnected", "state_changed"
    pub state: DeviceConnectionStatus,
    pub timestamp: i64,
}

pub struct DeviceMonitor {
    adb: AdbClient,
    known_serials: Arc<RwLock<HashSet<String>>>,
    is_running: Arc<AtomicBool>,
}

impl DeviceMonitor {
    pub fn new(adb: AdbClient) -> Self {
        Self {
            adb,
            known_serials: Arc::new(RwLock::new(HashSet::new())),
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn start_polling(self: Arc<Self>, app_handle: AppHandle, interval_ms: u64) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            info!("Device monitor is already running, skipping duplicate spawn");
            return;
        }

        let is_running = self.is_running.clone();
        tokio::spawn(async move {
            info!("Device monitor polling loop started");
            let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));

            while is_running.load(Ordering::SeqCst) {
                interval.tick().await;

                match self.adb.list_devices().await {
                    Ok(current_devices) => {
                        let current_set: HashSet<String> = current_devices.iter().map(|d| d.serial.clone()).collect();
                        let mut known = self.known_serials.write().await;

                        // Check new connects
                        for dev in &current_devices {
                            if !known.contains(&dev.serial) {
                                info!(serial = %dev.serial, "New device connected");
                                let event = DeviceChangeEvent {
                                    serial: dev.serial.clone(),
                                    event_type: "connected".to_string(),
                                    state: dev.state.clone(),
                                    timestamp: chrono::Utc::now().timestamp(),
                                };
                                let _ = app_handle.emit("device-connected", event);
                            }
                        }

                        // Check disconnects
                        for old_serial in known.iter() {
                            if !current_set.contains(old_serial) {
                                info!(serial = %old_serial, "Device disconnected");
                                let event = DeviceChangeEvent {
                                    serial: old_serial.clone(),
                                    event_type: "disconnected".to_string(),
                                    state: DeviceConnectionStatus::Offline,
                                    timestamp: chrono::Utc::now().timestamp(),
                                };
                                let _ = app_handle.emit("device-disconnected", event);
                            }
                        }

                        *known = current_set;
                    }
                    Err(e) => {
                        debug!("Monitor polling cycle ADB error (server may be idle): {}", e);
                    }
                }
            }
        });
    }
}
