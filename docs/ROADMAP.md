# FreeMarkdown Development Roadmap

> Last updated: 2026-09-03

## Version Overview

```
V0.1 Alpha ──→ V0.5 Beta ──→ V1.0 ──→ V1.5 ──→ V2.0
 (MVP core)   (polish+CJK)  (WYSIWYG) (enhance)  (plugin ecosystem)
```

---

## V0.1 Alpha — MVP Core

**Goal:** A usable Markdown editor for programmers. Source mode + preview + file management + macOS native basics.

> Scope details: see `docs/RELEASE_SCOPE.md`. Mermaid is implemented in V0.5; V0.1 displays Mermaid fences as ordinary code. Typora is an interaction reference, not a full WYSIWYG compatibility target.

### P0 Features

| Module | Feature |
|---|---|
| M01 | Basic window layout (toolbar, tab bar, status bar) |
| M02 | Source editor (CodeMirror 6 with Markdown syntax) |
| M02 | Split preview mode (markdown-it render) |
| M03 | Multi-tab support (new, close, switch, dirty indicator) |
| M04 | 3 preset themes (Office light/night/programmer) with Dark/Light |
| M06 | CommonMark + GFM parsing (tables, strikethrough, task lists, autolinks) |
| M08 | Code syntax highlighting (Shiki) — key languages |
| M11 | File open/save (native dialogs), recent files |
| M16 | macOS native menu bar, keyboard shortcuts, Dark/Light mode, drag-drop files |
| M18 | Undo/Redo (CodeMirror history per tab) |

### Technical Milestones for V0.1

1. **Project bootstrap** — Tauri 2 + React + Vite + TypeScript + Tailwind setup
2. **Window shell** — Basic layout with toolbar, tab bar, editor area, status bar
3. **Editor core** — CodeMirror 6 integration, markdown language support
4. **Preview core** — markdown-it rendering with basic plugins, DOMPurify sanitization
5. **Tab system** — Zustand workspace store, tab management UI
6. **File IPC** — Rust commands for open/save, basic UTF-8 support
7. **Theme system** — CSS variables, 3 themes, light/dark toggle
8. **Native integration** — Menu bar, keyboard shortcuts, native dialogs
9. **Testing setup** — Vitest, cargo test, basic store/util tests

### What V0.1 Does NOT Include
- GBK/multi-encoding support (V0.5)
- KaTeX/Mermaid (V0.5)
- File watching / external change detection (V0.5)
- Export PDF/HTML (V0.5)
- Search (V0.5)
- Sidebar shell only (outline and file explorer are later milestones)
- WYSIWYG mode (V1.0)

---

## V0.5 Beta — Polished + CJK Support

**Goal:** Suitable for Chinese technical users as a daily driver.

### Additional Features

| Module | Feature |
|---|---|
| M07 | KaTeX math formulas |
| M07 | Mermaid diagrams (V0.5; V0.1 renders fenced Mermaid as ordinary code) |
| M08 | Extended code language support in Shiki |
| M11 | Multi-encoding support: GBK, GB18030, Big5, Shift-JIS, EUC-KR with auto-detection |
| M11 | CJK font fallback and typography |
| M12 | Document search and replace (⌘F, ⌘⌥F) |
| M13 | Export to PDF (native print dialog) |
| M13 | Export to HTML |
| M13 | Copy as HTML / plain text |
| M12 | Sidebar with Markdown outline (auto-generated heading navigation) |
| M17 | External file modification detection (file watcher) |
| M23 | Large file degradation strategy (10MB/50MB thresholds) |
| M14 | Word/character count in status bar |

---

## V1.0 — Release Quality

**Goal:** Full-featured release that can compete with established editors.

### Additional Features

| Module | Feature |
|---|---|
| M02 | WYSIWYG mode (CodeMirror decorations approach) |
| M02 | Focus/immersion writing mode |
| M03 | Multi-window support |
| M04 | Complete theme system (6 themes + separate code highlight themes) |
| M05 | Basic custom theme (color picker for accent color) |
| M09 | Image copy-paste with asset management |
| M12 | Global search across files (if a folder is open) |
| M19 | Command palette (⌘⇧P) |
| M15 | Full keyboard shortcut customization UI |
| M15 | Settings panel with all options |
| M16 | Auto-updates (Sparkle-like via Tauri updater plugin) |
| | Split view (same file side by side, V1.5?) |
| | E2E tests with Playwright |

---

## V1.5 — Enhanced

### Features
- Tab split (compare two files or same file side by side)
- Custom theme editor (full color customization)
- Theme import/export
- Version history (smart snapshots)
- Pomodoro timer (writing focus)
- Writing goals (word count targets)
- Markdown lint (M20)
- File diff view (M21)
- Document templates (M22)
- File explorer (sidebar for opened folder)
- Printing improvements

---

## V2.0 — Ecosystem

### Features
- Plugin API (allow third-party extensions)
- Plugin marketplace (not initially operated; API ready)
- Cross-platform release (Windows, Linux)
- Collaboration features (real-time — uncertain)
- iCloud/Dropbox sync (opt-in)

### Non-Goals (Permanently or Long-term)
- Mobile apps
- Cloud-only service / SaaS model
- DOCX import/export
- Note-taking with backlinks/Obsidian-style knowledge graph
- Full WYSIWYG parity with Typora; Typora is an interaction reference only (CodeMirror decorations is the chosen approach)

---

## Current Focus (Now — V0.1 Alpha)

### Immediate Task Sequence

1. **Infrastructure** (this current work — AI agent foundation)
   - AGENTS.md ✓
   - Skills (.codex/skills/) ✓
   - Documentation (docs/) ✓
   - Project config files (next)

2. **Project bootstrap**
   - Initialize Tauri 2 + Vite + React + TypeScript
   - Configure Tailwind CSS
   - Configure Vitest + ESLint + Prettier
   - Basic Rust project structure

3. **Application shell**
   - Window configuration (transparent titlebar, macOS)
   - Basic layout components (Toolbar, TabBar, StatusBar, Sidebar placeholder)
   - Zustand stores (workspace, editor, settings, theme)
   - Theme system (CSS variables, dark/light toggle)

4. **Editor core**
   - CodeMirror 6 setup with markdown language
   - Editor pane component
   - Undo/redo integration
   - Basic formatting keyboard shortcuts

5. **Preview core**
   - markdown-it with GFM plugins
   - Preview pane component
   - DOMPurify sanitization
   - Debounced rendering (200ms)
   - Shiki code highlighting (lazy)

6. **Tab system**
   - Tab bar UI (macOS style tabs)
   - Tab drag/drop reorder
   - Close/switch/create tabs
   - Dirty indicator
   - Keyboard navigation (⌘W, ⌃Tab, ⌘⌥1-9)

7. **File operations (UTF-8 first)**
   - Rust commands: open_file, save_file
   - Native open/save dialogs
   - Recent files persistence
   - Native menu bar (File, Edit, View, Window menus)

8. **Polish for V0.1**
   - Empty states
   - Error dialogs
   - Icon integration
   - App icons
   - Testing (stores, commands, components)
   - README and basic docs
