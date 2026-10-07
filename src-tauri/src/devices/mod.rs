use crate::adb::{AdbClient, DeviceConnectionStatus, RawAdbDevice};
use crate::errors::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::warn;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub level: u8,
    pub is_charging: bool,
    pub status: String,
    pub health: String,
    pub temperature_celsius: f32,
    pub voltage_mv: u32,
    pub technology: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub internal_total_bytes: u64,
    pub internal_used_bytes: u64,
    pub internal_free_bytes: u64,
    pub internal_percent_used: f32,
    pub sdcard_present: bool,
    pub sdcard_total_bytes: Option<u64>,
    pub sdcard_used_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayInfo {
    pub width: u32,
    pub height: u32,
    pub density_dpi: u32,
    pub refresh_rate: Option<f32>,
    pub orientation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub soc_manufacturer: String,
    pub soc_model: String,
    pub cpu_cores: usize,
    pub cpu_architecture: String,
    pub ram_total_mb: u64,
    pub ram_avail_mb: u64,
    pub gpu_renderer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftwareInfo {
    pub android_version: String,
    pub api_level: u32,
    pub build_number: String,
    pub security_patch: String,
    pub kernel_version: String,
    pub bootloader: String,
    pub is_rooted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceDetails {
    pub serial: String,
    pub name: String,
    pub manufacturer: String,
    pub marketing_name: String,
    pub model: String,
    pub state: DeviceConnectionStatus,
    pub is_wireless: bool,
    pub connection_ip: Option<String>,
    pub battery: Option<BatteryInfo>,
    pub storage: Option<StorageInfo>,
    pub display: Option<DisplayInfo>,
    pub hardware: Option<HardwareInfo>,
    pub software: Option<SoftwareInfo>,
    pub uptime_seconds: u64,
    pub last_seen_epoch: i64,
}

pub struct DeviceManager {
    adb: Arc<AdbClient>,
}

impl DeviceManager {
    pub fn new(adb: Arc<AdbClient>) -> Self {
        Self { adb }
    }

    pub async fn fetch_all_devices(&self) -> AppResult<Vec<DeviceDetails>> {
        let raw_devices = self.adb.list_devices().await?;
        let mut list = Vec::new();

        for raw in raw_devices {
            if raw.state == DeviceConnectionStatus::Device {
                match self.inspect_device(&raw.serial).await {
                    Ok(details) => list.push(details),
                    Err(e) => {
                        warn!(serial = %raw.serial, error = %e, "Failed to fully inspect device, using basic telemetry");
                        list.push(self.create_fallback_details(&raw));
                    }
                }
            } else {
                list.push(self.create_fallback_details(&raw));
            }
        }

        Ok(list)
    }

    pub fn create_fallback_details(&self, raw: &RawAdbDevice) -> DeviceDetails {
        DeviceDetails {
            serial: raw.serial.clone(),
            name: raw.model.clone().unwrap_or_else(|| raw.serial.clone()),
            manufacturer: raw.product.clone().unwrap_or_else(|| "Unknown".to_string()),
            marketing_name: raw.model.clone().unwrap_or_else(|| "Android Device".to_string()),
            model: raw.model.clone().unwrap_or_else(|| "Generic Android".to_string()),
            state: raw.state.clone(),
            is_wireless: raw.is_wireless,
            connection_ip: if raw.is_wireless { Some(raw.serial.clone()) } else { None },
            battery: None,
            storage: None,
            display: None,
            hardware: None,
            software: None,
            uptime_seconds: 0,
            last_seen_epoch: chrono::Utc::now().timestamp(),
        }
    }

    pub async fn inspect_device(&self, serial: &str) -> AppResult<DeviceDetails> {
        let props_raw = self.adb.run_shell(serial, "getprop").await.unwrap_or_default();
        let prop_map = parse_getprop_output(&props_raw);

        let manufacturer = prop_map.get("ro.product.manufacturer")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        let model = prop_map.get("ro.product.model")
            .cloned()
            .unwrap_or_else(|| "Unknown Device".to_string());
        let market_name = prop_map.get("ro.product.marketname")
            .or_else(|| prop_map.get("ro.config.marketing_name"))
            .cloned()
            .unwrap_or_else(|| format!("{} {}", manufacturer, model));

        let android_version = prop_map.get("ro.build.version.release")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        let api_level = prop_map.get("ro.build.version.sdk")
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);
        let build_number = prop_map.get("ro.build.display.id")
            .or_else(|| prop_map.get("ro.build.id"))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        let security_patch = prop_map.get("ro.build.version.security_patch")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        let bootloader = prop_map.get("ro.bootloader")
            .or_else(|| prop_map.get("ro.boot.bootloader"))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        let soc_manufacturer = prop_map.get("ro.soc.manufacturer")
            .or_else(|| prop_map.get("ro.hardware"))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        let soc_model = prop_map.get("ro.soc.model")
            .or_else(|| prop_map.get("ro.board.platform"))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        let cpu_architecture = prop_map.get("ro.product.cpu.abi")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        // Parse battery via dumpsys battery
        let battery_raw = self.adb.run_shell(serial, "dumpsys battery").await.unwrap_or_default();
        let battery = parse_dumpsys_battery(&battery_raw);

        // Parse display size via wm size & wm density & dumpsys display
        let wm_size_raw = self.adb.run_shell(serial, "wm size").await.unwrap_or_default();
        let wm_density_raw = self.adb.run_shell(serial, "wm density").await.unwrap_or_default();
        let dumpsys_display_raw = self.adb.run_shell(serial, "dumpsys display | grep -E 'mBaseDisplayInfo|refreshRate' | head -n 3").await.unwrap_or_default();
        let display = parse_display_info(&wm_size_raw, &wm_density_raw, &dumpsys_display_raw);

        // Parse storage via df -k /data
        let df_raw = self.adb.run_shell(serial, "df -k /data").await.unwrap_or_default();
        let storage = parse_df_storage(&df_raw);

        // Parse memory via cat /proc/meminfo
        let meminfo_raw = self.adb.run_shell(serial, "cat /proc/meminfo").await.unwrap_or_default();
        let (ram_total, ram_avail) = parse_meminfo(&meminfo_raw);

        // Parse real kernel version via uname -r
        let uname_raw = self.adb.run_shell(serial, "uname -r").await.unwrap_or_default();
        let kernel_version = if !uname_raw.trim().is_empty() {
            uname_raw.trim().to_string()
        } else {
            let proc_ver = self.adb.run_shell(serial, "cat /proc/version").await.unwrap_or_default();
            proc_ver.split_whitespace().take(3).collect::<Vec<_>>().join(" ")
        };
        let final_kernel = if kernel_version.is_empty() { "Unknown".to_string() } else { kernel_version };

        // Parse real uptime seconds via cat /proc/uptime
        let uptime_raw = self.adb.run_shell(serial, "cat /proc/uptime").await.unwrap_or_default();
        let uptime_seconds = uptime_raw
            .split_whitespace()
            .next()
            .and_then(|s| s.split('.').next())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        // Count CPU processor cores via /proc/cpuinfo
        let cpuinfo_raw = self.adb.run_shell(serial, "cat /proc/cpuinfo").await.unwrap_or_default();
        let cpu_cores = parse_cpu_cores(&cpuinfo_raw);

        // Determine GPU renderer from dumpsys SurfaceFlinger or props
        let gpu_raw = self.adb.run_shell(serial, "dumpsys SurfaceFlinger | grep -i GLES | head -n 1").await.unwrap_or_default();
        let gpu_renderer = if !gpu_raw.trim().is_empty() {
            gpu_raw.trim().to_string()
        } else {
            prop_map.get("ro.hardware.egl").cloned().unwrap_or_else(|| "OpenGL ES".to_string())
        };

        // Check root with strict validation: test `su -c id`
        let su_id = self.adb.run_shell(serial, "su -c id 2>/dev/null").await.unwrap_or_default();
        let is_rooted = su_id.contains("uid=0(root)");

        let is_wireless = serial.contains(':') && serial.chars().any(|c| c.is_ascii_digit());

        Ok(DeviceDetails {
            serial: serial.to_string(),
            name: format!("{} {}", manufacturer, model),
            manufacturer,
            marketing_name: market_name,
            model,
            state: DeviceConnectionStatus::Device,
            is_wireless,
            connection_ip: if is_wireless { Some(serial.to_string()) } else { None },
            battery,
            storage,
            display,
            hardware: Some(HardwareInfo {
                soc_manufacturer,
                soc_model,
                cpu_cores,
                cpu_architecture,
                ram_total_mb: ram_total,
                ram_avail_mb: ram_avail,
                gpu_renderer,
            }),
            software: Some(SoftwareInfo {
                android_version,
                api_level,
                build_number,
                security_patch,
                kernel_version: final_kernel,
                bootloader,
                is_rooted,
            }),
            uptime_seconds,
            last_seen_epoch: chrono::Utc::now().timestamp(),
        })
    }
}

pub fn parse_getprop_output(output: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            if let Some((left, right)) = trimmed.split_once("]: [") {
                let key = left.trim_start_matches('[').to_string();
                let val = right.trim_end_matches(']').to_string();
                map.insert(key, val);
            }
        }
    }
    map
}

