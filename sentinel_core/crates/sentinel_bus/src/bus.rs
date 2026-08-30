// crates/sentinel_bus/src/bus.rs
//
// Dual-path EventBus implementing transient telemetry broadcast and durable critical event delivery.
// Strictly enforces SEC-12 (Bounded Buffer Backpressure) and Critical Event Durability.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc};

use sentinel_common::{CriticalEvent, EventBus, SentinelError, SentinelEvent};
use sentinel_storage::repository::AuditRepository;
use sentinel_storage::SqliteObservationStore;

use crate::broadcast::{TelemetryBroadcastChannel, DEFAULT_TELEMETRY_CAPACITY};
use crate::critical::{CriticalDeliveryChannel, DEFAULT_CRITICAL_CAPACITY};
use crate::envelope::EventEnvelope;
use crate::filter::{
    FilteredEnvelopedTelemetryReceiver, FilteredTelemetryReceiver, SubscriptionFilter,
};
use crate::shutdown::{GracefulShutdownController, DEFAULT_SHUTDOWN_TIMEOUT};

/// Configuration for channel capacities in the EventBus.
#[derive(Debug, Clone)]
pub struct EventBusConfig {
    /// Bounded capacity for the high-throughput telemetry broadcast ring buffer.
    pub telemetry_capacity: usize,
    /// Bounded capacity for the critical event delivery queue.
    pub critical_capacity: usize,
}

impl Default for EventBusConfig {
    fn default() -> Self {
        Self {
            telemetry_capacity: DEFAULT_TELEMETRY_CAPACITY,
            critical_capacity: DEFAULT_CRITICAL_CAPACITY,
        }
    }
}

/// Real-time metrics and counters for the event bus.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BusMetrics {
    pub total_telemetry_published: u64,
    pub total_critical_published: u64,
    pub telemetry_subscribers: usize,
    pub telemetry_capacity: usize,
    pub critical_capacity: usize,
}

struct EventBusInner {
    telemetry: TelemetryBroadcastChannel,
    critical: CriticalDeliveryChannel,
    shutdown: GracefulShutdownController,
    sequence_counter: AtomicU64,
    config: EventBusConfig,
}

/// The canonical Sentinel Two-Tier Event Bus.
#[derive(Clone)]
pub struct SentinelEventBus {
    inner: Arc<EventBusInner>,
}

/// Alias for `SentinelEventBus` ensuring 100% backward compatibility across all modules.
pub type ChannelEventBus = SentinelEventBus;

impl SentinelEventBus {
    /// Creates a new `SentinelEventBus` with in-memory durable logging.
    pub fn new(config: EventBusConfig) -> Self {
        let telemetry = TelemetryBroadcastChannel::new(config.telemetry_capacity);
        let critical = CriticalDeliveryChannel::new(config.critical_capacity, None);
        let shutdown = GracefulShutdownController::new();

        Self {
            inner: Arc::new(EventBusInner {
                telemetry,
                critical,
                shutdown,
                sequence_counter: AtomicU64::new(1),
                config,
            }),
        }
    }

    /// Creates a new `SentinelEventBus` backed by SQLite `AuditRepository` persistence.
    pub fn with_storage(config: EventBusConfig, audit_repo: AuditRepository) -> Self {
        let telemetry = TelemetryBroadcastChannel::new(config.telemetry_capacity);
        let critical = CriticalDeliveryChannel::new(config.critical_capacity, Some(audit_repo));
        let shutdown = GracefulShutdownController::new();

        Self {
            inner: Arc::new(EventBusInner {
                telemetry,
                critical,
                shutdown,
                sequence_counter: AtomicU64::new(1),
                config,
            }),
        }
    }

    /// Creates a new `SentinelEventBus` from an active `SqliteObservationStore`.
    pub fn with_observation_store(config: EventBusConfig, store: &SqliteObservationStore) -> Self {
        Self::with_storage(config, store.audit().clone())
    }

    /// Subscribes to framed `EventEnvelope<SentinelEvent>` messages.
    pub fn subscribe_enveloped_telemetry(
        &self,
    ) -> broadcast::Receiver<EventEnvelope<SentinelEvent>> {
        self.inner.telemetry.subscribe_enveloped()
    }

    /// Subscribes to telemetry events matching the provided `SubscriptionFilter`.
    pub fn subscribe_filtered_telemetry(
        &self,
        filter: SubscriptionFilter,
    ) -> FilteredTelemetryReceiver {
        self.inner.telemetry.subscribe_filtered(filter)
    }

    /// Subscribes to enveloped telemetry events matching the provided `SubscriptionFilter`.
    pub fn subscribe_filtered_enveloped(
        &self,
        filter: SubscriptionFilter,
    ) -> FilteredEnvelopedTelemetryReceiver {
        self.inner.telemetry.subscribe_filtered_enveloped(filter)
    }

