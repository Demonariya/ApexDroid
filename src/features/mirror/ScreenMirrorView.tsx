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
  ExternalLink,
} from 'lucide-react';
import { DeviceDetails, ScrcpyConfig } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ipc } from '../../lib/ipc';

interface ScreenMirrorViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  onStartScrcpy: (serial: string, config: ScrcpyConfig) => Promise<boolean>;
  onStopScrcpy: (serial: string) => Promise<boolean>;
  onTakeScreenshot: () => void;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const ScreenMirrorView: React.FC<ScreenMirrorViewProps> = ({
  selectedDevice,
  language,
  onStartScrcpy,
  onStopScrcpy,
  onTakeScreenshot,
  onNotify,
}) => {
  const [isMirroring, setIsMirroring] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
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
    const isNative = ipc.isNativeMode();
    setIsNativeMode(isNative);

    if (selectedDevice) {
      ipc.isScrcpyRunning(selectedDevice.serial)
        .then((running) => setIsMirroring(running))
        .catch(() => {});
    }
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

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      onNotify('success', 'Recording Saved', `Saved screen capture (${recordSeconds}s) to ~/Downloads/ApexDroid/recordings`);
    } else {
      setIsRecording(true);
      onNotify('info', 'Recording Started', 'Capturing H.264 video stream...');
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
          <p className="text-xs text-neutral-400 mt-0.5">
            High-framerate USB/Wi-Fi screen mirroring and input control powered by scrcpy v2.3.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-300 text-xs font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>REC {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
            </div>
          )}

          <button
            onClick={toggleRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isRecording
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isRecording ? 'Stop Recording' : 'Record'}</span>
          </button>

          <button
            onClick={onTakeScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.captureSnapshot}</span>
          </button>

          <button
            onClick={toggleMirroring}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm ${
              isMirroring
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {isMirroring ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isMirroring ? t.stopMirroring : t.startMirroring}</span>
          </button>
        </div>
      </div>

      {/* Main Mirror Area */}
      <div className="flex-1 flex gap-6 mt-4 min-h-0">
        {/* Left: Device Mirror Interactive Canvas */}
        <div className="flex-1 rounded-xl bg-[#090b10] border border-neutral-800/80 p-4 flex flex-col items-center justify-center relative overflow-hidden">
          {isMirroring ? (
            isNativeMode ? (
              /* Native Mode: Scrcpy renders as native Windows window */
              <div className="text-center p-8 max-w-md space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mx-auto flex items-center justify-center">
                  <Monitor className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Scrcpy Native Window Active</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Scrcpy is rendering directly via GPU-accelerated DirectX/OpenGL in an external native desktop window.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#0e1422] border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Device:</span>
                    <span className="text-cyan-400">{selectedDevice.serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Resolution:</span>
                    <span>{config.max_size}p</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Bitrate:</span>
                    <span>{config.bit_rate_mbps} Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">FPS Limit:</span>
                    <span>{config.max_fps} FPS</span>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500">
                  Use the hardware keys panel on the right to dispatch keyevents (Volume, Back, Home, Power) directly into the device.
                </p>

                <button
                  onClick={toggleMirroring}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
                >
                  Terminate Scrcpy Session
                </button>
              </div>
            ) : (
              /* Browser preview mode simulation */
              <div className="h-full max-h-[640px] aspect-[9/19] bg-[#000000] border-4 border-neutral-800 rounded-[32px] p-2 flex flex-col justify-between shadow-2xl relative select-none">
                {/* Camera punch-hole */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-black border border-neutral-800 z-30" />

                {/* Status bar */}
                <div className="pt-2 px-4 flex items-center justify-between text-[11px] text-neutral-300 font-mono z-20">
                  <span>14:32</span>
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <Wifi className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px]">5G</span>
                    <div className="flex items-center gap-0.5">
                      <Battery className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[9px] tabular-nums">{selectedDevice.battery?.level || 88}%</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Virtual Android Screen Content */}
                <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden relative">
                  {currentScreen === 'home' && (
                    <>
                      {/* Home screen widgets */}
                      <div className="mt-4 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/60 backdrop-blur-sm">
                        <div className="text-xl font-bold text-white tracking-tight">14:32</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">Thursday, October 5 · 22°C Clear</div>
                      </div>

                      {/* App grid */}
                      <div className="grid grid-cols-4 gap-3 my-auto">
                        <button
                          onClick={() => setCurrentScreen('settings')}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700/80 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
                            <Settings className="w-5 h-5 text-neutral-300" />
                          </div>
                          <span className="text-[10px] text-neutral-300">Settings</span>
                        </button>

                        <button
                          onClick={() => setCurrentScreen('camera')}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
                            <Camera className="w-5 h-5 text-emerald-400" />
                          </div>
                          <span className="text-[10px] text-neutral-300">Camera</span>
                        </button>

                        <button
                          onClick={() => setCurrentScreen('browser')}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
                            <Wifi className="w-5 h-5 text-blue-400" />
                          </div>
                          <span className="text-[10px] text-neutral-300">Chrome</span>
                        </button>

                        <button
                          onClick={() => onNotify('info', 'ADB Shell', 'Launched Termux Terminal session')}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-violet-950/80 border border-violet-800/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
                            <Smartphone className="w-5 h-5 text-violet-400" />
                          </div>
                          <span className="text-[10px] text-neutral-300">Termux</span>
                        </button>
                      </div>

                      {/* Dock */}
                      <div className="p-2 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex justify-around mb-2">
                        <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center">
                          <Smartphone className="w-4 h-4 text-white" />
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                          <Cast className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </>
                  )}

                  {currentScreen === 'settings' && (
                    <div className="h-full flex flex-col text-xs text-neutral-200">
                      <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                        <button onClick={() => setCurrentScreen('home')}>
                          <ChevronLeft className="w-4 h-4 text-cyan-400" />
                        </button>
                        <span className="font-semibold text-white">Android System Settings</span>
                      </div>
                      <div className="space-y-2 mt-3 text-[11px]">
                        <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex justify-between items-center">
                          <span>Wi-Fi Debugging</span>
                          <span className="text-cyan-400 font-mono">Connected</span>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex justify-between items-center">
                          <span>USB Debugging</span>
                          <span className="text-emerald-400 font-mono">Active</span>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex justify-between items-center">
                          <span>Stay Awake</span>
                          <span className="text-neutral-400 font-mono">Enabled</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentScreen === 'camera' && (
                    <div className="h-full flex flex-col justify-between text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                        <button onClick={() => setCurrentScreen('home')}>
                          <ChevronLeft className="w-4 h-4 text-cyan-400" />
                        </button>
                        <span className="text-white font-medium">Pro 200MP Viewfinder</span>
                        <div className="w-4" />
                      </div>
                      <div className="my-auto flex flex-col items-center justify-center text-neutral-500">
                        <Camera className="w-12 h-12 text-neutral-600 mb-2" />
                        <span className="text-[11px]">Sensor Active</span>
                      </div>
                      <div className="flex justify-center mb-2">
                        <button
                          onClick={onTakeScreenshot}
                          className="w-12 h-12 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform"
                        />
                      </div>
                    </div>
                  )}

                  {currentScreen === 'browser' && (
                    <div className="h-full flex flex-col text-xs">
                      <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                        <button onClick={() => setCurrentScreen('home')}>
                          <ChevronLeft className="w-4 h-4 text-cyan-400" />
                        </button>
                        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[10px] text-neutral-400 font-mono truncate">
                          https://developer.android.com
                        </div>
                      </div>
                      <div className="mt-4 p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 leading-relaxed">
                        Android Development Suite running natively on host machine.
                      </div>
                    </div>
                  )}
                </div>

                {/* Android Soft Nav Keys */}
                <div className="py-1 px-8 flex items-center justify-between border-t border-neutral-900 bg-black text-neutral-500">
                  <button
                    onClick={() => handleNavClick('recents')}
                    className="p-1 hover:text-white transition-colors"
                    title="Recents"
                  >
                    <Menu className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleNavClick('home')}
                    className="p-1 hover:text-white transition-colors"
                    title="Home"
                  >
                    <Circle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleNavClick('back')}
                    className="p-1 hover:text-white transition-colors"
                    title="Back"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="text-center p-8">
              <Cast className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Mirror Session Inactive</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-1">
                Click "Start Scrcpy Mirroring" to launch real-time video display.
              </p>
              <button
                onClick={toggleMirroring}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm"
              >
                Start Mirroring
              </button>
            </div>
          )}
        </div>

        {/* Right: Scrcpy Parameters & Real Hardware controls */}
        <div className="w-80 shrink-0 rounded-xl bg-[#0c1017] border border-neutral-800/80 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Scrcpy Configuration
            </h2>

            {/* Resolution */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                {t.resolutionSetting}
              </label>
              <select
                value={config.max_size}
                disabled={isMirroring}
                onChange={(e) => setConfig({ ...config, max_size: Number(e.target.value) })}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                <option value={720}>720p HD (Low latency)</option>
                <option value={1080}>1080p FHD (Balanced standard)</option>
                <option value={1440}>1440p QHD+ (Maximum fidelity)</option>
              </select>
            </div>

            {/* Bitrate */}
            <div>
              <div className="flex justify-between text-[11px] font-medium text-neutral-400 mb-1">
                <span>{t.bitrateSetting}</span>
                <span className="text-cyan-400 font-mono">{config.bit_rate_mbps} Mbps</span>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={2}
                disabled={isMirroring}
                value={config.bit_rate_mbps}
                onChange={(e) => setConfig({ ...config, bit_rate_mbps: Number(e.target.value) })}
                className="w-full accent-cyan-500 disabled:opacity-50"
              />
            </div>

            {/* FPS */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                {t.fpsSetting}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 120].map((fps) => (
                  <button
                    key={fps}
                    disabled={isMirroring}
                    onClick={() => setConfig({ ...config, max_fps: fps })}
                    className={`py-1 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
                      config.max_fps === fps
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-2 border-t border-neutral-800/80 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-neutral-400">{t.stayAwake}</span>
                <input
                  type="checkbox"
                  disabled={isMirroring}
                  checked={config.stay_awake}
                  onChange={(e) => setConfig({ ...config, stay_awake: e.target.checked })}
                  className="accent-cyan-500 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-neutral-400">{t.turnScreenOff}</span>
                <input
                  type="checkbox"
                  disabled={isMirroring}
                  checked={config.turn_screen_off}
                  onChange={(e) => setConfig({ ...config, turn_screen_off: e.target.checked })}
                  className="accent-cyan-500 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-neutral-400">{t.audioStreaming}</span>
                <input
                  type="checkbox"
                  disabled={isMirroring}
                  checked={config.audio}
                  onChange={(e) => setConfig({ ...config, audio: e.target.checked })}
                  className="accent-cyan-500 disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          {/* Real Virtual Hardware Keys dispatching actual ADB keyevents */}
          <div className="pt-4 border-t border-neutral-800 space-y-2">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Hardware Key Operations (Real ADB)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sendKeyEvent('KEYCODE_VOLUME_UP', 'Volume Up')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
                title="Send real KEYCODE_VOLUME_UP"
              >
                <Volume1 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Vol Up</span>
              </button>
              <button
                onClick={() => sendKeyEvent('KEYCODE_VOLUME_DOWN', 'Volume Down')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
                title="Send real KEYCODE_VOLUME_DOWN"
              >
                <Volume className="w-3.5 h-3.5 text-cyan-400" />
                <span>Vol Down</span>
              </button>
              <button
                onClick={() => sendKeyEvent('KEYCODE_POWER', 'Power Key')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
                title="Send real KEYCODE_POWER"
              >
                <Power className="w-3.5 h-3.5 text-rose-400" />
                <span>Power</span>
              </button>
              <button
                onClick={() => sendKeyEvent('KEYCODE_BACK', 'Back Key')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
                title="Send real KEYCODE_BACK"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
