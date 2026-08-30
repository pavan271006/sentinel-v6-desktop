//! Cryptographic Hash Engine supporting MD5, SHA-1, SHA-256, SHA-384, SHA-512,
//! Keccak-256, and constant-time HMAC verification.

pub mod engine;
pub mod keccak;

pub use engine::HashEngine;
pub use keccak::keccak256;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HashAlgorithm {
    Md5,
    Sha1,
    Sha256,
    Sha384,
    Sha512,
    Keccak256,
}

impl HashAlgorithm {
    pub fn as_str(&self) -> &'static str {
        match self {
            HashAlgorithm::Md5 => "MD5",
            HashAlgorithm::Sha1 => "SHA-1",
            HashAlgorithm::Sha256 => "SHA-256",
            HashAlgorithm::Sha384 => "SHA-384",
            HashAlgorithm::Sha512 => "SHA-512",
            HashAlgorithm::Keccak256 => "Keccak-256",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HmacAlgorithm {
    HmacMd5,
    HmacSha1,
    HmacSha256,
    HmacSha512,
}

impl HmacAlgorithm {
    pub fn as_str(&self) -> &'static str {
        match self {
            HmacAlgorithm::HmacMd5 => "HMAC-MD5",
            HmacAlgorithm::HmacSha1 => "HMAC-SHA1",
            HmacAlgorithm::HmacSha256 => "HMAC-SHA256",
            HmacAlgorithm::HmacSha512 => "HMAC-SHA512",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HashOutput {
    pub algorithm: String,
    pub raw: Vec<u8>,
    pub hex: String,
    pub base64: String,
}
