//! SENTINEL Autonomous SQL Security Engine — Investigation Graph (M19)
//!
//! Directed Acyclic Graph managing active branches, branch lifecycle states,
//! priority queues, pruning records, and dynamic branch revival.

use std::collections::HashMap;
use chrono::Utc;
use crate::sql::models::{Blake3Id, BranchStatus, InvestigationBranch, TestIntent};

pub struct InvestigationGraph {
    branches: HashMap<Blake3Id, InvestigationBranch>,
}

impl InvestigationGraph {
    pub fn new() -> Self {
        Self {
            branches: HashMap::new(),
        }
    }

    /// Adds a new investigation branch to the graph
    pub fn add_branch(&mut self, intent: TestIntent) -> Blake3Id {
        let branch_id = Blake3Id::random();
        let depth = intent.depth;
        let priority = intent.expected_information_gain / (intent.request_cost as f64).max(1.0);

        let branch = InvestigationBranch {
            branch_id,
            input_target_id: intent.input_target_id,
            intent,
            status: BranchStatus::Pending,
            depth,
            priority,
            retries: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pruning_reason: None,
        };

        self.branches.insert(branch_id, branch);
        branch_id
    }

    /// Selects the highest-priority pending branch for execution
    pub fn pop_next_pending(&mut self) -> Option<InvestigationBranch> {
        let mut best_id: Option<Blake3Id> = None;
        let mut best_priority = -1.0;

        for (id, branch) in &self.branches {
            if branch.status == BranchStatus::Pending && branch.priority > best_priority {
                best_priority = branch.priority;
                best_id = Some(*id);
            }
        }

        if let Some(id) = best_id {
            if let Some(branch) = self.branches.get_mut(&id) {
                branch.status = BranchStatus::Running;
                branch.updated_at = Utc::now();
                return Some(branch.clone());
            }
        }

        None
    }

    /// Updates the status of an investigation branch
    pub fn update_status(&mut self, branch_id: &Blake3Id, new_status: BranchStatus) {
        if let Some(b) = self.branches.get_mut(branch_id) {
            b.status = new_status;
            b.updated_at = Utc::now();
        }
    }

    /// Prunes a branch with an explicit reason
    pub fn prune_branch(&mut self, branch_id: &Blake3Id, reason: String) {
        if let Some(b) = self.branches.get_mut(branch_id) {
            b.status = BranchStatus::NotApplicable;
            b.pruning_reason = Some(reason);
            b.updated_at = Utc::now();
        }
    }

    /// Revives previously blocked/inconclusive branches when new knowledge is discovered
    pub fn revive_branches_for_target(&mut self, target_id: &Blake3Id) -> usize {
        let mut revived = 0;
        for b in self.branches.values_mut() {
            if &b.input_target_id == target_id && (b.status == BranchStatus::Blocked || b.status == BranchStatus::Inconclusive) {
                b.status = BranchStatus::Pending;
                b.updated_at = Utc::now();
                revived += 1;
            }
        }
        revived
    }

    pub fn total_branches(&self) -> usize {
        self.branches.len()
    }
}
