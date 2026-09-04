# Tauri Development Skill

## When to Use

Load this skill when working on:
- Rust backend code in `src-tauri/`
- Tauri commands (IPC handlers)
- Tauri 2 capabilities and permissions
- Window management, menus, system tray
- File system operations in Rust
- Cargo.toml dependencies
- `tauri.conf.json` configuration
- App lifecycle and initialization

## Tauri 2 Key Concepts

### Architecture

Tauri 2 follows a **strict process separation** model:
- **Main process (Rust):** Has access to OS APIs, filesystem, window management
- **WebView process (Web/React):** Rendered in a sandboxed WebView, communicates via IPC

### Commands (IPC)

Commands are the primary way frontend calls backend:

```rust
// In src-tauri/src/commands/fs.rs
#[tauri::command]
pub async fn open_file(path: String, encoding: Option<String>) -> Result<FileContent, AppError> {
    // 1. Validate and canonicalize path
    // 2. Detect encoding if not specified
    // 3. Read file bytes
    // 4. Decode to UTF-8
    // 5. Return structured result
}

// Register in lib.rs:
.invoke_handler(tauri::generate_handler![
    commands::fs::open_file,
    commands::fs::save_file,
    // ...
])
```

**Command rules:**
- All commands are `async` by default (use `#[tauri::command]` async fn)
- Parameters must implement `serde::Deserialize`
- Return `Result<T, AppError>` where `AppError: Serialize`
- Never trust path strings from frontend — canonicalize and validate
- Register ALL commands explicitly (no wildcards)

### Capabilities (Tauri 2 Security)

Tauri 2 uses **capability-based security** instead of allowlist flags.

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read-file",
    "fs:allow-write-file",
    {
      "identifier": "fs:allow-read-file",
      "allow": [{ "path": "$DOCUMENT/**" }]
    }
  ]
}
```

**Capability rules:**
- Define scoped permissions, never use global allow
- Separate capabilities per window if multiple windows exist
- File system access must be scoped to user-selected directories
- Read `docs/SECURITY.md` before modifying capabilities

### State Management

```rust
// Use Tauri state for shared resources
pub struct AppState {
    pub file_watcher: Mutex<Option<FileWatcher>>,
    pub recent_files: Mutex<Vec<RecentFile>>,
}

// Manage in lib.rs:
.manage(AppState::default())

// Access in commands:
fn some_command(state: State<'_, AppState>) -> Result<(), AppError> {
    let watcher = state.file_watcher.lock().unwrap();
    Ok(())
}
```

### Events (Backend → Frontend)

```rust
// Emit from Rust:
app.emit("file-changed", FileChangedEvent { path, content })?;

// Listen in React/TypeScript:
import { listen } from '@tauri-apps/api/event';
await listen<FileChangedEvent>('file-changed', (event) => {
    // handle event
});
```

Use events for: file watcher notifications, external file changes, window state changes.

## Project-Specific Rust Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Entry point, minimal setup
│   ├── lib.rs               # App builder, command registration, state setup
│   ├── commands/            # IPC command handlers
│   │   ├── mod.rs
│   │   ├── fs.rs            # File open/save/read operations
│   │   ├── encoding.rs      # Encoding detection/conversion
│   │   ├── dialog.rs        # Native dialog wrappers
│   │   └── window.rs        # Window management commands
│   ├── services/            # Business logic (called by commands)
│   │   ├── mod.rs
│   │   ├── file_manager.rs  # File read/write/auto-save logic
│   │   ├── encoding_detector.rs  # chardetng wrapper
│   │   ├── file_watcher.rs  # File system watcher (notify)
│   │   └── recent_files.rs  # Recent files tracking
│   ├── models/              # Data structures (serde-serializable)
│   │   ├── mod.rs
│   │   ├── file.rs          # FileContent, FileInfo
│   │   └── tab.rs           # TabState (backend representation if needed)
│   ├── error.rs             # AppError type using thiserror
│   └── menu.rs              # Native menu bar definition
```

