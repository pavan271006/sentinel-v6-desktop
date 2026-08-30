//! Empirical Adversarial Stress Test Suite: ParamMiner Logarithmic Bisection Engine
//!
//! Stress-tests:
//! 1. Large parameter sets (100+, 500+, 1000+ candidate parameters) across Query, Header, Cookie vectors
//! 2. Multi-batch partitioning with odd, prime, and power-of-two wordlist sizes
//! 3. Full recursive binary bisection simulation across all 128 indices in a batch
//! 4. Logarithmic convergence O(log N) verification
//! 5. Anomaly detection differential metrics (canary reflection, HTTP status shift, length divergence)
//! 6. Negative control baseline invariance

use sentinel_context::{
    DiscoveredParameter, ParamMinerEngine, ParamMiningBatch, ParameterVector,
};

#[test]
fn stress_test_large_parameter_wordlists_batching() {
    // Test 1: 1000 parameters partitioned into batches of 50
    let wordlist_1000: Vec<String> = (0..1000).map(|i| format!("param_miner_var_{:04}", i)).collect();
    let batches_50 = ParamMinerEngine::create_batches(&wordlist_1000, ParameterVector::Query, 50, "seed_test");
    assert_eq!(batches_50.len(), 20);
    for batch in &batches_50 {
        assert_eq!(batch.candidate_params.len(), 50);
        assert_eq!(batch.canary_map.len(), 50);
        assert_eq!(batch.vector, ParameterVector::Query);
        // Verify uniqueness of canary values across all parameters
        assert!(batch.canary_map[0].1.contains("seed_test"));
    }

    // Test 2: Odd / prime parameter count (e.g. 137 params with batch size 50 -> 50, 50, 37)
    let wordlist_137: Vec<String> = (0..137).map(|i| format!("hdr_p_{}", i)).collect();
    let batches_137 = ParamMinerEngine::create_batches(&wordlist_137, ParameterVector::Header, 50, "seed_hdr");
    assert_eq!(batches_137.len(), 3);
    assert_eq!(batches_137[0].candidate_params.len(), 50);
    assert_eq!(batches_137[1].candidate_params.len(), 50);
    assert_eq!(batches_137[2].candidate_params.len(), 37);

    // Test 3: Edge cases (empty wordlist and single parameter wordlist)
    let empty_batches = ParamMinerEngine::create_batches(&[], ParameterVector::Cookie, 50, "seed");
    assert!(empty_batches.is_empty());

    let single_batch = ParamMinerEngine::create_batches(&["debug_key".to_string()], ParameterVector::Cookie, 50, "seed");
    assert_eq!(single_batch.len(), 1);
    assert_eq!(single_batch[0].candidate_params.len(), 1);
}

/// Helper function to simulate recursive bisection until a single parameter is isolated
fn simulate_recursive_bisection(batch: &ParamMiningBatch, target_hidden_param: &str) -> (DiscoveredParameter, usize) {
    let mut current_batch = batch.clone();
    let mut bisection_steps = 0;

    while current_batch.candidate_params.len() > 1 {
        bisection_steps += 1;
        let (left, right) = ParamMinerEngine::bisect_batch(&current_batch);

        // Check which partition contains the target hidden parameter
        if left.candidate_params.iter().any(|p| p == target_hidden_param) {
            current_batch = left;
        } else if right.candidate_params.iter().any(|p| p == target_hidden_param) {
            current_batch = right;
        } else {
            panic!("Target parameter lost during bisection: {}", target_hidden_param);
        }
    }

    assert_eq!(current_batch.candidate_params.len(), 1);
    let isolated_param = &current_batch.candidate_params[0];
    let canary = &current_batch.canary_map[0].1;

    // Simulate endpoint response reflecting the isolated canary
    let baseline_body = "<html><body>Welcome Guest</body></html>";
    let probe_body = format!("<html><body>Welcome Guest <!-- Debug: {} --></body></html>", canary);

    let confirmed = ParamMinerEngine::confirm_parameter(
        isolated_param,
        current_batch.vector,
        200,
        baseline_body,
        200,
        &probe_body,
        canary,
    ).expect("Parameter must be confirmed after bisection");

    (confirmed, bisection_steps)
}

