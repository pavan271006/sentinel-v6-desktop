//! Formal 10-State Finding State Machine Tests (Phase 3 Gate)

use uuid::Uuid;
use sentinel_common::enums::{FormalFindingState, Severity};
use sentinel_common::errors::SentinelError;
use sentinel_verification::formal_state_machine::{
    FormalFindingRecordData, TypedFindingRecord,
};
use sentinel_verification::sec06_oracles::{OracleEvaluationResult, Sec06OracleType};

#[test]
fn test_formal_10_state_linear_progression_success() {
    let id = Uuid::new_v4();
    let mut finding = FormalFindingRecordData::new(id, "Cross-Site Scripting in Search Query", Severity::High, "sha256_mock_evidence");

    assert_eq!(finding.current_state, FormalFindingState::Observed);

    // 1. Observed -> Candidate
    assert!(finding.transition_to(FormalFindingState::Candidate, "detector", "Candidate hypothesis discovered").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Candidate);

    // 2. Candidate -> Reproducible
    assert!(finding.transition_to(FormalFindingState::Reproducible, "detector", "Replayed successfully").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Reproducible);

    // 3. Reproducible -> Verified
    assert!(finding.transition_to(FormalFindingState::Verified, "detector", "Local verification passed").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Verified);

    // Attach registered oracle
    let oracle_res = OracleEvaluationResult {
        oracle_type: Sec06OracleType::DomTaintReachability,
        success: true,
        confidence: 0.98,
        rationale: "DOM source-to-sink reachability verified".to_string(),
        proof_hash: "mock_proof_hash_123".to_string(),
    };
    assert!(finding.attach_oracle_verification(&oracle_res).is_ok());

    // 4. Verified -> IndependentlyVerified
    assert!(finding.transition_to(FormalFindingState::IndependentlyVerified, "independent_verifier", "SEC-06 Oracle attached").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::IndependentlyVerified);

    // 5. IndependentlyVerified -> Promoted
    assert!(finding.transition_to(FormalFindingState::Promoted, "independent_verifier", "Promoted to workspace findings").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Promoted);

    // 6. Promoted -> Deduplicated
    assert!(finding.transition_to(FormalFindingState::Deduplicated, "deduplicator", "AST clustered uniquely").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Deduplicated);

    // 7. Deduplicated -> Reported
    assert!(finding.transition_to(FormalFindingState::Reported, "reporter", "SARIF report generated").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Reported);

    // 8. Reported -> Retested
    assert!(finding.transition_to(FormalFindingState::Retested, "regression_engine", "Automated retest executed").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Retested);

    // 9. Retested -> Fixed
    assert!(finding.transition_to(FormalFindingState::Fixed, "regression_engine", "Endpoint remediated").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Fixed);

    // 10. Fixed -> Closed
    assert!(finding.transition_to(FormalFindingState::Closed, "admin", "Finding resolved").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Closed);

    // Audit trail verification
    assert_eq!(finding.audit_history.len(), 10);
    assert_eq!(finding.audit_history[0].from_state, FormalFindingState::Observed);
    assert_eq!(finding.audit_history[9].to_state, FormalFindingState::Closed);
}

#[test]
fn test_retested_still_present_branch() {
    let id = Uuid::new_v4();
    let mut finding = FormalFindingRecordData::new(id, "BOLA Invariant Violation", Severity::Critical, "sha256_evidence");

    finding.transition_to(FormalFindingState::Candidate, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Reproducible, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Verified, "detector", "").unwrap();

    let oracle_res = OracleEvaluationResult {
        oracle_type: Sec06OracleType::AuthorizationDifferential,
        success: true,
        confidence: 0.99,
        rationale: "Cross-role bypass confirmed".to_string(),
        proof_hash: "proof".to_string(),
    };
    finding.attach_oracle_verification(&oracle_res).unwrap();
    finding.transition_to(FormalFindingState::IndependentlyVerified, "verifier", "").unwrap();
    finding.transition_to(FormalFindingState::Promoted, "verifier", "").unwrap();
    finding.transition_to(FormalFindingState::Deduplicated, "dedup", "").unwrap();
    finding.transition_to(FormalFindingState::Reported, "reporter", "").unwrap();
    finding.transition_to(FormalFindingState::Retested, "retest", "").unwrap();

    // Retested -> StillPresent
    assert!(finding.transition_to(FormalFindingState::StillPresent, "retest", "Vulnerability persists").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::StillPresent);

    // StillPresent -> Reopened (Reproducible)
    assert!(finding.transition_to(FormalFindingState::Reproducible, "retest", "Reopening for triage").is_ok());
    assert_eq!(finding.current_state, FormalFindingState::Reproducible);
}

