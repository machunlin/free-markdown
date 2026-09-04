# Code Review Skill

## When to Use

Use this skill:
- Before every commit (self-review)
- When reviewing AI-generated code
- When reviewing PRs
- When code "works" but feels off
- After completing a feature (pre-commit checklist)
- Before merging to develop/main

## Review Process

Follow this order when reviewing code:

1. **Correctness** — Does it work? Does it handle errors? Edge cases?
2. **Security** — Any vulnerabilities? See security-review skill.
3. **Performance** — Any obvious performance issues? See performance-review skill.
4. **Architecture** — Does it fit the project structure? Follow separation of concerns?
5. **Type safety** — Any `any`? Proper TypeScript/Rust types?
6. **Style** — Follows coding conventions? Consistent naming?
7. **Tests** — Are there tests? Do they cover the critical paths?
8. **Documentation** — Comments for non-obvious code? Docs updated?

## Self-Review Checklist (Run Before Every Commit)

### General
- [ ] Code compiles/builds without errors
- [ ] No `console.log`, `println!`, `dbg!` left in production code
- [ ] No commented-out code
- [ ] No TODO/FIXME without an issue number
- [ ] Code is formatted (prettier / `cargo fmt`)
- [ ] No dead code (unused imports, variables, functions)
- [ ] Error states handled (not just happy path)
- [ ] Loading states handled for async operations
- [ ] Magic numbers replaced with named constants

### TypeScript/React
- [ ] `tsc --noEmit` passes with zero errors
- [ ] No `any` types (or `any` has justification comment)
- [ ] Props interfaces defined for all components
- [ ] No direct state mutation (using setState/set/immer)
- [ ] useEffect dependency arrays are correct and complete
- [ ] No `index` as key for dynamic lists
- [ ] Event handlers use `useCallback` when passed to children
- [ ] Expensive computations use `useMemo`
- [ ] Zustand selectors are granular (avoid returning entire state)
- [ ] Components are reasonably sized (< 200-300 lines; split if larger)
- [ ] No prop drilling beyond 2 levels (use stores or context)
- [ ] Accessibility: semantic HTML, aria-labels on icon-only buttons, keyboard navigation
- [ ] Responsive to errors (error boundaries, try/catch for async)

### Rust/Tauri
- [ ] `cargo build` and `cargo clippy` pass with zero warnings
- [ ] No `.unwrap()` in production code (use `?`, `.expect()` with message, or match)
- [ ] All Tauri commands return `Result<T, AppError>`
- [ ] All file paths are validated/canonicalized
- [ ] Async used for I/O (no blocking calls on main thread)
- [ ] Custom error type used (not `Box<dyn Error>`)
- [ ] `tracing` used instead of `println!`
- [ ] Unsafe code documented with `// SAFETY:` comment
- [ ] Serialize/Deserialize derived correctly for command types
- [ ] Capability file updated if new permissions needed

### Security (Quick Check)
- [ ] No HTML rendered without sanitization (DOMPurify)
- [ ] No wildcard Tauri permissions
- [ ] No shell execution
- [ ] External links open in system browser
- [ ] Paths validated before use
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No `eval()` or dynamic code execution

### Performance (Quick Check)
- [ ] Preview render debounced
- [ ] No unnecessary re-renders (React DevTools check)
- [ ] Large files handled (degradation mode)
- [ ] Event listeners cleaned up
- [ ] Heavy work not on main thread (Web Workers / async)
- [ ] No O(n²) algorithms on unbounded data (e.g., no nested loops over file contents)

### Tests
- [ ] Tests added for new code
- [ ] Tests cover happy path, error cases, edge cases
- [ ] Tests are deterministic (no flaky tests)
- [ ] All tests pass
- [ ] Coverage not decreased

## Code Quality Patterns to Enforce

### Naming Conventions

**TypeScript/React:**
- Components: PascalCase (`EditorPane`, `TabBar`)
- Hooks: use + PascalCase (`useAutoSave`, `useCodeMirror`)
- Stores: kebab-case with `-store` suffix (`workspace-store.ts`)
- Utilities: kebab-case (`detect-encoding.ts`)
- Types/Interfaces: PascalCase (`Tab`, `FileContent`, `EditorProps`)
- Variables/Functions: camelCase (`openFile`, `activeTabId`)
- Constants: UPPER_SNAKE_CASE for truly constant values (`MAX_FILE_SIZE`, `DEBOUNCE_MS`)
- Boolean props: is/has/should prefix (`isDirty`, `hasUnsavedChanges`, `shouldAutoSave`)

