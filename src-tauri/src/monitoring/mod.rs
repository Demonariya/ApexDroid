use crate::adb::{AdbClient, DeviceConnectionStatus};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, RwLock};
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceChangeEvent {
    pub serial: String,
    pub event_type: String, // "connected", "disconnected", "state_changed"
    pub state: DeviceConnectionStatus,
    pub timestamp: i64,
}

pub struct DeviceMonitor {
    adb: Arc<AdbClient>,
    known_serials: Arc<RwLock<HashSet<String>>>,
    is_running: Arc<AtomicBool>,
    stop_tx: Arc<watch::Sender<bool>>,
    task_handle: Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
}

impl DeviceMonitor {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        let (stop_tx, _stop_rx) = watch::channel(false);
        Self {
            adb,
            known_serials: Arc::new(RwLock::new(HashSet::new())),
            is_running: Arc::new(AtomicBool::new(false)),
            stop_tx: Arc::new(stop_tx),
            task_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn stop(&self) {
        if self.is_running.swap(false, Ordering::SeqCst) {
            info!("Stopping device monitor polling loop");
            let _ = self.stop_tx.send(true);
            if let Some(handle) = self.task_handle.lock().take() {
                handle.abort();
            }
        }
    }

    pub fn start_polling(&self, app_handle: AppHandle, interval_ms: u64) {
        if self
            .is_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            info!("Device monitor is already running, skipping duplicate spawn");
            return;
        }

        // Reset the stop signal
        let _ = self.stop_tx.send(false);
        let mut stop_rx = self.stop_tx.subscribe();

        let is_running = self.is_running.clone();
        let adb = self.adb.clone();
        let known_serials = self.known_serials.clone();
        let task_handle_mutex = self.task_handle.clone();

        // Spawn on Tauri's managed async runtime
        let handle = tauri::async_runtime::spawn(async move {
            info!(interval_ms, "Device monitor polling loop started on Tauri async runtime");
            let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if !is_running.load(Ordering::SeqCst) {
                            break;
                        }

                        match adb.list_devices().await {
                            Ok(current_devices) => {
                                let current_set: HashSet<String> = current_devices.iter().map(|d| d.serial.clone()).collect();
                                let mut known = known_serials.write().await;

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
                                        let _ = app_handle.emit("device-connected", &event);
                                        let _ = app_handle.emit("device-change", &event);
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
                                        let _ = app_handle.emit("device-disconnected", &event);
                                        let _ = app_handle.emit("device-change", &event);
                                    }
                                }

                                *known = current_set;
                            }
                            Err(e) => {
                                debug!("Monitor polling cycle ADB error (server may be idle): {}", e);
                            }
                        }
                    }
                    res = stop_rx.changed() => {
                        if res.is_ok() && *stop_rx.borrow() {
                            info!("Device monitor received shutdown signal, terminating loop");
                            break;
                        }
                    }
                }
            }

            is_running.store(false, Ordering::SeqCst);
            info!("Device monitor polling loop finished");
        });

        *task_handle_mutex.lock() = Some(handle);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_monitor_lifecycle() {
        let adb = Arc::new(AdbClient::new(None));
        let monitor = DeviceMonitor::new(adb);

        assert!(!monitor.is_running(), "Monitor should not be running upon creation");
        monitor.stop();
        assert!(!monitor.is_running(), "Stopping an inactive monitor should remain false without error");
    }

    #[test]
    fn test_duplicate_start_guard() {
        let adb = Arc::new(AdbClient::new(None));
        let monitor = DeviceMonitor::new(adb);

        // Manually mark running
        monitor.is_running.store(true, Ordering::SeqCst);
        assert!(monitor.is_running());

        // Attempting to start when already running should be rejected
        let res = monitor.is_running.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst);
        assert!(res.is_err(), "Duplicate start should be prevented by atomic CAS");

        monitor.stop();
        assert!(!monitor.is_running(), "Monitor should be stopped after stop()");
    }
}
