//! DBMS Dialect trait and core abstractions.

use serde::{Deserialize, Serialize};

/// Target Database Management System family.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DbmsType {
    PostgreSql,
    MySql,
    Sqlite,
    MsSql,
    Oracle,
    GenericSql,
}

impl DbmsType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PostgreSql => "PostgreSQL",
            Self::MySql => "MySQL",
            Self::Sqlite => "SQLite",
            Self::MsSql => "MSSQL",
            Self::Oracle => "Oracle",
            Self::GenericSql => "Generic",
        }
    }
}

/// Abstract contract for DBMS dialect syntax rules, quoting, operators, and payloads.
pub trait DbmsDialect: Send + Sync {
    /// Name of this dialect.
    fn name(&self) -> &'static str;

    /// Corresponding DBMS enum type.
    fn dbms_type(&self) -> DbmsType;

    /// Quotes an SQL identifier (column/table) per dialect rules.
    fn quote_identifier(&self, ident: &str) -> String;

    /// Quotes and escapes a string literal.
    fn quote_string_literal(&self, val: &str) -> String;

    /// Generates dialect-specific string concatenation.
    fn concat_expression(&self, operands: &[String]) -> String;

    /// Formats a comment (inline or line-ending).
    fn comment_syntax(&self, comment_text: &str, inline: bool) -> String;

    /// Single line comment prefix (e.g. `-- ` or `#`).
    fn line_comment_prefix(&self) -> &'static str;

    /// Version fingerprint SQL query.
    fn version_query(&self) -> &'static str;

    /// Current user SQL query.
    fn current_user_query(&self) -> &'static str;

    /// Current database/schema name SQL query.
    fn current_database_query(&self) -> &'static str;

    /// Safe time-delay SQL payload for timing inference (in seconds).
    fn sleep_payload(&self, seconds: f64) -> String;

    /// Generates a LIMIT / OFFSET clause.
    fn limit_offset_clause(&self, limit: Option<usize>, offset: Option<usize>) -> String;

    /// Generates a type CAST expression.
    fn cast_syntax(&self, expr_sql: &str, target_type: &str) -> String;

    /// SQL query for listing tables.
    fn schema_tables_query(&self) -> &'static str;

    /// SQL query for listing columns of a table.
    fn schema_columns_query(&self, table_name: &str) -> String;

    /// Returns regular expression patterns matching this dialect's syntax errors.
    fn error_patterns(&self) -> Vec<&'static str>;
}