pub fn parse_dumpsys_battery(raw: &str) -> Option<BatteryInfo> {
    if raw.trim().is_empty() || !raw.contains("level:") {
        return None;
    }

    let mut level = 0;
    let mut is_charging = false;
    let mut health = "Unknown".to_string();
    let mut temp = 0.0;
    let mut voltage = 0;
    let mut technology = "Li-ion".to_string();
    let mut found_level = false;

    for line in raw.lines() {
        let t = line.trim();
        if let Some((k, v)) = t.split_once(':') {
            let key = k.trim().to_lowercase();
            let val = v.trim();
            match key.as_str() {
                "level" => {
                    if let Ok(lvl) = val.parse::<u8>() {
                        level = lvl;
                        found_level = true;
                    }
                }
                "ac powered" | "usb powered" | "wireless powered" => {
                    if val == "true" {
                        is_charging = true;
                    }
                }
                "health" => {
                    health = match val {
                        "2" => "Good".to_string(),
                        "3" => "Overheat".to_string(),
                        "4" => "Dead".to_string(),
                        "5" => "Over Voltage".to_string(),
                        "7" => "Cold".to_string(),
                        _ => "Normal".to_string(),
                    };
                }
                "temperature" => {
                    // Android dumpsys battery temperature is in tenths of a degree Celsius (e.g. 295 = 29.5°C)
                    if let Ok(raw_temp) = val.parse::<f32>() {
                        temp = raw_temp / 10.0;
                    }
                }
                "voltage" => {
                    voltage = val.parse::<u32>().unwrap_or(0);
                }
                "technology" => {
                    technology = val.to_string();
                }
                _ => {}
            }
        }
    }

    if !found_level {
        return None;
    }

    Some(BatteryInfo {
        level,
        is_charging,
        status: if is_charging { "Charging".to_string() } else { "Discharging".to_string() },
        health,
        temperature_celsius: temp,
        voltage_mv: voltage,
        technology,
    })
}

