import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Play,
  Square,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eraser,
  Upload,
  Search,
  RefreshCw,
  FolderArchive,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { AppPackage, DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ipc } from '../../lib/ipc';

interface AppsViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  confirmDestructive: boolean;
  onListPackages: (serial: string, filter: string) => Promise<AppPackage[]>;
  onInstallApk: (serial: string, apkPath: string, reinstall: boolean) => Promise<string>;
  onUninstallApp: (serial: string, pkg: string, keepData: boolean) => Promise<void>;
  onForceStop: (serial: string, pkg: string) => Promise<void>;
  onClearData: (serial: string, pkg: string) => Promise<void>;
  onSetEnabled: (serial: string, pkg: string, enabled: boolean) => Promise<void>;
  onLaunchApp: (serial: string, pkg: string) => Promise<void>;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const AppsView: React.FC<AppsViewProps> = ({
  selectedDevice,
  language,
  confirmDestructive,
  onListPackages,
  onInstallApk,
  onUninstallApp,
  onForceStop,
  onClearData,
  onSetEnabled,
  onLaunchApp,
  onNotify,
}) => {
  const [packages, setPackages] = useState<AppPackage[]>([]);
  const [filter, setFilter] = useState<'all' | 'user' | 'system' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Confirmation dialogs
  const [uninstallTarget, setUninstallTarget] = useState<AppPackage | null>(null);
  const [clearDataTarget, setClearDataTarget] = useState<AppPackage | null>(null);

  const t = translations[language];

  const fetchPackages = async () => {
    if (!selectedDevice) return;
    setIsLoading(true);
    try {
      const list = await onListPackages(selectedDevice.serial, filter);
      setPackages(list);
    } catch (err: any) {
      onNotify('error', 'Package Error', err.message || 'Failed to list packages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [selectedDevice?.serial, filter]);

  const handleLaunch = async (pkg: AppPackage) => {
    if (!selectedDevice) return;
    try {
      await onLaunchApp(selectedDevice.serial, pkg.package_name);
      onNotify('success', 'App Launched', `Launched ${pkg.display_name}`);
    } catch (err: any) {
      onNotify('error', 'Launch Failed', err.message);
    }
  };

  const handleForceStop = async (pkg: AppPackage) => {
    if (!selectedDevice) return;
    try {
      await onForceStop(selectedDevice.serial, pkg.package_name);
      onNotify('info', 'Process Terminated', `Sent SIGKILL to ${pkg.package_name}`);
    } catch (err: any) {
      onNotify('error', 'Force Stop Failed', err.message);
    }
  };

  const handleToggleEnable = async (pkg: AppPackage) => {
    if (!selectedDevice) return;
    try {
      const targetState = !pkg.is_enabled;
      await onSetEnabled(selectedDevice.serial, pkg.package_name, targetState);
      onNotify('info', 'Package State Changed', `${pkg.display_name} is now ${targetState ? 'enabled' : 'disabled'}`);
      fetchPackages();
    } catch (err: any) {
      onNotify('error', 'Action Failed', err.message);
    }
  };

  const handleUninstallConfirm = async () => {
    if (!selectedDevice || !uninstallTarget) return;
    try {
      await onUninstallApp(selectedDevice.serial, uninstallTarget.package_name, false);
      onNotify('warning', 'Uninstalled', `Successfully removed ${uninstallTarget.display_name}`);
      setUninstallTarget(null);
      fetchPackages();
    } catch (err: any) {
      onNotify('error', 'Uninstall Failed', err.message);
    }
  };

  const handleClearDataConfirm = async () => {
    if (!selectedDevice || !clearDataTarget) return;
    try {
      await onClearData(selectedDevice.serial, clearDataTarget.package_name);
      onNotify('info', 'Data Cleared', `Cleared internal data & cache for ${clearDataTarget.display_name}`);
      setClearDataTarget(null);
    } catch (err: any) {
      onNotify('error', 'Clear Data Failed', err.message);
    }
  };

  const handleInstallFile = async (apkPath: string) => {
    if (!selectedDevice) return;
    const cleanPath = apkPath.trim();
    if (!cleanPath) return;

    if (!cleanPath.toLowerCase().endsWith('.apk')) {
      onNotify(
        'error',
        'Invalid Extension',
        'ApexDroid supports standard standalone .apk packages via direct ADB install. Split-bundle .apks/.xapk formats require custom multi-APK bundle installers.'
      );
      return;
    }

    setIsInstalling(true);
    const fileName = cleanPath.split(/[/\\]/).pop() || cleanPath;
    onNotify('info', 'Installing APK', `Sideloading ${fileName} via adb install -r...`);

    try {
      const res = await onInstallApk(selectedDevice.serial, cleanPath, true);
      onNotify('success', 'APK Installed', `Successfully installed ${fileName} (${res})`);
      fetchPackages();
    } catch (err: any) {
      onNotify('error', 'Installation Failed', err.message || 'ADB rejected the APK package');
    } finally {
      setIsInstalling(false);
    }
  };

  const handlePickApk = async () => {
    const selected = await ipc.pickFile({
      title: 'Select Android Package (.apk) to Install',
      filters: [{ name: 'Android Package', extensions: ['apk'] }],
    });
    if (selected) {
      handleInstallFile(selected);
    }
  };

  const filteredPackages = packages.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.display_name.toLowerCase().includes(q) || p.package_name.toLowerCase().includes(q);
  });

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <Boxes className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.appManager}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Inspect, sideload, enable/disable, and manage application packages via Android Package Manager.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePickApk}
            disabled={isInstalling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white shadow-sm shadow-cyan-950 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isInstalling ? 'Installing APK...' : t.installApkFile}</span>
          </button>

          <button
            onClick={fetchPackages}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-400 transition-colors disabled:opacity-50"
            title="Refresh packages"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* APK Sideload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            const file = files[0];
            // In Tauri or browser environment with path property
            const filePath = (file as any).path || file.name;
            handleInstallFile(filePath);
          }
        }}
        onClick={handlePickApk}
        className={`p-4 rounded-xl border border-dashed text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-neutral-800 bg-[#0b0f19] hover:border-neutral-700'
        }`}
      >
        <FolderArchive className="w-6 h-6 text-cyan-400 mx-auto mb-1.5" />
        <div className="text-xs font-semibold text-neutral-200">
          {isInstalling ? 'Sideloading Package...' : t.dragApkPrompt}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5">
          Click or drop standard <code className="font-mono text-cyan-400">.apk</code> file to run <code className="font-mono text-cyan-400">adb install -r</code>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d121e] p-2.5 rounded-xl border border-neutral-800/80">
        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1 w-full sm:w-auto bg-[#090b10] p-1 rounded-lg border border-neutral-800/60">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.filterAll}
          </button>
          <button
            onClick={() => setFilter('user')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'user'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.filterUser}
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'system'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.filterSystem}
          </button>
          <button
            onClick={() => setFilter('disabled')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'disabled'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.filterDisabled}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.searchApps}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#090b10] border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Package List Grid / Table */}
      <div className="bg-[#0c1017] border border-neutral-800/80 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
            <span className="text-xs font-medium">{t.loadingApps}</span>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Boxes className="w-8 h-8 text-neutral-700" />
            <span className="text-xs font-medium">{t.noAppsFound}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e1422] text-neutral-400 font-medium border-b border-neutral-800/80">
                <tr>
                  <th className="py-2.5 px-4">{t.appName}</th>
                  <th className="py-2.5 px-3">{t.packageName}</th>
                  <th className="py-2.5 px-3 w-28">{t.type}</th>
                  <th className="py-2.5 px-3 w-28">{t.state}</th>
                  <th className="py-2.5 px-4 text-right w-44">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/60">
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.package_name} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-neutral-800/80 border border-neutral-700 flex items-center justify-center shrink-0">
                          <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <span className="font-semibold text-neutral-200">{pkg.display_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-400 text-[11px]">
                      {pkg.package_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                          pkg.is_system
                            ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                            : 'bg-cyan-950/30 text-cyan-400 border-cyan-500/20'
                        }`}
                      >
                        {pkg.is_system ? 'System' : 'User'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                          pkg.is_enabled
                            ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-950/30 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${pkg.is_enabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {pkg.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleLaunch(pkg)}
                          className="p-1 hover:text-cyan-400 text-neutral-400 rounded hover:bg-neutral-800 transition-colors"
                          title={t.launch}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleForceStop(pkg)}
                          className="p-1 hover:text-amber-400 text-neutral-400 rounded hover:bg-neutral-800 transition-colors"
                          title={t.forceStop}
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleEnable(pkg)}
                          className="p-1 hover:text-indigo-400 text-neutral-400 rounded hover:bg-neutral-800 transition-colors"
                          title={pkg.is_enabled ? t.disable : t.enable}
                        >
                          {pkg.is_enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-neutral-500" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirmDestructive) {
                              setClearDataTarget(pkg);
                            } else {
                              onClearData(selectedDevice.serial, pkg.package_name);
                            }
                          }}
                          className="p-1 hover:text-sky-400 text-neutral-400 rounded hover:bg-neutral-800 transition-colors"
                          title={t.clearData}
                        >
                          <Eraser className="w-3.5 h-3.5" />
                        </button>
                        {!pkg.is_system && (
                          <button
                            onClick={() => {
                              if (confirmDestructive) {
                                setUninstallTarget(pkg);
                              } else {
                                onUninstallApp(selectedDevice.serial, pkg.package_name, false);
                              }
                            }}
                            className="p-1 hover:text-rose-400 text-neutral-400 rounded hover:bg-neutral-800 transition-colors"
                            title={t.uninstall}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Uninstall Dialog */}
      <ConfirmDialog
        isOpen={!!uninstallTarget}
        title="Confirm Application Uninstall"
        message={`Are you sure you want to uninstall "${uninstallTarget?.display_name}" (${uninstallTarget?.package_name})? Application data may be removed.`}
        confirmLabel={t.uninstall}
        isDestructive={true}
        onConfirm={handleUninstallConfirm}
        onCancel={() => setUninstallTarget(null)}
      />

      {/* Confirm Clear Data Dialog */}
      <ConfirmDialog
        isOpen={!!clearDataTarget}
        title="Confirm Clear Data"
        message={`Are you sure you want to clear all data and cache for "${clearDataTarget?.display_name}"? This resets the application to its first-run state.`}
        confirmLabel="Clear Data"
        isDestructive={true}
        onConfirm={handleClearDataConfirm}
        onCancel={() => setClearDataTarget(null)}
      />
    </div>
  );
};
