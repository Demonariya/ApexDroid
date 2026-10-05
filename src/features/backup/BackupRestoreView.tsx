import React, { useState, useEffect } from 'react';
import {
  Archive,
  CheckCircle2,
  HardDrive,
  Boxes,
  Image,
  FolderTree,
  Play,
  XCircle,
  RotateCcw,
  Download,
  Upload,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

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
  const [includeApps, setIncludeApps] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [destPath, setDestPath] = useState('C:\\Backups\\ApexDroid\\GalaxyS24_202410');

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const t = translations[language];

  const estimatedSize =
    (includeApps ? 3.4 : 0) + (includeMedia ? 18.2 : 0) + (includeSettings ? 0.4 : 0);

  const startBackup = () => {
    if (!selectedDevice) return;
    setIsBackingUp(true);
    setProgress(0);
    setIsCompleted(false);
    onNotify('info', 'Backup Started', `Archiving to ${destPath}`);

    const files = [
      'Scanning device partitions and manifests...',
      'Dumping user APKs: com.whatsapp (base.apk)',
      'Dumping user APKs: org.telegram.messenger (base.apk)',
      'Dumping user APKs: com.spotify.music (base.apk)',
      'Pulling /sdcard/DCIM/Camera (1.2 GB photos)...',
      'Pulling /sdcard/Documents and PDF records...',
      'Compressing tarball archive: device_backup_2024.tar.gz...',
      'Verifying SHA-256 integrity hash...',
      'Backup complete!',
    ];

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProgress(Math.min(Math.round((step / files.length) * 100), 100));
      setCurrentFile(files[Math.min(step, files.length - 1)]);

      if (step >= files.length) {
        clearInterval(interval);
        setIsBackingUp(false);
        setIsCompleted(true);
        onNotify('success', 'Backup Complete', `Successfully created ${estimatedSize.toFixed(1)} GB backup.`);
      }
    }, 800);
  };

  const cancelBackup = () => {
    setIsBackingUp(false);
    setProgress(0);
    onNotify('warning', 'Backup Cancelled', 'Backup process halted by user.');
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
      <div className="border-b border-neutral-800/80 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">{t.backupWizard}</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Perform complete, zero-cloud offline image backups of device partitions, applications, and user storage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Selection & Progress */}
        <div className="md:col-span-2 space-y-5">
          <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {t.backupSelectItems}
            </h2>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1422] border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{t.backupApps}</div>
                    <div className="text-[11px] text-neutral-500">
                      All sideloaded and Play Store packages + split APKs
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 font-mono">~3.4 GB</span>
                  <input
                    type="checkbox"
                    checked={includeApps}
                    disabled={isBackingUp}
                    onChange={(e) => setIncludeApps(e.target.checked)}
                    className="accent-cyan-500"
                  />
                </div>
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1422] border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{t.backupMedia}</div>
                    <div className="text-[11px] text-neutral-500">
                      DCIM camera rolls, Downloads, WhatsApp Media, Documents
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 font-mono">~18.2 GB</span>
                  <input
                    type="checkbox"
                    checked={includeMedia}
                    disabled={isBackingUp}
                    onChange={(e) => setIncludeMedia(e.target.checked)}
                    className="accent-cyan-500"
                  />
                </div>
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1422] border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{t.backupSettings}</div>
                    <div className="text-[11px] text-neutral-500">
                      Wi-Fi keys, paired Bluetooth nodes, app permissions
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 font-mono">~400 MB</span>
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    disabled={isBackingUp}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="accent-cyan-500"
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Destination Path */}
          <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {t.destinationFolder}
            </label>
            <input
              type="text"
              value={destPath}
              disabled={isBackingUp}
              onChange={(e) => setDestPath(e.target.value)}
              className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Active Backup Progress Bar */}
          {isBackingUp && (
            <div className="p-5 rounded-xl bg-[#0d1424] border border-cyan-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Backing up data from {selectedDevice.model}...
                </span>
                <span className="font-mono text-cyan-300 tabular-nums">{progress}%</span>
              </div>

              <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span className="truncate max-w-sm">{currentFile}</span>
                <span className="text-cyan-400">42.5 MB/s</span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={cancelBackup}
                  className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-rose-300"
                >
                  Cancel Backup
                </button>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Backup saved safely to destination directory.</span>
              </div>
              <button
                onClick={() => setIsCompleted(false)}
                className="text-neutral-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Right Col: Summary & Trigger */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 flex flex-col justify-between h-fit space-y-5">
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Backup Summary
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Target Device</span>
                <span className="text-white font-medium truncate max-w-[140px]">{selectedDevice.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Serial</span>
                <span className="text-white font-mono text-[11px]">{selectedDevice.serial}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Est. Data Size</span>
                <span className="text-cyan-400 font-mono font-bold tabular-nums">
                  {estimatedSize.toFixed(1)} GB
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Compression</span>
                <span className="text-white font-mono text-[11px]">gzip (level 6)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Encryption</span>
                <span className="text-white">AES-256 GCM</span>
              </div>
            </div>
          </div>

          <button
            onClick={startBackup}
            disabled={isBackingUp || estimatedSize === 0}
            className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-sm shadow-cyan-950 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isBackingUp ? 'Backing Up...' : t.startBackup}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
