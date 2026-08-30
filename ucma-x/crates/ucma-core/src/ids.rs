//! Strong, deterministic content-derived identifiers using BLAKE3 hashing.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;

const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";

/// Converts 32 bytes into 64 hex ASCII bytes at compile/runtime.
const fn bytes_to_hex(bytes: &[u8; 32]) -> [u8; 64] {
    let mut hex = [0u8; 64];
    let mut i = 0;
    while i < 32 {
        let b = bytes[i];
        hex[i * 2] = HEX_CHARS[(b >> 4) as usize];
        hex[i * 2 + 1] = HEX_CHARS[(b & 0x0f) as usize];
        i += 1;
    }
    hex
}

/// General 32-byte BLAKE3 content-derived identifier with cached 64-char hex representation.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ContentId {
    bytes: [u8; 32],
    hex: [u8; 64],
}

impl ContentId {
    /// Creates a ContentId from raw 32 bytes.
    pub const fn from_bytes(bytes: [u8; 32]) -> Self {
        Self {
            bytes,
            hex: bytes_to_hex(&bytes),
        }
    }

    /// Returns the underlying 32-byte array.
    pub const fn as_bytes(&self) -> &[u8; 32] {
        &self.bytes
    }

    /// Computes the BLAKE3 hash over any raw byte slice.
    pub fn from_data(data: &[u8]) -> Self {
        let hash = blake3::hash(data);
        Self::from_bytes(*hash.as_bytes())
    }

    /// Returns the 64-character lowercase hex string slice.
    pub fn as_str(&self) -> &str {
        std::str::from_utf8(&self.hex).expect("valid hex is always utf8")
    }

    /// Formats the identifier as a 64-character lowercase hex string.
    pub fn to_hex(&self) -> String {
        self.as_str().to_string()
    }

    /// Parses a 64-character hex string into a ContentId.
    pub fn from_hex(s: &str) -> Result<Self, IdParseError> {
        let s = s.trim();
        if s.len() != 64 {
            return Err(IdParseError::InvalidLength(s.len()));
        }
        let mut bytes = [0u8; 32];
        for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
            let hex_str =
                std::str::from_utf8(chunk).map_err(|_| IdParseError::InvalidHexCharacter)?;
            bytes[i] =
                u8::from_str_radix(hex_str, 16).map_err(|_| IdParseError::InvalidHexCharacter)?;
        }
        Ok(Self::from_bytes(bytes))
    }
}

impl Serialize for ContentId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for ContentId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::from_hex(&s).map_err(serde::de::Error::custom)
    }
}

impl fmt::Debug for ContentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ContentId({})", self.as_str())
    }
}

impl fmt::Display for ContentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for ContentId {
    type Err = IdParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_hex(s)
    }
}

impl AsRef<[u8]> for ContentId {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}

/// Macro to generate domain-specific strongly-typed BLAKE3 IDs.
macro_rules! define_id_type {
    ($type_name:ident, $prefix:literal, $doc:literal) => {
        #[doc = $doc]
        #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
        pub struct $type_name(ContentId);

        impl $type_name {
            /// Constructs an ID from an existing ContentId.
            pub const fn new(content_id: ContentId) -> Self {
                Self(content_id)
            }

            /// Constructs an ID from raw 32 bytes.
            pub const fn from_bytes(bytes: [u8; 32]) -> Self {
                Self(ContentId::from_bytes(bytes))
            }

            /// Returns the underlying raw 32 bytes.
            pub const fn as_bytes(&self) -> &[u8; 32] {
                self.0.as_bytes()
            }

            /// Returns a reference to the inner ContentId.
            pub const fn inner(&self) -> &ContentId {
                &self.0
            }

            /// Returns the 64-character lowercase hex string slice.
            pub fn as_str(&self) -> &str {
                self.0.as_str()
            }

            /// Formats the ID as a 64-character lowercase hex string.
            pub fn to_hex(&self) -> String {
                self.0.to_hex()
            }

            /// Parses a 64-character hex string.
            pub fn from_hex(s: &str) -> Result<Self, IdParseError> {
                ContentId::from_hex(s).map(Self)
            }
        }

        impl fmt::Debug for $type_name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}({})", stringify!($type_name), self.as_str())
            }
        }

        impl fmt::Display for $type_name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.as_str())
            }
        }

        impl FromStr for $type_name {
            type Err = IdParseError;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Self::from_hex(s)
            }
        }

        impl AsRef<[u8]> for $type_name {
            fn as_ref(&self) -> &[u8] {
                self.0.as_ref()
            }
        }
    };
}

define_id_type!(
    TargetId,
    "TARGET:",
    "Deterministic identifier for an authorized Target root."
);
define_id_type!(
    EndpointId,
    "ENDPOINT:",
    "Deterministic identifier for a Target Endpoint (method + path)."
);
define_id_type!(
    ParameterId,
    "PARAM:",
    "Deterministic identifier for an Endpoint Parameter."
);
define_id_type!(
    RequestId,
    "REQ:",
    "Deterministic identifier for a specific Request dispatch."
);
define_id_type!(
    SnapshotId,
    "SNAP:",
    "Deterministic identifier for an immutable Response Snapshot."
);
define_id_type!(
    EvidenceId,
    "EVID:",
    "Deterministic identifier for an Evidence record."
);
define_id_type!(
    SessionId,
    "SESSION:",
    "Deterministic identifier for an authenticated Session state."
);

