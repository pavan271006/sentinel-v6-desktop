//! RFC 3986 URL percent encoder and decoder.

use super::{CodecError, UrlEncodeMode};

fn is_unreserved(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~'
}

fn is_path_safe(b: u8) -> bool {
    is_unreserved(b) || b == b'/' || b == b':' || b == b'@' || b == b'!' || b == b'$' || b == b'&' || b == b'\'' || b == b'(' || b == b')' || b == b'*' || b == b'+' || b == b',' || b == b';' || b == b'='
}

/// Encodes raw bytes into URL percent-encoded string.
pub fn encode_url(data: &[u8], mode: UrlEncodeMode) -> String {
    match mode {
        UrlEncodeMode::QueryComponent => {
            let mut out = String::with_capacity(data.len() * 3);
            for &b in data {
                if is_unreserved(b) {
                    out.push(b as char);
                } else {
                    out.push_str(&format!("%{:02X}", b));
                }
            }
            out
        }
        UrlEncodeMode::PathSegment => {
            let mut out = String::with_capacity(data.len() * 3);
            for &b in data {
                if is_path_safe(b) {
                    out.push(b as char);
                } else {
                    out.push_str(&format!("%{:02X}", b));
                }
            }
            out
        }
        UrlEncodeMode::FormUrlEncoded => {
            let mut out = String::with_capacity(data.len() * 3);
            for &b in data {
                if is_unreserved(b) || b == b'*' {
                    out.push(b as char);
                } else if b == b' ' {
                    out.push('+');
                } else {
                    out.push_str(&format!("%{:02X}", b));
                }
            }
            out
        }
        UrlEncodeMode::AllCharacters => {
            let mut out = String::with_capacity(data.len() * 3);
            for &b in data {
                out.push_str(&format!("%{:02X}", b));
            }
            out
        }
        UrlEncodeMode::DoubleEncode => {
            let single = encode_url(data, UrlEncodeMode::QueryComponent);
            single.replace('%', "%25")
        }
    }
}

/// Helper to double-encode arbitrary byte payload for traversal / evasion testing.
pub fn encode_double_url(data: &[u8]) -> String {
    encode_url(data, UrlEncodeMode::DoubleEncode)
}

/// Decodes URL percent-encoded string back into raw bytes.
pub fn decode_url(input: &str, plus_as_space: bool) -> Result<Vec<u8>, CodecError> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        let b = bytes[i];
        if b == b'%' {
            if i + 2 < bytes.len() {
                let h1 = bytes[i + 1];
                let h2 = bytes[i + 2];
                if let (Some(d1), Some(d2)) = (hex_val(h1), hex_val(h2)) {
                    out.push((d1 << 4) | d2);
                    i += 3;
                    continue;
                }
            }
            // Malformed percent or at end of string: preserve literal byte
            out.push(b);
            i += 1;
        } else if plus_as_space && b == b'+' {
            out.push(b' ');
            i += 1;
        } else {
            out.push(b);
            i += 1;
        }
    }

    Ok(out)
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}
