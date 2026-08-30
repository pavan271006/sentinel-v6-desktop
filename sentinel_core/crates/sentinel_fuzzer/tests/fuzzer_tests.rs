//! Test Suite for Production Fuzzing Subsystem

use std::time::Duration;
use uuid::Uuid;

use sentinel_common::domain::core::Transaction;
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::enums::{HttpMethod, MutatorType, ParamLocation, Provenance};
use sentinel_common::operational::FuzzProfile;
use sentinel_common::traits::FuzzerEngine;
use sentinel_fuzzer::{DefaultFuzzerEngine, FuzzMutator, PayloadMinimizer};

fn mock_transaction(uri: &str, body: &str) -> Transaction {
    Transaction {
        meta: EntityMetadata::new(Provenance::Manual),
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::POST,
                uri: uri.to_string(),
                version: "HTTP/1.1".to_string(),
                headers: vec![(b"Host".to_vec(), b"target.com".to_vec())],
            },
            normalized_text: body.to_string(),
        },
        response: None,
        timing: Duration::from_millis(10),
        tls_info: None,
    }
}

#[test]
fn test_mutator_generation() {
    let seed = b"username=admin&id=100";

    // 1. Boundary
    let boundary = FuzzMutator::mutate(seed, MutatorType::Boundary);
    assert!(boundary.iter().any(|m| m == b"2147483647"));
    assert!(boundary.iter().any(|m| m == b"-1"));

    // 2. FormatString
    let format_str = FuzzMutator::mutate(seed, MutatorType::FormatString);
    assert!(format_str.iter().any(|m| m == b"%s%s%s%s%s%s%s%s"));
    assert!(format_str.iter().any(|m| m == b"{{7*7}}"));

    // 3. Wordlist
    let wordlist = FuzzMutator::mutate(seed, MutatorType::Wordlist);
    assert!(wordlist.iter().any(|m| m == b"' OR '1'='1"));
    assert!(wordlist.iter().any(|m| m == b"<script>alert(1)</script>"));

    // 4. Unicode Normalization
    let unicode = FuzzMutator::mutate(seed, MutatorType::UnicodeNormalization);
    assert!(unicode.iter().any(|m| m.contains(&0x00)));
}

#[test]
fn test_payload_minimizer_ddmin() {
    // A long payload containing a vulnerability trigger "CRASH_TRIGGER"
    let long_payload = b"prefix_padding_1234567890_CRASH_TRIGGER_suffix_padding_9876543210";

    let minimized = PayloadMinimizer::minimize(long_payload, |candidate| {
        candidate.windows(13).any(|w| w == b"CRASH_TRIGGER")
    });

    assert_eq!(minimized, b"CRASH_TRIGGER");
}

#[tokio::test]
async fn test_fuzzer_engine_execution() {
    let engine = DefaultFuzzerEngine::new();

    let tx = mock_transaction("https://target.com/api/v1/search", "{\"query\": \"test\"}");
    let profile = FuzzProfile {
        insertion_points: vec![ParamLocation::Body, ParamLocation::Query],
        mutators: vec![
            MutatorType::Boundary,
            MutatorType::FormatString,
            MutatorType::Wordlist,
        ],
        encoders: vec!["UrlEncode".to_string()],
        concurrency: 4,
        request_budget: 100,
        timeout_ms: 5000,
        stop_conditions: vec![],
    };

    let stream = engine.fuzz(&tx, &profile).await.unwrap();
    let _ = stream; // verified stream creation
}

#[test]
fn test_type_aware_schema_guided_fuzzing() {
    use sentinel_fuzzer::TypeAwareFuzzer;

    let json_input = r#"{"id": 100, "username": "alice", "is_admin": false, "roles": ["user"]}"#;
    let mutated_variants = TypeAwareFuzzer::mutate_json(json_input);
    assert!(!mutated_variants.is_empty());

    // Check that integer mutation preserves JSON syntax
    assert!(mutated_variants.iter().any(|v| v.contains("\"id\":0") || v.contains("\"id\":-1") || v.contains("\"id\":2147483647")));

    // Check that boolean was inverted
    assert!(mutated_variants.iter().any(|v| v.contains("\"is_admin\":true")));

    // Check that string was injected with polyglots
    assert!(mutated_variants.iter().any(|v| v.contains("' OR '1'='1") || v.contains("<script>alert(1)</script>")));
}

#[test]
fn test_grammar_ast_fuzzer() {
    use sentinel_fuzzer::GrammarAstFuzzer;

    let sql_tree = GrammarAstFuzzer::generate_sql_expression(3);
    assert!(sql_tree.contains("CASE WHEN") || sql_tree.contains("EXISTS") || sql_tree.contains("1=1"));

    let xml_tree = GrammarAstFuzzer::generate_xml_structure(3);
    assert!(xml_tree.contains("<node level=\"3\">"));
    assert!(xml_tree.contains("<leaf>sentinel_data</leaf>"));

    let graphql_tree = GrammarAstFuzzer::generate_graphql_nested_query(3);
    assert!(graphql_tree.contains("user(id: 3)"));
    assert!(graphql_tree.contains("{ id name }"));
}

