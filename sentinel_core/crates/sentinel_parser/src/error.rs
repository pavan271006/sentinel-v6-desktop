//! Sentinel HTTP Parser Errors
//!
//! Maps internal parser errors to canonical `SentinelError::ParseError`.

use sentinel_common::errors::SentinelError;
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ParserError {
    #[error("Incomplete or truncated HTTP stream: {0}")]
    Truncated(String),

    #[error("Invalid request line: {0}")]
    InvalidRequestLine(String),

    #[error("Invalid status line: {0}")]
    InvalidStatusLine(String),

    #[error("Invalid header line: {0}")]
    InvalidHeader(String),

    #[error("Invalid chunked encoding: {0}")]
    InvalidChunkedEncoding(String),

    #[error("Payload exceeded memory limit ({limit} bytes): {message}")]
    PayloadTooLarge { limit: usize, message: String },

    #[error("Invalid HTTP/2 frame: {0}")]
    InvalidH2Frame(String),

    #[error("HPACK decoding error: {0}")]
    HpackError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("General parse error: {0}")]
    General(String),
}

impl From<ParserError> for SentinelError {
    fn from(err: ParserError) -> Self {
        match err {
            ParserError::SerializationError(msg) => SentinelError::Serialization(msg),
            _ => SentinelError::ParseError(err.to_string()),
        }
    }
}
