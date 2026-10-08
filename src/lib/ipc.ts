import {
  AppPackage,
  AppSettings,
  BackupManifest,
  BackupPlan,
  DeviceDetails,
  FileEntry,
  LogMessage,
  RestoreResult,
  ScrcpyConfig,
} from '../types';
import { adbEngine } from './adb-engine';

/**
 * Checks whether the application is running inside the native Tauri desktop shell.
 */
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
};

export const ipc = {
  isNativeMode(): boolean {
    return isTauriEnvironment();
  },

  async getDevices(): Promise<DeviceDetails[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<DeviceDetails[]>('get_devices');
    }
    return adbEngine.getDevices();
  },

  async getDeviceDetails(serial: string): Promise<DeviceDetails> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<DeviceDetails>('get_device_details', { serial });
    }
    return adbEngine.getDeviceDetails(serial);
  },

  async executeShell(serial: string, command: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('execute_shell', { serial, command });
    }
    return adbEngine.executeShell(serial, command);
  },

  async rebootDevice(serial: string, mode?: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('reboot_device', { serial, mode });
    }
    return adbEngine.rebootDevice(serial, mode);
  },

  async sendKeyEvent(serial: string, keycode: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('send_key_event', { serial, keycode });
    }
    return adbEngine.sendKeyEvent(serial, keycode);
  },

  async takeScreenshot(serial: string, destinationPath: string): Promise<number> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number>('take_screenshot', { serial, destinationPath });
    }
    await adbEngine.takeScreenshot(serial, destinationPath);
    return 1450200; // Simulated PNG byte size
  },

  async connectWirelessDevice(hostPort: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('connect_wireless_device', { hostPort });
    }
    return adbEngine.connectWireless(hostPort);
  },

  async pairWirelessDevice(hostPort: string, pairingCode: string): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('pair_wireless_device', { hostPort, pairingCode });
    }
    return adbEngine.pairWireless(hostPort, pairingCode);
  },

  async restartAdb(): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('restart_adb_server');
    }
    return adbEngine.restartAdb();
  },

  async listFiles(serial: string, path: string): Promise<FileEntry[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<FileEntry[]>('list_files', { serial, path });
    }
    return adbEngine.listFiles(serial, path);
  },

  async createDirectory(serial: string, path: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('create_directory', { serial, path });
    }
    return adbEngine.createDirectory(serial, path);
  },

  async deleteFile(serial: string, path: string, recursive: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('delete_file', { serial, path, recursive });
    }
    return adbEngine.deleteFile(serial, path);
  },

  async renameFile(serial: string, oldPath: string, newPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('rename_file', { serial, oldPath, newPath });
    }
    return adbEngine.renameFile(serial, oldPath, newPath);
  },

  async pullFile(serial: string, remotePath: string, localPath: string): Promise<number> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number>('pull_file', { serial, remotePath, localPath });
    }
    return adbEngine.pullFile(serial, remotePath, localPath);
  },

  async pushFile(serial: string, localPath: string, remotePath: string): Promise<number> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number>('push_file', { serial, localPath, remotePath });
    }
    return adbEngine.pushFile(serial, localPath, remotePath);
  },

  async listPackages(serial: string, filter: string): Promise<AppPackage[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<AppPackage[]>('list_packages', { serial, filter });
    }
    return adbEngine.listPackages(serial, filter);
  },

  async getAppIcon(serial: string, packageName: string, apkPath: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('get_app_icon', { serial, packageName, apkPath });
    }
    return null;
  },

  async installApk(serial: string, apkPath: string, reinstall: boolean): Promise<string> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('install_apk', { serial, apkPath, reinstall });
    }
    return adbEngine.installApk(serial, apkPath);
  },

  async uninstallApp(serial: string, packageName: string, keepData: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('uninstall_app', { serial, packageName, keepData });
    }
    return adbEngine.uninstallApp(serial, packageName);
  },

  async forceStopApp(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('force_stop_app', { serial, packageName });
    }
    return adbEngine.forceStopApp(serial, packageName);
  },

  async clearAppData(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('clear_app_data', { serial, packageName });
    }
    return adbEngine.clearAppData(serial, packageName);
  },

  async setAppEnabled(serial: string, packageName: string, enabled: boolean): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('set_app_enabled', { serial, packageName, enabled });
    }
    return adbEngine.setAppEnabled(serial, packageName, enabled);
  },

  async launchApp(serial: string, packageName: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('launch_app', { serial, packageName });
    }
    return adbEngine.launchApp(serial, packageName);
  },

  async startScrcpy(serial: string, config: ScrcpyConfig): Promise<boolean> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('start_scrcpy', { serial, config });
    }
    return adbEngine.startScrcpy(serial, config);
  },

  async stopScrcpy(serial: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('stop_scrcpy', { serial });
    }
    return adbEngine.stopScrcpy(serial);
  },

  async isScrcpyRunning(serial: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('is_scrcpy_running', { serial });
    }
    return adbEngine.isMirroring(serial);
  },

  async isScrcpyRecording(serial: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('is_scrcpy_recording', { serial });
    }
    return adbEngine.isRecording(serial);
  },

  async getLogcat(serial: string, maxLines?: number, filter?: string): Promise<string[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string[]>('get_logcat', { serial, maxLines, filter });
    }
    return adbEngine.getLogcat(serial, maxLines, filter);
  },

  async clearLogcat(serial: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('clear_logcat', { serial });
    }
    return adbEngine.clearLogcat(serial);
  },

  async runBackup(plan: BackupPlan): Promise<BackupManifest> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<BackupManifest>('run_backup', { plan });
    }
    return adbEngine.runBackup(plan);
  },

  async restoreBackup(serial: string, backupDir: string): Promise<RestoreResult> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<RestoreResult>('restore_backup', { serial, backupDir });
    }
    return adbEngine.restoreBackup(serial, backupDir);
  },

  async cancelBackup(serial?: string): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('cancel_backup', { serial: serial || '' });
    }
    return adbEngine.cancelBackup();
  },

  async getLogs(): Promise<LogMessage[]> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<LogMessage[]>('get_logs');
    }
    return adbEngine.getLogs();
  },

  async clearLogs(): Promise<void> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<void>('clear_logs');
    }
    return adbEngine.clearLogs();
  },

  async getSettings(): Promise<AppSettings> {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<AppSettings>('get_settings');
    }
    const saved = localStorage.getItem('apexdroid_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return adbEngine.getSettings();
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    localStorage.setItem('apexdroid_settings', JSON.stringify(settings));
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<void>('save_settings', { settings });
      return;
    }
    return adbEngine.saveSettings(settings);
  },

  async pickFile(options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const res = await open({
          multiple: false,
          directory: false,
          title: options?.title || 'Select File',
          filters: options?.filters,
        });
        if (typeof res === 'string') return res;
      } catch (e) {
        console.warn('Native open dialog failed:', e);
      }
    }
    return prompt(options?.title || 'Enter absolute local file path:');
  },

  async pickSaveFile(options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const res = await save({
          title: options?.title || 'Save File',
          defaultPath: options?.defaultPath,
          filters: options?.filters,
        });
        if (typeof res === 'string') return res;
      } catch (e) {
        console.warn('Native save dialog failed:', e);
      }
    }
    return prompt(options?.title || 'Enter destination file path:', options?.defaultPath || 'C:\\ApexDroid\\output.png');
  },

  async pickDirectory(title?: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const res = await open({
          directory: true,
          multiple: false,
          title: title || 'Select Folder',
        });
        if (typeof res === 'string') return res;
      } catch (e) {
        console.warn('Native folder dialog failed:', e);
      }
    }
    return prompt(title || 'Enter folder path:', 'C:\\ApexDroid_Backups');
  },
};
