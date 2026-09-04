# UI Design Skill

## When to Use

Load this skill when making design decisions about:
- Color schemes and themes
- Typography (fonts, sizes, line heights, weights)
- Spacing and layout
- Component visual design (buttons, inputs, dialogs, tabs)
- Dark/Light mode colors
- Markdown preview styling
- Editor typography and styling
- Empty states
- Icon choices
- Animation and transitions
- The three preset themes (Office/办公, Night/夜间, Programmer/程序员)

## Design Philosophy

FreeMarkdown is a **macOS productivity app for writing**. The design should:

1. **Recede into the background.** The content is the star — the UI should get out of the way.
2. **Feel native.** Match macOS visual language (not web conventions, not Material Design, not Fluent).
3. **Optimize for long-form writing.** Comfortable reading, good contrast, no eye strain.
4. **Support CJK typography.** Chinese, Japanese, Korean text must look good.
5. **Provide 3 distinct user-selectable themes** that are internally consistent and polished.

## Typography System

### Font Families

```css
/* UI elements (menus, toolbar, sidebar, dialogs) */
--font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", sans-serif;

/* Editor (source mode) - monospace */
--font-mono: "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, "PingFang SC", "Microsoft YaHei Mono", monospace;

/* Preview (rendered markdown) - proportional */
--font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif;

/* Preview headings */
--font-heading: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
```

### Font Sizes (macOS pt scale, but use px in CSS for web rendering)

| Element | Size | Weight | Line Height | Tracking |
|---|---|---|---|---|
| App title | 13px | 600 | 1.0 | 0 |
| UI body (labels, menus) | 13px | 400 | 1.4 | 0 |
| UI small (status bar) | 12px | 400 | 1.3 | 0 |
| Tab titles | 12px | 500 | 1.0 | 0 |
| Toolbar buttons | 12px | 400 | 1.0 | 0 |
| Dialog body | 13px | 400 | 1.5 | 0 |
| Editor source | 14px | 400 | 1.6 | 0 |
| Preview body | 15px | 400 | 1.7 | 0 |
| Preview H1 | 28px | 700 | 1.3 | -0.02em |
| Preview H2 | 22px | 600 | 1.35 | -0.01em |
| Preview H3 | 18px | 600 | 1.4 | 0 |
| Preview H4 | 16px | 600 | 1.4 | 0 |
| Preview H5-H6 | 14px | 600 | 1.5 | 0 |
| Preview code (inline) | 0.9em | 400 | 1.0 | 0 |
| Preview code (block) | 13px | 400 | 1.6 | 0 |
| Sidebar outline items | 13px | 400 | 1.4 | 0 |

### Line Width (Measure)

For comfortable reading, preview content should have a max line length:

```css
.markdown-preview {
  max-width: 740px;  /* ~65-75 characters per line for English, ~35-40 for CJK */
  margin: 0 auto;    /* Center in available space */
  padding: 32px 48px;
}
```

In focused/zen mode, increase max-width to 780px and add generous side padding.

## Color System

### Semantic Color Tokens

Never use raw hex values in component code. Always use semantic tokens:

