//! Statistical inference engine for UCMA-X.
//! Includes SPRT, Mann-Whitney, EWMA, and Welch tests.

pub mod distribution;
pub mod ewma;
pub mod mann_whitney;
pub mod sprt;
pub mod welch;

pub use distribution::SampleSummary;
pub use ewma::{CusumDetector, EwmaTracker};
pub use mann_whitney::{mann_whitney_u_test, MannWhitneyResult};
pub use sprt::{SprtAccumulator, SprtConfig, SprtDecision};
pub use welch::{welch_t_test, WelchResult};
