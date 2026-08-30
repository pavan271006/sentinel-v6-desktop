//! SENTINEL V6: Authentication & Identity Subsystem (WP-5.1 / SUB-12)
//!
//! Provides zero-plaintext secret credential management (SEC-09), secure vault
//! storage, automated authorization injection, JWT analysis, username enumeration heuristics,
//! credential stuffing safeguards, OAuth 2.0 / OIDC / PKCE flow auditing,
//! session rotation/fixation verification, session puzzling detection, and anti-CSRF defenses.

pub mod csrf;
pub mod enumeration;
pub mod injector;
pub mod jwt;
pub mod manager;
pub mod oauth;
pub mod session_puzzling;
pub mod session_rotation;
pub mod stuffing;
pub mod vault;

pub use csrf::{AntiCsrfEngine, CsrfEvaluationReport, CsrfProbeResult, CsrfProbeType};
pub use enumeration::{EnumerationAnalysisResult, TimingSample, UsernameEnumerationEngine};
pub use jwt::{JwtUtility, ParsedJwt};
pub use manager::DefaultIdentityManager;
pub use oauth::{OAuthFlowAnalyzer, OAuthVulnerability, OAuthVulnerabilityType};
pub use session_puzzling::{SessionCollisionFinding, SessionPuzzlingAnalyzer, SessionVariableSnapshot};
pub use session_rotation::{SessionFixationResult, SessionRotationEngine, SessionRotationResult};
pub use stuffing::{LockoutAnalyzer, LockoutBypassVector, LockoutThresholdProbe};
pub use vault::SecureVault;
