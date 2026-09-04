# FreeMarkdown — AGENTS.md

> This is the **development constitution** for FreeMarkdown. Every AI agent (Codex, Claude, or other LLM coding agents) working on this project MUST read and follow this file before writing any code.
>
> **Last updated:** 2026-09-03

---

## 0. Quick Reference

| Item | Value |
|---|---|
| Product | FreeMarkdown |
| Version | V0.1 Alpha → V0.5 Beta → V1.0 |
| Stack | Tauri 2 + React 19 + TypeScript + Rust |
| Editor Engine | CodeMirror 6 (source), markdown-it (preview) |
| Target | macOS 13 Ventura+, Apple Silicon primary, Intel compatible |
| License | MIT, free and open source |
| PRD | See `PRD-FreeMarkdown-v3.0.md` in project root |

---

## 1. Project Goal

FreeMarkdown is a **native macOS Markdown editor** for Chinese technical users (programmers, product managers, technical writers). It is NOT a web app wrapped in a native shell. It must feel, look, and behave like a proper macOS application.

Core differentiators (do NOT compromise these):

1. **macOS native experience** — native windows, menus, shortcuts, drag-and-drop, Dark/Light mode
2. **Markdown editing excellence** — CodeMirror 6 + markdown-it + KaTeX + Mermaid + Shiki
3. **Multi-encoding support** — UTF-8, GBK, GB18030, Big5, Shift-JIS, EUC-KR with auto-detection
4. **CJK typography** — Chinese/English mixed text, proper font fallback, punctuation
5. **Free and open source** — MIT license

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              Frontend (React 19 + TS)             │
│  ┌──────────┬──────────┬──────────┬────────────┐ │
│  │ Editor   │ Preview  │ UI Layer │ Tabs/State │ │
│  │ (CM6)    │ (md-it)  │ (React)  │ (Zustand)  │ │
│  └──────────┴──────────┴──────────┴────────────┘ │
├──────────────────────────────────────────────────┤
│          IPC Bridge (Tauri Commands/Events)       │
├──────────────────────────────────────────────────┤
│              Backend (Rust + Tauri 2)             │
│  ┌──────────┬──────────┬──────────┬────────────┐ │
│  │ File I/O │ Encoding │ Watcher  │ Window/Menu│ │
│  │ (fs)     │(chardetng)│(notify) │ (Tauri)    │ │
│  └──────────┴──────────┴──────────┴────────────┘ │
└──────────────────────────────────────────────────┘
```

**Responsibility boundary:**
- **React (Frontend):** All UI, editor interaction, preview rendering, tabs, themes, settings UI, search UI, command palette. Never touches filesystem directly except through Tauri commands.
- **Rust (Backend):** File system access, encoding detection/conversion, file watching, native menus, window management, clipboard, PDF printing, system integration. Never renders Markdown or manages UI state.
- **IPC:** Strictly defined commands. No ad-hoc commands. See `docs/IPC_SPEC.md`.

---

## 3. Tech Stack (Locked — Do Not Change Without Discussion)

### Frontend
| Library | Purpose | Locked |
|---|---|---|
| React 19 | UI framework | ✅ |
| TypeScript 5+ | Type safety | ✅ |
| Vite | Build tool / dev server | ✅ |
| Zustand | Global state management | ✅ (do NOT use Redux, Jotai, MobX) |
| CodeMirror 6 | Source editor engine | ✅ (do NOT use Monaco, ProseMirror for source mode) |
| markdown-it | Markdown parser/renderer for preview | ✅ (do NOT use marked, remark for preview) |
| Shiki | Code syntax highlighting | ✅ |
| KaTeX | Math formula rendering | ✅ |
| Mermaid | Diagram rendering | ✅ |
| Iconify | Icons | ✅ |
| Tailwind CSS 3 | Styling | ✅ |
| Vitest | Unit testing | ✅ |
| React Testing Library | Component testing | ✅ |
| Playwright | E2E testing (V1.0+) | ✅ |

### Backend
| Library | Purpose | Locked |
|---|---|---|
| Tauri 2 | Desktop framework | ✅ |
| tokio | Async runtime (via Tauri) | ✅ |
| chardetng | Encoding detection | ✅ |
| encoding_rs | Encoding conversion | ✅ |
| notify | File watching | ✅ |
| serde/serde_json | Serialization | ✅ |

---

## 4. Directory Structure

```
FreeMarkdown/
├── AGENTS.md                          ← THIS FILE (read first!)
├── PRD-FreeMarkdown-v3.0.md           ← Product requirements
├── README.md
├── CHANGELOG.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── .codex/
│   └── skills/                        ← AI agent skills (see .codex/skills/)
│       ├── tauri-development/
│       ├── react-development/
│       ├── markdown-editor/
│       ├── macos-native-ui/
│       ├── ui-design/
│       ├── testing/
│       ├── security-review/
│       ├── performance-review/
│       ├── code-review/
│       └── documentation/
├── docs/
│   ├── ARCHITECTURE.md               ← Technical architecture
│   ├── UI_SPEC.md                    ← UI/UX specifications
│   ├── IPC_SPEC.md                   ← IPC contract (frontend↔backend)
│   ├── MARKDOWN_SPEC.md              ← Markdown syntax support
│   ├── TESTING.md                    ← Testing strategy
│   ├── SECURITY.md                   ← Security guidelines
│   └── ROADMAP.md                    ← Development milestones
├── src/                              ← React frontend
│   ├── main.tsx                      ← Entry point
│   ├── App.tsx
│   ├── app/                          ← App initialization, providers
│   ├── components/                   ← Reusable UI components
│   │   ├── editor/                   ← Editor components (CM6)
│   │   ├── preview/                  ← Preview components (markdown-it)
│   │   ├── tabs/                     ← Tab bar, tab management
│   │   ├── toolbar/                  ← Toolbar components
│   │   ├── sidebar/                  ← Sidebar (file explorer, outline)
│   │   ├── statusbar/                ← Status bar
│   │   ├── dialogs/                  ← Modal dialogs
│   │   ├── command-palette/          ← Command palette (⌘⇧P)
│   │   └── ui/                       ← Base UI primitives
│   ├── hooks/                        ← Custom React hooks
│   ├── stores/                       ← Zustand stores
│   │   ├── workspace-store.ts        ← Workspace/tabs state
│   │   ├── editor-store.ts           ← Editor state
│   │   ├── settings-store.ts         ← Settings/preferences
│   │   └── theme-store.ts            ← Theme state
│   ├── core/                         ← Core logic (no React dependencies)
│   │   ├── markdown/                 ← Markdown parser config, plugins
│   │   ├── encoding/                 ← Encoding utilities (frontend side)
│   │   ├── ipc/                      ← Tauri invoke wrappers
│   │   └── keyboard/                 ← Keyboard shortcut definitions
│   ├── themes/                       ← CSS themes (3 preset + dark/light)
│   ├── styles/                       ← Global styles, Tailwind entry
│   ├── types/                        ← TypeScript type definitions
│   └── utils/                        ← Utility functions
├── src-tauri/                        ← Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/                 ← Tauri 2 capability files
│   ├── src/
│   │   ├── main.rs                   ← Entry point
│   │   ├── lib.rs
│   │   ├── commands/                 ← Tauri commands (IPC handlers)
│   │   │   ├── fs.rs                 ← File operations
│   │   │   ├── encoding.rs           ← Encoding detection/conversion
│   │   │   ├── dialog.rs             ← Native dialogs
│   │   │   └── window.rs             ← Window management
│   │   ├── services/                 ← Business logic
│   │   │   ├── file_manager.rs       ← File read/write/auto-save
│   │   │   ├── encoding_detector.rs  ← chardetng wrapper
│   │   │   ├── file_watcher.rs       ← notify wrapper
│   │   │   └── recent_files.rs       ← Recent files (SQLite/plaintext)
│   │   ├── models/                   ← Rust data structures
│   │   ├── error.rs                  ← Error types
│   │   └── menu.rs                   ← Native menu definitions
│   └── icons/                        ← App icons
└── public/                           ← Static assets
```

---

## 5. Coding Rules

### TypeScript / React

1. **Strict mode always.** `tsconfig.json` must have `strict: true`. No `any` without an explicit comment explaining why and a `// eslint-disable-next-line` justification.
2. **Functional components only.** No class components. Use hooks.
3. **Named exports** preferred over default exports. Default exports only for page-level components or when required by framework.
4. **Props interfaces.** Define a `Props` interface for every component.
5. **No prop drilling beyond 2 levels.** Use Zustand stores for shared state, or React Context for tree-scoped state.
6. **File naming:**
   - Components: `PascalCase.tsx` (e.g., `EditorPane.tsx`)
   - Hooks: `useXxx.ts` (e.g., `useEditor.ts`)
   - Stores: `xxx-store.ts` (e.g., `workspace-store.ts`)
   - Utils: `kebab-case.ts` (e.g., `debounce.ts`)
   - Types: `xxx-types.ts` or co-located in component files
