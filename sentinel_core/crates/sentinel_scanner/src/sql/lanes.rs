//! SENTINEL Autonomous SQL Security Engine — Isolated Execution Lanes (M14)
//!
//! Dedicated isolated single-threaded lanes for timing-sensitive (SPRT),
//! state-dependent, and workflow-sensitive investigations.

use std::sync::Arc;
use tokio::sync::Mutex;
use crate::sql::models::ExecutionClass;

pub struct IsolatedLaneScheduler {
    timing_lane_lock: Arc<Mutex<()>>,
    state_lane_lock: Arc<Mutex<()>>,
    workflow_lane_lock: Arc<Mutex<()>>,
}

impl IsolatedLaneScheduler {
    pub fn new() -> Self {
        Self {
            timing_lane_lock: Arc::new(Mutex::new(())),
            state_lane_lock: Arc::new(Mutex::new(())),
            workflow_lane_lock: Arc::new(Mutex::new(())),
        }
    }

    /// Acquires exclusive access to the dedicated execution lane
    pub async fn acquire_lane_guard(&self, exec_class: ExecutionClass) -> Option<tokio::sync::OwnedMutexGuard<()>> {
        match exec_class {
            ExecutionClass::TimingSensitive => {
                Some(self.timing_lane_lock.clone().lock_owned().await)
            }
            ExecutionClass::StateDependent | ExecutionClass::OrderDependent => {
                Some(self.state_lane_lock.clone().lock_owned().await)
            }
            ExecutionClass::WorkflowDependent | ExecutionClass::SessionSensitive => {
                Some(self.workflow_lane_lock.clone().lock_owned().await)
            }
            ExecutionClass::ParallelSafe => None,
        }
    }
}
