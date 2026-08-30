//! Request budget and safety ceiling tracker.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestBudget {
    pub max_requests_per_parameter: usize,
    pub max_total_requests: usize,
    pub requests_consumed: usize,
}

impl Default for RequestBudget {
    fn default() -> Self {
        Self {
            max_requests_per_parameter: 25,
            max_total_requests: 500,
            requests_consumed: 0,
        }
    }
}

impl RequestBudget {
    pub fn can_request(&self) -> bool {
        self.requests_consumed < self.max_total_requests
    }

    pub fn consume(&mut self) -> bool {
        if self.can_request() {
            self.requests_consumed += 1;
            true
        } else {
            false
        }
    }
}
