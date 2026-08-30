//! Opaque-Box E2E Suite: BLAKE3 Content-Derived IDs and Evidence Snapshot Determinism.

use std::collections::HashMap;
use ucma_core::evidence::{EvidenceRecord, EvidenceStore, Severity};
use ucma_core::ids::{ContentId, EndpointId, ParameterId, RequestId, SnapshotId, TargetId};
use ucma_core::snapshot::ResponseSnapshot;

#[test]
fn test_e2e_content_id_determinism() {
    let data1 = b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html>hello</html>";
    let data2 = b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html>hello</html>";
    let data3 = b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html>different</html>";

    let id1 = ContentId::from_data(data1);
    let id2 = ContentId::from_data(data2);
    let id3 = ContentId::from_data(data3);

    assert_eq!(
        id1, id2,
        "identical content must produce identical BLAKE3 ContentId"
    );
    assert_ne!(
        id1, id3,
        "different content must produce different BLAKE3 ContentId"
    );
    assert_eq!(
        id1.as_str().len(),
        64,
        "BLAKE3 hex string must be 64 characters"
    );
}

#[test]
fn test_e2e_domain_id_derivation_determinism() {
    // TargetId
    let t1 = TargetId::derive("https://example.com/api");
    let t2 = TargetId::derive("https://example.com/api");
    assert_eq!(t1, t2);

    // EndpointId
    let e1 = EndpointId::derive(&t1, "GET", "/api/v1/users/{id}");
    let e2 = EndpointId::derive(&t1, "GET", "/api/v1/users/{id}");
    let e3 = EndpointId::derive(&t1, "POST", "/api/v1/users/{id}");
    assert_eq!(e1, e2);
    assert_ne!(e1, e3);

    // RequestId
    let r1 = RequestId::derive(&e1, "GET", "https://example.com/api/v1/users/42", b"");
    let r2 = RequestId::derive(&e1, "GET", "https://example.com/api/v1/users/42", b"");
    assert_eq!(r1, r2);

    // ParameterId
    let p1 = ParameterId::derive(&e1, "query", "user_id");
    let p2 = ParameterId::derive(&e1, "query", "user_id");
    assert_eq!(p1, p2);
}

#[test]
fn test_e2e_response_snapshot_wire_hashing() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    headers.insert("server".to_string(), "nginx".to_string());

    let body = br#"{"status": "ok", "records": [1, 2, 3]}"#.to_vec();
    let raw_wire = br#"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\nserver: nginx\r\n\r\n{"status": "ok", "records": [1, 2, 3]}"#.to_vec();

    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/status");
    let request_id = RequestId::derive(&endpoint_id, "GET", "https://example.com/status", b"");

    let snapshot = ResponseSnapshot::new(
        request_id,
        200,
        headers,
        body.clone(),
        15_000_000,
        &raw_wire,
        false,
        Some("93.184.216.34".to_string()),
    );

    let expected_content_id = ContentId::from_data(&raw_wire);
    assert_eq!(snapshot.blake3_raw_wire_hash, expected_content_id);
    assert_eq!(snapshot.status_code, 200);
    assert_eq!(snapshot.body, body);
}

#[test]
fn test_e2e_evidence_store_crud_and_querying() {
    let store = EvidenceStore::new();

    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/search");
    let request_id = RequestId::derive(
        &endpoint_id,
        "GET",
        "https://example.com/search?q=test",
        b"",
    );
    let snapshot_id = SnapshotId::derive(&request_id, 200, b"raw response bytes");

    let record1 = EvidenceRecord::new(
        target_id,
        "SQLi Differential Oracle",
        "Confirmed syntactic perturbation via boolean true/false difference",
        "Detailed reproduction trail",
        Severity::High,
        vec![snapshot_id],
    );

    let record_id = record1.id;
    store.insert_evidence(record1);

    assert_eq!(store.count_evidence(), 1);
    assert!(store.get_evidence(&record_id).is_some());

    // Query by target
    let by_target = store.evidence_for_target(&target_id);
    assert_eq!(by_target.len(), 1);

    // Query all
    let all = store.all_evidence();
    assert_eq!(all.len(), 1);

    // Clear
    store.clear();
    assert_eq!(store.count_evidence(), 0);
}
