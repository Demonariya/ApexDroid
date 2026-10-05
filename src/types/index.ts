export type ConnectionStatus = 'Device' | 'Unauthorized' | 'Offline' | 'Bootloader' | 'Recovery' | 'Sideload';

export interface BatteryInfo {
  level: number;
  is_charging: boolean;
  status: string;
  health: string;
  temperature_celsius: number;
  voltage_mv: number;
  technology: string;
}

export interface StorageInfo {
  internal_total_bytes: number;
  internal_used_bytes: number;
  internal_free_bytes: number;
  internal_percent_used: number;
  sdcard_present: boolean;
  sdcard_total_bytes?: number;
  sdcard_used_bytes?: number;
}

export interface DisplayInfo {
  width: number;
  height: number;
  density_dpi: number;
  refresh_rate?: number;
  orientation: string;
}

export interface HardwareInfo {
  soc_manufacturer: string;
  soc_model: string;
  cpu_cores: number;
  cpu_architecture: string;
  ram_total_mb: number;
  ram_avail_mb: number;
  gpu_renderer: string;
}

export interface SoftwareInfo {
  android_version: string;
  api_level: number;
  build_number: string;
  security_patch: string;
  kernel_version: string;
  bootloader: string;
  is_rooted: boolean;
}

export interface DeviceDetails {
  serial: string;
  name: string;
  manufacturer: string;
  marketing_name: string;
  model: string;
  state: ConnectionStatus;
  is_wireless: boolean;
  connection_ip?: string;
  battery?: BatteryInfo;
  storage?: StorageInfo;
  display?: DisplayInfo;
  hardware?: HardwareInfo;
  software?: SoftwareInfo;
  uptime_seconds: number;
  last_seen_epoch: number;
}

export type FileType = 'File' | 'Directory' | 'Symlink' | 'Other';

export interface FileEntry {
  name: string;
  path: string;
  file_type: FileType;
  size_bytes: number;
  permissions: string;
  owner: string;
  group: string;
  modified_epoch: number;
  modified_str: string;
  is_hidden: boolean;
  extension?: string;
}

export interface AppPackage {
  package_name: string;
  display_name: string;
  apk_path: string;
  is_system: boolean;
  is_enabled: boolean;
  version_name?: string;
  version_code?: number;
  install_time?: string;
  icon_base64?: string;
  size_bytes?: number;
}

export interface ScrcpyConfig {
  max_size: number;
  bit_rate_mbps: number;
  max_fps: number;
  stay_awake: boolean;
  turn_screen_off: boolean;
  show_touches: boolean;
  audio: boolean;
  fullscreen: boolean;
  record_path?: string;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  target: string;
  message: string;
  device_serial?: string;
}

export interface AppSettings {
  language: 'en' | 'fa';
  adb_path: string;
  scrcpy_path: string;
  default_download_path: string;
  polling_interval_ms: number;
  auto_connect_wireless: boolean;
  confirm_destructive_actions: boolean;
  theme: string;
  log_level: string;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

export type ActiveTab =
  | 'dashboard'
  | 'devices'
  | 'files'
  | 'apps'
  | 'mirror'
  | 'terminal'
  | 'tools'
  | 'backup'
  | 'logs'
  | 'settings';
