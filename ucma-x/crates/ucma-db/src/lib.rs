//! Database Metadata Discovery and Privilege Model for UCMA-X.

pub mod catalog;
pub mod privilege;
pub mod schema;

pub use catalog::DatabaseCatalog;
pub use privilege::DatabasePrivileges;
pub use schema::{ColumnMetadata, ObjectAccessStatus, SchemaMetadata, TableMetadata};
