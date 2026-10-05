import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Folder,
  File,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  Upload,
  Download,
  FolderPlus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  HardDrive,
  Clock,
  ArrowUp,
  X,
} from 'lucide-react';
import { DeviceDetails, FileEntry } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface FileManagerViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  onListFiles: (serial: string, path: string) => Promise<FileEntry[]>;
  onCreateDirectory: (serial: string, path: string) => Promise<void>;
  onDeleteFile: (serial: string, path: string, recursive: boolean) => Promise<void>;
  onRenameFile: (serial: string, oldPath: string, newPath: string) => Promise<void>;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  selectedDevice,
  language,
  onListFiles,
  onCreateDirectory,
  onDeleteFile,
  onRenameFile,
  onNotify,
}) => {
  const [currentPath, setCurrentPath] = useState('/sdcard');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  // Modal states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  const t = translations[language];

  const quickNav = [
    { name: 'Internal Storage', path: '/sdcard', icon: HardDrive },
    { name: 'Downloads', path: '/sdcard/Download', icon: Download },
    { name: 'DCIM (Camera)', path: '/sdcard/DCIM', icon: Image },
    { name: 'Pictures', path: '/sdcard/Pictures', icon: Image },
    { name: 'Documents', path: '/sdcard/Documents', icon: FileText },
    { name: 'Music', path: '/sdcard/Music', icon: Music },
  ];

  const fetchDirectory = async (path: string) => {
    if (!selectedDevice) return;
    setIsLoading(true);
    setSelectedEntry(null);
    try {
      const list = await onListFiles(selectedDevice.serial, path);
      setEntries(list);
      setCurrentPath(path);
    } catch (err: any) {
      onNotify('error', 'Filesystem Error', err.message || 'Failed to list directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDevice) {
      fetchDirectory(currentPath);
    }
  }, [selectedDevice?.serial]);

  const handleNavigate = (path: string) => {
    fetchDirectory(path);
  };

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const up = '/' + parts.join('/');
    handleNavigate(up === '/' ? '/' : up);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !newFolderName.trim()) return;
    try {
      const fullPath = `${currentPath.replace(/\/$/, '')}/${newFolderName.trim()}`;
      await onCreateDirectory(selectedDevice.serial, fullPath);
      onNotify('success', 'Folder Created', `Created folder ${newFolderName.trim()}`);
      setShowNewFolderModal(false);
      setNewFolderName('');
      fetchDirectory(currentPath);
    } catch (err: any) {
      onNotify('error', 'Folder Creation Failed', err.message);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !renameTarget || !renameValue.trim()) return;
    try {
      const parent = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/')) || '/sdcard';
      const newPath = `${parent}/${renameValue.trim()}`;
      await onRenameFile(selectedDevice.serial, renameTarget.path, newPath);
      onNotify('success', 'Renamed', `Renamed to ${renameValue.trim()}`);
      setRenameTarget(null);
      fetchDirectory(currentPath);
    } catch (err: any) {
      onNotify('error', 'Rename Failed', err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDevice || !deleteTarget) return;
    try {
      const isDir = deleteTarget.file_type === 'Directory';
      await onDeleteFile(selectedDevice.serial, deleteTarget.path, isDir);
      onNotify('warning', 'Deleted', `Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      fetchDirectory(currentPath);
    } catch (err: any) {
      onNotify('error', 'Delete Failed', err.message);
    }
  };

  const handleSimulatedUpload = () => {
    if (!selectedDevice) return;
    const file = 'uploaded_asset_' + Math.floor(Math.random() * 1000) + '.pdf';
    onCreateDirectory(selectedDevice.serial, `${currentPath}/${file}`).then(() => {
      onNotify('success', 'File Pushed', `Pushed ${file} to ${currentPath}`);
      fetchDirectory(currentPath);
    });
  };

  const handleSimulatedDownload = (entry: FileEntry) => {
    onNotify('success', 'Download Started', `Pulling ${entry.name} to ~/Downloads/ApexDroid/`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (entry: FileEntry) => {
    if (entry.file_type === 'Directory') return <Folder className="w-4 h-4 text-cyan-400 shrink-0" />;
    const ext = entry.extension || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <Image className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['mp4', 'mkv', 'mov', 'webm'].includes(ext)) {
      return <Video className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
    if (['mp3', 'aac', 'flac', 'ogg'].includes(ext)) {
      return <Music className="w-4 h-4 text-pink-400 shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'apk', 'rar'].includes(ext)) {
      return <Archive className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (['json', 'xml', 'sh', 'py', 'ts', 'js'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-violet-400 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-neutral-400 shrink-0" />;
  };

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pathSegments = currentPath.split('/').filter(Boolean);

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <FolderTree className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* Quick Nav Tree Sidebar */}
      <div className="w-56 shrink-0 bg-[#0a0d14] border-r border-neutral-800/80 p-3 flex flex-col gap-1 select-none overflow-y-auto">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1">
          Locations
        </div>
        {quickNav.map((loc) => {
          const Icon = loc.icon;
          const isActive = currentPath === loc.path;
          return (
            <button
              key={loc.path}
              onClick={() => handleNavigate(loc.path)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{loc.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Files Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#090b10]">
        {/* Breadcrumb Navigation & Toolbar */}
        <div className="p-3 border-b border-neutral-800/80 bg-[#0c1018] flex items-center justify-between gap-3">
          {/* Breadcrumb trail */}
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 text-xs">
            <button
              onClick={handleNavigateUp}
              disabled={currentPath === '/' || currentPath === ''}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 mr-1"
              title="Parent directory"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleNavigate('/sdcard')}
              className="px-1.5 py-0.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 font-mono text-[11px]"
            >
              /sdcard
            </button>

            {pathSegments.slice(1).map((seg, idx) => {
              const segPath = '/' + pathSegments.slice(0, idx + 2).join('/');
              return (
                <React.Fragment key={segPath}>
                  <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
                  <button
                    onClick={() => handleNavigate(segPath)}
                    className="px-1.5 py-0.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 font-mono text-[11px] truncate max-w-xs"
                  >
                    {seg}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSimulatedUpload}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-white transition-colors"
              title={t.uploadFile}
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Push</span>
            </button>

            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title={t.newFolder}
            >
              <FolderPlus className="w-4 h-4" />
            </button>

            <button
              onClick={() => fetchDirectory(currentPath)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-cyan-400 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <div className="h-4 w-[1px] bg-neutral-800 mx-0.5" />

            {/* Grid / List switch */}
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Toggle View Mode"
            >
              {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-3 py-2 border-b border-neutral-800/60 bg-[#0a0d14] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 max-w-xs w-full bg-[#101420] border border-neutral-800 rounded-lg px-2.5 py-1 text-neutral-400">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search current directory..."
              className="bg-transparent w-full text-xs text-white placeholder:text-neutral-500 focus:outline-none"
            />
          </div>

          <div className="text-[11px] text-neutral-500 font-mono">
            {filteredEntries.length} items · {formatBytes(entries.reduce((acc, curr) => acc + curr.size_bytes, 0))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="py-20 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Querying device filesystem over ADB...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-500">
              Empty folder or no matching files.
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-neutral-800/50">
              {filteredEntries.map((entry) => {
                const isDir = entry.file_type === 'Directory';
                const isSelected = selectedEntry?.path === entry.path;
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedEntry(entry)}
                    onDoubleClick={() => (isDir ? handleNavigate(entry.path) : handleSimulatedDownload(entry))}
                    className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors text-xs ${
                      isSelected ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-neutral-800/40 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {getFileIcon(entry)}
                      <span className="truncate font-medium">{entry.name}</span>
                    </div>

                    <div className="flex items-center gap-6 font-mono text-[11px] text-neutral-400 shrink-0">
                      <span className="w-20 text-right tabular-nums">
                        {isDir ? '—' : formatBytes(entry.size_bytes)}
                      </span>
                      <span className="hidden md:inline w-28 text-neutral-400 tabular-nums">
                        {entry.permissions}
                      </span>
                      <span className="hidden sm:inline w-32 text-neutral-400 tabular-nums">
                        {entry.modified_str}
                      </span>

                      {/* Row actions */}
                      <div className="flex items-center gap-1">
                        {!isDir && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSimulatedDownload(entry);
                            }}
                            className="p-1 hover:text-cyan-400 transition-colors"
                            title={t.downloadFile}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameTarget(entry);
                            setRenameValue(entry.name);
                          }}
                          className="p-1 hover:text-cyan-400 transition-colors"
                          title={t.rename}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(entry);
                          }}
                          className="p-1 hover:text-rose-400 transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredEntries.map((entry) => {
                const isDir = entry.file_type === 'Directory';
                const isSelected = selectedEntry?.path === entry.path;
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedEntry(entry)}
                    onDoubleClick={() => (isDir ? handleNavigate(entry.path) : handleSimulatedDownload(entry))}
                    className={`p-3 rounded-lg border text-center cursor-pointer transition-all flex flex-col items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#0f1422] border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="my-2">{getFileIcon(entry)}</div>
                    <div className="w-full">
                      <div className="text-xs font-medium truncate">{entry.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        {isDir ? 'Directory' : formatBytes(entry.size_bytes)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-sm bg-[#0f1422] border border-neutral-800 rounded-xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-sm font-semibold text-white">Create New Directory</h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Folder Name</label>
              <input
                type="text"
                autoFocus
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. MyBackups"
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-sm bg-[#0f1422] border border-neutral-800 rounded-xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-sm font-semibold text-white">Rename Item</h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">New Name</label>
              <input
                type="text"
                autoFocus
                required
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-[#0a0d14] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This operation runs "rm -rf" via ADB.`}
        confirmLabel="Delete Permanently"
        isDestructive={true}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
