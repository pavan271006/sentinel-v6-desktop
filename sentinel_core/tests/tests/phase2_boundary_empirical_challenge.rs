//! Comprehensive Empirical Challenge Test Suite for Phase 2 Subsystems (Architecture v6)
//!
//! Stress-tests:
//! 1. JWT tamper, none-algorithm rejection, algorithm confusion, clock skew / expiry leeway, audience & issuer mismatch
//! 2. Gzip decompression bomb protection (ISIZE and deflated payload expansion bombs), CRC-32 tamper rejection, malformed header handling
//! 3. OpenAPI 3.0/3.1 circular `$ref` recursion guards (self-ref, mutual cycles A->B->C->A, pointer escaping ~0/~1, spec fuzz matrix)
//! 4. GraphQL circular DoS cycle detection, deeply nested recursive query synthesis, AST complexity multipliers & directive skips, query batching probes
//! 5. WASM sandbox zero-capability enforcement (SEC-04), fuel limit exhaustion (10^8 instructions), and physical memory bounding (<50MB)

use sentinel_api::graphql::{
    GraphQlAstParser, GraphQlComplexityCalculator, GraphQlComplexityConfig, GraphQlCycleDetector,
    GraphQlEngine,
};
use sentinel_api::openapi::{
    JsonPointerResolver, OpenApiEndpointSchema, OpenApiParameter, OpenApiParser,
};
use sentinel_common::enums::HttpMethod;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{
    CapabilitySet, PluginInput, PluginSandboxConfig, ResourceLimits,
};
use sentinel_plugin::sandbox::{
    PluginSandboxEnvironment, DEFAULT_FUEL_LIMIT, MAX_MEMORY_BYTES,
};
use sentinel_productivity::codecs::gzip::{
    compress_gzip, decompress_gzip, decompress_gzip_bounded, DEFAULT_MAX_DECOMPRESS_BYTES,
};
use sentinel_productivity::codecs::jwt::{
    JwtAlgorithm, JwtEngine, JwtHeader, JwtValidationOptions, JwtVerifyVerdict,
};
use sentinel_productivity::codecs::CodecError;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

fn helper_default_sandbox_config() -> PluginSandboxConfig {
    PluginSandboxConfig {
        capabilities: CapabilitySet {
            network: false,
            filesystem: false,
            secrets: false,
            database: false,
            browser: false,
        },
        limits: ResourceLimits {
            max_memory_mb: 50,
            max_execution_ms: 1000,
            max_network_requests: 0,
        },
    }
}

// ==============================================================================
// 1. JWT TAMPER & NONE-ALGORITHM REJECTION CHALLENGES
// ==============================================================================

#[test]
fn challenge_jwt_none_algorithm_rejection_by_default() {
    let key = b"super-secret-hmac-key-for-testing-123456";
    let header = JwtHeader {
        alg: JwtAlgorithm::HS256,
        typ: Some("JWT".to_string()),
        kid: None,
        extra: HashMap::new(),
    };
    let payload = serde_json::json!({
        "sub": "user_12345",
        "role": "standard_user",
        "iss": "sentinel-auth-service",
        "aud": "sentinel-api-gateway"
    });

    // 1. Generate legitimate HS256 token
    let legit_token_str = JwtEngine::sign_or_tamper(&header, &payload, Some(key), None)
        .expect("HS256 signing must succeed");
    let parsed_legit = JwtEngine::inspect(&legit_token_str).expect("Valid token must inspect");
    let options = JwtValidationOptions::default();

    let legit_verdict = JwtEngine::verify(&parsed_legit, key, &options)
        .expect("Verification must complete without engine panic");
    assert_eq!(
        legit_verdict,
        JwtVerifyVerdict::Valid,
        "Legitimate HS256 token must be VALID"
    );

    // 2. Tamper attack: Rewrite algorithm to 'none' and strip signature
    let tampered_none_token_str = JwtEngine::sign_or_tamper(
        &header,
        &payload,
        None,
        Some(JwtAlgorithm::None),
    )
    .expect("Tampering with 'none' alg must produce valid serialization");

    assert!(
        tampered_none_token_str.ends_with('.'),
        "None-alg token should end with empty signature delimiter '.'"
    );

    let parsed_tampered = JwtEngine::inspect(&tampered_none_token_str)
        .expect("Tampered token must be inspectable");
    assert_eq!(parsed_tampered.header.alg, JwtAlgorithm::None);

    // 3. Verify under default options (which excludes 'none' from allowed_algs)
    let tampered_verdict = JwtEngine::verify(&parsed_tampered, key, &options)
        .expect("Verification must return verdict without panic");

    assert_eq!(
        tampered_verdict,
        JwtVerifyVerdict::NoneAlgorithmWarning,
        "Default validation options MUST REJECT 'none' algorithm token"
    );
}

