import React from 'react';
import {
  Search,
  Camera,
  RefreshCw,
  Wifi,
  Languages,
  Minus,
  Square,
  X,
  Smartphone,
  RotateCw,
} from 'lucide-react';
import { ActiveTab, DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface TopBarProps {
  activeTab: ActiveTab;
  selectedDevice: DeviceDetails | null;
  onOpenCommandPalette: () => void;
  language: Language;
  onToggleLanguage: () => void;
  onRestartAdb: () => void;
  onTakeScreenshot: () => void;
  onRebootDevice: () => void;
  onOpenWirelessModal: () => void;
  isRestartingAdb: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  selectedDevice,
  onOpenCommandPalette,
  language,
  onToggleLanguage,
  onRestartAdb,
  onTakeScreenshot,
  onRebootDevice,
  onOpenWirelessModal,
  isRestartingAdb,
}) => {
  const t = translations[language];

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return t.dashboard;
      case 'devices':
        return t.devices;
      case 'files':
        return t.files;
      case 'apps':
        return t.apps;
      case 'mirror':
        return t.mirror;
      case 'terminal':
        return t.terminal;
      case 'tools':
        return t.tools;
      case 'backup':
        return t.backup;
      case 'logs':
        return t.logs;
      case 'settings':
        return t.settings;
      default:
        return 'Overview';
    }
  };

  return (
    <header className="h-12 bg-[#090b10] border-b border-neutral-800/80 px-4 flex items-center justify-between select-none">
      {/* Zone 1: Contextual Title & Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
          {getBreadcrumbTitle()}
        </span>
        {selectedDevice && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 min-w-0">
            <span aria-hidden="true" className="text-neutral-600">/</span>
            <div className="flex items-center gap-1.5 truncate">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-neutral-300 font-medium truncate">
                {selectedDevice.marketing_name || selectedDevice.name}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">({selectedDevice.serial})</span>
            </div>
          </div>
        )}
      </div>

      {/* Zone 2: Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-6">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0e131f] border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-400 transition-colors shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] truncate">{t.searchPlaceholder}</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800/80 text-neutral-400 rounded border border-neutral-700/60">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Quick Action Buttons & Window Controls */}
      <div className="flex items-center gap-1.5">
        {selectedDevice && (
          <>
            <button
              onClick={onTakeScreenshot}
              className="p-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 hover:text-cyan-300 transition-colors"
              title={t.screenshot}
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              onClick={onRebootDevice}
              className="p-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 hover:text-amber-300 transition-colors"
              title={t.reboot}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          onClick={onOpenWirelessModal}
          className="p-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 hover:text-cyan-300 transition-colors"
          title={t.wirelessConnect}
        >
          <Wifi className="w-4 h-4" />
        </button>

        <button
          onClick={onRestartAdb}
          disabled={isRestartingAdb}
          className="p-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
          title={t.restartAdb}
        >
          <RefreshCw className={`w-4 h-4 ${isRestartingAdb ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Language switch button */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-800/60 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
          title="Toggle English / فارسی"
        >
          <Languages className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">{language === 'en' ? 'FA' : 'EN'}</span>
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Windows Frameless Controls */}
        <div className="flex items-center gap-1 text-neutral-400">
          <button
            className="p-1.5 hover:bg-neutral-800/80 hover:text-neutral-200 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            className="p-1.5 hover:bg-neutral-800/80 hover:text-neutral-200 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            className="p-1.5 hover:bg-rose-600/80 hover:text-white rounded transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
