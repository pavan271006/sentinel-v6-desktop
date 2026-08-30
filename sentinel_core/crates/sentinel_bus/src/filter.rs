// crates/sentinel_bus/src/filter.rs
//
// Subscription Filtering by topic pattern, subsystem ID, and event types (SEC-12).

use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use sentinel_common::{CriticalEvent, SentinelEvent};

use crate::envelope::EventEnvelope;

/// Matches a dot-separated topic against a pattern (supports exact, wildcard segments, and prefixes).
pub fn topic_matches(pattern: &str, topic: &str) -> bool {
    let p = pattern.trim();
    let t = topic.trim();

    if p == "*" || p == "**" || p == t {
        return true;
    }

    // Prefix wildcard, e.g. "traffic.*", "telemetry.*", "audit.*"
    if let Some(prefix) = p.strip_suffix(".*") {
        if t == prefix || t.starts_with(&format!("{}.", prefix)) {
            return true;
        }
    }
    if let Some(prefix) = p.strip_suffix(".**") {
        if t == prefix || t.starts_with(&format!("{}.", prefix)) {
            return true;
        }
    }

    // Suffix wildcard, e.g. "*.created", "*.observation"
    if let Some(suffix) = p.strip_prefix("*.") {
        if t == suffix || t.ends_with(&format!(".{}", suffix)) {
            return true;
        }
    }

    // Segment by segment matching
    let pat_parts: Vec<&str> = p.split('.').collect();
    let top_parts: Vec<&str> = t.split('.').collect();

    if pat_parts.len() == top_parts.len() {
        return pat_parts
            .iter()
            .zip(top_parts.iter())
            .all(|(pat_seg, top_seg)| *pat_seg == "*" || *pat_seg == *top_seg);
    }

    false
}

/// Matches a subsystem identifier against a filter string (e.g. "SUB-01", "SUB-09").
pub fn subsystem_matches(pattern: &str, subsystem: &str) -> bool {
    let p = pattern.trim();
    let s = subsystem.trim();

    if p == "*" || p == s {
        return true;
    }

    // Subsystem prefix matching, e.g. "SUB-01" matches "SUB-01 ProxyEngine"
    if s.starts_with(p) || s.contains(p) {
        return true;
    }

    false
}

/// Subscription filter configuration for topics, subsystems, and event types.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SubscriptionFilter {
    /// Topic patterns to accept (e.g. "traffic.*", "findings.*", "scan.*", "telemetry.*").
    pub topic_patterns: Vec<String>,
    /// Subsystem identifiers to accept (e.g. "SUB-01", "SUB-04", "SUB-09").
    pub subsystems: Vec<String>,
    /// Event variant names to accept (e.g. "ObservationCreated", "FindingCreated").
    pub event_names: Vec<String>,
}

impl SubscriptionFilter {
    /// Creates a filter that accepts all events (no filter criteria applied).
    pub fn all() -> Self {
        Self::default()
    }

    /// Creates an empty filter builder.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a topic pattern to match.
    pub fn with_topic(mut self, pattern: impl Into<String>) -> Self {
        self.topic_patterns.push(pattern.into());
        self
    }

    /// Adds a subsystem identifier to match.
    pub fn with_subsystem(mut self, subsystem: impl Into<String>) -> Self {
        self.subsystems.push(subsystem.into());
        self
    }

    /// Adds an event variant name to match.
    pub fn with_event_name(mut self, event_name: impl Into<String>) -> Self {
        self.event_names.push(event_name.into());
        self
    }

    /// Returns true if no filter criteria are set (matches everything).
    pub fn is_empty(&self) -> bool {
        self.topic_patterns.is_empty() && self.subsystems.is_empty() && self.event_names.is_empty()
    }

    /// Evaluates whether a topic matches any configured topic pattern.
    pub fn matches_topic(&self, topic: &str) -> bool {
        if self.topic_patterns.is_empty() {
            return true;
        }
        self.topic_patterns
            .iter()
            .any(|pat| topic_matches(pat, topic))
    }

    /// Evaluates whether a subsystem matches any configured subsystem identifier.
    pub fn matches_subsystem(&self, subsystem: &str) -> bool {
        if self.subsystems.is_empty() {
            return true;
        }
        self.subsystems
            .iter()
            .any(|sub| subsystem_matches(sub, subsystem))
    }

    /// Evaluates whether an event name matches any configured event name filter.
    pub fn matches_event_name(&self, event_name: &str) -> bool {
        if self.event_names.is_empty() {
            return true;
        }
        self.event_names
            .iter()
            .any(|name| name.trim() == event_name.trim() || name == "*")
    }

