import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Play,
  Square,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eraser,
  Download,
  Upload,
  Search,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  FolderArchive,
  Layers,
} from 'lucide-react';
import { AppPackage, DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface AppsViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
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

  const handleSimulateDropInstall = (fileName: string) => {
    if (!selectedDevice) return;
    onInstallApk(selectedDevice.serial, fileName, true).then(() => {
      onNotify('success', 'APK Installed', `Successfully installed ${fileName}`);
      fetchPackages();
    });
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
            onClick={() => handleSimulateDropInstall('com.example.app_release.apk')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white shadow-sm shadow-cyan-950 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t.installApkFile}</span>
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

      {/* APK Drag and Drop Sideload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          handleSimulateDropInstall(file ? file.name : 'dropped_package.apk');
        }}
        className={`p-4 rounded-xl border border-dashed text-center transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-neutral-800 bg-[#0b0f19] hover:border-neutral-700'
        }`}
      >
        <FolderArchive className="w-6 h-6 text-cyan-400 mx-auto mb-1.5" />
        <div className="text-xs font-semibold text-neutral-200">{t.dragApkPrompt}</div>
        <div className="text-[11px] text-neutral-500 mt-0.5">
          Supports .apk, .apks, and .xapk files · Automatically runs <code className="font-mono text-cyan-400">pm install -r</code>
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
        <div className="flex items-center gap-2 max-w-sm w-full bg-[#090b10] border border-neutral-800/80 rounded-lg px-2.5 py-1 text-neutral-400">
          <Search className="w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchApps}
            className="bg-transparent w-full text-xs text-white placeholder:text-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Packages Table / List */}
      <div className="rounded-xl border border-neutral-800/80 bg-[#0c1017] overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Scanning installed packages over ADB...</span>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No matching applications found.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.package_name}
                className="p-3.5 hover:bg-[#101524] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                {/* App info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-neutral-800/90 border border-neutral-700/60 flex items-center justify-center shrink-0">
                    <Boxes className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white truncate">{pkg.display_name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        v{pkg.version_name || '1.0'} ({pkg.version_code || 1})
                      </span>
                      {pkg.is_system ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                          System
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
                          User
                        </span>
                      )}
                      {!pkg.is_enabled && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/40 font-mono">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono truncate mt-0.5">
                      {pkg.package_name} · <span className="text-neutral-500">{pkg.apk_path}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleLaunch(pkg)}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors"
                    title={t.launchApp}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleForceStop(pkg)}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors"
                    title={t.forceStop}
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleEnable(pkg)}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-cyan-400 transition-colors"
                    title={pkg.is_enabled ? t.disable : t.enable}
                  >
                    {pkg.is_enabled ? (
                      <ToggleRight className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>

                  <button
                    onClick={() => setClearDataTarget(pkg)}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors"
                    title={t.clearData}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>

                  {!pkg.is_system && (
                    <button
                      onClick={() => setUninstallTarget(pkg)}
                      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors"
                      title={t.uninstall}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!uninstallTarget}
        title="Uninstall Application"
        message={`Are you sure you want to uninstall ${uninstallTarget?.display_name} (${uninstallTarget?.package_name})?`}
        confirmLabel="Uninstall"
        isDestructive={true}
        onCancel={() => setUninstallTarget(null)}
        onConfirm={handleUninstallConfirm}
      />

      <ConfirmDialog
        isOpen={!!clearDataTarget}
        title="Clear App Data"
        message={`This will delete all database storage, logins, and cached settings for ${clearDataTarget?.display_name}. Proceed?`}
        confirmLabel="Clear Data"
        isDestructive={true}
        onCancel={() => setClearDataTarget(null)}
        onConfirm={handleClearDataConfirm}
      />
    </div>
  );
};
