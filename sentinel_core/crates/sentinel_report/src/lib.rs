//! SENTINEL V6: Findings Center, Notebook & Automated Reporting Subsystem (WP-14.1)
//!
//! Provides findings triage query center, multi-format security reports (MD, HTML, JSON, SARIF),
//! and pentester scratchpad notes management.

pub mod center;
pub mod generator;
pub mod notebook;
pub mod sarif;

pub use center::FindingsCenter;
pub use generator::ReportGenerator;
pub use notebook::NotebookManager;
pub use sarif::SarifReportBuilder;
