# FreeMarkdown Technical Architecture

> Last updated: 2026-09-03

## System Overview

FreeMarkdown is a desktop Markdown editor built with Tauri 2. The architecture follows a strict frontend/backend separation:

- **Frontend (React 19 + TypeScript):** Runs in a Tauri WebView. Handles all UI, editor interaction, preview rendering, tabs, themes, and state management.
- **Backend (Rust):** Native process. Handles file system access, encoding detection, file watching, native menus, window management, and system integration.
- **IPC (Tauri Commands/Events):** Typed bridge between frontend and backend.

```
┌──────────────────────────────────────────────────────────────┐
│                        macOS / Window Server                  │
├──────────────────────────────────────────────────────────────┤
│                    Tauri Runtime (Rust)                       │
│  ┌─────────────────┬──────────────────┬───────────────────┐ │
│  │ File Manager    │ Encoding Service │ File Watcher      │ │
│  │ (open/save/auto)│ (chardetng/enc_rs)│ (notify)          │ │
│  ├─────────────────┼──────────────────┼───────────────────┤ │
│  │ Window Manager  │ Native Menus     │ Dialogs           │ │
│  │ (tauri)         │ (menu bar)       │ (open/save/alert) │ │
│  └─────────────────┴──────────────────┴───────────────────┘ │
│                           │                                   │
│                    IPC Bridge (Commands/Events)              │
│                           │                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              WebView (React 19 + TypeScript)            │ │
│  │  ┌────────────┬────────────┬────────────────────────┐  │ │
│  │  │  CodeMirror│ markdown-it│  UI Components (React) │  │ │
│  │  │  (source)  │ (preview)  │  Tabs/Toolbar/Sidebar  │  │ │
│  │  ├────────────┴────────────┼────────────────────────┤  │ │
│  │  │ Zustand Stores          │  KaTeX/Mermaid/Shiki   │  │ │
│  │  │ (workspace/editor/      │  (rendering engines)   │  │ │
│  │  │  settings/theme)        │                        │  │ │
│  │  └─────────────────────────┴────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Layer Structure

```
src/
├── UI Layer (React components)
│   ├── App layout (window chrome, toolbar, sidebar, tabs, statusbar)
│   ├── Editor pane (CodeMirror wrapper)
│   ├── Preview pane (markdown-it renderer)
│   ├── Dialogs (settings, save confirmation, encoding selection)
│   └── Command palette
│
├── State Layer (Zustand)
│   ├── workspace-store: tabs, active tab, recent files
│   ├── editor-store: editor state per tab (cursor, scroll, undo)
│   ├── settings-store: user preferences
│   └── theme-store: current theme, dark/light mode
│
├── Core Logic (framework-agnostic)
│   ├── markdown: markdown-it configuration, plugins
│   ├── encoding: frontend encoding utilities
│   ├── ipc: TypeScript wrappers for Tauri commands
│   └── keyboard: keyboard shortcut definitions and handling
│
└── Infrastructure
    ├── themes: CSS variables, theme definitions
    ├── styles: global styles, Tailwind entry
    └── types: shared TypeScript types
```

### State Management

**Zustand** is used for global state. Design principles:

1. **Multiple small stores** instead of one giant store (workspace, editor, settings, theme).
2. **Granular selectors** — components select only the state they need.
3. **Actions are defined in the store** alongside state.
4. **Derived state** is computed via `useMemo`, not stored.

```ts
// Store relationships:
workspace-store
  ├── tabs: Tab[]              ← Tab state includes content, encoding, dirty flag
  ├── activeTabId: string
  ├── recentFiles: string[]
  └── Actions: openFile, createTab, closeTab, saveTab, switchTab, reorderTabs

editor-store (per active tab)
  ├── cursorPosition
  ├── scrollPosition
  ├── selections
  └── Actions: setCursor, setScroll, undo, redo

settings-store
  ├── editor settings (font size, tab size, line numbers, word wrap)
  ├── preview settings (compatibility mode, CSS path, etc.)
  ├── autoSave: boolean + interval
  └── theme

