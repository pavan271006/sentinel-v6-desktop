//! # UCMA-Core
//! Foundational domain models, deterministic BLAKE3 identifiers, snapshots,
//! evidence stores, and session abstractions for UCMA-X.

pub mod endpoint;
pub mod evidence;
pub mod ids;
pub mod parameter;
pub mod request;
pub mod session;
pub mod snapshot;
pub mod target;

// Re-export common types
pub use endpoint::{Endpoint, HttpMethod};
pub use evidence::{EvidenceRecord, EvidenceStore, Severity};
pub use ids::{
    ContentId, EndpointId, EvidenceId, ParameterId, RequestId, SessionId, SnapshotId, TargetId,
};
pub use parameter::{ParameterDefinition, ParameterLocation, ParameterType, ParameterValue};
pub use request::RawRequest;
pub use session::{SessionError, SessionManager, SessionState};
pub use snapshot::{HttpSnapshotPair, ResponseSnapshot};
pub use target::{EnvironmentTag, Target, TargetBuilder, TargetConfig};
