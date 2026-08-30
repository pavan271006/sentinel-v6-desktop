use crate::error::ParserError;

/// RFC 9000 §16 QUIC Variable-Length Integer Codec (1, 2, 4, 8 bytes).
pub struct QuicVarint;

impl QuicVarint {
    /// Decodes a QUIC variable-length integer from a byte slice.
    /// Returns `(value, bytes_consumed)`.
    pub fn decode(bytes: &[u8]) -> Result<(u64, usize), ParserError> {
        if bytes.is_empty() {
            return Err(ParserError::Truncated("Empty buffer decoding QUIC varint".to_string()));
        }

        let first = bytes[0];
        let prefix = first >> 6;
        let len = 1usize << prefix; // 1, 2, 4, 8 bytes

        if bytes.len() < len {
            return Err(ParserError::Truncated(format!("Needed {} bytes for varint, had {}", len, bytes.len())));
        }

        let mut val = (first & 0x3F) as u64;
        for &byte in &bytes[1..len] {
            val = (val << 8) | (byte as u64);
        }

        Ok((val, len))
    }

    /// Encodes a 62-bit integer into QUIC variable-length format and appends to `buf`.
    /// Returns number of bytes appended.
    pub fn encode(val: u64, buf: &mut Vec<u8>) -> Result<usize, ParserError> {
        if val < 64 {
            buf.push(val as u8);
            Ok(1)
        } else if val < 16384 {
            buf.push(0x40 | ((val >> 8) as u8));
            buf.push((val & 0xFF) as u8);
            Ok(2)
        } else if val < 1073741824 {
            buf.push(0x80 | ((val >> 24) as u8));
            buf.push(((val >> 16) & 0xFF) as u8);
            buf.push(((val >> 8) & 0xFF) as u8);
            buf.push((val & 0xFF) as u8);
            Ok(4)
        } else if val < 4611686018427387904 {
            buf.push(0xC0 | ((val >> 56) as u8));
            for shift in (0..7).rev() {
                buf.push(((val >> (shift * 8)) & 0xFF) as u8);
            }
            Ok(8)
        } else {
            Err(ParserError::InvalidHeader("QUIC Varint exceeds 62 bits".to_string()))
        }
    }
}

/// RFC 9114 §7.2 HTTP/3 Frame Types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum H3FrameType {
    Data,        // 0x00
    Headers,     // 0x01
    CancelPush,  // 0x03
    Settings,    // 0x04
    PushPromise, // 0x05
    Goaway,      // 0x07
    MaxPushId,   // 0x0D
    Unknown(u64),
}

impl H3FrameType {
    pub fn from_u64(val: u64) -> Self {
        match val {
            0x00 => H3FrameType::Data,
            0x01 => H3FrameType::Headers,
            0x03 => H3FrameType::CancelPush,
            0x04 => H3FrameType::Settings,
            0x05 => H3FrameType::PushPromise,
            0x07 => H3FrameType::Goaway,
            0x0D => H3FrameType::MaxPushId,
            other => H3FrameType::Unknown(other),
        }
    }

    pub fn to_u64(&self) -> u64 {
        match self {
            H3FrameType::Data => 0x00,
            H3FrameType::Headers => 0x01,
            H3FrameType::CancelPush => 0x03,
            H3FrameType::Settings => 0x04,
            H3FrameType::PushPromise => 0x05,
            H3FrameType::Goaway => 0x07,
            H3FrameType::MaxPushId => 0x0D,
            H3FrameType::Unknown(u) => *u,
        }
    }
}

/// RFC 9114 HTTP/3 binary frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct H3Frame {
    pub frame_type: H3FrameType,
    pub payload: Vec<u8>,
}

impl H3Frame {
    pub fn new(frame_type: H3FrameType, payload: Vec<u8>) -> Self {
        Self { frame_type, payload }
    }

