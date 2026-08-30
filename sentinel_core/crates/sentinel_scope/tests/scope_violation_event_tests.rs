// crates/sentinel_scope/tests/scope_violation_event_tests.rs
//
// Integration Tests for Scope Violation Critical Event Emission (SEC-01 / SEC-12).
// Verifies that denied requests trigger CriticalEvent::ScopeViolationAttempt and dispatch to EventBus.

use chrono::Utc;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::{CriticalEvent, EventBus, Scope, ScopeEngine};
use sentinel_scope::{DefaultScopeEngine, ScopeViolationEmitter};

#[tokio::test]
async fn test_denied_request_emits_scope_violation_critical_event() {
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let mut critical_rx = bus.subscribe_critical();

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://api.target.com/*".to_string()],
        excludes: vec!["https://api.target.com/admin/*".to_string()],
    };

    let engine = DefaultScopeEngine::new(scope);

    // 1. Attempt out-of-scope target
    let evil_target = "https://unauthorized-victim.org/steal-data";
    let decision = engine.is_in_scope(evil_target);
    assert!(!decision.allowed);

    let emitted =
        ScopeViolationEmitter::emit_if_denied(&bus, "ScannerSubsystem", evil_target, &decision)
            .expect("Must emit critical event successfully");
    assert!(emitted);

    let received = critical_rx
        .recv()
        .await
        .expect("Must receive CriticalEvent on mpsc queue");

    match received {
        CriticalEvent::ScopeViolationAttempt {
            source,
            target,
            decision: ev_decision,
        } => {
            assert_eq!(source, "ScannerSubsystem");
            assert_eq!(target, evil_target);
            assert_eq!(ev_decision.decision_id, decision.decision_id);
            assert_eq!(ev_decision.target, evil_target);
            assert!(!ev_decision.allowed);
            assert!(ev_decision.reason.contains("Default Deny"));
            assert_eq!(ev_decision.scope_version, 1);
        }
        _ => panic!("Expected ScopeViolationAttempt critical event"),
    }

    // 2. Attempt excluded target on in-scope host
    let excluded_target = "https://api.target.com/admin/delete-all";
    let excluded_decision = engine.is_in_scope(excluded_target);
    assert!(!excluded_decision.allowed);

    ScopeViolationEmitter::emit_if_denied(
        &bus,
        "ProxyPipeline",
        excluded_target,
        &excluded_decision,
    )
    .unwrap();

    let second_received = critical_rx.recv().await.unwrap();
    match second_received {
        CriticalEvent::ScopeViolationAttempt {
            source,
            target,
            decision: ev_decision,
        } => {
            assert_eq!(source, "ProxyPipeline");
            assert_eq!(target, excluded_target);
            assert!(!ev_decision.allowed);
            assert!(ev_decision.reason.contains("matched exclude rule"));
        }
        _ => panic!("Expected ScopeViolationAttempt critical event"),
    }
}

#[tokio::test]
async fn test_in_scope_request_does_not_emit_violation_event() {
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let mut critical_rx = bus.subscribe_critical();

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://api.target.com/*".to_string()],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);
    let allowed_target = "https://api.target.com/v1/profile";
    let decision = engine.is_in_scope(allowed_target);
    assert!(decision.allowed);

    let emitted =
        ScopeViolationEmitter::emit_if_denied(&bus, "ActiveScanner", allowed_target, &decision)
            .unwrap();

    assert!(
        !emitted,
        "Allowed decisions must not trigger violation events"
    );

    // Ensure queue is empty
    let try_recv = critical_rx.try_recv();
    assert!(
        try_recv.is_err(),
        "Critical queue must be empty for allowed requests"
    );
}
