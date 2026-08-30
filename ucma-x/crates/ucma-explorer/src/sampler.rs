//! Controlled row sampler and extraction completeness tracker.

use crate::masking::DataMasker;
use crate::policy::ExplorationPolicy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSampleResult {
    pub table_name: String,
    pub columns: Vec<String>,
    pub rows: Vec<HashMap<String, String>>,
    pub total_rows_expected: Option<usize>,
    pub rows_retrieved: usize,
    pub is_complete: bool,
}

pub struct TableSampler;

impl TableSampler {
    /// Processes and sanitizes retrieved tabular rows according to exploration policy.
    pub fn process_sample(
        policy: ExplorationPolicy,
        table_name: &str,
        columns: &[String],
        raw_rows: Vec<HashMap<String, String>>,
        total_expected: Option<usize>,
    ) -> TableSampleResult {
        let (max_rows, mask) = match policy {
            ExplorationPolicy::SchemaOnly => (0, true),
            ExplorationPolicy::SchemaPlusSample { max_rows } => (max_rows, true),
            ExplorationPolicy::LabDataExploration { max_rows_per_table, enable_masking } => {
                (max_rows_per_table, enable_masking)
            }
        };

        let mut sanitized_rows = Vec::new();
        for row in raw_rows.into_iter().take(max_rows) {
            let mut sanitized_row = HashMap::new();
            for (k, v) in row {
                let display_val = if mask {
                    DataMasker::mask_value(&k, &v)
                } else {
                    v
                };
                sanitized_row.insert(k, display_val);
            }
            sanitized_rows.push(sanitized_row);
        }

        let retrieved = sanitized_rows.len();
        let is_complete = total_expected.map(|exp| retrieved >= exp).unwrap_or(false);

        TableSampleResult {
            table_name: table_name.to_string(),
            columns: columns.to_vec(),
            rows: sanitized_rows,
            total_rows_expected: total_expected,
            rows_retrieved: retrieved,
            is_complete,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_sampler_with_masking() {
        let policy = ExplorationPolicy::SchemaPlusSample { max_rows: 5 };
        let cols = vec!["id".to_string(), "username".to_string(), "password_hash".to_string()];
        
        let mut row1 = HashMap::new();
        row1.insert("id".to_string(), "1".to_string());
        row1.insert("username".to_string(), "admin".to_string());
        row1.insert("password_hash".to_string(), "$2y$10$abcdef...".to_string());

        let result = TableSampler::process_sample(policy, "users", &cols, vec![row1], Some(1));
        assert_eq!(result.rows.len(), 1);
        assert_eq!(result.rows[0].get("password_hash").unwrap(), "********[REDACTED]********");
        assert!(result.is_complete);
    }
}
