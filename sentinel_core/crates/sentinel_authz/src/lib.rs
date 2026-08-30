//! SENTINEL V6: Authorization Engine Subsystem (WP-9.1 / SUB-14)
//!
//! Provides combinatorial cross-tenant / cross-role authorization matrix generation,
//! live multi-session privilege differential comparison (Autorize-style),
//! automated BOLA (Broken Object Level Authorization), IDOR, and BFLA detection.

pub mod divergence;
pub mod engine;
pub mod entropy;
pub mod matrix;
pub mod substitution;

pub use divergence::{AuthzVerdict, PrivilegeDivergenceOracle, PrivilegeRole, RoleResponseData};
pub use engine::DefaultAuthorizationEngine;
pub use entropy::ShannonEntropyMasker;
pub use matrix::{
    AuthzVulnerabilityType, AutorizeDifferentialEngine, DifferentialFinding,
    DifferentialProbeResult, MatrixEvaluator,
};
pub use substitution::AstIdorSubstitutor;
