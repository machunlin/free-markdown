//! Serde-serializable data models shared between backend and frontend.

use serde::{Deserialize, Serialize};

/// Result of reading a file through [`super::commands::fs::open_file`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    /// Absolute path on disk.
    pub path: String,
    /// UTF-8 decoded content.
    pub content: String,
    /// Encoding label (e.g. `"UTF-8"`, `"GBK"`).
    pub encoding: String,
    /// Last modified time, milliseconds since Unix epoch.
    pub modified: u128,
    /// File size in bytes.
    pub size: u64,
}

/// Directory entry returned by [`super::commands::fs::read_directory`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub size: u64,
    pub modified: u128,
}

/// Encoding detection result from [`super::commands::encoding::detect_encoding`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncodingDetectResult {
    /// Encoding label (e.g. `"UTF-8"`).
    pub encoding: String,
    /// Confidence between `0.0` and `1.0`.
    pub confidence: f32,
}

/// Payload of the `file-changed` event pushed from backend to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangedEvent {
    pub path: String,
    pub kind: FileChangeKind,
    pub modified: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Modified,
    Deleted,
    Created,
    Renamed,
}
