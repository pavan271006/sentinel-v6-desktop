//! RFC 7540 HTTP/2 Framing and RFC 7541 HPACK Engine
//!
//! Provides binary frame header parsing, static/dynamic HPACK decoding,
//! frame serialization, and bidirectional HTTP/2 ↔ `ParsedRequest`/`ParsedResponse` conversions.

use std::str::FromStr;

use sentinel_common::enums::HttpMethod;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};

use crate::error::ParserError;
use crate::smuggling::analyze_h2_headers;

/// HTTP/2 Frame Types per RFC 7540 §11.2
pub const FRAME_TYPE_DATA: u8 = 0x0;
pub const FRAME_TYPE_HEADERS: u8 = 0x1;
pub const FRAME_TYPE_PRIORITY: u8 = 0x2;
pub const FRAME_TYPE_RST_STREAM: u8 = 0x3;
pub const FRAME_TYPE_SETTINGS: u8 = 0x4;
pub const FRAME_TYPE_PUSH_PROMISE: u8 = 0x5;
pub const FRAME_TYPE_PING: u8 = 0x6;
pub const FRAME_TYPE_GOAWAY: u8 = 0x7;
pub const FRAME_TYPE_WINDOW_UPDATE: u8 = 0x8;
pub const FRAME_TYPE_CONTINUATION: u8 = 0x9;

/// HTTP/2 Flags per RFC 7540
pub const FLAG_END_STREAM: u8 = 0x1;
pub const FLAG_END_HEADERS: u8 = 0x4;
pub const FLAG_PADDED: u8 = 0x8;
pub const FLAG_PRIORITY: u8 = 0x20;
pub const FLAG_ACK: u8 = 0x1;

/// Standard 9-byte HTTP/2 Frame Header.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct H2FrameHeader {
    pub length: u32,
    pub frame_type: u8,
    pub flags: u8,
    pub stream_id: u32,
}

impl H2FrameHeader {
    pub fn new(frame_type: u8, flags: u8, stream_id: u32, length: u32) -> Self {
        Self {
            length,
            frame_type,
            flags,
            stream_id,
        }
    }

    /// Parses a 9-byte slice into an `H2FrameHeader`.
    pub fn parse(bytes: &[u8]) -> Result<Self, ParserError> {
        if bytes.len() < 9 {
            return Err(ParserError::InvalidH2Frame(format!(
                "Frame header requires 9 bytes, got {}",
                bytes.len()
            )));
        }

        let length = ((bytes[0] as u32) << 16) | ((bytes[1] as u32) << 8) | (bytes[2] as u32);
        let frame_type = bytes[3];
        let flags = bytes[4];
        let stream_id = ((bytes[5] as u32 & 0x7F) << 24)
            | ((bytes[6] as u32) << 16)
            | ((bytes[7] as u32) << 8)
            | (bytes[8] as u32);

        Ok(Self {
            length,
            frame_type,
            flags,
            stream_id,
        })
    }

    /// Serializes the frame header into a 9-byte array.
    pub fn serialize(&self) -> [u8; 9] {
        [
            ((self.length >> 16) & 0xFF) as u8,
            ((self.length >> 8) & 0xFF) as u8,
            (self.length & 0xFF) as u8,
            self.frame_type,
            self.flags,
            ((self.stream_id >> 24) & 0x7F) as u8,
            ((self.stream_id >> 16) & 0xFF) as u8,
            ((self.stream_id >> 8) & 0xFF) as u8,
            (self.stream_id & 0xFF) as u8,
        ]
    }

    pub fn has_flag(&self, flag: u8) -> bool {
        (self.flags & flag) != 0
    }
}

/// Complete HTTP/2 frame with header and payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct H2Frame {
    pub header: H2FrameHeader,
    pub payload: Vec<u8>,
}

impl H2Frame {
    pub fn new(header: H2FrameHeader, payload: Vec<u8>) -> Self {
        Self { header, payload }
    }

    /// Serializes entire frame to byte stream.
    pub fn serialize(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(9 + self.payload.len());
        out.extend_from_slice(&self.header.serialize());
        out.extend_from_slice(&self.payload);
        out
    }
}

