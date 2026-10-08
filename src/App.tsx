import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActiveTab,
  AppSettings,
  DeviceDetails,
  LogMessage,
  ScrcpyConfig,
  ToastNotification,
} from './types';
import { Language } from './lib/i18n';
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
    default_download_path: 'C:\\ApexDroid\\Downloads',
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

  const isRefreshingRef = useRef(false);
  const activeDeviceRef = useRef<string | null>(null);

  useEffect(() => {
    activeDeviceRef.current = selectedDevice?.serial || null;
  }, [selectedDevice?.serial]);

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
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch initial data returning the latest devices list to avoid stale closures
  const loadDevices = useCallback(async (): Promise<DeviceDetails[]> => {
    if (isRefreshingRef.current) return [];
    isRefreshingRef.current = true;
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
      return list;
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      return [];
    } finally {
      isRefreshingRef.current = false;
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

  // Set up real-time device connection events (once on mount with strict leak-free cleanup)
  useEffect(() => {
    let unlistenConnect: (() => void) | undefined;
    let unlistenDisconnect: (() => void) | undefined;
    let isMounted = true;

    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          if (!isMounted) return;
          listen('device-connected', (event: any) => {
            if (!isMounted) return;
            loadDevices();
            addToast('info', 'Device Connected', `Device ${event.payload?.serial || ''} connected`);
          }).then((unsub) => {
            if (!isMounted) {
              unsub();
            } else {
              unlistenConnect = unsub;
            }
          });

          listen('device-disconnected', (event: any) => {
            if (!isMounted) return;
            loadDevices();
            addToast('warning', 'Device Disconnected', `Device ${event.payload?.serial || ''} disconnected`);
          }).then((unsub) => {
            if (!isMounted) {
              unsub();
            } else {
              unlistenDisconnect = unsub;
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      if (unlistenConnect) unlistenConnect();
      if (unlistenDisconnect) unlistenDisconnect();
    };
  }, [loadDevices, addToast]);

  // Initial data loading & periodic background sync (clamped to prevent rapid process polling)
  useEffect(() => {
    loadDevices();
    loadLogs();
    loadSettings();

    const intervalMs = Math.max(settings.polling_interval_ms || 5000, 5000);
    const interval = setInterval(() => {
      if (!isRefreshingRef.current) {
        loadDevices();
        loadLogs();
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [loadDevices, loadLogs, loadSettings, settings.polling_interval_ms]);

  // Actions
  const handleRefreshDevices = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const updatedDevices = await loadDevices();
      await loadLogs();
      addToast('info', 'Scan Complete', `Found ${updatedDevices.length} connected device${updatedDevices.length === 1 ? '' : 's'}.`);
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  const handleRestartAdb = async () => {
    setIsRestartingAdb(true);
    try {
      const res = await ipc.restartAdb();
      addToast('success', 'ADB Restarted', res || 'Daemon killed and restarted on port 5037.');
      await loadDevices();
      await loadLogs();
    } catch (err: any) {
      addToast('error', 'ADB Restart Failed', err.message || 'Error restarting server');
    } finally {
      setIsRestartingAdb(false);
    }
  };

  const handleTakeScreenshot = async () => {
    if (!selectedDevice) {
      addToast('warning', 'No Device', 'Select a connected device to capture a screenshot.');
      return;
    }

    const defaultFilename = `screenshot_${selectedDevice.model.replace(/\s+/g, '_')}_${Date.now()}.png`;
    const defaultPath = `${settings.default_download_path.replace(/[\\/]$/, '')}/${defaultFilename}`;

    const savePath = await ipc.pickSaveFile({
      title: 'Save Device Screenshot',
      defaultPath,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });

    if (!savePath) {
      return; // User cancelled
    }

    try {
      addToast('info', 'Capturing', `Requesting framebuffer from ${selectedDevice.model}...`);
      const bytes = await ipc.takeScreenshot(selectedDevice.serial, savePath);
      const kb = (bytes / 1024).toFixed(1);
      addToast('success', 'Screenshot Saved', `Saved ${kb} KB image to ${savePath}`);
      await loadLogs();
    } catch (err: any) {
      addToast('error', 'Capture Failed', err.message || 'Failed to capture or transfer screenshot');
    }
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

  const handleToggleLanguage = async () => {
    const next: Language = language === 'en' ? 'fa' : 'en';
    const updated: AppSettings = { ...settings, language: next };
    setLanguage(next);
    setSettings(updated);
    try {
      await ipc.saveSettings(updated);
      addToast('info', 'Language Changed', next === 'fa' ? 'زبان به فارسی تغییر کرد' : 'Language set to English');
    } catch (e: any) {
      addToast('error', 'Settings Error', e.message || 'Failed to persist language setting');
    }
  };

  const handleConnectWireless = async (hostPort: string) => {
    try {
      const res = await ipc.connectWirelessDevice(hostPort);
      addToast('success', 'Wireless Connected', res);
      await loadDevices();
      await loadLogs();
    } catch (e: any) {
      addToast('error', 'Connection Failed', e.message || 'Failed to connect');
    }
  };

  const handlePairWireless = async (hostPort: string, code: string) => {
    try {
      const res = await ipc.pairWirelessDevice(hostPort, code);
      addToast('success', 'Paired Successfully', res);
      await loadDevices();
      await loadLogs();
    } catch (e: any) {
      addToast('error', 'Pairing Failed', e.message || 'Failed to pair');
    }
  };

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
  }, [selectedDevice, settings.default_download_path]);

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
              language={language}
              onSelectDevice={setSelectedDevice}
              setActiveTab={setActiveTab}
              onNavigateTab={setActiveTab}
              onTakeScreenshot={handleTakeScreenshot}
              onRebootDevice={handleRebootDevice}
              onRestartAdb={handleRestartAdb}
              onRefreshDevices={handleRefreshDevices}
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
              defaultDownloadPath={settings.default_download_path}
              confirmDestructive={settings.confirm_destructive_actions}
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
              confirmDestructive={settings.confirm_destructive_actions}
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
              defaultDownloadPath={settings.default_download_path}
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
              confirmDestructive={settings.confirm_destructive_actions}
              onExecuteCommand={ipc.executeShell}
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
              defaultPath={settings.default_download_path}
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
                addToast('info', 'Logs Cleared', 'In-memory ring buffer flushed.');
              }}
              onNotify={addToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              language={language}
              onToggleLanguage={handleToggleLanguage}
              onSaveSettings={async (updated) => {
                setSettings(updated);
                setLanguage(updated.language);
                await ipc.saveSettings(updated);
                addToast('success', 'Settings Saved', 'Configuration saved persistently to disk.');
              }}
              onNotify={addToast}
            />
          )}
        </main>
      </div>

      {/* Global Modals & Overlays */}
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
        onRebootDevice={handleRebootDevice}
      />

      <WirelessConnectModal
        isOpen={showWirelessModal}
        onClose={() => setShowWirelessModal(false)}
        onConnect={handleConnectWireless}
        onPair={handlePairWireless}
        language={language}
      />

      {/* Confirm Dialog for Destructive Reboots */}
      <ConfirmDialog
        isOpen={!!pendingReboot}
        title="Confirm Device Reboot"
        message={`Are you sure you want to reboot device ${pendingReboot?.serial}? Any unsaved work or running background operations will be interrupted.`}
        confirmLabel="Reboot Now"
        isDestructive={true}
        onConfirm={() => {
          if (pendingReboot) {
            executeReboot(pendingReboot.serial, pendingReboot.mode);
            setPendingReboot(null);
          }
        }}
        onCancel={() => setPendingReboot(null)}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