#[test]
fn challenge_jwt_payload_tamper_signature_mismatch() {
    let key = b"symmetric-signing-key-production-grade-secret";
    let header = JwtHeader {
        alg: JwtAlgorithm::HS256,
        typ: Some("JWT".to_string()),
        kid: None,
        extra: HashMap::new(),
    };
    let payload = serde_json::json!({
        "user_id": 42,
        "role": "read_only_viewer",
        "tenant_id": "tenant-alpha"
    });

    let token_str = JwtEngine::sign_or_tamper(&header, &payload, Some(key), None).unwrap();
    let parsed = JwtEngine::inspect(&token_str).unwrap();

    // Verify baseline
    let default_opts = JwtValidationOptions::default();
    assert_eq!(
        JwtEngine::verify(&parsed, key, &default_opts).unwrap(),
        JwtVerifyVerdict::Valid
    );

    // Adversarial attack: Modify payload without secret key knowledge
    let mut attacker_payload = payload.clone();
    attacker_payload["role"] = serde_json::json!("super_admin");
    attacker_payload["tenant_id"] = serde_json::json!("tenant-victim");

    // Attacker crafts token with forged payload but re-uses old signature or random signature
    let attacker_token_forged = JwtEngine::sign_or_tamper(
        &header,
        &attacker_payload,
        Some(b"wrong-attacker-key"),
        None,
    )
    .unwrap();

    let parsed_forged = JwtEngine::inspect(&attacker_token_forged).unwrap();
    let forged_verdict = JwtEngine::verify(&parsed_forged, key, &default_opts).unwrap();

    assert_eq!(
        forged_verdict,
        JwtVerifyVerdict::SignatureInvalid,
        "Tampered payload with mismatched signature MUST BE REJECTED"
    );
}

#[test]
fn challenge_jwt_algorithm_confusion_and_options_enforcement() {
    let key = b"test-key-matrix-secret";
    let header = JwtHeader {
        alg: JwtAlgorithm::HS512,
        typ: Some("JWT".to_string()),
        kid: None,
        extra: HashMap::new(),
    };
    let payload = serde_json::json!({"sub": "user_789"});
    let token_str = JwtEngine::sign_or_tamper(&header, &payload, Some(key), None).unwrap();
    let parsed = JwtEngine::inspect(&token_str).unwrap();

    // Restrict allowed algorithms strictly to HS256
    let strict_options = JwtValidationOptions {
        validate_exp: false,
        validate_nbf: false,
        validate_iat: false,
        expected_aud: None,
        expected_iss: None,
        leeway_secs: 0,
        allowed_algs: vec![JwtAlgorithm::HS256], // Only HS256 allowed
    };

    let verdict = JwtEngine::verify(&parsed, key, &strict_options).unwrap();
    assert_eq!(
        verdict,
        JwtVerifyVerdict::AlgorithmRejected {
            alg: JwtAlgorithm::HS512
        },
        "HS512 token must be REJECTED when policy restricts allowed_algs to HS256"
    );
}

