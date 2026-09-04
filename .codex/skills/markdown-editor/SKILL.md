# Markdown Editor Skill

## When to Use

Load this skill when working on:
- CodeMirror 6 editor integration
- Markdown syntax highlighting in source mode
- markdown-it preview rendering
- Markdown parsing plugins
- Code blocks (Shiki highlighting)
- Math formula (KaTeX) rendering
- Mermaid diagram rendering
- Tables, task lists, footnotes, TOC
- Large file handling / degradation strategy

## Editor Architecture

### Source Mode (CodeMirror 6)

CodeMirror 6 is used as the **source editor** (not as a WYSIWYG engine for V0.1/V0.5).

```
┌─────────────────────────────────────────┐
│            CodeMirror Editor            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  # Hello World                      ││
│  │                                     ││
│  │  This is **bold** and *italic*.     ││
│  │                                     ││
│  │  ```javascript                      ││
│  │  console.log('code');               ││
│  │  ```                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  Extensions:                            │
│  - markdown language support            │
│  - syntax highlighting                  │
│  - bracket matching                     │
│  - line numbers                         │
│  - active line highlighting             │
│  - search (⌘F)                          │
│  - keymap (standard + macOS shortcuts)  │
└─────────────────────────────────────────┘
```

### Preview Mode (markdown-it)

The preview uses markdown-it to parse Markdown to HTML, then renders in a sandboxed div.

```
Markdown Text
     │
     ▼
markdown-it Parser + Plugin Chain
     │
     ▼
HTML String (sanitized)
     │
     ▼
Lazy Enhancement:
  - Code blocks → Shiki highlighting
  - Math blocks → KaTeX rendering
  - Mermaid blocks → Mermaid rendering
  - Images → lazy load
     │
     ▼
Preview Pane (scroll-synced)
```

### Split View

Source and preview are visible simultaneously with scroll sync.

## CodeMirror 6 Setup

```tsx
// src/components/editor/useCodeMirror.ts
import { useEffect, useRef, useCallback } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

interface UseCodeMirrorOptions {
  initialContent: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  extensions?: Extension[];
}

export function useCodeMirror({
  initialContent,
  onChange,
  onSave,
  extensions = [],
}: UseCodeMirrorOptions) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      preventDefault: true,
      run: () => { onSave?.(); return true; },
    }]);

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        highlightSelectionMatches(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        saveKeymap,
        EditorView.lineWrapping,
        updateListener,
        ...extensions,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // Only initialize once

  return { editorRef, view: viewRef };
}
```

## markdown-it Configuration

```tsx
// src/core/markdown/createRenderer.ts
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import toc from 'markdown-it-toc-done-right';
import { katexPlugin } from './plugins/katex';
import { mermaidPlugin } from './plugins/mermaid';
import { taskListPlugin } from './plugins/tasklist';
import { codeHighlightPlugin } from './plugins/code-highlight';

export type MarkdownCompat = 'strict' | 'gfm' | 'extended';

export function createMarkdownRenderer(mode: MarkdownCompat = 'gfm') {
  const md = new MarkdownIt({
    html: false, // Disable raw HTML by default (security)
    linkify: true,
    typographer: mode !== 'strict',
    breaks: false, // GFM uses hard breaks only in specific contexts
    quotes: '""\'\'',
  });

  if (mode === 'strict') {
    // CommonMark only — disable all GFM/extended features
    md.options.linkify = false;
    md.options.typographer = false;
    return md;
  }

  // GFM table support (markdown-it is CommonMark; add GFM table)
  // Note: markdown-it does NOT enable GFM by default; add plugins

  if (mode === 'extended') {
    // Header anchors
    md.use(anchor, {
      permalink: anchor.permalink.headerLink(),
    });

    // Table of contents: [[toc]]
    md.use(toc, {
      containerClass: 'toc',
      listType: 'ul',
    });

    // KaTeX math: $...$ and $$...$$
    md.use(katexPlugin);

    // Mermaid diagrams: ```mermaid
    md.use(mermaidPlugin);
  }

  // Task lists: - [ ] and - [x]
  md.use(taskListPlugin);

  // Code highlighting with Shiki
  md.use(codeHighlightPlugin);

  return md;
}
```

## Code Highlighting (Shiki)

```tsx
// src/core/markdown/plugins/code-highlight.ts
import { getHighlighter, type Highlighter } from 'shiki/bundle/web';
import type MarkdownIt from 'markdown-it';

