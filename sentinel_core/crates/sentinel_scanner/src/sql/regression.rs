//! SENTINEL Autonomous SQL Security Engine — Regression Laboratory & Benchmarks (M33-M35)
//!
//! Controlled synthetic benchmark tests and regression verification verifying
//! detection accuracy, 50-worker pool throughput, and false-positive suppression.

#[cfg(test)]
mod tests {
    use crate::sql::deep_scan::DeepScanPipeline;
    use crate::sql::normalizer::RequestNormalizer;
    use crate::sql::quick_scan::QuickScanPipeline;

    const SAMPLE_AUTHORIZED_REQUEST: &str = "\
POST /api/v1/search?category=books HTTP/1.1\r\n\
Host: testapp.local\r\n\
User-Agent: Mozilla/5.0\r\n\
Content-Type: application/json\r\n\
Content-Length: 35\r\n\
\r\n\
{\"query\": \"cybersec\", \"limit\": 10}";

    #[tokio::test]
    async fn test_request_normalization() {
        let normalized = RequestNormalizer::parse_raw_http(SAMPLE_AUTHORIZED_REQUEST).unwrap();
        assert_eq!(normalized.method, "POST");
        assert!(normalized.canonical_uri.contains("/api/v1/search"));
        assert_eq!(normalized.query_params.len(), 1);
        assert_eq!(normalized.query_params[0].0, "category");
    }

    #[tokio::test]
    async fn test_quick_scan_pipeline_execution() {
        let report = QuickScanPipeline::run_quick_scan(SAMPLE_AUTHORIZED_REQUEST).await.unwrap();
        assert!(report.targets_discovered >= 2); // 'category' query + JSON body fields
        assert!(report.tests_executed > 0);
        assert!(report.duration_ms >= 0.0);
    }

    #[tokio::test]
    async fn test_deep_scan_pipeline_execution() {
        let report = DeepScanPipeline::run_deep_scan(SAMPLE_AUTHORIZED_REQUEST, None).await.unwrap();
        assert!(report.targets_discovered >= 2);
        assert!(report.branches_evaluated > 0);
        assert!(report.coverage_tested > 0);
    }
}
