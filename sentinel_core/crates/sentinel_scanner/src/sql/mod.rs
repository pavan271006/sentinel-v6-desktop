//! SENTINEL Extreme-Autonomous SQL Security Engine
//!
//! Autonomous, evidence-driven relational SQL security investigation subsystem
//! replacing legacy static payload runners with active tri-graph reasoning,
//! multi-oracle sensor fusion, and 50-worker parallel-safe execution.

pub mod ai_reasoner;
pub mod applicability;
pub mod app_state;
pub mod async_engine;
pub mod baseline;
pub mod blind;
pub mod compiler;
pub mod confirmation;
pub mod context;
pub mod coverage;
pub mod critique;
pub mod dbms;
pub mod deep_scan;
pub mod depth;
pub mod differential;
pub mod discovery;
pub mod evidence;
pub mod explainability;
pub mod hypothesis;
pub mod impact;
pub mod investigation_graph;
pub mod knowledge;
pub mod lanes;
pub mod models;
pub mod normalizer;
pub mod oracles;
pub mod planner;
pub mod pool;
pub mod quick_scan;
pub mod regression;
pub mod second_order;

pub use ai_reasoner::{AiInvestigationProposal, AiReasoningEngine, DEFAULT_AI_API_KEY};
pub use deep_scan::{DeepScanPipeline, DeepScanReport};
pub use explainability::{ExplainabilityConsole, LiveTelemetrySnapshot};
pub use models::{Blake3Id, ConfirmedSqliFinding, ExecutionClass, FindingStatus, InputSurfaceType, InputTarget, TargetIdentity};
pub use normalizer::{NormalizedRequest, RequestNormalizer};
pub use quick_scan::{QuickScanPipeline, QuickScanReport};