**Rust:**
- Structs/Enums: PascalCase (`FileContent`, `AppError`)
- Functions/Variables: snake_case (`open_file`, `file_content`)
- Constants: UPPER_SNAKE_CASE (`MAX_FILE_SIZE_BYTES`)
- Commands: snake_case matching TypeScript names
- Error variants: PascalCase

### Error Handling

**TypeScript:**
- Use `try/catch` for async operations, show user-facing error messages
- Never silently swallow errors (`catch (e) {}` is bad; at least log it)
- Use typed errors where possible
- Show error UI (toast, dialog, inline error message) for user-relevant errors

**Rust:**
- Use `thiserror` for library error enums
- Use `?` operator for propagation (avoid `unwrap()`)
- When using `expect()`, provide a meaningful message that explains why it can't fail
- Convert errors to `AppError` for Tauri command responses

### File Organization

Keep files focused. If a file exceeds ~300 lines, consider splitting:
- Extract sub-components
- Extract custom hooks
- Extract utility functions
- Extract business logic into separate files

### Import Order (TypeScript)

```ts
// 1. React and external libraries
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MarkdownIt from 'markdown-it';

// 2. Internal absolute imports (@/...)
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ipc } from '@/core/ipc/commands';
import type { Tab } from '@/types';

// 3. Relative imports
import { ToolbarButton } from './ToolbarButton';
import { useAutoSave } from '../../hooks/useAutoSave';

// 4. Style imports
import './EditorPane.css';
```

## Anti-Patterns to Reject

### TypeScript/React

1. **`any` type** — Use `unknown` and narrow, or define proper types.
   ```tsx
   // Bad
   const data: any = await response.json();
   // Good
   const data = await response.json() as FileContent;
   ```

2. **Props drilling** — Don't pass state through 3+ levels.
   ```tsx
   // Bad: <App> → <Layout> → <Sidebar> → <FileTree> → <FileItem> (props passed all the way)
   // Good: Use Zustand store for workspace state
   ```

3. **Missing cleanup in useEffect** — Event listeners, intervals, observers.
   ```tsx
   // Bad
   useEffect(() => {
     setInterval(autoSave, 5000);
   }, []);
   // Good
   useEffect(() => {
     const id = setInterval(autoSave, 5000);
     return () => clearInterval(id);
   }, []);
   ```

4. **Using index as key** — Especially for dynamic lists.
   ```tsx
   // Bad
   {tabs.map((tab, i) => <Tab key={i} ... />)}
   // Good
   {tabs.map(tab => <Tab key={tab.id} ... />)}
   ```

5. **Inline styles for non-dynamic values** — Use Tailwind classes.
   ```tsx
   // Bad
   <div style={{ display: 'flex', padding: '16px', color: '#333' }}>
   // Good
   <div className="flex p-4 text-gray-800">
   ```

6. **Direct state mutation** — Zustand/React state is immutable.
   ```tsx
   // Bad
   get().tabs.push(newTab);
   // Good
   set(state => ({ tabs: [...state.tabs, newTab] }));
   ```

7. **`useEffect` for derived state** — Compute during render or use `useMemo`.
   ```tsx
   // Bad
   const [wordCount, setWordCount] = useState(0);
   useEffect(() => { setWordCount(countWords(content)); }, [content]);
   // Good
   const wordCount = useMemo(() => countWords(content), [content]);
   ```

### Rust

1. **`.unwrap()` on user input** — Never unwrap values that come from frontend or files.
2. **`.clone()` when not needed** — Use references `&` where possible.
3. **Stringly-typed errors** — Use `thiserror` enum with typed variants.
4. **Mixing concerns in commands** — Commands should call services, not contain all logic.
5. **Using `std::fs` instead of `tokio::fs`** in async functions.
6. **Missing error propagation** — Don't `.unwrap()` or `.expect()` in fallible code paths.

## Review Outcome Template

After reviewing code, provide:

1. **Summary** — What was changed? Does it work?
2. **Blocking issues** — Must fix before merge (bugs, security, compile errors)
3. **Non-blocking suggestions** — Nice to have improvements (style, naming, minor optimizations)
4. **Missing tests** — What test cases should be added
5. **Approval status** — Approved / Needs changes / Needs discussion
