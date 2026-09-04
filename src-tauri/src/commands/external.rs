//! External URL opener.
//!
//! Opens http/https URLs in the system default browser. All other schemes are rejected.

use crate::error::AppResult;

#[tauri::command]
pub fn open_external(url: String) -> AppResult<()> {
    let parsed = url::Url::parse(&url)?;
    match parsed.scheme() {
        "http" | "https" => {
            open::that(parsed.as_str())
                .map_err(|e| crate::error::AppError::Io(format!("Failed to open URL: {e}")))?;
            Ok(())
        }
        "mailto" => {
            open::that(parsed.as_str())
                .map_err(|e| crate::error::AppError::Io(format!("Failed to open mailto: {e}")))?;
            Ok(())
        }
        other => Err(crate::error::AppError::InvalidInput(format!(
            "Cannot open URL with scheme: {other}"
        ))),
    }
}