theme-store
  ├── currentTheme: 'office' | 'night' | 'programmer'
  ├── appearance: 'light' | 'dark' | 'system'
  └── Actions: setTheme, toggleDarkMode
```

### Editor Architecture

The editor uses **CodeMirror 6** for source mode. Each open tab has its own CodeMirror `EditorView` instance (when active). Inactive tabs may be hibernated (instance destroyed, content retained in state).

Key extensions:
- `@codemirror/lang-markdown`: Markdown syntax support
- `@codemirror/theme-one-dark` or custom CM theme matching app theme
- `@codemirror/commands`: Standard editing commands, undo history
- `@codemirror/search`: In-document search (⌘F)
- `@codemirror/autocomplete`: Bracket matching, future markdown autocomplete
- Custom keymap for macOS shortcuts and Markdown formatting

### Preview Architecture

Preview uses **markdown-it** as the parser. Rendering pipeline:

1. Content changes → debounce (200ms)
2. markdown-it parses Markdown → HTML string
3. DOMPurify sanitizes HTML
4. HTML injected into preview container
5. Lazy enhancement via requestIdleCallback:
   - Code blocks → Shiki highlighting
   - Math blocks → KaTeX rendering
   - Mermaid blocks → Mermaid rendering
   - Images → lazy loading

### IPC Communication

All backend access goes through typed wrappers in `src/core/ipc/commands.ts`. Direct use of `invoke()` outside this module is discouraged.

See `docs/IPC_SPEC.md` for the complete command specification.

## Backend Architecture (Rust)

### Module Structure

```
src-tauri/src/
├── main.rs            # Entry point, minimal — calls lib.run()
├── lib.rs             # App builder, command registration, state setup
├── commands/          # Tauri command handlers (thin, call services)
│   ├── fs.rs          # File open/save/read directory commands
│   ├── encoding.rs    # Encoding detection/conversion commands
│   ├── dialog.rs      # Native dialog wrapper commands
│   └── window.rs      # Window management commands
├── services/          # Business logic (called by commands)
│   ├── file_manager.rs   # File read/write/auto-save logic
│   ├── encoding_detector.rs  # chardetng wrapper
│   ├── file_watcher.rs   # Filesystem watcher (debounced)
│   └── recent_files.rs   # Recent files persistence
├── models/            # Serde-serializable data structures
│   ├── file.rs        # FileContent, FileInfo
│   └── error.rs       # AppError enum (thiserror)
└── menu.rs            # Native menu bar definition
```

### Key Services

**File Manager (`file_manager.rs`)**
- Opens files: reads raw bytes → detects encoding → decodes to UTF-8
- Saves files: encodes UTF-8 content to target encoding → writes
- Auto-save: debounced save at configurable interval
- Validates all paths before I/O operations

**Encoding Detector (`encoding_detector.rs`)**
- Wraps `chardetng` for encoding detection
- Returns encoding + confidence level
- Falls back to UTF-8 if confidence < threshold
- Supports: UTF-8, GBK, GB18030, Big5, Shift-JIS, EUC-KR

**File Watcher (`file_watcher.rs`)**
- Uses `notify` crate to watch opened files
- Debounces events (300ms) to handle editor temp-file patterns
- Emits Tauri events (`file-changed`) to frontend
- Frontend shows "file changed on disk, reload?" dialog

### Error Handling

All commands return `Result<T, AppError>`. `AppError` is a typed enum using `thiserror`:

```rust
pub enum AppError {
    FileNotFound(String),
    PermissionDenied(String),
    Io(String),
    EncodingDetectionFailed,
    InvalidPath(String),
    InvalidInput(String),
    Serialization(String),
    Tauri(String),
}
```

Errors are automatically serialized to strings for the frontend. The frontend maps errors to user-facing messages.

## Data Flow

### Opening a File

```
User: ⌘O → File dialog (native) → Select file
  │
  ▼
