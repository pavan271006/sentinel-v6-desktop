//! Test Suite for Scanner & Task Orchestration Subsystem

use std::sync::Arc;
use std::time::Duration;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::config::{ResourceBudget, ScanConfig};
use sentinel_common::domain::core::Transaction;
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::enums::{HttpMethod, Provenance, ScanLifecycle};
use sentinel_common::events::SentinelEvent;
use sentinel_common::traits::{EventBus, ScanOrchestrator};
use sentinel_scanner::{DefaultScanOrchestrator, SecurityCheckEngine};
use sentinel_storage::SqliteObservationStore;

fn mock_transaction_with_headers(headers: Vec<(&str, &str)>) -> Transaction {
    let req_parts = HttpParsedParts {
        method: HttpMethod::GET,
        uri: "/login?password=plaintext_pass".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: vec![(b"Host".to_vec(), b"target.com".to_vec())],
    };

    let resp_headers = headers
        .into_iter()
        .map(|(k, v)| (k.as_bytes().to_vec(), v.as_bytes().to_vec()))
        .collect();

    let resp_parts = HttpParsedParts {
        method: HttpMethod::GET,
        uri: "/login".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: resp_headers,
    };

    Transaction {
        meta: EntityMetadata::new(Provenance::Proxy),
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: req_parts,
            normalized_text: "".to_string(),
        },
        response: Some(MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: resp_parts,
            normalized_text: "".to_string(),
        }),
        timing: Duration::from_millis(20),
        tls_info: None,
    }
}

#[test]
fn test_passive_security_checks() {
    // Transaction missing HSTS, CSP, and having insecure cookie + server leak
    let tx = mock_transaction_with_headers(vec![
        ("Server", "Apache/2.4.41 (Ubuntu)"),
        ("Set-Cookie", "sessionid=xyz123; Path=/"),
    ]);

    let candidates = SecurityCheckEngine::run_passive_checks(&tx);

    assert!(candidates
        .iter()
        .any(|c| c.hypothesis.contains("Strict-Transport-Security")));
    assert!(candidates
        .iter()
        .any(|c| c.hypothesis.contains("Content-Security-Policy")));
    assert!(candidates.iter().any(|c| c.hypothesis.contains("HttpOnly")));
    assert!(candidates
        .iter()
        .any(|c| c.hypothesis.contains("Server version disclosure")));
    assert!(candidates
        .iter()
        .any(|c| c.hypothesis.contains("Sensitive credentials or tokens")));
}

#[tokio::test]
async fn test_scan_orchestrator_lifecycle() {
    let bus = Arc::new(ChannelEventBus::new(EventBusConfig::default()));
    let mut telem_rx = bus.subscribe_telemetry();

    let orchestrator = DefaultScanOrchestrator::new().with_event_bus(bus.clone());

    let scan_id = Uuid::new_v4();
    let config = ScanConfig {
        id: scan_id,
        scope_id: Uuid::new_v4(),
        concurrency_limit: 4,
        active_plugins_json: "[\"sqli\", \"xss\"]".to_string(),
        timestamp: chrono::Utc::now(),
        budget: ResourceBudget {
            max_requests: 100,
            max_duration_secs: 60,
        },
    };

    // 1. Start Scan
    orchestrator.start_scan(config).await.unwrap();
    assert_eq!(
        orchestrator.scan_status(scan_id).await.unwrap(),
        ScanLifecycle::Running
    );

    let ev = telem_rx.recv().await.unwrap();
    if let SentinelEvent::ScanProgress(p) = ev {
        assert_eq!(p.scan_id, scan_id);
        assert_eq!(p.state, ScanLifecycle::Running);
    } else {
        panic!("Expected ScanProgress event");
    }

    // 2. Pause Scan
    orchestrator.pause_scan(scan_id).await.unwrap();
    assert_eq!(
        orchestrator.scan_status(scan_id).await.unwrap(),
        ScanLifecycle::Paused
    );

    // 3. Resume Scan
    orchestrator.resume_scan(scan_id).await.unwrap();
    assert_eq!(
        orchestrator.scan_status(scan_id).await.unwrap(),
        ScanLifecycle::Running
    );

    // 4. Cancel Scan
    orchestrator.cancel_scan(scan_id).await.unwrap();
    assert_eq!(
        orchestrator.scan_status(scan_id).await.unwrap(),
        ScanLifecycle::Finished
    );
}

