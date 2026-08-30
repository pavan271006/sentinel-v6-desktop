//! Finding Lifecycle State Machine

use sentinel_common::enums::FindingLifecycle;
use sentinel_common::errors::SentinelError;

pub struct FindingLifecycleManager;

impl FindingLifecycleManager {
    pub fn transition(
        current: FindingLifecycle,
        target: FindingLifecycle,
    ) -> Result<FindingLifecycle, SentinelError> {
        let is_valid = matches!(
            (current, target),
            (FindingLifecycle::Candidate, FindingLifecycle::Verified)
                | (FindingLifecycle::Candidate, FindingLifecycle::FalsePositive)
                | (FindingLifecycle::Verified, FindingLifecycle::Confirmed)
                | (FindingLifecycle::Verified, FindingLifecycle::FalsePositive)
                | (FindingLifecycle::Confirmed, FindingLifecycle::Reported)
                | (FindingLifecycle::Confirmed, FindingLifecycle::Remediated)
                | (FindingLifecycle::Reported, FindingLifecycle::Remediated)
                | (FindingLifecycle::Remediated, FindingLifecycle::Regression)
                | (FindingLifecycle::Regression, FindingLifecycle::Remediated)
                | (FindingLifecycle::Candidate, FindingLifecycle::AcceptedRisk)
                | (FindingLifecycle::Verified, FindingLifecycle::AcceptedRisk)
                | (FindingLifecycle::Confirmed, FindingLifecycle::AcceptedRisk)
        );

        if is_valid {
            Ok(target)
        } else {
            Err(SentinelError::InvariantViolation(format!(
                "Invalid finding lifecycle transition from {:?} to {:?}",
                current, target
            )))
        }
    }
}
