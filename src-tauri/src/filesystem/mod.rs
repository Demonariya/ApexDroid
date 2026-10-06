use crate::adb::{escape_shell_arg, AdbClient};
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileType {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub file_type: FileType,
    pub size_bytes: u64,
    pub permissions: String,
    pub owner: String,
    pub group: String,
    pub modified_epoch: i64,
    pub modified_str: String,
    pub is_hidden: bool,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub id: String,
    pub filename: String,
    pub direction: String, // "pull" or "push"
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub percentage: f32,
    pub speed_mbps: f32,
    pub status: String,
}

pub struct FilesystemManager {
    adb: Arc<AdbClient>,
}

impl FilesystemManager {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        Self { adb }
    }

    pub async fn list_directory(&self, serial: &str, path: &str) -> AppResult<Vec<FileEntry>> {
        let clean_path = if path.trim().is_empty() { "/sdcard" } else { path.trim() };
        let escaped = escape_shell_arg(clean_path);
        let cmd = format!("ls -la {}", escaped);
        let output = self.adb.run_shell(serial, &cmd).await?;

        if output.contains("No such file or directory") {
            return Err(AppError::Filesystem(format!("Directory does not exist: {}", clean_path)));
        }
        if output.contains("Permission denied") {
            return Err(AppError::Filesystem(format!("Permission denied reading directory: {}", clean_path)));
        }

        Ok(parse_ls_output(&output, clean_path))
    }

    pub async fn create_directory(&self, serial: &str, path: &str) -> AppResult<()> {
        let clean = path.trim();
        if clean.is_empty() {
            return Err(AppError::Validation("Target directory path cannot be empty".to_string()));
        }

        let escaped = escape_shell_arg(clean);
        let cmd = format!("mkdir -p {}", escaped);
        let out = self.adb.run_shell(serial, &cmd).await?;

        if out.contains("Permission denied") || out.contains("Read-only file system") {
            return Err(AppError::Filesystem(format!("Failed to create directory {}: {}", clean, out.trim())));
        }
        Ok(())
    }

    pub async fn delete_entry(&self, serial: &str, path: &str, recursive: bool) -> AppResult<()> {
        let clean = path.trim().trim_end_matches('/');
        // Safeguard critical system directories against accidental deletion
        let dangerous_paths = [
            "", "/", "/sdcard", "/storage", "/storage/emulated", "/storage/emulated/0",
            "/data", "/system", "/vendor", "/apex", "/dev", "/proc", "/sys"
        ];

        if dangerous_paths.contains(&clean) {
            return Err(AppError::Validation(format!(
                "Refusing to delete critical root/system directory: '{}'",
                clean
            )));
        }

        let flag = if recursive { "-rf" } else { "-f" };
        let escaped = escape_shell_arg(clean);
        let cmd = format!("rm {} {}", flag, escaped);
        let out = self.adb.run_shell(serial, &cmd).await?;

        if out.contains("Permission denied") || out.contains("Read-only file system") {
            return Err(AppError::Filesystem(format!("Failed to delete {}: {}", clean, out.trim())));
        }
        Ok(())
    }

    pub async fn rename_entry(&self, serial: &str, old_path: &str, new_path: &str) -> AppResult<()> {
        let old_clean = old_path.trim();
        let new_clean = new_path.trim();

        if old_clean.is_empty() || new_clean.is_empty() {
            return Err(AppError::Validation("Source and target paths cannot be empty".to_string()));
        }

        let escaped_old = escape_shell_arg(old_clean);
        let escaped_new = escape_shell_arg(new_clean);
        let cmd = format!("mv {} {}", escaped_old, escaped_new);
        let out = self.adb.run_shell(serial, &cmd).await?;

        if out.contains("Permission denied") || out.contains("Read-only file system") || out.contains("No such file") {
            return Err(AppError::Filesystem(format!("Rename operation failed: {}", out.trim())));
        }
        Ok(())
    }

    pub async fn pull_file(&self, serial: &str, remote_path: &str, local_path: &str) -> AppResult<u64> {
        let remote_clean = remote_path.trim();
        let local_clean = local_path.trim();

        if remote_clean.is_empty() || local_clean.is_empty() {
            return Err(AppError::Validation("Paths cannot be empty".to_string()));
        }

        let local_p = Path::new(local_clean);
        if let Some(parent) = local_p.parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| AppError::Filesystem(format!("Cannot create parent directory {:?}: {}", parent, e)))?;
            }
        }

        let bin = self.adb.get_adb_binary();
        let output = tokio::process::Command::new(&bin)
            .args(["-s", serial, "pull", remote_clean, local_clean])
            .output()
            .await
            .map_err(|e| AppError::Filesystem(format!("Failed to run adb pull: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Filesystem(format!("ADB pull failed: {}", err.trim())));
        }

        let meta = std::fs::metadata(local_p)
            .map_err(|e| AppError::Filesystem(format!("Verified pulled file error at {:?}: {}", local_p, e)))?;

        Ok(meta.len())
    }

    pub async fn push_file(&self, serial: &str, local_path: &str, remote_path: &str) -> AppResult<u64> {
        let local_clean = local_path.trim();
        let remote_clean = remote_path.trim();

        if local_clean.is_empty() || remote_clean.is_empty() {
            return Err(AppError::Validation("Paths cannot be empty".to_string()));
        }

        let local_p = Path::new(local_clean);
        if !local_p.exists() {
            return Err(AppError::Filesystem(format!("Local file does not exist: '{}'", local_clean)));
        }

        let size = std::fs::metadata(local_p)
            .map(|m| m.len())
            .unwrap_or(0);

        let bin = self.adb.get_adb_binary();
        let output = tokio::process::Command::new(&bin)
            .args(["-s", serial, "push", local_clean, remote_clean])
            .output()
            .await
            .map_err(|e| AppError::Filesystem(format!("Failed to run adb push: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Filesystem(format!("ADB push failed: {}", err.trim())));
        }

        Ok(size)
    }
}

pub fn parse_ls_output(output: &str, parent_path: &str) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    let parent = parent_path.trim_end_matches('/');

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("total") {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }

        let permissions = parts[0];
        let file_type = match permissions.chars().next() {
            Some('d') => FileType::Directory,
            Some('l') => FileType::Symlink,
            Some('-') => FileType::File,
            _ => FileType::Other,
        };

        let (owner, group, size_idx, date_idx, time_idx, name_idx) = if parts.len() >= 8 {
            (parts[1].to_string(), parts[2].to_string(), 3, 4, 5, 6)
        } else {
            ("root".to_string(), "sdcard".to_string(), 2, 3, 4, 5)
        };

        let size_bytes = parts.get(size_idx).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let date_str = parts.get(date_idx).unwrap_or(&"");
        let time_str = parts.get(time_idx).unwrap_or(&"");
        let modified_str = format!("{} {}", date_str, time_str);

        // File name is all remaining tokens joined (in case name has spaces)
        let name_parts = &parts[name_idx..];
        let full_name_raw = name_parts.join(" ");
        let name = if let Some((n, _target)) = full_name_raw.split_once(" -> ") {
            n.to_string()
        } else {
            full_name_raw
        };

        if name == "." || name == ".." {
            continue;
        }

        let is_hidden = name.starts_with('.');
        let extension = if file_type == FileType::File && name.contains('.') {
            name.rsplit('.').next().map(|s| s.to_lowercase())
        } else {
            None
        };

        let full_path = format!("{}/{}", parent, name);

        entries.push(FileEntry {
            name,
            path: full_path,
            file_type,
            size_bytes,
            permissions: permissions.to_string(),
            owner,
            group,
            modified_epoch: 0,
            modified_str,
            is_hidden,
            extension,
        });
    }

    entries.sort_by(|a, b| {
        if a.file_type == FileType::Directory && b.file_type != FileType::Directory {
            std::cmp::Ordering::Less
        } else if a.file_type != FileType::Directory && b.file_type == FileType::Directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ls_output() {
        let sample = r#"
total 48
drwxrwx--x  4 root sdcard_rw 4096 2024-03-12 14:30 DCIM
drwxrwx--x  2 root sdcard_rw 4096 2024-03-12 14:30 Download
-rw-rw----  1 root sdcard_rw 1234567 2024-03-12 14:30 document with spaces.pdf
lrwxrwxrwx  1 root root        11 2024-03-12 14:30 link_target -> /sdcard/DCIM
"#;
        let entries = parse_ls_output(sample, "/sdcard");
        assert_eq!(entries.len(), 4);

        // Directories first
        assert_eq!(entries[0].file_type, FileType::Directory);
        assert_eq!(entries[0].name, "DCIM");
        assert_eq!(entries[0].path, "/sdcard/DCIM");

        let pdf = entries.iter().find(|e| e.name == "document with spaces.pdf").unwrap();
        assert_eq!(pdf.file_type, FileType::File);
        assert_eq!(pdf.size_bytes, 1234567);
        assert_eq!(pdf.extension.as_deref(), Some("pdf"));
        assert_eq!(pdf.path, "/sdcard/document with spaces.pdf");
    }
}
