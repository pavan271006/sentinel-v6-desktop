//! SENTINEL Autonomous SQL Security Engine — 5-Step Causal Confirmation Gate (M27)
//!
//! Deterministic causal verification requiring 5 rigorous sequential proofs:
//! 1. Stable Baseline -> 2. Active Perturbation -> 3. Counterfactual Control ->
//! 4. Inversion Toggle -> 5. Independent Replication.

use crate::sql::models::FindingStatus;

#[derive(Debug, Clone)]
pub struct CausalVerificationResult {
    pub is_confirmed: bool,
    pub final_status: FindingStatus,
    pub step1_baseline_stable: bool,
    pub step2_active_perturbed: bool,
    pub step3_control_invariance: bool,
    pub step4_inversion_toggled: bool,
    pub step5_replicated: bool,
    pub causal_proof_summary: String,
}

pub struct CausalConfirmationGate;

impl CausalConfirmationGate {
    /// Evaluates the 5-step causal sequence to promote a candidate finding
    pub fn verify_causality(
        baseline_stable: bool,
        active_perturbed: bool,
        control_invariance: bool,
        inversion_toggled: bool,
        replicated: bool,
    ) -> CausalVerificationResult {
        let all_passed = baseline_stable
            && active_perturbed
            && control_invariance
            && inversion_toggled
            && replicated;

        let final_status = if all_passed {
            FindingStatus::Confirmed
        } else if active_perturbed && (control_invariance || inversion_toggled) {
            FindingStatus::Probable
        } else if active_perturbed {
            FindingStatus::Suspected
        } else {
            FindingStatus::Candidate
        };

        let summary = if all_passed {
            "5/5 Causal Verification steps passed: Active perturbation, Counterfactual control invariance, and Inversion toggle independently reproduced".to_string()
        } else {
            format!(
                "Incomplete causal proof: Step1={}, Step2={}, Step3={}, Step4={}, Step5={}",
                baseline_stable, active_perturbed, control_invariance, inversion_toggled, replicated
            )
        };

        CausalVerificationResult {
            is_confirmed: all_passed,
            final_status,
            step1_baseline_stable: baseline_stable,
            step2_active_perturbed: active_perturbed,
            step3_control_invariance: control_invariance,
            step4_inversion_toggled: inversion_toggled,
            step5_replicated: replicated,
            causal_proof_summary: summary,
        }
    }
}