7. **Imports order:** React/external → internal absolute paths → relative paths → types.
8. **CSS:** Use Tailwind utility classes for component styling. Use CSS modules (`*.module.css`) only for complex, dynamic styles or markdown preview styles. Theme variables go in `src/themes/`.
9. **No inline styles** (`style={{}}`) except for dynamic values that can't be expressed in CSS.
10. **Side effects in useEffect** must have dependency arrays and cleanup functions. Avoid infinite loops.
11. **Event handlers** named `handleXxx` for props, `onXxx` for prop callbacks.

### Rust / Tauri

1. **No `unwrap()` in production code.** Use `?`, `.expect("message")`, or proper error handling. `.unwrap()` is allowed only in tests, examples, or when the invariant is proven by logic and documented with a comment.
2. **Error handling:** Use `thiserror` for library errors, `anyhow` only in application binaries. Define custom error types in `error.rs`.
3. **Commands:** Every Tauri command must:
   - Take typed parameters (use serde)
   - Return `Result<T, AppError>`
   - Be registered in `lib.rs`
   - Have corresponding TypeScript types in `src/core/ipc/`
4. **Async by default for I/O.** All file operations use async Tauri fs APIs or tokio::fs.
5. **Capability-based security.** Define explicit capabilities in `src-tauri/capabilities/`. No wildcard permissions.
6. **No blocking operations on the main thread.** CPU-heavy work (encoding detection, large file parsing) must be async or spawn blocking.
7. **Logging:** Use `tracing` crate for structured logging. No `println!` in production.
8. **Safety:** Mark all `unsafe` blocks with a `// SAFETY:` comment explaining why it's safe.

