//! Performance benchmarking harness and statistical latency metrics.

use std::time::{Duration, Instant};
use ucma_core::ids::ContentId;
use ucma_http::client::{HttpError, SafeHttpClient};
use ucma_scope::policy::ScopePolicy;

/// Summary metrics captured from a benchmark execution run.
#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkMetrics {
    pub name: String,
    pub total_operations: usize,
    pub duration: Duration,
    pub ops_per_second: f64,
    pub mean_latency_us: f64,
    pub p50_latency_us: f64,
    pub p90_latency_us: f64,
    pub p99_latency_us: f64,
    pub min_latency_us: f64,
    pub max_latency_us: f64,
    pub error_count: usize,
}

impl BenchmarkMetrics {
    /// Computes summary metrics from an array of measured latency samples in microseconds.
    pub fn compute(
        name: impl Into<String>,
        mut latencies_us: Vec<f64>,
        total_duration: Duration,
        error_count: usize,
    ) -> Self {
        let total_operations = latencies_us.len();
        if total_operations == 0 {
            return Self {
                name: name.into(),
                total_operations: 0,
                duration: total_duration,
                ops_per_second: 0.0,
                mean_latency_us: 0.0,
                p50_latency_us: 0.0,
                p90_latency_us: 0.0,
                p99_latency_us: 0.0,
                min_latency_us: 0.0,
                max_latency_us: 0.0,
                error_count,
            };
        }

        latencies_us.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let sum: f64 = latencies_us.iter().sum();
        let mean_latency_us = sum / total_operations as f64;
        let min_latency_us = latencies_us[0];
        let max_latency_us = latencies_us[total_operations - 1];

        let p50_latency_us = latencies_us[(total_operations as f64 * 0.50) as usize];
        let p90_latency_us = latencies_us
            [(total_operations as f64 * 0.90).min(total_operations as f64 - 1.0) as usize];
        let p99_latency_us = latencies_us
            [(total_operations as f64 * 0.99).min(total_operations as f64 - 1.0) as usize];

        let secs = total_duration.as_secs_f64();
        let ops_per_second = if secs > 0.0 {
            total_operations as f64 / secs
        } else {
            0.0
        };

        Self {
            name: name.into(),
            total_operations,
            duration: total_duration,
            ops_per_second,
            mean_latency_us,
            p50_latency_us,
            p90_latency_us,
            p99_latency_us,
            min_latency_us,
            max_latency_us,
            error_count,
        }
    }

    /// Formats a human-readable performance report.
    pub fn report(&self) -> String {
        format!(
            "--- Benchmark: {} ---\n\
             Total Operations : {}\n\
             Duration         : {:.3}s\n\
             Throughput       : {:.1} ops/sec\n\
             Mean Latency     : {:.2} µs\n\
             P50 Latency      : {:.2} µs\n\
             P90 Latency      : {:.2} µs\n\
             P99 Latency      : {:.2} µs\n\
             Min / Max        : {:.2} µs / {:.2} µs\n\
             Errors           : {}\n",
            self.name,
            self.total_operations,
            self.duration.as_secs_f64(),
            self.ops_per_second,
            self.mean_latency_us,
            self.p50_latency_us,
            self.p90_latency_us,
            self.p99_latency_us,
            self.min_latency_us,
            self.max_latency_us,
            self.error_count
        )
    }
}

/// Benchmark harness execution runner.
pub struct BenchmarkHarness;

impl BenchmarkHarness {
    /// Benchmarks scope policy evaluation throughput across a sequence of URLs.
    pub async fn benchmark_scope_throughput(
        policy: &ScopePolicy,
        urls: &[&str],
        iterations: usize,
    ) -> BenchmarkMetrics {
        let mut latencies = Vec::with_capacity(iterations);
        let mut errors = 0;
        let start = Instant::now();

        for i in 0..iterations {
            let url = urls[i % urls.len()];
            let op_start = Instant::now();
            match policy.authorize_url(url).await {
                Ok(_) => {
                    latencies.push(op_start.elapsed().as_micros() as f64);
                }
                Err(_) => {
                    errors += 1;
                    latencies.push(op_start.elapsed().as_micros() as f64);
                }
            }
        }

        let total_duration = start.elapsed();
        BenchmarkMetrics::compute(
            "Scope Authorization Throughput",
            latencies,
            total_duration,
            errors,
        )
    }

