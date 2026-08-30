//! SENTINEL V6: Context & Fingerprinting Engine (WP-4.1 / SUB-10)
//!
//! Provides passive web technology fingerprinting, framework identification,
//! semantic parameter classification, logarithmic bisection parameter mining,
//! JavaScript route extraction, API parameter type inference, and Favicon/JARM fingerprinting.

pub mod advanced_fingerprint;
pub mod classifier;
pub mod engine;
pub mod fingerprint;
pub mod param_miner;
pub mod route_extractor;
pub mod type_inference;

pub use advanced_fingerprint::{AdvancedFingerprintEngine, FaviconFingerprint, JarmFingerprint};
pub use classifier::ParameterClassifier;
pub use engine::DefaultContextEngine;
pub use fingerprint::TechDetector;
pub use param_miner::{DiscoveredParameter, ParamMinerEngine, ParamMiningBatch, ParameterVector};
pub use route_extractor::{DiscoveredRoute, RouteExtractorEngine};
pub use type_inference::{InferredParameterSchema, InferredType, TypeInferenceEngine};
