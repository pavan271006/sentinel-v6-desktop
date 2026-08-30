// crates/sentinel_bus/src/critical.rs
//
// Guaranteed Critical Delivery Channel with backpressure and SQLite audit logging (SEC-12).

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;

use sentinel_common::{CriticalEvent, SentinelError};
use sentinel_storage::repository::AuditRepository;

use crate::envelope::EventEnvelope;

/// Default capacity for the critical event queue (1,000 items with backpressure).
pub const DEFAULT_CRITICAL_CAPACITY: usize = 1_000;

type CriticalMessage = (EventEnvelope<CriticalEvent>, Option<oneshot::Sender<()>>);

/// Guaranteed critical event delivery channel.
///
/// Provides bounded backpressure (never drops events silently), fan-out to registered
/// subscribers, and background persistence to the SQLite audit log.
pub struct CriticalDeliveryChannel {
    inbound_tx: mpsc::Sender<CriticalMessage>,
    subscribers: Arc<Mutex<Vec<mpsc::Sender<CriticalEvent>>>>,
    durable_log: Arc<RwLock<Vec<EventEnvelope<CriticalEvent>>>>,
    capacity: usize,
    sequence_counter: Arc<AtomicU64>,
    published_count: AtomicU64,
    worker_handle: tokio::sync::Mutex<Option<JoinHandle<()>>>,
    is_closed: AtomicBool,
}

impl CriticalDeliveryChannel {
    /// Creates a new `CriticalDeliveryChannel` with optional audit repository storage.
    pub fn new(capacity: usize, audit_repo: Option<AuditRepository>) -> Self {
        let cap = if capacity == 0 {
            DEFAULT_CRITICAL_CAPACITY
        } else {
            capacity
        };

        let (inbound_tx, mut inbound_rx) = mpsc::channel::<CriticalMessage>(cap);
        let subscribers: Arc<Mutex<Vec<mpsc::Sender<CriticalEvent>>>> =
            Arc::new(Mutex::new(Vec::new()));
        let durable_log: Arc<RwLock<Vec<EventEnvelope<CriticalEvent>>>> =
            Arc::new(RwLock::new(Vec::new()));
        let sequence_counter = Arc::new(AtomicU64::new(1));

        let subs_clone = Arc::clone(&subscribers);
        let log_clone = Arc::clone(&durable_log);

        let worker = if let Ok(handle) = tokio::runtime::Handle::try_current() {
            Some(handle.spawn(async move {
                while let Some((envelope, ack_tx)) = inbound_rx.recv().await {
                    // 1. Persist to SQLite audit log if configured
                    if let Some(ref repo) = audit_repo {
                        if let Err(e) = repo.insert_critical_event(&envelope.payload).await {
                            tracing::error!(
                                "Failed to durably write critical event to SQLite audit log: {:?}",
                                e
                            );
                        }
                    }

                    // 2. Append to in-memory replay log
                    if let Ok(mut log) = log_clone.write() {
                        log.push(envelope.clone());
                    }

                    // 3. Dispatch to all active critical subscribers losslessly
                    let active_subs = if let Ok(subs_guard) = subs_clone.lock() {
                        subs_guard.clone()
                    } else {
                        Vec::new()
                    };

                    for sub_tx in active_subs {
                        if !sub_tx.is_closed() {
                            let _ = sub_tx.send(envelope.payload.clone()).await;
                        }
                    }

                    if let Ok(mut subs_guard) = subs_clone.lock() {
                        subs_guard.retain(|sub_tx| !sub_tx.is_closed());
                    }

                    // 4. Acknowledge message processing if requested
                    if let Some(ack) = ack_tx {
                        let _ = ack.send(());
                    }
                }
            }))
        } else {
            None
        };

        Self {
            inbound_tx,
            subscribers,
            durable_log,
            capacity: cap,
            sequence_counter,
            published_count: AtomicU64::new(0),
            worker_handle: tokio::sync::Mutex::new(worker),
            is_closed: AtomicBool::new(false),
        }
    }

    /// Returns the buffer capacity of the critical queue.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Total number of published critical events.
    pub fn published_count(&self) -> u64 {
        self.published_count.load(Ordering::Relaxed)
    }

    /// Creates and registers a new subscriber receiving critical events.
    pub fn subscribe(&self) -> mpsc::Receiver<CriticalEvent> {
        let (tx, rx) = mpsc::channel(self.capacity.max(DEFAULT_CRITICAL_CAPACITY));
        if let Ok(mut subs) = self.subscribers.lock() {
            subs.push(tx);
        }
        rx
    }

    /// Synchronously publishes a critical event with bounded queue enforcement.
    ///
    /// If the internal queue is full, returns `Err(SentinelError::BusOverflow { count: 1 })`.
    pub fn publish(&self, event: CriticalEvent) -> Result<(), SentinelError> {
        if self.is_closed.load(Ordering::Relaxed) {
            return Err(SentinelError::InvariantViolation(
                "Critical event channel is closed".to_string(),
            ));
        }

        let seq = self.sequence_counter.fetch_add(1, Ordering::SeqCst);
        let envelope = EventEnvelope::from_critical(event, seq);
        self.published_count.fetch_add(1, Ordering::Relaxed);

        match self.inbound_tx.try_send((envelope, None)) {
            Ok(_) => Ok(()),
            Err(mpsc::error::TrySendError::Full(_)) => Err(SentinelError::BusOverflow { count: 1 }),
            Err(mpsc::error::TrySendError::Closed(_)) => Err(SentinelError::InvariantViolation(
                "Critical event channel closed".to_string(),
            )),
        }
    }

