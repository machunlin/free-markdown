# Performance Review Skill

## When to Use

Load this skill when:
- Implementing or reviewing editor/preview rendering
- Handling large files (1MB+)
- Working with tab management (many open tabs)
- Optimizing start-up time
- Working with syntax highlighting, Mermaid, KaTeX
- Adding file watchers or real-time features
- Reviewing code for memory leaks
- Optimizing scroll performance
- Implementing search across files
- Any feature that processes text/data

## Performance Targets

| Metric | Target |
|---|---|
| App cold start (to interactive) | < 1.0s |
| File open, small (<100KB) | < 100ms to editable |
| File open, medium (1MB) | < 500ms to editable |
| File open, large (10MB) | < 3s (with degraded mode) |
| Keystroke latency | < 16ms (60fps, no frame drops) |
| Preview update (after debounce) | < 100ms for <100KB, <500ms for 1MB |
| Memory, idle (5 tabs) | < 200MB |
| Memory, 10 tabs with large files | < 500MB |
| Search in file (<100KB) | < 50ms |
| Tab switch | < 50ms |
| Scroll (editor or preview) | 60fps (16ms per frame) |

## Key Principles

1. **Never block the main thread with parsing.** Use debouncing, Web Workers, and `requestIdleCallback`.
2. **Never re-render the entire preview on every keystroke.** Debounce to 200ms.
3. **Never re-parse the entire document for small changes** (future optimization with incremental parsing; V0.1 uses full parse with debounce).
4. **CodeMirror 6 is your friend.** It handles virtual scrolling, viewport-only rendering, and incremental parsing natively.
5. **Lazy-load everything that isn't visible.** Mermaid diagrams, code blocks off-screen, images.
6. **Dispose resources.** Destroy CodeMirror instances when tabs close; remove event listeners; cancel pending debounces.

## Common Performance Issues & Solutions

### 1. Preview Re-rendering on Every Keystroke

**Problem:** As the user types, markdown-it re-parses the entire document.

**Solution:** Debounce preview rendering.

```tsx
// Good: Debounce 200ms
useEffect(() => {
  const timer = setTimeout(() => {
    renderPreview(content);
  }, 200);
  return () => clearTimeout(timer);
}, [content]);

// Bad: Render on every keystroke
useEffect(() => {
  renderPreview(content); // Blocks main thread!
}, [content]);
```

### 2. Blocking Main Thread with Heavy Parsing

**Problem:** Shiki highlighting, Mermaid rendering, or large markdown-it parsing freezes the UI.

**Solution:** Use Web Workers for heavy work.

```tsx
// src/core/markdown/worker.ts
// This runs in a Web Worker
import markdownIt from 'markdown-it';

const md = markdownIt({ /* config */ });

self.onmessage = (e) => {
  const { content, id } = e.data;
  const html = md.render(content);
  self.postMessage({ html, id });
};

// In component:
const worker = useRef<Worker | null>(null);
useEffect(() => {
  worker.current = new Worker(new URL('../core/markdown/worker.ts', import.meta.url), { type: 'module' });
  worker.current.onmessage = (e) => {
    const { html, id } = e.data;
    if (id === currentRenderId.current) {
      setPreviewHtml(html);
    }
  };
  return () => worker.current?.terminate();
}, []);
```

### 3. Too Many DOM Nodes in Preview

**Problem:** A 10MB markdown file produces hundreds of thousands of DOM nodes, making scrolling janky.

**Solution:** Virtual scrolling for preview (for very long documents).

For V0.1/V0.5: Simpler approach — disable preview for files >10MB, show message with "enable preview" button.

For V1.0+: Implement virtual scrolling for preview pane (only render visible sections).

### 4. Memory Leaks from Event Listeners

**Problem:** Tab components add event listeners but don't remove them when tabs close.

**Solution:** Always clean up in useEffect return function.

```tsx
useEffect(() => {
  const unlisten = listen('file-changed', handleFileChange);
  const watcher = startWatcher(path);

  return () => {
    unlisten.then(fn => fn()); // Remove Tauri event listener
    watcher.stop();             // Stop file watcher
  };
}, [path]);
```