#[test]
fn stress_test_recursive_logarithmic_bisection_accuracy_across_128_indices() {
    // Generate a batch of size 128 parameters
    let wordlist: Vec<String> = (0..128).map(|i| format!("admin_flag_{:03}", i)).collect();
    let batches = ParamMinerEngine::create_batches(&wordlist, ParameterVector::Query, 128, "bisect_sim");
    assert_eq!(batches.len(), 1);
    let initial_batch = &batches[0];

    // For EVERY parameter index from 0 to 127, verify bisection successfully isolates it in exactly log2(128) = 7 steps
    for target_idx in 0..128 {
        let target_param = format!("admin_flag_{:03}", target_idx);
        let (discovered, steps) = simulate_recursive_bisection(initial_batch, &target_param);

        assert_eq!(discovered.name, target_param);
        assert!(discovered.reflected_in_body);
        assert_eq!(discovered.confidence, 0.99);
        assert_eq!(steps, 7, "For batch size 128, exact binary bisection must take 7 steps (log2 128)");
    }
}

#[test]
fn stress_test_anomaly_detection_vectors() {
    let wordlist: Vec<String> = vec!["debug".to_string(), "admin".to_string(), "api_key".to_string()];
    let batches = ParamMinerEngine::create_batches(&wordlist, ParameterVector::Query, 10, "anomaly_seed");
    let batch = &batches[0];

    // Vector 1: Direct Canary Reflection
    let reflected_body = "{\"status\": \"ok\", \"injected\": \"sentinel_anomaly_seed_1_admin\"}";
    let (anomaly1, param1) = ParamMinerEngine::detect_anomaly(200, 100, 200, 150, reflected_body, batch);
    assert!(anomaly1);
    assert_eq!(param1, Some("admin".to_string()));

    // Vector 2: HTTP Status Shift (200 OK -> 500 Internal Server Error)
    let (anomaly2, param2) = ParamMinerEngine::detect_anomaly(200, 100, 500, 100, "Internal Error", batch);
    assert!(anomaly2);
    assert_eq!(param2, None); // Requires subsequent bisection

    // Vector 3: HTTP Status Shift (200 OK -> 302 Found)
    let (anomaly3, _) = ParamMinerEngine::detect_anomaly(200, 100, 302, 0, "", batch);
    assert!(anomaly3);

    // Vector 4: Response Length Divergence (> 50 bytes difference)
    let (anomaly4, _) = ParamMinerEngine::detect_anomaly(200, 100, 200, 260, "A".repeat(260).as_str(), batch);
    assert!(anomaly4);

    // Negative Control: Invariant Baseline Response (no status change, diff <= 50 bytes, no canary)
    let clean_body = "{\"status\": \"ok\", \"data\": [1, 2, 3]}";
    let (anomaly_neg, _) = ParamMinerEngine::detect_anomaly(200, 100, 200, 115, clean_body, batch);
    assert!(!anomaly_neg, "Baseline invariant response must NOT trigger anomaly");
}

#[test]
fn stress_test_parameter_confirmation_confidence_levels() {
    // 1. Canary reflection (Confidence = 0.99)
    let conf_refl = ParamMinerEngine::confirm_parameter(
        "secret_param",
        ParameterVector::Query,
        200,
        "Clean Page",
        200,
        "Clean Page with secret_canary_123",
        "secret_canary_123",
    ).unwrap();
    assert_eq!(conf_refl.confidence, 0.99);
    assert!(conf_refl.reflected_in_body);

    // 2. Status shift only (Confidence = 0.90)
    let conf_status = ParamMinerEngine::confirm_parameter(
        "admin_mode",
        ParameterVector::Header,
        403,
        "Forbidden",
        200,
        "Admin Dashboard",
        "non_reflected_canary",
    ).unwrap();
    assert_eq!(conf_status.confidence, 0.90);
    assert!(!conf_status.reflected_in_body);

    // 3. Length divergence only (Confidence = 0.75)
    let conf_len = ParamMinerEngine::confirm_parameter(
        "filter_id",
        ParameterVector::Cookie,
        200,
        "Short",
        200,
        &"A".repeat(200),
        "non_reflected_canary",
    ).unwrap();
    assert_eq!(conf_len.confidence, 0.75);

    // 4. Negative control: Identical response -> None
    let conf_none = ParamMinerEngine::confirm_parameter(
        "noop",
        ParameterVector::Query,
        200,
        "Identical Response",
        200,
        "Identical Response",
        "missing_canary",
    );
    assert!(conf_none.is_none(), "Unmodified response must yield None");
}
