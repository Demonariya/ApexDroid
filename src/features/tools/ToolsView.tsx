import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Camera,
  Video,
  FileCode,
  FileText,
  RefreshCw,
  Download,
  Trash2,
  Search,
  ExternalLink,
  Play,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ipc } from '../../lib/ipc';

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
  const [logcatLines, setLogcatLines] = useState<string[]>([]);
  const [isLogcatStreaming, setIsLogcatStreaming] = useState(false);
  const [showLogcatModal, setShowLogcatModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedJson, setExportedJson] = useState('');
  const [isLoadingLogcat, setIsLoadingLogcat] = useState(false);

  const t = translations[language];

  // Fetch real logcat lines
  const fetchLogcat = async () => {
    if (!selectedDevice) return;
    setIsLoadingLogcat(true);
    try {
      const lines = await ipc.getLogcat(selectedDevice.serial, 300, logcatFilter || undefined);
      setLogcatLines(lines);
    } catch (err: any) {
      onNotify('error', 'Logcat Error', err.message || 'Failed to read device logcat buffer');
    } finally {
      setIsLoadingLogcat(false);
    }
  };

  // Live polling for logcat when streaming is toggled on
  useEffect(() => {
    let interval: any;
    if (isLogcatStreaming && selectedDevice) {
      fetchLogcat();
      interval = setInterval(() => {
        fetchLogcat();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLogcatStreaming, selectedDevice?.serial, logcatFilter]);

  const handleClearLogcat = async () => {
    if (!selectedDevice) return;
    try {
      await ipc.clearLogcat(selectedDevice.serial);
      setLogcatLines([]);
      onNotify('info', 'Logcat Cleared', 'Device circular logcat ring-buffer reset.');
    } catch (err: any) {
      onNotify('error', 'Clear Failed', err.message);
    }
  };

  const handleExportDeviceInfo = () => {
    if (!selectedDevice) return;
    const report = {
      generated_at: new Date().toISOString(),
      device_telemetry: {
        serial: selectedDevice.serial,
        name: selectedDevice.name,
        manufacturer: selectedDevice.manufacturer,
        model: selectedDevice.model,
        connection_type: selectedDevice.is_wireless ? 'Wireless ADB' : 'USB Cable',
        uptime_seconds: selectedDevice.uptime_seconds,
        battery: selectedDevice.battery || 'Telemetry unavailable via dumpsys battery',
        storage: selectedDevice.storage || 'Telemetry unavailable via df -k /data',
        display: selectedDevice.display || 'Telemetry unavailable via wm size/density',
        hardware: selectedDevice.hardware || 'Hardware SoC unavailable via getprop',
        software: selectedDevice.software || 'Software build unavailable',
      },
      audit_integrity: 'Genuine device query directly via ADB protocol',
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
    a.download = `ApexDroid_Audit_${selectedDevice?.model.replace(/\s+/g, '_') || 'Device'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'Report Downloaded', 'Audit report exported successfully.');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="border-b border-neutral-800/80 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">{t.suiteTools}</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Low-level system auditing, batch operations, framebuffer captures, and live logcat telemetry.
        </p>
      </div>

      {/* Grid of Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Tool 1: Framebuffer Screenshot */}
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
            onClick={() => {
              setShowLogcatModal(true);
              fetchLogcat();
            }}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Open Live Logcat Console
          </button>
        </div>

        {/* Tool 4: System Telemetry Audit Export */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Hardware & OS Audit Export</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Generate a verified diagnostic snapshot of the device's battery, storage, SoC, and security patch.
            </p>
          </div>
          <button
            onClick={handleExportDeviceInfo}
            disabled={!selectedDevice}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            Generate Diagnostic Audit
          </button>
        </div>

        {/* Tool 5: Restart ADB Daemon */}
        <div className="p-5 rounded-xl bg-[#0c1017] border border-neutral-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Restart ADB Daemon</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Kill running adb server instances on host port 5037 and reinitialize socket connections.
            </p>
          </div>
          <button
            onClick={onRestartAdb}
            className="mt-5 w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors"
          >
            Restart Daemon
          </button>
        </div>
      </div>

      {/* Logcat Modal */}
      {showLogcatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#0b0f17] border border-neutral-800 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Real Device Logcat ({selectedDevice?.model || 'Device'})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsLogcatStreaming((s) => !s)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isLogcatStreaming
                      ? 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                      : 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  {isLogcatStreaming ? (
                    <>
                      <Square className="w-3 h-3" />
                      <span>Pause Stream</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Stream Live</span>
                    </>
                  )}
                </button>
                <button
                  onClick={fetchLogcat}
                  disabled={isLoadingLogcat}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                  title="Refresh now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogcat ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleClearLogcat}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400"
                  title="Clear device logcat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowLogcatModal(false)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#080b10] border-b border-neutral-800 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Filter logcat by tag, PID, or message substring (e.g. ActivityManager, Error)..."
                value={logcatFilter}
                onChange={(e) => setLogcatFilter(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto bg-black text-neutral-300 leading-relaxed space-y-1 select-text">
              {logcatLines.length === 0 ? (
                <div className="text-neutral-500 text-center py-10">
                  {isLoadingLogcat ? 'Reading device logcat stream...' : 'No logcat lines returned or buffer is empty.'}
                </div>
              ) : (
                logcatLines.map((line, idx) => {
                  const isErr = line.includes(' E ') || line.includes('Fatal');
                  const isWarn = line.includes(' W ');
                  return (
                    <div
                      key={idx}
                      className={isErr ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-neutral-300'}
                    >
                      {line}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#0b0f17] border border-neutral-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Device Telemetry Audit Report</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Diagnostic JSON payload collected from the connected Android device.
            </p>
            <textarea
              readOnly
              value={exportedJson}
              className="w-full h-64 bg-black border border-neutral-800 rounded-lg p-3 font-mono text-xs text-neutral-300 focus:outline-none mb-4 select-text"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
