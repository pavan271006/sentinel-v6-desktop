//! Fault-Tolerant HTTP Header Parsing & Anomaly Tracking
//!
//! Preserves raw delimiters, exact header casing, duplicate headers in order,
//! whitespace before colons, and obsolete line folding (obs-fold).

use crate::error::ParserError;
use crate::types::RawHeader;

/// Parses a block of HTTP headers starting from `offset` in `raw`.
///
/// Returns:
/// - `Vec<RawHeader>`: The list of parsed headers with byte fidelity.
/// - `usize`: The index in `raw` where the headers terminate and body begins.
/// - `bool`: True if obsolete line folding (obs-fold) was detected.
pub fn parse_headers(
    raw: &[u8],
    mut offset: usize,
) -> Result<(Vec<RawHeader>, usize, bool), ParserError> {
    let mut headers = Vec::new();
    let mut obs_fold_detected = false;
    let len = raw.len();

    while offset < len {
        // Check for empty line terminating header block
        if raw[offset..].starts_with(b"\r\n") {
            offset += 2;
            return Ok((headers, offset, obs_fold_detected));
        }
        if raw[offset..].starts_with(b"\n") {
            offset += 1;
            return Ok((headers, offset, obs_fold_detected));
        }

        // Find end of current header line
        let line_end = match raw[offset..].iter().position(|&b| b == b'\n') {
            Some(pos) => offset + pos + 1,
            None => len, // Truncated or stream ended without trailing newline
        };

        let raw_line = &raw[offset..line_end];

        // Check for obsolete line folding (line starting with SP or HTAB)
        if (raw_line.starts_with(b" ") || raw_line.starts_with(b"\t")) && !headers.is_empty() {
            obs_fold_detected = true;
            let last_idx = headers.len() - 1;
            let fold_val = trim_crlf_and_space(raw_line);

            // Append folded line to previous header
            let prev_header = &mut headers[last_idx];
            prev_header.value.push(b' ');
            prev_header.value.extend_from_slice(fold_val);
            prev_header.raw_line.extend_from_slice(raw_line);
            offset = line_end;
            continue;
        }

        // Normal header line: locate the first colon
        if let Some(colon_pos) = raw_line.iter().position(|&b| b == b':') {
            let name_raw = &raw_line[..colon_pos];
            let after_colon = &raw_line[colon_pos + 1..];

            // Check if whitespace precedes the colon (e.g. "Content-Length : 10")
            let space_before_colon = name_raw.ends_with(b" ") || name_raw.ends_with(b"\t");

            // Extract trimmed name and value
            let name_trimmed = trim_leading_trailing(name_raw);
            let value_trimmed = trim_crlf_and_space(after_colon);

            // Delimiter from colon up to start of value
            let delimiter = b": ".to_vec();

            headers.push(RawHeader {
                name: name_trimmed.to_vec(),
                value: value_trimmed.to_vec(),
                delimiter,
                raw_line: raw_line.to_vec(),
                space_before_colon,
            });
        } else {
            // Malformed header line without colon: preserve as raw header item
            let line_trimmed = trim_crlf_and_space(raw_line);
            if !line_trimmed.is_empty() {
                headers.push(RawHeader {
                    name: line_trimmed.to_vec(),
                    value: Vec::new(),
                    delimiter: Vec::new(),
                    raw_line: raw_line.to_vec(),
                    space_before_colon: false,
                });
            }
        }

        offset = line_end;
    }

    // Reached end of slice without empty line terminator
    Ok((headers, offset, obs_fold_detected))
}

/// Trims leading and trailing SP (0x20) and HTAB (0x09) bytes.
pub fn trim_leading_trailing(bytes: &[u8]) -> &[u8] {
    let mut start = 0;
    while start < bytes.len() && (bytes[start] == b' ' || bytes[start] == b'\t') {
        start += 1;
    }
    let mut end = bytes.len();
    while end > start && (bytes[end - 1] == b' ' || bytes[end - 1] == b'\t') {
        end -= 1;
    }
    &bytes[start..end]
}

/// Trims trailing \r, \n, SP, and HTAB, and leading SP and HTAB.
pub fn trim_crlf_and_space(bytes: &[u8]) -> &[u8] {
    let mut end = bytes.len();
    while end > 0
        && (bytes[end - 1] == b'\r'
            || bytes[end - 1] == b'\n'
            || bytes[end - 1] == b' '
            || bytes[end - 1] == b'\t')
    {
        end -= 1;
    }
    let mut start = 0;
    while start < end && (bytes[start] == b' ' || bytes[start] == b'\t') {
        start += 1;
    }
    &bytes[start..end]
}

/// Helper to search headers by name (case-insensitive ASCII).
pub fn find_headers<'a>(headers: &'a [RawHeader], name: &str) -> Vec<&'a RawHeader> {
    headers
        .iter()
        .filter(|h| h.name.eq_ignore_ascii_case(name.as_bytes()))
        .collect()
}

/// Helper to get the first header value matching name (case-insensitive ASCII).
pub fn get_header_value<'a>(headers: &'a [RawHeader], name: &str) -> Option<&'a [u8]> {
    headers
        .iter()
        .find(|h| h.name.eq_ignore_ascii_case(name.as_bytes()))
        .map(|h| h.value.as_slice())
}
