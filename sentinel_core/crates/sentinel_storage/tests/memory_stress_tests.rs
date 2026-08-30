use tempfile::tempdir;
use sentinel_common::enums::HttpMethod;
use sentinel_storage::{EngagementMemory, NegativeControlRecord, TestedVectorRecord};

#[test]
fn test_engagement_memory_key_uniqueness_and_stress() {
    let mut memory = EngagementMemory::new();

    // Insert 500 tested vectors across varying methods, endpoints, parameters, and checks
    for i in 0..500 {
        let method = if i % 2 == 0 { HttpMethod::GET } else { HttpMethod::POST };
        let path = format!("/api/v1/resource/{}", i % 25);
        let check_id = format!("CHECK-TYPE-{}", i % 10);
        let param = if i % 3 == 0 { Some(format!("param_{}", i % 5)) } else { None };
        let is_vuln = i % 7 == 0;

        let record = TestedVectorRecord::new(
            &path,
            method,
            &check_id,
            param.as_deref(),
            format!("payload_hash_{}", i),
            200,
            is_vuln,
        );

        memory.record_tested_vector(record);
    }

    // Verify lookup precision
    assert!(memory.has_tested_vector(
        HttpMethod::GET,
        "/api/v1/resource/0",
        "CHECK-TYPE-0",
        Some("param_0"),
    ));

    // Verify negative lookup for non-inserted method
    assert!(!memory.has_tested_vector(
        HttpMethod::PUT,
        "/api/v1/resource/0",
        "CHECK-TYPE-0",
        Some("param_0"),
    ));
}

#[test]
fn test_negative_control_recall_separation() {
    let mut memory = EngagementMemory::new();

    let endpoint = "/api/v2/transfer";
    let check = "IDOR-ACCOUNT-TAKEOVER";

    // Record verified negative control
    let rec = NegativeControlRecord::new(
        endpoint,
        HttpMethod::POST,
        Some("recipient_id"),
        check,
        "Zero access allowed for unauthorized recipient; HTTP 403 returned",
    );
    memory.record_negative_control(rec);

    assert!(memory.is_verified_negative(
        HttpMethod::POST,
        endpoint,
        check,
        Some("recipient_id"),
    ));

    // Different method is NOT verified negative
    assert!(!memory.is_verified_negative(
        HttpMethod::GET,
        endpoint,
        check,
        Some("recipient_id"),
    ));

    // Different parameter is NOT verified negative
    assert!(!memory.is_verified_negative(
        HttpMethod::POST,
        endpoint,
        check,
        Some("amount"),
    ));
}

#[test]
fn test_engagement_memory_persistence_and_corrupted_json_handling() {
    let dir = tempdir().unwrap();
    let valid_path = dir.path().join("valid_memory.json");
    let corrupt_path = dir.path().join("corrupt_memory.json");
    let missing_path = dir.path().join("missing_memory.json");

    let mut memory = EngagementMemory::new();
    memory.record_tested_vector(TestedVectorRecord::new(
        "/admin/system",
        HttpMethod::GET,
        "RCE-COMMAND-INJECTION",
        Some("cmd"),
        "abcdef1234567890",
        403,
        false,
    ));

    // Save and reload
    memory.save_to_json(&valid_path).expect("Save valid memory");
    let loaded = EngagementMemory::load_from_json(&valid_path).expect("Load valid memory");
    assert!(loaded.has_tested_vector(
        HttpMethod::GET,
        "/admin/system",
        "RCE-COMMAND-INJECTION",
        Some("cmd"),
    ));

    // Corrupted file handling
    std::fs::write(&corrupt_path, "TRUNCATED OR INVALID JSON { \"tested_vectors\":").unwrap();
    let load_corrupt = EngagementMemory::load_from_json(&corrupt_path);
    assert!(load_corrupt.is_err());

    // Nonexistent file handling
    let load_missing = EngagementMemory::load_from_json(&missing_path);
    assert!(load_missing.is_err());
}
