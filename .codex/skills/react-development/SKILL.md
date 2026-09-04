# React Development Skill

## When to Use

Load this skill when working on:
- React components in `src/components/`
- Custom hooks in `src/hooks/`
- Zustand stores in `src/stores/`
- TypeScript types
- Vite build configuration
- Frontend utility functions
- Frontend IPC wrappers

## React 19 + TypeScript Patterns

### Component Template

```tsx
import { useState, useCallback, useMemo } from 'react';

interface EditorPaneProps {
  fileId: string;
  initialContent: string;
  encoding: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

export function EditorPane({
  fileId,
  initialContent,
  encoding,
  onContentChange,
  onSave,
}: EditorPaneProps) {
  const [content, setContent] = useState(initialContent);

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange(newContent);
  }, [onContentChange]);

  return (
    <div className="flex-1 h-full">
      {/* Component body */}
    </div>
  );
}
```

### Component Rules

1. **Functional components with hooks only** — no class components
2. **Define Props interface** for every component that accepts props
3. **Named exports** (`export function ComponentName`), not `export default`
4. **Destructure props** in the function signature
5. **Use `useCallback`** for event handlers passed to child components
6. **Use `useMemo`** for expensive computations (reference types, heavy calculations)
7. **No inline anonymous functions in JSX** for list items or frequently re-rendered components — extract to useCallback

### Custom Hooks

```tsx
// src/hooks/useAutoSave.ts
import { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface UseAutoSaveOptions {
  tabId: string;
  content: string;
  isDirty: boolean;
  saveInterval?: number; // ms
}

export function useAutoSave({
  tabId,
  content,
  isDirty,
  saveInterval = 30000, // default 30s
}: UseAutoSaveOptions) {
  const saveFile = useWorkspaceStore(state => state.saveFile);
  const lastSaveRef = useRef<number>(Date.now());
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const save = useCallback(async () => {
    if (isDirty) {
      await saveFile(tabId, contentRef.current);
      lastSaveRef.current = Date.now();
    }
  }, [tabId, isDirty, saveFile]);

  useEffect(() => {
    const interval = setInterval(save, saveInterval);
    return () => clearInterval(interval);
  }, [save, saveInterval]);

  return { save };
}
```

### Zustand Store Pattern

```tsx
// src/stores/workspace-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Tab {
  id: string;
  path: string | null; // null = new unsaved file
  title: string;
  content: string;
  originalContent: string; // for dirty detection
  encoding: string;
  isDirty: boolean;
  cursor: { line: number; column: number };
  scrollPosition: number;
  historyIndex: number;
}

interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string | null;
  recentFiles: string[];

  // Actions
  openFile: (path: string) => Promise<void>;
  createNewTab: () => void;
  closeTab: (id: string) => Promise<void>;
  saveTab: (id: string) => Promise<void>;
  saveTabAs: (id: string) => Promise<void>;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools((set, get) => ({
    tabs: [],
    activeTabId: null,
    recentFiles: [],

    openFile: async (path: string) => {
      // Call Rust command
      const result = await invoke<FileContent>('open_file', { path });
      const newTab: Tab = {
        id: generateTabId(),
        path: result.path,
        title: path.split('/').pop() || 'Untitled',
        content: result.content,
        originalContent: result.content,
        encoding: result.encoding,
        isDirty: false,
        cursor: { line: 0, column: 0 },
        scrollPosition: 0,
        historyIndex: -1,
      };
      set(state => ({
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      }));
    },

    createNewTab: () => {
      const newTab: Tab = {
        id: generateTabId(),
        path: null,
        title: 'Untitled',
        content: '',
        originalContent: '',
        encoding: 'UTF-8',
        isDirty: false,
        cursor: { line: 0, column: 0 },
        scrollPosition: 0,
        historyIndex: -1,
      };
      set(state => ({
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      }));
    },

    closeTab: async (id: string) => {
      const { tabs, activeTabId } = get();
      const tab = tabs.find(t => t.id === id);
      if (tab?.isDirty) {
        // Show save dialog
      }
      const newTabs = tabs.filter(t => t.id !== id);
      let newActiveId = activeTabId;
      if (activeTabId === id) {
        const index = tabs.findIndex(t => t.id === id);
        newActiveId = newTabs[Math.min(index, newTabs.length - 1)]?.id ?? null;
      }
      set({ tabs: newTabs, activeTabId: newActiveId });
    },

    saveTab: async (id: string) => {
      // Implementation
    },

    saveTabAs: async (id: string) => {
      // Implementation
    },

    setActiveTab: (id: string) => {
      set({ activeTabId: id });
    },

    updateTabContent: (id: string, content: string) => {
      set(state => ({
        tabs: state.tabs.map(t =>
          t.id === id
            ? { ...t, content, isDirty: content !== t.originalContent }
            : t
        ),
      }));
    },

    reorderTabs: (fromIndex: number, toIndex: number) => {
      set(state => {
        const newTabs = [...state.tabs];
        const [removed] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, removed);
        return { tabs: newTabs };
      });
    },
  }))
);
```

### IPC Wrappers

