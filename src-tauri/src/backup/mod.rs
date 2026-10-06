use crate::adb::AdbClient;
use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
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
    adb: Arc<AdbClient>,
    active_cancels: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl BackupManager {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        Self {
            adb,
            active_cancels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn cancel_backup(&self, serial: &str) {
        let cancels = self.active_cancels.lock().await;
        if let Some(flag) = cancels.get(serial) {
            flag.store(true, Ordering::SeqCst);
        }
    }

    pub async fn run_backup<F>(&self, plan: BackupPlan, mut progress_callback: F) -> AppResult<BackupManifest>
    where
        F: FnMut(BackupProgress) + Send + 'static,
    {
        let serial = plan.serial.clone();
        let cancel_flag = Arc::new(AtomicBool::new(false));

        {
            let mut cancels = self.active_cancels.lock().await;
            cancels.insert(serial.clone(), cancel_flag.clone());
        }

        let result = self.execute_backup(&plan, &cancel_flag, &mut progress_callback).await;

        {
            let mut cancels = self.active_cancels.lock().await;
            cancels.remove(&serial);
        }

        result
    }

    async fn execute_backup<F>(
        &self,
        plan: &BackupPlan,
        cancel_flag: &Arc<AtomicBool>,
        progress_callback: &mut F,
    ) -> AppResult<BackupManifest>
    where
        F: FnMut(BackupProgress) + Send + 'static,
    {
        let serial = &plan.serial;
        let dest = Path::new(&plan.destination_dir);

        std::fs::create_dir_all(dest)
            .map_err(|e| AppError::Backup(format!("Cannot create destination directory {:?}: {}", dest, e)))?;

        let apks_dir = dest.join("apks");
        let media_dir = dest.join("media");
        std::fs::create_dir_all(&apks_dir)
            .map_err(|e| AppError::Backup(format!("Cannot create apks directory {:?}: {}", apks_dir, e)))?;
        std::fs::create_dir_all(&media_dir)
            .map_err(|e| AppError::Backup(format!("Cannot create media directory {:?}: {}", media_dir, e)))?;

        let total_items = plan.specific_packages.len() + if plan.include_shared_storage { 2 } else { 0 };
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

        // 1. Backup user APKs if requested
        if plan.include_apk {
            for pkg in &plan.specific_packages {
                if cancel_flag.load(Ordering::SeqCst) {
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

                    let bin = self.adb.get_adb_binary();
                    let pull_output = tokio::process::Command::new(&bin)
                        .args(["-s", serial, "pull", remote_path, &local_str])
                        .output()
                        .await
                        .map_err(|e| AppError::Backup(format!("Failed to pull APK {}: {}", pkg, e)))?;

                    if !pull_output.status.success() || !local_file.exists() {
                        let err = String::from_utf8_lossy(&pull_output.stderr);
                        return Err(AppError::Backup(format!("ADB pull failed for APK {}: {}", pkg, err.trim())));
                    }

                    let size = std::fs::metadata(&local_file).map(|m| m.len()).unwrap_or(0);
                    let hash = compute_sha256(&local_file)
                        .map_err(|e| AppError::Backup(format!("Failed to hash pulled APK {}: {}", pkg, e)))?;

                    total_bytes += size;
                    manifest_items.push(BackupManifestItem {
                        relative_path: format!("apks/{}", local_apk_name),
                        size_bytes: size,
                        sha256_hash: hash,
                        item_type: "apk".to_string(),
                        package_name: Some(pkg.clone()),
                    });
                } else {
                    return Err(AppError::Backup(format!("Package '{}' not found on device or has no extractable base APK", pkg)));
                }

                completed += 1;
            }
        }

        // 2. Backup accessible user storage
        if plan.include_shared_storage {
            for folder in ["/sdcard/Documents", "/sdcard/Download"] {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err(AppError::Backup("Backup cancelled by user".to_string()));
                }

                let folder_name = folder.rsplit('/').next().unwrap_or("media");
                progress_callback(BackupProgress {
                    phase: "backing_up_media".to_string(),
                    current_item: format!("Pulling {}", folder),
                    items_completed: completed,
                    total_items,
                    percentage: if total_items > 0 { (completed as f32 / total_items as f32) * 100.0 } else { 0.0 },
                    bytes_transferred: total_bytes,
                });

                let target_sub = media_dir.join(folder_name);
                std::fs::create_dir_all(&target_sub).ok();

                let bin = self.adb.get_adb_binary();
                let pull_res = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "pull", folder, &media_dir.to_string_lossy()])
                    .output()
                    .await
                    .map_err(|e| AppError::Backup(format!("Failed to pull storage folder {}: {}", folder, e)))?;

                if !pull_res.status.success() {
                    let err = String::from_utf8_lossy(&pull_res.stderr);
                    warn!(folder, error = %err, "ADB storage pull warning/non-zero");
                }

                completed += 1;
            }

            // Recursively collect all pulled media files
            let mut media_files = Vec::new();
            collect_files_recursive(&media_dir, &mut media_files);

            for file_path in media_files {
                let size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);
                let hash = compute_sha256(&file_path)
                    .map_err(|e| AppError::Backup(format!("Failed to hash media file {:?}: {}", file_path, e)))?;

                if let Ok(rel) = file_path.strip_prefix(dest) {
                    let rel_clean = rel.to_string_lossy().replace('\\', "/");
                    total_bytes += size;
                    manifest_items.push(BackupManifestItem {
                        relative_path: rel_clean,
                        size_bytes: size,
                        sha256_hash: hash,
                        item_type: "media".to_string(),
                        package_name: None,
                    });
                }
            }
        }

        // 3. Write verified completion manifest
        let manifest = BackupManifest {
            format_version: "1.0.0".to_string(),
            timestamp_iso: chrono::Utc::now().to_rfc3339(),
            device_serial: serial.to_string(),
            total_bytes,
            total_files: manifest_items.len(),
            security_disclaimer: "Standard ADB user-level backup. Private sandbox data (/data/data) and system secure settings require Android Backup Agent permission or root.".to_string(),
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
            // Path traversal prevention: validate relative path strictly
            if is_path_traversal(&item.relative_path) {
                failed += 1;
                details.push(format!("Rejected unsafe path with directory traversal: '{}'", item.relative_path));
                continue;
            }

            let local_path = dir.join(&item.relative_path);
            if !local_path.exists() {
                failed += 1;
                details.push(format!("File missing on disk: '{}'", item.relative_path));
                continue;
            }

            // Verify stored SHA-256 hash before restoring!
            match compute_sha256(&local_path) {
                Ok(actual_hash) => {
                    if actual_hash != item.sha256_hash {
                        failed += 1;
                        details.push(format!("SHA-256 hash mismatch for '{}' (corrupt file)", item.relative_path));
                        continue;
                    }
                }
                Err(e) => {
                    failed += 1;
                    details.push(format!("Cannot hash '{}': {}", item.relative_path, e));
                    continue;
                }
            }

            if item.item_type == "apk" {
                let local_str = local_path.to_string_lossy().to_string();
                let output = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "install", "-r", &local_str])
                    .output()
                    .await;

                match output {
                    Ok(out) if out.status.success() && String::from_utf8_lossy(&out.stdout).contains("Success") => {
                        successful += 1;
                        details.push(format!("Installed APK: {}", item.relative_path));
                    }
                    Ok(out) => {
                        failed += 1;
                        let err = String::from_utf8_lossy(&out.stderr);
                        let out_str = String::from_utf8_lossy(&out.stdout);
                        details.push(format!("Failed to install APK {}: {} {}", item.relative_path, out_str.trim(), err.trim()));
                    }
                    Err(e) => {
                        failed += 1;
                        details.push(format!("Failed to execute adb install for {}: {}", item.relative_path, e));
                    }
                }
            } else if item.item_type == "media" {
                let local_str = local_path.to_string_lossy().to_string();
                // Strip "media/" prefix and preserve relative path on device under /sdcard/
                let rel_on_device = item.relative_path.strip_prefix("media/").unwrap_or(&item.relative_path);
                let remote_target = format!("/sdcard/{}", rel_on_device);

                let output = tokio::process::Command::new(&bin)
                    .args(["-s", serial, "push", &local_str, &remote_target])
                    .output()
                    .await;

                match output {
                    Ok(out) if out.status.success() => {
                        successful += 1;
                        details.push(format!("Restored media file: {}", item.relative_path));
                    }
                    Ok(out) => {
                        failed += 1;
                        let err = String::from_utf8_lossy(&out.stderr);
                        details.push(format!("Failed to push {}: {}", item.relative_path, err.trim()));
                    }
                    Err(e) => {
                        failed += 1;
                        details.push(format!("ADB push error {}: {}", item.relative_path, e));
                    }
                }
            } else {
                failed += 1;
                details.push(format!("Unsupported item type: '{}'", item.item_type));
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

pub fn is_path_traversal(rel_path: &str) -> bool {
    let p = Path::new(rel_path);
    if p.is_absolute() {
        return true;
    }
    for comp in p.components() {
        match comp {
            std::path::Component::ParentDir => return true,
            std::path::Component::Prefix(_) | std::path::Component::RootDir => return true,
            _ => {}
        }
    }
    false
}

fn collect_files_recursive(dir: &Path, list: &mut Vec<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                collect_files_recursive(&p, list);
            } else if p.is_file() {
                list.push(p);
            }
        }
    }
}

pub fn compute_sha256(path: &Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_detection() {
        assert!(is_path_traversal("../secret.txt"));
        assert!(is_path_traversal("apks/../../etc/passwd"));
        assert!(is_path_traversal("/absolute/path/file.apk"));
        assert!(is_path_traversal("C:\\Windows\\system32"));
        assert!(!is_path_traversal("apks/base.apk"));
        assert!(!is_path_traversal("media/Documents/doc.pdf"));
    }
}
