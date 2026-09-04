# FreeMarkdown

> Native macOS Markdown editor — free, open source, multi-encoding, CJK-friendly.

## About

FreeMarkdown is a modern Markdown editor for macOS designed for technical users (programmers, product managers, technical writers). Built with Tauri 2 and React, it combines native macOS performance with a polished editing experience.

**Status:** Early development (V0.1 Alpha in progress)

## Key Features

- **macOS native experience** — Native menus, dialogs, shortcuts, and window management (not a web app in a shell)
- **Markdown editing** — CodeMirror 6 source editor, markdown-it preview, Shiki syntax highlighting
- **Multi-encoding support** — UTF-8, GBK, GB18030, Big5, Shift-JIS, EUC-KR with auto-detection (V0.5)
- **CJK typography** — Chinese/Japanese/Korean font fallback and proper text rendering
- **Multi-tab editing** — Multiple open files with drag-reorder tabs
- **Themes** — Office, Night, and Programmer themes with Dark/Light mode
- **Math & diagrams** — KaTeX formulas and Mermaid diagrams (V0.5)
- **Export** — PDF and HTML export (V0.5)
- **Free and open source** — MIT license

## Tech Stack

- **Desktop framework:** Tauri 2
- **Frontend:** React 19 + TypeScript
- **Editor:** CodeMirror 6
- **Markdown:** markdown-it
- **Build tool:** Vite
- **State management:** Zustand
- **Styling:** Tailwind CSS 3
- **Backend:** Rust
- **Code highlighting:** Shiki
- **Math:** KaTeX
- **Diagrams:** Mermaid

## Development

### Prerequisites

- Node.js 22 LTS
- pnpm (`npm install -g pnpm`)
- Rust (stable) via `rustup`
- Xcode Command Line Tools (`xcode-select --install`)
- For Apple Silicon: `rustup target add aarch64-apple-darwin`

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode (Vite HMR + Tauri window)
pnpm tauri dev

# Run frontend tests
pnpm test

# Run backend tests
cargo test

# Build production app
pnpm tauri build
```

### Project Structure

```
FreeMarkdown/
├── AGENTS.md              # AI agent development constitution
├── docs/                  # Project documentation
│   ├── ARCHITECTURE.md
│   ├── UI_SPEC.md
│   ├── IPC_SPEC.md
│   ├── MARKDOWN_SPEC.md
│   ├── TESTING.md
│   ├── SECURITY.md
│   └── ROADMAP.md
├── src/                   # React frontend
├── src-tauri/             # Rust backend
└── .codex/skills/         # AI agent skills
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical architecture details.

## AI-Assisted Development

This project is designed for AI agent-assisted development. See [AGENTS.md](AGENTS.md) for the development constitution that all AI agents follow.

## License

MIT
