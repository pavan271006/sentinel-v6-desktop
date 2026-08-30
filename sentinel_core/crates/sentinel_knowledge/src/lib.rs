//! SENTINEL V6: Knowledge Graph & Security Context Graph Engine (WP-4.2 / SUB-13 / Proprietary Engine 1)
//!
//! Provides knowledge graph topology management, entity resolution,
//! strongly-typed security context graphs, risk score propagation,
//! lineage tracing, and SQLite recursive CTE query generation.

pub mod confidence;
pub mod context_graph;
pub mod cpe;
pub mod cte;
pub mod engine;
pub mod graph;
pub mod rule_engine;
pub mod vulnerability;

pub use confidence::{
    BayesianConfidenceScorer, EvidenceItem, EvidenceSourceType, TargetEvaluationDecision,
};
pub use context_graph::{
    ContextEdgeType, ContextGraphEdge, ContextGraphNode, ContextNodeType, LineagePath,
    SecurityContextGraph,
};
pub use cpe::{Cpe23Uri, CpePart, SemVersion};
pub use cte::AttackGraphCteQueries;
pub use engine::DefaultKnowledgeEngine;
pub use graph::GraphIndex;
pub use rule_engine::{
    PrerequisiteCheck, RemediationAdvice, RuleExecutionReport, RuleVerificationConfig,
    RuleVerificationType, SafeProbeConfig, TechPrerequisite, VulnerabilityRule,
    VulnerabilityRuleEngine,
};
pub use vulnerability::{
    AdvisoryQuery, AdvisorySource, AffectedPackage, CanonicalVulnerabilityAdvisory,
    CommitRange, CpeMatchCriteria, CvssV3Data, CvssV4Data, EpssData, FeedSyncReport,
};