#[tokio::test]
async fn test_scan_orchestrator_storage_persistence() {
    let temp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());

    let orchestrator = DefaultScanOrchestrator::new().with_storage(store.clone());

    let scan_id = Uuid::new_v4();
    let config = ScanConfig {
        id: scan_id,
        scope_id: Uuid::new_v4(),
        concurrency_limit: 2,
        active_plugins_json: "[]".to_string(),
        timestamp: chrono::Utc::now(),
        budget: ResourceBudget {
            max_requests: 10,
            max_duration_secs: 10,
        },
    };

    orchestrator.start_scan(config).await.unwrap();

    let records = store.list_audit_records().await.unwrap();
    assert!(records.iter().any(|r| r.event_type == "ScanStarted"));
}

#[test]
fn test_deep_cookie_security_auditor() {
    use sentinel_scanner::{CookieSecurityAuditor, CookieSecurityIssue, SameSitePolicy};

    // 1. Host prefix violation (sets domain and lacks Secure)
    let bad_host_cookie = "__Host-session=xyz123; Domain=example.com; Path=/";
    let parsed_bad = CookieSecurityAuditor::parse_set_cookie(bad_host_cookie);
    assert!(parsed_bad.issues.contains(&CookieSecurityIssue::HostPrefixDomainViolation));
    assert!(parsed_bad.issues.contains(&CookieSecurityIssue::HostPrefixMissingSecureOrPath));

    // 2. Valid Secure Host cookie
    let good_host_cookie = "__Host-session=xyz123456789abcdef999; Secure; Path=/; HttpOnly; SameSite=Strict";
    let parsed_good = CookieSecurityAuditor::parse_set_cookie(good_host_cookie);
    assert_eq!(parsed_good.samesite, SameSitePolicy::Strict);
    assert!(parsed_good.secure);
    assert!(parsed_good.httponly);
    assert!(parsed_good.issues.is_empty());
}

#[test]
fn test_deep_csp_and_hsts_auditor() {
    use sentinel_scanner::{CspWeakness, HeaderSecurityAuditor};

    let weak_csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; object-src 'none'";
    let parsed_csp = HeaderSecurityAuditor::parse_csp(weak_csp);
    assert!(parsed_csp.weaknesses.contains(&CspWeakness::UnsafeInlineScript));
    assert!(parsed_csp.weaknesses.contains(&CspWeakness::UnsafeEvalScript));
    assert!(parsed_csp.weaknesses.contains(&CspWeakness::WildcardScriptSrc));
    assert!(parsed_csp.weaknesses.contains(&CspWeakness::MissingBaseUri));

    // HSTS with insufficient max-age
    let hsts_findings = HeaderSecurityAuditor::evaluate_hsts("max-age=86400");
    assert!(hsts_findings.iter().any(|f| f.title.contains("Insufficient Duration")));
}

#[test]
fn test_cors_misconfiguration_analyzer() {
    use sentinel_scanner::{CorsMisconfigurationAnalyzer, CorsVulnerabilityType};

    let probes = CorsMisconfigurationAnalyzer::generate_cors_origin_probes("target.com");
    assert_eq!(probes.len(), 5);

    // Arbitrary origin reflection with credentials
    let vuln = CorsMisconfigurationAnalyzer::evaluate_cors_response(
        "https://evil-attacker.com",
        Some("https://evil-attacker.com"),
        Some("true"),
        "target.com",
    ).expect("Vulnerability must be detected");
    assert_eq!(vuln.vuln_type, CorsVulnerabilityType::ArbitraryOriginReflectionWithCredentials);

    // Null origin reflection with credentials
    let null_vuln = CorsMisconfigurationAnalyzer::evaluate_cors_response(
        "null",
        Some("null"),
        Some("true"),
        "target.com",
    ).expect("Null origin vulnerability must be detected");
    assert_eq!(null_vuln.vuln_type, CorsVulnerabilityType::NullOriginReflectionWithCredentials);
}

#[test]
fn test_debug_interface_and_cloud_exposure() {
    use sentinel_scanner::{CloudExposureProber, DebugExposureAnalyzer, DEBUG_PROBES};

    let env_target = &DEBUG_PROBES[0]; // /actuator/env
    assert!(DebugExposureAnalyzer::evaluate_response(
        env_target,
        200,
        Some("application/json"),
        "{\"propertySources\": [{\"name\": \"server.ports\"}], \"activeProfiles\": [\"prod\"]}",
    ));

    // SPA soft-404 rejection (HTML returned for JSON endpoint)
    assert!(!DebugExposureAnalyzer::evaluate_response(
        env_target,
        200,
        Some("text/html"),
        "<!DOCTYPE html><html><body><div id=\"root\"></div></body></html>",
    ));

    // Cloud metadata prober
    let meta_probes = CloudExposureProber::get_metadata_probes();
    assert_eq!(meta_probes.len(), 3);

    // Storage bucket listing
    let s3_resp = "<ListBucketResult><Name>mybucket</Name><Contents><Key>secret.pdf</Key></Contents></ListBucketResult>";
    assert!(CloudExposureProber::evaluate_storage_bucket_response(s3_resp).unwrap().contains("AWS S3 Public Bucket Listing"));
}

