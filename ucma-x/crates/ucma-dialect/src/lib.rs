//! # UCMA-Dialect
//! Comprehensive DBMS dialect syntax rules, quoting, comments, fingerprinting, and error regexes for UCMA-X.

pub mod dialect;
pub mod mssql;
pub mod mysql;
pub mod oracle;
pub mod postgres;
pub mod registry;
pub mod sqlite;

pub use dialect::{DbmsDialect, DbmsType};
pub use mssql::MsSqlDialect;
pub use mysql::MySqlDialect;
pub use oracle::OracleDialect;
pub use postgres::PostgreSqlDialect;
pub use registry::DialectRegistry;
pub use sqlite::SqliteDialect;
