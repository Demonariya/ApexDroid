use crate::errors::{AppError, AppResult};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::Child;
use tokio::sync::Mutex;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrcpyConfig {
    pub max_size: u32,
    pub bit_rate_mbps: u32,
    pub max_fps: u32,
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

pub struct ActiveSession {
    pub child: Child,
    pub is_recording: bool,
    pub record_destination: Option<String>,
}

pub struct ScrcpyManager {
    custom_scrcpy_path: Arc<RwLock<Option<String>>>,
    sessions: Arc<Mutex<HashMap<String, ActiveSession>>>,
}

impl ScrcpyManager {
    pub fn new(custom_path: Option<String>) -> Self {
        Self {
            custom_scrcpy_path: Arc::new(RwLock::new(custom_path)),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_custom_path(&self, path: Option<String>) {
        *self.custom_scrcpy_path.write() = path;
    }

    pub fn get_scrcpy_binary(&self) -> String {
        let guard = self.custom_scrcpy_path.read();
        if let Some(ref path) = *guard {
            let trimmed = path.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        "scrcpy".to_string()
    }

    pub async fn start_mirroring(&self, serial: &str, config: ScrcpyConfig) -> AppResult<bool> {
        let mut sessions = self.sessions.lock().await;

        if let Some(mut existing) = sessions.remove(serial) {
            let _ = existing.child.kill().await;
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

        let is_recording = config.record_path.is_some();
        let rec_dest = config.record_path.clone();

        if let Some(ref rec) = config.record_path {
            let trimmed = rec.trim();
            if !trimmed.is_empty() {
                if let Some(parent) = Path::new(trimmed).parent() {
                    if !parent.as_os_str().is_empty() && !parent.exists() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                }
                cmd.args(["--record", trimmed]);
            }
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = cmd.spawn()
            .map_err(|e| AppError::Scrcpy(format!(
                "Failed to launch scrcpy executable '{}': {}. Ensure scrcpy is installed in PATH or configured in Settings.",
                bin, e
            )))?;

        // Asynchronously consume stdout and stderr so pipes never block the child process
        if let Some(mut stdout) = child.stdout.take() {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stdout.read(&mut buf).await {
                    if n == 0 { break; }
                }
            });
        }
        if let Some(mut stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stderr.read(&mut buf).await {
                    if n == 0 { break; }
                }
            });
        }

        info!(serial, is_recording, "Launched scrcpy session");
        sessions.insert(serial.to_string(), ActiveSession {
            child,
            is_recording,
            record_destination: rec_dest,
        });

        Ok(true)
    }

    pub async fn stop_mirroring(&self, serial: &str) -> AppResult<bool> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut session) = sessions.remove(serial) {
            let _ = session.child.kill().await;
            info!(serial, "Terminated scrcpy session");

            // If it was recording, verify output file
            if let Some(dest) = session.record_destination {
                let p = Path::new(&dest);
                if p.exists() {
                    let len = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                    if len == 0 {
                        let _ = std::fs::remove_file(p);
                        return Err(AppError::Scrcpy("Recorded video file is 0 bytes (empty)".to_string()));
                    }
                    info!(destination = %dest, size_bytes = len, "Verified saved screen recording");
                }
            }

            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn is_mirroring(&self, serial: &str) -> bool {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(serial) {
            match session.child.try_wait() {
                Ok(None) => true, // Still active
                _ => {
                    sessions.remove(serial);
                    false
                }
            }
        } else {
            false
        }
    }

    pub async fn is_recording(&self, serial: &str) -> bool {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(serial) {
            if !session.is_recording {
                return false;
            }
            match session.child.try_wait() {
                Ok(None) => true,
                _ => {
                    sessions.remove(serial);
                    false
                }
            }
        } else {
            false
        }
    }
}
