//! Recent files commands.

use crate::error::AppResult;
use crate::services::recent_files;

#[tauri::command]
pub fn get_recent_files(app_handle: tauri::AppHandle) -> AppResult<Vec<String>> {
    Ok(recent_files::get(&app_handle))
}

#[tauri::command]
pub fn add_recent_file(path: String, app_handle: tauri::AppHandle) -> AppResult<()> {
    recent_files::add(&app_handle, &path);
    Ok(())
}

#[tauri::command]
pub fn clear_recent_files(app_handle: tauri::AppHandle) -> AppResult<()> {
    recent_files::clear(&app_handle);
    Ok(())
}
