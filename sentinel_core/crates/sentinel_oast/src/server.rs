//! Default OAST Server Implementation

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::domain::OastInteraction;
use sentinel_common::errors::SentinelError;
use sentinel_common::traits::OastServer;
use sentinel_storage::SqliteObservationStore;

use crate::token::{OastTokenGenerator, OastTokenManager, OastTokenPayload};

pub struct DefaultOastServer {
    is_running: Arc<RwLock<bool>>,
    token_map: Arc<RwLock<HashMap<String, Uuid>>>,
    interactions: Arc<RwLock<HashMap<Uuid, Vec<OastInteraction>>>>,
    token_manager: Arc<OastTokenManager>,
    storage: Option<Arc<SqliteObservationStore>>,
}

impl DefaultOastServer {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(RwLock::new(false)),
            token_map: Arc::new(RwLock::new(HashMap::new())),
            interactions: Arc::new(RwLock::new(HashMap::new())),
            token_manager: Arc::new(OastTokenManager::from_seed("sentinel_oast_server_master_key")),
            storage: None,
        }
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn token_manager(&self) -> Arc<OastTokenManager> {
        self.token_manager.clone()
    }

    pub async fn record_interaction(
        &self,
        token: &str,
        protocol: &str,
        source_ip: &str,
        raw_data: &[u8],
    ) -> Result<Uuid, SentinelError> {
        let token_id = {
            let tokens = self.token_map.read();
            if let Some(&id) = tokens.get(token) {
                id
            } else if let Ok(payload) = self.token_manager.decrypt_token(token) {
                payload.project_id
            } else {
                return Err(SentinelError::parse_error(format!("Unrecognized OAST token '{}'", token)));
            }
        };

        let raw_blob_id = if let Some(storage) = &self.storage {
            storage.cas().put(raw_data).await?.blob_id
        } else {
            Uuid::new_v4()
        };

        let interaction = OastInteraction {
            id: Uuid::new_v4(),
            token_id,
            protocol: protocol.to_string(),
            source_ip: source_ip.to_string(),
            raw_blob_id,
            timestamp: chrono::Utc::now(),
        };

        let interaction_id = interaction.id;
        self.interactions
            .write()
            .entry(token_id)
            .or_default()
            .push(interaction);

        Ok(interaction_id)
    }
}

impl Default for DefaultOastServer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl OastServer for DefaultOastServer {
    async fn start(&self) -> Result<(), SentinelError> {
        *self.is_running.write() = true;
        Ok(())
    }

    async fn stop(&self) -> Result<(), SentinelError> {
        *self.is_running.write() = false;
        Ok(())
    }

    async fn generate_token(&self) -> Result<String, SentinelError> {
        let token_id = Uuid::new_v4();
        let nonce_uuid = Uuid::new_v4();
        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&nonce_uuid.as_bytes()[..12]);

        let payload = OastTokenPayload {
            project_id: token_id,
            scan_id: None,
            endpoint_id: None,
            param_name: None,
            created_at: chrono::Utc::now().timestamp(),
            nonce,
        };
        let token_str = self.token_manager.generate_token(&payload).unwrap_or_else(|_| {
            let (t, _) = OastTokenGenerator::generate();
            t
        });
        self.token_map.write().insert(token_str.clone(), token_id);
        Ok(token_str)
    }

    async fn poll_interactions(&self, token: &str) -> Result<Vec<OastInteraction>, SentinelError> {
        let token_id = {
            let tokens = self.token_map.read();
            if let Some(&id) = tokens.get(token) {
                id
            } else if let Ok(payload) = self.token_manager.decrypt_token(token) {
                payload.project_id
            } else {
                return Ok(Vec::new());
            }
        };

        let inters = self.interactions.read();
        Ok(inters.get(&token_id).cloned().unwrap_or_default())
    }
}
