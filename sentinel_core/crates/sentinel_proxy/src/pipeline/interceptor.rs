//! Async Proxy Interceptor Trait and Pipeline Types

use async_trait::async_trait;
use std::net::SocketAddr;
use std::time::Instant;
use uuid::Uuid;

use sentinel_common::domain::meta::TlsData;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};
use sentinel_common::traits::ProxyInterceptor;

/// Contextual metadata passed through the interceptor chain.
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub client_addr: SocketAddr,
    pub is_tls: bool,
    pub target_uri: String,
    pub scope_id: Option<Uuid>,
    pub tls_data: Option<TlsData>,
    pub start_time: Instant,
}

impl RequestContext {
    pub fn new(client_addr: SocketAddr, is_tls: bool, target_uri: String) -> Self {
        Self {
            client_addr,
            is_tls,
            target_uri,
            scope_id: None,
            tls_data: None,
            start_time: Instant::now(),
        }
    }
}

/// WebSocket Frame representation for inspection and mutation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WsFrame {
    pub opcode: u8,
    pub payload: Vec<u8>,
    pub is_final: bool,
    pub from_client: bool,
}

/// Action returned by interceptors controlling the traffic flow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InterceptAction {
    /// Proceed to next interceptor / forward traffic normally
    Continue,
    /// Request/response was modified in-place; continue forward
    Modified,
    /// Drop connection immediately without contacting upstream
    Drop { reason: String },
    /// Return synthetic response directly to client without contacting upstream
    RespondWith(ParsedResponse),
}

/// Rich asynchronous proxy interceptor interface.
#[async_trait]
pub trait AsyncProxyInterceptor: Send + Sync {
    /// Called when an HTTP request is received from the client before forwarding.
    async fn on_request(
        &self,
        _req: &mut ParsedRequest,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }

    /// Called when an HTTP response is received from the upstream before sending to client.
    async fn on_response(
        &self,
        _req: &ParsedRequest,
        _res: &mut ParsedResponse,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }

    /// Called when a WebSocket frame is received in either direction.
    async fn on_ws_frame(
        &self,
        _frame: &mut WsFrame,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }
}

/// Default marker trait implementation
impl ProxyInterceptor for Box<dyn AsyncProxyInterceptor> {}
