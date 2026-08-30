//! SENTINEL V6: Plugins & Sandboxed Research Packs Subsystem (WP-16.1 / SUB-20 / SUB-21 / Proprietary Engine 5)
//!
//! Provides zero ambient capability WASM/Rhai plugin sandboxing,
//! cryptographically signed, versioned Research Packs with HMAC-SHA256 verification,
//! and dynamic check hot-reloading.

pub mod krl;
pub mod manager;
pub mod research_pack;
pub mod runtime;
pub mod sandbox;

pub use krl::{KeyRevocationList, RevocationReason, RevokedKeyEntry};
pub use manager::DefaultResearchPackManager;
pub use research_pack::{
    EnterpriseTrustStore, PackProbeDefinition, ResearchPack, ResearchPackCheck,
    ResearchPackDictionary, ResearchPackManifest, ResearchPackVerifier, TrustAnchor,
    TrustAnchorStatus,
};
pub use runtime::{DefaultPluginRuntime, LoadedPlugin, PluginType};
pub use sandbox::{PluginSandboxEnvironment, DEFAULT_FUEL_LIMIT, MAX_MEMORY_BYTES};
