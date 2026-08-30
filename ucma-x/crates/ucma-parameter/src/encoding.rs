//! Encoding and decoding codecs for multi-layered parameter transformations.

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParameterCodecError {
    #[error("Base64 decoding failed: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("Hex decoding failed: {0}")]
    Hex(#[from] hex::FromHexError),
    #[error("URL decoding failed: {0}")]
    Url(String),
    #[error("UTF-8 conversion failed: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("Invalid unicode escape sequence: {0}")]
    Unicode(String),
}

/// Supported parameter encoding types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EncodingType {
    /// URL percent encoding (e.g. `%20`, `%27`).
    Url,
    /// Double URL percent encoding (e.g. `%2527`).
    UrlDouble,
    /// Standard Base64 encoding.
    Base64,
    /// URL-safe Base64 encoding.
    Base64Url,
    /// Plain Hexadecimal (e.g. `61646d696e`).
    Hex,
    /// `0x`-prefixed Hexadecimal (e.g. `0x61646d696e`).
    HexPrefixed,
    /// Named HTML entity encoding (e.g. `&quot;`, `&apos;`).
    HtmlEntityNamed,
    /// Decimal HTML entity encoding (e.g. `&#39;`).
    HtmlEntityDecimal,
    /// Hex HTML entity encoding (e.g. `&#x27;`).
    HtmlEntityHex,
    /// Unicode escape encoding (e.g. `\u0027`).
    UnicodeEscape,
    /// JSON string escaping (e.g. `\"`, `\\`).
    JsonEscape,
}

impl EncodingType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Url => "url",
            Self::UrlDouble => "url_double",
            Self::Base64 => "base64",
            Self::Base64Url => "base64_url",
            Self::Hex => "hex",
            Self::HexPrefixed => "hex_prefixed",
            Self::HtmlEntityNamed => "html_entity_named",
            Self::HtmlEntityDecimal => "html_entity_decimal",
            Self::HtmlEntityHex => "html_entity_hex",
            Self::UnicodeEscape => "unicode_escape",
            Self::JsonEscape => "json_escape",
        }
    }
}

/// Encoding and decoding engine for parameter values.
pub struct CodecEngine;

impl CodecEngine {
    /// Encodes an input string with a specific encoding type.
    pub fn encode(input: &str, encoding: &EncodingType) -> String {
        match encoding {
            EncodingType::Url => urlencoding::encode(input).to_string(),
            EncodingType::UrlDouble => {
                let first = urlencoding::encode(input).to_string();
                urlencoding::encode(&first).to_string()
            }
            EncodingType::Base64 => general_purpose::STANDARD.encode(input.as_bytes()),
            EncodingType::Base64Url => general_purpose::URL_SAFE.encode(input.as_bytes()),
            EncodingType::Hex => hex::encode(input.as_bytes()),
            EncodingType::HexPrefixed => format!("0x{}", hex::encode(input.as_bytes())),
            EncodingType::HtmlEntityNamed => html_escape::encode_text(input).to_string(),
            EncodingType::HtmlEntityDecimal => input
                .chars()
                .map(|c| format!("&#{};", c as u32))
                .collect(),
            EncodingType::HtmlEntityHex => input
                .chars()
                .map(|c| format!("&#x{:x};", c as u32))
                .collect(),
            EncodingType::UnicodeEscape => input
                .chars()
                .map(|c| format!("\\u{:04x}", c as u32))
                .collect(),
            EncodingType::JsonEscape => {
                serde_json::to_string(input).unwrap_or_else(|_| input.to_string())
            }
        }
    }

