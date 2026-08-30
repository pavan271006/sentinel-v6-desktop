// crates/sentinel_bus/src/shutdown.rs
//
// Graceful Shutdown & Queue Flushing on termination or cancellation (SEC-12).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Notify;

use sentinel_common::SentinelError;

use crate::critical::CriticalDeliveryChannel;

/// Default shutdown flush timeout (5,000 milliseconds).
pub const DEFAULT_SHUTDOWN_TIMEOUT: Duration = Duration::from_millis(5_000);

/// Graceful shutdown controller managing cancellation signals and bounded queue flushes.
#[derive(Clone)]
pub struct GracefulShutdownController {
    is_shutdown_requested: Arc<AtomicBool>,
    shutdown_notify: Arc<Notify>,
}

impl GracefulShutdownController {
    /// Creates a new `GracefulShutdownController`.
    pub fn new() -> Self {
        Self {
            is_shutdown_requested: Arc::new(AtomicBool::new(false)),
            shutdown_notify: Arc::new(Notify::new()),
        }
    }

    /// Triggers the shutdown signal.
    pub fn trigger_shutdown(&self) {
        self.is_shutdown_requested.store(true, Ordering::SeqCst);
        self.shutdown_notify.notify_waiters();
    }

    /// Returns true if shutdown has been requested.
    pub fn is_shutting_down(&self) -> bool {
        self.is_shutdown_requested.load(Ordering::Relaxed)
    }

    /// Waits asynchronously for the shutdown signal to be triggered.
    pub async fn wait_for_shutdown(&self) {
        if self.is_shutting_down() {
            return;
        }
        self.shutdown_notify.notified().await;
    }

    /// Flushes all pending critical queues and shuts down the background persistence workers.
    pub async fn flush_and_shutdown(
        &self,
        critical: &CriticalDeliveryChannel,
        timeout: Duration,
    ) -> Result<(), SentinelError> {
        self.trigger_shutdown();
        critical.shutdown(timeout).await
    }
}

impl Default for GracefulShutdownController {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shutdown_trigger_and_notify() {
        let controller = GracefulShutdownController::new();
        assert!(!controller.is_shutting_down());

        let c_clone = controller.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(20)).await;
            c_clone.trigger_shutdown();
        });

        controller.wait_for_shutdown().await;
        assert!(controller.is_shutting_down());
    }
}