#[test]
fn challenge_jwt_claims_expiry_and_audience_boundaries() {
    let key = b"claims-verification-key";
    let header = JwtHeader {
        alg: JwtAlgorithm::HS256,
        typ: Some("JWT".to_string()),
        kid: None,
        extra: HashMap::new(),
    };

    // Expired timestamp (2 hours ago)
    let past_time = chrono::Utc::now().timestamp() - 7200;
    let expired_payload = serde_json::json!({
        "sub": "user_expired",
        "exp": past_time,
        "iss": "sentinel-corp",
        "aud": "sentinel-dashboard"
    });

    let expired_token_str =
        JwtEngine::sign_or_tamper(&header, &expired_payload, Some(key), None).unwrap();
    let parsed_expired = JwtEngine::inspect(&expired_token_str).unwrap();

    let strict_opts = JwtValidationOptions {
        validate_exp: true,
        validate_nbf: true,
        validate_iat: false,
        expected_aud: Some("sentinel-dashboard".to_string()),
        expected_iss: Some("sentinel-corp".to_string()),
        leeway_secs: 60,
        allowed_algs: vec![JwtAlgorithm::HS256],
    };

    let verdict = JwtEngine::verify(&parsed_expired, key, &strict_opts).unwrap();
    match verdict {
        JwtVerifyVerdict::Expired { exp, current } => {
            assert_eq!(exp, past_time);
            assert!(current > exp);
        }
        other => panic!("Expected Expired verdict, got {:?}", other),
    }

    // Audience mismatch
    let future_time = chrono::Utc::now().timestamp() + 3600;
    let aud_mismatch_payload = serde_json::json!({
        "sub": "user_valid_time",
        "exp": future_time,
        "iss": "sentinel-corp",
        "aud": "mobile-app-gateway" // Mismatch with expected "sentinel-dashboard"
    });

    let aud_token_str =
        JwtEngine::sign_or_tamper(&header, &aud_mismatch_payload, Some(key), None).unwrap();
    let parsed_aud = JwtEngine::inspect(&aud_token_str).unwrap();

    let aud_verdict = JwtEngine::verify(&parsed_aud, key, &strict_opts).unwrap();
    match aud_verdict {
        JwtVerifyVerdict::AudienceMismatch { expected, actual } => {
            assert_eq!(expected, "sentinel-dashboard");
            assert!(actual.contains("mobile-app-gateway"));
        }
        other => panic!("Expected AudienceMismatch verdict, got {:?}", other),
    }
}

// ==============================================================================
// 2. GZIP DECOMPRESSION BOMB & CRC INTEGRITY CHALLENGES
// ==============================================================================

#[test]
fn challenge_gzip_decompression_bomb_isize_footer_rejection() {
    let original_data = b"Hello, Sentinel Security Architecture v6!";
    let mut compressed = compress_gzip(original_data).expect("Compression should succeed");

    // Baseline: legitimate decompression works
    let decompressed = decompress_gzip(&compressed).expect("Decompression should succeed");
    assert_eq!(decompressed, original_data);

    // Adversarial attack: Forge ISIZE in footer (last 4 bytes) to claim 60MB (exceeding default 50MB)
    let bomb_isize = (60 * 1024 * 1024u32).to_le_bytes();
    let len = compressed.len();
    compressed[len - 4..len].copy_from_slice(&bomb_isize);

    // Attempt decompression under default 50MB bound
    let result = decompress_gzip(&compressed);
    match result {
        Err(CodecError::DecompressionBomb { max_bytes }) => {
            assert_eq!(max_bytes, DEFAULT_MAX_DECOMPRESS_BYTES);
        }
        other => panic!(
            "Expected CodecError::DecompressionBomb on forged ISIZE, got {:?}",
            other
        ),
    }
}

#[test]
fn challenge_gzip_decompression_bomb_actual_payload_expansion_bound() {
    // Generate 5MB of repetitive data that compresses into a tiny payload
    let large_payload = vec![b'A'; 5 * 1024 * 1024]; // 5 Megabytes
    let compressed_bomb = compress_gzip(&large_payload).expect("Compression must succeed");

    // Decompress with a tight memory bound of 1MB (1,048,576 bytes)
    let tight_limit = 1024 * 1024;
    let result = decompress_gzip_bounded(&compressed_bomb, tight_limit);

    match result {
        Err(CodecError::DecompressionBomb { max_bytes }) => {
            assert_eq!(max_bytes, tight_limit);
        }
        other => panic!(
            "Expected CodecError::DecompressionBomb when expanding past tight bound, got {:?}",
            other
        ),
    }
}

