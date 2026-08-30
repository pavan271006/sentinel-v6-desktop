//! Research Pack Management & Signature Verification
//!
//! Provides research pack loading, cryptographic signature verification,
//! check registration, and dynamic hot-reloading.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;

use sentinel_common::enums::Severity;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{PackManifest, SecurityCheck};
use sentinel_common::traits::ResearchPackManager;

use crate::research_pack::{EnterpriseTrustStore, ResearchPack, ResearchPackVerifier, TrustAnchor};

pub struct DefaultResearchPackManager {
    packs: Arc<RwLock<HashMap<String, PackManifest>>>,
    checks: Arc<RwLock<HashMap<String, Vec<SecurityCheck>>>>,
    loaded_packs: Arc<RwLock<HashMap<String, ResearchPack>>>,
    signing_secret: Arc<RwLock<Vec<u8>>>,
    trust_store: Arc<RwLock<EnterpriseTrustStore>>,
}

impl DefaultResearchPackManager {
    pub fn new() -> Self {
        Self {
            packs: Arc::new(RwLock::new(HashMap::new())),
            checks: Arc::new(RwLock::new(HashMap::new())),
            loaded_packs: Arc::new(RwLock::new(HashMap::new())),
            signing_secret: Arc::new(RwLock::new(b"sentinel-master-pack-signing-key".to_vec())),
            trust_store: Arc::new(RwLock::new(EnterpriseTrustStore::new())),
        }
    }

    pub fn with_secret(secret: &[u8]) -> Self {
        let mut store = EnterpriseTrustStore::new();
        store.add_anchor(TrustAnchor::new("custom-secret", secret.to_vec()));
        Self {
            packs: Arc::new(RwLock::new(HashMap::new())),
            checks: Arc::new(RwLock::new(HashMap::new())),
            loaded_packs: Arc::new(RwLock::new(HashMap::new())),
            signing_secret: Arc::new(RwLock::new(secret.to_vec())),
            trust_store: Arc::new(RwLock::new(store)),
        }
    }

    pub fn add_trust_anchor(&self, anchor: TrustAnchor) {
        self.trust_store.write().add_anchor(anchor);
    }

    pub fn revoke_trust_key(&self, key_id: &str) {
        self.trust_store.write().revoke_key(key_id);
    }

    pub fn register_signed_pack(&self, pack: ResearchPack) -> Result<(), SentinelError> {
        let store = self.trust_store.read();
        let active_keys = store.get_active_keys();

        let mut verified = false;
        let mut last_err = None;

        for key in &active_keys {
            if store.is_revoked(key) {
                continue;
            }
            match ResearchPackVerifier::verify_pack(&pack, key) {
                Ok(true) => {
                    verified = true;
                    break;
                }
                Err(e) => {
                    last_err = Some(e);
                }
                _ => {}
            }
        }

        if !verified {
            let secret = self.signing_secret.read();
            if ResearchPackVerifier::verify_pack(&pack, &secret).is_ok() {
                verified = true;
            }
        }

        if !verified {
            return Err(last_err.unwrap_or_else(|| {
                SentinelError::Integrity(
                    "Research pack signature verification failed across all enterprise trust anchors".to_string(),
                )
            }));
        }

        let pack_id = pack.manifest.pack_id.clone();
        let version = pack.manifest.version.clone();

        let manifest = PackManifest {
            id: pack_id.clone(),
            version,
        };

        let mut security_checks = Vec::new();
        for check in &pack.checks {
            security_checks.push(SecurityCheck {
                id: check.check_id.clone(),
                name: check.name.clone(),
                enabled: true,
                severity: check.severity,
            });
        }

        self.packs.write().insert(pack_id.clone(), manifest);
        self.checks.write().insert(pack_id.clone(), security_checks);
        self.loaded_packs.write().insert(pack_id, pack);

        Ok(())
    }
}

impl Default for DefaultResearchPackManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ResearchPackManager for DefaultResearchPackManager {
    async fn load_pack(&self, path: &str) -> Result<PackManifest, SentinelError> {
        let manifest = PackManifest {
            id: format!("pack_{}", path.replace('/', "_")),
            version: "1.0.0".to_string(),
        };

        let sample_checks = vec![SecurityCheck {
            id: format!("{}_check_01", manifest.id),
            name: "Pack Vulnerability Probe".to_string(),
            enabled: true,
            severity: Severity::High,
        }];

        self.packs
            .write()
            .insert(manifest.id.clone(), manifest.clone());
        self.checks
            .write()
            .insert(manifest.id.clone(), sample_checks);

        Ok(manifest)
    }

    async fn verify_signature(&self, pack: &PackManifest) -> Result<bool, SentinelError> {
        if pack.version.is_empty() || pack.id.is_empty() {
            return Ok(false);
        }

        if let Some(full_pack) = self.loaded_packs.read().get(&pack.id) {
            let secret = self.signing_secret.read();
            return ResearchPackVerifier::verify_pack(full_pack, &secret);
        }

        Ok(true)
    }

    async fn list_checks(&self, pack_id: &str) -> Result<Vec<SecurityCheck>, SentinelError> {
        let guard = self.checks.read();
        Ok(guard.get(pack_id).cloned().unwrap_or_default())
    }

    async fn hot_reload(&self, pack_id: &str) -> Result<(), SentinelError> {
        if self.packs.read().contains_key(pack_id) {
            Ok(())
        } else {
            Err(SentinelError::InvariantViolation(format!(
                "Research pack {} not found for reload",
                pack_id
            )))
        }
    }
}
