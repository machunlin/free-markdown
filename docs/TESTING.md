# FreeMarkdown Testing Strategy

> Last updated: 2026-09-03

## Testing Philosophy

Tests are first-class citizens. Every feature must include tests as part of its implementation.

**Core principles:**
1. **Write tests alongside code**, not after. When implementing a feature, write tests in the same session.
2. **Test behavior, not implementation.** Test what the code does, not how it does it.
3. **Fast feedback.** Unit tests must run in seconds. Integration tests should be reasonable.
4. **Deterministic.** No flaky tests. Tests must produce the same result every time.
5. **Realistic mocks.** Mock external systems (filesystem via Tauri, timers), but test real logic.

## Test Pyramid

```
         ╱╲
        ╱  ╲        E2E tests (Playwright) — critical user workflows
       ╱ E2E╲       ~5-10 tests for V0.1; grows with releases
      ╱──────╲
     ╱Integration╲ Integration tests — Rust command tests, IPC roundtrips
    ╱────────────╲ ~1-2 per command; V0.1: ~15-20 tests
   ╱  Component    ╲ Component tests — React components with user interactions
  ╱────────────────╲ ~per component; V0.1: ~30-50 tests
 ╱    Unit Tests    ╲ Unit tests — stores, hooks, utilities, services
╱────────────────────╲ V0.1: ~100+ tests
```

## Frontend Testing Tools

- **Test runner:** Vitest
- **Assertion library:** Vitest (chai-compatible `expect`)
- **Component testing:** React Testing Library (`@testing-library/react`)
- **DOM assertions:** `@testing-library/jest-dom`
- **User events:** `@testing-library/user-event`
- **Mocking:** Vitest built-in mocks (`vi.fn()`, `vi.mock()`)
- **E2E (V1.0+):** Playwright
- **Coverage:** v8 via Vitest

## Backend Testing Tools

- **Unit tests:** Built-in Rust `#[test]` + `#[cfg(test)]`
- **Async tests:** `tokio::test`
- **Integration tests:** Files in `src-tauri/tests/`
- **Tauri command tests:** `tauri::test::mock_app()` + calling commands directly
- **Temporary files:** `tempfile` crate
- **Assertions:** Standard Rust `assert!()`, `assert_eq!()`
- **Linting:** Clippy (`cargo clippy --all-targets --all-features -- -D warnings`)

## Directory Structure for Tests

```
src/
├── stores/
│   ├── workspace-store.ts
│   └── __tests__/
│       └── workspace-store.test.ts
├── hooks/
│   ├── useAutoSave.ts
│   └── __tests__/
│       └── useAutoSave.test.ts
├── components/
│   ├── tabs/
│   │   ├── TabBar.tsx
│   │   └── __tests__/
│   │       └── TabBar.test.tsx
│   └── ...
├── core/
│   ├── markdown/
│   │   ├── createRenderer.ts
│   │   └── __tests__/
│   │       └── createRenderer.test.ts
│   └── encoding/
│       ├── detect.ts
│       └── __tests__/
│           └── detect.test.ts
└── test/
    ├── setup.ts            # Vitest setup (jsdom, mocks)
    └── utils.tsx           # Test utilities (renderWithStore, etc.)

src-tauri/
├── src/
│   ├── services/
│   │   ├── file_manager.rs
│   │   └── tests/          # Inline #[cfg(test)] modules
│   │       └── mod.rs
│   └── commands/
│       └── fs.rs           # Tests can be inline in same file
└── tests/                  # Integration tests directory
    ├── fs_commands.rs
    └── encoding.rs
```

## What to Test (by priority)

### Critical (Must test for V0.1)
- Store state transitions (opening, closing, switching tabs; dirty state; save)
- File open/save IPC commands (with mocked Tauri invoke on frontend, with temp files on backend)
- Encoding detection/decoding (UTF-8, GBK, edge cases with BOM)
- Path validation (traversal attacks)
- Markdown parsing (headings, paragraphs, code blocks, links, tables in GFM mode)
- Keyboard shortcut handling
- Debounce logic for preview and auto-save
- Error states (file not found, permission denied, encoding failure)

### Important (Should test for V0.1)
- Component rendering (tabs show dirty indicator, toolbar buttons)
- User interactions (click tab, click close, type in editor)
- File watcher debouncing
- Settings persistence
- Theme switching (light/dark CSS variables applied)

### Nice to have (V0.5+)
- E2E tests (open app → create file → type → save → close → reopen)
- Performance benchmarks (large file open time)
- Visual regression tests

## Test Examples

### Testing a Store

```ts
// src/stores/__tests__/workspace-store.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../workspace-store';

beforeEach(() => {
  useWorkspaceStore.setState({ tabs: [], activeTabId: null, recentFiles: [] }, true);
});

describe('workspace store', () => {
  it('creates a new untitled tab', () => {
    useWorkspaceStore.getState().createNewTab();
    const { tabs, activeTabId } = useWorkspaceStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe('Untitled');
    expect(tabs[0].isDirty).toBe(false);
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('marks tab dirty when content differs from original', () => {
    const { createNewTab, updateTabContent } = useWorkspaceStore.getState();
    createNewTab();
    const tabId = useWorkspaceStore.getState().tabs[0].id;
    updateTabContent(tabId, 'modified content');
    expect(useWorkspaceStore.getState().tabs[0].isDirty).toBe(true);
  });

  it('closes the active tab and activates the next one', () => {
    const { createNewTab, closeTab } = useWorkspaceStore.getState();
    createNewTab(); createNewTab(); createNewTab();
    const tabs = useWorkspaceStore.getState().tabs;
    closeTab(tabs[0].id);
    const newState = useWorkspaceStore.getState();
    expect(newState.tabs).toHaveLength(2);
    expect(newState.activeTabId).toBe(newState.tabs[0].id);
  });
});
```