#[test]
fn challenge_gzip_crc32_and_magic_byte_tamper_rejection() {
    let data = b"Sensitive API payload with cryptographic integrity verification";
    let mut compressed = compress_gzip(data).unwrap();

    // Corrupt magic byte
    compressed[0] = 0x00;
    let magic_err = decompress_gzip(&compressed);
    match magic_err {
        Err(CodecError::GzipError(msg)) => {
            assert!(msg.contains("Invalid Gzip magic bytes"));
        }
        other => panic!("Expected GzipError for corrupted magic, got {:?}", other),
    }

    // Restore magic, corrupt payload byte to trigger CRC-32 checksum mismatch
    compressed[0] = 0x1F;
    compressed[12] ^= 0xFF; // Flip bit in deflate payload

    let crc_err = decompress_gzip(&compressed);
    assert!(
        crc_err.is_err(),
        "Corrupted payload must fail either CRC or Deflate parsing"
    );
}

// ==============================================================================
// 3. OPENAPI CIRCULAR $REF RECURSION GUARD CHALLENGES
// ==============================================================================

#[test]
fn challenge_openapi_self_referencing_circular_ref_cycle_guard() {
    // Schema with self-referencing circular $ref:
    // #/components/schemas/TreeNode -> children: [#/components/schemas/TreeNode]
    let circular_spec_json = serde_json::json!({
        "openapi": "3.1.0",
        "info": {"title": "Circular API", "version": "1.0.0"},
        "paths": {
            "/api/tree": {
                "get": {
                    "summary": "Get tree hierarchy",
                    "responses": {
                        "200": {
                            "description": "Tree response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/TreeNode"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "TreeNode": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "parent": {
                            "$ref": "#/components/schemas/TreeNode"
                        },
                        "children": {
                            "type": "array",
                            "items": {
                                "$ref": "#/components/schemas/TreeNode"
                            }
                        }
                    }
                }
            }
        }
    });

    let raw_str = circular_spec_json.to_string();

    // 1. Direct resolver test: expand schema without stack overflow
    let resolver = JsonPointerResolver::new(circular_spec_json.clone());
    let mut visited = HashSet::new();
    let expanded = resolver.expand_schema(&circular_spec_json, &mut visited);

    // Verify recursion guard terminates cycle with circular_ref_stub
    let tree_schema = &expanded["components"]["schemas"]["TreeNode"];
    assert_eq!(tree_schema["type"], "object");
    assert_eq!(tree_schema["properties"]["id"]["type"], "string");

    // Parent ref was circular, so it must be stubbed
    let parent_ref = &tree_schema["properties"]["parent"];
    assert_eq!(
        parent_ref["type"], "circular_ref_stub",
        "Self-referencing $ref MUST resolve to circular_ref_stub without stack overflow"
    );

    // 2. High-level parser test
    let routes = OpenApiParser::parse_spec(&raw_str).expect("Parser must survive circular spec");
    assert_eq!(routes.len(), 1);
    assert_eq!(routes[0].path_template, "/api/tree");
    assert_eq!(routes[0].method, HttpMethod::GET);

    let schemas = OpenApiParser::parse_detailed_schemas(&raw_str).unwrap();
    assert_eq!(schemas.len(), 1);
    assert_eq!(schemas[0].path, "/api/tree");
}

#[test]
fn challenge_openapi_mutual_multi_hop_circular_ref_cycle_guard() {
    // 3-node cycle: A (User) -> B (Department) -> C (Organization) -> A (User)
    let multi_hop_spec = serde_json::json!({
        "openapi": "3.0.0",
        "info": {"title": "Multi-Hop Cycle", "version": "1.0.0"},
        "paths": {
            "/api/users": {
                "get": {
                    "summary": "Get users",
                    "responses": {
                        "200": {
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/User"}
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "User": {
                    "type": "object",
                    "properties": {
                        "username": {"type": "string"},
                        "department": {"$ref": "#/components/schemas/Department"}
                    }
                },
                "Department": {
                    "type": "object",
                    "properties": {
                        "dept_name": {"type": "string"},
                        "org": {"$ref": "#/components/schemas/Organization"}
                    }
                },
                "Organization": {
                    "type": "object",
                    "properties": {
                        "org_name": {"type": "string"},
                        "lead_user": {"$ref": "#/components/schemas/User"}
                    }
                }
            }
        }
    });

    let resolver = JsonPointerResolver::new(multi_hop_spec.clone());
    let mut visited = HashSet::new();
    let expanded = resolver.expand_schema(&multi_hop_spec, &mut visited);

    // Verify all 3 entities are intact and the 3rd hop loop is cleanly terminated
    assert_eq!(
        expanded["components"]["schemas"]["User"]["type"],
        "object"
    );
    assert_eq!(
        expanded["components"]["schemas"]["Department"]["type"],
        "object"
    );
    assert_eq!(
        expanded["components"]["schemas"]["Organization"]["type"],
        "object"
    );

    let schemas = OpenApiParser::parse_detailed_schemas(&multi_hop_spec.to_string()).unwrap();
    assert_eq!(schemas.len(), 1);
    assert_eq!(schemas[0].path, "/api/users");
}

#[test]
fn challenge_openapi_spec_driven_fuzzer_generation_matrix() {
    let endpoint = OpenApiEndpointSchema {
        path: "/api/v1/users/{userId}".to_string(),
        method: "POST".to_string(),
        summary: Some("Create/update user profile".to_string()),
        parameters: vec![
            OpenApiParameter {
                name: "userId".to_string(),
                location: "path".to_string(),
                required: true,
                schema_type: "integer".to_string(),
                format: None,
                minimum: Some(1),
                maximum: Some(1000000),
                min_length: None,
                max_length: None,
                pattern: None,
                enum_values: None,
            },
            OpenApiParameter {
                name: "tier".to_string(),
                location: "query".to_string(),
                required: true,
                schema_type: "string".to_string(),
                format: None,
                minimum: None,
                maximum: None,
                min_length: Some(2),
                max_length: Some(20),
                pattern: None,
                enum_values: Some(vec!["FREE".to_string(), "PRO".to_string(), "ENTERPRISE".to_string()]),
            },
            OpenApiParameter {
                name: "email".to_string(),
                location: "query".to_string(),
                required: false,
                schema_type: "string".to_string(),
                format: Some("email".to_string()),
                minimum: None,
                maximum: None,
                min_length: None,
                max_length: None,
                pattern: None,
                enum_values: None,
            },
        ],
        request_body_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "displayName": {"type": "string"}
            }
        })),
        request_body_required: true,
        security_schemes: vec!["BearerAuth".to_string()],
    };

    let fuzz_cases = OpenApiParser::generate_spec_fuzz_cases(&endpoint);
    assert!(!fuzz_cases.is_empty(), "Fuzz generator must produce cases");

    let categories: HashSet<String> = fuzz_cases.iter().map(|c| c.attack_category.clone()).collect();

    // Verify key attack categories are generated
    assert!(categories.contains("RequiredOmission"), "Must test required omission");
    assert!(categories.contains("TypeConfusion"), "Must test type confusion");
    assert!(categories.contains("BoundaryExtreme"), "Must test boundary extremes (min/max)");
    assert!(categories.contains("EnumValidation"), "Must test invalid enum injection");
    assert!(categories.contains("FormatValidation"), "Must test format violations (email)");
    assert!(categories.contains("MassAssignment"), "Must test mass assignment (admin/role)");
    assert!(categories.contains("PrototypePollution"), "Must test prototype pollution (__proto__)");
}

