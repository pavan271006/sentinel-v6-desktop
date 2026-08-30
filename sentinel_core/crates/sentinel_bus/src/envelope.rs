// crates/sentinel_bus/src/envelope.rs
//
// Canonical Event Envelope wrapping event payloads with standard routing metadata (SEC-12).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::{CriticalEvent, SentinelError, SentinelEvent};

/// Standardized metadata envelope wrapping events traversing the bus.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventEnvelope<T> {
    /// Unique identifier for this envelope instance.
    pub id: Uuid,
    /// Timestamp when the event was framed and dispatched.
    pub timestamp: DateTime<Utc>,
    /// Dot-separated routing topic string (e.g. "telemetry.observation", "audit.finding.created").
    pub topic: String,
    /// Subsystem identifier originating the event (e.g. "SUB-01 ProxyEngine").
    pub subsystem: String,
    /// Inner event payload.
    pub payload: T,
    /// Optional correlation or trace ID linking related operations.
    pub correlation_id: Option<Uuid>,
    /// Monotonically increasing sequence number assigned by the bus.
    pub sequence_number: u64,
}

impl<T> EventEnvelope<T> {
    /// Creates a new `EventEnvelope` with a newly generated UUID and current timestamp.
    pub fn new(
        payload: T,
        topic: impl Into<String>,
        subsystem: impl Into<String>,
        sequence_number: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            topic: topic.into(),
            subsystem: subsystem.into(),
            payload,
            correlation_id: None,
            sequence_number,
        }
    }

    /// Sets the correlation ID for distributed tracing and causality tracking.
    pub fn with_correlation_id(mut self, correlation_id: Uuid) -> Self {
        self.correlation_id = Some(correlation_id);
        self
    }

    /// Sets a specific UUID for this envelope.
    pub fn with_id(mut self, id: Uuid) -> Self {
        self.id = id;
        self
    }

    /// Sets a specific timestamp for this envelope.
    pub fn with_timestamp(mut self, timestamp: DateTime<Utc>) -> Self {
        self.timestamp = timestamp;
        self
    }

    /// Alias for `correlation_id` to support OpenTelemetry / canonical trace conventions.
    pub fn trace_id(&self) -> Option<Uuid> {
        self.correlation_id
    }

    /// Serializes envelope to JSON string.
    pub fn to_json(&self) -> Result<String, SentinelError>
    where
        T: Serialize,
    {
        serde_json::to_string(self).map_err(|e| SentinelError::Serialization(e.to_string()))
    }

    /// Deserializes envelope from JSON string.
    pub fn from_json(json: &str) -> Result<Self, SentinelError>
    where
        for<'de> T: Deserialize<'de>,
    {
        serde_json::from_str(json).map_err(|e| SentinelError::Serialization(e.to_string()))
    }
}

impl EventEnvelope<SentinelEvent> {
    /// Constructs an `EventEnvelope` for a `SentinelEvent` telemetry item.
    pub fn from_telemetry(event: SentinelEvent, sequence_number: u64) -> Self {
        let topic = event.topic().to_string();
        let subsystem = event.subsystem().to_string();
        Self::new(event, topic, subsystem, sequence_number)
    }
}

impl EventEnvelope<CriticalEvent> {
    /// Constructs an `EventEnvelope` for a `CriticalEvent` security item.
    pub fn from_critical(event: CriticalEvent, sequence_number: u64) -> Self {
        let topic = event.topic().to_string();
        let subsystem = event.subsystem().to_string();
        Self::new(event, topic, subsystem, sequence_number)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sentinel_common::ScopeDecision;

    #[test]
    fn test_telemetry_envelope_creation() {
        let obs_id = Uuid::new_v4();
        let event = SentinelEvent::ObservationCreated(obs_id);
        let envelope = EventEnvelope::from_telemetry(event.clone(), 42);

        assert_eq!(envelope.topic, "telemetry.observation");
        assert_eq!(envelope.subsystem, "SUB-03 ObservationStore");
        assert_eq!(envelope.sequence_number, 42);
        assert_eq!(envelope.payload, event);
        assert_eq!(envelope.trace_id(), None);

        let json = envelope.to_json().unwrap();
        let parsed: EventEnvelope<SentinelEvent> = EventEnvelope::from_json(&json).unwrap();
        assert_eq!(parsed.id, envelope.id);
        assert_eq!(parsed.sequence_number, 42);
    }

    #[test]
    fn test_critical_envelope_creation() {
        let decision = ScopeDecision::deny("https://example.com", 1, None, "Deny test");
        let event = CriticalEvent::ScopeViolationAttempt {
            source: "SUB-01 ProxyEngine".to_string(),
            target: "https://example.com".to_string(),
            decision,
        };

        let corr_id = Uuid::new_v4();
        let envelope =
            EventEnvelope::from_critical(event.clone(), 100).with_correlation_id(corr_id);

        assert_eq!(envelope.topic, "audit.scope.violation");
        assert_eq!(envelope.subsystem, "SUB-04 ScopeEngine");
        assert_eq!(envelope.correlation_id, Some(corr_id));
        assert_eq!(envelope.trace_id(), Some(corr_id));
        assert_eq!(envelope.payload, event);
    }
}
