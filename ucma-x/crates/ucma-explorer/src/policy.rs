//! Data exploration authorization policy.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum ExplorationPolicy {
    /// Only discover schema/table/column metadata; do not retrieve table rows.
    #[default]
    SchemaOnly,
    /// Discover metadata and sample up to N rows per table.
    SchemaPlusSample { max_rows: usize },
    /// Full laboratory data exploration with explicit scope limits.
    LabDataExploration { max_rows_per_table: usize, enable_masking: bool },
}
