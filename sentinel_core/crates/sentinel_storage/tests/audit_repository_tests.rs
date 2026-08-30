// crates/sentinel_storage/tests/audit_repository_tests.rs

use chrono::{Duration, Utc};
use sentinel_common::{CriticalEvent, ScopeDecision};
use sentinel_storage::store::SqliteObservationStore;
use tempfile::tempdir;
use uuid::Uuid;

#[tokio::test]
async fn test_audit_repository_critical_events_logging_and_queries() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let finding_id = Uuid::new_v4();
    let candidate_id = Uuid::new_v4();

    // 1. Log FindingCreated
    let ev1 = CriticalEvent::FindingCreated(finding_id);
    let id1 = store.audit().insert_critical_event(&ev1).await.unwrap();

    // 2. Log CandidateVerified
    let ev2 = CriticalEvent::CandidateVerified(candidate_id);
    let id2 = store.audit().insert_critical_event(&ev2).await.unwrap();

    // 3. Log ScopeViolationAttempt
    let decision = ScopeDecision {
        allowed: false,
        reason: "Default Deny: Target host is not in authorized scope".to_string(),
        matched_rule: None,
        target: "https://evil.attacker.com/steal".to_string(),
        scope_version: 1,
        decision_id: Uuid::new_v4(),
        timestamp: Utc::now(),
    };

    let ev3 = CriticalEvent::ScopeViolationAttempt {
        source: "ProxyInterceptor".to_string(),
        target: "https://evil.attacker.com/steal".to_string(),
        decision,
    };
    let id3 = store.audit().insert_critical_event(&ev3).await.unwrap();

    // Total count
    let total = store.audit().count().await.unwrap();
    assert_eq!(total, 3);

    // Query by ID
    let rec1 = store
        .audit()
        .get_by_id(id1)
        .await
        .unwrap()
        .expect("Must find record 1");
    assert_eq!(rec1.event_type, "FindingCreated");
    assert!(rec1.payload_json.contains(&finding_id.to_string()));

    let rec2 = store
        .audit()
        .get_by_id(id2)
        .await
        .unwrap()
        .expect("Must find record 2");
    assert_eq!(rec2.event_type, "CandidateVerified");
    assert!(rec2.payload_json.contains(&candidate_id.to_string()));

    let rec3 = store
        .audit()
        .get_by_id(id3)
        .await
        .unwrap()
        .expect("Must find record 3");
    assert_eq!(rec3.event_type, "ScopeViolationAttempt");
    assert_eq!(
        rec3.target.as_deref(),
        Some("https://evil.attacker.com/steal")
    );

    // Query by event type
    let finding_events = store.audit().query_by_type("FindingCreated").await.unwrap();
    assert_eq!(finding_events.len(), 1);
    assert_eq!(finding_events[0].id, id1);

    // Query by target
    let target_events = store
        .audit()
        .query_by_target("https://evil.attacker.com/steal")
        .await
        .unwrap();
    assert_eq!(target_events.len(), 1);
    assert_eq!(target_events[0].id, id3);

    // Query by time range
    let start = Utc::now() - Duration::hours(1);
    let end = Utc::now() + Duration::hours(1);
    let time_events = store.audit().query_by_time_range(start, end).await.unwrap();
    assert_eq!(time_events.len(), 3);
}

#[tokio::test]
async fn test_audit_repository_manual_event_logging() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let id = store
        .insert_audit_event(
            "UserAuthentication",
            "IdentityManager",
            Some("user:admin"),
            r#"{"status":"success"}"#,
        )
        .await
        .unwrap();

    let records = store.list_audit_records().await.unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].id, id);
    assert_eq!(records[0].event_type, "UserAuthentication");
    assert_eq!(records[0].target.as_deref(), Some("user:admin"));
}
