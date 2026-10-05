use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrcpyConfig {
    pub max_size: u32,       // e.g. 1920, 1080
    pub bit_rate_mbps: u32,  // e.g. 8
    pub max_fps: u32,        // e.g. 60
    pub stay_awake: bool,
    pub turn_screen_off: bool,
    pub show_touches: bool,
    pub audio: bool,
    pub fullscreen: bool,
    pub record_path: Option<String>,
}

impl Default for ScrcpyConfig {
    fn default() -> Self {
        Self {
            max_size: 1920,
            bit_rate_mbps: 8,
            max_fps: 60,
            stay_awake: true,
            turn_screen_off: false,
            show_touches: false,
            audio: true,
            fullscreen: false,
            record_path: None,
        }
    }
}

pub struct ScrcpyManager {
    custom_scrcpy_path: Option<String>,
    running_processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl ScrcpyManager {
    pub fn new(custom_path: Option<String>) -> Self {
        Self {
            custom_scrcpy_path: custom_path,
            running_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_scrcpy_binary(&self) -> String {
        if let Some(ref path) = self.custom_scrcpy_path {
            if !path.trim().is_empty() {
                return path.clone();
            }
        }
        "scrcpy".to_string()
    }

    pub async fn start_mirroring(&self, serial: &str, config: ScrcpyConfig) -> AppResult<bool> {
        let mut processes = self.running_processes.lock().await;

        // If already running for this device, stop first
        if let Some(mut existing) = processes.remove(serial) {
            let _ = existing.kill().await;
        }

        let bin = self.get_scrcpy_binary();
        let mut cmd = tokio::process::Command::new(&bin);

        cmd.args(["-s", serial]);
        cmd.args(["--max-size", &config.max_size.to_string()]);
        cmd.args(["--video-bit-rate", &format!("{}M", config.bit_rate_mbps)]);
        cmd.args(["--max-fps", &config.max_fps.to_string()]);

        if config.stay_awake {
            cmd.arg("--stay-awake");
        }
        if config.turn_screen_off {
            cmd.arg("--turn-screen-off");
        }
        if config.show_touches {
            cmd.arg("--show-touches");
        }
        if !config.audio {
            cmd.arg("--no-audio");
        }
        if config.fullscreen {
            cmd.arg("--fullscreen");
        }
        if let Some(ref rec) = config.record_path {
            if !rec.trim().is_empty() {
                cmd.args(["--record", rec]);
            }
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let child = cmd.spawn()
            .map_err(|e| AppError::Scrcpy(format!("Failed to start scrcpy executable '{}': {}. Make sure scrcpy is installed in PATH.", bin, e)))?;

        info!(serial, "Launched scrcpy mirror session");
        processes.insert(serial.to_string(), child);

        Ok(true)
    }

    pub async fn stop_mirroring(&self, serial: &str) -> AppResult<bool> {
        let mut processes = self.running_processes.lock().await;
        if let Some(mut child) = processes.remove(serial) {
            let _ = child.kill().await;
            info!(serial, "Terminated scrcpy session");
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn is_mirroring(&self, serial: &str) -> bool {
        let mut processes = self.running_processes.lock().await;
        if let Some(child) = processes.get_mut(serial) {
            match child.try_wait() {
                Ok(None) => true, // Still running
                _ => {
                    processes.remove(serial);
                    false
                }
            }
        } else {
            false
        }
    }
}
