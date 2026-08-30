//! Byte-Accurate HTTP Request and Response Serialization
//!
//! Enforces Security Invariant SEC-10: Deterministic roundtrip fidelity
//! such that `serialize(parse(raw)) == raw` for well-formed HTTP streams.

use crate::types::{RichParsedRequest, RichParsedResponse};
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};

/// Serializes a `ParsedRequest` into exact HTTP wire byte stream.
pub fn serialize_request(req: &ParsedRequest) -> Result<Vec<u8>, SentinelError> {
    let mut out = Vec::with_capacity(256 + req.body.len());

    // 1. Request Line: {METHOD} {URI} {VERSION}\r\n
    out.extend_from_slice(req.method.as_str().as_bytes());
    out.push(b' ');
    out.extend_from_slice(req.uri.as_bytes());
    out.push(b' ');
    out.extend_from_slice(req.version.as_bytes());
    out.extend_from_slice(b"\r\n");

    // 2. Headers
    for (name, val) in &req.headers {
        out.extend_from_slice(name);
        out.extend_from_slice(b": ");
        out.extend_from_slice(val);
        out.extend_from_slice(b"\r\n");
    }

    // 3. Header Terminator
    out.extend_from_slice(b"\r\n");

    // 4. Body
    out.extend_from_slice(&req.body);

    Ok(out)
}

/// Serializes a `ParsedResponse` into exact HTTP wire byte stream.
pub fn serialize_response(res: &ParsedResponse) -> Result<Vec<u8>, SentinelError> {
    let mut out = Vec::with_capacity(256 + res.body.len());

    // 1. Status Line: {VERSION} {STATUS_CODE} {REASON}\r\n
    out.extend_from_slice(res.version.as_bytes());
    out.push(b' ');
    out.extend_from_slice(res.status_code.to_string().as_bytes());
    if !res.reason.is_empty() {
        out.push(b' ');
        out.extend_from_slice(res.reason.as_bytes());
    }
    out.extend_from_slice(b"\r\n");

    // 2. Headers
    for (name, val) in &res.headers {
        out.extend_from_slice(name);
        out.extend_from_slice(b": ");
        out.extend_from_slice(val);
        out.extend_from_slice(b"\r\n");
    }

    // 3. Header Terminator
    out.extend_from_slice(b"\r\n");

    // 4. Body
    out.extend_from_slice(&res.body);

    Ok(out)
}

/// Serializes a `RichParsedRequest` preserving exact raw headers and delimiters.
pub fn serialize_rich_request(req: &RichParsedRequest) -> Result<Vec<u8>, SentinelError> {
    let mut out = Vec::with_capacity(256 + req.body.len());

    // Request line
    out.extend_from_slice(&req.raw_method);
    out.push(b' ');
    out.extend_from_slice(req.uri.as_bytes());
    out.push(b' ');
    out.extend_from_slice(req.version.as_bytes());
    out.extend_from_slice(b"\r\n");

    // Headers with preserved delimiters
    for h in &req.headers {
        if !h.raw_line.is_empty() {
            out.extend_from_slice(&h.raw_line);
        } else {
            out.extend_from_slice(&h.name);
            out.extend_from_slice(&h.delimiter);
            out.extend_from_slice(&h.value);
            out.extend_from_slice(b"\r\n");
        }
    }

    out.extend_from_slice(b"\r\n");
    out.extend_from_slice(&req.body);

    Ok(out)
}

/// Serializes a `RichParsedResponse` preserving exact raw headers and delimiters.
pub fn serialize_rich_response(res: &RichParsedResponse) -> Result<Vec<u8>, SentinelError> {
    let mut out = Vec::with_capacity(256 + res.body.len());

    // Status line
    out.extend_from_slice(res.version.as_bytes());
    out.push(b' ');
    out.extend_from_slice(res.status_code.to_string().as_bytes());
    if !res.reason.is_empty() {
        out.push(b' ');
        out.extend_from_slice(res.reason.as_bytes());
    }
    out.extend_from_slice(b"\r\n");

    // Headers
    for h in &res.headers {
        if !h.raw_line.is_empty() {
            out.extend_from_slice(&h.raw_line);
        } else {
            out.extend_from_slice(&h.name);
            out.extend_from_slice(&h.delimiter);
            out.extend_from_slice(&h.value);
            out.extend_from_slice(b"\r\n");
        }
    }

    out.extend_from_slice(b"\r\n");
    out.extend_from_slice(&res.body);

    Ok(out)
}
