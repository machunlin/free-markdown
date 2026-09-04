//! File read/write service used by the `fs` commands.

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::FileContent;
use crate::services::encoding_detector;
use crate::services::path_util::{file_metadata, validate_parent_path, validate_path};

/// Open a file and return its content decoded to UTF-8.
pub async fn open_file(path_str: &str, encoding_override: Option<&str>) -> AppResult<FileContent> {
    let path = validate_path(path_str)?;
    read_with_encoding(&path, encoding_override).await
}

/// Create a new empty file at the given path and return its (empty) content.
pub async fn create_file(path_str: &str) -> AppResult<FileContent> {
    let path = validate_parent_path(path_str)?;
    if path.exists() {
        return Err(AppError::InvalidInput(format!(
            "File already exists: {}",
            path.display()
        )));
    }
    tokio::fs::write(&path, b"").await?;
    let canonical = path.canonicalize().map_err(|e| {
        AppError::Io(format!("Failed to canonicalize after create: {e}"))
    })?;
    read_with_encoding(&canonical, None).await
}

/// Save UTF-8 content to a file using the specified target encoding.
pub async fn save_file(path_str: &str, content: &str, encoding: &str) -> AppResult<()> {
    let path = validate_parent_path(path_str)?;
    // Safety: cap individual file saves at 100MB to avoid accidental blow-ups.
    if content.len() > 100_000_000 {
        return Err(AppError::InvalidInput("File too large to save".to_string()));
    }
    let (encoded, _) = encoding_detector::encode(content, encoding)?;
    // Atomic write: write to <path>.tmp then rename.
    let tmp = tmp_path(&path);
    tokio::fs::write(&tmp, &encoded).await?;
    tokio::fs::rename(&tmp, &path).await?;
    Ok(())
}

/// Read the directory entries at `path_str`, returning files first (alpha) then dirs?
/// Here we return dirs first, then files alphabetically within each group to match
/// Finder-like conventions.
pub async fn read_directory(path_str: &str) -> AppResult<Vec<crate::models::FileInfo>> {
    let path = validate_path(path_str)?;
    if !path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Not a directory: {}",
            path.display()
        )));
    }
    let mut entries = tokio::fs::read_dir(&path).await?;
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        let modified = meta
            .modified()
            .ok()
            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden dotfiles by default
        if name.starts_with('.') {
            continue;
        }
        let info = crate::models::FileInfo {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size,
            modified,
        };
        if info.is_dir {
            dirs.push(info);
        } else {
            files.push(info);
        }
    }
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);
    Ok(dirs)
}

/// Move a file to the trash.
///
/// NOTE: V0.1 placeholder — permanent/trashed delete requires platform-specific
/// integration. Returns an error asking the user to delete via Finder for now.
pub async fn delete_file(_path_str: &str) -> AppResult<()> {
    Err(AppError::InvalidInput(
        "Trash delete is not yet implemented; please delete via Finder".to_string(),
    ))
}

/// Rename / move a file.
pub async fn rename_file(old_path_str: &str, new_path_str: &str) -> AppResult<()> {
    let old = validate_path(old_path_str)?;
    let new = validate_parent_path(new_path_str)?;
    tokio::fs::rename(&old, &new).await?;
    Ok(())
}

/// Check whether a path exists on disk.
pub async fn exists(path_str: &str) -> AppResult<bool> {
    // Do NOT canonicalize (will fail for nonexistent paths); use a weaker check.
    if path_str.is_empty() || path_str.contains('\0') {
        return Err(AppError::InvalidPath("Invalid path".to_string()));
    }
    let p = Path::new(path_str);
    Ok(p.exists())
}

// --- internal helpers ---

async fn read_with_encoding(path: &Path, encoding_override: Option<&str>) -> AppResult<FileContent> {
    let bytes = tokio::fs::read(path).await?;
    let (content, enc) = encoding_detector::decode(&bytes, encoding_override)?;
    let (size, modified) = file_metadata(path)?;
    Ok(FileContent {
        path: path.to_string_lossy().to_string(),
        content,
        encoding: enc.name().to_string(),
        modified,
        size,
    })
}

fn tmp_path(path: &Path) -> PathBuf {
    let mut tmp = path.to_path_buf();
    let name = tmp
        .file_name()
        .map(|n| format!(".{}.fm-tmp", n.to_string_lossy()))
        .unwrap_or_else(|| ".freemarkdown.tmp".to_string());
    tmp.set_file_name(name);
    tmp
}
