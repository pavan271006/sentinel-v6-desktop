//! Formal 10-State Finding State Machine & Compile-Time Type-State Wrapper
//!
//! Enforces the linear, non-bypassable 10-state finding lifecycle:
//! [OBSERVED] -> [CANDIDATE] -> [REPRODUCIBLE] -> [VERIFIED] -> [INDEPENDENTLY_VERIFIED]
//! -> [PROMOTED] -> [DEDUPLICATED] -> [REPORTED] -> [RETESTED] -> [FIXED] | [STILL_PRESENT]
//!
//! Constraints:
//! 1. Zero state-skipping: No UI, CLI, or API may skip intermediate states.
//! 2. Zero production panics: Illegal transitions are rejected with typed errors and audit events.
//! 3. Type-State pattern: Compile-time state machine enforces verified dataflow.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::marker::PhantomData;
use uuid::Uuid;

use sentinel_common::enums::{FormalFindingState, Severity};
use sentinel_common::errors::SentinelError;
use crate::sec06_oracles::{OracleEvaluationResult, Sec06OracleType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingAuditEntry {
    pub transition_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub from_state: FormalFindingState,
    pub to_state: FormalFindingState,
    pub actor: String,
    pub rationale: String,
    pub evidence_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormalFindingRecordData {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub current_state: FormalFindingState,
    pub evidence_digest: String,
    pub verified_oracle: Option<Sec06OracleType>,
    pub oracle_rationale: Option<String>,
    pub audit_history: Vec<FindingAuditEntry>,
}

impl FormalFindingRecordData {
    pub fn new(id: Uuid, title: impl Into<String>, severity: Severity, evidence_digest: impl Into<String>) -> Self {
        Self {
            id,
            title: title.into(),
            description: String::new(),
            severity,
            current_state: FormalFindingState::Observed,
            evidence_digest: evidence_digest.into(),
            verified_oracle: None,
            oracle_rationale: None,
            audit_history: Vec::new(),
        }
    }

    /// Runtime linear state transition validation
    pub fn transition_to(
        &mut self,
        target: FormalFindingState,
        actor: &str,
        rationale: &str,
    ) -> Result<(), SentinelError> {
        let is_valid = match (self.current_state, target) {
            (FormalFindingState::Observed, FormalFindingState::Candidate) => true,
            (FormalFindingState::Candidate, FormalFindingState::Reproducible) => true,
            (FormalFindingState::Reproducible, FormalFindingState::Verified) => true,
            (FormalFindingState::Verified, FormalFindingState::IndependentlyVerified) => {
                // Must have registered oracle confirmation
                if self.verified_oracle.is_none() {
                    return Err(SentinelError::invalid_state_transition(
                        self.current_state.as_str(),
                        target.as_str(),
                        "Transition to INDEPENDENTLY_VERIFIED requires a registered SEC-06 oracle",
                    ));
                }
                true
            }
            (FormalFindingState::IndependentlyVerified, FormalFindingState::Promoted) => true,
            (FormalFindingState::Promoted, FormalFindingState::Deduplicated) => true,
            (FormalFindingState::Deduplicated, FormalFindingState::Reported) => true,
            (FormalFindingState::Reported, FormalFindingState::Retested) => true,
            (FormalFindingState::Retested, FormalFindingState::Fixed) => true,
            (FormalFindingState::Retested, FormalFindingState::StillPresent) => true,
            (FormalFindingState::Fixed, FormalFindingState::Closed) => true,
            (FormalFindingState::StillPresent, FormalFindingState::Reproducible) => true,
            _ => false,
        };

        if !is_valid {
            return Err(SentinelError::invalid_state_transition(
                self.current_state.as_str(),
                target.as_str(),
                format!(
                    "Illegal transition from {} to {} (violates linear lifecycle invariant)",
                    self.current_state.as_str(),
                    target.as_str()
                ),
            ));
        }

        let entry = FindingAuditEntry {
            transition_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            from_state: self.current_state,
            to_state: target,
            actor: actor.to_string(),
            rationale: rationale.to_string(),
            evidence_digest: self.evidence_digest.clone(),
        };

        self.audit_history.push(entry);
        self.current_state = target;
        Ok(())
    }

    /// Sets verified oracle details before transitioning to IndependentlyVerified
    pub fn attach_oracle_verification(&mut self, result: &OracleEvaluationResult) -> Result<(), SentinelError> {
        if !result.success {
            return Err(SentinelError::invariant_violation(format!(
                "Cannot attach failed oracle verification: {}",
                result.rationale
            )));
        }
        self.verified_oracle = Some(result.oracle_type);
        self.oracle_rationale = Some(result.rationale.clone());
        Ok(())
    }
}

// ============================================================================
// Compile-Time Type-State Wrapper
// ============================================================================

pub struct StateObserved;
pub struct StateCandidate;
pub struct StateReproducible;
pub struct StateVerified;
pub struct StateIndependentlyVerified;
pub struct StatePromoted;
pub struct StateDeduplicated;
pub struct StateReported;
pub struct StateRetested;
pub struct StateFixed;
pub struct StateStillPresent;
pub struct StateClosed;

pub struct TypedFindingRecord<State> {
    pub data: FormalFindingRecordData,
    _state: PhantomData<State>,
}

impl TypedFindingRecord<StateObserved> {
    pub fn observe(id: Uuid, title: impl Into<String>, severity: Severity, digest: impl Into<String>) -> Self {
        Self {
            data: FormalFindingRecordData::new(id, title, severity, digest),
            _state: PhantomData,
        }
    }

    pub fn into_candidate(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateCandidate>, SentinelError> {
        self.data.transition_to(FormalFindingState::Candidate, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateCandidate> {
    pub fn into_reproducible(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateReproducible>, SentinelError> {
        self.data.transition_to(FormalFindingState::Reproducible, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateReproducible> {
    pub fn into_verified(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateVerified>, SentinelError> {
        self.data.transition_to(FormalFindingState::Verified, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateVerified> {
    pub fn into_independently_verified(
        mut self,
        oracle_res: &OracleEvaluationResult,
        actor: &str,
    ) -> Result<TypedFindingRecord<StateIndependentlyVerified>, SentinelError> {
        self.data.attach_oracle_verification(oracle_res)?;
        self.data.transition_to(
            FormalFindingState::IndependentlyVerified,
            actor,
            &format!("Verified via oracle: {}", oracle_res.oracle_type.as_str()),
        )?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateIndependentlyVerified> {
    pub fn into_promoted(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StatePromoted>, SentinelError> {
        self.data.transition_to(FormalFindingState::Promoted, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StatePromoted> {
    pub fn into_deduplicated(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateDeduplicated>, SentinelError> {
        self.data.transition_to(FormalFindingState::Deduplicated, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateDeduplicated> {
    pub fn into_reported(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateReported>, SentinelError> {
        self.data.transition_to(FormalFindingState::Reported, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateReported> {
    pub fn into_retested(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateRetested>, SentinelError> {
        self.data.transition_to(FormalFindingState::Retested, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateRetested> {
    pub fn mark_fixed(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateFixed>, SentinelError> {
        self.data.transition_to(FormalFindingState::Fixed, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }

    pub fn mark_still_present(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateStillPresent>, SentinelError> {
        self.data.transition_to(FormalFindingState::StillPresent, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateFixed> {
    pub fn close(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateClosed>, SentinelError> {
        self.data.transition_to(FormalFindingState::Closed, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}

impl TypedFindingRecord<StateStillPresent> {
    pub fn reopen(mut self, actor: &str, rationale: &str) -> Result<TypedFindingRecord<StateReproducible>, SentinelError> {
        self.data.transition_to(FormalFindingState::Reproducible, actor, rationale)?;
        Ok(TypedFindingRecord {
            data: self.data,
            _state: PhantomData,
        })
    }
}
