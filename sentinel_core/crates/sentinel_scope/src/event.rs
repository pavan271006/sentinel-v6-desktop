// crates/sentinel_scope/src/event.rs
//
// Auditable Scope Violation Event Publisher.
// Conforms to V6_CANONICAL_SPEC.yaml (§ SUB-04 / § 8 SEC-12).
// Dispatches CriticalEvent::ScopeViolationAttempt to EventBus for guaranteed durable SQLite WAL logging.

use sentinel_common::{CriticalEvent, EventBus, ScopeDecision, SentinelError};
use tracing::warn;

pub struct ScopeViolationEmitter;

impl ScopeViolationEmitter {
    /// Builds a canonical `CriticalEvent::ScopeViolationAttempt` from a denied decision.
    pub fn build_event(
        source: impl Into<String>,
        target: impl Into<String>,
        decision: ScopeDecision,
    ) -> CriticalEvent {
        CriticalEvent::ScopeViolationAttempt {
            source: source.into(),
            target: target.into(),
            decision,
        }
    }

    /// Dispatches a scope violation critical event to the given event bus if the decision is denied.
    pub fn emit_if_denied<B: EventBus + ?Sized>(
        bus: &B,
        source: &str,
        target: &str,
        decision: &ScopeDecision,
    ) -> Result<bool, SentinelError> {
        if !decision.allowed {
            let event = Self::build_event(source, target, decision.clone());
            warn!(
                target = target,
                source = source,
                reason = %decision.reason,
                "Auditable Scope Violation: outbound interaction blocked"
            );
            bus.publish_critical(event)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Helper to directly emit a violation event for a given target and decision.
    pub fn emit_violation<B: EventBus + ?Sized>(
        bus: &B,
        source: &str,
        target: &str,
        decision: ScopeDecision,
    ) -> Result<(), SentinelError> {
        let event = Self::build_event(source, target, decision);
        bus.publish_critical(event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decision::ScopeDecisionExt;
    use sentinel_bus::{ChannelEventBus, EventBusConfig};
    use uuid::Uuid;

    #[tokio::test]
    async fn test_emit_scope_violation_event() {
        let bus = ChannelEventBus::new(EventBusConfig::default());
        let mut critical_rx = bus.subscribe_critical();

        let target = "https://unauthorized.attacker.com/evil";
        let decision = ScopeDecision::default_deny(target, 1);

        let emitted =
            ScopeViolationEmitter::emit_if_denied(&bus, "TestRunner", target, &decision).unwrap();
        assert!(emitted);

        let received = critical_rx
            .recv()
            .await
            .expect("Must receive critical event");
        match received {
            CriticalEvent::ScopeViolationAttempt {
                source,
                target: ev_target,
                decision: ev_decision,
            } => {
                assert_eq!(source, "TestRunner");
                assert_eq!(ev_target, target);
                assert_eq!(ev_decision, decision);
                assert!(!ev_decision.allowed);
            }
            _ => panic!("Unexpected event received"),
        }
    }

    #[tokio::test]
    async fn test_allowed_decision_not_emitted() {
        let bus = ChannelEventBus::new(EventBusConfig::default());
        let target = "https://api.example.com/v1";
        let decision = ScopeDecision::allow_rule(target, 1, Uuid::new_v4(), "Matched include rule");

        let emitted =
            ScopeViolationEmitter::emit_if_denied(&bus, "TestRunner", target, &decision).unwrap();
        assert!(
            !emitted,
            "Allowed decision should NOT emit a scope violation event"
        );
    }
}
