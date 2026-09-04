import { create } from 'zustand';
import type { EditorMode } from '../types';

interface EditorState {
  mode: EditorMode;
  showSidebar: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  fontSize: number;
  fontFamily: string;

  setMode: (mode: EditorMode) => void;
  toggleSidebar: () => void;
  setWordWrap: (wrap: boolean) => void;
  setShowLineNumbers: (show: boolean) => void;
  setTabSize: (size: number) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'split',
  showSidebar: true,
  wordWrap: true,
  showLineNumbers: true,
  tabSize: 4,
  fontSize: 14,
  fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',

  setMode: (mode) => set({ mode }),
  toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
  setWordWrap: (wordWrap) => set({ wordWrap }),
  setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
  setTabSize: (tabSize) => set({ tabSize }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
}));