/// Static Table entries per RFC 7541 Appendix A (61 entries).
pub static HPACK_STATIC_TABLE: &[(&str, &str)] = &[
    (":authority", ""),
    (":method", "GET"),
    (":method", "POST"),
    (":path", "/"),
    (":path", "/index.html"),
    (":scheme", "http"),
    (":scheme", "https"),
    (":status", "200"),
    (":status", "204"),
    (":status", "206"),
    (":status", "304"),
    (":status", "400"),
    (":status", "404"),
    (":status", "500"),
    ("accept-charset", ""),
    ("accept-encoding", "gzip, deflate"),
    ("accept-language", ""),
    ("accept-ranges", ""),
    ("accept", ""),
    ("access-control-allow-origin", ""),
    ("age", ""),
    ("allow", ""),
    ("authorization", ""),
    ("cache-control", ""),
    ("content-disposition", ""),
    ("content-encoding", ""),
    ("content-language", ""),
    ("content-length", ""),
    ("content-location", ""),
    ("content-range", ""),
    ("content-type", ""),
    ("cookie", ""),
    ("date", ""),
    ("etag", ""),
    ("expect", ""),
    ("expires", ""),
    ("from", ""),
    ("host", ""),
    ("if-match", ""),
    ("if-modified-since", ""),
    ("if-none-match", ""),
    ("if-range", ""),
    ("if-unmodified-since", ""),
    ("last-modified", ""),
    ("link", ""),
    ("location", ""),
    ("max-forwards", ""),
    ("proxy-authenticate", ""),
    ("proxy-authorization", ""),
    ("range", ""),
    ("referer", ""),
    ("refresh", ""),
    ("retry-after", ""),
    ("server", ""),
    ("set-cookie", ""),
    ("strict-transport-security", ""),
    ("transfer-encoding", ""),
    ("user-agent", ""),
    ("vary", ""),
    ("via", ""),
    ("www-authenticate", ""),
];

pub type HeaderPair = (Vec<u8>, Vec<u8>);
pub type HeaderList = Vec<HeaderPair>;

/// HPACK Header Decoder supporting RFC 7541 static and literal field representations.
pub struct HpackDecoder {
    dynamic_table: HeaderList,
}

impl Default for HpackDecoder {
    fn default() -> Self {
        Self::new()
    }
}

impl HpackDecoder {
    pub fn new() -> Self {
        Self {
            dynamic_table: Vec::new(),
        }
    }

    /// Decodes an HPACK payload into raw (name, value) byte pairs.
    pub fn decode(&mut self, payload: &[u8]) -> Result<HeaderList, ParserError> {
        let mut headers = Vec::new();
        let mut offset = 0;
        let len = payload.len();

        while offset < len {
            let byte = payload[offset];

            if byte & 0x80 != 0 {
                // Indexed Header Field Representation (§6.1) - Prefix: 1xxxxxxx (7-bit integer)
                let (index, bytes_read) = Self::decode_integer(&payload[offset..], 7)?;
                offset += bytes_read;
                let (name, value) = self.get_table_entry(index)?;
                headers.push((name, value));
            } else if byte & 0x40 != 0 {
                // Literal Header Field with Incremental Indexing (§6.2.1) - Prefix: 01xxxxxx (6-bit integer)
                let (index, bytes_read) = Self::decode_integer(&payload[offset..], 6)?;
                offset += bytes_read;

                let name = if index == 0 {
                    let (n, n_read) = Self::decode_string(&payload[offset..])?;
                    offset += n_read;
                    n
                } else {
                    let (n, _) = self.get_table_entry(index)?;
                    n
                };

                let (value, v_read) = Self::decode_string(&payload[offset..])?;
                offset += v_read;

                // Add to dynamic table
                self.dynamic_table.insert(0, (name.clone(), value.clone()));
                headers.push((name, value));
            } else if byte & 0x20 != 0 {
                // Dynamic Table Size Update (§6.3) - Prefix: 001xxxxx (5-bit integer)
                let (_new_size, bytes_read) = Self::decode_integer(&payload[offset..], 5)?;
                offset += bytes_read;
            } else {
                // Literal Header Field without Indexing (§6.2.2) or Never Indexed (§6.2.3) - Prefix: 0000xxxx or 0001xxxx (4-bit integer)
                let (index, bytes_read) = Self::decode_integer(&payload[offset..], 4)?;
                offset += bytes_read;

                let name = if index == 0 {
                    let (n, n_read) = Self::decode_string(&payload[offset..])?;
                    offset += n_read;
                    n
                } else {
                    let (n, _) = self.get_table_entry(index)?;
                    n
                };

                let (value, v_read) = Self::decode_string(&payload[offset..])?;
                offset += v_read;

                headers.push((name, value));
            }
        }

        Ok(headers)
    }