// ==============================================================================
// 4. GRAPHQL CIRCULAR DOS & AST COMPLEXITY CHALLENGES
// ==============================================================================

#[test]
fn challenge_graphql_type_relation_cycle_detector() {
    // Type relation graph:
    // User -> [Post], Post -> [Comment], Comment -> [User]
    // Author -> [Book], Book -> [Author]
    let mut type_graph: HashMap<String, Vec<String>> = HashMap::new();
    type_graph.insert("User".to_string(), vec!["Post".to_string()]);
    type_graph.insert("Post".to_string(), vec!["Comment".to_string()]);
    type_graph.insert("Comment".to_string(), vec!["User".to_string(), "Reaction".to_string()]);
    type_graph.insert("Reaction".to_string(), vec![]);
    type_graph.insert("Author".to_string(), vec!["Book".to_string()]);
    type_graph.insert("Book".to_string(), vec!["Author".to_string()]);

    let detected_cycles = GraphQlCycleDetector::find_type_cycles(&type_graph);
    assert!(
        !detected_cycles.is_empty(),
        "Cycle detector MUST detect cycles in relation graph"
    );

    // Verify User -> Post -> Comment -> User cycle is found
    let has_user_cycle = detected_cycles.iter().any(|c| {
        c.len() >= 3 && c.contains(&"User".to_string()) && c.contains(&"Post".to_string()) && c.contains(&"Comment".to_string())
    });
    assert!(has_user_cycle, "Must detect User -> Post -> Comment -> User 3-hop cycle");

    // Verify Author -> Book -> Author cycle is found
    let has_author_cycle = detected_cycles.iter().any(|c| {
        c.contains(&"Author".to_string()) && c.contains(&"Book".to_string())
    });
    assert!(has_author_cycle, "Must detect Author -> Book -> Author 2-hop cycle");
}

