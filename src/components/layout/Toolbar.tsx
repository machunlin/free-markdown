import { useCallback, useEffect } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSearchStore } from '../../stores/searchStore';
import { openFile, saveFile, showSaveDialog } from '../../core/ipc/commands';
import type { ReactElement } from 'react';
import type { AppearanceMode } from '../../types';

const appearanceLabels: Record<AppearanceMode, string> = {
  system: '跟随系统',
  light: '浅色外观',
  dark: '深色外观',
};

export function Toolbar() {
  const createNewTab = useFileStore((state) => state.createNewTab);
  const mode = useEditorStore((state) => state.mode);
  const setMode = useEditorStore((state) => state.setMode);
  const appearance = useThemeStore((state) => state.appearance);
  const setAppearance = useThemeStore((state) => state.setAppearance);
  const openSearch = useSearchStore((state) => state.open);

  const handleOpen = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mkd', 'mdown', 'txt'] }],
      });
      if (typeof selected === 'string') {
        const result = await openFile(selected);
        useFileStore.getState().openFile(result.path, result.content, result.encoding);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, []);

  const saveCurrentTab = useCallback(async (forceSaveAs = false) => {
    const store = useFileStore.getState();
    const tab = store.getActiveTab();
    if (!tab) return;
    try {
      const path = !forceSaveAs && tab.path
        ? tab.path
        : await showSaveDialog({ defaultPath: tab.title });
      if (!path) return;
      await saveFile({ path, content: tab.content, encoding: tab.encoding || 'UTF-8' });
      if (path !== tab.path) store.updateTabPath(tab.id, path);
      store.markTabClean(tab.id, tab.content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, []);

  useEffect(() => {
    const handleSave = () => { void saveCurrentTab(); };
    const handleSaveAs = () => { void saveCurrentTab(true); };
    const handleOpenEvent = () => { void handleOpen(); };
    window.addEventListener('freemarkdown:save', handleSave);
    window.addEventListener('freemarkdown:save-as', handleSaveAs);
    window.addEventListener('freemarkdown:open', handleOpenEvent);
    return () => {
      window.removeEventListener('freemarkdown:save', handleSave);
      window.removeEventListener('freemarkdown:save-as', handleSaveAs);
      window.removeEventListener('freemarkdown:open', handleOpenEvent);
    };
  }, [handleOpen, saveCurrentTab]);

  const cycleAppearance = useCallback(() => {
    const modes: AppearanceMode[] = ['system', 'light', 'dark'];
    const index = modes.indexOf(appearance);
    setAppearance(modes[(index + 1) % modes.length] ?? 'system');
  }, [appearance, setAppearance]);

  return (
    <div className="app-toolbar drag-region">
      <div className="toolbar-brand">FM</div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <ToolbarButton label="新建文件" shortcut="⌘N" icon="file-plus" onClick={() => createNewTab()} />
        <ToolbarButton label="打开文件" shortcut="⌘O" icon="folder-open" onClick={() => void handleOpen()} />
        <ToolbarButton label="保存文件" shortcut="⌘S" icon="floppy-disk" onClick={() => void saveCurrentTab()} />
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <ToolbarButton label="源码模式" shortcut="⌘1" icon="code" active={mode === 'source'} onClick={() => setMode('source')} />
        <ToolbarButton label="预览模式" shortcut="⌘2" icon="eye" active={mode === 'preview'} onClick={() => setMode('preview')} />
        <ToolbarButton label="分屏模式" shortcut="⌘3" icon="columns" active={mode === 'split'} onClick={() => setMode('split')} />
      </div>
      <div className="flex-1" />
      <ToolbarButton label="搜索文档" shortcut="⌘F" icon="search" onClick={openSearch} />
      <ToolbarButton label={appearanceLabels[appearance]} shortcut="⌘⌥T" icon={appearance} onClick={cycleAppearance} />
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  shortcut: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, shortcut, icon, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      aria-label={`${label}（${shortcut}）`}
      title={`${label}（${shortcut}）`}
      onClick={onClick}
      className={`toolbar-btn ${active ? 'toolbar-btn-active' : ''}`}
    >
      <ToolbarIcon name={icon} />
      <span className="toolbar-btn-label">{label}</span>
    </button>
  );
}

function ToolbarIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<string, ReactElement> = {
    'file-plus': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 11v6M9 14h6" /></>,
    'folder-open': <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="m3 15 2-5h16" /></>,
    'floppy-disk': <><path d="M4 3h13l3 3v15H4z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    system: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    dark: <><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.code}</svg>;
}
