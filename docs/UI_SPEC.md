# FreeMarkdown UI Specification

> Last updated: 2026-09-03

## Design System

See the `ui-design` skill for detailed tokens and patterns. This document specifies the layout and component structure.

## Window Structure

### Default Window Dimensions

- Default size: 1200 × 800
- Minimum size: 640 × 480
- Opens centered on screen

### Layout Zones

```
┌─────────────────────────────────────────────────────────────────┐
│ ○ ○ ○  [Toolbar — unified titlebar/toolbar]                     │ ← 52px
├────────┬────────────────────────────────────────────────────────┤
│        │ [Tab Bar]                                               │ ← 38px
│        ├────────────────────────────────────────────────────────┤
│ Side-  │                                                        │
│ bar    │  Editor / Preview / Split View                         │
│ (240px)│                                                        │
│        │                                                        │
│        │                                                        │
│        │                                                        │
├────────┴────────────────────────────────────────────────────────┤
│ [Status Bar]                                                     │ ← 24px
└─────────────────────────────────────────────────────────────────┘
```

## Toolbar (52px height)

Toolbar uses Tauri transparent titlebar with `data-tauri-drag-region` for window dragging.

Left section:
- Sidebar toggle button
- Separator
- Formatting buttons: Bold, Italic, Strikethrough, Heading, Link, Image, Code, List, Table, Quote, Horizontal Rule
- Separator
- View mode toggle (Source / Split / Preview / Focus)

Center/Right section:
- Spacer (flex-1)
- Share button
- (Optional: word count display in V1.0+)

Button style: 28×28px icon buttons, rounded 5px, hover background. Text labels optional.

## Tab Bar (38px height)

- Tabs are horizontally scrollable when many are open
- Each tab: minimum 120px width, maximum 240px width, 32px height, top-rounded corners
- Active tab: more prominent background (white/light-gray-elevated), text primary color
- Inactive tab: muted background, text secondary color
- Dirty indicator: dot (●) before title when unsaved
- Close button (×): appears on hover, 20px circle
- "+" button at end: creates new tab
- Tab tooltip shows full file path on hover
- Right-click context menu: Close, Close Others, Close Right, Reveal in Finder

## Sidebar (240px width, resizable)

Toggle with ⌘⇧S. Resizable by dragging the divider. Hidden by default for new users (V0.1 default: visible? Decide during UX testing).

Sections:
1. **Quick access** (top): Recent files, Open folder
2. **Separator**
3. **Outline** section (header + outline tree, auto-generated from current tab's Markdown headings)
4. **File explorer** (when a folder is opened, replaces outline or shown in another section)

Style: macOS source list (vibrant/translucent background, SF font, blue selection).

## Editor Area

### Source Mode
- CodeMirror 6 editor
- Line numbers in gutter (configurable)
- Current line highlighting
- Word wrap: configurable (on/off)
- Font: monospace (SF Mono)
- Tab size: configurable (default 4 spaces)
- Line height: 1.6

### Preview Mode
- markdown-it rendered HTML
- Content width: max 740px, centered
- Padding: 40px top/bottom, 48px left/right
- Font: system proportional font with CJK fallback
- Font size: 15px
- Line height: 1.7

### Split Mode
- Side-by-side (left: source, right: preview)
- Resizable divider
- Scroll sync (optional, can be toggled)
- Default split: 50/50

### Focus Mode
- Hides sidebar, toolbar (auto-hide), tab bar
- Editor centered with max-width constraints
- Minimal UI for distraction-free writing
- ⌘4 to toggle, Esc to exit

## Status Bar (24px height)

Left to right:
1. Cursor position: "Ln X, Col Y"
2. (If file) Encoding: "UTF-8" (clickable to change encoding)
3. Line endings: "LF" / "CRLF" (V1.0+)
4. Separator/spacer
5. Word/character count (configurable)
6. Markdown compatibility mode: "GFM" / "Extended" (clickable to switch)
7. (Optional, right side) Preview toggle, zoom level

Style: 12px font, text secondary color, subtle top border.

## Dialogs

### Open File Dialog
- Uses native Tauri dialog (NOT HTML modal)
- File types: Markdown (.md, .markdown, .mkd, .mdown, .txt), All files

### Save Dialog
- Native save dialog
- Default filename: current tab title + .md extension
- Encoding selection dropdown in the dialog (or shown after save dialog)

### Unsaved Changes Dialog
When closing a dirty tab or window:
- Title: "Save changes to \"{filename}\"?"
- Message: "Your changes will be lost if you don't save them."
- Buttons: "Save" (default), "Don't Save", "Cancel"
- Style: Native macOS modal sheet

### Encoding Selection Dialog
When encoding detection confidence is low, or user wants to reopen with different encoding:
- List of supported encodings (UTF-8, GBK, GB18030, Big5, Shift_JIS, EUC-KR)
- Preview of decoded content (first few lines)
- "Reopen with Encoding" button, "Cancel"

### Settings Dialog
Tab-based settings panel:
1. General (auto-save, default encoding, recent files count)
2. Editor (font family, font size, line height, tab size, line numbers, word wrap)
3. Preview (compatibility mode, font, font size, line height, CSS path)
4. Theme (app theme, code highlight theme, dark/light mode)
5. Markdown (enable/disable extended syntax)
6. Shortcuts (keyboard shortcut customization, V1.0+)
7. About

Opens as a modal sheet or separate window (macOS convention: Preferences window).

## Command Palette (⌘⇧P)

Fuzzy-search palette (VS Code / Raycast style):
- Centered overlay
- Search input at top
- List of matching commands
- Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
- Commands: file operations, editor commands, view toggles, settings, etc.

## Empty States

### No File Open
- Centered icon (document icon in rounded rectangle)
- Heading: "No file open"
- Subtext: "Open a Markdown file or create a new document to start writing."
- Two buttons: "Open File" (primary), "New Document" (secondary)
- Shortcut hint: "Press ⌘O to open, ⌘N for new"

### Folder Opened (No File Selected)
- Sidebar shows file tree
- Main area shows: "Select a file to open" or "No files in this folder"

### Search Results Empty
- "No results for \"{query}\"" message

## Context Menus

### Editor Context Menu
Cut, Copy, Paste, Select All, —, Bold, Italic, Link, —, Reveal in Preview (if split mode)

### Tab Context Menu
Close Tab (⌘W)
Close Other Tabs
Close Tabs to the Right
—
Reveal in Finder
—
Copy Path

### Sidebar File Context Menu
Open, Open in New Tab, —, Rename, Delete (Move to Trash), —, Reveal in Finder, Copy Path

## Theme Application

### CSS Variables
All colors use CSS variables defined in `src/themes/tokens.css`. Theme switching is done by toggling a `.dark` class or a theme-specific class on `<html>` or `#root`.

### Three Preset Themes
Each theme defines its own set of CSS variables. For V0.1, implement:
1. **Office (办公)**: Default light, warm white, paper-like
2. **Night (夜间)**: Dark mode, warm dark tones, low blue light
3. **Programmer (程序员)**: Higher contrast, code-optimized, similar to Atom/VS Code themes

Theme preference is stored in settings. Each theme should have both light and dark variants, OR follow system appearance.

### CodeMirror Theme
CM6 theme must match the current app theme. Use `Compartment` to swap themes without rebuilding editor state.

### Preview Code Highlighting
Shiki themes must match: `github-light` for light themes, `github-dark` for dark themes.
