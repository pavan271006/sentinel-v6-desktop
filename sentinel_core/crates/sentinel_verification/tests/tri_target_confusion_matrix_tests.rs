//! Tri-Target Confusion Matrix Tests (Phase 3 Gate)

use sentinel_verification::tri_target::TriTargetAuditHarness;

#[test]
fn test_tri_target_confusion_matrix_on_corpus() {
    let harness = TriTargetAuditHarness::new();
    let corpus = TriTargetAuditHarness::build_standard_test_corpus();

    assert_eq!(corpus.len(), 8);

    let report = harness.run_corpus_audit(&corpus).unwrap();

    // Verify exact expected metrics on controlled corpus
    assert_eq!(report.true_positives, 4, "All 4 seeded vulnerable cases must be detected and verified");
    assert_eq!(report.true_negatives, 4, "All 4 fixed and benign control cases must be confirmed clean");
    assert_eq!(report.false_positives, 0, "Zero false alarms on fixed or benign endpoints");
    assert_eq!(report.false_negatives, 0, "Zero missed vulnerabilities in tested corpus");

    assert!((report.precision - 1.0).abs() < 1e-6, "Precision must be 100% on tested corpus");
    assert!((report.recall - 1.0).abs() < 1e-6, "Recall must be 100% on tested corpus");
    assert!((report.verification_rate - 0.50).abs() < 1e-6, "4 of 8 candidates independently verified and promoted");

    println!("{}", report.summary);
}
