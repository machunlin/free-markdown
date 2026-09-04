//! File watcher commands.
//!
//! V0.1 simple implementation: uses a per-process `notify` watcher via a global
//! lazy handle. Events are emitted to the frontend as `file-changed`.

use std::path::Path;
use std::sync::Mutex;

use crate::error::AppResult;
use crate::services::file_watcher::WatcherHandle;

fn global_watcher() -> &'static Mutex<WatcherHandle> {
    use std::sync::OnceLock;
    static W: OnceLock<Mutex<WatcherHandle>> = OnceLock::new();
    W.get_or_init(|| Mutex::new(WatcherHandle::new()))
}

#[tauri::command]
pub fn watch_file(path: String, app_handle: tauri::AppHandle) -> AppResult<()> {
    let mut guard = global_watcher().lock().unwrap();
    if guard.thread.is_none() {
        guard
            .bind(app_handle)
            .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;
    }
    let p = Path::new(&path);
    guard
        .watch(p)
        .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(path: String) -> AppResult<()> {
    let guard = global_watcher().lock().unwrap();
    guard
        .unwatch(Path::new(&path))
        .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;
    Ok(())
}
