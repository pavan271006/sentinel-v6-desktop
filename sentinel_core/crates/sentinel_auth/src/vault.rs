//! Secure In-Memory Secret Vault (SEC-09)
//!
//! Enforces zero-plaintext secret leakage by storing actual credentials
//! in zeroized heap memory keyed only by random Uuid `SecretReference`.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use uuid::Uuid;
use zeroize::Zeroizing;

#[derive(Default, Clone)]
pub struct SecureVault {
    secrets: Arc<RwLock<HashMap<Uuid, Zeroizing<String>>>>,
}

impl SecureVault {
    pub fn new() -> Self {
        Self {
            secrets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn store(&self, id: Uuid, secret_value: impl Into<String>) {
        let zeroized = Zeroizing::new(secret_value.into());
        self.secrets.write().insert(id, zeroized);
    }

    pub fn retrieve(&self, id: Uuid) -> Option<Zeroizing<String>> {
        self.secrets.read().get(&id).cloned()
    }

    pub fn delete(&self, id: Uuid) {
        self.secrets.write().remove(&id);
    }

    pub fn clear(&self) {
        self.secrets.write().clear();
    }
}
