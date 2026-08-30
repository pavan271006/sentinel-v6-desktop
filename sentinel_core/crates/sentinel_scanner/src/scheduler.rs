//! Scan Task Scheduler & Concurrency / Budget Controller

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::Semaphore;

use sentinel_common::config::ResourceBudget;

#[derive(Clone)]
pub struct ScanScheduler {
    budget: ResourceBudget,
    start_time: Instant,
    request_count: Arc<AtomicU64>,
    semaphore: Arc<Semaphore>,
}

impl ScanScheduler {
    pub fn new(budget: ResourceBudget, concurrency_limit: u32) -> Self {
        let concurrency = concurrency_limit.max(1) as usize;
        Self {
            budget,
            start_time: Instant::now(),
            request_count: Arc::new(AtomicU64::new(0)),
            semaphore: Arc::new(Semaphore::new(concurrency)),
        }
    }

    pub fn can_proceed(&self) -> bool {
        let current_reqs = self.request_count.load(Ordering::Relaxed);
        if self.budget.max_requests > 0 && current_reqs >= self.budget.max_requests {
            return false;
        }

        let elapsed = self.start_time.elapsed().as_secs();
        if self.budget.max_duration_secs > 0 && elapsed >= self.budget.max_duration_secs {
            return false;
        }

        true
    }

    pub fn record_request(&self) -> bool {
        if !self.can_proceed() {
            return false;
        }
        self.request_count.fetch_add(1, Ordering::Relaxed);
        true
    }

    pub fn semaphore(&self) -> Arc<Semaphore> {
        self.semaphore.clone()
    }

    pub fn requests_completed(&self) -> u64 {
        self.request_count.load(Ordering::Relaxed)
    }
}
