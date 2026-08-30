//! Finding Record Model and Evidence Provenance.

use crate::lifecycle::FindingLifecycleState;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ucma_causal::CausalEvidence;
use ucma_core::ids::{EndpointId, ParameterId, TargetId};
use ucma_oracles::AggregatedOracleReport;

/// A formally tracked SQL injection finding with complete audit trail.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingRecord {
    pub finding_id: String,
    pub target_id: TargetId,
    pub endpoint_id: EndpointId,
    pub parameter_id: ParameterId,
    pub parameter_name: String,
    pub title: String,
    pub state: FindingLifecycleState,
    pub confidence: f32,
    pub primary_technique: String,
    pub oracle_report: AggregatedOracleReport,
    pub causal_evidence: Option<CausalEvidence>,
    pub reproduction_payloads: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub content_hash: String,
}

impl FindingRecord {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        target_id: TargetId,
        endpoint_id: EndpointId,
        parameter_id: ParameterId,
        parameter_name: impl Into<String>,
        title: impl Into<String>,
        primary_technique: impl Into<String>,
        oracle_report: AggregatedOracleReport,
        causal_evidence: Option<CausalEvidence>,
        reproduction_payloads: Vec<String>,
    ) -> Self {
        let name_str = parameter_name.into();
        let title_str = title.into();
        let tech_str = primary_technique.into();
        let now = Utc::now();

        let raw_id_material = format!("{}:{}:{}", endpoint_id.as_str(), name_str, tech_str);
        let finding_id = format!("FINDING-{}", &blake3::hash(raw_id_material.as_bytes()).to_hex()[..16]);
        let content_hash = blake3::hash(format!("{}:{}:{}", finding_id, oracle_report.composite_confidence, now).as_bytes()).to_hex().to_string();

        Self {
            finding_id,
            target_id,
            endpoint_id,
            parameter_id,
            parameter_name: name_str,
            title: title_str,
            state: FindingLifecycleState::Observed,
            confidence: oracle_report.composite_confidence,
            primary_technique: tech_str,
            oracle_report,
            causal_evidence,
            reproduction_payloads,
            created_at: now,
            updated_at: now,
            content_hash,
        }
    }

    /// Advances the lifecycle state if the transition is allowed.
    pub fn advance_state(&mut self, next: FindingLifecycleState) -> Result<(), &'static str> {
        if self.state.can_transition_to(next) {
            self.state = next;
            self.updated_at = Utc::now();
            Ok(())
        } else {
            Err("Invalid lifecycle state transition")
        }
    }
}
