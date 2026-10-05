import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Trash2,
  Copy,
  Check,
  RotateCw,
  Square,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { DeviceDetails } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface TerminalViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  onExecuteShell: (serial: string, command: string) => Promise<string>;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

interface CommandLog {
  id: string;
  command: string;
  output: string;
  timestamp: string;
  isError?: boolean;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  selectedDevice,
  language,
  onExecuteShell,
  onNotify,
}) => {
  const [inputCommand, setInputCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logs, setLogs] = useState<CommandLog[]>([
    {
      id: 'init-1',
      command: 'adb version',
      output: 'Android Debug Bridge version 1.0.41\nVersion 34.0.5-windows\nInstalled as C:\\Program Files\\ApexDroid\\adb.exe',
      timestamp: '14:20:00',
    },
    {
      id: 'init-2',
      command: 'getprop ro.product.model',
      output: selectedDevice?.model || 'SM-S928B',
      timestamp: '14:20:01',
    },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Destructive command interceptor
  const [pendingDangerousCmd, setPendingDangerousCmd] = useState<string | null>(null);

  const t = translations[language];
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const quickPresets = [
    { label: 'getprop', cmd: 'getprop' },
    { label: 'battery', cmd: 'dumpsys battery' },
    { label: 'meminfo', cmd: 'cat /proc/meminfo' },
    { label: 'cpuinfo', cmd: 'cat /proc/cpuinfo' },
    { label: 'storage', cmd: 'df -h' },
    { label: 'packages', cmd: 'pm list packages -3' },
    { label: 'kernel', cmd: 'uname -a' },
    { label: 'logcat', cmd: 'logcat -d -t 30' },
  ];

  const execute = async (cmd: string) => {
    if (!selectedDevice || !cmd.trim()) return;

    // Check dangerous commands
    const normalized = cmd.trim().toLowerCase();
    if (
      normalized.includes('rm -rf /') ||
      normalized.includes('reboot bootloader') ||
      normalized.includes('fastboot erase')
    ) {
      setPendingDangerousCmd(cmd.trim());
      return;
    }

    setIsExecuting(true);
    const ts = new Date().toTimeString().split(' ')[0];

    try {
      const output = await onExecuteShell(selectedDevice.serial, cmd.trim());
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          command: cmd.trim(),
          output,
          timestamp: ts,
        },
      ]);
      setHistory((prev) => [cmd.trim(), ...prev.filter((h) => h !== cmd.trim())]);
      setHistoryIndex(-1);
      setInputCommand('');
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          command: cmd.trim(),
          output: err.message || 'Execution failed',
          timestamp: ts,
          isError: true,
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      execute(inputCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInputCommand(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIndex = historyIndex - 1;
        setHistoryIndex(prevIndex);
        setInputCommand(history[prevIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      }
    }
  };

  const copyOutput = () => {
    const text = logs.map((l) => `$ ${l.command}\n${l.output}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onNotify('info', 'Copied', 'Terminal buffer copied to clipboard');
  };

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <TerminalIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-3rem)] max-w-7xl mx-auto flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.terminal}</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Interactive native ADB shell environment attached to{' '}
            <span className="text-cyan-400 font-mono font-medium">{selectedDevice.serial}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyOutput}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : t.copyTerminal}</span>
          </button>

          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearTerminal}</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto shrink-0 select-none text-xs">
        <span className="text-neutral-500 text-[11px] font-semibold uppercase tracking-wider mr-1">
          {t.quickPresets}:
        </span>
        {quickPresets.map((p) => (
          <button
            key={p.label}
            onClick={() => execute(p.cmd)}
            className="px-2.5 py-1 rounded-md bg-[#0e1322] border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-300 font-mono text-[11px] transition-colors whitespace-nowrap"
          >
            {p.cmd}
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 rounded-xl bg-[#07090e] border border-neutral-800 p-4 font-mono text-xs flex flex-col justify-between overflow-hidden shadow-inner">
        {/* Output area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {logs.map((log) => (
            <div key={log.id} className="space-y-1">
              <div className="flex items-center gap-2 text-cyan-400">
                <span className="text-neutral-500 text-[10px] tabular-nums">[{log.timestamp}]</span>
                <span className="text-emerald-400 select-none">{selectedDevice.serial}:~$</span>
                <span className="text-white font-semibold">{log.command}</span>
              </div>
              <pre
                className={`text-[11px] leading-relaxed whitespace-pre-wrap pl-4 border-l-2 ${
                  log.isError
                    ? 'border-rose-500 text-rose-300'
                    : 'border-neutral-800 text-neutral-300'
                }`}
              >
                {log.output}
              </pre>
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-cyan-400 animate-pulse text-xs pl-4">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Awaiting output from device...</span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Input prompt */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center gap-2 mt-2 bg-[#07090e]">
          <span className="text-emerald-400 select-none font-semibold">
            {selectedDevice.serial}:~$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder={t.commandPlaceholder}
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-neutral-600"
          />
          <button
            onClick={() => execute(inputCommand)}
            disabled={isExecuting || !inputCommand.trim()}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-medium transition-colors disabled:opacity-40"
          >
            Run
          </button>
        </div>
      </div>

      {/* Confirmation for destructive commands */}
      <ConfirmDialog
        isOpen={!!pendingDangerousCmd}
        title="Potentially Destructive Command Detected"
        message={`The command "${pendingDangerousCmd}" may alter system partitions or cause data loss. Are you sure you want to execute it?`}
        confirmLabel="Execute Dangerously"
        isDestructive={true}
        onCancel={() => setPendingDangerousCmd(null)}
        onConfirm={() => {
          const cmd = pendingDangerousCmd!;
          setPendingDangerousCmd(null);
          execute(cmd);
        }}
      />
    </div>
  );
};