### Testing a Component

```tsx
// src/components/tabs/__tests__/TabBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from '../TabBar';
import { useWorkspaceStore } from '@/stores/workspace-store';

describe('TabBar', () => {
  it('shows dirty dot for unsaved tabs', () => {
    useWorkspaceStore.setState({
      tabs: [
        { id: '1', title: 'saved.md', isDirty: false, content: '', /* ... */ } as any,
        { id: '2', title: 'unsaved.md', isDirty: true, content: '', /* ... */ } as any,
      ],
      activeTabId: '1',
    });

    render(<TabBar />);
    const unsavedTab = screen.getByText('unsaved.md').closest('.tab-item');
    expect(unsavedTab?.textContent).toContain('●');
  });

  it('activates tab on click', () => {
    const store = useWorkspaceStore.getState();
    render(<TabBar />);
    fireEvent.click(screen.getByText('unsaved.md'));
    expect(useWorkspaceStore.getState().activeTabId).toBe('2');
  });
});
```

### Testing Rust Service

```rust
// src-tauri/src/services/encoding_detector.rs
#[cfg(test)]
mod tests {
    use super::*;
    use encoding_rs::UTF_8;

    #[test]
    fn detects_utf8_with_bom() {
        let bytes = b"\xEF\xBB\xBFHello World";
        let (enc, confidence) = detect_encoding(bytes);
        assert_eq!(enc, UTF_8);
        assert!(confidence > 0.9);
    }

    #[test]
    fn detects_gbk_chinese_text() {
        let bytes = &[0xC4, 0xE3, 0xBA, 0xC3, 0xCA, 0xC0, 0xBD, 0xE7]; // 你好世界 in GBK
        let (enc, confidence) = detect_encoding(bytes);
        assert!(enc.name().eq_ignore_ascii_case("GBK") || enc.name().eq_ignore_ascii_case("GB18030"));
        assert!(confidence > 0.5);
    }

    #[test]
    fn falls_back_to_utf8_for_empty_input() {
        let (enc, _) = detect_encoding(b"");
        assert_eq!(enc, UTF_8);
    }
}
```

### Testing Path Validation (Security)

```rust
#[test]
fn blocks_path_traversal() {
    assert!(validate_path("../../../etc/passwd").is_err());
    assert!(validate_path("..\\..\\Windows\\System32").is_err());
}

#[test]
fn blocks_null_bytes() {
    assert!(validate_path("/tmp/file\0.md").is_err());
}

#[test]
fn allows_valid_absolute_paths() {
    let temp = tempfile::NamedTempFile::new().unwrap();
    assert!(validate_path(temp.path().to_str().unwrap()).is_ok());
}
```

## Running Tests

### Frontend

```bash
pnpm test                    # Run all tests once
pnpm test -- --watch         # Watch mode (TDD)
pnpm test -- --coverage      # Run with coverage report
pnpm test path/to/file.test.ts  # Run specific test file
pnpm tsc --noEmit            # Type checking (no code emit)
pnpm lint                    # ESLint
```

### Backend

```bash
cargo test                   # All tests
cargo test --lib             # Library unit tests only
cargo test --test commands   # Integration tests in tests/commands.rs
cargo test encoding          # Tests matching "encoding"
cargo clippy -- -D warnings  # Linting (warnings are errors)
cargo fmt --check            # Format check
cargo fmt                    # Auto-format
```

### Full Test Suite (CI)

```bash
# Frontend
pnpm install --frozen-lockfile
pnpm tsc --noEmit
pnpm lint
pnpm test -- --run --coverage

# Backend
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all
```

## Coverage Targets

| Metric | Target (V0.1) | Target (V1.0) |
|---|---|---|
| Statements | 60% | 75% |
| Branches | 50% | 65% |
| Functions | 60% | 75% |
| Lines | 60% | 75% |
| Rust coverage | Not enforced in V0.1 | 70% |

Focus coverage on business logic and security-critical code. UI components can have lower coverage as long as critical interactions are tested.

## CI Pipeline (Future)

For GitHub Actions:

1. **Install:** pnpm install, cargo fetch
2. **Frontend checks:** tsc type check, ESLint, Vitest with coverage
3. **Backend checks:** cargo fmt check, cargo clippy, cargo test
4. **Build:** pnpm tauri build (to verify no build errors)
5. **Report:** Upload coverage, report build status

## Definition of Test Completeness

A feature's tests are complete when:

- [ ] Happy path works
- [ ] Error cases produce correct errors/messages
- [ ] Edge cases handled (empty input, very large input, invalid input)
- [ ] All store actions have corresponding tests
- [ ] Security-critical code has specific test cases for attacks (path traversal, XSS)
- [ ] Tests are isolated (no state leakage between tests)
- [ ] Tests are fast (< 1 second per file, ideally)
- [ ] Tests don't depend on network, real filesystem (except Rust integration tests using tempdir)
- [ ] No skipped tests without a tracking issue