```css
:root {
  /* Background hierarchy */
  --bg-base: #FFFFFF;        /* Window background */
  --bg-elevated: #F6F6F6;    /* Toolbar, sidebar (higher elevation) */
  --bg-surface: #FFFFFF;     /* Cards, dialogs, panels */
  --bg-hover: rgba(0,0,0,0.05);
  --bg-active: rgba(0,0,0,0.08);
  --bg-selected: #007AFF;    /* Selected item */
  --bg-selected-text: #FFFFFF;

  /* Text hierarchy */
  --text-primary: #1D1D1F;
  --text-secondary: #6E6E73;
  --text-tertiary: #AEAEB2;
  --text-inverse: #FFFFFF;
  --text-link: #0066CC;

  /* Borders and separators */
  --border: #D2D2D7;
  --border-strong: #C7C7CC;
  --separator: rgba(0,0,0,0.1);

  /* Accent */
  --accent: #007AFF;
  --accent-hover: #0066DD;
  --accent-active: #0055BB;

  /* Status */
  --success: #34C759;
  --warning: #FF9500;
  --error: #FF3B30;
  --info: #007AFF;

  /* Editor specific */
  --editor-bg: #FFFFFF;
  --editor-text: #1D1D1F;
  --editor-gutter: #8E8E93;
  --editor-cursor: #007AFF;
  --editor-selection: rgba(0,122,255,0.15);
  --editor-current-line: rgba(0,0,0,0.03);

  /* Preview specific */
  --preview-bg: #FFFFFF;
  --preview-text: #1D1D1F;
  --preview-code-bg: #F5F5F7;
  --preview-blockquote-border: #D2D2D7;
  --preview-table-border: #E5E5EA;
}

/* Dark mode */
.dark {
  --bg-base: #1E1E1E;
  --bg-elevated: #1C1C1E;
  --bg-surface: #2C2C2E;
  --bg-hover: rgba(255,255,255,0.06);
  --bg-active: rgba(255,255,255,0.1);
  --bg-selected: #0A84FF;
  --bg-selected-text: #FFFFFF;

  --text-primary: #F5F5F7;
  --text-secondary: #A1A1A6;
  --text-tertiary: #6E6E73;
  --text-link: #409CFF;

  --border: #38383A;
  --border-strong: #48484A;
  --separator: rgba(255,255,255,0.1);

  --accent: #0A84FF;
  --accent-hover: #409CFF;
  --accent-active: #64B5F6;

  --success: #30D158;
  --warning: #FF9F0A;
  --error: #FF453A;
  --info: #0A84FF;

  --editor-bg: #1E1E1E;
  --editor-text: #F5F5F7;
  --editor-gutter: #6E6E73;
  --editor-cursor: #0A84FF;
  --editor-selection: rgba(10,132,255,0.25);
  --editor-current-line: rgba(255,255,255,0.04);

  --preview-bg: #1E1E1E;
  --preview-text: #F5F5F7;
  --preview-code-bg: #2C2C2E;
  --preview-blockquote-border: #48484A;
  --preview-table-border: #38383A;
}
```

## Three Preset Themes

### Theme 1: Office (办公主题) — Default Light

Clean, professional, paper-like. Optimized for document reading during daytime work.

