//! Dialect Registry for dynamically retrieving and detecting SQL DBMS dialects.

use crate::dialect::{DbmsDialect, DbmsType};
use crate::mssql::MsSqlDialect;
use crate::mysql::MySqlDialect;
use crate::oracle::OracleDialect;
use crate::postgres::PostgreSqlDialect;
use crate::sqlite::SqliteDialect;
use std::sync::Arc;

/// Dialect Registry providing shared instances of DBMS dialects.
pub struct DialectRegistry;

impl DialectRegistry {
    /// Returns the dialect implementation for a given DBMS type.
    pub fn get(dbms_type: DbmsType) -> Arc<dyn DbmsDialect> {
        match dbms_type {
            DbmsType::PostgreSql => Arc::new(PostgreSqlDialect),
            DbmsType::MySql => Arc::new(MySqlDialect),
            DbmsType::Sqlite => Arc::new(SqliteDialect),
            DbmsType::MsSql => Arc::new(MsSqlDialect),
            DbmsType::Oracle => Arc::new(OracleDialect),
            DbmsType::GenericSql => Arc::new(PostgreSqlDialect), // standard ANSI SQL fallback
        }
    }

    /// Looks up a dialect by canonical name or alias.
    pub fn from_name(name: &str) -> Option<Arc<dyn DbmsDialect>> {
        let n = name.to_lowercase();
        if n.contains("postgres") || n == "pg" || n == "psql" {
            Some(Self::get(DbmsType::PostgreSql))
        } else if n.contains("mysql") || n.contains("maria") {
            Some(Self::get(DbmsType::MySql))
        } else if n.contains("sqlite") || n == "sqlite3" {
            Some(Self::get(DbmsType::Sqlite))
        } else if n.contains("mssql") || n.contains("sqlserver") || n.contains("microsoft") {
            Some(Self::get(DbmsType::MsSql))
        } else if n.contains("oracle") || n == "ora" {
            Some(Self::get(DbmsType::Oracle))
        } else {
            None
        }
    }

    /// Detects a dialect from a server banner string or error message.
    pub fn detect_from_banner(text: &str) -> Option<Arc<dyn DbmsDialect>> {
        let lower = text.to_lowercase();
        if lower.contains("postgresql") || lower.contains("postgres") || lower.contains("pg_") {
            Some(Self::get(DbmsType::PostgreSql))
        } else if lower.contains("mysql") || lower.contains("mariadb") {
            Some(Self::get(DbmsType::MySql))
        } else if lower.contains("sqlite") {
            Some(Self::get(DbmsType::Sqlite))
        } else if lower.contains("microsoft sql server") || lower.contains("sql server") || lower.contains("mssql") {
            Some(Self::get(DbmsType::MsSql))
        } else if lower.contains("oracle") || lower.contains("ora-") {
            Some(Self::get(DbmsType::Oracle))
        } else {
            None
        }
    }

    /// Returns a list of all registered primary dialects.
    pub fn all_dialects() -> Vec<Arc<dyn DbmsDialect>> {
        vec![
            Arc::new(PostgreSqlDialect),
            Arc::new(MySqlDialect),
            Arc::new(SqliteDialect),
            Arc::new(MsSqlDialect),
            Arc::new(OracleDialect),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_lookups() {
        let pg = DialectRegistry::from_name("postgresql").unwrap();
        assert_eq!(pg.dbms_type(), DbmsType::PostgreSql);

        let my = DialectRegistry::from_name("mariadb").unwrap();
        assert_eq!(my.dbms_type(), DbmsType::MySql);

        let banner_ora = "Oracle Database 19c Enterprise Edition Release 19.0.0.0.0";
        let detected = DialectRegistry::detect_from_banner(banner_ora).unwrap();
        assert_eq!(detected.dbms_type(), DbmsType::Oracle);
    }
}
