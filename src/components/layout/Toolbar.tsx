import { Icon } from '@iconify/react';
import { useCallback, useEffect } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSearchStore } from '../../stores/searchStore';
import { openFile, saveFile, showSaveDialog } from '../../core/ipc/commands';
import type { AppearanceMode } from '../../types';

const appearanceLabels: Record<AppearanceMode, string> = {
  system: '跟随系统',
  light: '浅色外观',
  dark: '深色外观',
};

const appearanceIcons: Record<AppearanceMode, string> = {
  system: 'ph:desktop',
  light: 'ph:sun',
  dark: 'ph:moon',
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

  const handleSave = useCallback(async () => {
    const store = useFileStore.getState();
    const tab = store.getActiveTab();
    if (!tab) return;
    try {
      const path = tab.path ?? await showSaveDialog({ defaultPath: tab.title });
      if (!path) return;
      await saveFile({ path, content: tab.content, encoding: tab.encoding || 'UTF-8' });
      if (path !== tab.path) store.updateTabPath(tab.id, path);
      store.markTabClean(tab.id, tab.content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, []);

  useEffect(() => {
    const handleSaveEvent = () => { void handleSave(); };
    window.addEventListener('freemarkdown:save', handleSaveEvent);
    return () => window.removeEventListener('freemarkdown:save', handleSaveEvent);
  }, [handleSave]);

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
        <ToolbarButton label="新建文件" shortcut="⌘N" icon="ph:file-plus" onClick={() => createNewTab()} />
        <ToolbarButton label="打开文件" shortcut="⌘O" icon="ph:folder-open" onClick={() => void handleOpen()} />
        <ToolbarButton label="保存文件" shortcut="⌘S" icon="ph:floppy-disk" onClick={() => void handleSave()} />
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <ToolbarButton label="源码模式" shortcut="⌘1" icon="ph:code" active={mode === 'source'} onClick={() => setMode('source')} />
        <ToolbarButton label="预览模式" shortcut="⌘2" icon="ph:eye" active={mode === 'preview'} onClick={() => setMode('preview')} />
        <ToolbarButton label="分屏模式" shortcut="⌘3" icon="ph:columns" active={mode === 'split'} onClick={() => setMode('split')} />
      </div>
      <div className="flex-1" />
      <ToolbarButton label="搜索文档" shortcut="⌘F" icon="ph:magnifying-glass" onClick={openSearch} />
      <ToolbarButton label={appearanceLabels[appearance]} shortcut="⌘⌥T" icon={appearanceIcons[appearance]} onClick={cycleAppearance} />
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
      <Icon icon={icon} width="20" height="20" aria-hidden="true" />
      <span className="toolbar-btn-label">{label}</span>
    </button>
  );
}