let highlighterPromise: Promise<Highlighter> | null = null;

async function getSharedHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'javascript', 'typescript', 'jsx', 'tsx',
        'python', 'rust', 'go', 'java', 'c', 'cpp', 'csharp',
        'html', 'css', 'json', 'yaml', 'toml', 'bash', 'sql',
        'markdown', 'php', 'ruby', 'swift', 'kotlin',
      ],
    });
  }
  return highlighterPromise;
}

export function codeHighlightPlugin(md: MarkdownIt) {
  md.options.highlight = (code, lang) => {
    // For initial render, return a placeholder that will be highlighted lazily
    // Use a data attribute for lazy Shiki loading
    const escapedCode = md.utils.escapeHtml(code);
    return `<pre class="code-block" data-lang="${md.utils.escapeHtml(lang || '')}"><code>${escapedCode}</code></pre>`;
  };
}
```

**Strategy:** Use lazy highlighting after render to avoid blocking the main thread. Highlight visible code blocks first, then off-screen ones with `requestIdleCallback`.

## Math (KaTeX)

```tsx
// Render KaTeX after markdown-it generates HTML
// Inline math: $...$ (must not be preceded by backslash)
// Block math: $$...$$ on its own paragraph
import katex from 'katex';

function renderMathInElement(element: HTMLElement) {
  // Find all .math-inline and .math-block elements added by katexPlugin
  element.querySelectorAll('.math-inline').forEach(el => {
    try {
      katex.render(el.textContent || '', el as HTMLElement, {
        throwOnError: false,
        displayMode: false,
      });
    } catch (e) {
      el.textContent = `$${el.textContent}$`;
    }
  });

  element.querySelectorAll('.math-block').forEach(el => {
    try {
      katex.render(el.textContent || '', el as HTMLElement, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      // Keep original text
    }
  });
}
```

## Mermaid Diagrams

```tsx
// Lazy-load Mermaid only when needed
import mermaid from 'mermaid';

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default', // Will be switched based on app theme
    securityLevel: 'strict', // Required for security
  });
  mermaidInitialized = true;
}

async function renderMermaidBlocks(container: HTMLElement, isDark: boolean) {
  initMermaid();
  mermaid.initialize({ theme: isDark ? 'dark' : 'default' });

  const blocks = container.querySelectorAll('.mermaid-block:not(.rendered)');
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as HTMLElement;
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaid.render(id, block.textContent || '');
      block.innerHTML = svg;
      block.classList.add('rendered');
    } catch (e) {
      block.innerHTML = `<pre class="mermaid-error">${(e as Error).message}</pre>`;
      block.classList.add('rendered', 'error');
    }
  }
}
```

## Preview Rendering Pipeline (Performance Critical)

```tsx
// src/components/preview/useMarkdownPreview.ts
import { useEffect, useRef, useMemo } from 'react';
import { createMarkdownRenderer } from '@/core/markdown/createRenderer';
import DOMPurify from 'dompurify';

