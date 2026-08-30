// crates/sentinel_bus/src/broadcast.rs
//
// Telemetry Broadcast Channel with high-throughput non-blocking fanout and lag dropping (SEC-12).

use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::broadcast;

use sentinel_common::{SentinelError, SentinelEvent};

use crate::envelope::EventEnvelope;
use crate::filter::{
    FilteredEnvelopedTelemetryReceiver, FilteredTelemetryReceiver, SubscriptionFilter,
};

/// Default capacity for the telemetry broadcast ring buffer (10,000 items as per Canonical Spec § 4).
pub const DEFAULT_TELEMETRY_CAPACITY: usize = 10_000;

/// High-throughput, non-blocking telemetry broadcast channel.
///
/// Ensures the network proxy and high-speed scanner are never blocked by slow UI consumers.
/// When a consumer lags beyond channel capacity, it receives `RecvError::Lagged(n)`.
pub struct TelemetryBroadcastChannel {
    tx: broadcast::Sender<SentinelEvent>,
    enveloped_tx: broadcast::Sender<EventEnvelope<SentinelEvent>>,
    capacity: usize,
    published_count: AtomicU64,
}

impl TelemetryBroadcastChannel {
    /// Creates a new `TelemetryBroadcastChannel` with the specified bounded capacity.
    pub fn new(capacity: usize) -> Self {
        let cap = if capacity == 0 {
            DEFAULT_TELEMETRY_CAPACITY
        } else {
            capacity
        };
        let (tx, _) = broadcast::channel(cap);
        let (enveloped_tx, _) = broadcast::channel(cap);

        Self {
            tx,
            enveloped_tx,
            capacity: cap,
            published_count: AtomicU64::new(0),
        }
    }

    /// Returns the buffer capacity of the broadcast channel.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Total number of telemetry events published.
    pub fn published_count(&self) -> u64 {
        self.published_count.load(Ordering::Relaxed)
    }

    /// Number of currently active raw telemetry subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.tx.receiver_count()
    }

    /// Number of currently active enveloped telemetry subscribers.
    pub fn enveloped_subscriber_count(&self) -> usize {
        self.enveloped_tx.receiver_count()
    }

    /// Subscribes to the raw `SentinelEvent` stream.
    pub fn subscribe(&self) -> broadcast::Receiver<SentinelEvent> {
        self.tx.subscribe()
    }

    /// Subscribes to the framed `EventEnvelope<SentinelEvent>` stream.
    pub fn subscribe_enveloped(&self) -> broadcast::Receiver<EventEnvelope<SentinelEvent>> {
        self.enveloped_tx.subscribe()
    }

    /// Subscribes to a filtered `SentinelEvent` stream matching the provided filter criteria.
    pub fn subscribe_filtered(&self, filter: SubscriptionFilter) -> FilteredTelemetryReceiver {
        FilteredTelemetryReceiver::new(self.subscribe(), filter)
    }

    /// Subscribes to a filtered `EventEnvelope<SentinelEvent>` stream.
    pub fn subscribe_filtered_enveloped(
        &self,
        filter: SubscriptionFilter,
    ) -> FilteredEnvelopedTelemetryReceiver {
        FilteredEnvelopedTelemetryReceiver::new(self.subscribe_enveloped(), filter)
    }

    /// Publishes a telemetry event non-blockingly across all active subscribers.
    ///
    /// Never blocks the caller regardless of consumer speed. If no subscribers exist,
    /// returns `Ok(0)` without error.
    pub fn publish(
        &self,
        event: SentinelEvent,
        sequence_number: u64,
    ) -> Result<usize, SentinelError> {
        self.published_count.fetch_add(1, Ordering::Relaxed);

        if self.enveloped_tx.receiver_count() > 0 {
            let env = EventEnvelope::from_telemetry(event.clone(), sequence_number);
            let _ = self.enveloped_tx.send(env);
        }

        let count = self.tx.send(event).unwrap_or_default();

        Ok(count)
    }

    /// Publishes an already framed `EventEnvelope<SentinelEvent>`.
    pub fn publish_envelope(
        &self,
        envelope: EventEnvelope<SentinelEvent>,
    ) -> Result<usize, SentinelError> {
        self.published_count.fetch_add(1, Ordering::Relaxed);

        if self.tx.receiver_count() > 0 {
            let _ = self.tx.send(envelope.payload.clone());
        }

        let count = self.enveloped_tx.send(envelope).unwrap_or_default();

        Ok(count)
    }
}

impl Default for TelemetryBroadcastChannel {
    fn default() -> Self {
        Self::new(DEFAULT_TELEMETRY_CAPACITY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_telemetry_broadcast_fanout() {
        let channel = TelemetryBroadcastChannel::new(32);
        let mut sub1 = channel.subscribe();
        let mut sub2 = channel.subscribe();

        let id = Uuid::new_v4();
        let event = SentinelEvent::ObservationCreated(id);
        channel.publish(event.clone(), 1).unwrap();

        let r1 = sub1.recv().await.unwrap();
        let r2 = sub2.recv().await.unwrap();
        assert_eq!(r1, event);
        assert_eq!(r2, event);
    }

    #[tokio::test]
    async fn test_telemetry_lag_drop_behavior() {
        let channel = TelemetryBroadcastChannel::new(4);
        let mut slow_sub = channel.subscribe();

        // Send 10 messages into capacity-4 channel
        for i in 0..10 {
            let event = SentinelEvent::ObservationCreated(Uuid::new_v4());
            channel.publish(event, i).unwrap();
        }

        // Slow consumer receives lagged error
        match slow_sub.recv().await {
            Err(broadcast::error::RecvError::Lagged(missed)) => {
                assert!(missed > 0);
            }
            other => panic!("Expected RecvError::Lagged, got {:?}", other),
        }
    }
}
