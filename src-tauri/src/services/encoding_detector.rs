//! Encoding detection and decoding using `chardetng` + `encoding_rs`.

use chardetng::EncodingDetector;
use encoding_rs::{Encoding, UTF_8};

use crate::error::AppResult;

/// Detect encoding for raw bytes.
///
/// Returns `(encoding, confidence_0_to_1)`. chardetng does not expose a
/// numeric confidence; we map `tentative=false → 1.0` and `tentative=true → 0.5`.
pub fn detect(bytes: &[u8]) -> (&'static Encoding, f32) {
    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    let tentative = detector.guess_assess(None, true).1;
    let confidence = if tentative { 0.5 } else { 1.0 };
    (encoding, confidence)
}

/// Decode bytes to a UTF-8 Rust `String` using the given encoding label override.
///
/// If `label_override` is `None`, auto-detect. Returns the decoded string and
/// the actual encoding used.
pub fn decode(bytes: &[u8], label_override: Option<&str>) -> AppResult<(String, &'static Encoding)> {
    let encoding = match label_override {
        Some(label) => Encoding::for_label(label.as_bytes())
            .ok_or_else(|| crate::error::AppError::UnsupportedEncoding(label.to_string()))?,
        None => detect(bytes).0,
    };
    let (cow, actual_encoding, had_errors) = encoding.decode(bytes);
    // If we auto-detected and decoding produced errors, fall back to UTF-8.
    if had_errors && label_override.is_none() && actual_encoding != UTF_8 {
        let (cow_utf8, _, _) = UTF_8.decode(bytes);
        return Ok((cow_utf8.into_owned(), UTF_8));
    }
    Ok((cow.into_owned(), actual_encoding))
}

/// Encode a UTF-8 string into a target encoding by label.
pub fn encode(content: &str, label: &str) -> AppResult<(Vec<u8>, &'static Encoding)> {
    let encoding = Encoding::for_label(label.as_bytes())
        .ok_or_else(|| crate::error::AppError::UnsupportedEncoding(label.to_string()))?;
    let (cow, actual_encoding, _) = encoding.encode(content);
    Ok((cow.into_owned(), actual_encoding))
}

/// Return labels of supported encodings.
pub fn supported_labels() -> Vec<&'static str> {
    vec![
        "UTF-8",
        "GBK",
        "GB18030",
        "Big5",
        "Shift_JIS",
        "EUC-KR",
        "EUC-JP",
        "ISO-8859-1",
        "Windows-1252",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use encoding_rs::UTF_8;

    #[test]
    fn detects_utf8_with_bom() {
        let bytes = b"\xEF\xBB\xBFHello World";
        let (enc, conf) = detect(bytes);
        assert_eq!(enc, UTF_8);
        assert!(conf >= 0.5);
    }

    #[test]
    fn decodes_utf8() {
        let (content, enc) = decode("Hello, 世界".as_bytes(), None).unwrap();
        assert_eq!(content, "Hello, 世界");
        assert_eq!(enc, UTF_8);
    }

    #[test]
    fn empty_input_falls_back_to_utf8() {
        let (content, enc) = decode(b"", None).unwrap();
        assert_eq!(content, "");
        assert_eq!(enc, UTF_8);
    }
}
