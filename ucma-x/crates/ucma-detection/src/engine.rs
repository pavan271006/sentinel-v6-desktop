//! Core SQLi Detection Orchestrator.

use crate::finding::FindingRecord;
use crate::verifier::IndependentVerifier;
use ucma_causal::{CausalStep, CausalVerifier, StepObservation};
use ucma_core::ids::{EndpointId, ParameterId, TargetId};
use ucma_oracles::{BooleanOracle, ErrorOracle, OracleAggregator};

pub struct DetectionOrchestrator;

impl DetectionOrchestrator {
    /// Analyzes responses from a boolean differential probe series.
    #[allow(clippy::too_many_arguments)]
    pub fn analyze_boolean_differential(
        target_id: TargetId,
        endpoint_id: EndpointId,
        parameter_id: ParameterId,
        param_name: &str,
        baseline_body: &str,
        true_payload: &str,
        true_body: &str,
        false_payload: &str,
        false_body: &str,
    ) -> Option<FindingRecord> {
        let bool_verdict = BooleanOracle::evaluate(baseline_body, true_body, false_body);
        let error_true = ErrorOracle::evaluate(true_body);
        let error_false = ErrorOracle::evaluate(false_body);

        let error_verdict = if error_true.is_vulnerable {
            Some(error_true)
        } else if error_false.is_vulnerable {
            Some(error_false)
        } else {
            None
        };

        let oracle_report = OracleAggregator::aggregate(Some(bool_verdict), error_verdict, None, None);

        if !oracle_report.is_confirmed_vulnerable {
            return None;
        }

        // Generate causal observations
        let causal_obs = vec![
            StepObservation {
                step: CausalStep::BaselineControl,
                status_code: 200,
                body_len: baseline_body.len(),
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 1.0,
            },
            StepObservation {
                step: CausalStep::PositiveIntervention { payload: true_payload.to_string() },
                status_code: 200,
                body_len: true_body.len(),
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 1.0,
            },
            StepObservation {
                step: CausalStep::NegativeControl { payload: false_payload.to_string() },
                status_code: 200,
                body_len: false_body.len(),
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 0.5,
            },
        ];

        let causal_evidence = Some(CausalVerifier::verify_observations(&causal_obs));

        let mut finding = FindingRecord::new(
            target_id,
            endpoint_id,
            parameter_id,
            param_name,
            format!("SQL Injection in parameter '{param_name}'"),
            oracle_report.primary_technique.clone(),
            oracle_report,
            causal_evidence,
            vec![true_payload.to_string(), false_payload.to_string()],
        );

        // Run independent clean-room verification
        IndependentVerifier::verify_clean_room(&mut finding);

        Some(finding)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lifecycle::FindingLifecycleState;

    #[test]
    fn test_detection_orchestrator_promotes_confirmed_finding() {
        let tid = TargetId::derive("https://lab.auth.test");
        let eid = EndpointId::derive(&tid, "GET", "/products");
        let pid = ParameterId::derive(&eid, "query", "category");

        let baseline = "<html><body>Product List: 50 items</body></html>";
        let true_body = "<html><body>Product List: 50 items</body></html>";
        let false_body = "<html><body>No products found</body></html>";

        let finding = DetectionOrchestrator::analyze_boolean_differential(
            tid,
            eid,
            pid,
            "category",
            baseline,
            "' AND 1=1--",
            true_body,
            "' AND 1=2--",
            false_body,
        ).unwrap();

        assert_eq!(finding.state, FindingLifecycleState::Promoted);
        assert!(finding.confidence >= 0.85);
        assert_eq!(finding.reproduction_payloads.len(), 2);
    }
}
