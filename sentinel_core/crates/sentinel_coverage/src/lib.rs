//! SENTINEL V6: Attack Surface Coverage Engine & Adaptive Test Planner (WP-4.3 / SUB-11 / Proprietary Engine 2)
//!
//! Provides real-time attack surface tracking, endpoint exploration status,
//! multi-factor deterministic Next-Best-Test calculation, and explainable "WHY" rationale.

pub mod engine;
pub mod planner;

pub use engine::DefaultCoverageEngine;
pub use planner::{
    AdaptiveTestPlanner, CandidateTestContext, CoverageGapStatus, EndpointCategory,
    FindingProximity, NextBestTest, ParameterSemantics, PlanScoringWeights, TechStackConfidence,
};
