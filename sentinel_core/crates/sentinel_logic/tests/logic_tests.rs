//! Test Suite for Business Logic & Race Testing Subsystem

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use sentinel_logic::{RaceConditionProber, StateMachineEngine, WorkflowEngine};

#[test]
fn test_state_machine_transitions() {
    let mut sm = StateMachineEngine::new("Cart");
    sm.add_allowed_transition("Cart", "Checkout");
    sm.add_allowed_transition("Checkout", "Payment");
    sm.add_allowed_transition("Payment", "Confirmation");

    assert_eq!(sm.current_state(), "Cart");
    assert!(sm.transition("Checkout").is_ok());
    assert_eq!(sm.current_state(), "Checkout");

    // Illegal transition: bypass Payment straight to Confirmation
    assert!(sm.transition("Confirmation").is_err());
    assert_eq!(sm.current_state(), "Checkout");

    assert!(sm.transition("Payment").is_ok());
    assert!(sm.transition("Confirmation").is_ok());
    assert_eq!(sm.current_state(), "Confirmation");
}

#[tokio::test]
async fn test_barrier_synchronized_race_condition() {
    let counter = Arc::new(AtomicUsize::new(0));

    let counter_clone = counter.clone();
    let results = RaceConditionProber::execute_race_test(10, move |_idx| {
        let cnt = counter_clone.clone();
        async move { cnt.fetch_add(1, Ordering::SeqCst) }
    })
    .await
    .unwrap();

    assert_eq!(results.len(), 10);
    assert_eq!(counter.load(Ordering::SeqCst), 10);
}

#[test]
fn test_workflow_recording() {
    let mut wf = WorkflowEngine::new();
    let mut params = HashMap::new();
    params.insert("item_id".to_string(), "42".to_string());
    let _id = wf.record_step("AddCart", params);

    assert_eq!(wf.step_count(), 1);
    let exported = wf.export_workflow("ECommerce Flow").unwrap();
    assert_eq!(exported.name, "ECommerce Flow");
    assert!(exported.steps_json.contains("AddCart"));
}

#[test]
fn test_multi_actor_state_machine_and_invariants() {
    use sentinel_logic::{ActorRole, StateMachineEngine};

    let mut sm = StateMachineEngine::new("Draft").with_actor(ActorRole::User("alice".to_string()));

    // User can submit draft for review
    sm.add_guarded_transition(
        "Draft",
        "UnderReview",
        "SubmitForReview",
        vec![ActorRole::User("alice".to_string()), ActorRole::Admin],
    );

    // Only Admin can approve
    sm.add_guarded_transition(
        "UnderReview",
        "Approved",
        "ApproveContent",
        vec![ActorRole::Admin],
    );

    assert!(sm.transition("UnderReview").is_ok());

    // Alice cannot approve
    assert!(sm.transition("Approved").is_err());

    // Admin can approve
    sm.set_actor(ActorRole::Admin);
    assert!(sm.transition("Approved").is_ok());
    assert_eq!(sm.current_state(), "Approved");
}

#[test]
fn test_single_packet_race_harness_and_evaluation() {
    use sentinel_logic::RaceConditionProber;

    let frames = RaceConditionProber::prepare_h2_single_packet_batch("/api/v1/coupon/redeem", 20, "Bearer token123");
    assert_eq!(frames.len(), 20);
    assert_eq!(frames[0].stream_id, 1);
    assert_eq!(frames[1].stream_id, 3);

    // Evaluate race: only 1 coupon redemption should succeed (status 200)
    let mock_responses = vec![200, 200, 400, 400, 400]; // 2 successes -> race condition vulnerability
    let (is_vuln, success_count) = RaceConditionProber::evaluate_race_success(&mock_responses, &200, 1);
    assert!(is_vuln);
    assert_eq!(success_count, 2);
}

#[test]
fn test_workflow_step_skipping_and_parameter_mutations() {
    use sentinel_logic::WorkflowEngine;
    use std::collections::HashMap;

    let mut wf = WorkflowEngine::new();
    let mut p1 = HashMap::new();
    p1.insert("item".to_string(), "book".to_string());
    wf.record_step("AddToCart", p1);

    let mut p2 = HashMap::new();
    p2.insert("address".to_string(), "123 Main St".to_string());
    wf.record_step("EnterAddress", p2);

    let mut p3 = HashMap::new();
    p3.insert("amount".to_string(), "25.00".to_string());
    wf.record_step("ProcessPayment", p3);

    let mut p4 = HashMap::new();
    p4.insert("order_id".to_string(), "999".to_string());
    wf.record_step("ConfirmOrder", p4);

    let perms = wf.generate_step_skip_permutations();
    assert!(!perms.is_empty());
    // One permutation skips payment
    assert!(perms.iter().any(|p| p.skipped_action_type == Some("ProcessPayment".to_string())));
    // Direct jump
    assert!(perms.iter().any(|p| p.name == "DirectJumpToFinalStep"));

    // Business parameter mutations
    let mutations = WorkflowEngine::generate_business_parameter_mutations("price", "25.00");
    assert!(mutations.iter().any(|m| m.mutated_value == "-1"));
    assert!(mutations.iter().any(|m| m.mutated_value == "0"));
}

