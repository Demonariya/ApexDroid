use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum AppError {
    #[error("ADB error: {0}")]
    Adb(String),

    #[error("Device not found or disconnected: {0}")]
    DeviceNotFound(String),

    #[error("Unauthorized device. Please accept USB debugging prompt on device.")]
    Unauthorized(String),

    #[error("Filesystem error: {0}")]
    Filesystem(String),

    #[error("Package management error: {0}")]
    Package(String),

    #[error("Scrcpy mirroring error: {0}")]
    Scrcpy(String),

    #[error("Process execution failed: {0}")]
    ProcessExecution(String),

    #[error("Backup/Restore error: {0}")]
    Backup(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Validation error: {0}")]
    Validation(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}
