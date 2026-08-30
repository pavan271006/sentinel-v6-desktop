use tempfile::tempdir;

use sentinel_common::enums::HttpMethod;
use sentinel_storage::{EngagementMemory, NegativeControlRecord, TestedVectorRecord};

#[test]
fn test_engagement_memory_tested_vectors_and_negative_controls() {
    let mut memory = EngagementMemory::new();

    // 1. Record a tested SQLi vector
    let record = TestedVectorRecord::new(
        "/api/v1/search",
        HttpMethod::GET,
        "SQLI-BOOLEAN-INVERSION",
        Some("q"),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        200,
        false,
    );

    memory.record_tested_vector(record);

    assert!(memory.has_tested_vector(
        HttpMethod::GET,
        "/api/v1/search",
        "SQLI-BOOLEAN-INVERSION",
        Some("q"),
    ));

    assert!(!memory.has_tested_vector(
        HttpMethod::POST,
        "/api/v1/search",
        "SQLI-BOOLEAN-INVERSION",
        Some("q"),
    ));

    // 2. Record a verified negative control
    let neg_control = NegativeControlRecord::new(
        "/api/v1/login",
        HttpMethod::POST,
        Some("password"),
        "AUTH-BRUTEFORCE-BYPASS",
        "Account locked out after 5 invalid attempts with 429 response",
    );

    memory.record_negative_control(neg_control);

    assert!(memory.is_verified_negative(
        HttpMethod::POST,
        "/api/v1/login",
        "AUTH-BRUTEFORCE-BYPASS",
        Some("password"),
    ));

    assert_eq!(memory.get_negative_controls().len(), 1);
}

#[test]
fn test_engagement_memory_persistence_roundtrip() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("engagement_memory.json");

    let mut memory = EngagementMemory::new();
    memory.record_tested_vector(TestedVectorRecord::new(
        "/profile",
        HttpMethod::GET,
        "XSS-REFLECTED",
        Some("name"),
        "d41d8cd98f00b204e9800998ecf8427e",
        200,
        false,
    ));

    memory.record_negative_control(NegativeControlRecord::new(
        "/profile",
        HttpMethod::GET,
        Some("name"),
        "XSS-REFLECTED",
        "HTML entities properly escaped into &lt; &gt;",
    ));

    memory.save_to_json(&file_path).expect("Save succeeds");

    let loaded = EngagementMemory::load_from_json(&file_path).expect("Load succeeds");

    assert!(loaded.has_tested_vector(HttpMethod::GET, "/profile", "XSS-REFLECTED", Some("name")));
    assert!(loaded.is_verified_negative(HttpMethod::GET, "/profile", "XSS-REFLECTED", Some("name")));
}