### General

1. **Comments:** Explain *why*, not *what*. Code should be self-documenting for *what*.
2. **No dead code.** Remove unused imports, variables, functions. ESLint and clippy will enforce this.
3. **No commented-out code.** Delete it; git remembers.
4. **No TODO/FIXME without an issue reference:** `// TODO(#123): description`
5. **Dependencies:** Adding a new dependency requires justification in the commit message. Prefer small, well-maintained libraries.

---

## 6. UI / UX Rules

FreeMarkdown must feel like a **native macOS app**, not a website.

1. **macOS design language:** Follow Apple's Human Interface Guidelines. Use native menu bar, native dialogs (Tauri dialog plugin), native window controls.
2. **System integration:**
   - Support Dark Mode and Light Mode (follow system by default)
   - Support macOS full-screen (`^⌘F`)
   - Support Finder drag-and-drop (drop files onto dock icon or window)
   - Support Services menu integration
   - Support Quick Look (future)
3. **Fonts:**
   - UI: System font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text"`)
   - Editor code: `"SF Mono", Menlo, Monaco, Consolas, monospace`
   - Preview CJK: Proper CJK fallback chain (PingFang SC, Hiragino Sans GB, Microsoft YaHei, etc.)
4. **Spacing:** Use 4px grid. macOS standard spacing: 8px (small), 12px (medium), 16px (large), 24px (xlarge).
5. **Toolbar:** Standard macOS-style toolbar with icon buttons, not a web-style navbar.
6. **Sidebar:** Source list style (macOS translucent sidebar), not a web sidebar.
7. **Tabs:** Native-looking tab bar with close buttons, drag to reorder, dirty indicator (dot).
8. **Keyboard shortcuts:** Follow macOS conventions — ⌘ for primary, ⌥ for alternate, ⌃ for special. See PRD for shortcut list.
9. **Context menus:** Right-click menus for editor, tabs, sidebar.
10. **Touch Bar** (optional, future): Basic formatting controls.

**Forbidden UI patterns:**
- No web-style rounded buttons everywhere
- No bright/loud colors outside of accent color
- No animations longer than 200ms
- No custom scrollbars that look non-native
- No hover effects that don't match macOS behavior

---

## 7. Markdown Rules

See `docs/MARKDOWN_SPEC.md` for full specification. Key rules:

1. **Three compatibility layers:**
   - **Strict:** Pure CommonMark
   - **GFM:** GitHub Flavored Markdown (default)
   - **Extended:** GFM + KaTeX + Mermaid + TOC + footnotes + abbreviations
