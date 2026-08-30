//! Search Normalization & BM25 Index String Generation
//!
//! Generates lowercased, searchable string representations from HTTP requests
//! and responses for indexing without mutating the immutable raw byte stream.

use crate::types::{RichParsedRequest, RichParsedResponse};
use sentinel_common::operational::{ParsedRequest, ParsedResponse};

/// Builds normalized lowercased text representation of a parsed request.
pub fn build_normalized_request_text(req: &ParsedRequest) -> String {
    let mut out = String::with_capacity(256 + req.body.len().min(4096));

    // Request line
    out.push_str(req.method.as_str());
    out.push(' ');
    out.push_str(&req.uri);
    out.push(' ');
    out.push_str(&req.version);
    out.push('\n');

    // Headers
    for (name, val) in &req.headers {
        let name_str = String::from_utf8_lossy(name);
        let val_str = String::from_utf8_lossy(val);
        out.push_str(&name_str.to_lowercase());
        out.push_str(": ");
        out.push_str(&val_str.to_lowercase());
        out.push('\n');
    }

    // Body (up to 16KB for search index)
    if !req.body.is_empty() {
        let body_preview = if req.body.len() > 16384 {
            &req.body[..16384]
        } else {
            &req.body
        };
        out.push_str(&String::from_utf8_lossy(body_preview).to_lowercase());
    }

    out
}

/// Builds normalized lowercased text representation of a parsed response.
pub fn build_normalized_response_text(res: &ParsedResponse) -> String {
    let mut out = String::with_capacity(256 + res.body.len().min(4096));

    // Status line
    out.push_str(&res.version);
    out.push(' ');
    out.push_str(&res.status_code.to_string());
    out.push(' ');
    out.push_str(&res.reason);
    out.push('\n');

    // Headers
    for (name, val) in &res.headers {
        let name_str = String::from_utf8_lossy(name);
        let val_str = String::from_utf8_lossy(val);
        out.push_str(&name_str.to_lowercase());
        out.push_str(": ");
        out.push_str(&val_str.to_lowercase());
        out.push('\n');
    }

    // Body
    if !res.body.is_empty() {
        let body_preview = if res.body.len() > 16384 {
            &res.body[..16384]
        } else {
            &res.body
        };
        out.push_str(&String::from_utf8_lossy(body_preview).to_lowercase());
    }

    out
}

/// Builds normalized text from a `RichParsedRequest`.
pub fn build_rich_request_normalized_text(req: &RichParsedRequest) -> String {
    build_normalized_request_text(&req.to_parsed_request())
}

/// Builds normalized text from a `RichParsedResponse`.
pub fn build_rich_response_normalized_text(res: &RichParsedResponse) -> String {
    build_normalized_response_text(&res.to_parsed_response())
}
