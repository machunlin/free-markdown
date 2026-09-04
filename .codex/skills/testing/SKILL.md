# Testing Skill

## When to Use

Load this skill when:
- Writing unit tests for frontend (Vitest)
- Writing unit tests for backend (Rust tests)
- Writing component tests (React Testing Library)
- Writing integration tests
- Setting up test infrastructure
- Fixing test failures
- Running tests before commits
- Configuring CI testing
- Writing E2E tests (Playwright, V1.0+)

## Testing Philosophy

**Tests are non-negotiable.** Every feature must have tests. AI agents must write tests alongside implementation — not after.

The testing pyramid for FreeMarkdown:

```
           ╱╲
          ╱  ╲         E2E Tests (small number, critical paths)
         ╱ E2E╲
        ╱──────╲       Integration Tests (IPC, commands, file operations)
       ╱ Integ  ╲
      ╱──────────╲     Component Tests (React components, user interactions)
     ╱ Component  ╲
    ╱──────────────╲   Unit Tests (utilities, stores, hooks, services)
   ╱   Unit Tests   ╲
  ╱──────────────────╲
```

## Frontend Testing (Vitest + React Testing Library)

### Configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Setup

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock matchMedia for dark mode testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### Testing Zustand Stores

```ts
// src/stores/__tests__/workspace-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../workspace-store';
import { invoke } from '@tauri-apps/api/core';

// Reset store between tests
beforeEach(() => {
  useWorkspaceStore.setState({
    tabs: [],
    activeTabId: null,
  });
});

describe('workspace store', () => {
  it('creates a new tab', () => {
    const { createNewTab, tabs, activeTabId } = useWorkspaceStore.getState();
    createNewTab();

    const state = useWorkspaceStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].title).toBe('Untitled');
    expect(state.tabs[0].isDirty).toBe(false);
    expect(state.activeTabId).toBe(state.tabs[0].id);
  });

  it('marks tab as dirty when content changes', () => {
    const { createNewTab, updateTabContent } = useWorkspaceStore.getState();
    createNewTab();
    const tabId = useWorkspaceStore.getState().tabs[0].id;

    updateTabContent(tabId, 'new content');

    const tab = useWorkspaceStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.isDirty).toBe(true);
    expect(tab?.content).toBe('new content');
  });

  it('closes tab and activates next tab', async () => {
    const { createNewTab, closeTab } = useWorkspaceStore.getState();
    createNewTab();
    createNewTab();
    createNewTab();
    const tabs = useWorkspaceStore.getState().tabs;
    expect(tabs).toHaveLength(3);

    await closeTab(tabs[0].id);
    const newState = useWorkspaceStore.getState();
    expect(newState.tabs).toHaveLength(2);
    expect(newState.activeTabId).toBe(newState.tabs[0].id);
  });
});
```

### Testing React Components

```tsx
// src/components/tabs/__tests__/TabBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from '../TabBar';
import { useWorkspaceStore } from '@/stores/workspace-store';

describe('TabBar', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      tabs: [
        { id: '1', title: 'file1.md', isDirty: false, content: '', /* ... */ },
        { id: '2', title: 'file2.md', isDirty: true, content: '', /* ... */ },
      ],
      activeTabId: '1',
    });
  });

  it('renders all tabs', () => {
    render(<TabBar />);
    expect(screen.getByText('file1.md')).toBeTruthy();
    expect(screen.getByText('file2.md')).toBeTruthy();
  });

  it('shows dirty indicator for unsaved tabs', () => {
    render(<TabBar />);
    // file2 is dirty, should have a dot
    const dirtyTab = screen.getByText('file2.md').closest('.tab-item');
    expect(dirtyTab?.textContent).toContain('●');
  });

  it('calls setActiveTab when clicking a tab', () => {
    render(<TabBar />);
    fireEvent.click(screen.getByText('file2.md'));
    expect(useWorkspaceStore.getState().activeTabId).toBe('2');
  });
});
```

### Testing Custom Hooks

```tsx
// src/hooks/__tests__/useAutoSave.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-saves after interval when dirty', () => {
    const saveFile = vi.fn();
    vi.spyOn(useWorkspaceStore, 'getState').mockReturnValue({
      saveFile,
      // ... other state
    } as any);

    renderHook(() => useAutoSave({
      tabId: 'test',
      content: 'hello',
      isDirty: true,
      saveInterval: 30000,
    }));

    expect(saveFile).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(30000); });
    expect(saveFile).toHaveBeenCalledWith('test', 'hello');
  });
});
```

