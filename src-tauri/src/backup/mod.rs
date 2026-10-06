use crate::adb::AdbClient;
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPlan {
    pub serial: String,
    pub destination_dir: String,
    pub include_apk: bool,
    pub include_shared_storage: bool,
    pub include_system_settings: bool,
    pub specific_packages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupProgress {
    pub phase: String, // "initializing", "backing_up_apps", "backing_up_media", "hashing_manifest", "completed", "failed"
    pub current_item: String,
    pub items_completed: usize,
    pub total_items: usize,
    pub percentage: f32,
    pub bytes_transferred: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifestItem {
    pub relative_path: String,
    pub size_bytes: u64,
    pub sha256_hash: String,
    pub item_type: String,
    pub package_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub format_version: String,
    pub timestamp_iso: String,
    pub device_serial: String,
    pub total_bytes: u64,
    pub total_files: usize,
    pub security_disclaimer: String,
    pub items: Vec<BackupManifestItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    pub successful_items: usize,
    pub failed_items: usize,
    pub total_items: usize,
    pub details: Vec<String>,
}

pub struct BackupManager {
    adb: AdbClient,
    is_cancelled: Arc<AtomicBool>,
}

impl BackupManager {
    pub fn new(adb: AdbClient) -> Self {
        Self {
            adb,
            is_cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.is_cancelled.store(true, Ordering::Relaxed);
    }

    pub async fn run_backup<F>(&self, plan: BackupPlan, mut progress_callback: F) -> AppResult<BackupManifest>
    where
        F: FnMut(BackupProgress) + Send + 'static,
    {
        self.is_cancelled.store(false, Ordering::Relaxed);
        let serial = &plan.serial;
        let dest = Path::new(&plan.destination_dir);

        std::fs::create_dir_all(dest)
            .map_err(|e| AppError::Backup(format!("Cannot create destination directory {:?}: {}", dest, e)))?;

        let apks_dir = dest.join("apks");
        let media_dir = dest.join("media");
        std::fs::create_dir_all(&apks_dir).ok();
        std::fs::create_dir_all(&media_dir).ok();

        let total_items = plan.specific_packages.len() + if plan.include_shared_storage { 1 } else { 0 };
        let mut completed = 0;
        let mut total_bytes: u64 = 0;
        let mut manifest_items = Vec::new();

        progress_callback(BackupProgress {
            phase: "initializing".to_string(),
            current_item: "Initializing backup environment".to_string(),
            items_completed: 0,
            total_items,
            percentage: 0.0,
            bytes_transferred: 0,
        });

        // 1. Backup APKs if requested
        if plan.include_apk {
            for pkg in &plan.specific_packages {
                if self.is_cancelled.load(Ordering::Relaxed) {
                    return Err(AppError::Backup("Backup cancelled by user".to_string()));
                }

                progress_callback(BackupProgress {
                    phase: "backing_up_apps".to_string(),
                    current_item: format!("Extracting APK: {}", pkg),
                    items_completed: completed,
                    total_items,
                    percentage: if total_items > 0 { (completed as f32 / total_items as f32) * 100.0 } else { 0.0 },
                    bytes_transferred: total_bytes,
                });

                // Query remote APK path via `pm path <package>`
                let path_cmd = format!("pm path {}", pkg);
                let path_output = self.adb.run_shell(serial, &path_cmd).await.unwrap_or_default();
                let remote_apk = path_output
                    .lines()
                    .find(|l| l.starts_with("package:"))
                    .and_then(|l| l.strip_prefix("package:"))
                    .map(|s| s.trim());

                if let Some(remote_path) = remote_apk {
                    let local_apk_name = format!("{}.apk", pkg);
                    let local_file = apks_dir.join(&local_apk_name);
                    let local_str = local_file.to_string_lossy().to_string();

                    // Real pull via adb
                    let bin = self.adb.get_adb_binary();
                    let pull_status = tokio::process::Command::new(&bin)
                        .args(["-s", serial, "pull", remote_path, &local_str])
                        .status()
                        .await;

                    if let Ok(st) = pull_status {
                        if st.success() && local_file.exists() {
                            let size = std::fs::metadata(&local_file).map(|m| m.len()).unwrap_or(0);
                            let hash = compute_sha256(&local_file).unwrap_or_else(|_| "hash_failed".to_string());
                            total_bytes += size;

                            manifest_items.push(BackupManifestItem {
                                relative_path: format!("apks/{}", local_apk_name),
                                size_bytes: size,
                                sha256_hash: hash,
                                item_type: "apk".to_string(),
                                package_name: Some(pkg.clone()),
                            });
                        }
                    }
                }

                completed += 1;
            }
        }

        // 2. Backup accessible user storage (/sdcard/Documents, /sdcard/Download)
        if plan.include_shared_storage {
            if self.is_cancelled.load(Ordering::Relaxed) {
                return Err(AppError::Backup("Backup cancelled by user".to_string()));
            }

            progress_callback(BackupProgress {
                phase: "backing_up_media".to_string(),
                current_item: "Pulling shared user storage (/sdcard/Documents, Download)".to_string(),
                items_completed: completed,
                total_items,
                percentage: 85.0,
                bytes_transferred: total_bytes,
            });

            let bin = self.adb.get_adb_binary();
            for folder in ["/sdcard/Documents", "/sdcard/Download"] {
                let target_dir = media_dir.to_string_lossy().to_string();
                let _ = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "pull", folder, &target_dir])
                    .status()
                    .await;
            }

            // Inspect pulled media files for real hashes and sizes
            if let Ok(entries) = std::fs::read_dir(&media_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        let size = std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                        let hash = compute_sha256(&p).unwrap_or_else(|_| "hash_failed".to_string());
                        let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                        total_bytes += size;

                        manifest_items.push(BackupManifestItem {
                            relative_path: format!("media/{}", name),
                            size_bytes: size,
                            sha256_hash: hash,
                            item_type: "media".to_string(),
                            package_name: None,
                        });
                    }
                }
            }

            completed += 1;
        }

        // 3. Write real manifest
        let manifest = BackupManifest {
            format_version: "1.0.0".to_string(),
            timestamp_iso: chrono::Utc::now().to_rfc3339(),
            device_serial: serial.to_string(),
            total_bytes,
            total_files: manifest_items.len(),
            security_disclaimer: "Standard ADB user-level backup. In compliance with Android security invariants, private app sandbox data (/data/data) and system secure settings require Android Backup Agent permission or root.".to_string(),
            items: manifest_items,
        };

        let manifest_path = dest.join("backup_manifest.json");
        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| AppError::Backup(format!("Manifest serialization error: {}", e)))?;

        std::fs::write(&manifest_path, manifest_json)
            .map_err(|e| AppError::Backup(format!("Failed to write manifest file {:?}: {}", manifest_path, e)))?;

        progress_callback(BackupProgress {
            phase: "completed".to_string(),
            current_item: format!("Backup completed. Manifest saved to {:?}", manifest_path),
            items_completed: total_items,
            total_items,
            percentage: 100.0,
            bytes_transferred: total_bytes,
        });

        Ok(manifest)
    }

    pub async fn restore_backup(&self, serial: &str, backup_dir: &str) -> AppResult<RestoreResult> {
        let dir = Path::new(backup_dir);
        let manifest_path = dir.join("backup_manifest.json");

        if !manifest_path.exists() {
            return Err(AppError::Backup(format!(
                "backup_manifest.json not found in {:?}. Ensure this is a valid ApexDroid backup directory.",
                backup_dir
            )));
        }

        let content = std::fs::read_to_string(&manifest_path)
            .map_err(|e| AppError::Backup(format!("Failed to read manifest: {}", e)))?;

        let manifest: BackupManifest = serde_json::from_str(&content)
            .map_err(|e| AppError::Backup(format!("Malformed backup manifest: {}", e)))?;

        let mut successful = 0;
        let mut failed = 0;
        let mut details = Vec::new();
        let bin = self.adb.get_adb_binary();

        for item in &manifest.items {
            let local_path = dir.join(&item.relative_path);
            if !local_path.exists() {
                failed += 1;
                details.push(format!("File missing: {:?}", item.relative_path));
                continue;
            }

            if item.item_type == "apk" {
                let local_str = local_path.to_string_lossy().to_string();
                let status = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "install", "-r", &local_str])
                    .status()
                    .await;

                if let Ok(st) = status {
                    if st.success() {
                        successful += 1;
                        details.push(format!("Installed APK: {}", item.relative_path));
                    } else {
                        failed += 1;
                        details.push(format!("Failed to install APK: {}", item.relative_path));
                    }
                } else {
                    failed += 1;
                }
            } else if item.item_type == "media" {
                let local_str = local_path.to_string_lossy().to_string();
                let remote_target = format!("/sdcard/Download/{}", local_path.file_name().unwrap_or_default().to_string_lossy());
                let status = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "push", &local_str, &remote_target])
                    .status()
                    .await;

                if let Ok(st) = status {
                    if st.success() {
                        successful += 1;
                        details.push(format!("Restored media: {}", item.relative_path));
                    } else {
                        failed += 1;
                    }
                } else {
                    failed += 1;
                }
            }
        }

        Ok(RestoreResult {
            successful_items: successful,
            failed_items: failed,
            total_items: manifest.items.len(),
            details,
        })
    }
}

pub fn compute_sha256(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let hash = hasher.finalize();
    Ok(format!("{:x}", hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_compute_sha256() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_sha256.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"ApexDroid Test Integrity").unwrap();

        let hash = compute_sha256(&file_path).unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA-256 is 64 hex chars

        std::fs::remove_file(file_path).ok();
    }
}
