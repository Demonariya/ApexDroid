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
  defaultPath: string;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  selectedDevice,
  language,
  defaultPath,
  onNotify,
}) => {
  const [activeMode, setActiveMode] = useState<'backup' | 'restore'>('backup');
  const [includeApps, setIncludeApps] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [destPath, setDestPath] = useState(defaultPath || 'C:\\ApexDroid\\Backups');
  const [restoreDir, setRestoreDir] = useState(defaultPath || 'C:\\ApexDroid\\Backups');

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
    const selected = await ipc.pickDirectory(
      forRestore ? 'Select Backup Directory with backup_manifest.json' : 'Select Destination Backup Directory'
    );
    if (selected) {
      if (forRestore) {
        setRestoreDir(selected);
      } else {
        setDestPath(selected);
      }
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
      destination_dir: destPath.trim() || 'C:\\ApexDroid\\Backups',
      include_apk: includeApps,
      include_shared_storage: includeMedia,
      include_system_settings: false,
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
    if (!selectedDevice) return;
    try {
      await ipc.cancelBackup(selectedDevice.serial);
      onNotify('warning', 'Cancellation Requested', 'Sent abort signal to ongoing backup process.');
    } catch (err: any) {
      onNotify('error', 'Cancel Error', err.message);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedDevice) return;
    setShowRestoreConfirm(false);
    setIsRestoring(true);
    setRestoreResult(null);
    onNotify('info', 'Restoring Assets', `Restoring verified items from ${restoreDir}...`);

    try {
      const result = await ipc.restoreBackup(selectedDevice.serial, restoreDir.trim());
      setRestoreResult(result);
      if (result.failed_items === 0) {
        onNotify('success', 'Restore Succeeded', `Restored ${result.successful_items} of ${result.total_items} items.`);
      } else {
        onNotify('warning', 'Restore Completed with Errors', `Restored ${result.successful_items} items, but ${result.failed_items} items failed.`);
      }
    } catch (err: any) {
      onNotify('error', 'Restore Failed', err.message || 'Manifest verification or transfer failed');
    } finally {
      setIsRestoring(false);
    }
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.backupRestore}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Genuine offline backup of user APKs and storage partitions with SHA-256 file manifest verification.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#090b10] p-1 rounded-lg border border-neutral-800/80">
          <button
            onClick={() => setActiveMode('backup')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeMode === 'backup'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.createBackup}
          </button>
          <button
            onClick={() => setActiveMode('restore')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeMode === 'restore'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.restoreBackup}
          </button>
        </div>
      </div>

      {/* Mode Viewport */}
      {activeMode === 'backup' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Configuration Pane */}
          <div className="lg:col-span-2 space-y-5">
            {/* Category Selectors */}
            <div className="bg-[#0c1017] border border-neutral-800/80 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">1. Select Backup Partitions</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Apps Category */}
                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    includeApps
                      ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
                      : 'bg-[#090b10] border-neutral-800 text-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeApps}
                    onChange={(e) => setIncludeApps(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 text-cyan-500 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{t.backupApps}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                      Pulls standalone APKs via <code className="font-mono text-cyan-400">pm path</code>.
                    </div>
                  </div>
                </label>

                {/* Media Category */}
                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    includeMedia
                      ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
                      : 'bg-[#090b10] border-neutral-800 text-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeMedia}
                    onChange={(e) => setIncludeMedia(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 text-cyan-500 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{t.backupMedia}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                      Pulls shared user storage (/sdcard/Documents, Download).
                    </div>
                  </div>
                </label>
              </div>

              {/* Package Selection Drawer if Apps enabled */}
              {includeApps && (
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-300 font-medium">
                      Packages to Extract ({selectedPackages.length} of {devicePackages.length} selected):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPackages.length === devicePackages.length) {
                          setSelectedPackages([]);
                        } else {
                          setSelectedPackages([...devicePackages]);
                        }
                      }}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      {selectedPackages.length === devicePackages.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-[#090b10] border border-neutral-800 rounded-lg p-2 divide-y divide-neutral-900/60">
                    {isLoadingPackages ? (
                      <div className="p-4 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                        <span>Querying installed packages...</span>
                      </div>
                    ) : devicePackages.length === 0 ? (
                      <div className="p-4 text-center text-xs text-neutral-500">No user packages found</div>
                    ) : (
                      devicePackages.map((pkg) => (
                        <label key={pkg} className="flex items-center gap-2 py-1 px-1.5 cursor-pointer text-xs text-neutral-300 hover:text-white">
                          <input
                            type="checkbox"
                            checked={selectedPackages.includes(pkg)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPackages((prev) => [...prev, pkg]);
                              } else {
                                setSelectedPackages((prev) => prev.filter((p) => p !== pkg));
                              }
                            }}
                            className="rounded border-neutral-800 text-cyan-500 focus:ring-0"
                          />
                          <span className="font-mono text-[11px] truncate">{pkg}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Target Path Configuration */}
            <div className="bg-[#0c1017] border border-neutral-800/80 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">2. Local Destination Directory</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={destPath}
                  onChange={(e) => setDestPath(e.target.value)}
                  className="flex-1 bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleBrowseDirectory(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-xs font-medium text-neutral-200 hover:text-white"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Start Action */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-neutral-500">
                Verified SHA-256 manifest will be generated in destination directory.
              </div>
              <div className="flex items-center gap-2">
                {isBackingUp ? (
                  <button
                    onClick={handleCancelBackup}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Backup</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartBackup}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-sm shadow-cyan-950"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Backup</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Status & Results Panel */}
          <div className="space-y-5">
            <div className="bg-[#0c1017] border border-neutral-800/80 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                Security & Platform Boundaries
              </h3>
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Android Sandbox Invariant</span>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Private application sandbox data (<code className="font-mono">/data/data/&lt;pkg&gt;</code>) is protected by SELinux. Extracting private SQLite databases and encrypted credentials without root access or a custom Android Backup Agent is restricted by design.
                </p>
              </div>
            </div>

            {backupManifest && (
              <div className="bg-[#0c1017] border border-cyan-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Manifest Verified</h4>
                </div>
                <div className="space-y-1.5 text-xs text-neutral-300 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Device:</span>
                    <span>{backupManifest.device_serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Files:</span>
                    <span>{backupManifest.total_files}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Size:</span>
                    <span>{(backupManifest.total_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Format:</span>
                    <span>v{backupManifest.format_version}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Restore View */
        <div className="bg-[#0c1017] border border-neutral-800/80 rounded-xl p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Select Backup Directory to Restore</h3>
            <p className="text-xs text-neutral-400">
              Point to a folder containing a valid <code className="text-cyan-400 font-mono">backup_manifest.json</code>. Hashes will be validated before pushing files.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={restoreDir}
              onChange={(e) => setRestoreDir(e.target.value)}
              className="flex-1 bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleBrowseDirectory(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-xs font-medium text-neutral-200 hover:text-white"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>
          </div>

          <button
            onClick={() => setShowRestoreConfirm(true)}
            disabled={isRestoring}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
            <span>{isRestoring ? 'Restoring...' : 'Validate and Restore'}</span>
          </button>

          {restoreResult && (
            <div className="p-4 rounded-xl bg-[#090b10] border border-neutral-800 space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center justify-between">
                <span>Restore Summary:</span>
                <span className="font-mono text-cyan-400">
                  {restoreResult.successful_items} / {restoreResult.total_items} Succeeded
                </span>
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono">
                {restoreResult.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className={detail.includes('Failed') ? 'text-rose-400' : 'text-emerald-400'}
                  >
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Confirm Backup Restore"
        message={`Are you sure you want to restore backed up assets from "${restoreDir}" to device ${selectedDevice.serial}? This will reinstall APKs and restore media files.`}
        confirmLabel="Proceed with Restore"
        isDestructive={false}
        onConfirm={handleExecuteRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
};
