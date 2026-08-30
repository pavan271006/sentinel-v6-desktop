//! Multi-Oracle Evidence Fusion Engine for UCMA-X.

pub mod aggregator;
pub mod boolean;
pub mod error;
pub mod metamorphic;
pub mod structural;
pub mod timing;

pub use aggregator::{AggregatedOracleReport, OracleAggregator};
pub use boolean::{BooleanOracle, BooleanOracleVerdict};
pub use error::{ErrorOracle, ErrorOracleVerdict};
pub use metamorphic::{MetamorphicOracle, MetamorphicOracleVerdict};
pub use structural::{StructuralOracle, StructuralOracleVerdict};
pub use timing::{TimingOracle, TimingOracleVerdict};
