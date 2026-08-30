//! Fault-Tolerant HTTP Response Parser
//!
//! Parses HTTP/1.0 and HTTP/1.1 responses with byte-exact header preservation,
//! chunked stream decoding, and RFC 9112 status code handling.

use sentinel_common::errors::SentinelError;
use sentinel_common::operational::ParsedResponse;

use crate::chunked::ChunkedDecoder;
use crate::error::ParserError;
use crate::headers::{find_headers, parse_headers, trim_crlf_and_space};
use crate::smuggling::analyze_headers;
use crate::types::RichParsedResponse;

/// Parses a raw HTTP response byte stream into a `RichParsedResponse`.
pub fn parse_response_rich(
    raw: &[u8],
    max_body_size: usize,
) -> Result<RichParsedResponse, ParserError> {
    if raw.is_empty() {
        return Err(ParserError::Truncated(
            "Empty response byte slice".to_string(),
        ));
    }

    let len = raw.len();
    let mut offset = 0;

    // Skip leading newlines if any
    while offset < len && (raw[offset] == b'\r' || raw[offset] == b'\n') {
        offset += 1;
    }

    if offset >= len {
        return Err(ParserError::Truncated(
            "Response contains only newlines".to_string(),
        ));
    }

    // Locate end of status line
    let line_end = match raw[offset..].iter().position(|&b| b == b'\n') {
        Some(pos) => offset + pos + 1,
        None => {
            return Err(ParserError::Truncated(
                "Incomplete status line (no newline delimiter)".to_string(),
            ))
        }
    };

    let status_line = &raw[offset..line_end];
    let status_line_clean = trim_crlf_and_space(status_line);

    // Split status line into version, status code, and reason phrase
    let first_space = status_line_clean
        .iter()
        .position(|&b| b == b' ' || b == b'\t');
    let (version_bytes, rest) = match first_space {
        Some(pos) => (&status_line_clean[..pos], &status_line_clean[pos + 1..]),
        None => {
            return Err(ParserError::InvalidStatusLine(
                "Status line missing status code".to_string(),
            ))
        }
    };

    let version = std::str::from_utf8(version_bytes)
        .map_err(|_| ParserError::InvalidStatusLine("Version contains non-UTF8 bytes".to_string()))?
        .to_string();

    let rest_clean = trim_crlf_and_space(rest);
    let second_space = rest_clean.iter().position(|&b| b == b' ' || b == b'\t');

    let (status_str, reason) = match second_space {
        Some(pos) => {
            let code_str = std::str::from_utf8(&rest_clean[..pos]).map_err(|_| {
                ParserError::InvalidStatusLine("Status code contains non-UTF8 bytes".to_string())
            })?;
            let reason_bytes = trim_crlf_and_space(&rest_clean[pos + 1..]);
            let reason_str = String::from_utf8_lossy(reason_bytes).to_string();
            (code_str, reason_str)
        }
        None => {
            let code_str = std::str::from_utf8(rest_clean).map_err(|_| {
                ParserError::InvalidStatusLine("Status code contains non-UTF8 bytes".to_string())
            })?;
            (code_str, "".to_string())
        }
    };

    let status_code = status_str.parse::<u16>().map_err(|e| {
        ParserError::InvalidStatusLine(format!(
            "Invalid integer status code '{}': {}",
            status_str, e
        ))
    })?;

    offset = line_end;

    // Parse headers
    let (mut headers, body_offset, obs_fold) = parse_headers(raw, offset)?;

    // Check RFC 9112 §6.3: 1xx, 204, and 304 responses MUST NOT contain a message body
    if (100..200).contains(&status_code) || status_code == 204 || status_code == 304 {
        let warns = analyze_headers(&headers, obs_fold, 0);
        return Ok(RichParsedResponse {
            version,
            status_code,
            reason,
            headers,
            body: Vec::new(),
            raw: raw.to_vec(),
            warnings: warns,
            is_chunked: false,
            content_length: Some(0),
        });
    }

    // Determine body handling
    let te_headers = find_headers(&headers, "transfer-encoding");
    let cl_headers = find_headers(&headers, "content-length");

    let is_chunked = te_headers.iter().any(|h| {
        let s = h.value_as_str().trim().to_ascii_lowercase();
        s == "chunked" || s.ends_with(", chunked") || s.ends_with(",chunked")
    });

    let content_length = if let Some(cl_h) = cl_headers.first() {
        let val_str = cl_h.value_as_str().trim();
        let first_val = val_str.split(',').next().unwrap_or("0").trim();
        first_val.parse::<usize>().ok()
    } else {
        None
    };

    let (body, warnings) = if is_chunked {
        let chunk_res = ChunkedDecoder::decode(&raw[body_offset..], max_body_size)?;
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
                    "Response Content-Length {} exceeds maximum allowed body size of {} bytes",
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
        // Read until end of raw slice
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

    Ok(RichParsedResponse {
        version,
        status_code,
        reason,
        headers,
        body,
        raw: raw.to_vec(),
        warnings,
        is_chunked,
        content_length,
    })
}

/// Parses a raw HTTP response byte stream into canonical `ParsedResponse`.
pub fn parse_response_canonical(
    raw: &[u8],
    max_body_size: usize,
) -> Result<ParsedResponse, SentinelError> {
    let rich = parse_response_rich(raw, max_body_size)?;
    Ok(rich.to_parsed_response())
}
