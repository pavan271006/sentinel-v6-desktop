//! Test Suite for ContextEngine

use std::time::Duration;
use uuid::Uuid;

use sentinel_common::domain::core::Transaction;
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::enums::{HttpMethod, ParameterClass, Provenance};
use sentinel_common::traits::ContextEngine;
use sentinel_context::DefaultContextEngine;

fn mock_transaction(
    server_header: &str,
    powered_by: &str,
    cookie: &str,
    body: &str,
) -> Transaction {
    let req_parts = HttpParsedParts {
        method: HttpMethod::GET,
        uri: "/index.html".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: vec![(b"Host".to_vec(), b"target.com".to_vec())],
    };

    let mut resp_headers = Vec::new();
    if !server_header.is_empty() {
        resp_headers.push((b"Server".to_vec(), server_header.as_bytes().to_vec()));
    }
    if !powered_by.is_empty() {
        resp_headers.push((b"X-Powered-By".to_vec(), powered_by.as_bytes().to_vec()));
    }
    if !cookie.is_empty() {
        resp_headers.push((b"Set-Cookie".to_vec(), cookie.as_bytes().to_vec()));
    }

    let resp_parts = HttpParsedParts {
        method: HttpMethod::GET,
        uri: "/index.html".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: resp_headers,
    };

    Transaction {
        meta: EntityMetadata::new(Provenance::Proxy),
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: req_parts,
            normalized_text: "GET /index.html HTTP/1.1\r\nHost: target.com\r\n\r\n".to_string(),
        },
        response: Some(MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: resp_parts,
            normalized_text: body.to_string(),
        }),
        timing: Duration::from_millis(30),
        tls_info: None,
    }
}

#[test]
fn test_tech_fingerprinting() {
    let engine = DefaultContextEngine::new();

    // 1. Nginx + PHP + Laravel
    let tx1 = mock_transaction("nginx/1.24.0", "PHP/8.2", "laravel_session=xyz123", "");
    let fps1 = engine.fingerprint(&tx1);
    assert!(fps1.iter().any(|f| f.tech == "Nginx"));
    assert!(fps1.iter().any(|f| f.tech == "PHP"));
    assert!(fps1.iter().any(|f| f.tech == "Laravel"));

    // 2. Express.js + Node.js
    let tx2 = mock_transaction("", "Express", "connect.sid=session_token", "");
    let fps2 = engine.fingerprint(&tx2);
    assert!(fps2.iter().any(|f| f.tech == "Express.js"));
    assert!(fps2.iter().any(|f| f.tech == "Node.js"));

    // 3. WordPress body signature
    let tx3 = mock_transaction(
        "Apache/2.4.52",
        "",
        "",
        "<html><head><link rel='stylesheet' href='/wp-content/themes/twentytwenty/style.css'></head><body>WP</body></html>",
    );
    let fps3 = engine.fingerprint(&tx3);
    assert!(fps3.iter().any(|f| f.tech == "Apache HTTP Server"));
    assert!(fps3.iter().any(|f| f.tech == "WordPress"));
}

#[test]
fn test_parameter_classification() {
    let engine = DefaultContextEngine::new();

    assert_eq!(
        engine.classify_parameter("id", "507f1f77bcf86cd799439011"),
        ParameterClass::ObjectId
    );

    assert_eq!(
        engine.classify_parameter("email", "pentester@target.com"),
        ParameterClass::Email
    );

    assert_eq!(
        engine.classify_parameter("redirect_uri", "https://oauth.target.com/callback"),
        ParameterClass::Url
    );

    assert_eq!(
        engine.classify_parameter("file", "/var/www/uploads/report.pdf"),
        ParameterClass::FilePath
    );

    assert_eq!(
        engine.classify_parameter("is_admin", "true"),
        ParameterClass::Boolean
    );

    assert_eq!(
        engine.classify_parameter("page", "42"),
        ParameterClass::Numeric
    );

    assert_eq!(
        engine.classify_parameter("search", "security vulnerabilities"),
        ParameterClass::Search
    );

    assert_eq!(
        engine.classify_parameter("auth_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"),
        ParameterClass::Token
    );

    assert_eq!(
        engine.classify_parameter("config", "{\"theme\": \"dark\", \"notifications\": true}"),
        ParameterClass::Json
    );
}

