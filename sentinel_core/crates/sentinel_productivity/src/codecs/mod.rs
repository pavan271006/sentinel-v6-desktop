//! Comprehensive pentester codecs module.
//!
//! Provides standalone encoders and decoders for Base64 (Standard/URLSafe/Unpadded),
//! URL Percent Encoding (Query/Path/All/Double-Encode), Hex (Upper/Lower/Delimited/HexDump),
//! HTML Entities (Named/Dec/Hex), JWT Engine (inspect, verify HS/RS/ES/None, tamper),
//! and Gzip (compression/decompression with decompression bomb protection).

pub mod base64;
pub mod gzip;
pub mod hex;
pub mod html;
pub mod jwt;
pub mod url;

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum CodecError {
    #[error("Base64 decode error: {0}")]
    Base64Decode(String),
    #[error("Hex decode error: {0}")]
    HexDecode(String),
    #[error("URL decode error: {0}")]
    UrlDecode(String),
    #[error("HTML entity decode error: {0}")]
    HtmlDecode(String),
    #[error("JWT error: {0}")]
    JwtError(String),
    #[error("Gzip compression/decompression error: {0}")]
    GzipError(String),
    #[error("Decompression bomb detected: output exceeded {max_bytes} bytes")]
    DecompressionBomb { max_bytes: usize },
    #[error("Invalid character for encoding mode: {0}")]
    InvalidCharacter(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Base64Variant {
    Standard,
    StandardUnpadded,
    UrlSafe,
    UrlSafeUnpadded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UrlEncodeMode {
    QueryComponent,
    PathSegment,
    FormUrlEncoded,
    AllCharacters,
    DoubleEncode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HexCase {
    Lower,
    Upper,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HexDelimiter {
    None,
    Space,
    Colon,
    Prefix0x,
    EscapedHex,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HtmlEntityMode {
    Named,
    Decimal,
    Hex,
    AllCharactersDec,
    AllCharactersHex,
}

pub use self::base64::{auto_decode_base64, decode_base64, encode_base64};
pub use self::gzip::{compress_gzip, compress_gzip_level, decompress_gzip, decompress_gzip_bounded};
pub use self::hex::{decode_hex, encode_hex, hexdump};
pub use self::html::{decode_html, encode_html};
pub use self::jwt::{
    JwtAlgorithm, JwtEngine, JwtHeader, JwtToken, JwtValidationOptions, JwtVerifyVerdict,
};
pub use self::url::{decode_url, encode_double_url, encode_url};