## Key Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "devtools"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"  # Scoped tightly if used
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
chardetng = "0.1"          # Encoding detection
encoding_rs = "0.8"        # Encoding conversion
notify = "6"               # File watching
thiserror = "1"            # Error types
tracing = "0.1"            # Structured logging
tracing-subscriber = "0.3"
```

## Common Patterns

### File Reading with Encoding Detection

```rust
use chardetng::EncodingDetector;
use encoding_rs::{Encoding, UTF_8};

pub async fn read_file_with_encoding(path: &Path) -> Result<(String, &'static Encoding), AppError> {
    let bytes = tokio::fs::read(path).await?;

    // Detect encoding
    let mut detector = EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);

    // Decode
    let (cow, actual_encoding, had_errors) = encoding.decode(&bytes);

    if had_errors && encoding != UTF_8 {
        // Fallback to UTF-8 with replacement
        let (cow_utf8, _, _) = UTF_8.decode(&bytes);
        return Ok((cow_utf8.into_owned(), UTF_8));
    }

    Ok((cow.into_owned(), actual_encoding))
}
```

### File Watching

```rust
use notify::{RecommendedWatcher, Watcher, RecursiveMode};
use std::path::PathBuf;

pub struct FileWatcher {
    watcher: RecommendedWatcher,
    watched_paths: Vec<PathBuf>,
}

impl FileWatcher {
    pub fn new(app_handle: tauri::AppHandle) -> Result<Self, AppError> {
        let watcher = notify::recommended_watcher(move |res| {
            if let Ok(event) = res {
                // Emit Tauri event to frontend
                let _ = app_handle.emit("watcher-event", &event);
            }
        })?;
        Ok(Self { watcher, watched_paths: vec![] })
    }
}
```

### Menu Setup

```rust
// src-tauri/src/menu.rs
use tauri::{Menu, Submenu, MenuItem, PredefinedMenuItem, AboutMetadata};

pub fn build_menu(app: &AppHandle) -> Menu<Wry> {
    let app_name = app.package_info().name.clone();
    Menu::new()
        .add_submenu(Submenu::new(&app_name,
            Menu::new()
                .add_native_item(PredefinedMenuItem::about(Some(&app_name), Some(AboutMetadata::default())))
                .add_native_item(PredefinedMenuItem::separator())
                .add_native_item(PredefinedMenuItem::services(None))
                .add_native_item(PredefinedMenuItem::separator())
                .add_native_item(PredefinedMenuItem::hide(None))
                .add_native_item(PredefinedMenuItem::hide_others(None))
                .add_native_item(PredefinedMenuItem::show_all(None))
                .add_native_item(PredefinedMenuItem::separator())
                .add_native_item(PredefinedMenuItem::quit(None))
        ))
        .add_submenu(Submenu::new("File", /* file menu items */))
        .add_submenu(Submenu::new("Edit", /* edit menu items */))
        .add_submenu(Submenu::new("View", /* view menu items */))
        .add_submenu(Submenu::new("Window", /* window menu items */))
}
```

## Error Handling Pattern

```rust
// src-tauri/src/error.rs
use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug, Serialize)]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Encoding detection failed")]
    EncodingDetectionFailed,

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Tauri error: {0}")]
    Tauri(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => AppError::FileNotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied(e.to_string()),
            _ => AppError::Io(e.to_string()),
        }
    }
}

// Implement for Tauri command error support
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

## Checklist Before Committing Rust Code

- [ ] No `.unwrap()` in production code (except documented invariants)
- [ ] All commands return `Result<T, AppError>`
- [ ] All file paths are canonicalized and validated
- [ ] Async for I/O operations
- [ ] Clippy passes with zero warnings
- [ ] `cargo fmt` run
- [ ] Unit tests for new services
- [ ] Capabilities updated if new permissions needed
- [ ] TypeScript types in `src/core/ipc/` match Rust types
- [ ] `tracing::info/debug/warn/error` used instead of `println!`
