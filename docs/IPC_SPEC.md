# FreeMarkdown IPC Specification

> This document is the **authoritative contract** between frontend (React/TypeScript) and backend (Rust/Tauri).
> Last updated: 2026-09-03

## Overview

Communication between frontend and backend uses Tauri 2's IPC system:
- **Commands:** Frontend invokes a Rust function and awaits a response (`invoke('command_name', args)`).
- **Events:** Backend emits events to frontend (`app.emit('event_name', payload)`) for push notifications (file watcher, etc.).

All commands are async. All return `Result<T, AppError>`. All parameters and return types are serializable via serde.

---

## Type Definitions (Shared)

These types exist in both TypeScript (`src/core/ipc/types.ts`) and Rust (`src-tauri/src/models/`). They MUST stay in sync.

### FileContent

```ts
interface FileContent {
  path: string;        // Absolute path
  content: string;     // UTF-8 decoded content
  encoding: string;    // Encoding label (e.g., "UTF-8", "GBK")
  modified: number;    // Modification timestamp (ms since Unix epoch)
  size: number;        // File size in bytes
}
```

### FileInfo

```ts
interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
}
```

### EncodingDetectResult

```ts
interface EncodingDetectResult {
  encoding: string;
  confidence: number;  // 0.0 to 1.0
}
```

### FileChangedEvent

```ts
interface FileChangedEvent {
  path: string;
  kind: 'modified' | 'deleted' | 'created' | 'renamed';
  modified: number;
}
```

---

## Commands

### File Operations

#### `open_file`

Opens a file, detects encoding, returns UTF-8 content.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to the file |
| encoding | string | No | Force specific encoding (skip auto-detection) |

**Returns:** `FileContent`

**Errors:** `FileNotFound`, `PermissionDenied`, `InvalidPath`, `EncodingDetectionFailed`, `Io`

**Example:**
```ts
const file = await ipc.openFile('/Users/jun/Documents/note.md');
// { path: '/Users/jun/Documents/note.md', content: '# Hello\n...', encoding: 'UTF-8', ... }
```

---

#### `save_file`

Saves content to a file using the specified encoding.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to save to |
| content | string | Yes | UTF-8 content to save |
| encoding | string | Yes | Target encoding label |

**Returns:** `void`

**Errors:** `PermissionDenied`, `InvalidPath`, `Io`, `InvalidInput`

**Example:**
```ts
await ipc.saveFile({ path: '/Users/jun/Documents/note.md', content: '# Updated', encoding: 'UTF-8' });
```

---

#### `save_file_as`

Shows a save dialog and saves to user-selected location.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| content | string | Yes | UTF-8 content to save |
| defaultPath | string | No | Initial directory/filename |
| encoding | string | Yes | Target encoding label |

**Returns:** `string` (the path where the file was saved)

**Errors:** `PermissionDenied`, `Io`, `InvalidInput` (user cancelled → handled specially)

---

#### `read_directory`

Lists contents of a directory.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to directory |

**Returns:** `FileInfo[]` (sorted: directories first, then files alphabetically)

**Errors:** `FileNotFound`, `PermissionDenied`, `InvalidPath`, `Io`

---

#### `create_file`

Creates a new empty file at the specified path.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path for new file |

**Returns:** `FileContent` (empty content, UTF-8)

**Errors:** `PermissionDenied`, `InvalidPath`, `Io`

---

#### `delete_file`

Moves a file to trash (not permanent delete).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to file |

**Returns:** `void`

**Errors:** `FileNotFound`, `PermissionDenied`, `InvalidPath`, `Io`

---

#### `rename_file`

Renames/moves a file.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| oldPath | string | Yes | Current absolute path |
| newPath | string | Yes | New absolute path |

**Returns:** `void`

**Errors:** `FileNotFound`, `PermissionDenied`, `InvalidPath`, `Io`

---

#### `exists_file`

Checks if a file exists.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path |

**Returns:** `boolean`

---

### Encoding

#### `detect_encoding`

Detects encoding of a file without reading its full content into memory (reads a sample).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to file |

**Returns:** `EncodingDetectResult`

**Errors:** `FileNotFound`, `PermissionDenied`, `InvalidPath`, `Io`

---

#### `get_supported_encodings`

Returns list of supported encoding labels.

**Parameters:** None