#[test]
fn test_param_miner_logarithmic_bisection() {
    use sentinel_context::{ParamMinerEngine, ParameterVector};

    let wordlist: Vec<String> = (0..100).map(|i| format!("param_{}", i)).collect();
    let batches = ParamMinerEngine::create_batches(&wordlist, ParameterVector::Query, 50, "seed1");
    assert_eq!(batches.len(), 2);
    assert_eq!(batches[0].candidate_params.len(), 50);

    // Bisection
    let (left, right) = ParamMinerEngine::bisect_batch(&batches[0]);
    assert_eq!(left.candidate_params.len(), 25);
    assert_eq!(right.candidate_params.len(), 25);

    // Anomaly detection with canary reflection
    let probe_body = "<html><body>Debug: Injected value sentinel_seed1_5_param_5 reflected</body></html>";
    let (has_anomaly, isolated) = ParamMinerEngine::detect_anomaly(200, 500, 200, 560, probe_body, &batches[0]);
    assert!(has_anomaly);
    assert_eq!(isolated, Some("param_5".to_string()));

    // Confirmation
    let confirmed = ParamMinerEngine::confirm_parameter(
        "debug",
        ParameterVector::Query,
        200,
        "Clean page",
        200,
        "Page with sentinel_canary_value",
        "sentinel_canary_value",
    ).unwrap();
    assert_eq!(confirmed.name, "debug");
    assert!(confirmed.reflected_in_body);
    assert_eq!(confirmed.confidence, 0.99);
}

#[test]
fn test_route_extractor_and_type_inference() {
    use sentinel_context::{InferredType, RouteExtractorEngine, TypeInferenceEngine};

    let js = r#"
        const routes = [
            { path: '/api/v1/users/:id', component: UserView },
            { path: '/api/v2/orders/{orderId}/items', component: OrderView }
        ];
        function fetchAccount() {
            return axios.post('/auth/v1/login', { user, pass });
        }
        function getStatus() {
            return fetch('/api/v1/system/status');
        }
    "#;

    let routes = RouteExtractorEngine::extract_routes(js);
    assert!(routes.iter().any(|r| r.path_template == "/api/v1/users/:id"));
    assert!(routes.iter().any(|r| r.path_template == "/auth/v1/login"));
    assert!(routes.iter().any(|r| r.path_template == "/api/v1/system/status"));

    // Type Inference
    let int_samples = ["1", "42", "1000", "0"];
    let int_schema = TypeInferenceEngine::infer_schema("page_size", &int_samples);
    assert_eq!(int_schema.inferred_type, InferredType::Integer { min: Some(0), max: Some(1000) });

    let uuid_samples = ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"];
    let uuid_schema = TypeInferenceEngine::infer_schema("user_id", &uuid_samples);
    assert_eq!(uuid_schema.inferred_type, InferredType::Uuid);
}

#[test]
fn test_advanced_fingerprint_engine() {
    use sentinel_context::AdvancedFingerprintEngine;

    // Test Favicon MurmurHash3
    let sample_favicon = b"FAVICON_IMAGE_DATA_BYTES_XYZ_1234567890";
    let fp = AdvancedFingerprintEngine::calculate_favicon_hash(sample_favicon);
    assert_ne!(fp.murmur3_hash, 0);

    // Known WordPress hash
    assert_eq!(
        AdvancedFingerprintEngine::match_known_favicon_hash(116323821),
        Some("WordPress".to_string())
    );

    // JARM TLS fingerprint
    let nginx_jarm = "27d27d27d00027d00042d42d000000a67e2a9b6e82e5b6eb4ee2ee91807d4b";
    assert_eq!(
        AdvancedFingerprintEngine::match_jarm_fingerprint(nginx_jarm),
        Some("Nginx (OpenSSL)".to_string())
    );
}

