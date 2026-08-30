//! Resource limits and timeout configurations for the HTTP client.

use std::time::Duration;

/// Resource bounding and timeout configuration for `SafeHttpClient`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpLimits {
    /// Maximum allowed response body size in bytes (default: 5MB = 5,242,880 bytes).
    pub max_body_bytes: usize,
    /// TCP connection timeout.
    pub connect_timeout: Duration,
    /// Socket read timeout.
    pub read_timeout: Duration,
    /// Maximum end-to-end duration for entire request-response cycle.
    pub overall_timeout: Duration,
    /// Maximum allowed redirect hops before aborting.
    pub max_redirects: usize,
    /// Maximum concurrent connections per host.
    pub max_connections_per_host: usize,
}

impl Default for HttpLimits {
    fn default() -> Self {
        Self {
            max_body_bytes: 5 * 1024 * 1024, // 5MB
            connect_timeout: Duration::from_secs(3),
            read_timeout: Duration::from_secs(10),
            overall_timeout: Duration::from_secs(15),
            max_redirects: 5,
            max_connections_per_host: 8,
        }
    }
}

impl HttpLimits {
    pub fn builder() -> HttpLimitsBuilder {
        HttpLimitsBuilder::new()
    }
}

/// Fluent builder for `HttpLimits`.
#[derive(Debug, Clone)]
pub struct HttpLimitsBuilder {
    limits: HttpLimits,
}

impl Default for HttpLimitsBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpLimitsBuilder {
    pub fn new() -> Self {
        Self {
            limits: HttpLimits::default(),
        }
    }

    pub fn max_body_bytes(mut self, bytes: usize) -> Self {
        self.limits.max_body_bytes = bytes;
        self
    }

    pub fn connect_timeout(mut self, timeout: Duration) -> Self {
        self.limits.connect_timeout = timeout;
        self
    }

    pub fn read_timeout(mut self, timeout: Duration) -> Self {
        self.limits.read_timeout = timeout;
        self
    }

    pub fn overall_timeout(mut self, timeout: Duration) -> Self {
        self.limits.overall_timeout = timeout;
        self
    }

    pub fn max_redirects(mut self, max: usize) -> Self {
        self.limits.max_redirects = max;
        self
    }

    pub fn max_connections_per_host(mut self, max: usize) -> Self {
        self.limits.max_connections_per_host = max;
        self
    }

    pub fn build(self) -> HttpLimits {
        self.limits
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_limits() {
        let limits = HttpLimits::default();
        assert_eq!(limits.max_body_bytes, 5 * 1024 * 1024);
        assert_eq!(limits.max_redirects, 5);
        assert_eq!(limits.connect_timeout, Duration::from_secs(3));
    }
}
