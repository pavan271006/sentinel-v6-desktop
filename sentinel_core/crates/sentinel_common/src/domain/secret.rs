// SENTINEL V6: Secret Reference and Credential Domain Entities (SEC-09)
// crates/sentinel_common/src/domain/secret.rs
//
// Strictly enforces Secret Redaction & Isolation Invariant SEC-09:
// Credential -> SecretReference -> Secure Vault / OS Keychain.
// Plaintext secrets NEVER exist in Credential or SecretReference.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

use crate::enums::AccessLevel;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SecretReference {
    pub reference_id: Uuid,
    pub vault_backend: String,
}

impl SecretReference {
    pub fn new(vault_backend: impl Into<String>) -> Self {
        Self {
            reference_id: Uuid::new_v4(),
            vault_backend: vault_backend.into(),
        }
    }

    pub fn with_id(reference_id: Uuid, vault_backend: impl Into<String>) -> Self {
        Self {
            reference_id,
            vault_backend: vault_backend.into(),
        }
    }
}

impl fmt::Display for SecretReference {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "SecretReference(id={}, backend={})",
            self.reference_id, self.vault_backend
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credential {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub credential_type: String,
    pub secret_reference: Uuid,
    pub access_level: AccessLevel,
    pub expires_at: Option<DateTime<Utc>>,
}

impl Credential {
    pub fn new(
        identity_id: Uuid,
        credential_type: impl Into<String>,
        secret_reference: Uuid,
        access_level: AccessLevel,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            identity_id,
            credential_type: credential_type.into(),
            secret_reference,
            access_level,
            expires_at: None,
        }
    }

    pub fn with_expiration(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }
}

impl fmt::Display for Credential {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Credential(id={}, identity={}, type={}, ref={})",
            self.id, self.identity_id, self.credential_type, self.secret_reference
        )
    }
}