- Background: Warm white (#FAFAFA / #FAF9F7)
- Text: Near-black (#2C2C2C)
- Accent: Blue (#0066CC)
- Code background: Slight warm tint
- Feeling: Clean, like Apple Notes / iA Writer light mode

### Theme 2: Night (夜间主题) — Dark

Low blue-light, easy on eyes for late-night writing.

- Background: Deep dark (#1A1A2E or #1E1E1E with slight warmth)
- Text: Warm white (#E8E6E3)
- Accent: Warm blue or amber
- Code: Dark, subtle contrast
- Feeling: Like iA Writer dark / Obsidian dark

### Theme 3: Programmer (程序员主题) — Code-oriented

Higher contrast, optimized for technical writing with lots of code blocks.

- Light variant: Near-paper with slightly higher contrast for code
- Dark variant: Atom One Dark / GitHub Dark inspired
- Code blocks use full Shiki syntax highlighting
- Strong visual distinction between prose and code
- Monospace-friendly spacing

Each theme must have both Light and Dark variants, OR the theme follows system appearance.

## Component Design

### Buttons

```css
/* Primary button */
.btn-primary {
  height: 28px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  background: var(--accent);
  color: white;
  border: none;
  cursor: pointer;
  transition: background 100ms ease;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { background: var(--accent-active); }

/* Secondary button */
.btn-secondary {
  height: 28px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--bg-hover); }

/* Toolbar icon button */
.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background 80ms ease, color 80ms ease;
}
.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.toolbar-btn.active {
  background: var(--accent);
  color: white;
}
```

### Inputs

```css
.input {
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-ui);
  transition: border-color 100ms ease;
}
.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0,122,255,0.2);
}
```

### Dialogs

```css
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: var(--bg-surface);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  min-width: 400px;
  max-width: 600px;
  overflow: hidden;
}
```

## Markdown Preview Styling

Preview is critical — this is where users read their writing.

```css
/* src/styles/markdown-preview.css */
.markdown-preview {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.7;
  color: var(--preview-text);
  padding: 40px 48px;
  max-width: 740px;
  margin: 0 auto;
}

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4 {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.8em;
  margin-bottom: 0.6em;
}
.markdown-preview h1 {
  font-size: 28px;
  border-bottom: 1px solid var(--separator);
  padding-bottom: 0.3em;
  margin-top: 0;
}
.markdown-preview h2 { font-size: 22px; }
.markdown-preview h3 { font-size: 18px; }
.markdown-preview h4 { font-size: 16px; }

.markdown-preview p {
  margin: 0.8em 0;
}

/* CJK paragraph spacing */
.markdown-preview p:lang(zh),
.markdown-preview p:lang(ja),
.markdown-preview p:lang(ko) {
  text-align: justify;
}

.markdown-preview a {
  color: var(--text-link);
  text-decoration: none;
}
.markdown-preview a:hover { text-decoration: underline; }

.markdown-preview blockquote {
  border-left: 3px solid var(--preview-blockquote-border);
  padding-left: 16px;
  margin: 1em 0;
  color: var(--text-secondary);
}

.markdown-preview code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--preview-code-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-preview pre {
  background: var(--preview-code-bg);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
}
.markdown-preview pre code {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
}

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
.markdown-preview th,
.markdown-preview td {
  border: 1px solid var(--preview-table-border);
  padding: 8px 12px;
  text-align: left;
}
.markdown-preview th {
  background: var(--bg-elevated);
  font-weight: 600;
}

.markdown-preview ul,
.markdown-preview ol {
  padding-left: 1.8em;
  margin: 0.8em 0;
}
.markdown-preview li {
  margin: 0.3em 0;
}

.markdown-preview hr {
  border: none;
  border-top: 1px solid var(--separator);
  margin: 2em 0;
}

.markdown-preview img {
  max-width: 100%;
  border-radius: 6px;
}

/* Task lists */
.markdown-preview .task-list-item {
  list-style: none;
  margin-left: -1.4em;
}
.markdown-preview .task-list-item input[type="checkbox"] {
  margin-right: 0.5em;
}
```

## Editor Styling (CodeMirror)

```css
.cm-editor {
  height: 100%;
  font-family: var(--font-mono);
  font-size: 14px;
  background: var(--editor-bg);
  color: var(--editor-text);
}
.cm-editor .cm-content {
  font-family: var(--font-mono);
  padding: 16px 20px;
  line-height: 1.6;
}
.cm-editor .cm-gutters {
  background: var(--editor-bg);
  color: var(--editor-gutter);
  border: none;
}
.cm-editor .cm-cursor {
  border-left-color: var(--editor-cursor);
}
.cm-editor .cm-selectionBackground {
  background: var(--editor-selection) !important;
}
.cm-editor.cm-focused .cm-activeLine {
  background: var(--editor-current-line);
}
```

## Empty States

Every empty view must have a designed empty state — never blank white space.

```tsx
// Example empty state for no open tabs
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-16 h-16 mb-6 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center">
        <Icon icon="ph:file-text" width="32" className="text-[var(--text-tertiary)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        No file open
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">
        Open a Markdown file or create a new document to start writing.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={openFile}>Open File</Button>
        <Button variant="secondary" onClick={newFile}>New Document</Button>
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mt-4">
        Press ⌘O to open, ⌘N for new
      </p>
    </div>
  );
}
```

## Animation & Motion

- Keep animations short (100-200ms)
- Use ease-out curves for appearing elements (natural deceleration)
- Prefer opacity + transform over width/height/top/left (GPU-accelerated)
- Respect `prefers-reduced-motion` media query

```css
.fade-in {
  animation: fadeIn 150ms ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.slide-up {
  animation: slideUp 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Spacing Scale

Use Tailwind's default spacing (4px base) but align with macOS conventions:

```
0   = 0
0.5 = 2px    (hairlines, internal padding)
1   = 4px    (tight icon-text gap)
2   = 8px    (standard element gap)
3   = 12px   (related group spacing)
4   = 16px   (component padding)
5   = 20px   (content padding)
6   = 24px   (section spacing)
8   = 32px   (major section separation)
10  = 40px
12  = 48px   (preview content padding)
16  = 64px   (hero/empty state spacing)
```

## Accessibility

1. Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text (WCAG AA)
2. Focus indicators: Always visible for keyboard navigation
3. Semantic HTML: Use `<button>` not `<div onclick>`, `<h1-h6>` for headings
4. ARIA labels for icon-only buttons
5. Keyboard navigation for all interactive elements
6. Respect `prefers-reduced-motion`
7. Minimum touch/click target: 28x28px (macOS doesn't need 44px like iOS)

## Icon Usage

- Use Iconify with Phosphor icons as the primary set (`ph:*`)
- Use consistent weight (regular or bold, don't mix)
- Default size: 16px for toolbar, 14px for tabs, 14px for sidebar
- Toolbar icon buttons: 28x28px hit area with 16px icon centered
- Icon-only buttons must have `aria-label`
