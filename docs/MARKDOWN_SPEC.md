# FreeMarkdown Markdown Specification

> Last updated: 2026-09-03

## Compatibility Layers

FreeMarkdown supports three Markdown compatibility modes. Default is **GFM**.

### Layer 1: Strict (CommonMark)

Pure [CommonMark](https://spec.commonmark.org/) specification only. No extensions.

### Layer 2: GFM (GitHub Flavored Markdown) — Default

CommonMark plus [GitHub Flavored Markdown](https://github.github.com/gfm/) extensions.

### Layer 3: Extended (FreeMarkdown Extended)

GFM plus additional extensions useful for technical writing and academic/technical documents.

## Syntax Support Matrix

| Syntax | Strict | GFM | Extended | Notes |
|---|---|---|---|---|
| **Block Elements** | | | | |
| Headings (`#` to `######`) | ✅ | ✅ | ✅ | ATX headings; Setext headings for H1-H2 |
| Paragraphs | ✅ | ✅ | ✅ | |
| Blockquotes (`>`) | ✅ | ✅ | ✅ | Nested blockquotes supported |
| Lists (unordered `- * +`) | ✅ | ✅ | ✅ | |
| Lists (ordered `1.`) | ✅ | ✅ | ✅ | Ordered list numbering is respected in source, normalized in preview |
| Code blocks (fenced ` ``` `) | ✅ | ✅ | ✅ | With language identifier for syntax highlighting |
| Code blocks (indented 4 spaces) | ✅ | ✅ | ✅ | |
| Horizontal rules (`---`, `***`, `___`) | ✅ | ✅ | ✅ | |
| Link reference definitions | ✅ | ✅ | ✅ | |
| **Tables** | ❌ | ✅ | ✅ | GFM pipe tables; alignment supported (`:---`, `:---:`, `---:`) |
| **Task lists** | ❌ | ✅ | ✅ | `- [ ]` unchecked, `- [x]` checked |
| **Strikethrough** | ❌ | ✅ | ✅ | `~~text~~` |
| **Autolinks** | ❌ | ✅ | ✅ | URLs converted to links automatically |
| **Footnotes** | ❌ | ❌ | ✅ | `[^1]` in text, `[^1]: text` at bottom |
| **Definition lists** | ❌ | ❌ | ✅ | PHP-style: term on its own line, `: definition` below |
| **Abbreviations** | ❌ | ❌ | ✅ | `*[HTML]: HyperText Markup Language` |
| **Table of contents** | ❌ | ❌ | ✅ | `[[toc]]` generates TOC from headings |
| **Inline Elements** | | | | |
| Emphasis (`*italic*`, `_italic_`) | ✅ | ✅ | ✅ | |
| Strong (`**bold**`, `__bold__`) | ✅ | ✅ | ✅ | |
| Code (inline `` `code` ``) | ✅ | ✅ | ✅ | |
| Links (`[text](url)`) | ✅ | ✅ | ✅ | |
| Images (`![alt](url)`) | ✅ | ✅ | ✅ | |
| Hard line breaks (two spaces + newline) | ✅ | ✅ | ✅ | |
| **Mark/highlight** | ❌ | ❌ | ✅ | `==text==` |
| **Subscript** | ❌ | ❌ | ✅ | `H~2~O` |
| **Superscript** | ❌ | ❌ | ✅ | `X^2^` |
| **Inserted** | ❌ | ❌ | ✅ | `++text++` |
| **Emoji shortcodes** | ❌ | ❌ | ✅ | `:smile:`, `:rocket:` |
| **Special Blocks** | | | | |
| **Math inline** | ❌ | ❌ | ✅ | `$E = mc^2$` |
| **Math display** | ❌ | ❌ | ✅ | `$$ E = mc^2 $$` on own paragraph |
| **Mermaid diagrams** | ❌ | ❌ | ✅ | ```mermaid fenced code blocks |
| **Raw HTML** | ❌ | ❌ | ❌ | **Disabled by default** for security; user can enable in settings |

## Code Block Languages

**V0.1** supports syntax highlighting for:

- Web: HTML, CSS, JavaScript, TypeScript, JSX, TSX, JSON, XML, SVG
- Systems: C, C++, C#, Rust, Go, Java, Kotlin, Swift
- Scripting: Python, Ruby, PHP, Bash, PowerShell
- Data: YAML, TOML, INI, SQL, GraphQL
- Documentation: Markdown, LaTeX, Plain text
- Config: Dockerfile, Makefile, Nginx, Git

Additional languages can be loaded as needed (Shiki supports many languages).

## Mermaid Diagram Types

Supported via Mermaid.js (Extended mode):
- `flowchart` (flow charts)
- `sequenceDiagram` (sequence diagrams)
- `classDiagram` (class diagrams)
- `stateDiagram-v2` (state diagrams)
- `erDiagram` (entity-relationship)
- `gantt` (Gantt charts)
- `pie` (pie charts)
- `journey` (user journeys)
- `gitgraph` (git graphs)
- `mindmap` (mind maps)

Mermaid diagrams render lazily (only when visible in preview).

## Math (KaTeX)

Supported via KaTeX (Extended mode):
- **Inline math:** `$formula$` — renders inline with text. Delimiters must not have spaces immediately after/before `$` (to avoid conflicts with currency).
- **Display math:** `$$formula$$` on its own paragraph — renders as a centered block.

KaTeX renders locally (no network access). All standard KaTeX functions are supported.

## Raw HTML Handling

**Default:** Raw HTML in Markdown is **escaped** (not rendered). This is the secure default.

**Opt-in (settings):** If user enables "Allow HTML in Markdown" (per-file or global), raw HTML is passed through DOMPurify with strict settings before rendering. Script, iframe, form, and other dangerous elements are always stripped.

## Link Behavior

- Internal anchor links (`#heading-id`): Scroll preview to heading, update source cursor if possible
- Relative file links (`./other.md`): Open the file in a new tab (if relative to current file's directory)
- External links (`http://`, `https://`): Open in system default browser (NOT in WebView)
- Email links (`mailto:`): Open system mail client
- Other protocols: Blocked or prompt user

## Image Handling

- Relative paths: Resolved relative to current file's directory
- Absolute paths: Loaded directly (file://)
- HTTP URLs: Loaded (requires network; bundle images locally for offline use)
- Data URIs: Rendered inline
- Supported formats: PNG, JPEG, GIF, WebP, SVG
- Drag-and-drop images into editor:
  - Option 1 (default): Copy to `./assets/` folder and insert relative link
  - Option 2: Insert as base64 data URI
  - Option 3: Insert absolute file path
  - Option 4: Prompt user for choice

## Typography Options

### Smart Punctuation (typographer mode)
When enabled (GFM and Extended modes):
- Straight quotes (`"` `'`) → curly quotes (`"` `"` `'` `'`)
- `--` → en-dash (–)
- `---` → em-dash (—)
- `...` → ellipsis (…)

CJK users may want to disable smart punctuation to avoid conflicts. This is a per-document or global setting.

### CJK Punctuation
Full-width CJK punctuation (，。！？：；""''（）【】) is supported natively.

### Line Breaks within Paragraphs
- **Hard breaks:** Two spaces at end of line + Enter (CommonMark standard)
- **Soft breaks:** Single newline (configurable; GFM often treats newlines in paragraphs as `<br>`, but FreeMarkdown defaults to CommonMark behavior: newlines within paragraph are treated as spaces)

## Keyboard Shortcuts for Formatting

In source mode:

| Action | Shortcut | Markdown inserted |
|---|---|---|
| Bold | ⌘B | `**text**` (wraps selection or inserts at cursor) |
| Italic | ⌘I | `*text*` |
| Strikethrough | ⌘⇧X | `~~text~~` |
| Inline code | ⌘E | `` `text` `` |
| Link | ⌘K | `[text](url)` |
| Image | ⌘⌥I | `![alt](url)` |
| Heading 1-6 | ⌘⌥1-6 | `# ` to `###### ` at line start |
| Bullet list | ⌘⇧L | `- ` at line start |
| Numbered list | ⌘⇧⌥L | `1. ` at line start |
| Task list | ⌘⇧T | `- [ ] ` at line start |
| Blockquote | ⌘⇧B | `> ` at line start |
| Code block | ⌘⇧C | ` ```\n\n``` ` |
| Horizontal rule | ⌘⇧H | `---\n` |
| Table | ⌘⇧⌥T | Insert table template |

## Parser Configuration Details

markdown-it plugins used:

| Plugin | Mode | Purpose |
|---|---|---|
| (built-in) | All | Core CommonMark parsing |
| `markdown-it-gfm` or manual GFM setup | GFM+ | Tables, strikethrough, task lists, autolinks |
| `markdown-it-anchor` | Extended | Header IDs for anchors and TOC |
| `markdown-it-toc-done-right` | Extended | `[[toc]]` generation |
| `markdown-it-footnote` | Extended | Footnote support |
| `markdown-it-deflist` | Extended | Definition lists |
| `markdown-it-abbr` | Extended | Abbreviations |
| `markdown-it-mark` | Extended | `==highlight==` |
| `markdown-it-sub` | Extended | `~subscript~` |
| `markdown-it-sup` | Extended | `^superscript^` |
| `markdown-it-ins` | Extended | `++inserted++` |
| `markdown-it-emoji` | Extended | Emoji shortcodes |
| Custom KaTeX plugin | Extended | `$...$` and `$$...$$` math |
| Custom Mermaid plugin | Extended | ```mermaid diagram detection |
| Custom code highlight | All | Shiki syntax highlighting (lazy) |

## Rendering Order

Markdown text is processed in this order:

1. Pre-process (normalize line endings to \n)
2. Parse with markdown-it (with plugin chain) → HTML
3. Post-process HTML:
   - Add target="_blank" rel="noopener" to external links
   - Add lazy loading to images
   - Mark code blocks for Shiki highlighting
   - Mark math blocks for KaTeX rendering
   - Mark Mermaid blocks for Mermaid rendering
4. Sanitize with DOMPurify
5. Inject into DOM
6. Lazy-enhance visible blocks (Shiki, KaTeX, Mermaid) via IntersectionObserver
