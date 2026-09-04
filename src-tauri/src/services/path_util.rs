//! Path validation helpers shared by all commands.

use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Validate an absolute-ish path string and return its canonical form.
///
/// Rejects:
/// - Empty strings
/// - Paths containing null bytes
/// - Relative paths
/// - Paths that cannot be canonicalized (do not exist, etc.)
/// - Paths that contain `..` parent traversal components
pub fn validate_path(path_str: &str) -> AppResult<PathBuf> {
    if path_str.is_empty() {
        return Err(AppError::InvalidPath("Path is empty".to_string()));
    }
    if path_str.contains('\0') {
        return Err(AppError::InvalidPath("Null byte in path".to_string()));
    }
    let path = Path::new(path_str);
    if !path.is_absolute() {
        return Err(AppError::InvalidPath(
            "Relative paths are not allowed".to_string(),
        ));
    }
    for component in path.components() {
        if let Component::ParentDir = component {
            return Err(AppError::InvalidPath(
                "Path traversal (parent directory) detected".to_string(),
            ));
        }
    }
    // Canonicalize only if the path exists. Callers who need to validate a
    // path-that-will-be-created should use `validate_parent_path`.
    let canonical = path
        .canonicalize()
        .map_err(|_| AppError::InvalidPath(format!("Cannot resolve path: {}", path.display())))?;
    Ok(canonical)
}

/// Validate a path whose parent must exist (e.g. for new files / save-as).
pub fn validate_parent_path(path_str: &str) -> AppResult<PathBuf> {
    if path_str.is_empty() {
        return Err(AppError::InvalidPath("Path is empty".to_string()));
    }
    if path_str.contains('\0') {
        return Err(AppError::InvalidPath("Null byte in path".to_string()));
    }
    let path = Path::new(path_str);
    if !path.is_absolute() {
        return Err(AppError::InvalidPath(
            "Relative paths are not allowed".to_string(),
        ));
    }
    // If the file already exists, canonicalize it directly.
    if path.exists() {
        return validate_path(path_str);
    }
    // Otherwise, ensure the parent exists.
    let parent = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Path has no parent directory".to_string()))?;
    let _parent_canon = parent.canonicalize().map_err(|_| {
        AppError::InvalidPath(format!(
            "Parent directory does not exist: {}",
            parent.display()
        ))
    })?;
    Ok(path.to_path_buf())
}

/// Return file metadata as `(size_bytes, modified_ms)` for an already-canonical path.
pub fn file_metadata(path: &Path) -> std::io::Result<(u64, u128)> {
    let meta = std::fs::metadata(path)?;
    let size = meta.len();
    let modified = meta
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    Ok((size, modified))
}
