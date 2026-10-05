import React, { useState } from 'react';
import {
  Wrench,
  Camera,
  Video,
  Upload,
  Archive,
  FileCode,
  FileText,
  RefreshCw,
  Wifi,
  Download,
  CheckCircle2,
  Cpu,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface ToolsViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  onTakeScreenshot: () => void;
  onRestartAdb: () => void;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
  setActiveTab: (tab: any) => void;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  selectedDevice,
  language,
  onTakeScreenshot,
  onRestartAdb,
  onNotify,
  setActiveTab,
}) => {
  const [logcatFilter, setLogcatFilter] = useState('');
  const [showLogcatModal, setShowLogcatModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedJson, setExportedJson] = useState('');

  const t = translations[language];

  const handleExportDeviceInfo = () => {
    if (!selectedDevice) return;
    const report = {
      timestamp: new Date().toISOString(),
      device: selectedDevice,
      adb_version: '1.0.41 (rev 34.0.5)',
      host_os: 'Windows x64 / Rust Tokio Runtime',
    };
    const str = JSON.stringify(report, null, 2);
    setExportedJson(str);
    setShowExportModal(true);
  };

  const handleDownloadReport = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ApexDroid_Audit_${selectedDevice?.model || 'Device'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'Report Downloaded', 'Audit report exported successfully.');
  };

  const sampleLogcat = [
    '03-08 14:40:01.120  1450  1450 I ActivityManager: START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.whatsapp/.Main}',
    '03-08 14:40:01.240  1450  2100 D WindowManager: Relayout Window{41d2f00 u0 com.whatsapp/com.whatsapp.Main}: viewVisibility=0 req=1440x3120',
    '03-08 14:40:01.350  2450  2450 I Choreographer: Skipped 0 frames! Application rendering nominal.',
    '03-08 14:40:02.010  1200  1200 D PowerManagerService: userActivityNoUpdateLocked: eventTime=142800000, event=2, flags=0x0, uid=1000',
    '03-08 14:40:02.150  1000  1050 I BatteryStatsService: updating capacity: 88%',
    '03-08 14:40:02.400  1100  1120 D WifiService: handleScreenStateChanged: screenOn=true',
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="border-b border-neutral-800/80 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">{t.suiteTools}</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Low-level system auditing, batch operations, framebuffer captures, and logcat telemetry.
        </p>
      </div>

      {/* Grid of Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Tool 1: High-Res Screenshot */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-3">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Framebuffer Snapshot</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {t.toolScreenshotDesc}
            </p>
          </div>
          <button
            onClick={onTakeScreenshot}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Capture Screenshot
          </button>
        </div>

        {/* Tool 2: Screen Recording */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Screen Video Capture</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {t.toolScreenRecordDesc}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('mirror')}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Open Recorder in Mirror
          </button>
        </div>

        {/* Tool 3: Live Logcat Streamer */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Logcat Live Streamer</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {t.toolLogcatDesc}
            </p>
          </div>
          <button
            onClick={() => setShowLogcatModal(true)}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Launch Logcat Stream
          </button>
        </div>

        {/* Tool 4: Device Audit Export */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Device Audit & Specs</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {t.toolDeviceReportDesc}
            </p>
          </div>
          <button
            onClick={handleExportDeviceInfo}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Export Spec Audit
          </button>
        </div>

        {/* Tool 5: Backup & Restore */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3">
              <Archive className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Full Backup & Restore</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {t.toolBackupDesc}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('backup')}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Open Backup Wizard
          </button>
        </div>

        {/* Tool 6: Reset ADB Daemon */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Restart ADB Server</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Kills unresponsive background adb.exe processes and restarts the daemon on TCP port 5037.
            </p>
          </div>
          <button
            onClick={onRestartAdb}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Reset Daemon
          </button>
        </div>
      </div>

      {/* Logcat Modal */}
      {showLogcatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl bg-[#0a0d14] border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Live Android Logcat Buffer</h3>
              </div>
              <button onClick={() => setShowLogcatModal(false)} className="text-neutral-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="my-3 flex items-center gap-2 bg-[#06080d] border border-neutral-800 px-3 py-1.5 rounded-lg text-xs">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                value={logcatFilter}
                onChange={(e) => setLogcatFilter(e.target.value)}
                placeholder="Filter tag or message (e.g. ActivityManager, Battery)..."
                className="w-full bg-transparent text-white focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 p-3 rounded-lg bg-[#06080d] border border-neutral-800/80">
              {sampleLogcat
                .filter((l) => l.toLowerCase().includes(logcatFilter.toLowerCase()))
                .map((line, idx) => (
                  <div key={idx} className="text-neutral-300 leading-relaxed hover:text-cyan-300">
                    {line}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Audit Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#0f1422] border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Audit Report (JSON)</h3>
              <button onClick={() => setShowExportModal(false)} className="text-neutral-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto">
              <pre className="p-3 rounded-lg bg-[#090b10] border border-neutral-800 font-mono text-[11px] text-cyan-300 leading-relaxed overflow-x-auto">
                {exportedJson}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/40 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleDownloadReport}
                className="px-4 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