#[test]
fn challenge_graphql_cyclic_query_synthesis_and_depth_measurement() {
    let cycle_fields = vec![
        ("author".to_string(), "User".to_string()),
        ("posts".to_string(), "Post".to_string()),
        ("comments".to_string(), "Comment".to_string()),
    ];

    let query_50 = GraphQlCycleDetector::generate_circular_cycle_query(&cycle_fields, 50);
    assert!(query_50.starts_with("query DeepCircularExploit"));
    assert!(query_50.contains("author { posts { comments {"));

    // Measure depth with GraphQlEngine (50 nested object fields + 1 leaf scalar field "id" = 51)
    let measured_depth = GraphQlEngine::calculate_query_depth(&query_50);
    assert_eq!(
        measured_depth, 51,
        "Measured AST query depth must match 50 nested objects + 1 scalar = 51"
    );
}

#[test]
fn challenge_graphql_ast_complexity_calculator_with_list_multipliers() {
    let query_str = r#"
        query ComplexQuery {
            users(first: 20) {
                id
                username
                profile {
                    avatarUrl
                    bio
                }
                posts(limit: 10) {
                    id
                    title
                    comments(pageSize: 5) {
                        id
                        body
                    }
                }
            }
        }
    "#;

    let doc = GraphQlAstParser::parse(query_str).expect("Query must parse into AST");
    let calc = GraphQlComplexityCalculator::new(GraphQlComplexityConfig::default());
    let complexity = calc.calculate_document_complexity(&doc);

    // Complexity calculation:
    // users (cost 2 * 1) -> multiplier 20
    //   id, username (1 * 20 each = 40)
    //   profile (2 * 20 = 40) -> avatarUrl, bio (1 * 20 * 10 = 200)
    //   posts (2 * 20 = 40) -> multiplier 10 (parent 20 * 10 = 200)
    //     id, title (1 * 200 each = 400)
    //     comments (2 * 200 = 400) -> multiplier 5 (parent 200 * 5 = 1000)
    //       id, body (1 * 1000 each = 2000)
    // Total complexity should be substantially high (> 1000)
    assert!(
        complexity >= 1000,
        "Nested lists with multipliers must yield calculated complexity >= 1000, got {}",
        complexity
    );

    // Test directive skipping
    let skipped_query_str = r#"
        query SkippedQuery {
            users(first: 20) {
                id
                heavySubtree @skip(if: true) {
                    massiveData(first: 1000) {
                        field1
                        field2
                    }
                }
            }
        }
    "#;
    let skipped_doc = GraphQlAstParser::parse(skipped_query_str).unwrap();
    let skipped_complexity = calc.calculate_document_complexity(&skipped_doc);

    assert!(
        skipped_complexity < complexity,
        "Skipped subtree (@skip(if: true)) MUST NOT contribute to complexity score"
    );
}

