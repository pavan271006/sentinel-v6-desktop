//! Database metadata schema models and accessibility states.

use serde::{Deserialize, Serialize};

/// Accessibility state of a discovered database object.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObjectAccessStatus {
    Discovered,
    Accessible,
    Partial,
    Inaccessible,
    NotTested,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMetadata {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub status: ObjectAccessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMetadata {
    pub name: String,
    pub schema_name: String,
    pub columns: Vec<ColumnMetadata>,
    pub approximate_row_count: Option<u64>,
    pub status: ObjectAccessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaMetadata {
    pub name: String,
    pub tables: Vec<TableMetadata>,
    pub status: ObjectAccessStatus,
}
