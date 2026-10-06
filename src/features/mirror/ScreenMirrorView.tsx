import React, { useState, useEffect } from 'react';
import {
  Cast,
  Play,
  Square,
  Camera,
  Video,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
  Smartphone,
  ChevronLeft,
  Circle,
  Menu,
  Power,
  Volume1,
  Volume,
  Clock,
  Wifi,
  Battery,
  Sliders,
  Monitor,
} from 'lucide-react';
import { DeviceDetails, ScrcpyConfig } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ipc } from '../../lib/ipc';

interface ScreenMirrorViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  defaultDownloadPath: string;
  onStartScrcpy: (serial: string, config: ScrcpyConfig) => Promise<boolean>;
  onStopScrcpy: (serial: string) => Promise<boolean>;
  onTakeScreenshot: () => void;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const ScreenMirrorView: React.FC<ScreenMirrorViewProps> = ({
  selectedDevice,
  language,
  defaultDownloadPath,
  onStartScrcpy,
  onStopScrcpy,
  onTakeScreenshot,
  onNotify,
}) => {
  const [isMirroring, setIsMirroring] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [activeRecordingPath, setActiveRecordingPath] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'settings' | 'camera' | 'browser'>('home');
  const [isNativeMode, setIsNativeMode] = useState(false);

  // Scrcpy parameters
  const [config, setConfig] = useState<ScrcpyConfig>({
    max_size: 1080,
    bit_rate_mbps: 8,
    max_fps: 60,
    stay_awake: true,
    turn_screen_off: false,
    show_touches: true,
    audio: true,
    fullscreen: false,
  });

  const t = translations[language];

  useEffect(() => {
    setIsNativeMode(ipc.isNativeMode());

    if (selectedDevice) {
      ipc.isScrcpyRunning(selectedDevice.serial)
        .then((running) => setIsMirroring(running))
        .catch(() => {});
      ipc.isScrcpyRecording(selectedDevice.serial)
        .then((recording) => setIsRecording(recording))
        .catch(() => {});
    }
  }, [selectedDevice?.serial]);

  // Periodic poll to ensure UI remains synchronized with process lifecycle
  useEffect(() => {
    if (!selectedDevice) return;
    const interval = setInterval(() => {
      ipc.isScrcpyRunning(selectedDevice.serial)
        .then((running) => {
          setIsMirroring((prev) => {
            if (prev && !running) {
              onNotify('info', 'Scrcpy Exited', 'Mirroring window was closed.');
            }
            return running;
          });
        })
        .catch(() => {});

      ipc.isScrcpyRecording(selectedDevice.serial)
        .then((recording) => {
          setIsRecording((prev) => {
            if (prev && !recording) {
              setActiveRecordingPath(null);
            }
            return recording;
          });
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedDevice?.serial]);

  // Recording counter
  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const toggleMirroring = async () => {
    if (!selectedDevice) return;
    if (isMirroring) {
      try {
        await onStopScrcpy(selectedDevice.serial);
        setIsMirroring(false);
        onNotify('info', 'Scrcpy Stopped', 'Display mirror process terminated.');
      } catch (err: any) {
        onNotify('error', 'Stop Failed', err.message);
      }
    } else {
      try {
        await onStartScrcpy(selectedDevice.serial, config);
        setIsMirroring(true);
        if (isNativeMode) {
          onNotify('success', 'Scrcpy Process Started', `Launched Scrcpy window (${config.max_size}p @ ${config.max_fps}fps)`);
        } else {
          onNotify('success', 'Scrcpy Running', `Mirror active (${config.max_size}p @ ${config.max_fps}fps)`);
        }
      } catch (err: any) {
        onNotify('error', 'Scrcpy Launch Failed', err.message || 'Make sure scrcpy is installed in PATH');
      }
    }
  };

  const toggleRecording = async () => {
    if (!selectedDevice) return;

    if (isRecording) {
      try {
        await onStopScrcpy(selectedDevice.serial);
        setIsRecording(false);
        setIsMirroring(false);
        const savedPath = activeRecordingPath;
        setActiveRecordingPath(null);
        onNotify('success', 'Recording Finalized', `Recorded video (${recordSeconds}s) saved to ${savedPath || 'destination file'}`);
      } catch (err: any) {
        onNotify('error', 'Stop Recording Failed', err.message);
      }
    } else {
      const defaultFilename = `recording_${selectedDevice.model.replace(/\s+/g, '_')}_${Date.now()}.mp4`;
      const defaultTarget = `${defaultDownloadPath.replace(/[\\/]$/, '')}/${defaultFilename}`;

      const savePath = await ipc.pickSaveFile({
        title: 'Choose Video Recording Destination',
        defaultPath: defaultTarget,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }, { name: 'Matroska Video', extensions: ['mkv'] }],
      });

      if (!savePath) return;

      const recordingConfig: ScrcpyConfig = {
        ...config,
        record_path: savePath,
      };

      try {
        await onStartScrcpy(selectedDevice.serial, recordingConfig);
        setIsRecording(true);
        setIsMirroring(true);
        setActiveRecordingPath(savePath);
        onNotify('info', 'Recording Started', `Capturing display stream directly to ${savePath}...`);
      } catch (err: any) {
        onNotify('error', 'Recording Launch Failed', err.message || 'Failed to start video recording process');
      }
    }
  };

  const sendKeyEvent = async (keycode: string, label: string) => {
    if (!selectedDevice) return;
    try {
      await ipc.sendKeyEvent(selectedDevice.serial, keycode);
      onNotify('info', 'Key Event Sent', `Dispatched ${label} (${keycode})`);
    } catch (err: any) {
      onNotify('error', 'Key Event Failed', err.message);
    }
  };

  const handleNavClick = async (key: 'back' | 'home' | 'recents') => {
    if (key === 'home') {
      setCurrentScreen('home');
      await sendKeyEvent('KEYCODE_HOME', 'Home');
    } else if (key === 'back') {
      if (currentScreen !== 'home') setCurrentScreen('home');
      await sendKeyEvent('KEYCODE_BACK', 'Back');
    } else if (key === 'recents') {
      await sendKeyEvent('KEYCODE_APP_SWITCH', 'Recents Overview');
    }
  };

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <Cast className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-3rem)] max-w-7xl mx-auto flex flex-col overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-800/80 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.mirror}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Low-latency display streaming, hardware key input dispatch, and genuine Scrcpy video recording.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMirroring}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
              isMirroring
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950'
            }`}
          >
            {isMirroring ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>{t.stopMirroring}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{t.startMirroring}</span>
              </>
            )}
          </button>

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isRecording
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-[#0e1422] border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-rose-500" />
            <span>
              {isRecording ? `Recording (${recordSeconds}s)` : t.startRecording}
            </span>
          </button>

          <button
            onClick={onTakeScreenshot}
            className="p-1.5 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-400 transition-colors"
            title={t.takeScreenshot}
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main View Split: Virtual Phone Simulator & Stream Config */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-4 min-h-0 overflow-hidden">
        {/* Phone Frame Simulator Container */}
        <div className="flex-1 flex items-center justify-center bg-[#06080c] rounded-2xl border border-neutral-800/80 p-4 relative overflow-hidden">
          {/* Subtle Cyber Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #00f2fe 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Virtual Mobile Chassis */}
          <div className="relative w-[320px] h-[640px] bg-black rounded-[44px] border-[5px] border-neutral-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-cyan-500/20">
            {/* Camera Punchhole Notch */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-30 border border-neutral-900" />

            {/* Virtual Status Bar */}
            <div className="h-7 w-full flex items-center justify-between px-6 text-[10px] text-neutral-300 shrink-0 z-20 pt-1 font-mono">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-cyan-400" />
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            {/* Active Display Viewport */}
            <div className="flex-1 w-full bg-[#0d121f] relative flex flex-col justify-between overflow-hidden">
              {isMirroring ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center mb-3 shadow-lg shadow-cyan-950">
                    <Monitor className="w-7 h-7 text-cyan-400 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {isNativeMode ? 'Native Scrcpy Window Active' : 'Screen Mirror Stream Active'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed mb-4">
                    {isNativeMode
                      ? 'Scrcpy hardware accelerated window is running directly on Windows desktop for zero latency touch interaction.'
                      : `Streaming framebuffer at ${config.max_size}p resolution.`}
                  </p>
                  <div className="px-2.5 py-1 rounded bg-black/60 border border-neutral-800 text-[10px] font-mono text-cyan-300">
                    {config.max_fps} FPS · {config.bit_rate_mbps} Mbps
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <Cast className="w-10 h-10 text-neutral-700 mb-3" />
                  <p className="text-xs text-neutral-400 mb-4">{t.startMirroringPrompt}</p>
                  <button
                    onClick={toggleMirroring}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-sm transition-all"
                  >
                    {t.startMirroring}
                  </button>
                </div>
              )}

              {/* Bottom Soft Navigation Bar */}
              <div className="h-10 bg-black/80 backdrop-blur-xs flex items-center justify-around px-8 border-t border-neutral-900 shrink-0 z-20">
                <button
                  onClick={() => handleNavClick('back')}
                  className="p-1.5 text-neutral-400 hover:text-white rounded active:scale-95 transition-transform"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNavClick('home')}
                  className="p-1.5 text-neutral-400 hover:text-white rounded active:scale-95 transition-transform"
                  title="Home"
                >
                  <Circle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleNavClick('recents')}
                  className="p-1.5 text-neutral-400 hover:text-white rounded active:scale-95 transition-transform"
                  title="Recents"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrcpy Parameter Configuration Sidebar */}
        <div className="w-full lg:w-80 shrink-0 bg-[#0c1017] border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-800/80">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                {t.mirrorSettings}
              </h3>
            </div>

            {/* Resolution Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">{t.resolution}</label>
              <select
                value={config.max_size}
                onChange={(e) => setConfig({ ...config, max_size: Number(e.target.value) })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={720}>720p (HD)</option>
                <option value={1080}>1080p (FHD - Recommended)</option>
                <option value={1440}>1440p (2K Quad HD)</option>
                <option value={0}>Original Native (Max)</option>
              </select>
            </div>

            {/* Frame Rate Limit */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">{t.fpsLimit}</label>
              <select
                value={config.max_fps}
                onChange={(e) => setConfig({ ...config, max_fps: Number(e.target.value) })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={30}>30 FPS (Low Latency / Wi-Fi)</option>
                <option value={60}>60 FPS (Balanced Smooth)</option>
                <option value={120}>120 FPS (Ultra Fluid High Refresh)</option>
              </select>
            </div>

            {/* Video Bitrate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-neutral-300">
                <span>{t.bitrate}</span>
                <span className="font-mono text-cyan-400">{config.bit_rate_mbps} Mbps</span>
              </div>
              <input
                type="range"
                min={2}
                max={32}
                step={2}
                value={config.bit_rate_mbps}
                onChange={(e) => setConfig({ ...config, bit_rate_mbps: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>{t.stayAwake}</span>
                <input
                  type="checkbox"
                  checked={config.stay_awake}
                  onChange={(e) => setConfig({ ...config, stay_awake: e.target.checked })}
                  className="rounded border-neutral-800 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>{t.turnScreenOff}</span>
                <input
                  type="checkbox"
                  checked={config.turn_screen_off}
                  onChange={(e) => setConfig({ ...config, turn_screen_off: e.target.checked })}
                  className="rounded border-neutral-800 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>{t.showTouches}</span>
                <input
                  type="checkbox"
                  checked={config.show_touches}
                  onChange={(e) => setConfig({ ...config, show_touches: e.target.checked })}
                  className="rounded border-neutral-800 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>{t.forwardAudio}</span>
                <input
                  type="checkbox"
                  checked={config.audio}
                  onChange={(e) => setConfig({ ...config, audio: e.target.checked })}
                  className="rounded border-neutral-800 text-cyan-500 focus:ring-0"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800/80 space-y-2">
            <div className="text-[10px] text-neutral-500 leading-tight">
              Scrcpy uses H.264/H.265 hardware encoding on the Android device for near-zero latency streaming.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