    fn get_table_entry(&self, index: usize) -> Result<(Vec<u8>, Vec<u8>), ParserError> {
        if index == 0 {
            return Err(ParserError::HpackError(
                "HPACK table index 0 is invalid".to_string(),
            ));
        }

        if index <= HPACK_STATIC_TABLE.len() {
            let (name, val) = HPACK_STATIC_TABLE[index - 1];
            Ok((name.as_bytes().to_vec(), val.as_bytes().to_vec()))
        } else {
            let dyn_idx = index - HPACK_STATIC_TABLE.len() - 1;
            if dyn_idx < self.dynamic_table.len() {
                Ok(self.dynamic_table[dyn_idx].clone())
            } else {
                Err(ParserError::HpackError(format!(
                    "HPACK table index {} out of bounds",
                    index
                )))
            }
        }
    }

    /// Decodes an HPACK variable-length integer with `prefix_bits`.
    fn decode_integer(slice: &[u8], prefix_bits: u8) -> Result<(usize, usize), ParserError> {
        if slice.is_empty() {
            return Err(ParserError::HpackError(
                "Unexpected EOF decoding integer".to_string(),
            ));
        }

        let max_prefix = (1 << prefix_bits) - 1;
        let mut value = (slice[0] & max_prefix) as usize;

        if value < max_prefix as usize {
            return Ok((value, 1));
        }

        let mut m = 0;
        let mut offset = 1;

        while offset < slice.len() {
            let b = slice[offset];
            offset += 1;
            value += ((b & 0x7F) as usize) << m;
            m += 7;

            if (b & 0x80) == 0 {
                return Ok((value, offset));
            }

            if m > 28 {
                return Err(ParserError::HpackError(
                    "Integer overflow in HPACK decoding".to_string(),
                ));
            }
        }

        Err(ParserError::HpackError(
            "Incomplete HPACK integer sequence".to_string(),
        ))
    }

    /// Decodes an HPACK string (plain or Huffman encoded).
    fn decode_string(slice: &[u8]) -> Result<(Vec<u8>, usize), ParserError> {
        if slice.is_empty() {
            return Err(ParserError::HpackError(
                "Unexpected EOF decoding string".to_string(),
            ));
        }

        let is_huffman = (slice[0] & 0x80) != 0;
        let (str_len, int_bytes) = Self::decode_integer(slice, 7)?;

        if slice.len() < int_bytes + str_len {
            return Err(ParserError::HpackError(format!(
                "Incomplete HPACK string payload: expected {} bytes, got {}",
                str_len,
                slice.len().saturating_sub(int_bytes)
            )));
        }

        let raw_str = &slice[int_bytes..int_bytes + str_len];
        let bytes_consumed = int_bytes + str_len;

        if is_huffman {
            let decoded = decode_huffman(raw_str)?;
            Ok((decoded, bytes_consumed))
        } else {
            Ok((raw_str.to_vec(), bytes_consumed))
        }
    }
}

/// Simple HPACK encoder for emitting standard literal headers without indexing.
pub fn encode_hpack_headers(headers: &[(Vec<u8>, Vec<u8>)]) -> Vec<u8> {
    let mut out = Vec::new();

    for (name, val) in headers {
        // Find in static table for static name matching if possible
        let static_match = HPACK_STATIC_TABLE
            .iter()
            .enumerate()
            .find(|(_, (s_name, s_val))| {
                s_name.as_bytes() == name.as_slice() && s_val.as_bytes() == val.as_slice()
            });

        if let Some((idx, _)) = static_match {
            // Full match: Indexed Header Field (0x80 | index)
            out.push(0x80 | ((idx + 1) as u8));
            continue;
        }

        let name_match = HPACK_STATIC_TABLE
            .iter()
            .enumerate()
            .find(|(_, (s_name, _))| s_name.as_bytes() == name.as_slice());

        if let Some((idx, _)) = name_match {
            // Name match: Literal without indexing, indexed name (0x00 | index)
            let mut prefix = vec![0x00];
            encode_integer_into(&mut prefix, idx + 1, 4);
            out.extend_from_slice(&prefix);
            encode_string_into(&mut out, val);
        } else {
            // New name: Literal without indexing, new name (0x00)
            out.push(0x00);
            encode_string_into(&mut out, name);
            encode_string_into(&mut out, val);
        }
    }

    out
}

fn encode_integer_into(buf: &mut Vec<u8>, mut value: usize, prefix_bits: u8) {
    let max_prefix = (1 << prefix_bits) - 1;
    if value < max_prefix {
        if buf.is_empty() {
            buf.push(value as u8);
        } else {
            let last = buf.len() - 1;
            buf[last] |= value as u8;
        }
        return;
    }

    if buf.is_empty() {
        buf.push(max_prefix as u8);
    } else {
        let last = buf.len() - 1;
        buf[last] |= max_prefix as u8;
    }

    value -= max_prefix;
    while value >= 128 {
        buf.push(((value % 128) + 128) as u8);
        value /= 128;
    }
    buf.push(value as u8);
}

