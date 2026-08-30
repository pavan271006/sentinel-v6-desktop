//! Extended Proxy Engine Configuration Options

use sentinel_common::config::ProxyConfig;

/// Internal engine tuning parameters.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub base: ProxyConfig,
    pub max_connections: usize,
    pub request_timeout_secs: u64,
    pub ca_cert_path: String,
    pub ca_key_path: String,
    pub buffer_size: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        let base = ProxyConfig::default();
        let cert_path = base.tls_cert_path.clone();
        let key_path = cert_path.replace(".crt", ".key");

        Self {
            base,
            max_connections: 10_000,
            request_timeout_secs: 30,
            ca_cert_path: cert_path,
            ca_key_path: key_path,
            buffer_size: 65536,
        }
    }
}

impl From<ProxyConfig> for EngineConfig {
    fn from(base: ProxyConfig) -> Self {
        let cert_path = base.tls_cert_path.clone();
        let key_path = if cert_path.ends_with(".crt") {
            cert_path.replace(".crt", ".key")
        } else {
            format!("{}.key", cert_path)
        };

        Self {
            base,
            max_connections: 10_000,
            request_timeout_secs: 30,
            ca_cert_path: cert_path,
            ca_key_path: key_path,
            buffer_size: 65536,
        }
    }
}
