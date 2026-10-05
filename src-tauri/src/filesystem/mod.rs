use crate::adb::AdbClient;
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};

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
    pub status: String, // "active", "completed", "failed", "cancelled"
}

pub struct FilesystemManager {
    adb: AdbClient,
}

impl FilesystemManager {
    pub fn new(adb: AdbClient) -> Self {
        Self { adb }
    }

    pub async fn list_directory(&self, serial: &str, path: &str) -> AppResult<Vec<FileEntry>> {
        let clean_path = if path.trim().is_empty() { "/sdcard" } else { path.trim() };
        // Use `ls -laL` to dereference symlinks or `ls -la`
        let cmd = format!("ls -la \"{}\"", clean_path.replace('"', "\\\""));
        let output = self.adb.run_shell(serial, &cmd).await?;

        Ok(parse_ls_output(&output, clean_path))
    }

    pub async fn create_directory(&self, serial: &str, path: &str) -> AppResult<()> {
        let cmd = format!("mkdir -p \"{}\"", path.replace('"', "\\\""));
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }

    pub async fn delete_entry(&self, serial: &str, path: &str, recursive: bool) -> AppResult<()> {
        let flag = if recursive { "-rf" } else { "-f" };
        let cmd = format!("rm {} \"{}\"", flag, path.replace('"', "\\\""));
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }

    pub async fn rename_entry(&self, serial: &str, old_path: &str, new_path: &str) -> AppResult<()> {
        let cmd = format!("mv \"{}\" \"{}\"", old_path.replace('"', "\\\""), new_path.replace('"', "\\\""));
        self.adb.run_shell(serial, &cmd).await?;
        Ok(())
    }

    pub async fn pull_file(&self, serial: &str, remote_path: &str, local_path: &str) -> AppResult<()> {
        let bin = self.adb.get_adb_binary();
        let status = tokio::process::Command::new(&bin)
            .args(["-s", serial, "pull", remote_path, local_path])
            .status()
            .await
            .map_err(|e| AppError::Filesystem(format!("Failed to run adb pull: {}", e)))?;

        if !status.success() {
            return Err(AppError::Filesystem(format!("ADB pull failed for {}", remote_path)));
        }
        Ok(())
    }

    pub async fn push_file(&self, serial: &str, local_path: &str, remote_path: &str) -> AppResult<()> {
        let bin = self.adb.get_adb_binary();
        let status = tokio::process::Command::new(&bin)
            .args(["-s", serial, "push", local_path, remote_path])
            .status()
            .await
            .map_err(|e| AppError::Filesystem(format!("Failed to run adb push: {}", e)))?;

        if !status.success() {
            return Err(AppError::Filesystem(format!("ADB push failed for {}", remote_path)));
        }
        Ok(())
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

        // Standard ls -la:
        // -rw-rw---- 1 root sdcard_rw  12345 2024-03-12 14:30 filename
        // or
        // drwxrwx--- 2 u0_a123 u0_a123 4096 2024-03-12 14:30 folder
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
        let extension = if file_type == FileType::File {
            name.rsplit('.').next().map(|e| e.to_lowercase())
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
            modified_epoch: 1710250000,
            modified_str,
            is_hidden,
            extension,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.file_type == FileType::Directory, b.file_type == FileType::Directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
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
total 16
drwxrwx--x  2 root sdcard_rw     4096 2024-03-01 10:20 DCIM
drwxrwx--x  3 root sdcard_rw     4096 2024-03-02 11:15 Download
-rw-rw----  1 root sdcard_rw 10485760 2024-03-04 15:40 video_backup.mp4
-rw-rw----  1 root sdcard_rw      512 2024-03-05 09:00 .config
"#;

        let entries = parse_ls_output(sample, "/sdcard");
        assert_eq!(entries.len(), 4);
        assert_eq!(entries[0].name, "DCIM");
        assert_eq!(entries[0].file_type, FileType::Directory);
        assert_eq!(entries[2].name, ".config");
        assert_eq!(entries[2].is_hidden, true);
        assert_eq!(entries[3].name, "video_backup.mp4");
        assert_eq!(entries[3].extension.as_deref(), Some("mp4"));
    }
}
