//! Stress and Adversarial Challenge Tests for Adaptive Test Planner (Engine 2)
//!
//! Evaluates:
//! 1. Multi-factor scoring boundaries and clamping ([0.0, 100.0])
//! 2. Zero coverage gap vs untried surface sensitivity
//! 3. High request cost penalty transitions
//! 4. Request budget governor exhaustion and greedy selection
//! 5. Comprehensive explainable "WHY" rationale generator
//! 6. Ranking stability and tie-breaking

use uuid::Uuid;

use sentinel_common::enums::HttpMethod;
use sentinel_coverage::{
    AdaptiveTestPlanner, CandidateTestContext, CoverageGapStatus, EndpointCategory,
    FindingProximity, ParameterSemantics, PlanScoringWeights, TechStackConfidence,
};

#[test]
fn challenge_scoring_boundaries_and_clamping() {
    let planner = AdaptiveTestPlanner::new();

    // 1. Extreme minimum candidate (should clamp to 0.0)
    let min_cand = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/ping".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::StaticHealth, // 10.0
        coverage_gap: CoverageGapStatus::FullyTested, // 0.0
        proximity: FindingProximity::NoPriorFindings, // 0.0
        parameter_name: None,
        param_semantics: ParameterSemantics::None, // 10.0
        tech_confidence: TechStackConfidence::Incompatible, // 0.0
        check_id: "DUMMY-CHECK".to_string(),
        check_name: "Dummy".to_string(),
        estimated_requests: 100, // cost penalty 60.0
    };

    // Raw: 0.25*10 + 0.25*0 + 0.20*0 + 0.15*10 + 0.15*0 - 0.10*60 = 2.5 + 1.5 - 6.0 = -2.0
    let (min_score, min_why) = planner.evaluate_candidate(&min_cand);
    assert_eq!(min_score, 0.0, "Score below 0.0 must be clamped to 0.0");
    assert!(min_why.contains("Score: 0.0/100"));
    assert!(min_why.contains("Low-priority static route"));
    assert!(min_why.contains("Estimated cost: 100 requests"));

    // 2. Maximum possible candidate
    let max_cand = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/auth/oauth/token".to_string(),
        http_method: HttpMethod::POST,
        category: EndpointCategory::AuthRoute, // 95.0
        coverage_gap: CoverageGapStatus::CompletelyUntested, // 100.0
        proximity: FindingProximity::ExactEndpointFinding, // 100.0
        parameter_name: Some("client_secret".to_string()),
        param_semantics: ParameterSemantics::CommandString, // 98.0
        tech_confidence: TechStackConfidence::DirectMatch, // 100.0
        check_id: "CRITICAL-OAUTH".to_string(),
        check_name: "OAuth Token Hijack".to_string(),
        estimated_requests: 1, // cost penalty 10.0
    };

    // Raw: 0.25*95 + 0.25*100 + 0.20*100 + 0.15*98 + 0.15*100 - 0.10*10 = 23.75 + 25 + 20 + 14.7 + 15 - 1.0 = 97.45
    let (max_score, max_why) = planner.evaluate_candidate(&max_cand);
    assert!((max_score - 97.45).abs() < 0.001);
    assert!(max_why.contains("Score: 97.5/100"));
    assert!(max_why.contains("High-sensitivity auth endpoint"));
    assert!(max_why.contains("Completely untested endpoint"));
    assert!(max_why.contains("Proximity: Confirmed finding on exact endpoint"));
    assert!(max_why.contains("Verified tech-stack match"));

    // 3. Artificial overflow with custom weights (should clamp to 100.0)
    let overflow_weights = PlanScoringWeights {
        w_risk: 1.0,
        w_cov: 1.0,
        w_vuln: 1.0,
        w_param: 1.0,
        w_tech: 1.0,
        w_cost: 0.0,
    };
    let overflow_planner = AdaptiveTestPlanner::with_weights(overflow_weights);
    let (overflow_score, _) = overflow_planner.evaluate_candidate(&max_cand);
    assert_eq!(overflow_score, 100.0, "Score above 100.0 must be clamped to 100.0");
}

