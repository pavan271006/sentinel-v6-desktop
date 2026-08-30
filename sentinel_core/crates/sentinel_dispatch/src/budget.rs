//! Dispatch Budget & Rate Limiting Governor
//!
//! Provides strict request-count, risk-score, and time-duration bounding for all
//! dispatched HTTP probes, protecting targets from accidental DoS or budget overruns.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone)]
pub struct DispatchBudget {
    max_requests: u32,
    max_risk_score: u64,
    request_count: Arc<AtomicU32>,
    risk_accumulated: Arc<AtomicU64>,
    start_time: Instant,
    max_duration_secs: Option<u64>,
}

impl DispatchBudget {
    pub fn new(max_requests: u32, max_risk_score: u64) -> Self {
        Self {
            max_requests,
            max_risk_score,
            request_count: Arc::new(AtomicU32::new(0)),
            risk_accumulated: Arc::new(AtomicU64::new(0)),
            start_time: Instant::now(),
            max_duration_secs: None,
        }
    }

    pub fn with_max_duration(mut self, secs: u64) -> Self {
        self.max_duration_secs = Some(secs);
        self
    }

    pub fn unlimited() -> Self {
        Self::new(u32::MAX, u64::MAX)
    }

    /// Checks if budget allows an additional request with the given risk score weight.
    /// If allowed, atomically increments counters and returns Ok(()).
    pub fn consume(&self, risk_weight: u32) -> Result<(), SentinelError> {
        if let Some(max_dur) = self.max_duration_secs {
            if self.start_time.elapsed().as_secs() > max_dur {
                return Err(SentinelError::Timeout(format!(
                    "Dispatch budget duration expired after {}s",
                    max_dur
                )));
            }
        }

        let curr_req = self.request_count.fetch_add(1, Ordering::SeqCst);
        if curr_req >= self.max_requests {
            return Err(SentinelError::InvariantViolation(format!(
                "Dispatch request budget exceeded: {}/{} requests",
                curr_req + 1,
                self.max_requests
            )));
        }

        let curr_risk = self
            .risk_accumulated
            .fetch_add(risk_weight as u64, Ordering::SeqCst);
        if curr_risk + (risk_weight as u64) > self.max_risk_score {
            return Err(SentinelError::InvariantViolation(format!(
                "Dispatch risk budget exceeded: {}/{} risk score",
                curr_risk + (risk_weight as u64),
                self.max_risk_score
            )));
        }

        Ok(())
    }

    pub fn requests_dispatched(&self) -> u32 {
        self.request_count.load(Ordering::Relaxed)
    }

    pub fn risk_accumulated(&self) -> u64 {
        self.risk_accumulated.load(Ordering::Relaxed)
    }

    pub fn elapsed(&self) -> std::time::Duration {
        self.start_time.elapsed()
    }
}