    /// Evaluates whether a raw `SentinelEvent` matches all filter dimensions.
    pub fn matches_telemetry_event(&self, event: &SentinelEvent) -> bool {
        self.matches_topic(event.topic())
            && self.matches_subsystem(event.subsystem())
            && self.matches_event_name(event.event_name())
    }

    /// Evaluates whether an `EventEnvelope<SentinelEvent>` matches all filter dimensions.
    pub fn matches_telemetry_envelope(&self, env: &EventEnvelope<SentinelEvent>) -> bool {
        self.matches_topic(&env.topic)
            && self.matches_subsystem(&env.subsystem)
            && self.matches_event_name(env.payload.event_name())
    }

    /// Evaluates whether a raw `CriticalEvent` matches all filter dimensions.
    pub fn matches_critical_event(&self, event: &CriticalEvent) -> bool {
        self.matches_topic(event.topic())
            && self.matches_subsystem(event.subsystem())
            && self.matches_event_name(event.event_name())
    }

    /// Evaluates whether an `EventEnvelope<CriticalEvent>` matches all filter dimensions.
    pub fn matches_critical_envelope(&self, env: &EventEnvelope<CriticalEvent>) -> bool {
        self.matches_topic(&env.topic)
            && self.matches_subsystem(&env.subsystem)
            && self.matches_event_name(env.payload.event_name())
    }
}

/// Filtered Telemetry Stream that drops non-matching events during `recv()`.
pub struct FilteredTelemetryReceiver {
    rx: broadcast::Receiver<SentinelEvent>,
    filter: SubscriptionFilter,
}

impl FilteredTelemetryReceiver {
    pub fn new(rx: broadcast::Receiver<SentinelEvent>, filter: SubscriptionFilter) -> Self {
        Self { rx, filter }
    }

    /// Asynchronously waits for the next telemetry event matching the subscription filter.
    pub async fn recv(&mut self) -> Result<SentinelEvent, broadcast::error::RecvError> {
        loop {
            let event = self.rx.recv().await?;
            if self.filter.matches_telemetry_event(&event) {
                return Ok(event);
            }
        }
    }
}

/// Filtered Enveloped Telemetry Stream that drops non-matching envelopes during `recv()`.
pub struct FilteredEnvelopedTelemetryReceiver {
    rx: broadcast::Receiver<EventEnvelope<SentinelEvent>>,
    filter: SubscriptionFilter,
}

impl FilteredEnvelopedTelemetryReceiver {
    pub fn new(
        rx: broadcast::Receiver<EventEnvelope<SentinelEvent>>,
        filter: SubscriptionFilter,
    ) -> Self {
        Self { rx, filter }
    }

    /// Asynchronously waits for the next enveloped event matching the subscription filter.
    pub async fn recv(
        &mut self,
    ) -> Result<EventEnvelope<SentinelEvent>, broadcast::error::RecvError> {
        loop {
            let env = self.rx.recv().await?;
            if self.filter.matches_telemetry_envelope(&env) {
                return Ok(env);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_topic_matching_patterns() {
        assert!(topic_matches("*", "telemetry.observation"));
        assert!(topic_matches("telemetry.*", "telemetry.observation"));
        assert!(topic_matches("telemetry.*", "telemetry.scan.progress"));
        assert!(topic_matches("*.observation", "telemetry.observation"));
        assert!(topic_matches("audit.*", "audit.finding.created"));
        assert!(topic_matches("traffic.*", "traffic.http.req"));

        assert!(!topic_matches("traffic.*", "audit.finding.created"));
        assert!(!topic_matches("scan.*", "telemetry.observation"));
    }

    #[test]
    fn test_subsystem_matching() {
        assert!(subsystem_matches("SUB-01", "SUB-01 ProxyEngine"));
        assert!(subsystem_matches("SUB-09", "SUB-09 VerificationEngine"));
        assert!(subsystem_matches("*", "SUB-04 ScopeEngine"));
        assert!(!subsystem_matches("SUB-01", "SUB-04 ScopeEngine"));
    }

    #[test]
    fn test_subscription_filter_evaluation() {
        let filter = SubscriptionFilter::new()
            .with_topic("telemetry.*")
            .with_subsystem("SUB-03");

        let event1 = SentinelEvent::ObservationCreated(Uuid::new_v4());
        assert!(filter.matches_telemetry_event(&event1));

        let event2 = SentinelEvent::ContextDetected(Uuid::new_v4()); // SUB-10
        assert!(!filter.matches_telemetry_event(&event2));
    }
}
