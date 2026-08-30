//! SEC-06 Registered Oracles & Independent Verifier Tests (Phase 3 Gate)

use std::collections::HashMap;
use uuid::Uuid;
use sentinel_common::enums::FormalFindingState;
use sentinel_verification::formal_state_machine::FormalFindingRecordData;
use sentinel_verification::independent_verifier::IndependentVerifierWorker;
use sentinel_verification::sec06_oracles::{
    OracleEvaluationContext, Sec06OracleRegistry, Sec06OracleType,
};

#[test]
fn test_all_nine_sec06_oracles() {
    // 1. Authorization Differential Oracle
    let mut role_resps = HashMap::new();
    role_resps.insert("admin".to_string(), b"{\"admin_secret\": \"super_pass\"}".to_vec());
    role_resps.insert("user_b".to_string(), b"{\"admin_secret\": \"super_pass\"}".to_vec());
    let ctx_auth = OracleEvaluationContext {
        role_responses: role_resps,
        ..Default::default()
    };
    let res_auth = Sec06OracleRegistry::evaluate(Sec06OracleType::AuthorizationDifferential, &ctx_auth).unwrap();
    assert!(res_auth.success);
    assert_eq!(res_auth.confidence, 0.99);

    // 2. State Invariant Violation Oracle
    let ctx_state = OracleEvaluationContext {
        state_from: Some("UNAUTHENTICATED".to_string()),
        state_to: Some("ADMIN_SETTINGS".to_string()),
        allowed_transitions: vec![("UNAUTHENTICATED".to_string(), "LOGIN".to_string())],
        ..Default::default()
    };
    let res_state = Sec06OracleRegistry::evaluate(Sec06OracleType::StateInvariantViolation, &ctx_state).unwrap();
    assert!(res_state.success);

    // 3. OAST Callback Attestation Oracle
    let ctx_oast = OracleEvaluationContext {
        oast_token: Some("token_xyz_123".to_string()),
        oast_received_tokens: vec!["token_xyz_123".to_string()],
        ..Default::default()
    };
    let res_oast = Sec06OracleRegistry::evaluate(Sec06OracleType::OastCallbackAttestation, &ctx_oast).unwrap();
    assert!(res_oast.success);

    // 4. DOM Taint Reachability Oracle
    let ctx_dom = OracleEvaluationContext {
        raw_request: b"GET /?name=<script>alert(1)</script> HTTP/1.1".to_vec(),
        raw_response: b"HTTP/1.1 200 OK\r\n\r\n<div>Hello <script>alert(1)</script></div>".to_vec(),
        taint_source: Some("name".to_string()),
        taint_sink: Some("<script>".to_string()),
        ..Default::default()
    };
    let res_dom = Sec06OracleRegistry::evaluate(Sec06OracleType::DomTaintReachability, &ctx_dom).unwrap();
    assert!(res_dom.success);

    // 5. Protocol Framing Differential Oracle
    let ctx_framing = OracleEvaluationContext {
        control_response: Some(b"HTTP/1.1 200 OK\r\n\r\nNormal response".to_vec()),
        raw_response: b"HTTP/1.1 200 OK\r\n\r\nUnrecognized method GPOST in stream".to_vec(),
        ..Default::default()
    };
    let res_framing = Sec06OracleRegistry::evaluate(Sec06OracleType::ProtocolFramingDifferential, &ctx_framing).unwrap();
    assert!(res_framing.success);

    // 6. Database Side-Effect Mutation Oracle
    let ctx_db = OracleEvaluationContext {
        raw_response: b"{\"status\": \"ok\", \"affected_rows\": 1}".to_vec(),
        ..Default::default()
    };
    let res_db = Sec06OracleRegistry::evaluate(Sec06OracleType::DatabaseSideEffectMutation, &ctx_db).unwrap();
    assert!(res_db.success);

    // 7. Statistical Timing Analysis (Welch's t-test) Oracle
    let ctx_timing = OracleEvaluationContext {
        timing_samples_ms: vec![5010.0, 5020.0, 5015.0, 5025.0],
        control_timing_samples_ms: vec![15.0, 18.0, 14.0, 16.0],
        ..Default::default()
    };
    let res_timing = Sec06OracleRegistry::evaluate(Sec06OracleType::StatisticalTimingAnalysis, &ctx_timing).unwrap();
    assert!(res_timing.success);
    assert_eq!(res_timing.confidence, 0.999);

    // 8. Semantic Response Divergence (Jaccard similarity) Oracle
    let ctx_semantic = OracleEvaluationContext {
        control_response: Some(b"Welcome to our home page. Please log in to continue.".to_vec()),
        raw_response: b"Fatal Error 500: Database Connection Pool Exhausted. Stack trace line 42.".to_vec(),
        ..Default::default()
    };
    let res_semantic = Sec06OracleRegistry::evaluate(Sec06OracleType::SemanticResponseDivergence, &ctx_semantic).unwrap();
    assert!(res_semantic.success);

    // 9. Bit-Level Deterministic Replay Oracle
    let payload = b"EXACT_DETERMINISTIC_EVIDENCE_REPLAY_BYTES";
    let ctx_replay = OracleEvaluationContext {
        raw_response: payload.to_vec(),
        expected_bytes: Some(payload.to_vec()),
        ..Default::default()
    };
    let res_replay = Sec06OracleRegistry::evaluate(Sec06OracleType::BitLevelDeterministicReplay, &ctx_replay).unwrap();
    assert!(res_replay.success);
}

#[test]
fn test_sec06_rejection_when_no_oracle_provided() {
    let worker = IndependentVerifierWorker::new();
    let candidate_id = Uuid::new_v4();
    let ctx = OracleEvaluationContext::default();

    // SEC-06 constraint: Must reject finding when oracle_type is None
    let attestation = worker.verify_candidate_isolated(candidate_id, None, &ctx).unwrap();
    assert!(!attestation.is_verified);
    assert!(attestation.rationale.contains("SEC-06 REJECTION"));
    assert!(attestation.rationale.contains("No registered deterministic oracle"));
}

#[test]
fn test_independent_verifier_promotion_and_sarif_attestation() {
    let worker = IndependentVerifierWorker::new();
    let id = Uuid::new_v4();
    let mut finding = FormalFindingRecordData::new(id, "SQL Injection via Error Leakage", sentinel_common::enums::Severity::High, "sha256_sqli_evidence");

    finding.transition_to(FormalFindingState::Candidate, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Reproducible, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Verified, "detector", "").unwrap();

    let ctx = OracleEvaluationContext {
        raw_response: b"{\"error\": \"SQL syntax error near SELECT * FROM users\"}".to_vec(),
        ..Default::default()
    };

    let attestation = worker.verify_and_promote(
        &mut finding,
        Some(Sec06OracleType::DatabaseSideEffectMutation),
        &ctx,
        "independent_worker",
    ).unwrap();

    assert!(attestation.is_verified);
    assert_eq!(finding.current_state, FormalFindingState::Promoted);

    let sarif = worker.generate_sarif_attestation(&finding).unwrap();
    assert_eq!(sarif["version"], "2.1.0");
    assert_eq!(sarif["runs"][0]["results"][0]["ruleId"], "DatabaseSideEffectMutation");
}
