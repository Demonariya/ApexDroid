import React, { useState } from 'react';
import {
  Smartphone,
  X,
  Cpu,
  Layers,
  HardDrive,
  Battery,
  ShieldCheck,
  ShieldAlert,
  RotateCw,
  Power,
  RefreshCw,
  Terminal,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface DeviceDetailModalProps {
  device: DeviceDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onReboot: (serial: string, mode?: string) => Promise<void>;
  language: Language;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  isOpen,
  onClose,
  onReboot,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'hardware' | 'software' | 'storage' | 'battery'>('overview');
  const [isRebooting, setIsRebooting] = useState(false);
  const t = translations[language];

  if (!isOpen || !device) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleRebootAction = async (mode?: string) => {
    setIsRebooting(true);
    try {
      await onReboot(device.serial, mode);
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0f1422] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800/80 bg-[#0d111d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">{device.marketing_name || device.name}</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {device.state}
                </span>
                {device.software?.is_rooted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono flex items-center gap-1">
                    <ShieldAlert className="w-2.5 h-2.5" /> ROOT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 font-mono">
                <span>{device.manufacturer}</span>
                <span>·</span>
                <span>Model: {device.model}</span>
                <span>·</span>
                <span>Serial: {device.serial}</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation bar */}
        <div className="flex items-center gap-1 px-5 border-b border-neutral-800 bg-[#0b0e17] text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.tabOverview}
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'hardware'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.tabHardware}
          </button>
          <button
            onClick={() => setActiveTab('software')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'software'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.tabSoftware}
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'storage'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.tabStorage}
          </button>
          <button
            onClick={() => setActiveTab('battery')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'battery'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.tabBattery}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-neutral-800">
                <div className="text-neutral-400 text-[11px] mb-1">Android OS Version</div>
                <div className="text-white font-medium text-sm">{device.software?.android_version || 'Unknown'}</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  {device.software?.api_level ? `API Level ${device.software.api_level}` : 'API Level Unavailable'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-neutral-800">
                <div className="text-neutral-400 text-[11px] mb-1">Display & Resolution</div>
                <div className="text-white font-medium text-sm">
                  {device.display ? `${device.display.width} × ${device.display.height}` : 'Unavailable'}
                </div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  {device.display ? `${device.display.density_dpi} DPI · ${device.display.refresh_rate ? `${device.display.refresh_rate} Hz` : 'Standard'}` : 'N/A'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-neutral-800">
                <div className="text-neutral-400 text-[11px] mb-1">Processor (SoC)</div>
                <div className="text-white font-medium text-sm truncate">
                  {device.hardware?.soc_model || 'Unknown SoC'}
                </div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  {device.hardware?.cpu_architecture || 'Unknown Arch'} · {device.hardware?.cpu_cores ? `${device.hardware.cpu_cores} Cores` : 'Cores Unknown'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-neutral-800">
                <div className="text-neutral-400 text-[11px] mb-1">Primary Storage Allocation</div>
                <div className="text-white font-medium text-sm">
                  {device.storage ? `${device.storage.internal_percent_used.toFixed(0)}% Utilized` : 'N/A'}
                </div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  {device.storage && formatBytes(device.storage.internal_free_bytes)} Available
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-[#0b0f19] border border-neutral-800 space-y-2.5">
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">SoC Architecture</span>
                  <span className="text-white font-mono">{device.hardware?.cpu_architecture}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">CPU Cores</span>
                  <span className="text-white">{device.hardware?.cpu_cores ? `${device.hardware.cpu_cores} Active Processors` : 'Unavailable'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Total System RAM</span>
                  <span className="text-white tabular-nums">
                    {device.hardware?.ram_total_mb ? `${(device.hardware.ram_total_mb / 1024).toFixed(0)} GB` : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Available Free RAM</span>
                  <span className="text-white tabular-nums">
                    {device.hardware?.ram_avail_mb ? `${(device.hardware.ram_avail_mb / 1024).toFixed(1)} GB` : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">GPU Graphics Renderer</span>
                  <span className="text-white font-mono">{device.hardware?.gpu_renderer}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'software' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-[#0b0f19] border border-neutral-800 space-y-2.5">
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Android Release</span>
                  <span className="text-white font-medium">{device.software?.android_version}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Build Number (Fingerprint)</span>
                  <span className="text-white font-mono text-[11px] truncate max-w-xs">{device.software?.build_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Android Security Patch</span>
                  <span className="text-white font-mono">{device.software?.security_patch}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Kernel Version</span>
                  <span className="text-white font-mono text-[11px] truncate max-w-xs">{device.software?.kernel_version}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Root State</span>
                  <span className="text-white">
                    {device.software?.is_rooted ? (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">Rooted (su active)</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">Unrooted (Enforcing SE-Linux)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-lg bg-[#0b0f19] border border-neutral-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Internal Storage Partition (/data)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {device.storage?.internal_percent_used.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-cyan-500 h-full rounded-full"
                    style={{ width: `${device.storage?.internal_percent_used || 40}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-neutral-400 mt-2">
                  <span>Used: {device.storage && formatBytes(device.storage.internal_used_bytes)}</span>
                  <span>Free: {device.storage && formatBytes(device.storage.internal_free_bytes)}</span>
                  <span>Total: {device.storage && formatBytes(device.storage.internal_total_bytes)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'battery' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-[#0b0f19] border border-neutral-800 space-y-2.5">
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Current Battery Level</span>
                  <span className="text-white font-bold text-sm tabular-nums">{device.battery?.level}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Power Supply & Status</span>
                  <span className="text-white">{device.battery?.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Battery Health</span>
                  <span className="text-emerald-400 font-medium">{device.battery?.health}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">Internal Cell Temperature</span>
                  <span className="text-white tabular-nums">{device.battery?.temperature_celsius}°C</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Terminal Voltage</span>
                  <span className="text-white tabular-nums">{device.battery?.voltage_mv} mV</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Reboot Operations Section */}
          <div className="pt-2 border-t border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
              Power & Bootloader Actions
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleRebootAction()}
                disabled={isRebooting}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-amber-500/40 hover:bg-[#161f30] text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 text-amber-400 ${isRebooting ? 'animate-spin' : ''}`} />
                <span>{t.rebootSystem}</span>
              </button>

              <button
                onClick={() => handleRebootAction('recovery')}
                disabled={isRebooting}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-cyan-500/40 hover:bg-[#161f30] text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.rebootRecovery}</span>
              </button>

              <button
                onClick={() => handleRebootAction('bootloader')}
                disabled={isRebooting}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-rose-500/40 hover:bg-[#161f30] text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5 text-rose-400" />
                <span>{t.rebootBootloader}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
