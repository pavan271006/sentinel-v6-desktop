//! Second-Order and Stored SQL Injection Analysis Engine for UCMA-X.

pub mod correlator;
pub mod tracker;

pub use correlator::{SecondOrderCorrelator, SecondOrderFinding};
pub use tracker::{SinkObservation, StoredInputVector};
