use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogMessage {
    pub id: String,
    pub timestamp: String,
    pub level: String, // "TRACE", "DEBUG", "INFO", "WARN", "ERROR"
    pub target: String,
    pub message: String,
    pub device_serial: Option<String>,
}

#[derive(Clone)]
pub struct LogRingBuffer {
    max_entries: usize,
    entries: Arc<RwLock<VecDeque<LogMessage>>>,
}

impl LogRingBuffer {
    pub fn new(max_entries: usize) -> Self {
        Self {
            max_entries,
            entries: Arc::new(RwLock::new(VecDeque::with_capacity(max_entries))),
        }
    }

    pub fn push(&self, level: &str, target: &str, message: &str, serial: Option<&str>) {
        let mut list = self.entries.write();
        if list.len() >= self.max_entries {
            list.pop_front();
        }
        let now = chrono::Local::now().format("%H:%M:%S%.3f").to_string();
        list.push_back(LogMessage {
            id: format!("{}-{}", now, list.len()),
            timestamp: now,
            level: level.to_string(),
            target: target.to_string(),
            message: message.to_string(),
            device_serial: serial.map(|s| s.to_string()),
        });
    }

    pub fn get_all(&self) -> Vec<LogMessage> {
        self.entries.read().iter().cloned().collect()
    }

    pub fn clear(&self) {
        self.entries.write().clear();
    }
}