### 5. All Tabs in Memory

**Problem:** Each open tab retains its full content, CodeMirror instance, and preview HTML. 20 tabs of 5MB files = 100MB+ in memory.

**Solution:** Tab hibernation for tabs beyond the first 5 or N recent tabs.

```ts
interface Tab {
  // ... other fields
  hibernated: boolean;  // When true, content is stored but editor instance is destroyed
}

function hibernateTab(tabId: string) {
  const tab = getTab(tabId);
  if (!tab || tab.isActive) return;
  // Save current state
  tab.cursorPosition = getEditorCursor(tabId);
  tab.scrollPosition = getEditorScroll(tabId);
  // Destroy CodeMirror instance
  destroyEditor(tabId);
  tab.hibernated = true;
}

function activateTab(tabId: string) {
  const tab = getTab(tabId);
  if (tab.hibernated) {
    // Recreate CodeMirror instance
    createEditor(tabId, tab.content);
    restoreCursor(tabId, tab.cursorPosition);
    tab.hibernated = false;
  }
}
```

### 6. Synchronous File I/O

**Problem:** Using `fs.readFileSync` in Rust commands blocks the async runtime.

**Solution:** Always use `tokio::fs` async functions or `spawn_blocking`.

```rust
// Good: Async file reading
#[tauri::command]
pub async fn open_file(path: String) -> Result<FileContent, AppError> {
    let bytes = tokio::fs::read(&path).await?;
    // Process bytes...
    Ok(content)
}

// Bad: Blocking I/O in async command
#[tauri::command]
pub async fn open_file(path: String) -> Result<FileContent, AppError> {
    let bytes = std::fs::read(&path)?;  // BLOCKS!
    Ok(content)
}
```

### 7. Re-creating Expensive Objects

**Problem:** Creating a new markdown-it instance or Shiki highlighter on every render.

**Solution:** Memoize singletons.

```tsx
// Good: Create once, reuse
const renderer = useMemo(() => createMarkdownRenderer(mode), [mode]);

// Good: Singleton highlighter
let highlighterPromise: Promise<Highlighter>;
async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createShikiHighlighter();
  }
  return highlighterPromise;
}

// Bad: New instance every render
function renderPreview(content: string) {
  const md = MarkdownIt();  // Recreated every call!
  return md.render(content);
}
```

### 8. Mermaid/KaTeX Rendering All Blocks at Once

**Problem:** After parsing, all Mermaid diagrams and math blocks render immediately, even if off-screen.

**Solution:** Use IntersectionObserver to render only visible blocks.

```tsx
function useLazyRendering(containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const block = entry.target as HTMLElement;
          if (block.classList.contains('mermaid-block') && !block.classList.contains('rendered')) {
            renderMermaidBlock(block);
          }
          if (block.classList.contains('math-block') && !block.classList.contains('rendered')) {
            renderMathBlock(block);
          }
          if (block.classList.contains('code-block') && !block.classList.contains('highlighted')) {
            highlightCodeBlock(block);
          }
          observer.unobserve(block);
        }
      });
    }, { rootMargin: '200px' }); // Pre-render 200px before visible

    // Observe all unrendered blocks
    containerRef.current.querySelectorAll('.mermaid-block, .math-block, .code-block').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [content]);
}
```

## CodeMirror Performance Tips

1. **Avoid decorations that cover the entire document** — use viewport-aware decorations.
2. **Don't do expensive work in `updateListener`** for every update. Debounce.
3. **Use `Compartment` for dynamic configuration** (theme changes, extension toggling) instead of rebuilding the state.
4. **Disable syntax highlighting for very large files** (>10MB) via the degraded mode.
5. **Line decorations are cheaper than widget decorations** for inline formatting.
6. **`ViewPlugin` is faster than `ViewUpdateListener`** for continuous view updates.

