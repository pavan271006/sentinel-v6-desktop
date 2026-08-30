//! Sentinel HTTP Parser Subsystem (SUB-02 / WP-2.1)
//!
//! Provides fault-tolerant, byte-exact parsing of HTTP/1.0, HTTP/1.1, and HTTP/2
//! network traffic while preserving malformed headers, whitespace before colons,
//! chunked encoding anomalies, and request smuggling indicators (SEC-10).

pub mod chunked;
pub mod error;
pub mod h2;
pub mod h3;
pub mod headers;
pub mod normalization;
pub mod request;
pub mod response;
pub mod serialize;
pub mod smuggling;
pub mod types;

use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParseWarning, ParsedRequest, ParsedResponse};
use sentinel_common::traits::HttpParser;

pub use chunked::{ChunkedDecodeResult, ChunkedDecoder};
pub use error::ParserError;
pub use h2::{H2Frame, H2FrameHeader, HpackDecoder};
pub use h3::{H3Frame, H3FrameType, QpackDecoder, QuicVarint};
pub use normalization::{
    build_normalized_request_text, build_normalized_response_text,
    build_rich_request_normalized_text, build_rich_response_normalized_text,
};
pub use request::{parse_request_canonical, parse_request_rich, DEFAULT_MAX_BODY_SIZE};
pub use response::{parse_response_canonical, parse_response_rich};
pub use serialize::{
    serialize_request, serialize_response, serialize_rich_request, serialize_rich_response,
};
pub use smuggling::{analyze_h2_headers, analyze_headers, SmugglingIndicator};
pub use types::{build_transaction, RawHeader, RichParsedRequest, RichParsedResponse};

/// Primary implementation of the `HttpParser` trait.
#[derive(Debug, Clone)]
pub struct SentinelHttpParser {
    max_body_size: usize,
}

impl Default for SentinelHttpParser {
    fn default() -> Self {
        Self {
            max_body_size: DEFAULT_MAX_BODY_SIZE,
        }
    }
}

impl SentinelHttpParser {
    /// Creates a new `SentinelHttpParser` with default 10MB body size limit.
    pub fn new() -> Self {
        Self::default()
    }

    /// Configures parser with a custom maximum body size limit.
    pub fn with_max_body_size(max_body_size: usize) -> Self {
        Self { max_body_size }
    }

    /// Parses a raw HTTP request byte stream into a detailed `RichParsedRequest`.
    pub fn parse_request_rich(&self, raw: &[u8]) -> Result<RichParsedRequest, ParserError> {
        parse_request_rich(raw, self.max_body_size)
    }

    /// Parses a raw HTTP response byte stream into a detailed `RichParsedResponse`.
    pub fn parse_response_rich(&self, raw: &[u8]) -> Result<RichParsedResponse, ParserError> {
        parse_response_rich(raw, self.max_body_size)
    }

    /// Scans a request for HTTP request smuggling anomalies.
    pub fn detect_smuggling(&self, req: &RichParsedRequest) -> Vec<ParseWarning> {
        analyze_headers(&req.headers, false, req.body.len())
    }
}

#[async_trait]
impl HttpParser for SentinelHttpParser {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError> {
        parse_request_canonical(raw, self.max_body_size)
    }

    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError> {
        parse_response_canonical(raw, self.max_body_size)
    }

    fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError> {
        serialize_request(req)
    }

    fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError> {
        serialize_response(res)
    }
}
