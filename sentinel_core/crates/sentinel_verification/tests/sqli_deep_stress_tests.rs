//! Empirical Adversarial Stress Test Suite: SQLi Engine & Deep Injection
//!
//! Stress-tests:
//! 1. All 33 RDBMS Error Signatures across MySQL, PostgreSQL, Oracle, MSSQL, SQLite, DB2
//! 2. Case variations, noisy surrounding contexts, nested HTML/JSON, unicode text
//! 3. Negative controls (non-SQL errors, benign pages, JavaScript syntax errors)
//! 4. 3-round Boolean Oracle Inversion boundary conditions, similarity thresholds, and extreme payload sizes
//! 5. Jitter-compensated time-based blind injection under noisy network models
//! 6. UNION column count enumeration across wide ranges and error responses

use sentinel_verification::{
    SqliEngine, SqliTechnique, SQL_ERROR_SIGNATURES,
};

#[test]
fn stress_test_all_rdbms_error_signatures() {
    // Verify all 33 signatures match correctly in realistic noisy error pages
    for &(pattern, expected_engine) in SQL_ERROR_SIGNATURES {
        // Test 1: Exact match in upper/lower/mixed case
        let upper_body = format!("HTTP/1.1 500 INTERNAL SERVER ERROR\r\n\r\nFATAL DATABASE FAILURE: {}", pattern.to_uppercase());
        let res_upper = SqliEngine::evaluate_error_based(upper_body.as_bytes())
            .unwrap_or_else(|| panic!("Failed to match uppercase pattern: {}", pattern));
        assert_eq!(res_upper.database_engine, expected_engine);
        assert_eq!(res_upper.technique, SqliTechnique::ErrorBased);
        assert_eq!(res_upper.confidence, 0.99);

        // Test 2: Buried in deep HTML with surrounding noise and special characters
        let html_body = format!(
            "<!DOCTYPE html><html><head><title>500 Application Error</title></head><body><div class=\"stacktrace\"><p>Debug info: \u{26A0} [{}] at line 142 in QueryBuilder.php</p></div></body></html>",
            pattern
        );
        let res_html = SqliEngine::evaluate_error_based(html_body.as_bytes())
            .unwrap_or_else(|| panic!("Failed to match HTML-wrapped pattern: {}", pattern));
        assert_eq!(res_html.database_engine, expected_engine);

        // Test 3: Buried in JSON API error response
        let json_body = format!(
            "{{\"status\": 500, \"error\": \"Internal Server Error\", \"details\": {{\"sql_exception\": \"Database query failed with: {}\"}}}}",
            pattern
        );
        let res_json = SqliEngine::evaluate_error_based(json_body.as_bytes())
            .unwrap_or_else(|| panic!("Failed to match JSON-wrapped pattern: {}", pattern));
        assert_eq!(res_json.database_engine, expected_engine);
    }
}

#[test]
fn test_sqli_error_negative_controls() {
    let benign_responses = [
        b"<html><body>Welcome to our shopping portal! Browse 5000+ products.</body></html>".as_slice(),
        b"{\"status\": 404, \"error\": \"User not found in system\"}".as_slice(),
        b"{\"error\": \"Syntax error in JavaScript at line 42: unexpected token '}'\"}".as_slice(),
        b"<html><body>500 Internal Server Error: java.lang.NullPointerException in UserService.java:88</body></html>".as_slice(),
        b"SELECT * FROM products WHERE category = 'electronics'".as_slice(),
        b"".as_slice(),
    ];

    for (idx, resp) in benign_responses.iter().enumerate() {
        let result = SqliEngine::evaluate_error_based(resp);
        assert!(
            result.is_none(),
            "Negative control #{} triggered a false positive SQLi detection: {:?}",
            idx,
            result
        );
    }
}