    /// Decodes an input string according to a specific encoding type.
    pub fn decode(input: &str, encoding: &EncodingType) -> Result<String, ParameterCodecError> {
        match encoding {
            EncodingType::Url => urlencoding::decode(input)
                .map(|cow| cow.into_owned())
                .map_err(|e| ParameterCodecError::Url(e.to_string())),
            EncodingType::UrlDouble => {
                let first = urlencoding::decode(input)
                    .map(|cow| cow.into_owned())
                    .map_err(|e| ParameterCodecError::Url(e.to_string()))?;
                urlencoding::decode(&first)
                    .map(|cow| cow.into_owned())
                    .map_err(|e| ParameterCodecError::Url(e.to_string()))
            }
            EncodingType::Base64 => {
                let bytes = general_purpose::STANDARD.decode(input.trim())?;
                Ok(String::from_utf8(bytes)?)
            }
            EncodingType::Base64Url => {
                let bytes = general_purpose::URL_SAFE.decode(input.trim())?;
                Ok(String::from_utf8(bytes)?)
            }
            EncodingType::Hex => {
                let bytes = hex::decode(input.trim())?;
                Ok(String::from_utf8(bytes)?)
            }
            EncodingType::HexPrefixed => {
                let clean = input.trim().strip_prefix("0x").unwrap_or(input.trim());
                let bytes = hex::decode(clean)?;
                Ok(String::from_utf8(bytes)?)
            }
            EncodingType::HtmlEntityNamed | EncodingType::HtmlEntityDecimal | EncodingType::HtmlEntityHex => {
                // html_escape handles all numeric and named variants
                Ok(html_escape::decode_html_entities(input).to_string())
            }
            EncodingType::UnicodeEscape => {
                let mut out = String::new();
                let mut chars = input.chars().peekable();
                while let Some(c) = chars.next() {
                    if c == '\\' && chars.peek() == Some(&'u') {
                        chars.next(); // consume 'u'
                        let hex_str: String = chars.by_ref().take(4).collect();
                        if hex_str.len() == 4
                            && let Ok(code) = u32::from_str_radix(&hex_str, 16)
                                && let Some(ch) = char::from_u32(code) {
                                    out.push(ch);
                                    continue;
                                }
                        return Err(ParameterCodecError::Unicode(format!("\\u{}", hex_str)));
                    } else {
                        out.push(c);
                    }
                }
                Ok(out)
            }
            EncodingType::JsonEscape => {
                // If it's wrapped in quotes, deserialize it, otherwise wrap and parse
                let wrapped = if input.starts_with('"') && input.ends_with('"') {
                    input.to_string()
                } else {
                    format!("\"{}\"", input)
                };
                serde_json::from_str::<String>(&wrapped)
                    .map_err(|e| ParameterCodecError::Url(e.to_string()))
            }
        }
    }

    /// Applies a sequence of encodings (in order from first to last).
    pub fn encode_chain(input: &str, chain: &[EncodingType]) -> String {
        let mut curr = input.to_string();
        for enc in chain {
            curr = Self::encode(&curr, enc);
        }
        curr
    }

    /// Decodes a sequence of encodings (in reverse order from last to first).
    pub fn decode_chain(
        input: &str,
        chain: &[EncodingType],
    ) -> Result<String, ParameterCodecError> {
        let mut curr = input.to_string();
        for enc in chain.iter().rev() {
            curr = Self::decode(&curr, enc)?;
        }
        Ok(curr)
    }