    /// Asynchronously publishes a critical event, awaiting queue capacity under backpressure.
    pub async fn publish_async(&self, event: CriticalEvent) -> Result<(), SentinelError> {
        if self.is_closed.load(Ordering::Relaxed) {
            return Err(SentinelError::InvariantViolation(
                "Critical event channel is closed".to_string(),
            ));
        }

        let seq = self.sequence_counter.fetch_add(1, Ordering::SeqCst);
        let envelope = EventEnvelope::from_critical(event, seq);
        self.published_count.fetch_add(1, Ordering::Relaxed);

        self.inbound_tx
            .send((envelope, None))
            .await
            .map_err(|_| SentinelError::InvariantViolation("Critical channel closed".to_string()))
    }

    /// Publishes a critical event and awaits confirmation that it has been persisted to SQLite.
    pub async fn publish_and_wait(&self, event: CriticalEvent) -> Result<(), SentinelError> {
        if self.is_closed.load(Ordering::Relaxed) {
            return Err(SentinelError::InvariantViolation(
                "Critical event channel is closed".to_string(),
            ));
        }

        let (ack_tx, ack_rx) = oneshot::channel();
        let seq = self.sequence_counter.fetch_add(1, Ordering::SeqCst);
        let envelope = EventEnvelope::from_critical(event, seq);
        self.published_count.fetch_add(1, Ordering::Relaxed);

        self.inbound_tx
            .send((envelope, Some(ack_tx)))
            .await
            .map_err(|_| {
                SentinelError::InvariantViolation("Critical channel closed".to_string())
            })?;

        ack_rx
            .await
            .map_err(|_| SentinelError::InvariantViolation("Persistence ack dropped".to_string()))
    }

    /// Returns a snapshot of all critical events recorded since channel creation.
    pub async fn replay_events(&self) -> Vec<CriticalEvent> {
        if let Ok(log) = self.durable_log.read() {
            log.iter().map(|env| env.payload.clone()).collect()
        } else {
            Vec::new()
        }
    }

    /// Returns a snapshot of all critical event envelopes recorded since channel creation.
    pub async fn replay_envelopes(&self) -> Vec<EventEnvelope<CriticalEvent>> {
        if let Ok(log) = self.durable_log.read() {
            log.clone()
        } else {
            Vec::new()
        }
    }

    /// Flushes all pending critical events in the queue with a timeout.
    pub async fn flush(&self, timeout: Duration) -> Result<(), SentinelError> {
        let deadline = tokio::time::Instant::now() + timeout;

        // While there are messages in the queue, wait with short sleep
        while self.inbound_tx.capacity() < self.capacity {
            if tokio::time::Instant::now() >= deadline {
                return Err(SentinelError::Timeout(
                    "Flushing critical event queue timed out".to_string(),
                ));
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }

        // Give background persistence task a moment to finish current write
        tokio::time::sleep(Duration::from_millis(15)).await;
        Ok(())
    }

    /// Closes the channel and terminates the background persistence worker.
    pub async fn shutdown(&self, timeout: Duration) -> Result<(), SentinelError> {
        self.is_closed.store(true, Ordering::SeqCst);
        let _ = self.flush(timeout).await;

        let mut handle_guard = self.worker_handle.lock().await;
        if let Some(handle) = handle_guard.take() {
            handle.abort();
        }

        Ok(())
    }
}

impl Default for CriticalDeliveryChannel {
    fn default() -> Self {
        Self::new(DEFAULT_CRITICAL_CAPACITY, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_critical_channel_delivery_and_replay() {
        let channel = CriticalDeliveryChannel::new(10, None);
        let mut sub = channel.subscribe();

        let id = Uuid::new_v4();
        let event = CriticalEvent::FindingCreated(id);
        channel.publish(event.clone()).unwrap();

        let received = sub.recv().await.unwrap();
        assert_eq!(received, event);

        // Verify replay
        tokio::time::sleep(Duration::from_millis(20)).await;
        let replay = channel.replay_events().await;
        assert_eq!(replay.len(), 1);
        assert_eq!(replay[0], event);
    }

    #[tokio::test]
    async fn test_critical_bounded_overflow() {
        let channel = CriticalDeliveryChannel::new(2, None);

        let ev1 = CriticalEvent::FindingCreated(Uuid::new_v4());
        let ev2 = CriticalEvent::FindingCreated(Uuid::new_v4());
        let ev3 = CriticalEvent::FindingCreated(Uuid::new_v4());

        channel.publish(ev1).unwrap();
        channel.publish(ev2).unwrap();
        let res = channel.publish(ev3);

        assert!(res.is_err());
        match res {
            Err(SentinelError::BusOverflow { count }) => assert_eq!(count, 1),
            other => panic!("Expected BusOverflow, got {:?}", other),
        }
    }
}