impl TargetId {
    /// Derives TargetId deterministically: BLAKE3("TARGET:" || canonical_url).
    pub fn derive(canonical_url: &str) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"TARGET:");
        hasher.update(canonical_url.as_bytes());
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl EndpointId {
    /// Derives EndpointId deterministically: BLAKE3("ENDPOINT:" || target_id || method || normalized_path).
    pub fn derive(target_id: &TargetId, method: &str, normalized_path: &str) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"ENDPOINT:");
        hasher.update(target_id.as_bytes());
        hasher.update(b"|");
        hasher.update(method.as_bytes());
        hasher.update(b"|");
        hasher.update(normalized_path.as_bytes());
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl ParameterId {
    /// Derives ParameterId deterministically: BLAKE3("PARAM:" || endpoint_id || location || name).
    pub fn derive(endpoint_id: &EndpointId, location: &str, name: &str) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"PARAM:");
        hasher.update(endpoint_id.as_bytes());
        hasher.update(b"|");
        hasher.update(location.as_bytes());
        hasher.update(b"|");
        hasher.update(name.as_bytes());
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl RequestId {
    /// Derives RequestId deterministically: BLAKE3("REQ:" || endpoint_id || method || canonical_url || body_hash).
    pub fn derive(
        endpoint_id: &EndpointId,
        method: &str,
        canonical_url: &str,
        body: &[u8],
    ) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"REQ:");
        hasher.update(endpoint_id.as_bytes());
        hasher.update(b"|");
        hasher.update(method.as_bytes());
        hasher.update(b"|");
        hasher.update(canonical_url.as_bytes());
        hasher.update(b"|");
        hasher.update(blake3::hash(body).as_bytes());
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl SnapshotId {
    /// Derives SnapshotId deterministically: BLAKE3("SNAP:" || request_id || status_code || wire_bytes_hash).
    pub fn derive(request_id: &RequestId, status_code: u16, raw_wire_bytes: &[u8]) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"SNAP:");
        hasher.update(request_id.as_bytes());
        hasher.update(b"|");
        hasher.update(&status_code.to_le_bytes());
        hasher.update(b"|");
        hasher.update(blake3::hash(raw_wire_bytes).as_bytes());
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl EvidenceId {
    /// Derives EvidenceId deterministically: BLAKE3("EVID:" || target_id || finding_type || snapshots).
    pub fn derive(target_id: &TargetId, finding_type: &str, snapshots: &[SnapshotId]) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"EVID:");
        hasher.update(target_id.as_bytes());
        hasher.update(b"|");
        hasher.update(finding_type.as_bytes());
        for snap in snapshots {
            hasher.update(b"|");
            hasher.update(snap.as_bytes());
        }
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

impl SessionId {
    /// Derives SessionId deterministically: BLAKE3("SESSION:" || target_id || session_entropy).
    pub fn derive(target_id: &TargetId, session_entropy: &[u8]) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"SESSION:");
        hasher.update(target_id.as_bytes());
        hasher.update(b"|");
        hasher.update(session_entropy);
        Self(ContentId::from_bytes(*hasher.finalize().as_bytes()))
    }
}

/// Error type when parsing a hex string into an ID.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IdParseError {
    #[error("invalid ID length: expected 64 hex chars, got {0}")]
    InvalidLength(usize),
    #[error("invalid hex character in ID string")]
    InvalidHexCharacter,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_content_id_deterministic() {
        let id1 = ContentId::from_data(b"hello world");
        let id2 = ContentId::from_data(b"hello world");
        assert_eq!(id1, id2);
        assert_eq!(id1.as_str(), id2.as_str());
        assert_eq!(id1.as_str().len(), 64);
    }

    #[test]
    fn test_id_hex_roundtrip() {
        let id = TargetId::derive("https://example.com/api");
        let hex = id.as_str();
        let parsed = TargetId::from_hex(hex).expect("valid hex");
        assert_eq!(id, parsed);
    }

    #[test]
    fn test_target_and_endpoint_id_derivation() {
        let target_id = TargetId::derive("https://target.local:8080");
        let endpoint_id = EndpointId::derive(&target_id, "GET", "/users/profile");
        let param_id = ParameterId::derive(&endpoint_id, "query", "user_id");
        let req_id = RequestId::derive(
            &endpoint_id,
            "GET",
            "https://target.local:8080/users/profile?user_id=1",
            b"",
        );
        let snap_id = SnapshotId::derive(&req_id, 200, b"{\"user\":\"alice\"}");
        let evid_id = EvidenceId::derive(&target_id, "SQLEvidence", &[snap_id]);

        assert_ne!(target_id.as_bytes(), endpoint_id.as_bytes());
        assert_ne!(endpoint_id.as_bytes(), param_id.as_bytes());
        assert_ne!(req_id.as_bytes(), snap_id.as_bytes());
        assert_ne!(snap_id.as_bytes(), evid_id.as_bytes());
    }

    #[test]
    fn test_invalid_hex() {
        assert!(ContentId::from_hex("too_short").is_err());
        assert!(ContentId::from_hex(&"g".repeat(64)).is_err());
    }
}
