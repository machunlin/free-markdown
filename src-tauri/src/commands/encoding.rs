//! Encoding detection / supported-encodings commands.

use crate::error::AppResult;
use crate::models::EncodingDetectResult;
use crate::services::encoding_detector;
use crate::services::path_util::validate_path;

#[tauri::command]
pub async fn detect_encoding(path: String) -> AppResult<EncodingDetectResult> {
    let validated = validate_path(&path)?;
    let bytes = tokio::fs::read(&validated).await?;
    // Read only the first 64KB to bound detection time on large files.
    let sample = if bytes.len() > 65536 { &bytes[..65536] } else { &bytes };
    let (enc, conf) = encoding_detector::detect(sample);
    Ok(EncodingDetectResult {
        encoding: enc.name().to_string(),
        confidence: conf,
    })
}

#[tauri::command]
pub fn get_supported_encodings() -> AppResult<Vec<String>> {
    Ok(encoding_detector::supported_labels()
        .into_iter()
        .map(|s| s.to_string())
        .collect())
}
