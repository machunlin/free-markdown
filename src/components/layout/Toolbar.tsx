import { useCallback, useEffect } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSearchStore } from '../../stores/searchStore';
import { openFile, saveFile, showSaveDialog } from '../../core/ipc/commands';
import type { ThemeName } from '../../types';

export function Toolbar() {
  const createNewTab = useFileStore((state) => state.createNewTab);
  const mode = useEditorStore((state) => state.mode);
  const setMode = useEditorStore((state) => state.setMode);
  const currentTheme = useThemeStore((state) => state.current);
  const setTheme = useThemeStore((state) => state.setTheme);
  const openSearch = useSearchStore((state) => state.open);

  const handleNew = useCallback(() => createNewTab(), [createNewTab]);
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
      let path = tab.path;
      if (!path) path = await showSaveDialog({ defaultPath: tab.title });
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

  const cycleTheme = useCallback(() => {
    const themes: ThemeName[] = ['office', 'night', 'programmer'];
    const index = themes.indexOf(currentTheme);
    setTheme(themes[(index + 1) % themes.length] ?? 'office');
  }, [currentTheme, setTheme]);

  const themeLabel: Record<ThemeName, string> = {
    office: '☀️', night: '🌙', programmer: '💻',
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface)] border-b border-[var(--border)] h-8 flex-shrink-0">
      <span className="text-sm font-semibold mr-2 text-[var(--accent)]">FM</span>
      <div className="w-px h-4 bg-[var(--separator)]" />
      <button aria-label="New file" onClick={handleNew} className="toolbar-btn" title="New (⌘N)">＋</button>
      <button aria-label="Open file" onClick={handleOpen} className="toolbar-btn" title="Open (⌘O)">⌑</button>
      <button aria-label="Save file" onClick={() => void handleSave()} className="toolbar-btn" title="Save (⌘S)">▣</button>
      <div className="w-px h-4 bg-[var(--separator)]" />
      <button aria-label="Source mode" onClick={() => setMode('source')} className={`toolbar-btn ${mode === 'source' ? 'text-[var(--accent)]' : ''}`} title="Source (⌘1)">≡</button>
      <button aria-label="Preview mode" onClick={() => setMode('preview')} className={`toolbar-btn ${mode === 'preview' ? 'text-[var(--accent)]' : ''}`} title="Preview (⌘2)">◉</button>
      <button aria-label="Split mode" onClick={() => setMode('split')} className={`toolbar-btn ${mode === 'split' ? 'text-[var(--accent)]' : ''}`} title="Split (⌘3)">▥</button>
      <div className="flex-1" />
      <button aria-label="Search document" onClick={openSearch} className="toolbar-btn" title="Search (⌘F)">⌕</button>
      <button aria-label="Switch theme" onClick={cycleTheme} className="toolbar-btn text-sm" title="Switch theme (⌘⌥T)">{themeLabel[currentTheme]}</button>
    </div>
  );
}
