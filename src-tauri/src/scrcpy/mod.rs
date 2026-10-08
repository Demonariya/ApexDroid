use crate::errors::{AppError, AppResult};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
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
    pub pid: Option<u32>,
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
        let pid = child.id();
        sessions.insert(serial.to_string(), ActiveSession {
            child,
            pid,
            is_recording,
            record_destination: rec_dest,
        });

        Ok(true)
    }

    pub async fn stop_mirroring(&self, serial: &str) -> AppResult<bool> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut session) = sessions.remove(serial) {
            stop_scrcpy_child(&mut session).await?;
            info!(serial, "Terminated scrcpy session");

            if let Some(dest) = session.record_destination {
                let size = validate_recording_file(Path::new(&dest))?;
                info!(serial, destination = %dest, size_bytes = size, "Verified playable screen recording");
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


async fn stop_scrcpy_child(session: &mut ActiveSession) -> AppResult<()> {
    #[cfg(windows)]
    if let Some(pid) = session.pid {
        request_windows_close(pid);
    }

    #[cfg(not(windows))]
    {
        let _ = session.child.kill().await;
        let _ = session.child.wait().await;
        return Ok(());
    }

    #[cfg(windows)]
    {
        let deadline = Instant::now() + Duration::from_secs(8);
        loop {
            match session.child.try_wait() {
                Ok(Some(_)) => return Ok(()),
                Ok(None) if Instant::now() < deadline => {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
                Ok(None) => {
                    let _ = session.child.kill().await;
                    let _ = session.child.wait().await;
                    return Ok(());
                }
                Err(e) => {
                    let _ = session.child.kill().await;
                    return Err(AppError::Scrcpy(format!("Failed waiting for scrcpy shutdown: {}", e)));
                }
            }
        }
    }
}

#[cfg(windows)]
fn request_windows_close(pid: u32) {
    use std::ptr;
    use winapi::shared::minwindef::{BOOL, DWORD, LPARAM, FALSE, TRUE};
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{EnumWindows, GetWindowThreadProcessId, PostMessageW, WM_CLOSE};

    struct Context {
        pid: DWORD,
        hwnd: HWND,
    }

    unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut Context);
        let mut window_pid: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);
        if window_pid == ctx.pid {
            ctx.hwnd = hwnd;
            FALSE
        } else {
            TRUE
        }
    }

    let mut ctx = Context { pid, hwnd: ptr::null_mut() };
    unsafe {
        EnumWindows(Some(callback), &mut ctx as *mut Context as LPARAM);
        if !ctx.hwnd.is_null() {
            PostMessageW(ctx.hwnd, WM_CLOSE, 0, 0);
        }
    }
}

fn validate_recording_file(path: &Path) -> AppResult<u64> {
    let metadata = fs::metadata(path)
        .map_err(|e| AppError::Scrcpy(format!("Recording output is unavailable: {}", e)))?;

    if metadata.len() < 1024 {
        let _ = fs::remove_file(path);
        return Err(AppError::Scrcpy("Recording output is empty or incomplete.".to_string()));
    }

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    let mut file = fs::File::open(path)
        .map_err(|e| AppError::Scrcpy(format!("Cannot validate recording output: {}", e)))?;

    let head_len = metadata.len().min(128 * 1024) as usize;
    let mut head = vec![0u8; head_len];
    file.read_exact(&mut head)
        .map_err(|e| AppError::Scrcpy(format!("Cannot read recording header: {}", e)))?;

    if ext == "mp4" {
        let tail_len = metadata.len().min(2 * 1024 * 1024) as i64;
        let mut tail = vec![0u8; tail_len as usize];
        file.seek(SeekFrom::End(-tail_len))
            .map_err(|e| AppError::Scrcpy(format!("Cannot seek recording tail: {}", e)))?;
        file.read_exact(&mut tail)
            .map_err(|e| AppError::Scrcpy(format!("Cannot read recording tail: {}", e)))?;

        let has_ftyp = head.windows(4).any(|w| w == b"ftyp");
        let has_mdat = head.windows(4).any(|w| w == b"mdat") || tail.windows(4).any(|w| w == b"mdat");
        let has_moov = head.windows(4).any(|w| w == b"moov") || tail.windows(4).any(|w| w == b"moov");

        if !(has_ftyp && has_mdat && has_moov) {
            return Err(AppError::Scrcpy(
                "Recorded MP4 container is not finalized correctly; the file is not playable.".to_string(),
            ));
        }
    } else if ext == "mkv" {
        if head.len() < 4 || head[..4] != [0x1A, 0x45, 0xDF, 0xA3] {
            return Err(AppError::Scrcpy("Recorded MKV container header is invalid.".to_string()));
        }
    }

    Ok(metadata.len())
}
