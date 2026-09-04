import { useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { openFile } from '../../core/ipc/commands';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSearchStore } from '../../stores/searchStore';
import { TabBar } from './TabBar';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { SplitPane } from './SplitPane';
import { EditorPane } from '../editor/EditorPane';
import { PreviewPane } from '../editor/PreviewPane';

export function MainWindow() {
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const mode = useEditorStore((state) => state.mode);
  const showSidebar = useEditorStore((state) => state.showSidebar);
  const applyTheme = useThemeStore((state) => state.applyTheme);
  const openSearch = useSearchStore((state) => state.open);

  useEffect(() => {
    if (useFileStore.getState().tabs.length === 0) useFileStore.getState().ensureWelcomeTab();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ id: string }>('menu-event', (event) => {
      const id = event.payload.id;
      const files = useFileStore.getState();
      const editor = useEditorStore.getState();
      const theme = useThemeStore.getState();
      if (id === 'file.new') files.createNewTab();
      else if (id === 'file.save') window.dispatchEvent(new CustomEvent('freemarkdown:save'));
      else if (id === 'file.open') window.dispatchEvent(new CustomEvent('freemarkdown:open'));
      else if (id === 'file.save-as') window.dispatchEvent(new CustomEvent('freemarkdown:save-as'));
      else if (id === 'file.close' && files.activeTabId) window.dispatchEvent(new CustomEvent('freemarkdown:close', { detail: { tabId: files.activeTabId } }));
      else if (id === 'edit.undo') window.dispatchEvent(new CustomEvent('freemarkdown:undo'));
      else if (id === 'edit.redo') window.dispatchEvent(new CustomEvent('freemarkdown:redo'));
      else if (id === 'edit.find' || id === 'edit.find-replace') openSearch();
      else if (id === 'view.source') editor.setMode('source');
      else if (id === 'view.preview') editor.setMode('preview');
      else if (id === 'view.split') editor.setMode('split');
      else if (id === 'view.toggle-sidebar') editor.toggleSidebar();
      else if (id === 'view.appearance-system') theme.setAppearance('system');
      else if (id === 'view.appearance-light') theme.setAppearance('light');
      else if (id === 'view.appearance-dark') theme.setAppearance('dark');
      else if (id.startsWith('view.theme-')) theme.setTheme(id.replace('view.theme-', '') as 'office' | 'night' | 'programmer');
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => { disposed = true; unlisten?.(); };
  }, [openSearch]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      for (const path of event.payload.paths ?? []) {
        if (!/\.(md|markdown|mkd|mdown|txt)$/i.test(path)) continue;
        void openFile(path).then((file) => useFileStore.getState().openFile(file.path, file.content, file.encoding))
          .catch((error: unknown) => console.error('Failed to open dropped file:', error));
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [applyTheme]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const mod = event.metaKey || event.ctrlKey;
    const files = useFileStore.getState();
    if (mod && event.key === 'n') { event.preventDefault(); files.createNewTab(); }
    else if (mod && event.key === 's') { event.preventDefault(); window.dispatchEvent(new CustomEvent('freemarkdown:save')); }
    else if (mod && event.key === 'o') { event.preventDefault(); window.dispatchEvent(new CustomEvent('freemarkdown:open')); }
    else if (mod && event.key === 'w' && files.activeTabId) { event.preventDefault(); window.dispatchEvent(new CustomEvent('freemarkdown:close', { detail: { tabId: files.activeTabId } })); }
    else if (mod && event.key === 'f') { event.preventDefault(); if (useEditorStore.getState().mode === 'preview') useEditorStore.getState().setMode('split'); useSearchStore.getState().open(); }
    else if (mod && event.key === '1') { event.preventDefault(); useEditorStore.getState().setMode('source'); }
    else if (mod && event.key === '2') { event.preventDefault(); useEditorStore.getState().setMode('preview'); }
    else if (mod && event.key === '3') { event.preventDefault(); useEditorStore.getState().setMode('split'); }
    else if (mod && event.key === '\\') { event.preventDefault(); useEditorStore.getState().toggleSidebar(); }
    else if (mod && event.altKey && event.key === 't') {
      event.preventDefault();
      const theme = useThemeStore.getState();
      const modes = ['system', 'light', 'dark'] as const;
      theme.setAppearance(modes[(modes.indexOf(theme.appearance) + 1) % modes.length] ?? 'system');
    } else if (mod && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const tabs = files.tabs;
      const index = tabs.findIndex((tab) => tab.id === files.activeTabId);
      if (index >= 0 && tabs.length > 1) {
        const next = event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : (index + 1) % tabs.length;
        files.setActiveTab(tabs[next]?.id ?? '');
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const showEditor = mode === 'source' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="drag-region h-7 flex-shrink-0" />
      <Toolbar />
      <TabBar />
      <div className="flex-1 flex min-h-0">
        {showSidebar && <Sidebar />}
        <div className="flex-1 flex min-w-0">
          {activeTab ? <SplitPane left={showEditor ? <EditorPane /> : null} right={showPreview ? <PreviewPane /> : null} defaultRatio={0.5} showDivider={showEditor && showPreview} /> : <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">FreeMarkdown</div>}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
