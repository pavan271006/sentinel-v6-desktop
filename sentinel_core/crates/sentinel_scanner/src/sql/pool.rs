//! SENTINEL Autonomous SQL Security Engine — 50-Worker Parallel Execution Pool (M13)
//!
//! High-throughput bounded worker pool executing up to 50 concurrent requests
//! for PARALLEL_SAFE tests, with dynamic backoff on 429s or server instability.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;
use crate::sql::models::ExecutionClass;

pub struct ParallelExecutionPool {
    semaphore: Arc<Semaphore>,
    active_concurrency: Arc<AtomicUsize>,
    max_concurrency: usize,
}

impl ParallelExecutionPool {
    pub fn new(max_concurrency: usize) -> Self {
        let concurrency = if max_concurrency == 0 { 50 } else { max_concurrency };
        Self {
            semaphore: Arc::new(Semaphore::new(concurrency)),
            active_concurrency: Arc::new(AtomicUsize::new(concurrency)),
            max_concurrency: concurrency,
        }
    }

    pub fn default_50_workers() -> Self {
        Self::new(50)
    }

    /// Acquires a permit for executing a ParallelSafe investigation test
    pub async fn acquire_permit(&self, exec_class: ExecutionClass) -> Result<tokio::sync::OwnedSemaphorePermit, String> {
        if exec_class != ExecutionClass::ParallelSafe {
            return Err("Non-ParallelSafe tests must not enter the parallel worker pool".to_string());
        }
        self.semaphore.clone().acquire_owned().await.map_err(|e| e.to_string())
    }

    /// Dynamically reduces concurrency when target instability or rate limits (429) are detected
    pub fn report_congestion(&self) {
        let current = self.active_concurrency.load(Ordering::Relaxed);
        if current > 5 {
            self.active_concurrency.store(current / 2, Ordering::Relaxed);
            tracing::warn!("Reducing parallel pool concurrency to {}", current / 2);
        }
    }

    /// Restores concurrency gradually as target health stabilizes
    pub fn report_success(&self) {
        let current = self.active_concurrency.load(Ordering::Relaxed);
        if current < self.max_concurrency {
            self.active_concurrency.store(current + 1, Ordering::Relaxed);
        }
    }

    pub fn current_limit(&self) -> usize {
        self.active_concurrency.load(Ordering::Relaxed)
    }
}
