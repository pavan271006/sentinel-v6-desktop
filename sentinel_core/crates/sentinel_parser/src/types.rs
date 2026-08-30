//! Rich and Structured HTTP Parser Representations
//!
//! Provides comprehensive intermediate representations preserving raw delimiters,
//! anomaly metadata, and conversion methods to canonical domain structs.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::domain::meta::{
    EntityMetadata, HttpParsedParts, MessageRepresentation, TlsData,
};
use sentinel_common::enums::{HttpMethod, Provenance};
use sentinel_common::operational::{ParseWarning, ParsedRequest, ParsedResponse};
use sentinel_common::Transaction;

/// A raw HTTP header item preserving original case, delimiter spacing, and full line.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RawHeader {
    /// Raw name bytes as encountered on the wire (e.g. `b"Host"`, `b"Content-Length "`)
    pub name: Vec<u8>,
    /// Raw value bytes after the colon delimiter (trimmed of standard leading/trailing SP/HTAB)
    pub value: Vec<u8>,
    /// Delimiter bytes between name and value (e.g. `b": "` or `b" : "`)
    pub delimiter: Vec<u8>,
    /// Exact line bytes including line termination
    pub raw_line: Vec<u8>,
    /// True if whitespace preceded the colon delimiter (e.g. `Header : value`)
    pub space_before_colon: bool,
}

impl RawHeader {
    pub fn new(name: impl Into<Vec<u8>>, value: impl Into<Vec<u8>>) -> Self {
        let name_bytes = name.into();
        let value_bytes = value.into();
        let mut raw_line = name_bytes.clone();
        raw_line.extend_from_slice(b": ");
        raw_line.extend_from_slice(&value_bytes);
        raw_line.extend_from_slice(b"\r\n");

        Self {
            name: name_bytes,
            value: value_bytes,
            delimiter: b": ".to_vec(),
            raw_line,
            space_before_colon: false,
        }
    }

    pub fn name_as_str(&self) -> &str {
        std::str::from_utf8(&self.name).unwrap_or("")
    }

    pub fn value_as_str(&self) -> &str {
        std::str::from_utf8(&self.value).unwrap_or("")
    }
}

/// Rich parsed HTTP request containing all structured, raw, and diagnostic metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RichParsedRequest {
    /// Canonical HTTP method enum
    pub method: HttpMethod,
    /// Raw method bytes (e.g. `b"GET"`, `b"GRAPHQL"`, or custom verb)
    pub raw_method: Vec<u8>,
    /// Request URI / Path / Authority
    pub uri: String,
    /// HTTP version string (e.g. `"HTTP/1.1"`, `"HTTP/2.0"`, `"HTTP/0.9"`)
    pub version: String,
    /// Headers with complete raw byte fidelity
    pub headers: Vec<RawHeader>,
    /// Decoded or raw body payload
    pub body: Vec<u8>,
    /// Full unmodified wire bytes of the request
    pub raw: Vec<u8>,
    /// Smuggling and protocol anomaly warnings identified during parsing
    pub warnings: Vec<ParseWarning>,
    /// True if request used `Transfer-Encoding: chunked`
    pub is_chunked: bool,
    /// Declared Content-Length if present
    pub content_length: Option<usize>,
}

impl RichParsedRequest {
    /// Converts rich request into canonical `ParsedRequest` for trait compatibility.
    pub fn to_parsed_request(&self) -> ParsedRequest {
        ParsedRequest {
            method: self.method,
            uri: self.uri.clone(),
            version: self.version.clone(),
            headers: self
                .headers
                .iter()
                .map(|h| (h.name.clone(), h.value.clone()))
                .collect(),
            body: self.body.clone(),
        }
    }

    /// Converts to `HttpParsedParts` for storage in `MessageRepresentation`.
    pub fn to_parsed_parts(&self) -> HttpParsedParts {
        HttpParsedParts {
            method: self.method,
            uri: self.uri.clone(),
            version: self.version.clone(),
            headers: self
                .headers
                .iter()
                .map(|h| (h.name.clone(), h.value.clone()))
                .collect(),
        }
    }

    /// Builds the SEC-10 Triple Representation given a CAS blob UUID and normalized text.
    pub fn to_message_representation(
        &self,
        raw_blob_id: Uuid,
        normalized_text: String,
    ) -> MessageRepresentation {
        MessageRepresentation {
            raw_blob_id,
            parsed: self.to_parsed_parts(),
            normalized_text,
        }
    }
}

/// Rich parsed HTTP response containing all structured, raw, and diagnostic metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RichParsedResponse {
    /// HTTP version string (e.g. `"HTTP/1.1"`, `"HTTP/2.0"`)
    pub version: String,
    /// Numeric HTTP status code (e.g. 200, 404, 500)
    pub status_code: u16,
    /// Status reason phrase (e.g. `"OK"`, `"Not Found"`)
    pub reason: String,
    /// Headers with complete raw byte fidelity
    pub headers: Vec<RawHeader>,
    /// Decoded or raw body payload
    pub body: Vec<u8>,
    /// Full unmodified wire bytes of the response
    pub raw: Vec<u8>,
    /// Protocol anomaly warnings identified during parsing
    pub warnings: Vec<ParseWarning>,
    /// True if response used `Transfer-Encoding: chunked`
    pub is_chunked: bool,
    /// Declared Content-Length if present
    pub content_length: Option<usize>,
}

impl RichParsedResponse {
    /// Converts rich response into canonical `ParsedResponse` for trait compatibility.
    pub fn to_parsed_response(&self) -> ParsedResponse {
        ParsedResponse {
            version: self.version.clone(),
            status_code: self.status_code,
            reason: self.reason.clone(),
            headers: self
                .headers
                .iter()
                .map(|h| (h.name.clone(), h.value.clone()))
                .collect(),
            body: self.body.clone(),
        }
    }

    /// Converts to `HttpParsedParts` for storage in `MessageRepresentation`.
    pub fn to_parsed_parts(&self) -> HttpParsedParts {
        HttpParsedParts {
            method: HttpMethod::GET, // Default for response parts
            uri: "".to_string(),
            version: self.version.clone(),
            headers: self
                .headers
                .iter()
                .map(|h| (h.name.clone(), h.value.clone()))
                .collect(),
        }
    }

    /// Builds the SEC-10 Triple Representation given a CAS blob UUID and normalized text.
    pub fn to_message_representation(
        &self,
        raw_blob_id: Uuid,
        normalized_text: String,
    ) -> MessageRepresentation {
        MessageRepresentation {
            raw_blob_id,
            parsed: self.to_parsed_parts(),
            normalized_text,
        }
    }
}

/// Helper to build a complete `Transaction` entity.
pub fn build_transaction(
    request_repr: MessageRepresentation,
    response_repr: Option<MessageRepresentation>,
    duration: std::time::Duration,
    tls_info: Option<TlsData>,
    scope_id: Option<Uuid>,
) -> Transaction {
    let mut meta = EntityMetadata::new(Provenance::Proxy);
    if let Some(sid) = scope_id {
        meta = meta.with_scope(sid);
    }

    Transaction {
        meta,
        request: request_repr,
        response: response_repr,
        timing: duration,
        tls_info,
    }
}
