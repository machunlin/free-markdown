//! Error types returned by Tauri commands.

use serde::Serialize;
use thiserror::Error;

/// Unified error type for FreeMarkdown command results.
///
/// Variants are serialized as their `Display` message when crossing the IPC boundary.
#[derive(Error, Debug)]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Encoding detection failed")]
    EncodingDetectionFailed,

    #[error("Unsupported encoding: {0}")]
    UnsupportedEncoding(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Dialog cancelled")]
    DialogCancelled,

    #[error("Tauri error: {0}")]
    Tauri(String),

    #[error("URL error: {0}")]
    Url(String),
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

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        AppError::Tauri(e.to_string())
    }
}

impl From<url::ParseError> for AppError {
    fn from(e: url::ParseError) -> Self {
        AppError::Url(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Convenience Result alias for command return types.
pub type AppResult<T> = Result<T, AppError>;
