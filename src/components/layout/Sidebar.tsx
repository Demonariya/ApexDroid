import React from 'react';
import {
  LayoutDashboard,
  Smartphone,
  FolderTree,
  Boxes,
  Cast,
  Terminal,
  FileText,
  Wrench,
  Settings,
  ChevronDown,
  Wifi,
  Usb,
  Cpu,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { ActiveTab, DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  devices: DeviceDetails[];
  selectedDevice: DeviceDetails | null;
  onSelectDevice: (device: DeviceDetails) => void;
  language: Language;
  onRefreshDevices: () => void;
  isRefreshing: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  devices,
  selectedDevice,
  onSelectDevice,
  language,
  onRefreshDevices,
  isRefreshing,
}) => {
  const t = translations[language];

  const navItems: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'devices', label: t.devices, icon: Smartphone },
    { id: 'files', label: t.files, icon: FolderTree },
    { id: 'apps', label: t.apps, icon: Boxes },
    { id: 'mirror', label: t.mirror, icon: Cast },
    { id: 'terminal', label: t.terminal, icon: Terminal },
    { id: 'tools', label: t.tools, icon: Wrench },
    { id: 'backup', label: t.backup, icon: Archive },
    { id: 'logs', label: t.logs, icon: FileText },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0a0d14] border-r border-neutral-800/80 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/40">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white">{t.appName}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-mono">
                v1.0
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 truncate">{t.tagline}</div>
          </div>
        </div>
      </div>

      {/* Device Selector Card */}
      <div className="p-3 border-b border-neutral-800/60 bg-[#0e121c]/60">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5 px-1">
          <span>Active Device</span>
          <button
            onClick={onRefreshDevices}
            disabled={isRefreshing}
            className="text-neutral-400 hover:text-cyan-400 p-0.5 rounded transition-colors disabled:opacity-50"
            title="Scan ADB Devices"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="p-2.5 rounded-lg border border-neutral-800/80 bg-[#131826]/40 text-center">
            <div className="text-xs text-neutral-400">No device detected</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Plug in USB or connect Wi-Fi</div>
          </div>
        ) : (
          <div className="relative group">
            <div className="p-2 rounded-lg border border-neutral-800/90 bg-[#121724] hover:border-cyan-500/30 transition-all flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-950/60 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-neutral-200 truncate">
                    {selectedDevice?.marketing_name || selectedDevice?.name || 'Select device'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                    {selectedDevice?.is_wireless ? (
                      <span className="flex items-center gap-0.5 text-cyan-400">
                        <Wifi className="w-2.5 h-2.5" /> Wi-Fi
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <Usb className="w-2.5 h-2.5" /> USB
                      </span>
                    )}
                    <span>·</span>
                    <span className="font-mono text-neutral-400">{selectedDevice?.serial}</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0 ml-1" />
            </div>

            {/* Dropdown if multiple devices */}
            {devices.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#101522] border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-20 hidden group-hover:block divide-y divide-neutral-800/60">
                {devices.map((d) => (
                  <button
                    key={d.serial}
                    onClick={() => onSelectDevice(d)}
                    className={`w-full p-2 text-left flex items-center justify-between text-xs hover:bg-neutral-800/60 transition-colors ${
                      d.serial === selectedDevice?.serial ? 'bg-cyan-500/10 text-cyan-300' : 'text-neutral-300'
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="text-[10px] text-neutral-500 font-mono ml-2">{d.serial}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-neutral-500'}`} />
              <span className="truncate">{item.label}</span>
              {item.id === 'devices' && devices.length > 0 && (
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
                  {devices.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-neutral-800/70 bg-[#090b10] text-[11px] text-neutral-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="font-mono text-[10px]">ADB 1.0.41 (5037)</span>
        </div>
        <span className="text-[10px] text-neutral-400 font-mono">Tauri v2 · x64</span>
      </div>
    </aside>
  );
};