export function useMarkdownPreview(
  content: string,
  options: { mode: 'strict' | 'gfm' | 'extended'; isDark: boolean }
) {
  const renderer = useMemo(() => createMarkdownRenderer(options.mode), [options.mode]);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Debounce rendering (200ms after last keystroke)
    if (debounceRef.current) cancelTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      if (!containerRef.current) return;

      // Parse markdown
      const rawHtml = renderer.render(content);

      // Sanitize
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', // KaTeX
                   'mfrac', 'msup', 'msub', 'msqrt'], // Allow MathML
        ADD_ATTR: ['target', 'rel'],
      });

      containerRef.current.innerHTML = cleanHtml;

      // Lazy enhancement after DOM insertion
      requestIdleCallback(() => {
        if (containerRef.current) {
          renderMathInElement(containerRef.current);
          renderMermaidBlocks(containerRef.current, options.isDark);
          highlightCodeBlocks(containerRef.current, options.isDark);
        }
      });
    }, 200);

    return () => {
      if (debounceRef.current) cancelTimeout(debounceRef.current);
    };
  }, [content, renderer, options.isDark]);

  return { containerRef };
}
```

## Large File Degradation Strategy (M23)

Files larger than defined thresholds trigger degraded mode:

| File Size | Strategy |
|---|---|
| < 1MB | Full source + preview with all features |
| 1–10MB | Full source, debounce preview to 500ms, lazy Mermaid/KaTeX |
| 10–50MB | Full source, **preview disabled** (toggle to enable), disable code folding |
| > 50MB | Source mode only, simplified syntax highlighting (no semantic tokens), line wrapping off, virtualization enhanced |

Implementation:
1. Detect file size on open
2. Set `degradedMode` in editor store
3. Conditionally enable/disable CodeMirror extensions
4. Show a banner in the status bar when in degraded mode
5. Allow user to manually toggle preview on for large files

## Markdown Compatibility Layers

See `docs/MARKDOWN_SPEC.md` for full syntax tables. Summary:

| Feature | Strict (CommonMark) | GFM (default) | Extended |
|---|---|---|---|
| Headings, paragraphs, lists | ✅ | ✅ | ✅ |
| Bold, italic, code, links | ✅ | ✅ | ✅ |
| Blockquotes, horizontal rules | ✅ | ✅ | ✅ |
| Images | ✅ | ✅ | ✅ |
| Tables | ❌ | ✅ | ✅ |
| Strikethrough | ❌ | ✅ | ✅ |
| Task lists | ❌ | ✅ | ✅ |
| Autolinks | ❌ | ✅ | ✅ |
| Footnotes | ❌ | ❌ | ✅ |
| Table of contents | ❌ | ❌ | ✅ |
| Math (KaTeX) | ❌ | ❌ | ✅ |
| Mermaid diagrams | ❌ | ❌ | ✅ |
| Abbreviations | ❌ | ❌ | ✅ |
| Definition lists | ❌ | ❌ | ✅ |
| Mark (highlight) | ❌ | ❌ | ✅ |
| Subscript/Superscript | ❌ | ❌ | ✅ |
| Emoji shortcodes | ❌ | ❌ | ✅ |

## CJK Typography

1. **Font fallback chain** for preview and editor:
   ```css
   font-family:
     -apple-system, BlinkMacSystemFont,
     "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
     "Noto Sans CJK SC", "Source Han Sans SC",
     sans-serif;
   ```
2. **Monospace CJK** for code:
   ```css
   font-family:
     "SF Mono", Menlo, Monaco, Consolas,
     "PingFang SC", "Microsoft YaHei Mono",
     monospace;
   ```
3. **Chinese-English spacing:** No automatic spacing insertion in V0.1. Rely on proper kerning via CSS.
4. **Line height:** CJK text needs larger line height (1.6–1.8 for body text, 1.5 for editor).
5. **Paragraph indent:** Optional setting. CJK paragraphs often don't use first-line indent in technical documents.

## Scroll Sync (Source ↔ Preview)

Use a block-mapping approach rather than exact line mapping (Markdown source lines don't map 1:1 to rendered HTML):

1. Collect heading positions in source
2. Collect heading positions in preview
3. Use IntersectionObserver on headings to determine scroll position
4. Smooth scroll the other pane to matching heading
5. Avoid scroll feedback loops with a sync lock

## Checklist Before Committing Editor Code

- [ ] Editor handles empty files without errors
- [ ] Preview renders all CommonMark elements correctly
- [ ] Code blocks have syntax highlighting
- [ ] Math formulas render (if Extended mode)
- [ ] Mermaid diagrams render (if Extended mode) with error states
- [ ] Tables render correctly (GFM mode and above)
- [ ] Debounce is working (no full re-parse per keystroke)
- [ ] HTML in markdown is sanitized (DOMPurify active)
- [ ] External links have `target="_blank" rel="noopener noreferrer"`
- [ ] Preview scroll doesn't jump unnecessarily during editing
- [ ] Large files (>1MB) have degraded mode tested
- [ ] CJK characters render correctly in both editor and preview
- [ ] Undo/Redo works per-tab (CodeMirror history is per-instance)
