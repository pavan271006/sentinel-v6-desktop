//! Hexadecimal encoder, decoder, and formatted hexdump utility.

use super::{CodecError, HexCase, HexDelimiter};

/// Encodes raw bytes into hexadecimal format with specified casing and delimiter.
pub fn encode_hex(data: &[u8], case: HexCase, delimiter: HexDelimiter) -> String {
    if data.is_empty() {
        return String::new();
    }

    match delimiter {
        HexDelimiter::None => match case {
            HexCase::Lower => hex::encode(data),
            HexCase::Upper => hex::encode_upper(data),
        },
        HexDelimiter::Space => {
            let mut out = String::with_capacity(data.len() * 3);
            for (idx, &b) in data.iter().enumerate() {
                if idx > 0 {
                    out.push(' ');
                }
                match case {
                    HexCase::Lower => out.push_str(&format!("{:02x}", b)),
                    HexCase::Upper => out.push_str(&format!("{:02X}", b)),
                }
            }
            out
        }
        HexDelimiter::Colon => {
            let mut out = String::with_capacity(data.len() * 3);
            for (idx, &b) in data.iter().enumerate() {
                if idx > 0 {
                    out.push(':');
                }
                match case {
                    HexCase::Lower => out.push_str(&format!("{:02x}", b)),
                    HexCase::Upper => out.push_str(&format!("{:02X}", b)),
                }
            }
            out
        }
        HexDelimiter::Prefix0x => {
            let mut out = String::with_capacity(data.len() * 6);
            for (idx, &b) in data.iter().enumerate() {
                if idx > 0 {
                    out.push_str(", ");
                }
                match case {
                    HexCase::Lower => out.push_str(&format!("0x{:02x}", b)),
                    HexCase::Upper => out.push_str(&format!("0x{:02X}", b)),
                }
            }
            out
        }
        HexDelimiter::EscapedHex => {
            let mut out = String::with_capacity(data.len() * 4);
            for &b in data {
                match case {
                    HexCase::Lower => out.push_str(&format!("\\x{:02x}", b)),
                    HexCase::Upper => out.push_str(&format!("\\x{:02X}", b)),
                }
            }
            out
        }
    }
}

/// Decodes hexadecimal string into raw bytes.
/// Tolerates leading `0x`, `\x`, spaces, colons, commas, and newlines.
pub fn decode_hex(input: &str) -> Result<Vec<u8>, CodecError> {
    let sanitized: String = input
        .replace("0x", "")
        .replace("0X", "")
        .replace("\\x", "")
        .replace("\\X", "")
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':' && *c != ',' && *c != '\r' && *c != '\n')
        .collect();

    if sanitized.is_empty() {
        return Ok(Vec::new());
    }

    if sanitized.len() % 2 != 0 {
        return Err(CodecError::HexDecode("Hex string has odd number of digits".to_string()));
    }

    hex::decode(&sanitized).map_err(|e| CodecError::HexDecode(e.to_string()))
}

/// Produces a formatted 16-byte canonical Wireshark/Burp-style HexDump.
pub fn hexdump(data: &[u8]) -> String {
    if data.is_empty() {
        return String::new();
    }

    let mut out = String::new();
    let chunks = data.chunks(16);

    for (row_idx, chunk) in chunks.enumerate() {
        let offset = row_idx * 16;
        out.push_str(&format!("{:08x}  ", offset));

        // Hex representation (8 bytes, space, 8 bytes)
        for i in 0..16 {
            if i < chunk.len() {
                out.push_str(&format!("{:02x} ", chunk[i]));
            } else {
                out.push_str("   ");
            }
            if i == 7 {
                out.push(' ');
            }
        }

        out.push_str(" |");
        // ASCII representation
        for &b in chunk {
            if b >= 0x20 && b <= 0x7E {
                out.push(b as char);
            } else {
                out.push('.');
            }
        }
        out.push_str("|\n");
    }

    out
}