```tsx
// src/core/ipc/commands.ts
import { invoke } from '@tauri-apps/api/core';

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  modified: number; // timestamp
}

export interface SaveOptions {
  path: string;
  content: string;
  encoding: string;
}

export const ipc = {
  openFile: (path: string) =>
    invoke<FileContent>('open_file', { path }),

  saveFile: (options: SaveOptions) =>
    invoke<void>('save_file', options),

  saveFileAs: (options: SaveOptions) =>
    invoke<string>('save_file_as', options),

  detectEncoding: (path: string) =>
    invoke<{ encoding: string; confidence: number }>('detect_encoding', { path }),

  readDirectory: (path: string) =>
    invoke<Array<{ name: string; path: string; isDir: boolean }>>('read_directory', { path }),

  watchFile: (path: string) =>
    invoke<void>('watch_file', { path }),

  unwatchFile: (path: string) =>
    invoke<void>('unwatch_file', { path }),
} as const;
```

### Styling with Tailwind

```tsx
// Good: semantic, macOS-native looking
<div className="flex items-center h-12 px-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">

// Avoid: custom inline styles, non-standard colors
// Bad:
<div style={{ backgroundColor: '#f0f0f0', height: '50px' }}>
```

**Design tokens:** Use CSS variables for theme colors (defined in `src/themes/`):
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #fafafa;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --accent: #007aff;
  --border: #d2d2d7;
}

.dark {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3a3a3a;
  --text-primary: #f5f5f7;
  --text-secondary: #a1a1a6;
  --accent: #0a84ff;
  --border: #3a3a3c;
}
```

Then use: `bg-[var(--bg-primary)] text-[var(--text-primary)]`

### File Organization

```
src/
├── main.tsx                    # Entry: ReactDOM.createRoot
├── App.tsx                     # Root component, layout
├── app/
│   ├── providers.tsx           # All context providers
│   └── tauri-init.ts           # Tauri initialization, event listeners
├── components/
│   ├── editor/
│   │   ├── CodeMirrorEditor.tsx
│   │   ├── EditorGutter.tsx
│   │   └── useCodeMirror.ts    # CM6 hook
│   ├── preview/
│   │   ├── MarkdownPreview.tsx
│   │   ├── MermaidBlock.tsx
│   │   ├── MathBlock.tsx
│   │   └── CodeBlock.tsx
│   ├── tabs/
│   │   ├── TabBar.tsx
│   │   ├── TabItem.tsx
│   │   └── useTabDrag.ts
│   ├── toolbar/
│   │   ├── Toolbar.tsx
│   │   └── ToolbarButton.tsx
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── FileExplorer.tsx
│   │   └── Outline.tsx
│   ├── statusbar/
│   │   └── StatusBar.tsx
│   ├── dialogs/
│   │   ├── SaveDialog.tsx
│   │   ├── EncodingDialog.tsx
│   │   └── SettingsDialog.tsx
│   ├── command-palette/
│   │   └── CommandPalette.tsx
│   └── ui/                     # Base primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Dialog.tsx
│       └── Dropdown.tsx
├── hooks/
├── stores/
├── core/
│   ├── markdown/               # markdown-it config, plugins
│   ├── encoding/               # Frontend encoding utilities
│   ├── ipc/                    # Tauri invoke wrappers + types
│   └── keyboard/               # Shortcut definitions
├── themes/
│   ├── light.css
│   ├── dark.css
│   └── tokens.css
├── styles/
│   ├── globals.css
│   └── markdown-preview.css
└── types/
    └── index.ts
```

### Key Frontend Libraries

- `@tauri-apps/api: 2` — Tauri 2 API
- `@tauri-apps/plugin-dialog: 2` — Native dialogs
- `@tauri-apps/plugin-fs: 2` — Scoped filesystem (use primarily via custom commands)
- `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown` — CodeMirror 6
- `@codemirror/theme-one-dark` — Dark theme for CM
- `markdown-it` — Markdown parser
- `markdown-it-katex` — KaTeX plugin (or custom)
- `markdown-it-anchor` — Header anchors
- `markdown-it-toc-done-right` — Table of contents
- `shiki` — Code highlighting (use via CDN/bundled grammars)
- `katex` — Math rendering
- `mermaid` — Diagrams (lazy load)
- `dompurify` — HTML sanitization for preview
- `zustand` — State management
- `@iconify/react` — Icons
- `clsx` or `tailwind-merge` — Class name utilities

## Checklist Before Committing React Code

- [ ] `tsc --noEmit` passes with zero errors
- [ ] No `any` types without justification
- [ ] Props interfaces defined for all components
- [ ] useEffect/useMemo/useCallback have correct dependency arrays
- [ ] No direct mutation of state objects
- [ ] No `index` as key for dynamic lists
- [ ] Event handlers use `useCallback` when passing to children
- [ ] Tailwind classes used (no inline styles unless dynamic)
- [ ] CSS variables used for theme colors
- [ ] Accessibility: buttons have aria-labels, proper semantic HTML
- [ ] Loading states and error states handled for async operations
- [ ] Console.log removed
