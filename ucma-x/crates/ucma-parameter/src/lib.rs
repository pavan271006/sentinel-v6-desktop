//! # UCMA-Parameter
//! Multi-format parameter extraction, injection context inference, and encoding/decoding chains for UCMA-X.

pub mod context;
pub mod encoding;
pub mod extractor;
pub mod lattice;
pub mod mutator;

pub use context::{ContextInferenceEngine, ContextInferenceReport, InjectionContext};
pub use encoding::{CodecEngine, EncodingType, ParameterCodecError};
pub use extractor::{ExtractedParameter, ParameterExtractor};
pub use lattice::{
    ArithmeticInvariant, ContextClassifier, ContextCoordinate, ContextLatticeInversionEngine,
    Escape, EscapeDiagnostic, Keyword, LatticeError, QueryType, SqlDialect, TypeContext,
};
pub use mutator::ParameterMutator;
pub use ucma_core::parameter::ParameterLocation;
