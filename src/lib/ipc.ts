import {
  AppPackage,
  AppSettings,
  DeviceDetails,
  FileEntry,
  LogMessage,
  ScrcpyConfig,
} from '../types';
import { adbEngine } from './adb-engine';

// Check if running inside native Tauri desktop environment
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export const ipc = {
  async getDevices(): Promise<DeviceDetails[]> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<DeviceDetails[]>('get_devices');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.getDevices();
  },

  async getDeviceDetails(serial: string): Promise<DeviceDetails> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<DeviceDetails>('get_device_details', { serial });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.getDeviceDetails(serial);
  },

  async executeShell(serial: string, command: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('execute_shell', { serial, command });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.executeShell(serial, command);
  },

  async rebootDevice(serial: string, mode?: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('reboot_device', { serial, mode });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.rebootDevice(serial, mode);
  },

  async connectWirelessDevice(hostPort: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('connect_wireless_device', { hostPort });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.connectWireless(hostPort);
  },

  async pairWirelessDevice(hostPort: string, pairingCode: string): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('pair_wireless_device', { hostPort, pairingCode });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.pairWireless(hostPort, pairingCode);
  },

  async restartAdb(): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('restart_adb_server');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.restartAdb();
  },

  async listFiles(serial: string, path: string): Promise<FileEntry[]> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<FileEntry[]>('list_files', { serial, path });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.listFiles(serial, path);
  },

  async createDirectory(serial: string, path: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('create_directory', { serial, path });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.createDirectory(serial, path);
  },

  async deleteFile(serial: string, path: string, recursive: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('delete_file', { serial, path, recursive });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.deleteFile(serial, path);
  },

  async renameFile(serial: string, oldPath: string, newPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('rename_file', { serial, oldPath, newPath });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.renameFile(serial, oldPath, newPath);
  },

  async listPackages(serial: string, filter: string): Promise<AppPackage[]> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<AppPackage[]>('list_packages', { serial, filter });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.listPackages(serial, filter);
  },

  async installApk(serial: string, apkPath: string, reinstall: boolean): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('install_apk', { serial, apkPath, reinstall });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.installApk(serial, apkPath);
  },

  async uninstallApp(serial: string, packageName: string, keepData: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('uninstall_app', { serial, packageName, keepData });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.uninstallApp(serial, packageName);
  },

  async forceStopApp(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('force_stop_app', { serial, packageName });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.forceStopApp(serial, packageName);
  },

  async clearAppData(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('clear_app_data', { serial, packageName });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.clearAppData(serial, packageName);
  },

  async setAppEnabled(serial: string, packageName: string, enabled: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('set_app_enabled', { serial, packageName, enabled });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.setAppEnabled(serial, packageName, enabled);
  },

  async launchApp(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('launch_app', { serial, packageName });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.launchApp(serial, packageName);
  },

  async startScrcpy(serial: string, config: ScrcpyConfig): Promise<boolean> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('start_scrcpy', { serial, config });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.startScrcpy(serial, config);
  },

  async stopScrcpy(serial: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('stop_scrcpy', { serial });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.stopScrcpy(serial);
  },

  async getLogs(): Promise<LogMessage[]> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<LogMessage[]>('get_logs');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.getLogs();
  },

  async clearLogs(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('clear_logs');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.clearLogs();
  },

  async getSettings(): Promise<AppSettings> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<AppSettings>('get_settings');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.getSettings();
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<void>('save_settings', { settings });
      } catch (err) {
        console.warn('Tauri invoke error, falling back to engine:', err);
      }
    }
    return adbEngine.saveSettings(settings);
  },
};
