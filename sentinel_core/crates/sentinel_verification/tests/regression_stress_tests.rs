use uuid::Uuid;
use sha2::{Digest, Sha256};

use sentinel_common::enums::{FindingLifecycle, HttpMethod, VerificationStrategy};
use sentinel_verification::{
    RegressionGraphEngine, RegressionTestDefinition,
};

#[test]
fn test_full_regression_lifecycle_transitions() {
    let mut engine = RegressionGraphEngine::new();
    let finding_id = Uuid::new_v4();

    let test_def = RegressionTestDefinition::new(
        finding_id,
        "Auth Bypass in Admin Dashboard",
        "/admin/dashboard",
        HttpMethod::GET,
        "admin=true",
        VerificationStrategy::AuthorizationReplay,
    )
    .with_expected_status(403);

    let test_id = test_def.id;
    engine.register_test(test_def);

    // Initial state: Candidate
    engine.set_finding_state(finding_id, FindingLifecycle::Candidate);

    // 1. First retest with reproduced vulnerability: Candidate -> Verified
    let res1 = engine
        .execute_retest_evaluation(test_id, 200, b"<h1>Admin Dashboard</h1>", 30)
        .unwrap();
    assert_eq!(res1.previous_lifecycle, FindingLifecycle::Candidate);
    assert_eq!(res1.new_lifecycle, FindingLifecycle::Verified);
    assert!(res1.is_vulnerability_reproduced);
    assert!(!res1.is_regression);
    assert!(!res1.remediation_verified);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Verified);

    // 2. Second retest with reproduced vulnerability: Verified -> Confirmed
    let res2 = engine
        .execute_retest_evaluation(test_id, 200, b"<h1>Admin Dashboard</h1>", 30)
        .unwrap();
    assert_eq!(res2.previous_lifecycle, FindingLifecycle::Verified);
    assert_eq!(res2.new_lifecycle, FindingLifecycle::Confirmed);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Confirmed);

    // 3. Fix applied: Server returns 403 Forbidden -> Confirmed -> Remediated
    let res3 = engine
        .execute_retest_evaluation(test_id, 403, b"Forbidden", 20)
        .unwrap();
    assert_eq!(res3.previous_lifecycle, FindingLifecycle::Confirmed);
    assert_eq!(res3.new_lifecycle, FindingLifecycle::Remediated);
    assert!(!res3.is_vulnerability_reproduced);
    assert!(res3.remediation_verified);
    assert!(!res3.is_regression);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Remediated);

    // 4. Stable remediation test: Remediated -> Remediated
    let res4 = engine
        .execute_retest_evaluation(test_id, 403, b"Forbidden", 22)
        .unwrap();
    assert_eq!(res4.previous_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(res4.new_lifecycle, FindingLifecycle::Remediated);
    assert!(res4.remediation_verified);

    // 5. REGRESSION OCCURS: Vulnerability reproduced after remediation -> Remediated -> Regression
    let res5 = engine
        .execute_retest_evaluation(test_id, 200, b"<h1>Admin Dashboard</h1>", 30)
        .unwrap();
    assert_eq!(res5.previous_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(res5.new_lifecycle, FindingLifecycle::Regression);
    assert!(res5.is_vulnerability_reproduced);
    assert!(res5.is_regression);
    assert!(!res5.remediation_verified);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Regression);

    // 6. Fix reapplied: Server returns 403 -> Regression -> Remediated
    let res6 = engine
        .execute_retest_evaluation(test_id, 403, b"Forbidden", 20)
        .unwrap();
    assert_eq!(res6.previous_lifecycle, FindingLifecycle::Regression);
    assert_eq!(res6.new_lifecycle, FindingLifecycle::Remediated);
    assert!(res6.remediation_verified);
    assert!(!res6.is_regression);

    // 7. Verify complete audit trail history contains all 6 chronological entries
    let history = engine.get_history(&finding_id);
    assert_eq!(history.len(), 6);
    assert_eq!(history[0].result.new_lifecycle, FindingLifecycle::Verified);
    assert_eq!(history[1].result.new_lifecycle, FindingLifecycle::Confirmed);
    assert_eq!(history[2].result.new_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(history[3].result.new_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(history[4].result.new_lifecycle, FindingLifecycle::Regression);
    assert_eq!(history[5].result.new_lifecycle, FindingLifecycle::Remediated);
}

#[test]
fn test_timing_statistical_strategy_and_candidate_false_positive() {
    let mut engine = RegressionGraphEngine::new();
    let finding_id = Uuid::new_v4();

    let test_def = RegressionTestDefinition::new(
        finding_id,
        "Blind Time-Based SQLi in /search",
        "/search",
        HttpMethod::GET,
        "1' AND SLEEP(5)--",
        VerificationStrategy::TimingStatistical,
    );
    let test_id = test_def.id;
    engine.register_test(test_def);

    // Candidate fails reproduction on initial test -> FalsePositive
    engine.set_finding_state(finding_id, FindingLifecycle::Candidate);

    let res_fast = engine
        .execute_retest_evaluation(test_id, 200, b"OK", 120)
        .unwrap();
    assert_eq!(res_fast.previous_lifecycle, FindingLifecycle::Candidate);
    assert_eq!(res_fast.new_lifecycle, FindingLifecycle::FalsePositive);
    assert!(!res_fast.is_vulnerability_reproduced);

    // Confirmed finding tested with high latency (3000ms >= 2500ms threshold) -> Reproduced
    engine.set_finding_state(finding_id, FindingLifecycle::Confirmed);
    let res_slow = engine
        .execute_retest_evaluation(test_id, 200, b"OK", 3100)
        .unwrap();
    assert_eq!(res_slow.new_lifecycle, FindingLifecycle::Confirmed);
    assert!(res_slow.is_vulnerability_reproduced);
}

#[test]
fn test_cas_evidence_hash_cryptographic_fidelity() {
    let mut engine = RegressionGraphEngine::new();
    let finding_id = Uuid::new_v4();

    let test_def = RegressionTestDefinition::new(
        finding_id,
        "Reflected Payload Check",
        "/echo",
        HttpMethod::POST,
        "INJECTED-SENTINEL-PAYLOAD-99",
        VerificationStrategy::ContentVerification,
    );
    let test_id = test_def.id;
    engine.register_test(test_def);

    let body = b"Response containing INJECTED-SENTINEL-PAYLOAD-99 securely logged";
    let mut hasher = Sha256::new();
    hasher.update(body);
    let expected_sha256 = hex::encode(hasher.finalize());

    let res = engine.execute_retest_evaluation(test_id, 200, body, 15).unwrap();
    assert_eq!(res.retest_body_sha256, expected_sha256);
    assert_eq!(res.cas_evidence_hash, expected_sha256);
    assert!(res.is_vulnerability_reproduced);
}