pub fn parse_display_info(wm_size: &str, wm_density: &str, dumpsys: &str) -> Option<DisplayInfo> {
    // Example wm size: "Physical size: 1080x2400" or "Override size: ..."
    let mut width = 0;
    let mut height = 0;

    for line in wm_size.lines() {
        if line.contains("size:") {
            if let Some(dim) = line.split(':').nth(1) {
                let parts: Vec<&str> = dim.trim().split('x').collect();
                if parts.len() == 2 {
                    width = parts[0].parse::<u32>().unwrap_or(0);
                    height = parts[1].parse::<u32>().unwrap_or(0);
                }
            }
        }
    }

    if width == 0 || height == 0 {
        return None;
    }

    let mut density = 0;
    for line in wm_density.lines() {
        if line.contains("density:") {
            if let Some(d) = line.split(':').nth(1) {
                density = d.trim().parse::<u32>().unwrap_or(0);
            }
        }
    }

    let mut refresh_rate = None;
    for line in dumpsys.lines() {
        if line.contains("refreshRate") || line.contains("fps") {
            for token in line.split_whitespace() {
                if let Ok(rate) = token.trim_end_matches("fps").trim_end_matches(',').parse::<f32>() {
                    if rate > 20.0 && rate < 360.0 {
                        refresh_rate = Some(rate);
                        break;
                    }
                }
            }
        }
    }

    Some(DisplayInfo {
        width,
        height,
        density_dpi: density,
        refresh_rate,
        orientation: if height >= width { "Portrait".to_string() } else { "Landscape".to_string() },
    })
}

