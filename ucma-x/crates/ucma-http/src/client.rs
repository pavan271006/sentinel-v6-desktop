//! Safe HTTP Client strictly bound to AuthorizedRequest capability tokens.

use crate::limits::HttpLimits;
use crate::redirect::{RedirectDecision, RedirectValidator};
use crate::response::RawWireResponse;
use crate::snapshot::SnapshotBuilder;
use bytes::Bytes;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use ucma_core::snapshot::ResponseSnapshot;
use ucma_scope::ScopeError;
use ucma_scope::policy::{AuthorizedRequest, ScopePolicy};

/// Client-level HTTP errors.
#[derive(Debug, thiserror::Error)]
pub enum HttpError {
    #[error("scope validation failed: {0}")]
    Scope(#[from] ScopeError),
    #[error("network I/O error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("timed out after {0}")]
    Timeout(String),
    #[error("protocol error: {0}")]
    Protocol(String),
}

/// Scope-gated HTTP client requiring `AuthorizedRequest` capability tokens.
#[derive(Clone)]
pub struct SafeHttpClient {
    inner: Client,
    limits: HttpLimits,
    scope_policy: Arc<ScopePolicy>,
}

impl SafeHttpClient {
    /// Constructs a new SafeHttpClient.
    pub fn new(limits: HttpLimits, scope_policy: Arc<ScopePolicy>) -> Result<Self, HttpError> {
        let inner = Client::builder()
            .timeout(limits.overall_timeout)
            .connect_timeout(limits.connect_timeout)
            .read_timeout(limits.read_timeout)
            .redirect(reqwest::redirect::Policy::none()) // Redirects handled explicitly by RedirectValidator!
            .build()?;

        Ok(Self {
            inner,
            limits,
            scope_policy,
        })
    }

    /// Dispatches an authorized HTTP request and returns an immutable ResponseSnapshot.
    ///
    /// Fails closed if the `AuthorizedRequest` token is invalid, expired, or tampered.
    pub async fn send(
        &self,
        mut current_auth: AuthorizedRequest,
    ) -> Result<ResponseSnapshot, HttpError> {
        let mut hop_count = 0;

        loop {
            // 1. Verify capability token signature & validity
            self.scope_policy.verify_token(&current_auth)?;

            let raw_req = current_auth.request();
            let start_time = Instant::now();

            let method = reqwest::Method::from_bytes(raw_req.method.as_str().as_bytes())
                .unwrap_or(reqwest::Method::GET);

            // 2. Build outbound request
            let mut req_builder = self
                .inner
                .request(method, current_auth.target_url().as_str());

            for (k, v) in &raw_req.headers {
                req_builder = req_builder.header(k, v);
            }

            if !raw_req.body.is_empty() {
                req_builder = req_builder.body(raw_req.body.clone());
            }

            // 3. Dispatch over network
            let resp = match req_builder.send().await {
                Ok(r) => r,
                Err(e) => {
                    if e.is_timeout() {
                        return Err(HttpError::Timeout(format!(
                            "{:?}",
                            self.limits.overall_timeout
                        )));
                    }
                    return Err(HttpError::Network(e));
                }
            };

            let status = resp.status().as_u16();
            let mut headers_map = HashMap::new();
            for (name, val) in resp.headers() {
                if let Ok(v_str) = val.to_str() {
                    headers_map.insert(name.as_str().to_string(), v_str.to_string());
                }
            }

            let remote_addr = resp.remote_addr().map(|sa| sa.ip().to_string());

            // 4. Stream response body with bounded truncation
            let mut body_bytes = Vec::new();
            let mut truncated = false;
            let mut stream = resp;

            while let Ok(Some(chunk)) = stream.chunk().await {
                let chunk: Bytes = chunk;
                if body_bytes.len() + chunk.len() > self.limits.max_body_bytes {
                    let remaining = self.limits.max_body_bytes.saturating_sub(body_bytes.len());
                    body_bytes.extend_from_slice(&chunk[..remaining]);
                    truncated = true;
                    break;
                } else {
                    body_bytes.extend_from_slice(&chunk);
                }
            }

            let elapsed_nanos = start_time.elapsed().as_nanos() as u64;

            // 5. Synthesize raw wire response representation
            let raw_wire_bytes =
                RawWireResponse::synthesize_wire_bytes(status, &headers_map, &body_bytes);

            // 6. Check for redirects
            match RedirectValidator::evaluate_hop(
                current_auth.target_url(),
                status,
                &headers_map,
                hop_count,
                self.scope_policy.max_redirects(),
                &self.scope_policy,
            )
            .await?
            {
                RedirectDecision::Follow(next_auth) => {
                    hop_count += 1;
                    current_auth = *next_auth;
                    continue;
                }
                RedirectDecision::Terminal => {
                    let raw_wire_response = RawWireResponse {
                        status_code: status,
                        headers: headers_map,
                        body: body_bytes,
                        raw_wire_bytes,
                        latency_nanos: elapsed_nanos,
                        truncated,
                        remote_ip: remote_addr,
                    };
                    let snapshot = SnapshotBuilder::from_raw_response(
                        current_auth.request().id,
                        raw_wire_response,
                    );
                    return Ok(snapshot);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_scope::dns::SafeDnsResolver;

    #[tokio::test]
    async fn test_unauthorized_token_rejected() {
        let resolver = SafeDnsResolver::new(false);
        let policy_a = Arc::new(
            ScopePolicy::builder()
                .allow_host("example.com")
                .with_resolver(resolver.clone())
                .with_salt([1u8; 32])
                .build(),
        );
        let policy_b = Arc::new(
            ScopePolicy::builder()
                .allow_host("example.com")
                .with_resolver(resolver)
                .with_salt([2u8; 32])
                .build(),
        );

        let client = SafeHttpClient::new(HttpLimits::default(), policy_a).unwrap();

        // Token authorized by policy B
        let token_b = policy_b
            .authorize_url("https://example.com/")
            .await
            .unwrap();

        // Client configured with policy A must reject token B
        let res = client.send(token_b).await;
        assert!(res.is_err());
        assert!(matches!(
            res.unwrap_err(),
            HttpError::Scope(ScopeError::InvalidCapabilityToken)
        ));
    }
}
