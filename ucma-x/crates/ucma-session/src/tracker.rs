//! Session liveness and request telemetry tracking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ucma_core::ids::{SessionId, TargetId};

/// Tracks active session telemetry, request counts, and authentication health.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionTracker {
    pub session_id: SessionId,
    pub target_id: TargetId,
    pub last_activity: DateTime<Utc>,
    pub request_count: usize,
    pub error_count: usize,
    pub consecutive_auth_failures: usize,
    pub max_consecutive_auth_failures: usize,
}

impl SessionTracker {
    pub fn new(target_id: TargetId) -> Self {
        let session_id = SessionId::derive(&target_id, b"session_tracker_init");
        Self {
            session_id,
            target_id,
            last_activity: Utc::now(),
            request_count: 0,
            error_count: 0,
            consecutive_auth_failures: 0,
            max_consecutive_auth_failures: 3,
        }
    }

    /// Records a dispatched request.
    pub fn record_request(&mut self) {
        self.request_count += 1;
        self.last_activity = Utc::now();
    }

    /// Records a successful authenticated response.
    pub fn record_success(&mut self) {
        self.consecutive_auth_failures = 0;
        self.last_activity = Utc::now();
    }

    /// Records an authentication error (e.g. 401 Unauthorized / 403 Forbidden).
    ///
    /// Returns `true` if re-authentication is required.
    pub fn record_auth_failure(&mut self) -> bool {
        self.error_count += 1;
        self.consecutive_auth_failures += 1;
        self.last_activity = Utc::now();
        self.consecutive_auth_failures >= self.max_consecutive_auth_failures
    }

    /// True if the session has not exceeded consecutive auth failure limits.
    pub fn is_healthy(&self) -> bool {
        self.consecutive_auth_failures < self.max_consecutive_auth_failures
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_tracker_health() {
        let target_id = TargetId::derive("https://target.local");
        let mut tracker = SessionTracker::new(target_id);
        assert!(tracker.is_healthy());

        tracker.record_request();
        assert_eq!(tracker.request_count, 1);

        assert!(!tracker.record_auth_failure()); // 1 failure
        assert!(!tracker.record_auth_failure()); // 2 failures
        assert!(tracker.record_auth_failure()); // 3 failures -> needs reauth!
        assert!(!tracker.is_healthy());

        tracker.record_success();
        assert!(tracker.is_healthy());
    }
}
