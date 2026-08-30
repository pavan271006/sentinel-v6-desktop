//! Default Identity & Authentication Manager

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::domain::secret::Credential;
use sentinel_common::domain::supporting::Identity;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::ParsedRequest;
use sentinel_common::traits::IdentityManager;
use sentinel_storage::SqliteObservationStore;

use crate::vault::SecureVault;

use sentinel_dispatch::HttpDispatcher;

#[derive(Clone)]
pub struct DefaultIdentityManager {
    identities: Arc<RwLock<HashMap<Uuid, Identity>>>,
    credentials: Arc<RwLock<HashMap<Uuid, Credential>>>,
    vault: Arc<SecureVault>,
    storage: Option<Arc<SqliteObservationStore>>,
    dispatcher: Option<Arc<HttpDispatcher>>,
}

impl DefaultIdentityManager {
    pub fn new(vault: Arc<SecureVault>) -> Self {
        Self {
            identities: Arc::new(RwLock::new(HashMap::new())),
            credentials: Arc::new(RwLock::new(HashMap::new())),
            vault,
            storage: None,
            dispatcher: None,
        }
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<HttpDispatcher>) -> Self {
        self.dispatcher = Some(dispatcher);
        self
    }

    pub fn vault(&self) -> Arc<SecureVault> {
        self.vault.clone()
    }

    /// Performs live OAuth2 / token endpoint refresh over the network.
    pub async fn refresh_credential_live(
        &self,
        credential_id: Uuid,
        token_endpoint: &str,
        refresh_token: &str,
        client_id: &str,
    ) -> Result<String, SentinelError> {
        let dispatcher = self.dispatcher.as_ref().ok_or_else(|| {
            SentinelError::InvalidConfiguration("HttpDispatcher not configured on IdentityManager".to_string())
        })?;

        let body = format!(
            "grant_type=refresh_token&refresh_token={}&client_id={}",
            refresh_token,
            client_id
        );

        let req_bytes = format!(
            "POST {} HTTP/1.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            token_endpoint,
            body.len(),
            body
        ).into_bytes();

        let res = dispatcher.dispatch(token_endpoint, &req_bytes, 1).await?;
        if let Some(parsed) = res.parsed_response {
            if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&parsed.body) {
                if let Some(new_tok) = val.get("access_token").and_then(|t| t.as_str()) {
                    let mut creds = self.credentials.write();
                    if let Some(cred) = creds.get_mut(&credential_id) {
                        self.vault.store(cred.secret_reference, new_tok);
                        let exp_secs = val.get("expires_in").and_then(|e| e.as_i64()).unwrap_or(3600);
                        cred.expires_at = Some(chrono::Utc::now() + chrono::Duration::seconds(exp_secs));
                        return Ok(new_tok.to_string());
                    }
                }
            }
        }

        Err(SentinelError::AuthError("Failed to parse new access_token from refresh endpoint".to_string()))
    }
}

#[async_trait]
impl IdentityManager for DefaultIdentityManager {
    async fn add_identity(&self, identity: Identity) -> Result<Uuid, SentinelError> {
        let id = identity.id;

        if let Some(storage) = &self.storage {
            storage.insert_identity(&identity).await?;
        }

        self.identities.write().insert(id, identity);
        Ok(id)
    }

    async fn add_credential(&self, credential: Credential) -> Result<Uuid, SentinelError> {
        let id = credential.id;

        if let Some(storage) = &self.storage {
            storage.insert_credential(&credential).await?;
        }

        self.credentials.write().insert(id, credential);
        Ok(id)
    }

    async fn list_identities(&self) -> Result<Vec<Identity>, SentinelError> {
        Ok(self.identities.read().values().cloned().collect())
    }

    async fn inject_auth(
        &self,
        identity_id: Uuid,
        request: &mut ParsedRequest,
    ) -> Result<(), SentinelError> {
        let creds = self.credentials.read();
        let cred = creds
            .values()
            .find(|c| c.identity_id == identity_id)
            .ok_or_else(|| {
                SentinelError::AuthError(format!(
                    "No credentials registered for identity '{}'",
                    identity_id
                ))
            })?;

        let secret = self.vault.retrieve(cred.secret_reference).ok_or_else(|| {
            SentinelError::AuthError(format!(
                "Secret reference '{}' not found in vault",
                cred.secret_reference
            ))
        })?;

        let cred_type = cred.credential_type.to_ascii_lowercase();
        let secret_str = secret.as_str();

        if cred_type == "bearer" || cred_type == "jwt" || cred_type == "oauth" {
            let auth_val = format!("Bearer {}", secret_str);
            // Replace or add Authorization header
            request
                .headers
                .retain(|(k, _)| !k.eq_ignore_ascii_case(b"authorization"));
            request
                .headers
                .push((b"Authorization".to_vec(), auth_val.into_bytes()));
        } else if cred_type == "basic" {
            let user = self
                .identities
                .read()
                .get(&identity_id)
                .map(|i| i.username.clone())
                .unwrap_or_else(|| "user".to_string());
            let encoded = STANDARD.encode(format!("{}:{}", user, secret_str));
            let auth_val = format!("Basic {}", encoded);

            request
                .headers
                .retain(|(k, _)| !k.eq_ignore_ascii_case(b"authorization"));
            request
                .headers
                .push((b"Authorization".to_vec(), auth_val.into_bytes()));
        } else if cred_type.starts_with("header:") {
            let header_name = cred_type.trim_start_matches("header:").trim();
            let header_bytes = header_name.as_bytes().to_vec();
            request
                .headers
                .retain(|(k, _)| !k.eq_ignore_ascii_case(&header_bytes));
            request
                .headers
                .push((header_bytes, secret_str.as_bytes().to_vec()));
        } else if cred_type.starts_with("cookie:") {
            let cookie_name = cred_type.trim_start_matches("cookie:").trim();
            let cookie_str = format!("{}={}", cookie_name, secret_str);
            request
                .headers
                .push((b"Cookie".to_vec(), cookie_str.into_bytes()));
        } else {
            // Default to Bearer
            let auth_val = format!("Bearer {}", secret_str);
            request
                .headers
                .retain(|(k, _)| !k.eq_ignore_ascii_case(b"authorization"));
            request
                .headers
                .push((b"Authorization".to_vec(), auth_val.into_bytes()));
        }

        Ok(())
    }

    async fn refresh_credential(&self, credential_id: Uuid) -> Result<(), SentinelError> {
        let mut creds = self.credentials.write();
        let cred = creds.get_mut(&credential_id).ok_or_else(|| {
            SentinelError::AuthError(format!("Credential '{}' not found", credential_id))
        })?;

        // Update expiration timestamp
        cred.expires_at = Some(chrono::Utc::now() + chrono::Duration::hours(1));
        Ok(())
    }
}
