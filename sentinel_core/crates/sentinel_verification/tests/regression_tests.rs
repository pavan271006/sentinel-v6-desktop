use uuid::Uuid;

use sentinel_common::enums::{FindingLifecycle, HttpMethod, VerificationStrategy};
use sentinel_verification::{
    RegressionGraphEngine, RegressionTestDefinition,
};

#[test]
fn test_regression_state_machine_and_proof_retest() {
    let mut engine = RegressionGraphEngine::new();

    let finding_id = Uuid::new_v4();
    let test_def = RegressionTestDefinition::new(
        finding_id,
        "SQLi in /api/v1/search parameter 'q'",
        "/api/v1/search",
        HttpMethod::GET,
        "' OR '1'='1",
        VerificationStrategy::ErrorClassification,
    )
    .with_param("q")
    .with_expected_status(400);

    let test_id = test_def.id;
    engine.register_test(test_def);

    // 1. Initial State: Finding is Confirmed (Vulnerable)
    engine.set_finding_state(finding_id, FindingLifecycle::Confirmed);

    // 2. Developer submits fix -> Retest runs. Backend returns 400 Bad Request (Fixed)
    let fix_response_body = b"{\"error\": \"Invalid characters detected in parameter 'q'\"}";
    let fix_result = engine
        .execute_retest_evaluation(test_id, 400, fix_response_body, 25)
        .expect("Retest evaluation succeeds");

    assert_eq!(fix_result.previous_lifecycle, FindingLifecycle::Confirmed);
    assert_eq!(fix_result.new_lifecycle, FindingLifecycle::Remediated);
    assert!(fix_result.remediation_verified);
    assert!(!fix_result.is_regression);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Remediated);
    assert_eq!(fix_result.cas_evidence_hash.len(), 64); // SHA-256 CAS hash

    // 3. New release deployed with regression: Server returns SQL syntax error (Vulnerable reappears)
    let regressed_response_body = b"{\"error\": \"You have an error in your SQL syntax near '1=1' at line 1\"}";
    let regressed_result = engine
        .execute_retest_evaluation(test_id, 500, regressed_response_body, 35)
        .expect("Retest evaluation succeeds");

    assert_eq!(regressed_result.previous_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(regressed_result.new_lifecycle, FindingLifecycle::Regression);
    assert!(regressed_result.is_regression);
    assert!(regressed_result.is_vulnerability_reproduced);
    assert_eq!(engine.get_finding_state(&finding_id), FindingLifecycle::Regression);

    // 4. Verify audit history contains 2 entries
    let history = engine.get_history(&finding_id);
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].result.new_lifecycle, FindingLifecycle::Remediated);
    assert_eq!(history[1].result.new_lifecycle, FindingLifecycle::Regression);
}

#[test]
fn test_content_verification_negative_assertion() {
    let mut engine = RegressionGraphEngine::new();

    let finding_id = Uuid::new_v4();
    let test_def = RegressionTestDefinition::new(
        finding_id,
        "XSS in User Profile Name",
        "/profile",
        HttpMethod::GET,
        "<script>alert(1)</script>",
        VerificationStrategy::ContentVerification,
    )
    .with_negative_assertion("<script>alert\\(1\\)</script>");

    let test_id = test_def.id;
    engine.register_test(test_def);
    engine.set_finding_state(finding_id, FindingLifecycle::Remediated);

    // Sanitized output: HTML entities encoded
    let safe_body = b"<div>Hello &lt;script&gt;alert(1)&lt;/script&gt;</div>";
    let res = engine
        .execute_retest_evaluation(test_id, 200, safe_body, 15)
        .unwrap();

    assert_eq!(res.new_lifecycle, FindingLifecycle::Remediated);
    assert!(res.remediation_verified);
}
