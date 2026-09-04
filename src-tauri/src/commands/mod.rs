//! Tauri command handlers grouped by domain.
//!
//! Handlers are intentionally thin: validate input, call a service, map errors.

pub mod encoding;
pub mod external;
pub mod fs;
pub mod recent;
pub mod watcher;
pub mod window;