#[test]
fn challenge_graphql_query_batching_and_suggestion_leak_detection() {
    // 1. Array-based query batching probe
    let probe = GraphQlEngine::generate_array_batch_probe("query { currentUser { id } }", 50);
    assert_eq!(probe.batch_size, 50);
    assert!(probe.payload_json.starts_with('['));
    assert!(probe.payload_json.ends_with(']'));

    // 2. Alias-based query batching probe
    let alias_probe = GraphQlEngine::generate_alias_batch_probe("user", "id email role", 25);
    assert!(alias_probe.contains("a1: user(id: \"1\") { id email role }"));
    assert!(alias_probe.contains("a25: user(id: \"25\") { id email role }"));

    // 3. Field suggestion information leak detection
    let leak_response = r#"{"errors": [{"message": "Cannot query field 'passwrd' on type 'User'. Did you mean 'password' or 'passwd'?"}]}"#;
    let detected = GraphQlEngine::detect_field_suggestions(leak_response);
    assert!(detected.is_some(), "Must detect field suggestion info leak");

    let clean_response = r#"{"data": {"user": {"id": "1"}}}"#;
    assert!(GraphQlEngine::detect_field_suggestions(clean_response).is_none());
}

// ==============================================================================
// 5. WASM SANDBOX ZERO-CAPABILITY & FUEL/MEMORY LIMIT CHALLENGES (SEC-04)
// ==============================================================================

#[tokio::test]
async fn challenge_wasm_magic_header_validation() {
    let invalid_bytes = b"NOT_A_WASM_BINARY_JUST_PLAIN_TEXT";
    let config = helper_default_sandbox_config();

    let env_result = PluginSandboxEnvironment::new(invalid_bytes, config);
    assert!(
        env_result.is_err(),
        "Invalid WASM bytes without \\0asm magic must fail"
    );
    match env_result {
        Err(SentinelError::SandboxViolation(msg)) => {
            assert!(msg.contains("Invalid WASM binary: missing standard \\0asm magic header"));
        }
        _ => panic!("Expected SandboxViolation on invalid magic"),
    }
}

#[tokio::test]
async fn challenge_wasm_zero_ambient_capability_enforcement_sec_04() {
    // Valid 8-byte WASM header: \0asm\x01\0\0\0
    let valid_wasm_header = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];

    // Attempt 1: Enable network capability -> MUST BE REJECTED
    let mut net_config = helper_default_sandbox_config();
    net_config.capabilities.network = true;

    let env_net = PluginSandboxEnvironment::new(&valid_wasm_header, net_config).unwrap();
    let input = PluginInput {
        transaction_id: Some(Uuid::new_v4()),
        config_overrides: HashMap::new(),
    };

    let result_net = env_net.execute_transaction(&input).await;
    match result_net {
        Err(SentinelError::SandboxViolation(msg)) => {
            assert!(msg.contains("SEC-04 Capability Violation"));
        }
        other => panic!("Expected SEC-04 violation for network cap, got {:?}", other),
    }

    // Attempt 2: Enable filesystem capability -> MUST BE REJECTED
    let mut fs_config = helper_default_sandbox_config();
    fs_config.capabilities.filesystem = true;
    let env_fs = PluginSandboxEnvironment::new(&valid_wasm_header, fs_config).unwrap();

    let result_fs = env_fs.execute_transaction(&input).await;
    assert!(result_fs.is_err(), "Filesystem capability must trigger SEC-04 violation");

    // Attempt 3: Enable secrets access -> MUST BE REJECTED
    let mut sec_config = helper_default_sandbox_config();
    sec_config.capabilities.secrets = true;
    let env_sec = PluginSandboxEnvironment::new(&valid_wasm_header, sec_config).unwrap();

    let result_sec = env_sec.execute_transaction(&input).await;
    assert!(result_sec.is_err(), "Secrets capability must trigger SEC-04 violation");
}

