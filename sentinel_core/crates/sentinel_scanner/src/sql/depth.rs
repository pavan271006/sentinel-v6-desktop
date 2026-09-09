//! SENTINEL Autonomous SQL Security Engine — Dynamic Depth Controller (M22)
//!
//! Controls progressive investigation descent across 11 depth tiers (D0..D10),
//! transitioning to deeper branches only when evidence thresholds justify request cost.

use crate::sql::models::{FindingStatus, InvestigationDepth};

pub struct DepthController;

impl DepthController {
    /// Determines whether the investigation should advance to the next depth tier
    pub fn evaluate_progression(
        current_depth: InvestigationDepth,
        status: FindingStatus,
        evidence_count: usize,
    ) -> (InvestigationDepth, bool) {
        match current_depth {
            InvestigationDepth::D0SurfaceDiscovery => {
                (InvestigationDepth::D1InputDiscovery, true)
            }
            InvestigationDepth::D1InputDiscovery => {
                (InvestigationDepth::D2BaselineProfile, true)
            }
            InvestigationDepth::D2BaselineProfile => {
                (InvestigationDepth::D3ContextDbmsInference, true)
            }
            InvestigationDepth::D3ContextDbmsInference => {
                (InvestigationDepth::D4InitialSqliDetection, true)
            }
            InvestigationDepth::D4InitialSqliDetection => {
                if status >= FindingStatus::Suspected || evidence_count > 0 {
                    (InvestigationDepth::D5CausalConfirmation, true)
                } else {
                    (InvestigationDepth::D4InitialSqliDetection, false)
                }
            }
            InvestigationDepth::D5CausalConfirmation => {
                if status >= FindingStatus::Confirmed {
                    (InvestigationDepth::D6DbmsContextSpecialization, true)
                } else {
                    (InvestigationDepth::D5CausalConfirmation, false)
                }
            }
            InvestigationDepth::D6DbmsContextSpecialization => {
                (InvestigationDepth::D7BlindInferential, true)
            }
            InvestigationDepth::D7BlindInferential => {
                (InvestigationDepth::D8WorkflowSecondOrder, true)
            }
            InvestigationDepth::D8WorkflowSecondOrder => {
                (InvestigationDepth::D9DemonstratedCapability, true)
            }
            InvestigationDepth::D9DemonstratedCapability => {
                (InvestigationDepth::D10FinalEvidenceClosure, true)
            }
            InvestigationDepth::D10FinalEvidenceClosure => {
                (InvestigationDepth::D10FinalEvidenceClosure, false)
            }
        }
    }
}
