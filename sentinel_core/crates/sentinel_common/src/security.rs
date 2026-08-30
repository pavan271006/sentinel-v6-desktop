// SENTINEL V6: Cryptographic & Secret Redaction Security Layer (SEC-09)
// crates/sentinel_common/src/security.rs

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const REDACTED_PLACEHOLDER: &str = "[REDACTED]";

/// A zeroizing, secure string wrapper that guarantees redaction in Debug, Display, and Serialize.
#[derive(Clone, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct SecretString {
    inner: String,
}

impl SecretString {
    pub fn new(secret: impl Into<String>) -> Self {
        Self {
            inner: secret.into(),
        }
    }

    pub fn expose_secret(&self) -> &str {
        &self.inner
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.inner.as_bytes()
    }
}

impl From<String> for SecretString {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

impl From<&str> for SecretString {
    fn from(s: &str) -> Self {
        Self::new(s)
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "\"{}\"", REDACTED_PLACEHOLDER)
    }
}

impl fmt::Display for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", REDACTED_PLACEHOLDER)
    }
}

impl Serialize for SecretString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(REDACTED_PLACEHOLDER)
    }
}

impl<'de> Deserialize<'de> for SecretString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(Self::new(s))
    }
}

/// A zeroizing, secure byte vector wrapper that guarantees redaction in Debug, Display, and Serialize.
#[derive(Clone, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct SecretBytes {
    inner: Vec<u8>,
}

impl SecretBytes {
    pub fn new(bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            inner: bytes.into(),
        }
    }

    pub fn expose_secret(&self) -> &[u8] {
        &self.inner
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

impl From<Vec<u8>> for SecretBytes {
    fn from(bytes: Vec<u8>) -> Self {
        Self::new(bytes)
    }
}

impl From<&[u8]> for SecretBytes {
    fn from(bytes: &[u8]) -> Self {
        Self::new(bytes.to_vec())
    }
}

impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "\"{}\"", REDACTED_PLACEHOLDER)
    }
}

impl fmt::Display for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", REDACTED_PLACEHOLDER)
    }
}

impl Serialize for SecretBytes {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(REDACTED_PLACEHOLDER)
    }
}

impl<'de> Deserialize<'de> for SecretBytes {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes = Vec::<u8>::deserialize(deserializer)?;
        Ok(Self::new(bytes))
    }
}

/// Redacts sensitive header names or parameter keys based on standard security naming heuristics.
pub fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower.contains("pass")
        || lower.contains("secret")
        || lower.contains("token")
        || lower.contains("auth")
        || lower.contains("key")
        || lower.contains("cert")
        || lower.contains("cookie")
        || lower.contains("credential")
        || lower.contains("signature")
        || lower.contains("private")
}

/// Redact value if the associated key is sensitive.
pub fn redact_sensitive_value(key: &str, val: &str) -> String {
    if is_sensitive_key(key) {
        REDACTED_PLACEHOLDER.to_string()
    } else {
        val.to_string()
    }
}
