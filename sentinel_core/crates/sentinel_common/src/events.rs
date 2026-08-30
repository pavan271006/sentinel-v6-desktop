// SENTINEL V6: Canonical Event Registry (SEC-12)
// crates/sentinel_common/src/events.rs
//
// Distinguishes:
// 1. SentinelEvent: High-volume broadcast/telemetry events (best-effort delivery).
// 2. CriticalEvent: Auditable, security-critical events (durable persistence, zero loss).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::operational::{ScanProgressUpdate, ScopeDecision, TaskStateUpdate};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HttpHeaderData {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrafficEventData {
    pub id: String,
    pub method: String,
    pub url: String,
    pub status: u16,
    pub duration_ms: u64,
    pub in_scope: bool,
    pub req_headers: Option<Vec<HttpHeaderData>>,
    pub req_body: Option<String>,
    pub res_headers: Option<Vec<HttpHeaderData>>,
    pub res_body: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SentinelEvent {
    ObservationCreated(Uuid),
    ContextDetected(Uuid),
    CoverageUpdate(Uuid),
    ScanProgress(ScanProgressUpdate),
    TaskStatus(TaskStateUpdate),
    Traffic(TrafficEventData),
}

impl SentinelEvent {
    pub fn event_name(&self) -> &'static str {
        match self {
            Self::ObservationCreated(_) => "ObservationCreated",
            Self::ContextDetected(_) => "ContextDetected",
            Self::CoverageUpdate(_) => "CoverageUpdate",
            Self::ScanProgress(_) => "ScanProgress",
            Self::TaskStatus(_) => "TaskStatus",
            Self::Traffic(_) => "Traffic",
        }
    }

    pub fn topic(&self) -> &'static str {
        match self {
            Self::ObservationCreated(_) => "telemetry.observation",
            Self::ContextDetected(_) => "telemetry.context",
            Self::CoverageUpdate(_) => "telemetry.coverage",
            Self::ScanProgress(_) => "telemetry.scan",
            Self::TaskStatus(_) => "telemetry.task",
            Self::Traffic(_) => "telemetry.traffic",
        }
    }

    pub fn subsystem(&self) -> &'static str {
        match self {
            Self::ObservationCreated(_) => "SUB-03 ObservationStore",
            Self::ContextDetected(_) => "SUB-10 ContextEngine",
            Self::CoverageUpdate(_) => "SUB-11 CoverageEngine",
            Self::ScanProgress(_) => "SUB-07 ScanOrchestrator",
            Self::TaskStatus(_) => "SUB-06 TaskScheduler",
            Self::Traffic(_) => "SUB-01 ProxyEngine",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CriticalEvent {
    FindingCreated(Uuid),
    CandidateVerified(Uuid),
    ScopeViolationAttempt {
        source: String,
        target: String,
        decision: ScopeDecision,
    },
}

impl CriticalEvent {
    pub fn event_name(&self) -> &'static str {
        match self {
            Self::FindingCreated(_) => "FindingCreated",
            Self::CandidateVerified(_) => "CandidateVerified",
            Self::ScopeViolationAttempt { .. } => "ScopeViolationAttempt",
        }
    }

    pub fn topic(&self) -> &'static str {
        match self {
            Self::FindingCreated(_) => "audit.finding.created",
            Self::CandidateVerified(_) => "audit.candidate.verified",
            Self::ScopeViolationAttempt { .. } => "audit.scope.violation",
        }
    }

    pub fn subsystem(&self) -> &'static str {
        match self {
            Self::FindingCreated(_) => "SUB-09 VerificationEngine",
            Self::CandidateVerified(_) => "SUB-09 VerificationEngine",
            Self::ScopeViolationAttempt { .. } => "SUB-04 ScopeEngine",
        }
    }
}
