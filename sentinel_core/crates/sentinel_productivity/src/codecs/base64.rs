//! Standalone Base64 encoder and decoder.

use super::{Base64Variant, CodecError};
use base64::engine::general_purpose::{
    STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD,
};
use base64::Engine;

/// Encodes raw binary data into Base64 format.
pub fn encode_base64(data: &[u8], variant: Base64Variant) -> String {
    match variant {
        Base64Variant::Standard => STANDARD.encode(data),
        Base64Variant::StandardUnpadded => STANDARD_NO_PAD.encode(data),
        Base64Variant::UrlSafe => URL_SAFE.encode(data),
        Base64Variant::UrlSafeUnpadded => URL_SAFE_NO_PAD.encode(data),
    }
}

/// Decodes Base64 string into raw binary data.
pub fn decode_base64(input: &str, variant: Base64Variant) -> Result<Vec<u8>, CodecError> {
    match variant {
        Base64Variant::Standard => STANDARD
            .decode(input.trim())
            .map_err(|e| CodecError::Base64Decode(e.to_string())),
        Base64Variant::StandardUnpadded => STANDARD_NO_PAD
            .decode(input.trim())
            .map_err(|e| CodecError::Base64Decode(e.to_string())),
        Base64Variant::UrlSafe => URL_SAFE
            .decode(input.trim())
            .map_err(|e| CodecError::Base64Decode(e.to_string())),
        Base64Variant::UrlSafeUnpadded => URL_SAFE_NO_PAD
            .decode(input.trim())
            .map_err(|e| CodecError::Base64Decode(e.to_string())),
    }
}

/// Auto-detects padding and alphabet (Standard vs URLSafe) and decodes cleanly,
/// stripping internal whitespace and CRLFs.
pub fn auto_decode_base64(input: &str) -> Result<Vec<u8>, CodecError> {
    let sanitized: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '\r' && *c != '\n')
        .collect();

    if sanitized.is_empty() {
        return Ok(Vec::new());
    }

    let is_url_safe = sanitized.contains('-') || sanitized.contains('_');
    let has_padding = sanitized.ends_with('=');

    // Try primary expected variant
    if is_url_safe {
        if has_padding {
            if let Ok(res) = URL_SAFE.decode(&sanitized) {
                return Ok(res);
            }
        } else {
            if let Ok(res) = URL_SAFE_NO_PAD.decode(&sanitized) {
                return Ok(res);
            }
            // Pad if necessary and retry
            let pad_len = (4 - (sanitized.len() % 4)) % 4;
            let mut padded = sanitized.clone();
            padded.push_str(&"=".repeat(pad_len));
            if let Ok(res) = URL_SAFE.decode(&padded) {
                return Ok(res);
            }
        }
    } else {
        if has_padding {
            if let Ok(res) = STANDARD.decode(&sanitized) {
                return Ok(res);
            }
        } else {
            if let Ok(res) = STANDARD_NO_PAD.decode(&sanitized) {
                return Ok(res);
            }
            let pad_len = (4 - (sanitized.len() % 4)) % 4;
            let mut padded = sanitized.clone();
            padded.push_str(&"=".repeat(pad_len));
            if let Ok(res) = STANDARD.decode(&padded) {
                return Ok(res);
            }
        }
    }

    // Fallback: try all 4 engines
    if let Ok(res) = URL_SAFE.decode(&sanitized) {
        return Ok(res);
    }
    if let Ok(res) = URL_SAFE_NO_PAD.decode(&sanitized) {
        return Ok(res);
    }
    if let Ok(res) = STANDARD.decode(&sanitized) {
        return Ok(res);
    }
    if let Ok(res) = STANDARD_NO_PAD.decode(&sanitized) {
        return Ok(res);
    }

    Err(CodecError::Base64Decode("Failed to decode input as standard or url-safe base64".to_string()))
}
