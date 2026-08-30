//! Adaptive Test Planner (SENTINEL Proprietary Engine 2)
//!
//! Evaluates multi-factor deterministic scoring formula:
//! S = W_risk * R_endpoint + W_cov * C_gap + W_vuln * V_prior + W_param * P_class + W_tech * T_stack - W_cost * Cost
//! Generates ranked NextBestTest queues with explainable "WHY" rationale.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::enums::HttpMethod;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EndpointCategory {
    AuthRoute,
    AdminRoute,
    FinancialRoute,
    UploadExportRoute,
    GeneralApi,
    StaticHealth,
}

impl EndpointCategory {
    pub fn score(&self) -> f64 {
        match self {
            EndpointCategory::AuthRoute => 95.0,
            EndpointCategory::AdminRoute => 90.0,
            EndpointCategory::FinancialRoute => 92.0,
            EndpointCategory::UploadExportRoute => 85.0,
            EndpointCategory::GeneralApi => 70.0,
            EndpointCategory::StaticHealth => 10.0,
        }
    }

    pub fn classify_path(path: &str) -> Self {
        let lower = path.to_ascii_lowercase();
        if lower.contains("/auth/") || lower.contains("/login") || lower.contains("/oauth") || lower.contains("/reset-password") || lower.contains("/token") {
            EndpointCategory::AuthRoute
        } else if lower.contains("/admin") || lower.contains("/internal") || lower.contains("/management") {
            EndpointCategory::AdminRoute
        } else if lower.contains("/checkout") || lower.contains("/pay") || lower.contains("/invoice") || lower.contains("/transfer") || lower.contains("/billing") {
            EndpointCategory::FinancialRoute
        } else if lower.contains("/upload") || lower.contains("/download") || lower.contains("/file") || lower.contains("/export") {
            EndpointCategory::UploadExportRoute
        } else if lower.contains("/health") || lower.contains("/favicon") || lower.contains("/ping") || lower.contains("/robots.txt") {
            EndpointCategory::StaticHealth
        } else {
            EndpointCategory::GeneralApi
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CoverageGapStatus {
    CompletelyUntested,
    UntestedMethod,
    UntestedParam,
    FullyTested,
}

impl CoverageGapStatus {
    pub fn score(&self) -> f64 {
        match self {
            CoverageGapStatus::CompletelyUntested => 100.0,
            CoverageGapStatus::UntestedMethod => 75.0,
            CoverageGapStatus::UntestedParam => 50.0,
            CoverageGapStatus::FullyTested => 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FindingProximity {
    ExactEndpointFinding,
    SiblingPathFinding,
    SameAssetFinding,
    NoPriorFindings,
}

impl FindingProximity {
    pub fn score(&self) -> f64 {
        match self {
            FindingProximity::ExactEndpointFinding => 100.0,
            FindingProximity::SiblingPathFinding => 75.0,
            FindingProximity::SameAssetFinding => 40.0,
            FindingProximity::NoPriorFindings => 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParameterSemantics {
    CommandString,
    FilePathOrUrl,
    SqlFragment,
    Identifier,
    AuthTokenOrSecret,
    FreeTextOrSearch,
    PaginationOrConstant,
    None,
}

impl ParameterSemantics {
    pub fn score(&self) -> f64 {
        match self {
            ParameterSemantics::CommandString => 98.0,
            ParameterSemantics::FilePathOrUrl => 95.0,
            ParameterSemantics::SqlFragment => 95.0,
            ParameterSemantics::Identifier => 90.0,
            ParameterSemantics::AuthTokenOrSecret => 85.0,
            ParameterSemantics::FreeTextOrSearch => 70.0,
            ParameterSemantics::PaginationOrConstant => 20.0,
            ParameterSemantics::None => 10.0,
        }
    }

    pub fn classify_param_name(name: &str) -> Self {
        let lower = name.to_ascii_lowercase();
        if lower.contains("cmd") || lower.contains("exec") || lower.contains("command") || lower.contains("script") {
            ParameterSemantics::CommandString
        } else if lower.contains("path") || lower.contains("file") || lower.contains("url") || lower.contains("redirect") || lower.contains("dest") {
            ParameterSemantics::FilePathOrUrl
        } else if lower.contains("query") || lower.contains("sql") || lower.contains("select") || lower.contains("filter") || lower.contains("order") {
            ParameterSemantics::SqlFragment
        } else if lower.contains("id") || lower.contains("uuid") || lower.contains("account") || lower.contains("user_id") {
            ParameterSemantics::Identifier
        } else if lower.contains("token") || lower.contains("secret") || lower.contains("key") || lower.contains("auth") || lower.contains("session") {
            ParameterSemantics::AuthTokenOrSecret
        } else if lower.contains("page") || lower.contains("limit") || lower.contains("offset") || lower.contains("count") {
            ParameterSemantics::PaginationOrConstant
        } else {
            ParameterSemantics::FreeTextOrSearch
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TechStackConfidence {
    DirectMatch,
    GenericProtocol,
    Incompatible,
}

impl TechStackConfidence {
    pub fn score(&self) -> f64 {
        match self {
            TechStackConfidence::DirectMatch => 100.0,
            TechStackConfidence::GenericProtocol => 70.0,
            TechStackConfidence::Incompatible => 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PlanScoringWeights {
    pub w_risk: f64,
    pub w_cov: f64,
    pub w_vuln: f64,
    pub w_param: f64,
    pub w_tech: f64,
    pub w_cost: f64,
}

impl Default for PlanScoringWeights {
    fn default() -> Self {
        Self {
            w_risk: 0.25,
            w_cov: 0.25,
            w_vuln: 0.20,
            w_param: 0.15,
            w_tech: 0.15,
            w_cost: 0.10,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateTestContext {
    pub candidate_id: Uuid,
    pub endpoint_path: String,
    pub http_method: HttpMethod,
    pub category: EndpointCategory,
    pub coverage_gap: CoverageGapStatus,
    pub proximity: FindingProximity,
    pub parameter_name: Option<String>,
    pub param_semantics: ParameterSemantics,
    pub tech_confidence: TechStackConfidence,
    pub check_id: String,
    pub check_name: String,
    pub estimated_requests: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NextBestTest {
    pub candidate_id: Uuid,
    pub endpoint: String,
    pub http_method: HttpMethod,
    pub target_parameter: Option<String>,
    pub check_id: String,
    pub check_name: String,
    pub score: f64,
    pub why_rationale: String,
    pub estimated_cost: u32,
}

#[derive(Debug, Clone, Default)]
pub struct AdaptiveTestPlanner {
    pub weights: PlanScoringWeights,
}

impl AdaptiveTestPlanner {
    pub fn new() -> Self {
        Self {
            weights: PlanScoringWeights::default(),
        }
    }

    pub fn with_weights(weights: PlanScoringWeights) -> Self {
        Self { weights }
    }

    /// Evaluates multi-factor score and explainable "WHY" rationale for a single candidate check.
    pub fn evaluate_candidate(&self, ctx: &CandidateTestContext) -> (f64, String) {
        let r_endpoint = ctx.category.score();
        let c_gap = ctx.coverage_gap.score();
        let v_prior = ctx.proximity.score();
        let p_class = ctx.param_semantics.score();
        let t_stack = ctx.tech_confidence.score();

        let cost_penalty = match ctx.estimated_requests {
            0..=3 => 10.0,
            4..=15 => 30.0,
            _ => 60.0,
        };

        let raw_score = self.weights.w_risk * r_endpoint
            + self.weights.w_cov * c_gap
            + self.weights.w_vuln * v_prior
            + self.weights.w_param * p_class
            + self.weights.w_tech * t_stack
            - self.weights.w_cost * cost_penalty;

        // Clamp score between 0.0 and 100.0
        let final_score = raw_score.clamp(0.0, 100.0);

        // Build explainable WHY text
        let mut why_parts = Vec::new();

        match ctx.category {
            EndpointCategory::AuthRoute => why_parts.push(format!("High-sensitivity auth endpoint ({})", ctx.endpoint_path)),
            EndpointCategory::AdminRoute => why_parts.push(format!("Administrative surface ({})", ctx.endpoint_path)),
            EndpointCategory::FinancialRoute => why_parts.push(format!("Financial/Payment route ({})", ctx.endpoint_path)),
            EndpointCategory::UploadExportRoute => why_parts.push(format!("File upload/export handler ({})", ctx.endpoint_path)),
            EndpointCategory::GeneralApi => why_parts.push(format!("API endpoint ({})", ctx.endpoint_path)),
            EndpointCategory::StaticHealth => why_parts.push(format!("Low-priority static route ({})", ctx.endpoint_path)),
        }

        match ctx.coverage_gap {
            CoverageGapStatus::CompletelyUntested => why_parts.push("Completely untested endpoint".to_string()),
            CoverageGapStatus::UntestedMethod => why_parts.push(format!("Untested {:?} method surface", ctx.http_method)),
            CoverageGapStatus::UntestedParam => why_parts.push(format!("Untested parameter '{:?}'", ctx.parameter_name)),
            CoverageGapStatus::FullyTested => {}
        }

        match ctx.proximity {
            FindingProximity::ExactEndpointFinding => why_parts.push("Proximity: Confirmed finding on exact endpoint".to_string()),
            FindingProximity::SiblingPathFinding => why_parts.push("Proximity: Sibling route vulnerability detected".to_string()),
            FindingProximity::SameAssetFinding => why_parts.push("Proximity: Prior findings on same asset".to_string()),
            FindingProximity::NoPriorFindings => {}
        }

        if ctx.param_semantics != ParameterSemantics::None {
            why_parts.push(format!("Parameter semantic class: {:?}", ctx.param_semantics));
        }

        if ctx.tech_confidence == TechStackConfidence::DirectMatch {
            why_parts.push("Verified tech-stack match".to_string());
        }

        why_parts.push(format!("Estimated cost: {} requests", ctx.estimated_requests));

        let why_str = format!("Score: {:.1}/100 | WHY: {}", final_score, why_parts.join(" + "));

        (final_score, why_str)
    }

    /// Ranks candidates deterministically by score descending.
    pub fn rank_candidates(&self, candidates: Vec<CandidateTestContext>) -> Vec<NextBestTest> {
        let mut plan: Vec<NextBestTest> = candidates
            .into_iter()
            .map(|ctx| {
                let (score, why) = self.evaluate_candidate(&ctx);
                NextBestTest {
                    candidate_id: ctx.candidate_id,
                    endpoint: ctx.endpoint_path,
                    http_method: ctx.http_method,
                    target_parameter: ctx.parameter_name,
                    check_id: ctx.check_id,
                    check_name: ctx.check_name,
                    score,
                    why_rationale: why,
                    estimated_cost: ctx.estimated_requests,
                }
            })
            .collect();

        plan.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        plan
    }

    /// Generates a plan with an optional total request budget governor.
    pub fn generate_plan(
        &self,
        candidates: Vec<CandidateTestContext>,
        max_budget: Option<u32>,
    ) -> Vec<NextBestTest> {
        let ranked = self.rank_candidates(candidates);

        if let Some(budget) = max_budget {
            let mut cumulative = 0u32;
            let mut budgeted_plan = Vec::new();

            for test in ranked {
                if cumulative + test.estimated_cost <= budget {
                    cumulative += test.estimated_cost;
                    budgeted_plan.push(test);
                }
            }
            budgeted_plan
        } else {
            ranked
        }
    }
}