    /// Encodes the HTTP/3 frame into wire format: `[Frame Type Varint] + [Length Varint] + [Payload]`.
    pub fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(16 + self.payload.len());
        let _ = QuicVarint::encode(self.frame_type.to_u64(), &mut buf);
        let _ = QuicVarint::encode(self.payload.len() as u64, &mut buf);
        buf.extend_from_slice(&self.payload);
        buf
    }

    /// Decodes an HTTP/3 frame from a wire byte slice.
    /// Returns `(frame, bytes_consumed)`.
    pub fn decode(bytes: &[u8]) -> Result<(Self, usize), ParserError> {
        let mut offset = 0;

        let (type_val, type_len) = QuicVarint::decode(&bytes[offset..])?;
        offset += type_len;

        let (payload_len, len_len) = QuicVarint::decode(&bytes[offset..])?;
        offset += len_len;

        let len_usize = payload_len as usize;
        if bytes.len() < offset + len_usize {
            return Err(ParserError::Truncated(format!("Incomplete H3 frame payload: needed {} bytes", len_usize)));
        }

        let payload = bytes[offset..offset + len_usize].to_vec();
        offset += len_usize;

        Ok((
            Self {
                frame_type: H3FrameType::from_u64(type_val),
                payload,
            },
            offset,
        ))
    }
}

/// RFC 9204 QPACK Static Table Entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QpackStaticEntry {
    pub name: &'static str,
    pub value: &'static str,
}

