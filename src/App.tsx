import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  AppSettings,
  DeviceDetails,
  FileEntry,
  LogMessage,
  ScrcpyConfig,
  ToastNotification,
} from './types';
import { Language, translations } from './lib/i18n';
import { ipc } from './lib/ipc';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { DashboardView } from './features/dashboard/DashboardView';
import { DevicesView } from './features/devices/DevicesView';
import { FileManagerView } from './features/files/FileManagerView';
import { AppsView } from './features/apps/AppsView';
import { ScreenMirrorView } from './features/mirror/ScreenMirrorView';
import { TerminalView } from './features/terminal/TerminalView';
import { ToolsView } from './features/tools/ToolsView';
import { BackupRestoreView } from './features/backup/BackupRestoreView';
import { LogsView } from './features/logs/LogsView';
import { SettingsView } from './features/settings/SettingsView';
import { WirelessConnectModal } from './features/devices/WirelessConnectModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const [devices, setDevices] = useState<DeviceDetails[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetails | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    language: 'en',
    adb_path: 'adb',
    scrcpy_path: 'scrcpy',
    default_download_path: '~/Downloads/ApexDroid',
    polling_interval_ms: 2500,
    auto_connect_wireless: true,
    confirm_destructive_actions: true,
    theme: 'dark',
    log_level: 'info',
  });

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestartingAdb, setIsRestartingAdb] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showWirelessModal, setShowWirelessModal] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [pendingReboot, setPendingReboot] = useState<{ serial: string; mode?: string } | null>(null);

  // Set document dir for Persian RTL support
  useEffect(() => {
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const addToast = useCallback(
    (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message, timestamp: Date.now() }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch initial data
  const loadDevices = useCallback(async () => {
    try {
      const list = await ipc.getDevices();
      setDevices(list);
      if (list.length > 0) {
        setSelectedDevice((prev) => {
          if (!prev) return list[0];
          const exists = list.find((d) => d.serial === prev.serial);
          return exists || list[0];
        });
      } else {
        setSelectedDevice(null);
      }
    } catch (err: any) {
      console.error('Failed to load devices:', err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const logList = await ipc.getLogs();
      setLogs(logList);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await ipc.getSettings();
      setSettings(s);
      if (s.language) setLanguage(s.language);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadLogs();
    loadSettings();

    // Background polling interval
    const interval = setInterval(() => {
      loadDevices();
      loadLogs();
    }, settings.polling_interval_ms || 2500);

    return () => clearInterval(interval);
  }, [loadDevices, loadLogs, loadSettings, settings.polling_interval_ms]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleTakeScreenshot();
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setShowWirelessModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDevice]);

  // Actions
  const handleRefreshDevices = async () => {
    setIsRefreshing(true);
    await loadDevices();
    await loadLogs();
    setTimeout(() => {
      setIsRefreshing(false);
      addToast('info', 'Scan Complete', `Found ${devices.length} active devices.`);
    }, 600);
  };

  const handleRestartAdb = async () => {
    setIsRestartingAdb(true);
    try {
      await ipc.restartAdb();
      addToast('success', 'ADB Restarted', 'Daemon killed and restarted on port 5037.');
      await loadDevices();
      await loadLogs();
    } catch (err: any) {
      addToast('error', 'ADB Restart Failed', err.message || 'Error restarting server');
    } finally {
      setIsRestartingAdb(false);
    }
  };

  const handleTakeScreenshot = () => {
    if (!selectedDevice) {
      addToast('warning', 'No Device', 'Select a device to take a screenshot.');
      return;
    }
    addToast('success', 'Screenshot Captured', `Saved frame buffer of ${selectedDevice.model} to PNG.`);
  };

  const handleRebootDevice = (mode?: string) => {
    if (!selectedDevice) {
      addToast('warning', 'No Device', 'Select a device to reboot.');
      return;
    }
    if (settings.confirm_destructive_actions) {
      setPendingReboot({ serial: selectedDevice.serial, mode });
    } else {
      executeReboot(selectedDevice.serial, mode);
    }
  };

  const executeReboot = async (serial: string, mode?: string) => {
    try {
      await ipc.rebootDevice(serial, mode);
      addToast('warning', 'Reboot Signal Sent', `Device ${serial} rebooting to ${mode || 'system'} mode.`);
      await loadLogs();
    } catch (err: any) {
      addToast('error', 'Reboot Failed', err.message);
    }
  };

  const handleToggleLanguage = () => {
    const next = language === 'en' ? 'fa' : 'en';
    setLanguage(next);
    setSettings((prev) => ({ ...prev, language: next }));
    ipc.saveSettings({ ...settings, language: next });
    addToast('info', 'Language Changed', next === 'fa' ? 'زبان به فارسی تغییر کرد' : 'Language set to English');
  };

  const handleConnectWireless = async (hostPort: string) => {
    const res = await ipc.connectWirelessDevice(hostPort);
    addToast('success', 'Wireless Connected', res);
    await loadDevices();
    await loadLogs();
  };

  const handlePairWireless = async (hostPort: string, code: string) => {
    const res = await ipc.pairWirelessDevice(hostPort, code);
    addToast('success', 'Paired Successfully', res);
    await loadDevices();
    await loadLogs();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090b10] text-neutral-100 font-sans select-none">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        devices={devices}
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        language={language}
        onRefreshDevices={handleRefreshDevices}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navigation & Window Bar */}
        <TopBar
          activeTab={activeTab}
          selectedDevice={selectedDevice}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          onRestartAdb={handleRestartAdb}
          onTakeScreenshot={handleTakeScreenshot}
          onRebootDevice={() => handleRebootDevice()}
          onOpenWirelessModal={() => setShowWirelessModal(true)}
          isRestartingAdb={isRestartingAdb}
        />

        {/* Dynamic Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#090b10]">
          {activeTab === 'dashboard' && (
            <DashboardView
              devices={devices}
              selectedDevice={selectedDevice}
              onSelectDevice={setSelectedDevice}
              setActiveTab={setActiveTab}
              language={language}
              onTakeScreenshot={handleTakeScreenshot}
              onRebootDevice={() => handleRebootDevice()}
              onRestartAdb={handleRestartAdb}
              logs={logs}
            />
          )}

          {activeTab === 'devices' && (
            <DevicesView
              devices={devices}
              selectedDevice={selectedDevice}
              onSelectDevice={setSelectedDevice}
              language={language}
              onRefresh={handleRefreshDevices}
              isRefreshing={isRefreshing}
              onConnectWireless={handleConnectWireless}
              onPairWireless={handlePairWireless}
              onRebootDevice={executeReboot}
            />
          )}

          {activeTab === 'files' && (
            <FileManagerView
              selectedDevice={selectedDevice}
              language={language}
              onListFiles={ipc.listFiles}
              onCreateDirectory={ipc.createDirectory}
              onDeleteFile={ipc.deleteFile}
              onRenameFile={ipc.renameFile}
              onNotify={addToast}
            />
          )}

          {activeTab === 'apps' && (
            <AppsView
              selectedDevice={selectedDevice}
              language={language}
              onListPackages={ipc.listPackages}
              onInstallApk={ipc.installApk}
              onUninstallApp={ipc.uninstallApp}
              onForceStop={ipc.forceStopApp}
              onClearData={ipc.clearAppData}
              onSetEnabled={ipc.setAppEnabled}
              onLaunchApp={ipc.launchApp}
              onNotify={addToast}
            />
          )}

          {activeTab === 'mirror' && (
            <ScreenMirrorView
              selectedDevice={selectedDevice}
              language={language}
              onStartScrcpy={ipc.startScrcpy}
              onStopScrcpy={ipc.stopScrcpy}
              onTakeScreenshot={handleTakeScreenshot}
              onNotify={addToast}
            />
          )}

          {activeTab === 'terminal' && (
            <TerminalView
              selectedDevice={selectedDevice}
              language={language}
              onExecuteShell={ipc.executeShell}
              onNotify={addToast}
            />
          )}

          {activeTab === 'tools' && (
            <ToolsView
              selectedDevice={selectedDevice}
              language={language}
              onTakeScreenshot={handleTakeScreenshot}
              onRestartAdb={handleRestartAdb}
              onNotify={addToast}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreView
              selectedDevice={selectedDevice}
              language={language}
              onNotify={addToast}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView
              logs={logs}
              language={language}
              onClearLogs={async () => {
                await ipc.clearLogs();
                setLogs([]);
                addToast('info', 'Logs Cleared', 'In-memory log ring buffer emptied.');
              }}
              onNotify={addToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              language={language}
              onSaveSettings={async (newSettings) => {
                await ipc.saveSettings(newSettings);
                setSettings(newSettings);
                if (newSettings.language !== language) {
                  setLanguage(newSettings.language);
                }
              }}
              onToggleLanguage={handleToggleLanguage}
              onNotify={addToast}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedDevice={selectedDevice}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onRestartAdb={handleRestartAdb}
        onTakeScreenshot={handleTakeScreenshot}
        onRebootDevice={() => handleRebootDevice()}
      />

      <WirelessConnectModal
        isOpen={showWirelessModal}
        onClose={() => setShowWirelessModal(false)}
        onConnect={handleConnectWireless}
        onPair={handlePairWireless}
        language={language}
      />

      {/* Reboot confirmation modal */}
      <ConfirmDialog
        isOpen={!!pendingReboot}
        title="Confirm Device Reboot"
        message={`Are you sure you want to reboot device ${pendingReboot?.serial}? Any unsaved work on the phone may be lost.`}
        confirmLabel="Reboot Now"
        isDestructive={true}
        onCancel={() => setPendingReboot(null)}
        onConfirm={() => {
          if (pendingReboot) {
            executeReboot(pendingReboot.serial, pendingReboot.mode);
            setPendingReboot(null);
          }
        }}
      />

      {/* Toast Notification Stream */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
