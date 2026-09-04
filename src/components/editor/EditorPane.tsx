import { useEffect, useRef, useState } from 'react';
import type { EditorState } from '@codemirror/state';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSearchStore } from '../../stores/searchStore';
import { EditorCore } from '../../editor/EditorCore';

interface ScrollDetail { source: 'editor' | 'preview'; ratio: number; }

export function EditorPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorCore | null>(null);
  const statesRef = useRef<Map<string, EditorState>>(new Map());
  const currentIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const scrollSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const updateTabContent = useFileStore((state) => state.updateTabContent);
  const updateTabCursor = useFileStore((state) => state.updateTabCursor);
  const updateTabScroll = useFileStore((state) => state.updateTabScroll);
  const appearance = useThemeStore((state) => state.appearance);
  const theme = useThemeStore((state) => state.current);
  const searchRequest = useSearchStore((state) => state.openRequest);
  const fontSize = useEditorStore((state) => state.fontSize);
  const fontFamily = useEditorStore((state) => state.fontFamily);
  const showLineNumbers = useEditorStore((state) => state.showLineNumbers);
  const wordWrap = useEditorStore((state) => state.wordWrap);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemDark(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    const savedStates = statesRef.current;
    const editor = new EditorCore({
      parent,
      initialValue: activeTab?.content ?? '',
      dark: appearance === 'dark' || (appearance === 'system' && systemDark),
      fontSize,
      fontFamily,
      lineNumbers: showLineNumbers,
      wordWrap,
      onUpdate: (content) => { if (currentIdRef.current) updateTabContent(currentIdRef.current, content); },
      onCursorChange: (line, column) => { if (currentIdRef.current) updateTabCursor(currentIdRef.current, line, column); },
      onScroll: (scrollTop) => {
        const id = currentIdRef.current;
        if (id) {
          if (scrollSaveRef.current) clearTimeout(scrollSaveRef.current);
          scrollSaveRef.current = setTimeout(() => updateTabScroll(id, scrollTop), 120);
        }
        if (!syncingRef.current && editorRef.current) {
          window.dispatchEvent(new CustomEvent<ScrollDetail>('freemarkdown:scroll', { detail: { source: 'editor', ratio: editorRef.current.getScrollRatio() } }));
        }
      },
    });
    editorRef.current = editor;
    currentIdRef.current = activeTabId;
    return () => {
      if (scrollSaveRef.current) clearTimeout(scrollSaveRef.current);
      if (currentIdRef.current) savedStates.set(currentIdRef.current, editor.getState());
      editor.destroy();
      editorRef.current = null;
      currentIdRef.current = null;
    };
    // The editor instance is intentionally created once for this pane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTabId || !activeTab || currentIdRef.current === activeTabId) return;
    if (currentIdRef.current) statesRef.current.set(currentIdRef.current, editor.getState());
    const savedState = statesRef.current.get(activeTabId);
    if (savedState) editor.setState(savedState);
    else { editor.setValue(activeTab.content); editor.setScrollTop(activeTab.scrollPosition); }
    currentIdRef.current = activeTabId;
  }, [activeTabId, activeTab]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && activeTab && editor.getValue() !== activeTab.content) editor.setValue(activeTab.content);
  }, [activeTab?.content, activeTab]);

  useEffect(() => {
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<ScrollDetail>).detail;
      if (detail.source !== 'preview' || !editorRef.current) return;
      syncingRef.current = true;
      editorRef.current.setScrollRatio(detail.ratio);
      requestAnimationFrame(() => { syncingRef.current = false; });
    };
    window.addEventListener('freemarkdown:scroll', onSync);
    return () => window.removeEventListener('freemarkdown:scroll', onSync);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) editor.setDark(appearance === 'dark' || (appearance === 'system' && systemDark));
  }, [appearance, theme, systemDark]);

  useEffect(() => {
    if (searchRequest > 0 && editorRef.current) editorRef.current.openSearchPanel();
  }, [searchRequest]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden bg-[var(--editor-bg)]" />;
}