/// RFC 9204 Appendix A: QPACK 99-entry static table.
pub const QPACK_STATIC_TABLE: &[QpackStaticEntry] = &[
    QpackStaticEntry { name: ":authority", value: "" },
    QpackStaticEntry { name: ":path", value: "/" },
    QpackStaticEntry { name: "age", value: "0" },
    QpackStaticEntry { name: "content-disposition", value: "" },
    QpackStaticEntry { name: "content-length", value: "0" },
    QpackStaticEntry { name: "cookie", value: "" },
    QpackStaticEntry { name: "date", value: "" },
    QpackStaticEntry { name: "etag", value: "" },
    QpackStaticEntry { name: "if-modified-since", value: "" },
    QpackStaticEntry { name: "if-none-match", value: "" },
    QpackStaticEntry { name: "last-modified", value: "" },
    QpackStaticEntry { name: "link", value: "" },
    QpackStaticEntry { name: "location", value: "" },
    QpackStaticEntry { name: "referer", value: "" },
    QpackStaticEntry { name: "set-cookie", value: "" },
    QpackStaticEntry { name: ":method", value: "CONNECT" },
    QpackStaticEntry { name: ":method", value: "DELETE" },
    QpackStaticEntry { name: ":method", value: "GET" },
    QpackStaticEntry { name: ":method", value: "HEAD" },
    QpackStaticEntry { name: ":method", value: "OPTIONS" },
    QpackStaticEntry { name: ":method", value: "POST" },
    QpackStaticEntry { name: ":method", value: "PUT" },
    QpackStaticEntry { name: ":scheme", value: "http" },
    QpackStaticEntry { name: ":scheme", value: "https" },
    QpackStaticEntry { name: ":status", value: "103" },
    QpackStaticEntry { name: ":status", value: "200" },
    QpackStaticEntry { name: ":status", value: "304" },
    QpackStaticEntry { name: ":status", value: "404" },
    QpackStaticEntry { name: ":status", value: "503" },
    QpackStaticEntry { name: "accept", value: "*/*" },
    QpackStaticEntry { name: "accept", value: "application/dns-message" },
    QpackStaticEntry { name: "accept-encoding", value: "gzip, deflate, br" },
    QpackStaticEntry { name: "accept-ranges", value: "bytes" },
    QpackStaticEntry { name: "access-control-allow-headers", value: "cache-control" },
    QpackStaticEntry { name: "access-control-allow-headers", value: "content-type" },
    QpackStaticEntry { name: "access-control-allow-origin", value: "*" },
    QpackStaticEntry { name: "cache-control", value: "max-age=0" },
    QpackStaticEntry { name: "cache-control", value: "max-age=2592000" },
    QpackStaticEntry { name: "cache-control", value: "max-age=604800" },
    QpackStaticEntry { name: "cache-control", value: "no-cache" },
    QpackStaticEntry { name: "cache-control", value: "no-store" },
    QpackStaticEntry { name: "cache-control", value: "public, max-age=31536000" },
    QpackStaticEntry { name: "content-encoding", value: "br" },
    QpackStaticEntry { name: "content-encoding", value: "gzip" },
    QpackStaticEntry { name: "content-type", value: "application/dns-message" },
    QpackStaticEntry { name: "content-type", value: "application/javascript" },
    QpackStaticEntry { name: "content-type", value: "application/json" },
    QpackStaticEntry { name: "content-type", value: "application/x-www-form-urlencoded" },
    QpackStaticEntry { name: "content-type", value: "image/gif" },
    QpackStaticEntry { name: "content-type", value: "image/jpeg" },
    QpackStaticEntry { name: "content-type", value: "image/png" },
    QpackStaticEntry { name: "content-type", value: "text/css" },
    QpackStaticEntry { name: "content-type", value: "text/html; charset=utf-8" },
    QpackStaticEntry { name: "content-type", value: "text/plain" },
    QpackStaticEntry { name: "content-type", value: "text/plain;charset=utf-8" },
    QpackStaticEntry { name: "range", value: "bytes=0-" },
    QpackStaticEntry { name: "strict-transport-security", value: "max-age=31536000" },
    QpackStaticEntry { name: "strict-transport-security", value: "max-age=31536000; includesubdomains" },
    QpackStaticEntry { name: "strict-transport-security", value: "max-age=31536000; includesubdomains; preload" },
    QpackStaticEntry { name: "vary", value: "accept-encoding" },
    QpackStaticEntry { name: "vary", value: "origin" },
    QpackStaticEntry { name: "x-content-type-options", value: "nosniff" },
    QpackStaticEntry { name: "x-xss-protection", value: "1; mode=block" },
    QpackStaticEntry { name: ":status", value: "100" },
    QpackStaticEntry { name: ":status", value: "204" },
    QpackStaticEntry { name: ":status", value: "206" },
    QpackStaticEntry { name: ":status", value: "302" },
    QpackStaticEntry { name: ":status", value: "400" },
    QpackStaticEntry { name: ":status", value: "403" },
    QpackStaticEntry { name: ":status", value: "421" },
    QpackStaticEntry { name: ":status", value: "425" },
    QpackStaticEntry { name: ":status", value: "500" },
    QpackStaticEntry { name: "accept-language", value: "" },
    QpackStaticEntry { name: "access-control-allow-credentials", value: "FALSE" },
    QpackStaticEntry { name: "access-control-allow-credentials", value: "TRUE" },
    QpackStaticEntry { name: "access-control-allow-headers", value: "*" },
    QpackStaticEntry { name: "access-control-allow-methods", value: "get" },
    QpackStaticEntry { name: "access-control-allow-methods", value: "get, post, options" },
    QpackStaticEntry { name: "access-control-allow-methods", value: "options" },
    QpackStaticEntry { name: "access-control-expose-headers", value: "content-length" },
    QpackStaticEntry { name: "access-control-request-headers", value: "content-type" },
    QpackStaticEntry { name: "access-control-request-method", value: "get" },
    QpackStaticEntry { name: "access-control-request-method", value: "post" },
    QpackStaticEntry { name: "alt-svc", value: "clear" },
    QpackStaticEntry { name: "authorization", value: "" },
    QpackStaticEntry { name: "content-security-policy", value: "script-src 'none'; object-src 'none'; base-uri 'none';" },
    QpackStaticEntry { name: "early-data", value: "1" },
    QpackStaticEntry { name: "expect-ct", value: "" },
    QpackStaticEntry { name: "forwarded", value: "" },
    QpackStaticEntry { name: "if-range", value: "" },
    QpackStaticEntry { name: "origin", value: "" },
    QpackStaticEntry { name: "purpose", value: "prefetch" },
    QpackStaticEntry { name: "server", value: "" },
    QpackStaticEntry { name: "timing-allow-origin", value: "*" },
    QpackStaticEntry { name: "upgrade-insecure-requests", value: "1" },
    QpackStaticEntry { name: "user-agent", value: "" },
    QpackStaticEntry { name: "x-forwarded-for", value: "" },
    QpackStaticEntry { name: "x-frame-options", value: "deny" },
    QpackStaticEntry { name: "x-frame-options", value: "sameorigin" },
];

/// QPACK Decoder for HTTP/3 HEADERS frames.
pub struct QpackDecoder;

