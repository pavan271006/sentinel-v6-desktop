//! SENTINEL V6: Scanner & Task Orchestration Engine (WP-6.1 / SUB-07)
//!
//! Provides automated vulnerability scan lifecycle orchestration, concurrency
//! control, rate limiting, passive / active security checks, and the
//! Extreme-Autonomous SQL Security Investigation Subsystem:
//! - Deep CSP AST parser, HSTS, X-Frame-Options, X-Content-Type-Options
//! - Structured cookie attribute auditing & Shannon entropy
//! - CORS misconfiguration analysis
//! - Debug interface and framework exposure detection (SPA soft-404 proof)
//! - Cloud metadata (AWS/GCP/Azure) and storage bucket permissions
//! - JavaScript source maps & sensitive development artifacts
//! - Active HTTP Request Smuggling (CL.TE, TE.CL, H2.CL, H2.TE)
//! - Web Cache Poisoning & Web Cache Deception
//! - Autonomous SQL Security Investigation Engine (3-Graph Model, 50-Worker Pool, Multi-Oracle)

pub mod cache_security;
pub mod checks;
pub mod cloud_exposure;
pub mod cookie_audit;
pub mod cors;
pub mod debug_exposure;
pub mod headers;
pub mod orchestrator;
pub mod scheduler;
pub mod smuggling_engine;
pub mod source_maps;
pub mod sql;

pub use cache_security::{CacheAttackType, CachePoisonProbe, CacheSecurityEngine, CacheVulnerabilityResult};
pub use checks::{PassiveCheckResult, SecurityCheckEngine};
pub use cloud_exposure::{CloudExposureProber, CloudMetadataProbe, CloudPlatform};
pub use cookie_audit::{CookieSecurityAuditor, CookieSecurityIssue, ParsedCookie, SameSitePolicy};
pub use cors::{CorsMisconfigurationAnalyzer, CorsVulnerability, CorsVulnerabilityType};
pub use debug_exposure::{DebugExposureAnalyzer, DebugProbeTarget, ExposedInterfaceType, DEBUG_PROBES};
pub use headers::{CspWeakness, HeaderAuditFinding, HeaderSecurityAuditor, ParsedCsp};
pub use orchestrator::DefaultScanOrchestrator;
pub use scheduler::ScanScheduler;
pub use smuggling_engine::{HttpSmugglingEngine, SmugglingAttackVector, SmugglingProbe, SmugglingVerificationResult};
pub use source_maps::{DevArtifactProbe, SourceMapAuditor, SourceMapInfo, DEV_ARTIFACT_PROBES};
pub use sql::*;