pub fn parse_df_storage(raw: &str) -> Option<StorageInfo> {
    // Example df -k /data output:
    // Filesystem     1K-blocks      Used Available Use% Mounted on
    // /dev/block/dm-5 229388276 112349184 117039092  49% /data
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Filesystem") || trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 5 {
            let total_1k = parts[1].parse::<u64>().ok();
            let used_1k = parts[2].parse::<u64>().ok();
            let free_1k = parts[3].parse::<u64>().ok();

            if let (Some(t), Some(u), Some(f)) = (total_1k, used_1k, free_1k) {
                let total_bytes = t * 1024;
                let used_bytes = u * 1024;
                let free_bytes = f * 1024;
                let pct = if total_bytes > 0 {
                    (used_bytes as f32 / total_bytes as f32) * 100.0
                } else {
                    0.0
                };

                return Some(StorageInfo {
                    internal_total_bytes: total_bytes,
                    internal_used_bytes: used_bytes,
                    internal_free_bytes: free_bytes,
                    internal_percent_used: pct,
                    sdcard_present: false,
                    sdcard_total_bytes: None,
                    sdcard_used_bytes: None,
                });
            }
        }
    }
    None
}

pub fn parse_meminfo(raw: &str) -> (u64, u64) {
    let mut total_kb = 0;
    let mut avail_kb = 0;

    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("MemTotal:") {
            total_kb = rest.split_whitespace().next().and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        } else if let Some(rest) = trimmed.strip_prefix("MemAvailable:") {
            avail_kb = rest.split_whitespace().next().and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        }
    }

    (total_kb / 1024, avail_kb / 1024)
}

pub fn parse_cpu_cores(raw: &str) -> usize {
    let count = raw.lines().filter(|l| l.trim().starts_with("processor")).count();
    if count == 0 {
        1
    } else {
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_getprop() {
        let sample = "[ro.product.model]: [Pixel 9 Pro]\n[ro.product.manufacturer]: [Google]\n[ro.build.version.release]: [15]\n";
        let map = parse_getprop_output(sample);
        assert_eq!(map.get("ro.product.model").unwrap(), "Pixel 9 Pro");
        assert_eq!(map.get("ro.product.manufacturer").unwrap(), "Google");
        assert_eq!(map.get("ro.build.version.release").unwrap(), "15");
    }

    #[test]
    fn test_parse_battery() {
        let sample = "Current Battery Service state:\n  AC powered: false\n  USB powered: true\n  level: 87\n  scale: 100\n  voltage: 4150\n  temperature: 295\n  technology: Li-ion\n  health: 2\n";
        let batt = parse_dumpsys_battery(sample).expect("Failed to parse battery");
        assert_eq!(batt.level, 87);
        assert!(batt.is_charging);
        assert_eq!(batt.temperature_celsius, 29.5);
        assert_eq!(batt.voltage_mv, 4150);
        assert_eq!(batt.health, "Good");
    }

    #[test]
    fn test_parse_df_storage() {
        let sample = "Filesystem     1K-blocks      Used Available Use% Mounted on\n/dev/block/dm-5 2000000 1000000 1000000  50% /data\n";
        let storage = parse_df_storage(sample).expect("Failed to parse df");
        assert_eq!(storage.internal_total_bytes, 2000000 * 1024);
        assert_eq!(storage.internal_used_bytes, 1000000 * 1024);
        assert_eq!(storage.internal_percent_used, 50.0);
    }

    #[test]
    fn test_parse_meminfo() {
        let sample = "MemTotal:       12189696 kB\nMemFree:          845328 kB\nMemAvailable:    6543210 kB\n";
        let (tot, avail) = parse_meminfo(sample);
        assert_eq!(tot, 12189696 / 1024);
        assert_eq!(avail, 6543210 / 1024);
    }
}