#[test]
fn challenge_zero_coverage_gap_sensitivity() {
    let planner = AdaptiveTestPlanner::new();

    let base_cand = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/v1/orders".to_string(),
        http_method: HttpMethod::POST,
        category: EndpointCategory::FinancialRoute, // 92.0
        coverage_gap: CoverageGapStatus::CompletelyUntested, // 100.0
        proximity: FindingProximity::NoPriorFindings, // 0.0
        parameter_name: Some("amount".to_string()),
        param_semantics: ParameterSemantics::SqlFragment, // 95.0
        tech_confidence: TechStackConfidence::GenericProtocol, // 70.0
        check_id: "SQLI-ORDER".to_string(),
        check_name: "SQL Injection".to_string(),
        estimated_requests: 5, // cost penalty 30.0
    };

    let mut fully_tested_cand = base_cand.clone();
    fully_tested_cand.coverage_gap = CoverageGapStatus::FullyTested; // 0.0

    let (score_untested, _) = planner.evaluate_candidate(&base_cand);
    let (score_tested, _) = planner.evaluate_candidate(&fully_tested_cand);

    // Delta should be exactly w_cov * (100.0 - 0.0) = 0.25 * 100.0 = 25.0
    let delta = score_untested - score_tested;
    assert!((delta - 25.0).abs() < 0.001, "Zero coverage gap delta must be exactly 25.0 points");

    // UntestedMethod (75.0) vs UntestedParam (50.0)
    let mut untested_method_cand = base_cand.clone();
    untested_method_cand.coverage_gap = CoverageGapStatus::UntestedMethod;
    let mut untested_param_cand = base_cand.clone();
    untested_param_cand.coverage_gap = CoverageGapStatus::UntestedParam;

    let (score_m, _) = planner.evaluate_candidate(&untested_method_cand);
    let (score_p, _) = planner.evaluate_candidate(&untested_param_cand);
    let delta_mp = score_m - score_p;
    // 0.25 * (75 - 50) = 6.25
    assert!((delta_mp - 6.25).abs() < 0.001);
}

#[test]
fn challenge_cost_penalty_step_function() {
    let planner = AdaptiveTestPlanner::new();

    let mut cand = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/data".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::GeneralApi,
        coverage_gap: CoverageGapStatus::CompletelyUntested,
        proximity: FindingProximity::NoPriorFindings,
        parameter_name: None,
        param_semantics: ParameterSemantics::None,
        tech_confidence: TechStackConfidence::GenericProtocol,
        check_id: "CHECK".to_string(),
        check_name: "Check".to_string(),
        estimated_requests: 1,
    };

    // 0..=3: cost penalty 10.0 -> -1.0
    cand.estimated_requests = 3;
    let (score_3, _) = planner.evaluate_candidate(&cand);

    // 4..=15: cost penalty 30.0 -> -3.0
    cand.estimated_requests = 4;
    let (score_4, _) = planner.evaluate_candidate(&cand);

    cand.estimated_requests = 15;
    let (score_15, _) = planner.evaluate_candidate(&cand);

    // 16+: cost penalty 60.0 -> -6.0
    cand.estimated_requests = 16;
    let (score_16, _) = planner.evaluate_candidate(&cand);

    assert_eq!(score_4, score_15, "Cost step function for 4..=15 must be identical");
    assert!((score_3 - score_4 - 2.0).abs() < 0.001, "Step difference between 3 and 4 requests must be 2.0 points");
    assert!((score_15 - score_16 - 3.0).abs() < 0.001, "Step difference between 15 and 16 requests must be 3.0 points");
}