```tsx
// Good: Use Compartment for theme switching
const themeCompartment = new Compartment();

const state = EditorState.create({
  doc: content,
  extensions: [
    // ... other extensions
    themeCompartment.of(lightTheme),
  ],
});

// Later, switch theme without rebuilding:
view.dispatch({
  effects: themeCompartment.reconfigure(darkTheme),
});
```

## React Rendering Performance

1. **Use `React.memo` for large lists** (sidebar outline, tab items).
2. **Use `useCallback` and `useMemo`** correctly — don't overuse (premature optimization), but do use for:
   - Event handlers passed to memoized children
   - Expensive computations (markdown parsing, data transformations)
   - Objects/arrays passed as props to memoized components
3. **Avoid unnecessary re-renders** — split large components, use selectors.
4. **Virtualize long lists** (file explorer with thousands of files, future outline with hundreds of headings).

```tsx
// Good: Selector pattern with Zustand to avoid unnecessary re-renders
const activeTabId = useWorkspaceStore(state => state.activeTabId);
// Instead of: const { activeTabId, tabs, ...everything } = useWorkspaceStore();
```

## Startup Performance

1. **Code split** — use dynamic imports for heavy features:
   ```tsx
   const MermaidRenderer = lazy(() => import('./MermaidRenderer'));
   const KaTeXRenderer = lazy(() => import('./KaTeXRenderer'));
   ```
2. **Initialize CodeMirror only for the active tab**, not all tabs.
3. **Defer non-critical work** after initial render:
   ```tsx
   useEffect(() => {
     // Render initial content
     renderEditor();

     // Defer non-critical work
     requestIdleCallback(() => {
       loadRecentFiles();
       initShikiHighlighter();  // Warm up Shiki in background
       checkForUpdates();       // If enabled
     });
   }, []);
   ```

## File Watcher Performance

1. **Debounce file change events** (editors like VS Code write temp files during save, causing multiple events).
2. **Don't watch every open file** — only watch the active file, or use a single watcher on the directory.
3. **Compare modification times** before re-reading — if the file hasn't changed, skip.

```rust
// Debounce file watcher events
let (tx, rx) = tokio::sync::mpsc::channel(10);
let debounced = tokio::spawn(async move {
    let mut last_event = None;
    let mut debounce_timer = None;
    loop {
        tokio::select! {
            event = rx.recv() => {
                last_event = event;
                debounce_timer = Some(tokio::time::sleep(Duration::from_millis(300)));
            }
            _ = async { debounce_timer.as_mut().unwrap().await }, if debounce_timer.is_some() => {
                if let Some(event) = last_event.take() {
                    let _ = app.emit("file-changed", event);
                }
                debounce_timer = None;
            }
        }
    }
});
```

## Profiling Tools

- **Chrome DevTools Performance tab** — profile rendering and JS execution
- **React DevTools Profiler** — identify component re-renders
- **Tauri devtools** — same as Chrome DevTools for the WebView
- **Instruments.app** (macOS) — profile Rust backend CPU/memory
- **`cargo flamegraph`** — profile Rust code performance
- **Memory tab in DevTools** — take heap snapshots, find detached DOM nodes and leaked event listeners

## Performance Review Checklist

- [ ] Preview rendering is debounced (not per-keystroke)
- [ ] Heavy parsing (markdown, highlighting) is offloaded to Web Workers or idle callbacks
- [ ] CodeMirror instances are properly destroyed when tabs close
- [ ] No memory leaks (event listeners removed, intervals cleared, workers terminated)
- [ ] Mermaid/KaTeX/code highlighting uses lazy rendering (IntersectionObserver)
- [ ] Tab hibernation implemented for many open tabs (or planned for V0.5)
- [ ] Large file (>10MB) degradation mode is in place
- [ ] React selectors prevent unnecessary re-renders
- [ ] Startup time measured and under target
- [ ] Rust async I/O used (no blocking calls)
- [ ] Shiki/Mermaid/KaTeX loaded asynchronously/lazily
- [ ] Scroll performance is smooth (60fps)
- [ ] No synchronous layout thrashing (reading offsetHeight then immediately writing DOM)
- [ ] Debounced inputs (search, auto-save, file watcher)