#[tokio::test]
async fn challenge_wasm_memory_limit_boundary_enforcement() {
    let valid_wasm = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];

    // 1. Configure sandbox with declared memory limit exceeding 50MB (e.g. 100MB)
    let mut oversized_config = helper_default_sandbox_config();
    oversized_config.limits.max_memory_mb = 100;

    let env = PluginSandboxEnvironment::new(&valid_wasm, oversized_config).unwrap();

    // Verify sandbox clamped declared limit to MAX_MEMORY_BYTES (50MB)
    assert_eq!(
        env.max_memory_bytes, MAX_MEMORY_BYTES,
        "Declared memory limit above 50MB MUST BE CLAMPED to MAX_MEMORY_BYTES (50MB)"
    );

    // 2. Test instance exceeding configured memory boundary (3MB payload with 2MB limit)
    let mut three_mb_wasm = valid_wasm.clone();
    three_mb_wasm.resize(3 * 1024 * 1024, 0x00); // 3MB (fuel = 30M < 100M)

    let mut tight_mem_config = helper_default_sandbox_config();
    tight_mem_config.limits.max_memory_mb = 2; // 2MB limit

    let tight_env = PluginSandboxEnvironment::new(&three_mb_wasm, tight_mem_config).unwrap();
    let input = PluginInput {
        transaction_id: Some(Uuid::new_v4()),
        config_overrides: HashMap::new(),
    };

    let result = tight_env.execute_transaction(&input).await;
    match result {
        Err(SentinelError::SandboxViolation(msg)) => {
            assert!(
                msg.contains("WASM memory limit exceeded"),
                "Must reject instance exceeding memory limit, got: {}", msg
            );
        }
        other => panic!("Expected memory limit SandboxViolation, got {:?}", other),
    }

    // 3. Test instance exceeding absolute 50MB boundary (51MB payload)
    let mut giant_wasm_bytes = valid_wasm.clone();
    giant_wasm_bytes.resize(51 * 1024 * 1024, 0x00); // 51MB

    let giant_env = PluginSandboxEnvironment::new(&giant_wasm_bytes, helper_default_sandbox_config()).unwrap();
    let giant_result = giant_env.execute_transaction(&input).await;
    assert!(
        giant_result.is_err(),
        "51MB WASM binary must be rejected by sandbox resource bounds"
    );
}

#[tokio::test]
async fn challenge_wasm_fuel_limit_exhaustion_enforcement() {
    let valid_wasm = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];
    let config = helper_default_sandbox_config();
    let env = PluginSandboxEnvironment::new(&valid_wasm, config).unwrap();

    assert_eq!(env.fuel_limit, DEFAULT_FUEL_LIMIT); // 100,000,000 instructions

    // Create input with massive config overrides designed to exhaust instruction budget
    let mut massive_overrides = HashMap::new();
    for i in 0..150_000 {
        massive_overrides.insert(format!("key_{}", i), format!("val_{}", i));
    }
    // Estimated instructions: 150,000 * 1000 = 150,000,000 > 100,000,000 fuel limit

    let input_exhaust = PluginInput {
        transaction_id: Some(Uuid::new_v4()),
        config_overrides: massive_overrides,
    };

    let result = env.execute_transaction(&input_exhaust).await;
    match result {
        Err(SentinelError::SandboxViolation(msg)) => {
            assert!(
                msg.contains("WASM fuel exhausted"),
                "Execution exceeding fuel limit must be aborted with 'WASM fuel exhausted'"
            );
        }
        other => panic!("Expected fuel exhaustion SandboxViolation, got {:?}", other),
    }

    // Baseline: Normal execution with reasonable instructions succeeds
    let normal_input = PluginInput {
        transaction_id: Some(Uuid::new_v4()),
        config_overrides: HashMap::new(),
    };

    let normal_result = env.execute_transaction(&normal_input).await;
    assert!(
        normal_result.is_ok(),
        "Normal execution within fuel budget must succeed"
    );
    let output = normal_result.unwrap();
    assert!(output.output.contains("success"));
    assert!(output.output.contains("fuel_consumed"));
}
