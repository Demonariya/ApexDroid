import React from 'react';
import {
  Smartphone,
  BatteryCharging,
  HardDrive,
  Cpu,
  Cast,
  FolderTree,
  Boxes,
  Camera,
  RotateCw,
  RefreshCw,
  Wifi,
  Usb,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { ActiveTab, DeviceDetails, LogMessage } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface DashboardViewProps {
  devices: DeviceDetails[];
  selectedDevice: DeviceDetails | null;
  onSelectDevice: (device: DeviceDetails) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  language: Language;
  onTakeScreenshot: () => void;
  onRebootDevice: () => void;
  onRestartAdb: () => void;
  onRefreshDevices?: () => void;
  logs?: LogMessage[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  setActiveTab,
  onNavigateTab,
  language,
  onTakeScreenshot,
  onRebootDevice,
  onRestartAdb,
  onRefreshDevices,
  logs = [],
}) => {
  const navigate = onNavigateTab || setActiveTab || (() => {});
  const t = translations[language];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usbCount = devices.filter((d) => !d.is_wireless).length;
  const wifiCount = devices.filter((d) => d.is_wireless).length;

  const osDistribution = React.useMemo(() => {
    if (devices.length === 0) return [];
    const map: Record<string, number> = {};
    for (const d of devices) {
      const ver = d.software?.android_version ? `Android ${d.software.android_version}` : 'Unknown OS';
      map[ver] = (map[ver] || 0) + 1;
    }
    const colors = ['bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];
    return Object.entries(map).map(([version, count], idx) => ({
      version,
      count,
      percent: Math.round((count / devices.length) * 100),
      color: colors[idx % colors.length],
    }));
  }, [devices]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header section with clean editorial hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.overview}</h1>
          <p className="text-xs text-neutral-400 mt-1">{t.overviewDesc}</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tabular-nums font-semibold">{devices.length}</span> Active Units
          </span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span>{usbCount} USB</span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span>{wifiCount} Wi-Fi</span>
        </div>
      </div>

      {/* Top 4 Telemetry Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Devices */}
        <div className="p-4 rounded-xl bg-[#0d111a] border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t.totalConnected}</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tabular-nums">{devices.length}</div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-2">
              <span className="text-cyan-400">{usbCount} direct cable</span>
              <span>·</span>
              <span className="text-blue-400">{wifiCount} wireless</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Battery */}
        <div className="p-4 rounded-xl bg-[#0d111a] border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t.batteryAverage}</span>
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tabular-nums">
              {selectedDevice?.battery?.level ? `${selectedDevice.battery.level}%` : 'N/A'}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 truncate">
              {selectedDevice?.battery?.status || 'No device telemetry'}
              {selectedDevice?.battery?.temperature_celsius && (
                <span className="ml-1 text-neutral-400 tabular-nums">
                  · {selectedDevice.battery.temperature_celsius}°C
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 3: Storage */}
        <div className="p-4 rounded-xl bg-[#0d111a] border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t.storageUsed}</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tabular-nums">
              {selectedDevice?.storage
                ? `${selectedDevice.storage.internal_percent_used.toFixed(0)}%`
                : 'N/A'}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center justify-between">
              <span>
                {selectedDevice?.storage
                  ? `${formatBytes(selectedDevice.storage.internal_used_bytes)} used`
                  : 'Storage inactive'}
              </span>
              {selectedDevice?.storage && (
                <span className="text-neutral-400 tabular-nums">
                  {formatBytes(selectedDevice.storage.internal_free_bytes)} free
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 4: Hardware & SoC */}
        <div className="p-4 rounded-xl bg-[#0d111a] border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t.cpuArch}</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-white truncate">
              {selectedDevice?.hardware?.soc_model || (selectedDevice ? 'SoC Unknown' : 'N/A')}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1.5 truncate">
              <span className="text-indigo-300 font-mono text-[10px]">
                {selectedDevice?.hardware?.cpu_architecture || (selectedDevice ? 'Arch Unknown' : 'N/A')}
              </span>
              <span>·</span>
              <span className="text-neutral-400 tabular-nums">
                {selectedDevice?.hardware?.ram_total_mb
                  ? `${(selectedDevice.hardware.ram_total_mb / 1024).toFixed(1)} GB RAM`
                  : (selectedDevice ? 'RAM Info N/A' : 'N/A')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Operations */}
      <div className="rounded-xl bg-[#0c1017] border border-neutral-800/80 p-5">
        <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-4">
          {t.quickActions}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => navigate('mirror')}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-cyan-500/40 hover:bg-[#161e30] transition-all group"
          >
            <Cast className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionMirror}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Scrcpy v2.3</span>
          </button>

          <button
            onClick={() => navigate('files')}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-cyan-500/40 hover:bg-[#161e30] transition-all group"
          >
            <FolderTree className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionBrowseFiles}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">/sdcard tree</span>
          </button>

          <button
            onClick={() => navigate('apps')}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-cyan-500/40 hover:bg-[#161e30] transition-all group"
          >
            <Boxes className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionInstallApk}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Package Mgr</span>
          </button>

          <button
            onClick={onTakeScreenshot}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-cyan-500/40 hover:bg-[#161e30] transition-all group"
          >
            <Camera className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionTakeScreenshot}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Direct PNG</span>
          </button>

          <button
            onClick={onRebootDevice}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-amber-500/40 hover:bg-[#161e30] transition-all group"
          >
            <RotateCw className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionRebootDevice}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Soft Reboot</span>
          </button>

          <button
            onClick={onRestartAdb}
            className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#111724] border border-neutral-800 hover:border-rose-500/40 hover:bg-[#161e30] transition-all group"
          >
            <RefreshCw className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-medium text-neutral-200">{t.actionRestartAdb}</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Port 5037</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Connected Devices Cards & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Connected Device Fleet */}
        <div className="lg:col-span-2 rounded-xl bg-[#0c1017] border border-neutral-800/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                {t.deviceList}
              </h2>
              <button
                onClick={() => navigate('devices')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>View Full Fleet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {devices.map((dev) => {
                const isSelected = dev.serial === selectedDevice?.serial;
                return (
                  <div
                    key={dev.serial}
                    onClick={() => onSelectDevice(dev)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#131a29] border-cyan-500/40 shadow-sm shadow-cyan-950/20'
                        : 'bg-[#10141f] border-neutral-800/80 hover:border-neutral-700 hover:bg-[#121724]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-neutral-800/80 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {dev.marketing_name || dev.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {dev.manufacturer} {dev.model}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            {dev.is_wireless ? (
                              <span className="text-cyan-400 flex items-center gap-0.5">
                                <Wifi className="w-2.5 h-2.5" /> Wi-Fi
                              </span>
                            ) : (
                              <span className="text-blue-400 flex items-center gap-0.5">
                                <Usb className="w-2.5 h-2.5" /> USB
                              </span>
                            )}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-neutral-400">{dev.serial}</span>
                          <span aria-hidden="true">·</span>
                          <span>Android {dev.software?.android_version}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-neutral-300 shrink-0">
                      <div className="text-right">
                        <div className="text-neutral-200 tabular-nums">
                          {dev.battery?.level ? `${dev.battery.level}%` : 'N/A'}
                        </div>
                        <div className="text-[10px] text-neutral-400">Battery</div>
                      </div>
                      <div className="text-right">
                        <div className="text-neutral-200 tabular-nums">
                          {dev.display ? `${dev.display.width}x${dev.display.height}` : 'N/A'}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {dev.display?.refresh_rate ? `${dev.display.refresh_rate.toFixed(0)}Hz` : dev.display?.density_dpi ? `${dev.display.density_dpi} dpi` : 'Display'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OS Distribution Bar */}
          <div className="mt-6 pt-4 border-t border-neutral-800/80">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
              <span>{t.androidDistribution}</span>
              <span className="font-mono text-[11px] text-neutral-400">
                {devices.length === 0 ? 'No active devices' : `${devices.length} verified unit${devices.length > 1 ? 's' : ''}`}
              </span>
            </div>
            {osDistribution.length === 0 ? (
              <div className="text-[11px] text-neutral-500 py-1">Connect devices to inspect Android version distribution.</div>
            ) : (
              <>
                <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden flex">
                  {osDistribution.map((item) => (
                    <div
                      key={item.version}
                      className={`${item.color} h-full`}
                      style={{ width: `${item.percent}%` }}
                      title={`${item.version} (${item.percent}%)`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-400 mt-2">
                  {osDistribution.map((item) => (
                    <span key={item.version} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      {item.version} ({item.count} unit{item.count > 1 ? 's' : ''} - {item.percent}%)
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Col: Structured Tracing Logs */}
        <div className="rounded-xl bg-[#0c1017] border border-neutral-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {t.recentActivity}
            </h2>
            <button
              onClick={() => navigate('logs')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              <span>{t.logs}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-80 font-mono text-[11px]">
            {logs.slice(0, 7).map((log) => {
              const getLevelColor = () => {
                switch (log.level) {
                  case 'ERROR':
                    return 'text-rose-400';
                  case 'WARN':
                    return 'text-amber-400';
                  case 'DEBUG':
                    return 'text-indigo-400';
                  default:
                    return 'text-cyan-400';
                }
              };

              return (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[#0f1422] border border-neutral-800/60 leading-relaxed"
                >
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span className="tabular-nums">{log.timestamp}</span>
                    <span className={`font-semibold ${getLevelColor()}`}>{log.level}</span>
                  </div>
                  <div className="text-neutral-300 mt-1 break-words">{log.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
