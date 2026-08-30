//! Metamorphic SQL security validation for UCMA-X.

pub mod engine;
pub mod equivalence;
pub mod norec;
pub mod tlp;

pub use engine::{MetamorphicEngine, MetamorphicEvidence};
pub use equivalence::{EquivalenceGenerator, EquivalencePair};
pub use norec::{NorecGenerator, NorecPair};
pub use tlp::{TlpGenerator, TlpPartitionSet};
