import { useEffect, useRef } from 'react';
import type { EditorState } from '@codemirror/state';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useThemeStore } from '../../stores/themeStore';
import { EditorCore } from '../../editor/EditorCore';

export function EditorPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorCore | null>(null);
  const statesRef = useRef<Map<string, EditorState>>(new Map());
  const currentIdRef = useRef<string | null>(null);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const updateTabContent = useFileStore((state) => state.updateTabContent);
  const updateTabCursor = useFileStore((state) => state.updateTabCursor);
  const updateTabScroll = useFileStore((state) => state.updateTabScroll);
  const appearance = useThemeStore((state) => state.appearance);
  const theme = useThemeStore((state) => state.current);
  const fontSize = useEditorStore((state) => state.fontSize);
  const fontFamily = useEditorStore((state) => state.fontFamily);
  const showLineNumbers = useEditorStore((state) => state.showLineNumbers);
  const wordWrap = useEditorStore((state) => state.wordWrap);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    const savedStates = statesRef.current;
    const editor = new EditorCore({
      parent,
      initialValue: activeTab?.content ?? '',
      dark: appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
      fontSize,
      fontFamily,
      lineNumbers: showLineNumbers,
      wordWrap,
      onUpdate: (content) => {
        const id = currentIdRef.current;
        if (id) updateTabContent(id, content);
      },
      onCursorChange: (line, column) => {
        const id = currentIdRef.current;
        if (id) updateTabCursor(id, line, column);
      },
      onScroll: (scrollTop) => {
        const id = currentIdRef.current;
        if (id) updateTabScroll(id, scrollTop);
      },
    });
    editorRef.current = editor;
    currentIdRef.current = activeTabId;

    return () => {
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
    if (savedState) {
      editor.setState(savedState);
    } else {
      editor.setValue(activeTab.content);
      editor.setScrollTop(activeTab.scrollPosition);
    }
    currentIdRef.current = activeTabId;
  }, [activeTabId, activeTab]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setDark(appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }, [appearance, theme]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden bg-[var(--editor-bg)]" />;
}
