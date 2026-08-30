//! RFC 9112 Chunked Transfer Encoding Decoder & Encoder
//!
//! Handles hex chunk sizes, chunk extensions, trailer headers, and detects
//! chunked framing anomalies for request smuggling analysis.

use crate::error::ParserError;
use crate::headers::{parse_headers, trim_crlf_and_space};
use crate::types::RawHeader;

/// Result of decoding a chunked byte stream.
#[derive(Debug, Clone)]
pub struct ChunkedDecodeResult {
    /// Concatenated unchunked body bytes
    pub body: Vec<u8>,
    /// Trailing headers attached after the terminating zero chunk
    pub trailers: Vec<RawHeader>,
    /// Number of bytes consumed from the raw stream
    pub bytes_consumed: usize,
    /// Any extensions encountered per chunk: Vec<(chunk_index, raw_extension)>
    pub extensions: Vec<(usize, Vec<u8>)>,
    /// True if any hex anomaly or extension anomaly was detected
    pub has_anomaly: bool,
}

pub struct ChunkedDecoder;

impl ChunkedDecoder {
    /// Decodes a chunked stream from `raw`, bounded by `max_size` bytes.
    pub fn decode(raw: &[u8], max_size: usize) -> Result<ChunkedDecodeResult, ParserError> {
        let mut body = Vec::new();
        let mut extensions = Vec::new();
        let mut offset = 0;
        let mut chunk_idx = 0;
        let mut has_anomaly = false;
        let len = raw.len();

        loop {
            if offset >= len {
                return Err(ParserError::Truncated(
                    "Unexpected EOF before terminating zero chunk".to_string(),
                ));
            }

            // Locate end of chunk-size line (\n)
            let line_end = match raw[offset..].iter().position(|&b| b == b'\n') {
                Some(pos) => offset + pos + 1,
                None => {
                    return Err(ParserError::Truncated(
                        "Incomplete chunk size line".to_string(),
                    ))
                }
            };

            let size_line = &raw[offset..line_end];
            let size_line_clean = trim_crlf_and_space(size_line);

            if size_line_clean.is_empty() {
                // Skip empty leading CRLF if any
                offset = line_end;
                continue;
            }

            // Split chunk-size from optional chunk-extension (;ext=val)
            let (hex_part, ext_part) = match size_line_clean.iter().position(|&b| b == b';') {
                Some(pos) => (&size_line_clean[..pos], Some(&size_line_clean[pos + 1..])),
                None => (size_line_clean, None),
            };

            // Parse hexadecimal chunk size
            let hex_str = std::str::from_utf8(hex_part).map_err(|_| {
                ParserError::InvalidChunkedEncoding("Non-UTF8 chunk size header".to_string())
            })?;

            let chunk_size = match usize::from_str_radix(hex_str.trim(), 16) {
                Ok(sz) => sz,
                Err(e) => {
                    return Err(ParserError::InvalidChunkedEncoding(format!(
                        "Invalid chunk size hex '{}': {}",
                        hex_str, e
                    )));
                }
            };

            if let Some(ext) = ext_part {
                extensions.push((chunk_idx, ext.to_vec()));
            }

            offset = line_end;

            // Check for terminating chunk
            if chunk_size == 0 {
                // Parse optional trailer headers after terminating 0 chunk
                let (trailers, new_offset, _) = parse_headers(raw, offset)?;
                offset = new_offset;

                return Ok(ChunkedDecodeResult {
                    body,
                    trailers,
                    bytes_consumed: offset,
                    extensions,
                    has_anomaly,
                });
            }

            // Verify memory bounds
            if body.len() + chunk_size > max_size {
                return Err(ParserError::PayloadTooLarge {
                    limit: max_size,
                    message: format!(
                        "Chunked payload exceeds {} byte limit (current={}, chunk={})",
                        max_size,
                        body.len(),
                        chunk_size
                    ),
                });
            }

            // Read chunk data
            if offset + chunk_size > len {
                return Err(ParserError::Truncated(format!(
                    "Premature end of stream: expected {} bytes of chunk data, available {}",
                    chunk_size,
                    len.saturating_sub(offset)
                )));
            }

            let chunk_data = &raw[offset..offset + chunk_size];
            body.extend_from_slice(chunk_data);
            offset += chunk_size;

            // Consume trailing CRLF after chunk data
            if offset < len && raw[offset..].starts_with(b"\r\n") {
                offset += 2;
            } else if offset < len && raw[offset..].starts_with(b"\n") {
                offset += 1;
            } else if offset < len {
                has_anomaly = true;
                // Fault-tolerant: if no CRLF, continue scanning
            }

            chunk_idx += 1;
        }
    }

    /// Encodes a raw byte payload into standard HTTP/1.1 chunked transfer stream.
    pub fn encode(payload: &[u8], chunk_size: usize) -> Vec<u8> {
        let chunk_size = if chunk_size == 0 { 4096 } else { chunk_size };
        let mut encoded = Vec::with_capacity(payload.len() + (payload.len() / chunk_size + 2) * 16);

        for chunk in payload.chunks(chunk_size) {
            let hex_len = format!("{:x}\r\n", chunk.len());
            encoded.extend_from_slice(hex_len.as_bytes());
            encoded.extend_from_slice(chunk);
            encoded.extend_from_slice(b"\r\n");
        }

        // Terminating zero chunk
        encoded.extend_from_slice(b"0\r\n\r\n");
        encoded
    }
}
