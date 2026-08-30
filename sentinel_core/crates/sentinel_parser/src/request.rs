//! Fault-Tolerant HTTP Request Parser
//!
//! Parses HTTP/1.0, HTTP/1.1, and HTTP/0.9 requests with byte-exact header preservation,
//! chunked decoding, and request smuggling anomaly detection.

use std::str::FromStr;

use sentinel_common::enums::HttpMethod;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::ParsedRequest;

use crate::chunked::ChunkedDecoder;
use crate::error::ParserError;
use crate::headers::{find_headers, parse_headers, trim_crlf_and_space};
use crate::smuggling::analyze_headers;
use crate::types::RichParsedRequest;

/// Maximum default request body size (10 MB).
pub const DEFAULT_MAX_BODY_SIZE: usize = 10 * 1024 * 1024;

/// Parses a raw HTTP request byte stream into a `RichParsedRequest`.
pub fn parse_request_rich(
    raw: &[u8],
    max_body_size: usize,
) -> Result<RichParsedRequest, ParserError> {
    if raw.is_empty() {
        return Err(ParserError::Truncated("Empty byte slice".to_string()));
    }

    let len = raw.len();
    let mut offset = 0;

    // Skip leading empty CRLFs if any
    while offset < len && (raw[offset] == b'\r' || raw[offset] == b'\n') {
        offset += 1;
    }

    if offset >= len {
        return Err(ParserError::Truncated(
            "Stream contains only newlines".to_string(),
        ));
    }

    // Locate end of request line
    let line_end = match raw[offset..].iter().position(|&b| b == b'\n') {
        Some(pos) => offset + pos + 1,
        None => {
            return Err(ParserError::Truncated(
                "Incomplete request line (no newline delimiter)".to_string(),
            ))
        }
    };

    let req_line = &raw[offset..line_end];
    let req_line_clean = trim_crlf_and_space(req_line);

    // Split request line by space/tab tokens
    let tokens: Vec<&[u8]> = req_line_clean
        .split(|&b| b == b' ' || b == b'\t')
        .filter(|t| !t.is_empty())
        .collect();

    if tokens.is_empty() {
        return Err(ParserError::InvalidRequestLine(
            "Empty request line".to_string(),
        ));
    }

    let raw_method = tokens[0].to_vec();
    let method_str = std::str::from_utf8(&raw_method).map_err(|_| {
        ParserError::InvalidRequestLine("Method contains non-UTF8 bytes".to_string())
    })?;

    let method = HttpMethod::from_str(method_str).map_err(|_| {
        ParserError::InvalidRequestLine(format!("Unknown HTTP method '{}'", method_str))
    })?;

    let uri = if tokens.len() > 1 {
        std::str::from_utf8(tokens[1])
            .map_err(|_| {
                ParserError::InvalidRequestLine("URI contains non-UTF8 bytes".to_string())
            })?
            .to_string()
    } else {
        "/".to_string()
    };

    let version = if tokens.len() > 2 {
        std::str::from_utf8(tokens[2])
            .map_err(|_| {
                ParserError::InvalidRequestLine("Version contains non-UTF8 bytes".to_string())
            })?
            .to_string()
    } else {
        "HTTP/0.9".to_string()
    };

    offset = line_end;

    // Parse headers
    let (mut headers, body_offset, obs_fold) = parse_headers(raw, offset)?;

    // Determine body handling
    let te_headers = find_headers(&headers, "transfer-encoding");
    let cl_headers = find_headers(&headers, "content-length");

    let is_chunked = te_headers.iter().any(|h| {
        let s = h.value_as_str().trim().to_ascii_lowercase();
        s == "chunked" || s.ends_with(", chunked") || s.ends_with(",chunked")
    });

    let content_length = if let Some(cl_h) = cl_headers.first() {
        let val_str = cl_h.value_as_str().trim();
        // Handle comma-separated duplicate if any ("10, 10")
        let first_val = val_str.split(',').next().unwrap_or("0").trim();
        first_val.parse::<usize>().ok()
    } else {
        None
    };

    let (body, warnings) = if is_chunked {
        let chunk_res = ChunkedDecoder::decode(&raw[body_offset..], max_body_size)?;
        // Append trailers if any
        headers.extend(chunk_res.trailers);

        let mut warns = analyze_headers(&headers, obs_fold, chunk_res.body.len());
        if chunk_res.has_anomaly {
            warns.push(
                crate::smuggling::SmugglingIndicator::InvalidChunkHex.to_warning(
                    body_offset,
                    "Chunked stream contained encoding anomalies or malformed extensions",
                ),
            );
        }
        (chunk_res.body, warns)
    } else if let Some(cl) = content_length {
        if cl > max_body_size {
            return Err(ParserError::PayloadTooLarge {
                limit: max_body_size,
                message: format!(
                    "Content-Length {} exceeds maximum allowed body size of {} bytes",
                    cl, max_body_size
                ),
            });
        }

        let body_available = raw.len().saturating_sub(body_offset);
        let actual_len = cl.min(body_available);
        let body_bytes = raw[body_offset..body_offset + actual_len].to_vec();

        let warns = analyze_headers(&headers, obs_fold, body_bytes.len());
        (body_bytes, warns)
    } else {
        // No CL and not chunked: check if there are remaining body bytes (e.g. pipelined or raw data)
        let body_bytes = if body_offset < raw.len() {
            let rem = &raw[body_offset..];
            if rem.len() > max_body_size {
                rem[..max_body_size].to_vec()
            } else {
                rem.to_vec()
            }
        } else {
            Vec::new()
        };
        let warns = analyze_headers(&headers, obs_fold, body_bytes.len());
        (body_bytes, warns)
    };

    Ok(RichParsedRequest {
        method,
        raw_method,
        uri,
        version,
        headers,
        body,
        raw: raw.to_vec(),
        warnings,
        is_chunked,
        content_length,
    })
}

/// Parses a raw HTTP request byte stream into canonical `ParsedRequest`.
pub fn parse_request_canonical(
    raw: &[u8],
    max_body_size: usize,
) -> Result<ParsedRequest, SentinelError> {
    let rich = parse_request_rich(raw, max_body_size)?;
    Ok(rich.to_parsed_request())
}
