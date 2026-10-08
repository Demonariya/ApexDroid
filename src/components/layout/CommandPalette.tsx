import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Smartphone,
  FolderTree,
  Boxes,
  Cast,
  Terminal,
  Wrench,
  Archive,
  FileText,
  Settings,
  RefreshCw,
  Camera,
  RotateCw,
  Power,
  Languages,
  X,
} from 'lucide-react';
import { ActiveTab, DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedDevice: DeviceDetails | null;
  language: Language;
  onToggleLanguage: () => void;
  onRestartAdb: () => void;
  onTakeScreenshot: () => void;
  onRebootDevice: (mode?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  selectedDevice,
  language,
  onToggleLanguage,
  onRestartAdb,
  onTakeScreenshot,
  onRebootDevice,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = [
    {
      id: 'nav-dashboard',
      title: `${t.dashboard}`,
      subtitle: 'Navigate to Fleet & Metric Overview',
      icon: LayoutDashboard,
      action: () => {
        setActiveTab('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-devices',
      title: `${t.devices}`,
      subtitle: 'Manage USB and Wireless devices',
      icon: Smartphone,
      action: () => {
        setActiveTab('devices');
        onClose();
      },
    },
    {
      id: 'nav-files',
      title: `${t.files}`,
      subtitle: 'Explore internal storage /storage/emulated/0 filesystem',
      icon: FolderTree,
      action: () => {
        setActiveTab('files');
        onClose();
      },
    },
    {
      id: 'nav-apps',
      title: `${t.apps}`,
      subtitle: 'Inspect, install, and manage APK packages',
      icon: Boxes,
      action: () => {
        setActiveTab('apps');
        onClose();
      },
    },
    {
      id: 'nav-mirror',
      title: `${t.mirror}`,
      subtitle: 'Launch high-framerate Scrcpy screen mirror',
      icon: Cast,
      action: () => {
        setActiveTab('mirror');
        onClose();
      },
    },
    {
      id: 'nav-terminal',
      title: `${t.terminal}`,
      subtitle: 'Execute raw ADB shell commands on active unit',
      icon: Terminal,
      action: () => {
        setActiveTab('terminal');
        onClose();
      },
    },
    {
      id: 'nav-tools',
      title: `${t.tools}`,
      subtitle: 'Diagnostic utilities, logcat, backup wizards',
      icon: Wrench,
      action: () => {
        setActiveTab('tools');
        onClose();
      },
    },
    {
      id: 'nav-backup',
      title: `${t.backup}`,
      subtitle: 'Offline backup & restore manager',
      icon: Archive,
      action: () => {
        setActiveTab('backup');
        onClose();
      },
    },
    {
      id: 'nav-logs',
      title: `${t.logs}`,
      subtitle: 'View structured Rust tracing output',
      icon: FileText,
      action: () => {
        setActiveTab('logs');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: `${t.settings}`,
      subtitle: 'Configure ADB path, scrcpy, language & theme',
      icon: Settings,
      action: () => {
        setActiveTab('settings');
        onClose();
      },
    },
    {
      id: 'action-screenshot',
      title: 'Take Screenshot',
      subtitle: selectedDevice ? `Capture screen of ${selectedDevice.name}` : 'Requires connected device',
      icon: Camera,
      action: () => {
        onTakeScreenshot();
        onClose();
      },
    },
    {
      id: 'action-restart-adb',
      title: 'Restart ADB Server',
      subtitle: 'Kills and restarts local adb daemon on port 5037',
      icon: RefreshCw,
      action: () => {
        onRestartAdb();
        onClose();
      },
    },
    {
      id: 'action-reboot',
      title: 'Reboot Device',
      subtitle: selectedDevice ? `Send reboot signal to ${selectedDevice.name}` : 'Requires connected device',
      icon: RotateCw,
      action: () => {
        onRebootDevice();
        onClose();
      },
    },
    {
      id: 'action-reboot-bootloader',
      title: 'Reboot to Bootloader (Fastboot)',
      subtitle: 'Reboot device into fastboot/download mode',
      icon: Power,
      action: () => {
        onRebootDevice('bootloader');
        onClose();
      },
    },
    {
      id: 'action-toggle-lang',
      title: language === 'en' ? 'تغییر زبان به فارسی' : 'Switch Language to English',
      subtitle: 'Toggle interface localization and RTL support',
      icon: Languages,
      action: () => {
        onToggleLanguage();
        onClose();
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-[#0f1422] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="flex items-center px-4 border-b border-neutral-800/80 bg-[#0d121f]">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.searchPlaceholder}
            className="w-full bg-transparent px-3 py-3.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-300 px-1.5 py-0.5 rounded bg-neutral-800/60"
          >
            Esc
          </button>
        </div>

        <div className="overflow-y-auto p-2 divide-y divide-neutral-800/40">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No matching commands or actions found.
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredItems.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/20'
                        : 'text-neutral-300 hover:bg-neutral-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-neutral-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-100">{item.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate">{item.subtitle}</div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] text-cyan-400 font-mono">↵ Run</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