### Testing Utilities (Pure Functions)

```ts
// src/core/encoding/__tests__/detect.test.ts
import { describe, it, expect } from 'vitest';
import { detectEncoding } from '../detect';

describe('encoding detection', () => {
  it('detects UTF-8 with BOM', () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, 0x68, 0x65, 0x6C, 0x6C, 0x6F]);
    const result = detectEncoding(bytes);
    expect(result.encoding).toBe('UTF-8');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('detects GBK encoded Chinese text', () => {
    // GBK encoded "你好世界"
    const bytes = new Uint8Array([0xC4, 0xE3, 0xBA, 0xC3, 0xCA, 0xC0, 0xBD, 0xE7]);
    const result = detectEncoding(bytes);
    expect(result.encoding).toBe('GBK');
  });
});
```

## Backend Testing (Rust)

### Unit Tests

```rust
// src-tauri/src/services/encoding_detector.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_utf8_with_bom() {
        let bytes = b"\xEF\xBB\xBFHello World";
        let (encoding, confidence) = detect_encoding(bytes);
        assert_eq!(encoding, UTF_8);
        assert!(confidence > 0.9);
    }

    #[test]
    fn test_detect_gbk_chinese() {
        // "你好" in GBK
        let bytes = &[0xC4, 0xE3, 0xBA, 0xC3];
        let (encoding, confidence) = detect_encoding(bytes);
        assert_eq!(encoding.name(), "GBK");
        assert!(confidence > 0.7);
    }

    #[test]
    fn test_decode_utf8() {
        let bytes = "Hello, 世界".as_bytes();
        let (content, enc) = decode_bytes(bytes, None).unwrap();
        assert_eq!(content, "Hello, 世界");
        assert_eq!(enc, UTF_8);
    }

    #[test]
    fn test_path_traversal_blocked() {
        let result = validate_path("../../../etc/passwd");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidPath(_)));
    }
}
```

### Integration Tests (Commands)

```rust
// src-tauri/tests/commands_test.rs
use tauri::test::{mock_app, mock_context};
use freemarkdown::commands::fs;

#[tokio::test]
async fn test_open_file_command() {
    let app = mock_app();
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("test.md");
    std::fs::write(&file_path, "# Hello\n\nWorld").unwrap();

    let result = fs::open_file(
        file_path.to_str().unwrap().to_string(),
        None,
    ).await;

    assert!(result.is_ok());
    let content = result.unwrap();
    assert_eq!(content.encoding, "UTF-8");
    assert!(content.content.contains("# Hello"));
}

#[tokio::test]
async fn test_save_file_preserves_encoding() {
    // Open GBK file, modify, save — should remain GBK
}
```

## Test Commands

```bash
# Frontend
pnpm test                    # Run all tests once
pnpm test -- --watch         # Watch mode
pnpm test -- --coverage      # With coverage
pnpm tsc --noEmit           # Type check (no emit)
pnpm lint                    # ESLint

# Backend
cargo test                   # Run all Rust tests
cargo test --lib             # Library tests only
cargo test commands::        # Command tests only
cargo clippy                 # Linting
cargo fmt --check            # Format check
```

## What to Test vs. What Not to Test

**Test:**
- All Zustand store actions and state transitions
- Custom hooks (especially with timers, effects, IPC)
- Pure utility functions (encoding, path handling, keyboard shortcuts)
- Complex component interactions (tabs, editor mode switches, command palette)
- All Rust services (encoding, file manager, path validation)
- All IPC commands (integration tests)
- File open/save round-trips (especially encoding preservation)
- Security-critical code (path traversal, permission checks)

**Do NOT waste time testing:**
- Trivial presentational components (static rendering with no logic)
- Third-party library behavior (CodeMirror, markdown-it — trust them)
- Exact snapshot tests of large DOM trees (fragile, low value)
- Implementation details (test behavior, not internals)

## Definition of Done for Tests

A feature's tests are complete when:
- [ ] Happy path tested
- [ ] Error cases tested (file not found, permission denied, invalid encoding)
- [ ] Edge cases tested (empty file, very large file, binary file opened as text)
- [ ] All store state transitions covered
- [ ] Tests are deterministic (no random failures, no real network calls)
- [ ] Tests run quickly (< 1 second per file)
- [ ] Tests are isolated (no shared state between tests)
- [ ] Mock external dependencies (Tauri APIs, filesystem)
- [ ] Coverage does not decrease
