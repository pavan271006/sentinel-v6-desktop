//! Risk Budget & Runaway Execution Guard (SEC-03)

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use sentinel_common::errors::SentinelError;

#[derive(Debug)]
pub struct RiskBudgetConfig {
    pub max_requests: u32,
    pub max_risk_score: u32,
}

impl Default for RiskBudgetConfig {
    fn default() -> Self {
        Self {
            max_requests: 100,
            max_risk_score: 500,
        }
    }
}

pub struct RiskBudgetTracker {
    config: RiskBudgetConfig,
    requests_used: Arc<AtomicU32>,
    risk_accumulated: Arc<AtomicU64>,
}

impl RiskBudgetTracker {
    pub fn new(config: RiskBudgetConfig) -> Self {
        Self {
            config,
            requests_used: Arc::new(AtomicU32::new(0)),
            risk_accumulated: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn consume_budget(&self, requests: u32, risk_score: u32) -> Result<(), SentinelError> {
        let current_req = self.requests_used.fetch_add(requests, Ordering::SeqCst) + requests;
        let current_risk = self
            .risk_accumulated
            .fetch_add(risk_score as u64, Ordering::SeqCst)
            + risk_score as u64;

        if current_req > self.config.max_requests {
            return Err(SentinelError::AiEngine(format!(
                "Agent risk budget exceeded: max requests {} reached",
                self.config.max_requests
            )));
        }

        if current_risk > self.config.max_risk_score as u64 {
            return Err(SentinelError::AiEngine(format!(
                "Agent risk budget exceeded: max risk score {} reached",
                self.config.max_risk_score
            )));
        }

        Ok(())
    }

    pub fn requests_count(&self) -> u32 {
        self.requests_used.load(Ordering::Relaxed)
    }

    pub fn risk_total(&self) -> u64 {
        self.risk_accumulated.load(Ordering::Relaxed)
    }
}