2. **Source mode** uses CodeMirror 6 with markdown language support.
3. **Preview mode** uses markdown-it with a defined plugin chain.
4. **No HTML sanitization bypass.** User-entered HTML in Markdown must be sanitized by default (configurable).
5. **Code blocks:** Shiki for highlighting; language detection for unlabeled blocks.
6. **Large files (>10MB):** Degradation strategy — disable preview, enable syntax-limited mode, lazy rendering.

---

## 8. Encoding Rules

This is a **P0 feature** for Chinese users.

1. **Internal representation:** All text in the editor is UTF-8.
2. **On file open:**
   - Read raw bytes
   - Detect encoding via `chardetng` (returns encoding + confidence)
   - If confidence < 0.8, prompt user to choose encoding
   - Decode to UTF-8
   - Store original encoding in tab state
3. **On file save:**
   - Encode from UTF-8 to original encoding (or user-selected encoding)
   - Write with BOM only if original file had BOM
4. **Supported encodings (V0.5):** UTF-8, GBK, GB18030, Big5, Shift-JIS, EUC-KR
5. **Encoding conversion:** User can "Save As" with a different encoding.
6. **NEVER use `std::fs::read_to_string()` directly** — it assumes UTF-8.

---

## 9. Security Rules

See `docs/SECURITY.md` for full specification. Key rules:

1. **Tauri capabilities:** Least-privilege principle. The WebView MUST NOT have blanket filesystem access.
2. **File access:** Only files/directories the user explicitly opens (via dialog or drag-drop) are accessible. Use Tauri's scoped filesystem APIs.
3. **IPC validation:** All inputs from frontend must be validated in Rust before use. Paths must be canonicalized and checked for traversal.
4. **External URLs:** Links in preview open in default browser, NOT in WebView. No `window.open()` to external sites.
5. **Shell execution:** No shell command execution from WebView. Do NOT enable the Tauri shell plugin unless absolutely necessary (and even then, scope it tightly).
6. **Content Security Policy:** Set a restrictive CSP in `tauri.conf.json`.
7. **Markdown HTML:** Sanitize raw HTML in Markdown previews by default. Use DOMPurify or a Rust sanitizer.

---

## 10. Performance Rules

FreeMarkdown must handle large files smoothly.

1. **No full re-parse on every keystroke.** Debounce preview rendering (100-300ms after last keystroke).
2. **Virtual scrolling** for large documents (CodeMirror 6 handles this natively; preview needs virtualization for long docs).
3. **Lazy loading** for Mermaid diagrams, images, KaTeX in preview.
4. **Web Workers** for heavy parsing work (markdown-it in a worker for large files).
5. **Memory:** Each tab's content is held in memory. Implement tab hibernation for >20 tabs.
6. **Performance targets:**
   - App cold start: < 1 second
   - File open (1MB markdown): < 200ms to editable
   - Keystroke latency: < 16ms (60fps)
   - Preview update (after debounce): < 100ms for typical files (<100KB)
   - Memory (idle, 5 tabs): < 200MB

---

## 11. Testing Rules

See `docs/TESTING.md` for full specification. Key rules:

1. **Every feature must have tests** before it is considered done.
2. **Frontend:** Unit tests (Vitest) for stores, hooks, utilities; component tests (React Testing Library) for complex components.
3. **Backend:** Rust unit tests and integration tests for all commands and services.
4. **Run tests before every commit.** CI will block PRs with failing tests.
5. **No console errors** in normal operation. Warnings must be justified.
6. **No Rust compiler warnings.** Clippy must pass.

---

## 12. Git Workflow

### Branch Structure

```
main (protected)
├── develop (integration branch)
├── feature/M01-ui-layout
├── feature/M02-editor-core
├── feature/M03-tabs
├── fix/bug-description
└── docs/topic
```

### Commit Convention (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `build`, `ci`, `revert`

**Scopes:** `editor`, `preview`, `tabs`, `fs`, `encoding`, `theme`, `ui`, `ipc`, `tauri`, `deps`

**Examples:**
```
feat(editor): add CodeMirror markdown syntax highlighting
fix(fs): handle GBK encoding detection for files without BOM
perf(preview): debounce markdown preview rendering to 200ms
test(tabs): add unit tests for tab drag-reorder logic
```

### Development Flow