    /// Heuristically detects the encoding chain used by a raw parameter value.
    pub fn detect_encoding_chain(raw_value: &str) -> Vec<EncodingType> {
        let mut chain = Vec::new();
        let trimmed = raw_value.trim();
        if trimmed.is_empty() {
            return chain;
        }

        // Check for double URL encoding
        if trimmed.contains("%25") {
            chain.push(EncodingType::UrlDouble);
            return chain;
        }

        // Check for URL encoding
        if trimmed.contains('%') && trimmed.len() >= 3 {
            let re_url = regex::Regex::new(r"%[0-9a-fA-F]{2}").unwrap();
            if re_url.is_match(trimmed) {
                chain.push(EncodingType::Url);
                return chain;
            }
        }

        // Check for HTML entity
        if trimmed.contains("&amp;")
            || trimmed.contains("&#")
            || trimmed.contains("&quot;")
            || trimmed.contains("&apos;")
        {
            if trimmed.contains("&#x") {
                chain.push(EncodingType::HtmlEntityHex);
            } else if trimmed.contains("&#") {
                chain.push(EncodingType::HtmlEntityDecimal);
            } else {
                chain.push(EncodingType::HtmlEntityNamed);
            }
            return chain;
        }

        // Check for Unicode escape
        if trimmed.contains("\\u") && trimmed.len() >= 6 {
            let re_uni = regex::Regex::new(r"\\u[0-9a-fA-F]{4}").unwrap();
            if re_uni.is_match(trimmed) {
                chain.push(EncodingType::UnicodeEscape);
                return chain;
            }
        }

        // Check for Hex (prefixed or long even-length hex string)
        if trimmed.starts_with("0x") && trimmed.len() > 4 {
            chain.push(EncodingType::HexPrefixed);
            return chain;
        } else if trimmed.len() >= 8 && trimmed.len().is_multiple_of(2) && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
            // Heuristic check: does it decode to valid ascii text?
            if let Ok(decoded) = hex::decode(trimmed)
                && decoded.iter().all(|&b| (32..=126).contains(&b)) {
                    chain.push(EncodingType::Hex);
                    return chain;
                }
        }

        // Check for Base64
        if trimmed.len() >= 8
            && trimmed.len().is_multiple_of(4)
            && trimmed
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
            && let Ok(bytes) = general_purpose::STANDARD.decode(trimmed)
                && bytes.len() >= 3 && bytes.iter().all(|&b| (32..=126).contains(&b) || b == b'\n' || b == b'\r') {
                    chain.push(EncodingType::Base64);
                    return chain;
                }

        chain
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_codec() {
        let raw = "' OR 1=1 --";
        let encoded = CodecEngine::encode(raw, &EncodingType::Url);
        let decoded = CodecEngine::decode(&encoded, &EncodingType::Url).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_base64_codec() {
        let raw = "admin'--";
        let encoded = CodecEngine::encode(raw, &EncodingType::Base64);
        let decoded = CodecEngine::decode(&encoded, &EncodingType::Base64).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_hex_codec() {
        let raw = "SELECT 1";
        let encoded = CodecEngine::encode(raw, &EncodingType::HexPrefixed);
        assert!(encoded.starts_with("0x"));
        let decoded = CodecEngine::decode(&encoded, &EncodingType::HexPrefixed).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_html_entity_codec() {
        let raw = "<script>'test'</script>";
        let encoded = CodecEngine::encode(raw, &EncodingType::HtmlEntityHex);
        let decoded = CodecEngine::decode(&encoded, &EncodingType::HtmlEntityHex).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_unicode_escape_codec() {
        let raw = "' OR 1=1";
        let encoded = CodecEngine::encode(raw, &EncodingType::UnicodeEscape);
        let decoded = CodecEngine::decode(&encoded, &EncodingType::UnicodeEscape).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_chain_encode_decode() {
        let raw = "' UNION SELECT 1, 2 --";
        let chain = vec![EncodingType::Base64, EncodingType::Url];
        let encoded = CodecEngine::encode_chain(raw, &chain);
        let decoded = CodecEngine::decode_chain(&encoded, &chain).unwrap();
        assert_eq!(decoded, raw);
    }

    #[test]
    fn test_detection_of_encodings() {
        assert_eq!(
            CodecEngine::detect_encoding_chain("%27%20OR%201=1"),
            vec![EncodingType::Url]
        );
        assert_eq!(
            CodecEngine::detect_encoding_chain("%2527"),
            vec![EncodingType::UrlDouble]
        );
        assert_eq!(
            CodecEngine::detect_encoding_chain("0x61646d696e"),
            vec![EncodingType::HexPrefixed]
        );
        assert_eq!(
            CodecEngine::detect_encoding_chain("\\u0027\\u0020"),
            vec![EncodingType::UnicodeEscape]
        );
    }
}