    /// Benchmarks end-to-end safe HTTP client round-trip latency and snapshot generation overhead.
    pub async fn benchmark_http_roundtrip(
        client: &SafeHttpClient,
        policy: &ScopePolicy,
        url: &str,
        iterations: usize,
    ) -> Result<BenchmarkMetrics, HttpError> {
        let mut latencies = Vec::with_capacity(iterations);
        let mut errors = 0;
        let start = Instant::now();

        for _ in 0..iterations {
            let auth_req = policy.authorize_url(url).await?;
            let op_start = Instant::now();
            match client.send(auth_req).await {
                Ok(_snap) => {
                    latencies.push(op_start.elapsed().as_micros() as f64);
                }
                Err(_) => {
                    errors += 1;
                }
            }
        }

        let total_duration = start.elapsed();
        Ok(BenchmarkMetrics::compute(
            "HTTP Roundtrip & Snapshot",
            latencies,
            total_duration,
            errors,
        ))
    }

    /// Benchmarks BLAKE3 content-hashing throughput over memory buffers.
    pub fn benchmark_blake3_hashing(
        payload_size_bytes: usize,
        iterations: usize,
    ) -> BenchmarkMetrics {
        let buffer = vec![0x42u8; payload_size_bytes];
        let mut latencies = Vec::with_capacity(iterations);
        let start = Instant::now();

        for _ in 0..iterations {
            let op_start = Instant::now();
            let _id = ContentId::from_data(&buffer);
            latencies.push(op_start.elapsed().as_micros() as f64);
        }

        let total_duration = start.elapsed();
        BenchmarkMetrics::compute(
            format!("BLAKE3 Hashing ({} KB)", payload_size_bytes / 1024),
            latencies,
            total_duration,
            0,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use ucma_http::limits::HttpLimits;
    use ucma_scope::dns::SafeDnsResolver;

    #[tokio::test]
    async fn test_scope_benchmark_run() {
        let mut mock_dns = HashMap::new();
        mock_dns.insert(
            "api.example.com".to_string(),
            vec!["93.184.216.34".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = ScopePolicy::builder()
            .allow_host("api.example.com")
            .with_resolver(resolver)
            .build();

        let urls = [
            "https://api.example.com/v1/users",
            "https://api.example.com/v1/items",
        ];
        let metrics = BenchmarkHarness::benchmark_scope_throughput(&policy, &urls, 20).await;

        assert_eq!(metrics.total_operations, 20);
        assert_eq!(metrics.error_count, 0);
        assert!(metrics.ops_per_second > 0.0);
    }

    #[tokio::test]
    async fn test_http_roundtrip_benchmark() {
        use crate::fixtures::MockHttpServer;

        let server = MockHttpServer::spawn().await.unwrap();
        let port = server.port();

        let mut mock_dns = HashMap::new();
        mock_dns.insert("127.0.0.1".to_string(), vec!["127.0.0.1".parse().unwrap()]);

        // For local lab testing, allow private IPs
        let resolver = SafeDnsResolver::new_mock(mock_dns, true);
        let policy = Arc::new(
            ScopePolicy::builder()
                .allow_host("127.0.0.1")
                .allow_port(port)
                .allow_private_ips(true)
                .with_resolver(resolver)
                .build(),
        );

        let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();
        let url = server.url("/api/ok");

        let metrics = BenchmarkHarness::benchmark_http_roundtrip(&client, &policy, &url, 5)
            .await
            .unwrap();

        assert_eq!(metrics.total_operations, 5);
        assert_eq!(metrics.error_count, 0);

        server.shutdown();
    }

    #[test]
    fn test_blake3_hashing_benchmark() {
        let metrics = BenchmarkHarness::benchmark_blake3_hashing(64 * 1024, 100);
        assert_eq!(metrics.total_operations, 100);
        assert!(metrics.ops_per_second > 1000.0);
    }
}