impl QpackDecoder {
    /// Decodes a QPACK encoded header block into header key-value pairs.
    pub fn decode_header_block(bytes: &[u8]) -> Result<Vec<(String, String)>, ParserError> {
        if bytes.len() < 2 {
            return Ok(Vec::new());
        }

        // Prefix: Required Insert Count (Varint) + Sign bit & Delta Base (Varint)
        let mut offset = 0;
        let (_ric, ric_len) = QuicVarint::decode(&bytes[offset..])?;
        offset += ric_len;

        if offset >= bytes.len() {
            return Ok(Vec::new());
        }

        let (_base, base_len) = QuicVarint::decode(&bytes[offset..])?;
        offset += base_len;

        let mut headers = Vec::new();

        while offset < bytes.len() {
            let b = bytes[offset];

            if (b & 0x80) != 0 {
                // 1xxxxxxx: Indexed Header Field from Static Table (bit 6 = 1) or Dynamic Table (bit 6 = 0)
                let is_static = (b & 0x40) != 0;
                let index = (b & 0x3F) as usize;
                offset += 1;

                if is_static && index < QPACK_STATIC_TABLE.len() {
                    let entry = &QPACK_STATIC_TABLE[index];
                    headers.push((entry.name.to_string(), entry.value.to_string()));
                }
            } else if (b & 0x40) != 0 {
                // 01xxxxxx: Literal Header Field with Static Name Reference
                let is_static = (b & 0x10) != 0;
                let name_idx = (b & 0x0F) as usize;
                offset += 1;

                let name = if is_static && name_idx < QPACK_STATIC_TABLE.len() {
                    QPACK_STATIC_TABLE[name_idx].name.to_string()
                } else {
                    format!("header-{}", name_idx)
                };

                let (val, val_consumed) = Self::decode_string(&bytes[offset..])?;
                offset += val_consumed;
                headers.push((name, val));
            } else if (b & 0x20) != 0 {
                // 001xxxxx: Literal Header Field with Literal Name
                offset += 1;
                let (name, name_consumed) = Self::decode_string(&bytes[offset..])?;
                offset += name_consumed;
                let (val, val_consumed) = Self::decode_string(&bytes[offset..])?;
                offset += val_consumed;
                headers.push((name, val));
            } else {
                offset += 1;
            }
        }

        Ok(headers)
    }

    /// Encodes a list of headers into a basic QPACK payload with static table indexes where available.
    pub fn encode_header_block(headers: &[(String, String)]) -> Vec<u8> {
        let mut buf = Vec::new();
        // Required Insert Count = 0, Sign & Delta Base = 0
        buf.push(0x00);
        buf.push(0x00);

        for (name, val) in headers {
            let lower_name = name.to_lowercase();
            // Check if exact match in static table
            if let Some(idx) = QPACK_STATIC_TABLE.iter().position(|e| e.name == lower_name && e.value == val) {
                buf.push(0xC0 | (idx as u8)); // 11xxxxxx (Static Index)
            } else if let Some(idx) = QPACK_STATIC_TABLE.iter().position(|e| e.name == lower_name) {
                // Name match with literal value
                buf.push(0x50 | ((idx as u8) & 0x0F)); // 0101xxxx (Static Name Ref)
                Self::encode_string(val, &mut buf);
            } else {
                // Literal name & value
                buf.push(0x20); // 00100000
                Self::encode_string(&lower_name, &mut buf);
                Self::encode_string(val, &mut buf);
            }
        }

        buf
    }

    fn decode_string(bytes: &[u8]) -> Result<(String, usize), ParserError> {
        if bytes.is_empty() {
            return Err(ParserError::Truncated("Empty buffer decoding QPACK string".to_string()));
        }

        let first = bytes[0];
        let _huffman = (first & 0x80) != 0;
        let len = (first & 0x7F) as usize;
        let mut offset = 1;

        if bytes.len() < offset + len {
            return Err(ParserError::Truncated(format!("Incomplete QPACK string: needed {} bytes", len)));
        }

        let str_bytes = &bytes[offset..offset + len];
        offset += len;

        let s = String::from_utf8_lossy(str_bytes).to_string();
        Ok((s, offset))
    }

    fn encode_string(s: &str, buf: &mut Vec<u8>) {
        let bytes = s.as_bytes();
        let len = bytes.len().min(127) as u8;
        buf.push(len); // Huffman bit 0
        buf.extend_from_slice(&bytes[..len as usize]);
    }
}
