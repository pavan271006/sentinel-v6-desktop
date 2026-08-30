//! SENTINEL V6: Verification, Evidence & Findings Subsystem (WP-8.1 / SUB-09)
//!
//! Provides deterministic verification strategies, proof requirement validation,
//! cryptographic CAS evidence linkage, findings lifecycle state management,
//! Differential Security Engine (Engine 3), and Security Regression Graph (Engine 4):
//! - SQL Injection (40+ RDBMS signatures, 3-round boolean inversion, timing, UNION)
//! - NoSQL Injection (MongoDB $ne, $gt, $regex)
//! - Command Injection (Separators, math canaries, timing)
//! - Server-Side Template Injection (Polyglots, multi-stage math)
//! - XML External Entity (XXE file disclosure & XInclude)
//! - Path Traversal & LFI (Multi-encodings & OS signatures)
//! - Cross-Site Scripting (Context-aware unescaped reflection)
//! - Insecure Deserialization (Safe OAST gadgets)
//! - Prototype Pollution (Server & Client DOM)
//! - Differential Security Engine (Semantic + Statistical timing + IRA+ Matrix)
//! - Security Regression Graph (VULNERABLE <-> FIXED <-> REGRESSED state machine)

pub mod cmdi;
pub mod deserialization;
pub mod differential;
pub mod engine;
pub mod formal_state_machine;
pub mod independent_verifier;
pub mod lifecycle;
pub mod nosqli;
pub mod prototype_pollution;
pub mod regression;
pub mod sec06_oracles;
pub mod sqli;
pub mod ssti;
pub mod strategies;
pub mod traversal;
pub mod tri_target;
pub mod xss;
pub mod xxe;

pub use cmdi::{CmdExecutionIndicator, CmdProbe, CmdVerificationResult, CommandInjectionEngine};
pub use deserialization::{
    DeserializationEngine, DeserializationPlatform, DeserializationProbe,
    DeserializationVerificationResult,
};
pub use differential::{
    DifferentialAnalysisResult, DifferentialClassification, DifferentialEngine, PrivilegeRole,
    SemanticDiffResult, StatisticalTimingResult,
};
pub use engine::DefaultVerificationEngine;
pub use formal_state_machine::{
    FindingAuditEntry, FormalFindingRecordData, TypedFindingRecord, StateObserved, StateCandidate,
    StateReproducible, StateVerified, StateIndependentlyVerified, StatePromoted,
    StateDeduplicated, StateReported, StateRetested, StateFixed, StateStillPresent, StateClosed,
};
pub use independent_verifier::{IndependentVerificationAttestation, IndependentVerifierWorker};
pub use lifecycle::FindingLifecycleManager;
pub use nosqli::{NoSqliEngine, NoSqliOperator, NoSqliProbe, NoSqliVerificationResult};
pub use prototype_pollution::{
    PollutionScope, PrototypePollutionEngine, PrototypePollutionProbe, PrototypePollutionResult,
};
pub use regression::{
    RegressionExecutionResult, RegressionGraphEngine, RegressionTestDefinition, RetestHistoryEntry,
};
pub use sec06_oracles::{
    OracleEvaluationContext, OracleEvaluationResult, Sec06OracleRegistry, Sec06OracleType,
};
pub use sqli::{DatabaseEngine, SqliEngine, SqliTechnique, SqliVerificationResult, SQL_ERROR_SIGNATURES};
pub use ssti::{SstiEngine, SstiProbe, SstiVerificationResult, TemplateEngine, SSTI_POLYGLOT_PROBES};
pub use strategies::StrategyEvaluator;
pub use traversal::{
    PathTraversalEngine, TraversalProbe, TraversalTargetOs, TraversalVerificationResult,
};
pub use tri_target::{
    ConfusionMatrixReport, TargetCategory, TestCase, TriTargetAuditHarness,
};
pub use xss::{XssContext, XssEngine, XssProbe, XssVerificationResult};
pub use xxe::{XxeAttackType, XxeEngine, XxeProbe, XxeVerificationResult};

