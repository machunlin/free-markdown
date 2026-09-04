import { useEffect, useState, useCallback } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { readDirectory, openFile } from '../../core/ipc/commands';
import type { FileInfo } from '../../types';

export function Sidebar() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('');
  const openTab = useFileStore((state) => state.openFile);

  const loadDirectory = useCallback(async (dir: string) => {
    try {
      const entries = await readDirectory(dir);
      setFiles(entries);
      setCurrentDir(dir);
    } catch (error) {
      console.error('Failed to read directory:', error);
    }
  }, []);

  useEffect(() => {
    // The sidebar starts empty; a folder picker will be added with workspace support.
  }, []);

  const handleClick = async (file: FileInfo) => {
    if (file.isDir) {
      await loadDirectory(file.path);
      return;
    }
    try {
      const result = await openFile(file.path);
      openTab(result.path, result.content, result.encoding);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const handleGoUp = () => {
    const parent = currentDir.split('/').slice(0, -1).join('/') || '/';
    void loadDirectory(parent);
  };

  const markdownExtensions = ['.md', '.markdown', '.mkd', '.mdown', '.txt'];
  return (
    <div className="w-56 flex-shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border)] flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)]">
        <button onClick={handleGoUp} className="toolbar-btn" title="Go up" aria-label="Go to parent directory">←</button>
        <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{currentDir || 'Open a folder to browse files'}</span>
      </div>
      <div className="flex-1 overflow-y-auto text-xs">
        {files.map((file) => {
          const isMarkdown = markdownExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
          return (
            <button key={file.path} onClick={() => void handleClick(file)} className={`w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-[var(--bg-hover)] truncate ${isMarkdown ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
              <span className="flex-shrink-0">{file.isDir ? '📁' : '📄'}</span>
              <span className="truncate">{file.name}</span>
            </button>
          );
        })}
        {files.length === 0 && <div className="px-3 py-2 text-[var(--text-tertiary)]">No folder selected</div>}
      </div>
    </div>
  );
}
