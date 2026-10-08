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
  AlertTriangle,
} from 'lucide-react';
import { DeviceDetails, FileEntry } from '../../types';
import { translations, Language } from '../../lib/i18n';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ipc } from '../../lib/ipc';

interface FileManagerViewProps {
  selectedDevice: DeviceDetails | null;
  language: Language;
  defaultDownloadPath: string;
  confirmDestructive: boolean;
  onListFiles: (serial: string, path: string) => Promise<FileEntry[]>;
  onCreateDirectory: (serial: string, path: string) => Promise<void>;
  onDeleteFile: (serial: string, path: string, recursive: boolean) => Promise<void>;
  onRenameFile: (serial: string, oldPath: string, newPath: string) => Promise<void>;
  onNotify: (type: 'info' | 'success' | 'warning' | 'error', title: string, msg: string) => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  selectedDevice,
  language,
  defaultDownloadPath,
  confirmDestructive,
  onListFiles,
  onCreateDirectory,
  onDeleteFile,
  onRenameFile,
  onNotify,
}) => {
  const [currentPath, setCurrentPath] = useState('/storage/emulated/0');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputValue, setPathInputValue] = useState('/storage/emulated/0');

  // Modal states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  const t = translations[language];

  const quickNav = [
    { name: 'Internal Storage', path: '/storage/emulated/0', icon: HardDrive },
    { name: 'SDCard (Symlink)', path: '/sdcard', icon: HardDrive },
    { name: 'Root (/)', path: '/', icon: FolderTree },
    { name: 'Downloads', path: '/storage/emulated/0/Download', icon: Download },
    { name: 'DCIM (Camera)', path: '/storage/emulated/0/DCIM', icon: Image },
    { name: 'Pictures', path: '/storage/emulated/0/Pictures', icon: Image },
    { name: 'Documents', path: '/storage/emulated/0/Documents', icon: FileText },
    { name: 'Music', path: '/storage/emulated/0/Music', icon: Music },
  ];

  const fetchDirectory = async (path: string) => {
    if (!selectedDevice) return;
    setIsLoading(true);
    setSelectedEntry(null);
    try {
      const cleanTarget = path.trim() || '/storage/emulated/0';
      const list = await onListFiles(selectedDevice.serial, cleanTarget);
      setEntries(list);
      setCurrentPath(cleanTarget);
      setPathInputValue(cleanTarget);
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

  const handleUploadFile = async () => {
    if (!selectedDevice) return;
    const localFile = await ipc.pickFile({
      title: 'Select File to Push to Device',
    });

    if (!localFile) return;

    setIsTransferring(true);
    try {
      const fileName = localFile.split(/[/\\]/).pop() || 'file';
      const remoteTarget = `${currentPath.replace(/\/$/, '')}/${fileName}`;
      onNotify('info', 'Pushing File', `Uploading ${fileName} via ADB push...`);

      const bytes = await ipc.pushFile(selectedDevice.serial, localFile, remoteTarget);
      const kb = (bytes / 1024).toFixed(1);
      onNotify('success', 'Upload Succeeded', `Pushed ${fileName} (${kb} KB) to ${currentPath}`);
      fetchDirectory(currentPath);
    } catch (err: any) {
      onNotify('error', 'Upload Failed', err.message || 'Failed to push file');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDownloadFile = async (entry: FileEntry) => {
    if (!selectedDevice) return;

    const defaultTarget = `${defaultDownloadPath.replace(/[\\/]$/, '')}/${entry.name}`;
    const localSavePath = await ipc.pickSaveFile({
      title: `Save ${entry.name}`,
      defaultPath: defaultTarget,
    });

    if (!localSavePath) return;

    setIsTransferring(true);
    try {
      onNotify('info', 'Pulling File', `Downloading ${entry.name} from device...`);
      const bytes = await ipc.pullFile(selectedDevice.serial, entry.path, localSavePath);
      const kb = (bytes / 1024).toFixed(1);
      onNotify('success', 'Download Complete', `Saved ${entry.name} (${kb} KB) to ${localSavePath}`);
    } catch (err: any) {
      onNotify('error', 'Download Failed', err.message || 'Failed to pull file from device');
    } finally {
      setIsTransferring(false);
    }
  };

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (entry: FileEntry) => {
    if (entry.file_type === 'Directory') return <Folder className="w-5 h-5 text-cyan-400 shrink-0" />;
    if (entry.file_type === 'Symlink') return <FolderTree className="w-5 h-5 text-teal-400 shrink-0" />;
    const ext = entry.extension || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      return <Image className="w-5 h-5 text-indigo-400 shrink-0" />;
    }
    if (['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
      return <Video className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
      return <Music className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'apk', 'rar', '7z'].includes(ext)) {
      return <Archive className="w-5 h-5 text-amber-400 shrink-0" />;
    }
    if (['json', 'xml', 'ts', 'js', 'html', 'css', 'sh'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-sky-400 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-neutral-400 shrink-0" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center rounded-xl bg-[#0c1017] border border-neutral-800 m-6">
        <FolderTree className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">{t.noDeviceSelected}</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-3rem)] max-w-7xl mx-auto flex flex-col gap-4 overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-800/80 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.fileManager}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Genuine Android internal storage filesystem navigator via ADB push, pull, and POSIX permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-xs font-medium text-neutral-200 hover:text-white transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.newFolder}</span>
          </button>

          <button
            onClick={handleUploadFile}
            disabled={isTransferring}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white shadow-sm shadow-cyan-950 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isTransferring ? 'Transferring...' : t.uploadFile}</span>
          </button>

          <button
            onClick={() => fetchDirectory(currentPath)}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#0e1422] border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-400 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Path Breadcrumbs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d121e] p-2.5 rounded-xl border border-neutral-800/80 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs py-1 flex-1">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '/' || currentPath === ''}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
            title="Navigate Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {isEditingPath ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsEditingPath(false);
                if (pathInputValue.trim()) {
                  handleNavigate(pathInputValue.trim());
                }
              }}
              className="flex items-center gap-1.5 flex-1 min-w-[220px]"
            >
              <input
                type="text"
                autoFocus
                value={pathInputValue}
                onChange={(e) => setPathInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPathInputValue(currentPath);
                    setIsEditingPath(false);
                  }
                }}
                onBlur={() => {
                  setIsEditingPath(false);
                }}
                placeholder="/storage/emulated/0"
                className="bg-[#090b10] border border-cyan-500 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none w-full"
              />
              <button
                type="submit"
                className="px-2 py-1 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shrink-0"
              >
                Go
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => handleNavigate('/')}
                className={`font-mono text-xs px-1.5 py-0.5 rounded transition-colors ${
                  currentPath === '/'
                    ? 'text-cyan-400 font-semibold bg-cyan-950/30'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
                title="Root (/)"
              >
                /
              </button>

              {currentPath
                .split('/')
                .filter(Boolean)
                .map((part, idx, arr) => {
                  const full = '/' + arr.slice(0, idx + 1).join('/');
                  const isLast = idx === arr.length - 1;
                  return (
                    <React.Fragment key={full}>
                      <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
                      <button
                        onClick={() => handleNavigate(full)}
                        className={`font-mono text-xs px-1.5 py-0.5 rounded transition-colors ${
                          isLast
                            ? 'text-cyan-400 font-semibold bg-cyan-950/30'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => {
                  setPathInputValue(currentPath);
                  setIsEditingPath(true);
                }}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-cyan-400 ml-1 shrink-0"
                title="Edit path directly"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.searchFiles}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#090b10] border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center border border-neutral-800 rounded-lg p-0.5 bg-[#090b10]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-500'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-neutral-800 text-cyan-400' : 'text-neutral-500'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Files Area with Quick Nav Sidebar */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Quick Nav Drawer */}
        <div className="w-48 shrink-0 bg-[#0c1017] border border-neutral-800/80 rounded-xl p-3 flex flex-col gap-1 overflow-y-auto hidden md:flex">
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase px-2 mb-1">
            Quick Storage
          </div>
          {quickNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                  isActive
                    ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/30'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Directory Listing Container */}
        <div className="flex-1 bg-[#0c1017] border border-neutral-800/80 rounded-xl flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <span className="text-xs font-medium">{t.loadingFiles}</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral-500">
              <Folder className="w-10 h-10 text-neutral-700" />
              <span className="text-xs font-medium">{t.emptyDirectory}</span>
            </div>
          ) : viewMode === 'list' ? (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0e1422] text-neutral-400 font-medium border-b border-neutral-800/80 z-10">
                  <tr>
                    <th className="py-2.5 px-4">{t.fileName}</th>
                    <th className="py-2.5 px-3 w-28">{t.size}</th>
                    <th className="py-2.5 px-3 w-36">{t.modified}</th>
                    <th className="py-2.5 px-3 w-28 font-mono">{t.permissions}</th>
                    <th className="py-2.5 px-3 w-24 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60">
                  {filteredEntries.map((entry) => {
                    const isSelected = selectedEntry?.path === entry.path;
                    return (
                      <tr
                        key={entry.path}
                        onClick={() => setSelectedEntry(entry)}
                        onDoubleClick={() => {
                          if (entry.file_type === 'Directory' || entry.file_type === 'Symlink') {
                            handleNavigate(entry.path);
                          } else {
                            handleDownloadFile(entry);
                          }
                        }}
                        className={`group transition-colors cursor-pointer ${
                          isSelected ? 'bg-cyan-950/20' : 'hover:bg-neutral-900/60'
                        }`}
                      >
                        <td className="py-2 px-4 flex items-center gap-2.5 font-medium text-neutral-200">
                          {getFileIcon(entry)}
                          <span className="truncate max-w-xs sm:max-w-md">{entry.name}</span>
                        </td>
                        <td className="py-2 px-3 text-neutral-400 font-mono text-[11px]">
                          {formatSize(entry.size_bytes)}
                        </td>
                        <td className="py-2 px-3 text-neutral-400 text-[11px]">
                          {entry.modified_str || '—'}
                        </td>
                        <td className="py-2 px-3 text-neutral-500 font-mono text-[11px]">
                          {entry.permissions}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {entry.file_type === 'File' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(entry);
                                }}
                                className="p-1 hover:text-cyan-400 text-neutral-400 rounded"
                                title="Download to PC"
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
                              className="p-1 hover:text-amber-400 text-neutral-400 rounded"
                              title="Rename"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(entry);
                              }}
                              className="p-1 hover:text-rose-400 text-neutral-400 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 overflow-y-auto">
              {filteredEntries.map((entry) => {
                const isSelected = selectedEntry?.path === entry.path;
                return (
                  <div
                    key={entry.path}
                    onClick={() => setSelectedEntry(entry)}
                    onDoubleClick={() => {
                      if (entry.file_type === 'Directory' || entry.file_type === 'Symlink') {
                        handleNavigate(entry.path);
                      } else {
                        handleDownloadFile(entry);
                      }
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-between text-center gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#090b10] border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className="mt-2">{getFileIcon(entry)}</div>
                    <div className="w-full">
                      <div className="text-xs font-medium truncate w-full">{entry.name}</div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {formatSize(entry.size_bytes)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0e1422] border border-neutral-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">{t.newFolder}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Enter the directory name to create inside <code className="text-cyan-400 font-mono">{currentPath}</code>:
            </p>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                placeholder="folder_name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
                >
                  {t.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0e1422] border border-neutral-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">{t.rename}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Rename <code className="text-cyan-400 font-mono">{renameTarget.name}</code>:
            </p>
            <form onSubmit={handleRenameSubmit}>
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-[#090b10] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || renameValue === renameTarget.name}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