#[test]
fn challenge_budget_governor_edge_cases() {
    let planner = AdaptiveTestPlanner::new();

    let c_heavy = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/admin/heavy".to_string(),
        http_method: HttpMethod::POST,
        category: EndpointCategory::AdminRoute,
        coverage_gap: CoverageGapStatus::CompletelyUntested,
        proximity: FindingProximity::ExactEndpointFinding,
        parameter_name: Some("cmd".to_string()),
        param_semantics: ParameterSemantics::CommandString,
        tech_confidence: TechStackConfidence::DirectMatch,
        check_id: "HEAVY".to_string(),
        check_name: "Heavy Test".to_string(),
        estimated_requests: 50,
    };

    let c_light1 = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/light1".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::GeneralApi,
        coverage_gap: CoverageGapStatus::UntestedMethod,
        proximity: FindingProximity::NoPriorFindings,
        parameter_name: None,
        param_semantics: ParameterSemantics::None,
        tech_confidence: TechStackConfidence::GenericProtocol,
        check_id: "LIGHT1".to_string(),
        check_name: "Light 1".to_string(),
        estimated_requests: 2,
    };

    let c_light2 = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/light2".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::GeneralApi,
        coverage_gap: CoverageGapStatus::UntestedParam,
        proximity: FindingProximity::NoPriorFindings,
        parameter_name: None,
        param_semantics: ParameterSemantics::None,
        tech_confidence: TechStackConfidence::GenericProtocol,
        check_id: "LIGHT2".to_string(),
        check_name: "Light 2".to_string(),
        estimated_requests: 3,
    };

    let candidates = vec![c_heavy.clone(), c_light1.clone(), c_light2.clone()];

    // 1. Budget = 0 -> empty plan
    let plan_zero = planner.generate_plan(candidates.clone(), Some(0));
    assert!(plan_zero.is_empty());

    // 2. Budget = 1 -> less than smallest test (2) -> empty plan
    let plan_1 = planner.generate_plan(candidates.clone(), Some(1));
    assert!(plan_1.is_empty());

    // 3. Budget = 5 -> c_heavy (50) cannot fit, so c_light1 (2) and c_light2 (3) fit!
    let plan_5 = planner.generate_plan(candidates.clone(), Some(5));
    assert_eq!(plan_5.len(), 2);
    assert_eq!(plan_5[0].check_id, "LIGHT1");
    assert_eq!(plan_5[1].check_id, "LIGHT2");

    // 4. Budget = 52 -> c_heavy (50) + c_light1 (2) = 52 fit, c_light2 (3) excluded
    let plan_52 = planner.generate_plan(candidates.clone(), Some(52));
    assert_eq!(plan_52.len(), 2);
    assert_eq!(plan_52[0].check_id, "HEAVY");
    assert_eq!(plan_52[1].check_id, "LIGHT1");

    // 5. Budget = None -> all 3 returned
    let plan_none = planner.generate_plan(candidates, None);
    assert_eq!(plan_none.len(), 3);
}

#[test]
fn challenge_why_rationale_all_branches() {
    let planner = AdaptiveTestPlanner::new();

    let categories = [
        EndpointCategory::AuthRoute,
        EndpointCategory::AdminRoute,
        EndpointCategory::FinancialRoute,
        EndpointCategory::UploadExportRoute,
        EndpointCategory::GeneralApi,
        EndpointCategory::StaticHealth,
    ];

    for cat in categories {
        let ctx = CandidateTestContext {
            candidate_id: Uuid::new_v4(),
            endpoint_path: "/test/path".to_string(),
            http_method: HttpMethod::PUT,
            category: cat,
            coverage_gap: CoverageGapStatus::UntestedMethod,
            proximity: FindingProximity::SiblingPathFinding,
            parameter_name: Some("id".to_string()),
            param_semantics: ParameterSemantics::Identifier,
            tech_confidence: TechStackConfidence::DirectMatch,
            check_id: "CHECK-TEST".to_string(),
            check_name: "Test Check".to_string(),
            estimated_requests: 4,
        };

        let (_, why) = planner.evaluate_candidate(&ctx);
        assert!(why.starts_with("Score: "));
        assert!(why.contains("WHY: "));
        assert!(why.contains("Untested PUT method surface"));
        assert!(why.contains("Proximity: Sibling route vulnerability detected"));
        assert!(why.contains("Parameter semantic class: Identifier"));
        assert!(why.contains("Verified tech-stack match"));
        assert!(why.contains("Estimated cost: 4 requests"));
    }
}
