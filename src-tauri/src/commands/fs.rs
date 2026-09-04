//! File system commands: open, save, read directory, create, delete, rename, exists.

use crate::error::AppResult;
use crate::models::FileInfo;
use crate::services::file_manager;
use crate::services::recent_files;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_file(
    path: String,
    encoding: Option<String>,
    app_handle: tauri::AppHandle,
) -> AppResult<crate::models::FileContent> {
    let content = file_manager::open_file(&path, encoding.as_deref()).await?;
    recent_files::add(&app_handle, &content.path);
    Ok(content)
}

#[tauri::command]
pub async fn save_file(path: String, content: String, encoding: String) -> AppResult<()> {
    file_manager::save_file(&path, &content, &encoding).await
}

#[tauri::command]
pub async fn create_file(path: String) -> AppResult<crate::models::FileContent> {
    file_manager::create_file(&path).await
}

#[tauri::command]
pub async fn read_directory(path: String) -> AppResult<Vec<FileInfo>> {
    file_manager::read_directory(&path).await
}

#[tauri::command]
pub async fn delete_file(path: String) -> AppResult<()> {
    file_manager::delete_file(&path).await
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> AppResult<()> {
    file_manager::rename_file(&old_path, &new_path).await
}

#[tauri::command]
pub async fn exists_file(path: String) -> AppResult<bool> {
    file_manager::exists(&path).await
}

/// Show a native save dialog and return the chosen path (or `null` if cancelled).
#[tauri::command]
pub async fn show_save_dialog(
    default_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> AppResult<Option<String>> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app_handle.dialog().file();
    builder = builder
        .add_filter("Markdown", &["md", "markdown", "mkd", "mdown"])
        .add_filter("Plain Text", &["txt"])
        .add_filter("All Files", &["*"]);
    if let Some(dp) = default_path {
        builder = builder.set_file_name(dp);
    }
    builder.save_file(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.await.map_err(|_| crate::error::AppError::DialogCancelled)
}