    /// Publishes a telemetry envelope directly.
    pub fn publish_telemetry_envelope(
        &self,
        envelope: EventEnvelope<SentinelEvent>,
    ) -> Result<usize, SentinelError> {
        self.inner.telemetry.publish_envelope(envelope)
    }

    /// Asynchronously publishes a critical event with backpressure (awaits queue space).
    pub async fn publish_critical_async(&self, event: CriticalEvent) -> Result<(), SentinelError> {
        self.inner.critical.publish_async(event).await
    }

    /// Publishes a critical event and awaits confirmation of SQLite WAL persistence.
    pub async fn publish_critical_and_wait(
        &self,
        event: CriticalEvent,
    ) -> Result<(), SentinelError> {
        self.inner.critical.publish_and_wait(event).await
    }

    /// Replays all durable critical events recorded since bus startup.
    pub async fn replay_critical_events(&self) -> Vec<CriticalEvent> {
        self.inner.critical.replay_events().await
    }

    /// Replays all durable critical event envelopes recorded since bus startup.
    pub async fn replay_critical_envelopes(&self) -> Vec<EventEnvelope<CriticalEvent>> {
        self.inner.critical.replay_envelopes().await
    }

    /// Total count of dropped telemetry messages (0 in non-blocking mode; provided for metrics).
    pub fn dropped_telemetry(&self) -> u64 {
        0
    }

    /// Total number of published critical events.
    pub fn published_critical(&self) -> u64 {
        self.inner.critical.published_count()
    }

    /// Total number of published telemetry events.
    pub fn published_telemetry(&self) -> u64 {
        self.inner.telemetry.published_count()
    }

    /// Returns current bus metrics.
    pub fn metrics(&self) -> BusMetrics {
        BusMetrics {
            total_telemetry_published: self.published_telemetry(),
            total_critical_published: self.published_critical(),
            telemetry_subscribers: self.inner.telemetry.subscriber_count(),
            telemetry_capacity: self.inner.telemetry.capacity(),
            critical_capacity: self.inner.critical.capacity(),
        }
    }

    /// Returns the configuration used by this event bus instance.
    pub fn config(&self) -> &EventBusConfig {
        &self.inner.config
    }

    /// Accesses the graceful shutdown controller.
    pub fn shutdown_controller(&self) -> &GracefulShutdownController {
        &self.inner.shutdown
    }

    /// Initiates graceful shutdown, draining queues and terminating background workers.
    pub async fn shutdown(&self, timeout: Duration) -> Result<(), SentinelError> {
        self.inner
            .shutdown
            .flush_and_shutdown(&self.inner.critical, timeout)
            .await
    }

    /// Flushes all pending critical events in the queue with a default timeout.
    pub async fn flush(&self) -> Result<(), SentinelError> {
        self.inner.critical.flush(DEFAULT_SHUTDOWN_TIMEOUT).await
    }
}

impl Default for SentinelEventBus {
    fn default() -> Self {
        Self::new(EventBusConfig::default())
    }
}

#[async_trait::async_trait]
impl EventBus for SentinelEventBus {
    fn subscribe_telemetry(&self) -> broadcast::Receiver<SentinelEvent> {
        self.inner.telemetry.subscribe()
    }

    fn subscribe_critical(&self) -> mpsc::Receiver<CriticalEvent> {
        self.inner.critical.subscribe()
    }

    fn publish_telemetry(&self, event: SentinelEvent) -> Result<(), SentinelError> {
        let seq = self.inner.sequence_counter.fetch_add(1, Ordering::Relaxed);
        self.inner.telemetry.publish(event, seq)?;
        Ok(())
    }

    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError> {
        self.inner.critical.publish(event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_bus_telemetry_and_critical_dispatch() {
        let bus = SentinelEventBus::default();
        let mut tel_rx = bus.subscribe_telemetry();
        let mut crit_rx = bus.subscribe_critical();

        let obs_id = Uuid::new_v4();
        let find_id = Uuid::new_v4();

        bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id))
            .unwrap();
        bus.publish_critical(CriticalEvent::FindingCreated(find_id))
            .unwrap();

        let tel_ev = tel_rx.recv().await.unwrap();
        assert_eq!(tel_ev, SentinelEvent::ObservationCreated(obs_id));

        let crit_ev = crit_rx.recv().await.unwrap();
        assert_eq!(crit_ev, CriticalEvent::FindingCreated(find_id));

        assert_eq!(bus.published_telemetry(), 1);
        assert_eq!(bus.published_critical(), 1);
    }
}