#[test]
fn test_illegal_state_skipping_rejected_with_typed_error_zero_panics() {
    let id = Uuid::new_v4();
    let mut finding = FormalFindingRecordData::new(id, "Timing Flaw", Severity::Medium, "sha256_digest");

    // Attempt skipping Observed -> Promoted directly
    let res = finding.transition_to(FormalFindingState::Promoted, "attacker", "Bypass intermediate states");
    assert!(res.is_err());

    match res.unwrap_err() {
        SentinelError::InvalidStateTransition { from, to, reason } => {
            assert_eq!(from, "OBSERVED");
            assert_eq!(to, "PROMOTED");
            assert!(reason.contains("violates linear lifecycle invariant"));
        }
        err => panic!("Expected InvalidStateTransition error, got: {:?}", err),
    }

    // Attempt skipping Observed -> Closed
    let res2 = finding.transition_to(FormalFindingState::Closed, "attacker", "Direct close");
    assert!(matches!(res2, Err(SentinelError::InvalidStateTransition { .. })));

    // Ensure finding state was not corrupted
    assert_eq!(finding.current_state, FormalFindingState::Observed);
}

#[test]
fn test_transition_to_independently_verified_requires_oracle() {
    let id = Uuid::new_v4();
    let mut finding = FormalFindingRecordData::new(id, "Unverified Candidate", Severity::Low, "sha256_digest");

    finding.transition_to(FormalFindingState::Candidate, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Reproducible, "detector", "").unwrap();
    finding.transition_to(FormalFindingState::Verified, "detector", "").unwrap();

    // Attempt transitioning to IndependentlyVerified without attaching oracle
    let res = finding.transition_to(FormalFindingState::IndependentlyVerified, "detector", "AI agrees");
    assert!(res.is_err());

    match res.unwrap_err() {
        SentinelError::InvalidStateTransition { from, to, reason } => {
            assert_eq!(from, "VERIFIED");
            assert_eq!(to, "INDEPENDENTLY_VERIFIED");
            assert!(reason.contains("requires a registered SEC-06 oracle"));
        }
        err => panic!("Expected InvalidStateTransition error, got: {:?}", err),
    }
}

#[test]
fn test_compile_time_type_state_wrapper() {
    let id = Uuid::new_v4();
    let record = TypedFindingRecord::observe(id, "Compile-Time Verified Flaw", Severity::High, "sha256_hash");

    let candidate = record.into_candidate("detector", "Promoting to candidate").unwrap();
    let reproducible = candidate.into_reproducible("detector", "Reproduced").unwrap();
    let verified = reproducible.into_verified("detector", "Verified").unwrap();

    let oracle_res = OracleEvaluationResult {
        oracle_type: Sec06OracleType::BitLevelDeterministicReplay,
        success: true,
        confidence: 1.0,
        rationale: "Exact replay match".to_string(),
        proof_hash: "hash_123".to_string(),
    };

    let independently_verified = verified.into_independently_verified(&oracle_res, "verifier").unwrap();
    let promoted = independently_verified.into_promoted("verifier", "Promoted").unwrap();
    let deduplicated = promoted.into_deduplicated("dedup", "Deduplicated").unwrap();
    let reported = deduplicated.into_reported("reporter", "Reported").unwrap();
    let retested = reported.into_retested("retest", "Retested").unwrap();
    let fixed = retested.mark_fixed("retest", "Remediated").unwrap();
    let closed = fixed.close("admin", "Closed").unwrap();

    assert_eq!(closed.data.current_state, FormalFindingState::Closed);
    assert_eq!(closed.data.audit_history.len(), 10);
}
