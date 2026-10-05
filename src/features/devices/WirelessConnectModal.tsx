import React, { useState } from 'react';
import { Wifi, X, QrCode } from 'lucide-react';
import { translations, Language } from '../../lib/i18n';

interface WirelessConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (hostPort: string) => Promise<void>;
  onPair: (hostPort: string, code: string) => Promise<void>;
  language: Language;
}

export const WirelessConnectModal: React.FC<WirelessConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onPair,
  language,
}) => {
  const [activeMode, setActiveMode] = useState<'connect' | 'pair'>('connect');
  const [ipAddress, setIpAddress] = useState('192.168.1.');
  const [port, setPort] = useState('5555');
  const [pairingPort, setPairingPort] = useState('37829');
  const [pairingCode, setPairingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const t = translations[language];

  if (!isOpen) return null;

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    try {
      const target = `${ipAddress.trim()}:${port.trim()}`;
      await onConnect(target);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to wireless device');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    try {
      const target = `${ipAddress.trim()}:${pairingPort.trim()}`;
      await onPair(target, pairingCode.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Wireless pairing failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0f1422] border border-neutral-800 rounded-xl shadow-2xl p-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{t.connectWirelessModal}</h3>
              <p className="text-[11px] text-neutral-500">ADB over Wi-Fi 802.11ax / 6GHz</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch: Direct Connect vs Pair */}
        <div className="flex rounded-lg bg-[#0a0d14] p-1 border border-neutral-800 mt-4">
          <button
            type="button"
            onClick={() => setActiveMode('connect')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeMode === 'connect'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Direct Connect
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('pair')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeMode === 'pair'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Pairing Code (Android 11+)
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {activeMode === 'connect' ? (
          <form onSubmit={handleConnectSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Device IP Address
              </label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Port (Default: 5555)
              </label>
              <input
                type="text"
                required
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5555"
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80 text-[11px] text-neutral-400 leading-relaxed">
              Ensure <strong className="text-neutral-200">Wireless Debugging</strong> is enabled in Developer Options on your Android device and both devices are on the same local network subnet.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/40 rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-950 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePairSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Device IP Address
              </label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Pairing Port (from phone screen)
              </label>
              <input
                type="text"
                required
                value={pairingPort}
                onChange={(e) => setPairingPort(e.target.value)}
                placeholder="37829"
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                6-digit Wi-Fi Pairing Code
              </label>
              <input
                type="text"
                required
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="e.g. 748192"
                maxLength={6}
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white tracking-widest focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/40 rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-950 disabled:opacity-50"
              >
                {isLoading ? 'Pairing...' : 'Pair Device'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