#[test]
fn test_source_maps_and_dev_artifacts() {
    use sentinel_scanner::{SourceMapAuditor, DEV_ARTIFACT_PROBES};

    let js = "function hello(){ console.log('hi'); }\n//# sourceMappingURL=app.bundle.js.map";
    assert_eq!(
        SourceMapAuditor::extract_source_map_url(js),
        Some("app.bundle.js.map".to_string())
    );

    let map_json = "{\"version\": 3, \"sources\": [\"src/App.tsx\", \"src/index.tsx\"]}";
    let parsed_map = SourceMapAuditor::parse_source_map("app.bundle.js.map", map_json).unwrap();
    assert_eq!(parsed_map.total_sources, 2);
    assert_eq!(parsed_map.source_files[0], "src/App.tsx");

    let env_probe = &DEV_ARTIFACT_PROBES[1]; // .env
    assert!(SourceMapAuditor::evaluate_dev_artifact(env_probe, 200, "DATABASE_URL=postgres://user:pass@localhost/db\nAPI_KEY=sk_test_123"));
    assert!(!SourceMapAuditor::evaluate_dev_artifact(env_probe, 200, "<html><body>404 Not Found</body></html>"));
}

#[test]
fn test_http_smuggling_and_cache_security() {
    use sentinel_scanner::{CacheSecurityEngine, HttpSmugglingEngine, SmugglingAttackVector};

    // 1. Smuggling probe generator
    let cl_te = HttpSmugglingEngine::generate_cl_te_probe("target.local", "/sentinel_canary_404");
    assert_eq!(cl_te.vector, SmugglingAttackVector::ClTe);

    // Verify confirmation via benign canary reflection
    let result = HttpSmugglingEngine::evaluate_smuggling_response(
        SmugglingAttackVector::ClTe,
        100,
        404,
        "Cannot GET /sentinel_canary_404",
        "/sentinel_canary_404",
    );
    assert!(result.is_vulnerable);
    assert_eq!(result.confidence, 0.99);

    // 2. Web cache poisoning evaluator
    let secondary_headers = vec![
        (b"X-Cache".to_vec(), b"HIT".to_vec()),
        (b"Content-Type".to_vec(), b"text/html".to_vec()),
    ];
    let secondary_body = "<html><script src=\"https://attacker-x-forwarded-host-test.sentinel.test/main.js\"></script></html>";
    let cache_result = CacheSecurityEngine::evaluate_cache_poisoning(
        &secondary_headers,
        secondary_body,
        "attacker-x-forwarded-host-test.sentinel.test",
    );
    assert!(cache_result.is_vulnerable);
    assert!(cache_result.cache_header_hit);
    assert!(cache_result.canary_reflected_in_cache);
}

#[test]
fn test_scan_profiles_presets() {
    use sentinel_common::config::ScanProfile;

    let scope_id = Uuid::new_v4();

    // 1. Quick Passive Profile
    let quick = ScanProfile::QuickPassive.to_scan_config(scope_id);
    assert_eq!(quick.scope_id, scope_id);
    assert_eq!(quick.concurrency_limit, 10);
    assert_eq!(quick.budget.max_requests, 1_000);
    assert!(quick.active_plugins_json.contains("passive_headers"));

    // 2. Standard OWASP Profile
    let standard = ScanProfile::StandardOwasp.to_scan_config(scope_id);
    assert_eq!(standard.concurrency_limit, 25);
    assert_eq!(standard.budget.max_requests, 25_000);
    assert!(standard.active_plugins_json.contains("active_sqli"));

    // 3. Deep Active Profile
    let deep = ScanProfile::DeepActive.to_scan_config(scope_id);
    assert_eq!(deep.concurrency_limit, 50);
    assert_eq!(deep.budget.max_requests, 100_000);
    assert!(deep.active_plugins_json.contains("deep_fuzzing"));

    // 4. API Only Profile
    let api = ScanProfile::ApiOnly.to_scan_config(scope_id);
    assert_eq!(api.concurrency_limit, 30);
    assert!(api.active_plugins_json.contains("openapi_fuzz"));

    // 5. Auth Focused Profile
    let auth = ScanProfile::AuthFocused.to_scan_config(scope_id);
    assert_eq!(auth.concurrency_limit, 20);
    assert!(auth.active_plugins_json.contains("bola_matrix"));

    // 6. CI/CD Pipeline Profile
    let cicd = ScanProfile::CicdPipeline.to_scan_config(scope_id);
    assert_eq!(cicd.concurrency_limit, 15);
    assert_eq!(cicd.budget.max_duration_secs, 600);
    assert!(cicd.active_plugins_json.contains("high_confidence_only"));
}