**Returns:** `string[]` (e.g., `["UTF-8", "GBK", "GB18030", "Big5", "Shift_JIS", "EUC-KR"]`)

---

### File Watching

#### `watch_file`

Start watching a file for external changes.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to watch |

**Returns:** `void`

When a change is detected, backend emits a `file-changed` event (see Events section).

---

#### `unwatch_file`

Stop watching a file.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path to stop watching |

**Returns:** `void`

---

### Window Management

#### `set_title`

Sets the window title (usually shows current filename).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| title | string | Yes | New window title |

**Returns:** `void`

---

#### `toggle_fullscreen`

Toggles full-screen mode.

**Parameters:** None

**Returns:** `void`

---

#### `show_save_dialog`

Shows native save dialog (used internally; prefer the dialog plugin from frontend for simple cases).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| defaultPath | string | No | Initial path/filename |
| filters | object[] | No | File type filters |

**Returns:** `string | null` (selected path, or null if cancelled)

---

### Recent Files

#### `get_recent_files`

Returns list of recently opened files.

**Parameters:** None

**Returns:** `string[]` (paths, most recent first, max 20)

---

#### `add_recent_file`

Adds a file to recent files list (called internally by open_file usually).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| path | string | Yes | Absolute path |

**Returns:** `void`

---

#### `clear_recent_files`

Clears the recent files list.

**Parameters:** None

**Returns:** `void`

---

## Events (Backend → Frontend)

### `file-changed`

Emitted when a watched file is modified, deleted, or renamed on disk.

**Payload:** `FileChangedEvent`

```ts
// Frontend usage:
import { listen } from '@tauri-apps/api/event';

await listen<FileChangedEvent>('file-changed', (event) => {
  const { path, kind, modified } = event.payload;
  if (kind === 'modified') {
    // Show reload prompt if file is open
  } else if (kind === 'deleted') {
    // Show "file deleted" notification
  }
});
```

### `menu-event`

Emitted when a native menu item is selected (for items without built-in handling).

**Payload:** `{ id: string }` (the menu item ID)

---

## Frontend IPC Wrapper

All command invocations go through typed wrappers in `src/core/ipc/commands.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export const ipc = {
  // File operations
  openFile: (path: string, encoding?: string) =>
    invoke<FileContent>('open_file', { path, encoding }),

  saveFile: (args: { path: string; content: string; encoding: string }) =>
    invoke<void>('save_file', args),

  saveFileAs: (args: { content: string; defaultPath?: string; encoding: string }) =>
    invoke<string>('save_file_as', args),

  readDirectory: (path: string) =>
    invoke<FileInfo[]>('read_directory', { path }),

  createFile: (path: string) =>
    invoke<FileContent>('create_file', { path }),

  deleteFile: (path: string) =>
    invoke<void>('delete_file', { path }),

  renameFile: (oldPath: string, newPath: string) =>
    invoke<void>('rename_file', { oldPath, newPath }),

  fileExists: (path: string) =>
    invoke<boolean>('exists_file', { path }),

  // Encoding
  detectEncoding: (path: string) =>
    invoke<EncodingDetectResult>('detect_encoding', { path }),

  getSupportedEncodings: () =>
    invoke<string[]>('get_supported_encodings'),

  // File watching
  watchFile: (path: string) =>
    invoke<void>('watch_file', { path }),

  unwatchFile: (path: string) =>
    invoke<void>('unwatch_file', { path }),

  // Window
  setTitle: (title: string) =>
    invoke<void>('set_title', { title }),

  toggleFullscreen: () =>
    invoke<void>('toggle_fullscreen'),

  // Recent files
  getRecentFiles: () =>
    invoke<string[]>('get_recent_files'),

  addRecentFile: (path: string) =>
    invoke<void>('add_recent_file', { path }),

  clearRecentFiles: () =>
    invoke<void>('clear_recent_files'),
} as const;
```

## Adding New Commands

When adding a new command, follow this checklist:

1. Define the Rust command in `src-tauri/src/commands/`
2. Add the command to `AppError` if new error types are needed
3. Register the command in `lib.rs` `invoke_handler`
4. Add/update capability permissions if needed (rare for custom commands)
5. Add the TypeScript type in `src/core/ipc/types.ts`
6. Add the wrapper function in `src/core/ipc/commands.ts`
7. Update this document (`IPC_SPEC.md`)
8. Add integration tests for the command
