import { useCallback, useEffect } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { listen } from '@tauri-apps/api/event';
import { openFile } from '../../core/ipc/commands';
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

  useEffect(() => {
    if (useFileStore.getState().tabs.length === 0) useFileStore.getState().ensureWelcomeTab();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenMenu: (() => void) | undefined;
    void listen<{ id: string }>('menu-event', (event) => {
      const id = event.payload.id;
      const fileStore = useFileStore.getState();
      const editorStore = useEditorStore.getState();
      const themeStore = useThemeStore.getState();
      if (id === 'file.new') fileStore.createNewTab();
      else if (id === 'file.save') window.dispatchEvent(new CustomEvent('freemarkdown:save'));
      else if (id === 'file.open') window.dispatchEvent(new CustomEvent('freemarkdown:open'));
      else if (id === 'view.source') editorStore.setMode('source');
      else if (id === 'view.preview') editorStore.setMode('preview');
      else if (id === 'view.split') editorStore.setMode('split');
      else if (id === 'view.toggle-sidebar') editorStore.toggleSidebar();
      else if (id === 'view.appearance-system') themeStore.setAppearance('system');
      else if (id === 'view.appearance-light') themeStore.setAppearance('light');
      else if (id === 'view.appearance-dark') themeStore.setAppearance('dark');
      else if (id === 'view.theme-office' || id === 'view.theme-night' || id === 'view.theme-programmer') {
        themeStore.setTheme(id.replace('view.theme-', '') as 'office' | 'night' | 'programmer');
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlistenMenu = dispose;
    });
    return () => {
      disposed = true;
      unlistenMenu?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenDrop: (() => void) | undefined;
    void listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      for (const path of event.payload.paths ?? []) {
        if (!/\.(md|markdown|mkd|mdown|txt)$/i.test(path)) continue;
        void openFile(path).then((file) => {
          useFileStore.getState().openFile(file.path, file.content, file.encoding);
        }).catch((error: unknown) => console.error('Failed to open dropped file:', error));
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlistenDrop = dispose;
    });
    return () => {
      disposed = true;
      unlistenDrop?.();
    };
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
    const fileStore = useFileStore.getState();
    if (mod && event.key === 'n') { event.preventDefault(); fileStore.createNewTab(); }
    if (mod && event.key === 's') { event.preventDefault(); window.dispatchEvent(new CustomEvent('freemarkdown:save')); }
    if (mod && event.key === 'w' && fileStore.activeTabId) { event.preventDefault(); fileStore.closeTab(fileStore.activeTabId); }
    if (mod && event.key === '1') { event.preventDefault(); useEditorStore.getState().setMode('source'); }
    if (mod && event.key === '2') { event.preventDefault(); useEditorStore.getState().setMode('preview'); }
    if (mod && event.key === '3') { event.preventDefault(); useEditorStore.getState().setMode('split'); }
    if (mod && event.key === '\\') { event.preventDefault(); useEditorStore.getState().toggleSidebar(); }
    if (mod && event.altKey && event.key === 't') {
      event.preventDefault();
      const theme = useThemeStore.getState();
      const modes = ['system', 'light', 'dark'] as const;
      const index = modes.indexOf(theme.appearance);
      theme.setAppearance(modes[(index + 1) % modes.length] ?? 'system');
    }
    if (mod && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const tabs = fileStore.tabs;
      const index = tabs.findIndex((tab) => tab.id === fileStore.activeTabId);
      if (index >= 0 && tabs.length > 1) {
        const next = event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : (index + 1) % tabs.length;
        fileStore.setActiveTab(tabs[next]?.id ?? tabs[index]?.id ?? '');
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
          {activeTab ? <SplitPane left={showEditor ? <EditorPane /> : null} right={showPreview ? <PreviewPane /> : null} defaultRatio={0.5} showDivider={showEditor && showPreview} /> : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]"><div className="text-center"><div className="text-4xl mb-4">📝</div><p className="text-lg mb-2">FreeMarkdown</p><p className="text-sm"><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-xs">⌘N</kbd> New File　<kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-xs">⌘O</kbd> Open File</p></div></div>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