#[test]
fn stress_test_boolean_oracle_inversion_matrix() {
    // 1. Nominal Vulnerable: True matches base (sim >= 0.90), False diverges in length (sim < 0.85), Inversion matches True (sim >= 0.90)
    let baseline = "<html><head><title>User Profile</title></head><body><h1>User: Alice</h1><p>Account ID: 10421</p><p>Status: Active</p><div class=\"footer\">&copy; 2026 Sentinel Corp.</div></body></html>";
    let true_probe = baseline;
    let false_probe = "<html><head><title>Error</title></head><body><h1>Not Found</h1></body></html>";
    let inv_probe = baseline;

    let res_nom = SqliEngine::evaluate_boolean_oracle(baseline, true_probe, false_probe, inv_probe);
    assert!(res_nom.is_some(), "Nominal boolean oracle with divergent false probe must succeed");
    let vuln_nom = res_nom.unwrap();
    assert!(vuln_nom.is_vulnerable);
    assert_eq!(vuln_nom.technique, SqliTechnique::BooleanBlindInversion);
    assert_eq!(vuln_nom.confidence, 0.95);

    // 2. Realistic Dynamic Jitter on 2KB standard page (e.g. timestamp or CSRF token varying by 20 bytes -> ~99% similarity)
    let base_2kb = format!("<html><head><title>Portal</title></head><body><h1>Profile</h1><div>{}</div></body></html>", "X".repeat(2000));
    let true_2kb = format!("<html><head><title>Portal</title></head><body><h1>Profile</h1><div>{}</div><span>ts=123</span></body></html>", "X".repeat(2000));
    let false_2kb = format!("<html><head><title>Portal</title></head><body><h1>Error: User Not Found</h1><div>{}</div></body></html>", "X".repeat(500));
    let inv_2kb = format!("<html><head><title>Portal</title></head><body><h1>Profile</h1><div>{}</div><span>ts=124</span></body></html>", "X".repeat(2000));

    let res_jitter = SqliEngine::evaluate_boolean_oracle(&base_2kb, &true_2kb, &false_2kb, &inv_2kb);
    assert!(res_jitter.is_some(), "Boolean oracle should tolerate minor page dynamic jitter within 10% tolerance");

    // 3. Oracle Inversion Sanity Failure: If Inverted True probe diverges from True probe (flaky page / rate limit / WAF), must NOT report SQLi
    let flaky_inv_probe = "<html><body>429 Too Many Requests</body></html>";
    let res_flaky = SqliEngine::evaluate_boolean_oracle(baseline, true_probe, false_probe, flaky_inv_probe);
    assert!(res_flaky.is_none(), "Sanity inversion failure must prevent false positive promotion");

    // 4. Uniform Response (Both True and False return the same page e.g. static site or unparameterized endpoint)
    let res_uniform = SqliEngine::evaluate_boolean_oracle(baseline, baseline, baseline, baseline);
    assert!(res_uniform.is_none(), "Uniform page responses must NOT be classified as boolean injectable");

    // 5. Extreme Boundary: Empty strings
    let res_empty = SqliEngine::evaluate_boolean_oracle("", "", "", "");
    assert!(res_empty.is_none(), "Empty strings must not trigger false positive");

    // 6. Large Page Stress (100KB HTML documents)
    let large_base = format!("<html><body>{}</body></html>", "A".repeat(100_000));
    let large_true = format!("<html><body>{}</body></html>", "A".repeat(100_000));
    let large_false_short = format!("<html><body>{}</body></html>", "B".repeat(20_000));
    let large_inv = format!("<html><body>{}</body></html>", "A".repeat(100_000));

    let res_large = SqliEngine::evaluate_boolean_oracle(&large_base, &large_true, &large_false_short, &large_inv);
    assert!(res_large.is_some(), "Large body boolean oracle analysis must complete without error");

    // 7. Behavioral characteristic verification: Equal-length different-content edge case
    // When false_probe has exact same length as baseline, length-based similarity returns 1.0 (>= 0.85)
    let same_len_false = "<html><head><title>User Invalid</title></head><body><h1>User: None!</h1><p>Account ID: 00000</p><p>Status: Inact </p><div class=\"footer\">&copy; 2026 Sentinel Corp.</div></body></html>";
    let res_same_len = SqliEngine::evaluate_boolean_oracle(baseline, true_probe, same_len_false, inv_probe);
    // Documenting that length-based similarity requires length divergence (< 0.85 ratio)
    assert!(res_same_len.is_none(), "Equal-length false probe is not classified as divergent under length-based similarity metric");
}

#[test]
fn stress_test_timing_blind_sqli_evaluator() {
    // 1. Genuine Time-based SQLi (5s trial takes ~5080ms, 7s trial takes ~7120ms with 30ms baseline)
    let res_vuln = SqliEngine::evaluate_timing_blind(30, 5080, 7120);
    assert!(res_vuln.is_some());
    let v = res_vuln.unwrap();
    assert_eq!(v.technique, SqliTechnique::TimeBasedBlind);
    assert_eq!(v.confidence, 0.96);

    // 2. High baseline latency (Baseline 2000ms, Trial 1 = 5000ms -> delay is only 3000ms < 4500ms threshold)
    let res_slow_baseline = SqliEngine::evaluate_timing_blind(2000, 5000, 7000);
    assert!(res_slow_baseline.is_none(), "Should reject timing when added delay is below threshold");

    // 3. Unstable timing: Trial 2 (7s) is NOT significantly longer than Trial 1 (5s) (e.g. random network spike on trial 1)
    let res_spike = SqliEngine::evaluate_timing_blind(50, 5200, 5300);
    assert!(res_spike.is_none(), "Must reject when 7s trial does not exceed 5s trial by > 1500ms");

    // 4. Zero timing / Instantaneous response
    let res_instant = SqliEngine::evaluate_timing_blind(20, 25, 30);
    assert!(res_instant.is_none());
}

#[test]
fn stress_test_union_column_enumeration() {
    // 1. Discovery at column 12 among 50 tested column permutations
    let mut trials = Vec::new();
    for col in 1..=50 {
        if col == 12 {
            trials.push((col, false, 200)); // Column count matches, query succeeds
        } else {
            trials.push((col, true, 500)); // Column count mismatch triggers DB error
        }
    }
    let res = SqliEngine::evaluate_union_columns(&trials).expect("Must discover 12 columns");
    assert_eq!(res.column_count, Some(12));
    assert_eq!(res.technique, SqliTechnique::UnionBased);

    // 2. Negative test: All column counts failed with 500 error
    let all_err: Vec<(usize, bool, u16)> = (1..=20).map(|c| (c, true, 500)).collect();
    assert!(SqliEngine::evaluate_union_columns(&all_err).is_none());

    // 3. Empty trial set
    assert!(SqliEngine::evaluate_union_columns(&[]).is_none());
}
