// crates/sentinel_bus/tests/filter_tests.rs
//
// Topic, Subsystem, and Event Type Filtering Tests (SEC-12).

use uuid::Uuid;

use sentinel_bus::{
    subsystem_matches, topic_matches, EventBusConfig, SentinelEventBus, SubscriptionFilter,
};
use sentinel_common::{CriticalEvent, EventBus, ScopeDecision, SentinelEvent};

#[test]
fn test_topic_pattern_matching_rules() {
    // Exact matching
    assert!(topic_matches(
        "telemetry.observation",
        "telemetry.observation"
    ));
    assert!(!topic_matches("telemetry.observation", "telemetry.scan"));

    // Prefix wildcard
    assert!(topic_matches("telemetry.*", "telemetry.observation"));
    assert!(topic_matches("telemetry.*", "telemetry.context"));
    assert!(topic_matches("telemetry.*", "telemetry.task"));
    assert!(topic_matches("traffic.*", "traffic.http"));
    assert!(topic_matches("findings.*", "findings.created"));
    assert!(topic_matches("scan.*", "scan.progress"));
    assert!(topic_matches("audit.*", "audit.scope.violation"));

    assert!(!topic_matches("traffic.*", "telemetry.observation"));
    assert!(!topic_matches("findings.*", "audit.scope.violation"));

    // Global wildcard
    assert!(topic_matches("*", "anything"));
    assert!(topic_matches("**", "deep.nested.topic"));
}

#[test]
fn test_subsystem_identifier_matching() {
    assert!(subsystem_matches("SUB-01", "SUB-01 ProxyEngine"));
    assert!(subsystem_matches("SUB-04", "SUB-04 ScopeEngine"));
    assert!(subsystem_matches("SUB-09", "SUB-09 VerificationEngine"));
    assert!(subsystem_matches("SUB-10", "SUB-10 ContextEngine"));
    assert!(subsystem_matches("SUB-11", "SUB-11 CoverageEngine"));

    assert!(!subsystem_matches("SUB-01", "SUB-09 VerificationEngine"));
    assert!(!subsystem_matches("SUB-04", "SUB-10 ContextEngine"));
}

#[tokio::test]
async fn test_filtered_telemetry_subscription() {
    let bus = SentinelEventBus::new(EventBusConfig::default());

    // Subscriber 1: only telemetry.observation (SUB-03)
    let filter1 = SubscriptionFilter::new().with_topic("telemetry.observation");
    let mut rx1 = bus.subscribe_filtered_telemetry(filter1);

    // Subscriber 2: only SUB-10 (ContextEngine)
    let filter2 = SubscriptionFilter::new().with_subsystem("SUB-10");
    let mut rx2 = bus.subscribe_filtered_telemetry(filter2);

    let obs_id = Uuid::new_v4();
    let ctx_id = Uuid::new_v4();
    let cov_id = Uuid::new_v4();

    // Publish observation, context, and coverage events
    bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id))
        .unwrap();
    bus.publish_telemetry(SentinelEvent::ContextDetected(ctx_id))
        .unwrap();
    bus.publish_telemetry(SentinelEvent::CoverageUpdate(cov_id))
        .unwrap();

    // rx1 receives only ObservationCreated
    let r1 = rx1.recv().await.unwrap();
    assert_eq!(r1, SentinelEvent::ObservationCreated(obs_id));

    // rx2 receives only ContextDetected
    let r2 = rx2.recv().await.unwrap();
    assert_eq!(r2, SentinelEvent::ContextDetected(ctx_id));
}

#[tokio::test]
async fn test_filtered_enveloped_subscription() {
    let bus = SentinelEventBus::default();

    let filter = SubscriptionFilter::new().with_event_name("ObservationCreated");
    let mut rx = bus.subscribe_filtered_enveloped(filter);

    let obs_id = Uuid::new_v4();
    let ctx_id = Uuid::new_v4();

    bus.publish_telemetry(SentinelEvent::ContextDetected(ctx_id))
        .unwrap();
    bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id))
        .unwrap();

    let env = rx.recv().await.unwrap();
    assert_eq!(env.payload, SentinelEvent::ObservationCreated(obs_id));
    assert_eq!(env.topic, "telemetry.observation");
    assert_eq!(env.subsystem, "SUB-03 ObservationStore");
}

#[test]
fn test_critical_event_filtering() {
    let filter = SubscriptionFilter::new()
        .with_topic("audit.scope.violation")
        .with_subsystem("SUB-04");

    let decision = ScopeDecision::deny("https://bad.com", 1, None, "Deny");
    let scope_ev = CriticalEvent::ScopeViolationAttempt {
        source: "SUB-01 ProxyEngine".to_string(),
        target: "https://bad.com".to_string(),
        decision,
    };

    let find_ev = CriticalEvent::FindingCreated(Uuid::new_v4());

    assert!(filter.matches_critical_event(&scope_ev));
    assert!(!filter.matches_critical_event(&find_ev));
}