1. Create feature branch from `develop`: `git checkout -b feature/Mxx-description develop`
2. Implement with frequent small commits
3. Write/update tests
4. Run full test suite + lint + clippy
5. Create PR → CI runs → code review (self-review using code-review skill first)
6. Merge to `develop` after approval
7. `develop` → `main` on release

---

## 13. Definition of Done

A feature is **NOT done** until ALL of these are checked:

- [ ] Feature implemented according to PRD/spec
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] Rust compiles with zero errors and zero warnings (`cargo build`, `cargo clippy`)
- [ ] Unit tests written and passing
- [ ] Integration tests added where applicable
- [ ] Manual testing on macOS (Dark mode and Light mode)
- [ ] No console errors in browser/WebView devtools
- [ ] No Rust warnings or panics
- [ ] Security reviewed (no new capabilities added without justification)
- [ ] Performance checked (no obvious regressions)
- [ ] IPC contract updated if new commands added
- [ ] Documentation updated (ARCHITECTURE.md, comments, README if needed)
- [ ] CHANGELOG.md updated
- [ ] Committed with conventional commit message

---

## 14. Forbidden Practices

These will be rejected in code review:

1. ❌ `any` type in TypeScript without explicit justification
2. ❌ `unwrap()` in Rust production code
3. ❌ Direct filesystem access from frontend (must go through Tauri commands)
4. ❌ Hardcoded paths or user directory assumptions
5. ❌ Assuming UTF-8 for file reading
6. ❌ Synchronous blocking I/O on the main thread (Rust)
7. ❌ Wildcard Tauri capabilities/permissions (`fs:default`, `shell:allow-execute`)
8. ❌ `eval()`, `new Function()`, `dangerouslySetInnerHTML` without sanitization
9. ❌ CSS `!important` unless absolutely necessary (document it)
10. ❌ `console.log()` in production code (use proper logging or remove)
11. ❌ Large dependencies added for small features (e.g., importing Lodash for one function)
12. ❌ Mutating React state directly (always use setState/immer)
13. ❌ Using `index` as React key for dynamic lists
14. ❌ Missing dependency arrays in useEffect/useMemo/useCallback
15. ❌ Magic numbers without named constants

---

## 15. How to Use Skills

Skills are in `.codex/skills/`. Each skill is loaded on demand based on the task:

| Skill | When to load |
|---|---|
| `tauri-development` | Working on Rust backend, Tauri commands, capabilities, Cargo.toml |
| `react-development` | Working on React components, hooks, state, TypeScript |
| `markdown-editor` | Working on CodeMirror editor, markdown-it preview, rendering plugins |
| `macos-native-ui` | Building UI that must feel native (menus, toolbar, sidebar, tabs, dialogs) |
| `ui-design` | Making design decisions about colors, spacing, typography, themes |
| `testing` | Writing tests, setting up test infrastructure, fixing test failures |
| `security-review` | Reviewing IPC commands, capabilities, file access, CSP |
| `performance-review` | Profiling, optimizing rendering, handling large files, virtualization |
| `code-review` | Before committing — review code quality, patterns, issues |
| `documentation` | Updating docs, README, CHANGELOG, code comments |

Before starting a task, identify which skills are relevant and read their `SKILL.md`.

---

## 16. Where to Look for Information

- **Product requirements:** `PRD-FreeMarkdown-v3.0.md` (root)
- **Technical architecture:** `docs/ARCHITECTURE.md`
- **IPC contract:** `docs/IPC_SPEC.md`
- **UI specifications:** `docs/UI_SPEC.md`
- **Markdown support:** `docs/MARKDOWN_SPEC.md`
- **Testing strategy:** `docs/TESTING.md`
- **Security guidelines:** `docs/SECURITY.md`
- **Development roadmap:** `docs/ROADMAP.md`

---

## 17. Agent Execution Protocol

When given a task, an AI agent should:

1. **Read this file** (AGENTS.md) first
2. **Read relevant skill files** from `.codex/skills/`
3. **Read relevant docs** from `docs/`
4. **Plan** the implementation before writing code
5. **Implement** following all rules in this file
6. **Test** — write and run tests
7. **Self-review** using the code-review skill checklist
8. **Verify** against the Definition of Done
9. **Commit** with conventional commit message

If you are unsure about something:
- Check the PRD
- Check relevant docs
- Check existing code patterns
- If still unsure, ASK — do not guess on architecture decisions

---

*This document is the law. When this file and code conflict, this file wins and the code should be fixed.*
