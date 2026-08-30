//! Global database catalog repository.

use crate::privilege::DatabasePrivileges;
use crate::schema::{ObjectAccessStatus, SchemaMetadata, TableMetadata};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DatabaseCatalog {
    pub dbms_name: String,
    pub dbms_version: Option<String>,
    pub schemas: Vec<SchemaMetadata>,
    pub privileges: DatabasePrivileges,
}

impl DatabaseCatalog {
    pub fn new(dbms_name: impl Into<String>) -> Self {
        Self {
            dbms_name: dbms_name.into(),
            dbms_version: None,
            schemas: Vec::new(),
            privileges: DatabasePrivileges::default(),
        }
    }

    pub fn add_table(&mut self, schema_name: &str, table: TableMetadata) {
        if let Some(schema) = self.schemas.iter_mut().find(|s| s.name == schema_name) {
            schema.tables.push(table);
        } else {
            self.schemas.push(SchemaMetadata {
                name: schema_name.to_string(),
                tables: vec![table],
                status: ObjectAccessStatus::Accessible,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{ColumnMetadata, ObjectAccessStatus};

    #[test]
    fn test_catalog_structure() {
        let mut catalog = DatabaseCatalog::new("PostgreSQL");
        let table = TableMetadata {
            name: "users".to_string(),
            schema_name: "public".to_string(),
            columns: vec![
                ColumnMetadata {
                    name: "id".to_string(),
                    data_type: "integer".to_string(),
                    is_nullable: false,
                    is_primary_key: true,
                    status: ObjectAccessStatus::Accessible,
                },
            ],
            approximate_row_count: Some(100),
            status: ObjectAccessStatus::Accessible,
        };

        catalog.add_table("public", table);
        assert_eq!(catalog.schemas.len(), 1);
        assert_eq!(catalog.schemas[0].tables.len(), 1);
    }
}
