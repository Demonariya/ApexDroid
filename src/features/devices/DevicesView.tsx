import React, { useState } from 'react';
import {
  Smartphone,
  Wifi,
  Usb,
  Battery,
  BatteryCharging,
  HardDrive,
  Cpu,
  RotateCw,
  Plus,
  RefreshCw,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { DeviceDetailModal } from './DeviceDetailModal';
import { WirelessConnectModal } from './WirelessConnectModal';

interface DevicesViewProps {
  devices: DeviceDetails[];
  selectedDevice: DeviceDetails | null;
  onSelectDevice: (device: DeviceDetails) => void;
  language: Language;
  onRefresh: () => void;
  isRefreshing: boolean;
  onConnectWireless: (hostPort: string) => Promise<void>;
  onPairWireless: (hostPort: string, code: string) => Promise<void>;
  onRebootDevice: (serial: string, mode?: string) => Promise<void>;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  language,
  onRefresh,
  isRefreshing,
  onConnectWireless,
  onPairWireless,
  onRebootDevice,
}) => {
  const [inspectDevice, setInspectDevice] = useState<DeviceDetails | null>(null);
  const [showWirelessModal, setShowWirelessModal] = useState(false);
  const t = translations[language];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.deviceList}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time ADB daemon link over USB high-speed bus and Wi-Fi debugging channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWirelessModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.connectWirelessModal}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t.refreshDevices}</span>
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-[#0c1017] border border-neutral-800/80">
          <Smartphone className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300">No Android devices detected</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
            Ensure USB debugging is turned on in Developer Options on your device, or connect over Wi-Fi.
          </p>
          <button
            onClick={() => setShowWirelessModal(true)}
            className="mt-4 px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-950 inline-flex items-center gap-2"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Connect over Wi-Fi</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {devices.map((dev) => {
            const isSelected = dev.serial === selectedDevice?.serial;
            return (
              <div
                key={dev.serial}
                className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'bg-[#0f1422] border-cyan-500/40 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/20'
                    : 'bg-[#0c1017] border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Card Top */}
                <div className="p-5 border-b border-neutral-800/60 bg-[#0a0e17]/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{dev.marketing_name || dev.name}</h3>
                          {dev.is_wireless ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 font-mono flex items-center gap-1">
                              <Wifi className="w-2.5 h-2.5" /> Wi-Fi
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/40 font-mono flex items-center gap-1">
                              <Usb className="w-2.5 h-2.5" /> USB
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400 font-mono mt-0.5">
                          {dev.manufacturer} {dev.model} · {dev.serial}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-emerald-400 font-medium">Online</span>
                    </div>
                  </div>
                </div>

                {/* Card Telemetry Stats */}
                <div className="p-5 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-neutral-500 text-[11px] mb-1">Android OS</div>
                    <div className="text-white font-medium">
                      Android {dev.software?.android_version}
                    </div>
                    <div className="text-neutral-500 text-[10px] font-mono mt-0.5">
                      API Level {dev.software?.api_level}
                    </div>
                  </div>

                  <div>
                    <div className="text-neutral-500 text-[11px] mb-1">Display & Density</div>
                    <div className="text-white font-medium">
                      {dev.display ? `${dev.display.width} × ${dev.display.height}` : 'N/A'}
                    </div>
                    <div className="text-neutral-500 text-[10px] font-mono mt-0.5">
                      {dev.display?.density_dpi} DPI · {dev.display?.refresh_rate || 120}Hz
                    </div>
                  </div>

                  <div>
                    <div className="text-neutral-500 text-[11px] mb-1">Battery Cell</div>
                    <div className="flex items-center gap-1.5 text-white font-medium">
                      {dev.battery?.is_charging ? (
                        <BatteryCharging className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Battery className="w-4 h-4 text-cyan-400" />
                      )}
                      <span className="tabular-nums">{dev.battery?.level}%</span>
                    </div>
                    <div className="text-neutral-500 text-[10px] mt-0.5">
                      {dev.battery?.status} ({dev.battery?.temperature_celsius}°C)
                    </div>
                  </div>

                  <div>
                    <div className="text-neutral-500 text-[11px] mb-1">Storage Allocation</div>
                    <div className="text-white font-medium tabular-nums">
                      {dev.storage ? `${dev.storage.internal_percent_used.toFixed(0)}%` : 'N/A'}
                    </div>
                    <div className="text-neutral-500 text-[10px] mt-0.5">
                      {dev.storage && formatBytes(dev.storage.internal_free_bytes)} free
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 border-t border-neutral-800/80 bg-[#090d15] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectDevice(dev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                    }`}
                  >
                    {isSelected ? 'Active Device' : 'Set as Active'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectDevice(dev)}
                      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                      title={t.viewDetails}
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onRebootDevice(dev.serial)}
                      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors"
                      title={t.reboot}
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <DeviceDetailModal
        device={inspectDevice}
        isOpen={!!inspectDevice}
        onClose={() => setInspectDevice(null)}
        onReboot={onRebootDevice}
        language={language}
      />

      <WirelessConnectModal
        isOpen={showWirelessModal}
        onClose={() => setShowWirelessModal(false)}
        onConnect={onConnectWireless}
        onPair={onPairWireless}
        language={language}
      />
    </div>
  );
};
