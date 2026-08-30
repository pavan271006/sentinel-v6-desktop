//! Sentinel Proxy Engine Subsystem (SUB-01 / WP-2.2)
//!
//! High-performance asynchronous HTTP/1.1, HTTP/2, and WebSocket MITM proxy
//! engine with dynamic TLS certificate forging, SEC-01 fail-closed scope checking,
//! interceptor pipeline, and dual-write CAS + SQLite persistence.

pub mod config;
pub mod engine;
pub mod error;
pub mod handler;
pub mod pipeline;
pub mod recorder;
pub mod server;
pub mod tls;
pub mod websocket;

pub use config::EngineConfig;
pub use engine::SentinelProxyEngine;
pub use error::ProxyError;
pub use handler::{handle_connection, HandlerState};
pub use pipeline::{
    AsyncProxyInterceptor, CompiledAction, CompiledInterceptRule, ConditionMatcher,
    InterceptAction, InterceptorPipeline, RequestContext, RuleEngineInterceptor, WsFrame,
};
pub use recorder::{PendingTransactionRecord, PersistenceRecorder};
pub use server::ProxyServer;
pub use tls::{build_upstream_client_config, CertGenerator, RootCA, TlsServerConfigCache};
pub use websocket::{read_ws_frame, tap_websocket, write_ws_frame};
