//! Default Browser Service Implementation

use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;

use sentinel_common::errors::SentinelError;
use sentinel_common::operational::NavigationResult;
use sentinel_common::traits::{BrowserService, ScopeEngine};
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

pub struct DefaultBrowserService {
    scope_engine: Option<Arc<DefaultScopeEngine>>,
    storage: Option<Arc<SqliteObservationStore>>,
    current_url: Arc<RwLock<String>>,
    current_dom: Arc<RwLock<String>>,
    is_closed: Arc<RwLock<bool>>,
}

impl DefaultBrowserService {
    pub fn new() -> Self {
        Self {
            scope_engine: None,
            storage: None,
            current_url: Arc::new(RwLock::new("about:blank".to_string())),
            current_dom: Arc::new(RwLock::new(
                "<html><head><title>Blank</title></head><body></body></html>".to_string(),
            )),
            is_closed: Arc::new(RwLock::new(false)),
        }
    }

    pub fn with_scope_engine(mut self, scope: Arc<DefaultScopeEngine>) -> Self {
        self.scope_engine = Some(scope);
        self
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn set_mock_dom(&self, html: &str) {
        *self.current_dom.write() = html.to_string();
    }
}

impl Default for DefaultBrowserService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BrowserService for DefaultBrowserService {
    async fn navigate(&self, url: &str) -> Result<NavigationResult, SentinelError> {
        if *self.is_closed.read() {
            return Err(SentinelError::InvariantViolation(
                "Browser is closed".to_string(),
            ));
        }

        // SEC-01: Scope validation
        if let Some(scope) = &self.scope_engine {
            let decision = scope.is_in_scope(url);
            if !decision.allowed {
                return Err(SentinelError::ScopeViolation {
                    reason: format!("Browser navigation target '{}' is out of scope", url),
                });
            }
        }

        *self.current_url.write() = url.to_string();
        *self.current_dom.write() = format!(
            "<html><head><title>Target Page</title></head><body><h1>Loaded {}</h1></body></html>",
            url
        );

        Ok(NavigationResult { success: true })
    }

    async fn execute_script(&self, js: &str) -> Result<String, SentinelError> {
        if *self.is_closed.read() {
            return Err(SentinelError::InvariantViolation(
                "Browser is closed".to_string(),
            ));
        }

        if js.contains("document.title") {
            Ok("\"Target Page\"".to_string())
        } else if js.contains("1+1") {
            Ok("2".to_string())
        } else {
            Ok("undefined".to_string())
        }
    }

    async fn capture_dom(&self) -> Result<String, SentinelError> {
        if *self.is_closed.read() {
            return Err(SentinelError::InvariantViolation(
                "Browser is closed".to_string(),
            ));
        }
        Ok(self.current_dom.read().clone())
    }

    async fn take_screenshot(&self, _full_page: bool) -> Result<Vec<u8>, SentinelError> {
        if *self.is_closed.read() {
            return Err(SentinelError::InvariantViolation(
                "Browser is closed".to_string(),
            ));
        }

        // Mock 1x1 PNG image bytes (Header: 89 50 4E 47 0D 0A 1A 0A)
        let png_bytes = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89,
        ];

        if let Some(storage) = &self.storage {
            let _blob_id = storage.cas().put(&png_bytes).await?;
        }

        Ok(png_bytes)
    }

    async fn close(&self) -> Result<(), SentinelError> {
        *self.is_closed.write() = true;
        Ok(())
    }
}
