import React, { useState, useEffect } from 'react';
import {
  Archive,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Boxes,
  Play,
  RotateCcw,
  ShieldAlert,
  FolderOpen,
  FileText,
  Clock,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { BackupManifest, BackupPlan, DeviceDetails, RestoreResult } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ipc } from '../../lib/ipc';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface BackupRestoreViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  selectedDevice,
  language,
  onNotify,
}) => {
  const [activeMode, setActiveMode] = useState<'backup' | 'restore'>('backup');
  const [includeApps, setIncludeApps] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [destPath, setDestPath] = useState('C:\\ApexDroid_Backups');
  const [restoreDir, setRestoreDir] = useState('C:\\ApexDroid_Backups');

  // Package selection from real device
  const [devicePackages, setDevicePackages] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupManifest, setBackupManifest] = useState<BackupManifest | null>(null);

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const t = translations[language];

  // Fetch real user packages for selection
  useEffect(() => {
    if (selectedDevice) {
      setIsLoadingPackages(true);
      ipc.listPackages(selectedDevice.serial, 'user')
        .then((pkgs) => {
          const names = pkgs.map((p) => p.package_name);
          setDevicePackages(names);
          setSelectedPackages(names.slice(0, 10)); // Default select up to 10 user packages
        })
        .catch((err) => {
          console.warn('Could not fetch user packages:', err);
        })
        .finally(() => setIsLoadingPackages(false));
    }
  }, [selectedDevice?.serial]);

  const handleBrowseDirectory = async (forRestore: boolean = false) => {
    try {
      if (ipc.isNativeMode()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: forRestore ? 'Select Backup Directory' : 'Select Destination Directory',
        });
        if (selected && typeof selected === 'string') {
          if (forRestore) {
            setRestoreDir(selected);
          } else {
            setDestPath(selected);
          }
        }
      }
    } catch (e) {
      // If plugin-dialog is not initialized, let user manually edit path
      onNotify('info', 'Folder Path', 'You can type the exact target folder path directly into the input.');
    }
  };

  const handleStartBackup = async () => {
    if (!selectedDevice) return;
    if (!includeApps && !includeMedia) {
      onNotify('warning', 'Selection Empty', 'Select at least one category to back up (APKs or Media).');
      return;
    }

    const plan: BackupPlan = {
      serial: selectedDevice.serial,
      destination_dir: destPath.trim() || 'C:\\ApexDroid_Backups',
      include_apk: includeApps,
      include_shared_storage: includeMedia,
      include_system_settings: false, // Accurately disclaimed as unprivileged
      specific_packages: includeApps ? selectedPackages : [],
    };

    setIsBackingUp(true);
    setBackupManifest(null);
    onNotify('info', 'Backup Started', `Pulling real device assets to ${plan.destination_dir}...`);

    try {
      const manifest = await ipc.runBackup(plan);
      setBackupManifest(manifest);
      onNotify('success', 'Backup Complete', `Backed up ${manifest.total_files} items (${(manifest.total_bytes / (1024 * 1024)).toFixed(1)} MB) with SHA-256 integrity verification.`);
    } catch (err: any) {
      onNotify('error', 'Backup Failed', err.message || 'Operation failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCancelBackup = async () => {
    try {
      await ipc.cancelBackup();
      onNotify('warning', 'Backup Cancelled', 'Cancel signal sent to backend.');
    } catch (err: any) {
      onNotify('error', 'Cancel Error', err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedDevice) return;
    setShowRestoreConfirm(false);
    setIsRestoring(true);
    setRestoreResult(null);
    onNotify('info', 'Restore Started', `Reading manifest and restoring to ${selectedDevice.serial}...`);

    try {
      const result = await ipc.restoreBackup(selectedDevice.serial, restoreDir.trim());
      setRestoreResult(result);
      if (result.failed_items === 0) {
        onNotify('success', 'Restore Complete', `Restored ${result.successful_items} of ${result.total_items} items.`);
      } else {
        onNotify('warning', 'Restore Completed with Warnings', `Restored ${result.successful_items} items, ${result.failed_items} failed.`);
      }
    } catch (err: any) {
      onNotify('error', 'Restore Failed', err.message || 'Failed to read manifest or restore data');
    } finally {
      setIsRestoring(false);
    }
  };

  const togglePackageSelection = (pkg: string) => {
    setSelectedPackages((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]
    );
  };

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <Archive className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.backupWizard}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Genuine offline device backup with SHA-256 file manifest verification and APK extraction via ADB.
          </p>
        </div>

        {/* Tab switch between Backup and Restore */}
        <div className="flex rounded-lg bg-[#0a0d14] p-1 border border-neutral-800 text-xs">
          <button
            onClick={() => setActiveMode('backup')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors ${
              activeMode === 'backup'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Create Backup
          </button>
          <button
            onClick={() => setActiveMode('restore')}
            className={`py-1.5 px-3 rounded-md font-medium transition-colors ${
              activeMode === 'restore'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Restore Backup
          </button>
        </div>
      </div>

      {activeMode === 'backup' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left 2 Cols: Selection & Settings */}
          <div className="md:col-span-2 space-y-5">
            <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                {t.backupSelectItems}
              </h2>

              <div className="space-y-3">
                {/* Apps Category */}
                <div className="p-3.5 rounded-lg bg-[#0f1422] border border-neutral-800 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white">{t.backupApps}</div>
                        <div className="text-[11px] text-neutral-400">
                          Pulls real base.apk packages using <code className="text-cyan-400 font-mono">pm path</code>
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeApps}
                      disabled={isBackingUp}
                      onChange={(e) => setIncludeApps(e.target.checked)}
                      className="accent-cyan-500"
                    />
                  </label>

                  {/* Package Selector when Apps is checked */}
                  {includeApps && (
                    <div className="pt-2 border-t border-neutral-800/60">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                        <span>Select User Packages ({selectedPackages.length} / {devicePackages.length} selected):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPackages([...devicePackages])}
                            className="text-cyan-400 hover:underline text-[10px]"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPackages([])}
                            className="text-neutral-400 hover:underline text-[10px]"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                        {isLoadingPackages ? (
                          <div className="text-neutral-500 py-2">Loading user packages from device...</div>
                        ) : devicePackages.length === 0 ? (
                          <div className="text-neutral-500 py-1">No user applications found.</div>
                        ) : (
                          devicePackages.map((pkg) => (
                            <label
                              key={pkg}
                              className="flex items-center justify-between p-1.5 rounded bg-[#090b10] border border-neutral-800/60 hover:bg-[#121726] cursor-pointer"
                            >
                              <span className="truncate max-w-sm text-neutral-300">{pkg}</span>
                              <input
                                type="checkbox"
                                checked={selectedPackages.includes(pkg)}
                                onChange={() => togglePackageSelection(pkg)}
                                className="accent-cyan-500 ml-2"
                              />
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Shared Storage Media */}
                <label className="flex items-center justify-between p-3.5 rounded-lg bg-[#0f1422] border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{t.backupMedia}</div>
                      <div className="text-[11px] text-neutral-400">
                        Pulls accessible files from <code className="font-mono text-indigo-300">/sdcard/Documents</code> and <code className="font-mono text-indigo-300">/sdcard/Download</code>
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeMedia}
                    disabled={isBackingUp}
                    onChange={(e) => setIncludeMedia(e.target.checked)}
                    className="accent-cyan-500"
                  />
                </label>

                {/* System Limitations Disclaimer */}
                <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Android Security & Permission Invariants</span>
                  </div>
                  <p className="leading-relaxed">
                    Unprivileged ADB access cannot extract private app sandboxes (<code className="font-mono text-neutral-300">/data/data/</code>) or system Wi-Fi credentials without device root access or Android Backup Agent manifest approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Destination Directory */}
            <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                {t.destinationFolder}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destPath}
                  disabled={isBackingUp}
                  onChange={(e) => setDestPath(e.target.value)}
                  placeholder="C:\ApexDroid_Backups"
                  className="flex-1 bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleBrowseDirectory(false)}
                  disabled={isBackingUp}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Verified Manifest Result */}
            {backupManifest && (
              <div className="p-4 rounded-xl bg-[#0d1624] border border-cyan-500/40 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-cyan-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Verified Backup Manifest Generated
                  </span>
                  <span className="font-mono text-[11px] text-neutral-400">{backupManifest.timestamp_iso.substring(0, 19)}</span>
                </div>
                <div className="text-[11px] text-neutral-300 space-y-1 font-mono">
                  <div>Total Files: {backupManifest.total_files}</div>
                  <div>Total Transferred: {(backupManifest.total_bytes / (1024 * 1024)).toFixed(2)} MB</div>
                  <div>Target Serial: {backupManifest.device_serial}</div>
                </div>
                <div className="pt-2 text-[10px] text-neutral-400 border-t border-neutral-800">
                  Integrity Verified: All files hashed with SHA-256 and cataloged in <code className="text-cyan-300">backup_manifest.json</code>.
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Action & Controls */}
          <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 flex flex-col justify-between h-fit space-y-5">
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Operation Scope
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Target Device</span>
                  <span className="text-white font-medium truncate max-w-[130px]">{selectedDevice.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Serial</span>
                  <span className="text-white font-mono text-[11px]">{selectedDevice.serial}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Selected APKs</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {includeApps ? selectedPackages.length : 0}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Integrity Check</span>
                  <span className="text-white font-mono text-[11px]">SHA-256 Digest</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Storage Scope</span>
                  <span className="text-white">User-Accessible</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleStartBackup}
                disabled={isBackingUp || (!includeApps && !includeMedia)}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-sm shadow-cyan-950 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isBackingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isBackingUp ? 'Backing Up...' : t.startBackup}</span>
              </button>

              {isBackingUp && (
                <button
                  onClick={handleCancelBackup}
                  className="w-full py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-rose-300 text-xs transition-colors"
                >
                  Cancel Backup
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Restore Flow */
        <div className="space-y-5 max-w-2xl">
          <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Restore from Backup Manifest
            </h2>

            <div className="space-y-2 text-xs">
              <label className="block text-neutral-400">Select Backup Folder (containing backup_manifest.json):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={restoreDir}
                  disabled={isRestoring}
                  onChange={(e) => setRestoreDir(e.target.value)}
                  placeholder="C:\ApexDroid_Backups"
                  className="flex-1 bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleBrowseDirectory(true)}
                  disabled={isRestoring}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Restoration Confirmation Note</span>
              </div>
              <p className="text-[11px] text-amber-200 leading-relaxed">
                Restoring will reinstall APKs (<code className="font-mono">pm install -r</code>) and push media files back to <code className="font-mono">/sdcard/Download</code> on target device <strong className="text-white font-mono">{selectedDevice.serial}</strong>.
              </p>
            </div>

            <button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={isRestoring || !restoreDir.trim()}
              className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>{isRestoring ? 'Restoring Files...' : 'Start Restore Process'}</span>
            </button>
          </div>

          {/* Restore Results Summary */}
          {restoreResult && (
            <div className="p-4 rounded-xl bg-[#0d1624] border border-cyan-500/40 text-xs space-y-2 animate-in fade-in">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Restore Execution Summary</span>
              </h3>
              <div className="text-[11px] font-mono text-neutral-300 space-y-1">
                <div>Total Items in Manifest: {restoreResult.total_items}</div>
                <div>Successfully Restored: {restoreResult.successful_items}</div>
                <div>Failed: {restoreResult.failed_items}</div>
              </div>
              {restoreResult.details.length > 0 && (
                <div className="pt-2 max-h-32 overflow-y-auto space-y-1 text-[10px] font-mono text-neutral-400">
                  {restoreResult.details.map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Restore */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Confirm Device Restoration"
        message={`This will reinstall APKs and push media from "${restoreDir}" onto device ${selectedDevice.name} (${selectedDevice.serial}). Proceed?`}
        confirmLabel="Proceed with Restore"
        isDestructive={false}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={handleExecuteRestore}
      />
    </div>
  );
};
