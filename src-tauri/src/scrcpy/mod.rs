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
        #[cfg(windows)]
        {
            cmd.creation_flags(crate::adb::CREATE_NO_WINDOW);
        }

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
            if session.is_recording {
                #[cfg(windows)]
                {
                    if let Some(pid) = session.child.id() {
                        unsafe {
                            post_wm_close_to_process(pid);
                        }
                    }
                }

                // Wait up to 3 seconds for graceful encoder flush and moov finalization
                tokio::select! {
                    _ = session.child.wait() => {
                        info!(serial, "scrcpy finalized recording and exited cleanly");
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(3000)) => {
                        info!(serial, "Graceful stop timed out, terminating scrcpy process");
                        let _ = session.child.kill().await;
                        let _ = session.child.wait().await;
                    }
                }
            } else {
                let _ = session.child.kill().await;
                let _ = session.child.wait().await;
            }

            info!(serial, "Terminated scrcpy session");

            // If it was recording, verify output MP4 container has ftyp, mdat, and moov metadata
            if let Some(dest) = session.record_destination {
                let p = Path::new(&dest);
                // Allow OS disk cache flush
                tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                validate_mp4_file(p)?;
                info!(destination = %dest, "Verified saved screen recording with valid ftyp, mdat, and moov metadata");
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

    pub fn stop_all(&self) {
        if let Ok(mut sessions) = self.sessions.try_lock() {
            for (serial, mut session) in sessions.drain() {
                info!(serial = %serial, "Terminating active scrcpy session on shutdown");
                let _ = session.child.start_kill();
            }
        }
    }
}

#[cfg(windows)]
unsafe fn post_wm_close_to_process(pid: u32) -> bool {
    use winapi::um::winuser::{EnumWindows, PostMessageW, GetWindowThreadProcessId, WM_CLOSE, IsWindowVisible};
    use winapi::shared::minwindef::{BOOL, LPARAM, HWND, TRUE};

    struct Context {
        target_pid: u32,
        found: bool,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut Context);
        let mut window_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);
        if window_pid == ctx.target_pid && IsWindowVisible(hwnd) != 0 {
            PostMessageW(hwnd, WM_CLOSE, 0, 0);
            ctx.found = true;
        }
        TRUE
    }

    let mut ctx = Context { target_pid: pid, found: false };
    EnumWindows(Some(enum_proc), &mut ctx as *mut _ as LPARAM);
    ctx.found
}

pub fn validate_mp4_file(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::Scrcpy(format!("Recorded video file does not exist: {:?}", path)));
    }
    let data = std::fs::read(path)
        .map_err(|e| AppError::Scrcpy(format!("Failed to read recorded video file: {}", e)))?;

    if data.len() < 32 {
        return Err(AppError::Scrcpy("Recorded video file is too small to be a valid MP4 container".to_string()));
    }

    // Verify ftyp box at the beginning:
    // First 4 bytes are size, bytes 4..8 are b"ftyp"
    if &data[4..8] != b"ftyp" {
        return Err(AppError::Scrcpy("Recorded file is not a valid MP4 container: missing 'ftyp' header box".to_string()));
    }

    // Scan top-level boxes for moov and mdat
    let mut offset = 0;
    let mut has_moov = false;
    let mut has_mdat = false;

    while offset + 8 <= data.len() {
        let size_u32 = u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]) as usize;
        let box_type = &data[offset + 4..offset + 8];

        if box_type == b"moov" {
            has_moov = true;
        } else if box_type == b"mdat" {
            has_mdat = true;
        }

        if size_u32 == 1 {
            if offset + 16 > data.len() {
                break;
            }
            let size_u64 = u64::from_be_bytes([
                data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11],
                data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15],
            ]) as usize;
            if size_u64 < 16 {
                break;
            }
            offset += size_u64;
        } else if size_u32 == 0 {
            break;
        } else if size_u32 < 8 {
            break;
        } else {
            offset += size_u32;
        }
    }

    if !has_moov {
        has_moov = data.windows(4).any(|w| w == b"moov");
    }
    if !has_mdat {
        has_mdat = data.windows(4).any(|w| w == b"mdat");
    }

    if !has_mdat {
        return Err(AppError::Scrcpy("Recorded MP4 container contains no media payload ('mdat' atom missing)".to_string()));
    }

    if !has_moov {
        return Err(AppError::Scrcpy("Recorded MP4 container is incomplete: missing finalized metadata ('moov' atom). Video cannot be played.".to_string()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_mp4_file_complete() {
        let tmp = std::env::temp_dir().join("test_valid.mp4");
        let mut bytes = Vec::new();

        // ftyp atom
        bytes.extend_from_slice(&20u32.to_be_bytes());
        bytes.extend_from_slice(b"ftypisom");
        bytes.extend_from_slice(&512u32.to_be_bytes());
        bytes.extend_from_slice(b"isom");

        // mdat atom
        bytes.extend_from_slice(&16u32.to_be_bytes());
        bytes.extend_from_slice(b"mdat01234567");

        // moov atom (finalized metadata)
        bytes.extend_from_slice(&16u32.to_be_bytes());
        bytes.extend_from_slice(b"moov01234567");

        std::fs::write(&tmp, &bytes).unwrap();
        assert!(validate_mp4_file(&tmp).is_ok());
        let _ = std::fs::remove_file(&tmp);
    }

    #[test]
    fn test_validate_mp4_file_truncated_missing_moov() {
        let tmp = std::env::temp_dir().join("test_truncated.mp4");
        let mut bytes = Vec::new();

        // ftyp atom
        bytes.extend_from_slice(&20u32.to_be_bytes());
        bytes.extend_from_slice(b"ftypisom");
        bytes.extend_from_slice(&512u32.to_be_bytes());
        bytes.extend_from_slice(b"isom");

        // mdat atom only (no moov)
        bytes.extend_from_slice(&16u32.to_be_bytes());
        bytes.extend_from_slice(b"mdat01234567");

        std::fs::write(&tmp, &bytes).unwrap();
        let res = validate_mp4_file(&tmp);
        assert!(res.is_err());
        assert!(res.unwrap_err().to_string().contains("moov"));
        let _ = std::fs::remove_file(&tmp);
    }
}