Frontend: ipc.openFile(path)
  │  invoke('open_file', { path })
  ▼
Backend: commands::fs::open_file(path)
  │  1. validate_path(path) — canonicalize, check for traversal
  │  2. file_manager.read_file(path)
  │     ├─ tokio::fs::read(path) → bytes
  │     ├─ encoding_detector.detect(bytes) → encoding + confidence
  │     ├─ If confidence < 0.8, return EncodingDetectionFailed (frontend asks user)
  │     └─ encoding.decode(bytes) → UTF-8 string
  │  3. file_watcher.watch(path)
  │  4. Return FileContent { path, content, encoding, modified, size }
  ▼
Frontend:
  │  1. Create new Tab object with content
  │  2. Add to workspace-store tabs
  │  3. Set active tab
  │  4. Initialize CodeMirror with content
  │  5. Add to recent files
  ▼
User sees file content in editor
```

### Typing in Editor

```
User types a character
  │
  ▼
CodeMirror: dispatches transaction
  │  updates document, fires updateListener
  ▼
Frontend: updateTabContent(tabId, newContent)
  │  1. Update Zustand store (content, isDirty = true)
  │  2. Trigger preview re-render (debounced 200ms)
  │  3. Reset auto-save timer
  ▼
[200ms later] Preview pane re-renders markdown
[30s later or on ⌘S] Auto-save or manual save → ipc.saveFile()
```

### External File Change

```
Another app modifies the file on disk
  │
  ▼
Backend: file_watcher detects change (via notify)
  │  Debounce 300ms
  │  Emit 'file-changed' event to frontend
  ▼
Frontend: event listener
  │  If current tab's file changed AND content is dirty:
  │    Show dialog: "File changed on disk. Reload? Your changes will be lost."
  │  If not dirty:
  │    Auto-reload and show toast "File reloaded from disk"
  ▼
User choice → reload or keep editing
```

## Build System

### Development

```bash
pnpm tauri dev
```

This starts:
1. Vite dev server (with HMR for frontend)
2. Tauri builds Rust backend and launches the app
3. Frontend connects to dev server for hot reload

### Production Build

```bash
pnpm tauri build
```

This produces:
- `.app` bundle for macOS (in `src-tauri/target/release/bundle/`)
- `.dmg` disk image
- Frontend is bundled into the binary (no external server)

### Build Pipeline

```
Frontend:                           Backend:
  TypeScript ──tsc──→ JS              Rust ──cargo──→ Binary
  JS/JSX ───Vite+esbuild──→ JS       (includes embedded frontend assets)
  CSS ──PostCSS+Tailwind──→ CSS
  All assets ──Vite──→ dist/ ──embedded into──→ Tauri binary
```

## Key Design Decisions

See PRD v3.0 Section 4 for full rationale. Summary:

| Decision | Choice | Rationale |
|---|---|---|
| Desktop framework | Tauri 2 | Small binary, Rust performance, web tech for editor, future cross-platform |
| Frontend framework | React 19 | Mature ecosystem, component model, CodeMirror integration |
| State management | Zustand | Lightweight, simple API, minimal boilerplate (vs Redux), supports devtools |
| Editor engine | CodeMirror 6 | Extensible, performant for large files, virtual scrolling, CM6 ecosystem |
| Markdown parser | markdown-it | Fast, CommonMark compliant, plugin architecture, widely used |
| Code highlighting | Shiki | VS Code quality themes, accurate, supports many languages |
| Math | KaTeX | Fast, no layout shift, widely used |
| Diagrams | Mermaid | De-facto standard for text-based diagrams |
| Encoding detection | chardetng | Rust port of uchardet, works well for CJK encodings, maintained by Mozilla |
| File watching | notify | Cross-platform Rust crate, macOS FSEvents backend |
| Styling | Tailwind CSS 3 | Fast development, consistent design tokens, small bundle |
| Build tool | Vite | Fast HMR, ESM-native, Tauri integration |
| Testing | Vitest + RTL | Vite-native, fast, compatible with Testing Library |
