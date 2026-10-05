import React, { useState } from 'react';
import {
  FileText,
  Search,
  Trash2,
  Download,
  Filter,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { LogMessage } from '../../types';
import { translations, Language } from '../../lib/i18n';

interface LogsViewProps {
  logs: LogMessage[];
  language: Language;
  onClearLogs: () => void;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  logs,
  language,
  onClearLogs,
  onNotify,
}) => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const t = translations[language];

  const handleExport = () => {
    const content = logs
      .map((l) => `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.target}] ${l.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexdroid-tracing-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'Logs Exported', 'Downloaded tracing log dump.');
  };

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = levelFilter === 'ALL' || l.level === levelFilter;
    const matchesSearch =
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.device_serial && l.device_serial.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="p-6 h-[calc(100vh-3rem)] max-w-7xl mx-auto flex flex-col overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.logsTitle}</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Structured Rust `tracing` output with IPC call records, ADB stdout, and socket telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportLogs}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearLogs}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-[#0d121e] p-2.5 rounded-xl border border-neutral-800/80 text-xs shrink-0">
        {/* Level filter buttons */}
        <div className="flex items-center gap-1 bg-[#090b10] p-1 rounded-lg border border-neutral-800/60">
          {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                levelFilter === lvl
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 max-w-sm w-full bg-[#090b10] border border-neutral-800/80 rounded-lg px-2.5 py-1 text-neutral-400">
          <Search className="w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log messages or targets..."
            className="bg-transparent w-full text-xs text-white placeholder:text-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Log entries table */}
      <div className="flex-1 rounded-xl bg-[#07090e] border border-neutral-800/80 p-3 font-mono text-xs overflow-y-auto divide-y divide-neutral-900/60">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No matching log entries found.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const getLevelBadge = () => {
              switch (log.level) {
                case 'ERROR':
                  return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
                case 'WARN':
                  return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
                case 'DEBUG':
                  return 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40';
                default:
                  return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40';
              }
            };

            return (
              <div
                key={log.id}
                className="py-1.5 px-2 hover:bg-[#0c101a] transition-colors flex items-start gap-3"
              >
                <span className="text-neutral-500 text-[11px] tabular-nums shrink-0">
                  {log.timestamp}
                </span>

                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold shrink-0 ${getLevelBadge()}`}
                >
                  {log.level.padEnd(5)}
                </span>

                <span className="text-neutral-400 text-[11px] w-24 truncate shrink-0">
                  [{log.target}]
                </span>

                <span className="text-neutral-200 text-[11px] break-all flex-1">
                  {log.message}
                </span>

                {log.device_serial && (
                  <span className="text-[10px] text-neutral-500 shrink-0">
                    dev:{log.device_serial}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
