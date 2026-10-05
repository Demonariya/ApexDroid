import React, { useState } from 'react';
import {
  Settings,
  Languages,
  Folder,
  Sliders,
  CheckCircle2,
  HardDrive,
  Keyboard,
  Shield,
  Cpu,
  Save,
} from 'lucide-react';
import { AppSettings } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface SettingsViewProps {
  settings: AppSettings;
  language: Language;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onToggleLanguage: () => void;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  language,
  onSaveSettings,
  onToggleLanguage,
  onNotify,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      onNotify('success', 'Settings Saved', 'Configuration updated in persistent store.');
    } catch (err: any) {
      onNotify('error', 'Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const shortcuts = [
    { key: 'Ctrl + K', desc: 'Open command palette and global search' },
    { key: 'Ctrl + R', desc: 'Refresh connected devices list' },
    { key: 'Ctrl + Shift + S', desc: 'Take high-resolution screenshot' },
    { key: 'Ctrl + Shift + M', desc: 'Launch / toggle Scrcpy screen mirror' },
    { key: 'Ctrl + `', desc: 'Focus embedded ADB shell input' },
    { key: 'Esc', desc: 'Close dialogs, modals, and palettes' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="border-b border-neutral-800/80 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">{t.settingsTitle}</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Customize binary paths, device scanning frequencies, localization, and security invariants.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Localization & Theme */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            <Languages className="w-4 h-4 text-cyan-400" />
            <span>Localization & Language</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 mb-1.5">{t.languageSelection}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (language !== 'en') onToggleLanguage();
                    setFormData({ ...formData, language: 'en' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#090b10] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  English (US)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (language !== 'fa') onToggleLanguage();
                    setFormData({ ...formData, language: 'fa' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                    language === 'fa'
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#090b10] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  فارسی (Persian RTL)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1.5">Theme Palette</label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="dark">Graphite Black (Default Modern)</option>
                <option value="cyber">Cyber Cyan High-Contrast</option>
                <option value="midnight">Midnight Deep Slate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Binary Executable Paths */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Core Tooling Executable Paths</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-neutral-400 mb-1">{t.adbPath}</label>
              <input
                type="text"
                value={formData.adb_path}
                onChange={(e) => setFormData({ ...formData, adb_path: e.target.value })}
                placeholder="adb or C:\Android\platform-tools\adb.exe"
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-neutral-500 mt-0.5 block">
                Leave as "adb" to search standard PATH environment variable.
              </span>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">{t.scrcpyPath}</label>
              <input
                type="text"
                value={formData.scrcpy_path}
                onChange={(e) => setFormData({ ...formData, scrcpy_path: e.target.value })}
                placeholder="scrcpy or C:\scrcpy\scrcpy.exe"
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">{t.downloadPath}</label>
              <input
                type="text"
                value={formData.default_download_path}
                onChange={(e) => setFormData({ ...formData, default_download_path: e.target.value })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Polling & Safety */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Safety & Background Monitoring</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-neutral-400 mb-1">{t.pollingRate}</label>
              <select
                value={formData.polling_interval_ms}
                onChange={(e) => setFormData({ ...formData, polling_interval_ms: Number(e.target.value) })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={1000}>1.0 second (Real-time rapid scan)</option>
                <option value={2500}>2.5 seconds (Recommended balanced)</option>
                <option value={5000}>5.0 seconds (Power saver)</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-3 rounded-lg bg-[#090b10] border border-neutral-800 cursor-pointer">
              <span className="text-neutral-300">{t.destructiveConfirm}</span>
              <input
                type="checkbox"
                checked={formData.confirm_destructive_actions}
                onChange={(e) => setFormData({ ...formData, confirm_destructive_actions: e.target.checked })}
                className="accent-cyan-500"
              />
            </label>
          </div>
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <span>Global Keyboard Shortcuts</span>
          </div>

          <div className="divide-y divide-neutral-800/50">
            {shortcuts.map((s) => (
              <div key={s.key} className="py-2 flex items-center justify-between">
                <span className="text-neutral-400">{s.desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px] text-neutral-300">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-sm shadow-cyan-950 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : t.saveSettings}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
