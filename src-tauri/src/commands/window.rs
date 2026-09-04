//! Window management commands.

use tauri::{AppHandle, Manager};

use crate::error::AppResult;

#[tauri::command]
pub fn set_title(title: String, app_handle: AppHandle) -> AppResult<()> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_title(&title)?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_fullscreen(app_handle: AppHandle) -> AppResult<()> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let is_full = window.is_fullscreen()?;
        window.set_fullscreen(!is_full)?;
    }
    Ok(())
}
