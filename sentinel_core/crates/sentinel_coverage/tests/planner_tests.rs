use uuid::Uuid;

use sentinel_common::enums::HttpMethod;
use sentinel_coverage::{
    AdaptiveTestPlanner, CandidateTestContext, CoverageGapStatus, EndpointCategory,
    FindingProximity, ParameterSemantics, TechStackConfidence,
};

#[test]
fn test_adaptive_test_planner_multi_factor_scoring() {
    let planner = AdaptiveTestPlanner::new();

    // High risk auth candidate with finding proximity and SQLi param
    let high_cand = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/v1/auth/reset-password".to_string(),
        http_method: HttpMethod::POST,
        category: EndpointCategory::AuthRoute, // 95
        coverage_gap: CoverageGapStatus::CompletelyUntested, // 100
        proximity: FindingProximity::ExactEndpointFinding, // 100
        parameter_name: Some("token".to_string()),
        param_semantics: ParameterSemantics::AuthTokenOrSecret, // 85
        tech_confidence: TechStackConfidence::DirectMatch, // 100
        check_id: "AUTH-RESET-TOKEN-ENTROPY".to_string(),
        check_name: "Reset Token Predictability".to_string(),
        estimated_requests: 3, // cost 10
    };

    let (score, why) = planner.evaluate_candidate(&high_cand);

    // Formula: 0.25*95 + 0.25*100 + 0.20*100 + 0.15*85 + 0.15*100 - 0.10*10
    // = 23.75 + 25.0 + 20.0 + 12.75 + 15.0 - 1.0 = 95.5
    assert!((score - 95.5).abs() < 0.01);
    assert!(why.contains("High-sensitivity auth endpoint"));
    assert!(why.contains("Completely untested endpoint"));
    assert!(why.contains("Confirmed finding on exact endpoint"));
    assert!(why.contains("Verified tech-stack match"));
}

#[test]
fn test_planner_ranking_and_budget_governor() {
    let planner = AdaptiveTestPlanner::new();

    let c1 = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/health".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::StaticHealth, // 10
        coverage_gap: CoverageGapStatus::FullyTested, // 0
        proximity: FindingProximity::NoPriorFindings, // 0
        parameter_name: None,
        param_semantics: ParameterSemantics::None, // 10
        tech_confidence: TechStackConfidence::GenericProtocol, // 70
        check_id: "HEADER-CHECK".to_string(),
        check_name: "Missing Security Headers".to_string(),
        estimated_requests: 1,
    };

    let c2 = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/admin/exec".to_string(),
        http_method: HttpMethod::POST,
        category: EndpointCategory::AdminRoute, // 90
        coverage_gap: CoverageGapStatus::CompletelyUntested, // 100
        proximity: FindingProximity::SiblingPathFinding, // 75
        parameter_name: Some("cmd".to_string()),
        param_semantics: ParameterSemantics::CommandString, // 98
        tech_confidence: TechStackConfidence::DirectMatch, // 100
        check_id: "CMDI-CHECK".to_string(),
        check_name: "OS Command Injection".to_string(),
        estimated_requests: 10,
    };

    let c3 = CandidateTestContext {
        candidate_id: Uuid::new_v4(),
        endpoint_path: "/api/v1/users".to_string(),
        http_method: HttpMethod::GET,
        category: EndpointCategory::GeneralApi, // 70
        coverage_gap: CoverageGapStatus::UntestedParam, // 50
        proximity: FindingProximity::NoPriorFindings, // 0
        parameter_name: Some("id".to_string()),
        param_semantics: ParameterSemantics::Identifier, // 90
        tech_confidence: TechStackConfidence::DirectMatch, // 100
        check_id: "BOLA-CHECK".to_string(),
        check_name: "Broken Object Level Authorization".to_string(),
        estimated_requests: 5,
    };

    let ranked = planner.rank_candidates(vec![c1.clone(), c2.clone(), c3.clone()]);
    assert_eq!(ranked.len(), 3);
    assert_eq!(ranked[0].check_id, "CMDI-CHECK");
    assert_eq!(ranked[1].check_id, "BOLA-CHECK");
    assert_eq!(ranked[2].check_id, "HEADER-CHECK");

    // Test budget governor: budget = 12 requests
    // c2 takes 10, c3 takes 5 (10+5 = 15 > 12 -> skipped), c1 takes 1 (10+1 = 11 <= 12 -> included)
    let budgeted = planner.generate_plan(vec![c1, c2, c3], Some(12));
    assert_eq!(budgeted.len(), 2);
    assert_eq!(budgeted[0].check_id, "CMDI-CHECK");
    assert_eq!(budgeted[1].check_id, "HEADER-CHECK");
}

#[test]
fn test_category_and_param_classifiers() {
    assert_eq!(EndpointCategory::classify_path("/api/v1/auth/login"), EndpointCategory::AuthRoute);
    assert_eq!(EndpointCategory::classify_path("/internal/management"), EndpointCategory::AdminRoute);
    assert_eq!(EndpointCategory::classify_path("/api/checkout/pay"), EndpointCategory::FinancialRoute);
    assert_eq!(EndpointCategory::classify_path("/export/csv"), EndpointCategory::UploadExportRoute);
    assert_eq!(EndpointCategory::classify_path("/favicon.ico"), EndpointCategory::StaticHealth);
    assert_eq!(EndpointCategory::classify_path("/api/v1/items"), EndpointCategory::GeneralApi);

    assert_eq!(ParameterSemantics::classify_param_name("exec_command"), ParameterSemantics::CommandString);
    assert_eq!(ParameterSemantics::classify_param_name("file_path"), ParameterSemantics::FilePathOrUrl);
    assert_eq!(ParameterSemantics::classify_param_name("sql_filter"), ParameterSemantics::SqlFragment);
    assert_eq!(ParameterSemantics::classify_param_name("account_id"), ParameterSemantics::Identifier);
    assert_eq!(ParameterSemantics::classify_param_name("jwt_token"), ParameterSemantics::AuthTokenOrSecret);
    assert_eq!(ParameterSemantics::classify_param_name("page_offset"), ParameterSemantics::PaginationOrConstant);
}