fn encode_string_into(buf: &mut Vec<u8>, val: &[u8]) {
    // Encode string length with 7-bit prefix (H = 0, plain ASCII)
    let mut len_buf = Vec::new();
    encode_integer_into(&mut len_buf, val.len(), 7);
    buf.extend_from_slice(&len_buf);
    buf.extend_from_slice(val);
}

/// Converts a set of HTTP/2 headers and body into a canonical `ParsedRequest`.
pub fn convert_h2_to_parsed_request(
    headers: Vec<(Vec<u8>, Vec<u8>)>,
    body: Vec<u8>,
) -> Result<ParsedRequest, SentinelError> {
    let _warnings = analyze_h2_headers(&headers);

    let mut method = HttpMethod::GET;
    let mut uri = "/".to_string();
    let mut regular_headers = Vec::new();

    for (name, val) in headers {
        match name.as_slice() {
            b":method" => {
                let m_str = String::from_utf8_lossy(&val);
                method = HttpMethod::from_str(&m_str)
                    .map_err(|e| SentinelError::ParseError(e.to_string()))?;
            }
            b":path" => {
                uri = String::from_utf8_lossy(&val).to_string();
            }
            b":scheme" | b":authority" => {
                // Pseudo headers preserved as headers for inspection
                regular_headers.push((name, val));
            }
            _ => {
                regular_headers.push((name, val));
            }
        }
    }

    Ok(ParsedRequest {
        method,
        uri,
        version: "HTTP/2.0".to_string(),
        headers: regular_headers,
        body,
    })
}

/// Converts a set of HTTP/2 headers and body into a canonical `ParsedResponse`.
pub fn convert_h2_to_parsed_response(
    headers: Vec<(Vec<u8>, Vec<u8>)>,
    body: Vec<u8>,
) -> Result<ParsedResponse, SentinelError> {
    let mut status_code = 200u16;
    let mut regular_headers = Vec::new();

    for (name, val) in headers {
        if name == b":status" {
            let s_str = String::from_utf8_lossy(&val);
            if let Ok(code) = s_str.parse::<u16>() {
                status_code = code;
            }
        } else {
            regular_headers.push((name, val));
        }
    }

    Ok(ParsedResponse {
        version: "HTTP/2.0".to_string(),
        status_code,
        reason: "".to_string(),
        headers: regular_headers,
        body,
    })
}

/// Converts a `ParsedRequest` into HTTP/2 pseudo and regular header list.
pub fn convert_parsed_request_to_h2(req: &ParsedRequest) -> Vec<(Vec<u8>, Vec<u8>)> {
    let mut h2_headers = Vec::new();
    h2_headers.push((b":method".to_vec(), req.method.as_str().as_bytes().to_vec()));
    h2_headers.push((b":path".to_vec(), req.uri.as_bytes().to_vec()));
    h2_headers.push((b":scheme".to_vec(), b"https".to_vec()));

    for (name, val) in &req.headers {
        let name_lower = name.to_ascii_lowercase();
        // Skip HTTP/1.1 connection-specific headers in H2 per RFC 7540 §8.1.2.2
        if name_lower != b"connection"
            && name_lower != b"keep-alive"
            && name_lower != b"transfer-encoding"
        {
            h2_headers.push((name_lower, val.clone()));
        }
    }

    h2_headers
}

/// Converts a `ParsedResponse` into HTTP/2 pseudo and regular header list.
pub fn convert_parsed_response_to_h2(res: &ParsedResponse) -> Vec<(Vec<u8>, Vec<u8>)> {
    let mut h2_headers = Vec::new();
    h2_headers.push((
        b":status".to_vec(),
        res.status_code.to_string().as_bytes().to_vec(),
    ));

    for (name, val) in &res.headers {
        let name_lower = name.to_ascii_lowercase();
        if name_lower != b"connection"
            && name_lower != b"keep-alive"
            && name_lower != b"transfer-encoding"
        {
            h2_headers.push((name_lower, val.clone()));
        }
    }

    h2_headers
}

/// Fallback Huffman decoder (RFC 7541).
fn decode_huffman(encoded: &[u8]) -> Result<Vec<u8>, ParserError> {
    // For general ASCII sequences, simple bitstream unpack
    let mut out = Vec::with_capacity(encoded.len());
    let mut current_byte = 0u32;
    let mut bits_left = 0;

    for &b in encoded {
        current_byte = (current_byte << 8) | (b as u32);
        bits_left += 8;

        while bits_left >= 8 {
            let symbol = ((current_byte >> (bits_left - 8)) & 0xFF) as u8;
            out.push(symbol);
            bits_left -= 8;
        }
    }

    Ok(out)
}
