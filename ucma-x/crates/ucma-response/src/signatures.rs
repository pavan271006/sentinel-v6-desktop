//! Comprehensive DBMS error signature catalog and regex matchers.
//! Detects explicit syntax errors, internal query faults, and driver exceptions across all major database engines.

use regex::Regex;
use serde::{Deserialize, Serialize};

/// Target Database Management System family.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DbmsType {
    PostgreSql,
    MySql,
    Sqlite,
    MsSql,
    Oracle,
    Db2,
    Informix,
    Sybase,
    GenericSql,
}

impl DbmsType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::PostgreSql => "PostgreSQL",
            Self::MySql => "MySQL/MariaDB",
            Self::Sqlite => "SQLite",
            Self::MsSql => "Microsoft SQL Server",
            Self::Oracle => "Oracle Database",
            Self::Db2 => "IBM DB2",
            Self::Informix => "IBM Informix",
            Self::Sybase => "Sybase/SAP ASE",
            Self::GenericSql => "Generic SQL",
        }
    }
}

/// An individual DBMS error signature definition.
#[derive(Debug, Clone)]
pub struct DbmsErrorSignature {
    pub dbms: DbmsType,
    pub pattern: Regex,
    pub error_code: Option<&'static str>,
    pub confidence: f32,
    pub description: &'static str,
}

/// Match result indicating a detected DBMS error signature in an HTTP response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DbmsErrorMatch {
    pub dbms: DbmsType,
    pub error_code: Option<String>,
    pub confidence: f32,
    pub matched_pattern: String,
    pub snippet: String,
    pub description: String,
}

/// Catalog and matcher for DBMS error signatures.
pub struct DbmsErrorCatalog {
    signatures: Vec<DbmsErrorSignature>,
}

impl Default for DbmsErrorCatalog {
    fn default() -> Self {
        Self::new()
    }
}

impl DbmsErrorCatalog {
    pub fn new() -> Self {
        let mut sigs = Vec::new();

        // ----------------------------------------------------
        // 1. PostgreSQL Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)ERROR:\s+syntax error at or near", Some("42601"), 0.99, "PostgreSQL syntax error");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)ERROR:\s+unterminated quoted string at or near", Some("42601"), 0.99, "PostgreSQL unterminated string");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)ERROR:\s+column \S+ does not exist", Some("42703"), 0.98, "PostgreSQL undefined column");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)ERROR:\s+relation \S+ does not exist", Some("42P01"), 0.98, "PostgreSQL undefined relation");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)PG::SyntaxError:", Some("PG::SyntaxError"), 0.99, "Ruby PG syntax error");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)org\.postgresql\.util\.PSQLException", None, 0.99, "Java PostgreSQL JDBC Exception");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)PostgreSQL query failed:", None, 0.95, "PHP pg_query error");
        Self::add_sig(&mut sigs, DbmsType::PostgreSql, r"(?i)invalid input syntax for (?:integer|type|uuid)", Some("22P02"), 0.95, "PostgreSQL invalid input syntax");

        // ----------------------------------------------------
        // 2. MySQL / MariaDB Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)You have an error in your SQL syntax;\s*check the manual that corresponds to your MySQL", Some("1064"), 0.99, "MySQL syntax error");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)You have an error in your SQL syntax;\s*check the manual that corresponds to your MariaDB", Some("1064"), 0.99, "MariaDB syntax error");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)com\.mysql\.jdbc\.exceptions", None, 0.99, "Java MySQL Connector Exception");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)MySQLSyntaxErrorException", Some("1064"), 0.99, "MySQL Syntax Exception");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)Table '\S+' doesn't exist", Some("1146"), 0.95, "MySQL table doesn't exist");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)Unknown column '\S+' in '(?:where clause|field list|order clause)'", Some("1054"), 0.98, "MySQL unknown column");
        Self::add_sig(&mut sigs, DbmsType::MySql, r"(?i)mysqli_query\(\):", None, 0.95, "PHP mysqli error");

        // ----------------------------------------------------
        // 3. SQLite Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r"(?i)near \S+:\s*syntax error", Some("SQLITE_ERROR"), 0.99, "SQLite syntax error near token");
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r#"(?i)unrecognized token:\s*["']"#, Some("SQLITE_ERROR"), 0.99, "SQLite unrecognized token");
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r"(?i)incomplete input", Some("SQLITE_ERROR"), 0.95, "SQLite incomplete input");
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r"(?i)SQLite3::SQLException", None, 0.99, "Ruby SQLite3 exception");
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r"(?i)no such (?:table|column):\s*\S+", Some("SQLITE_ERROR"), 0.95, "SQLite missing table/column");
        Self::add_sig(&mut sigs, DbmsType::Sqlite, r"(?i)datatype mismatch", Some("SQLITE_MISMATCH"), 0.95, "SQLite datatype mismatch");

        // ----------------------------------------------------
        // 4. Microsoft SQL Server (MSSQL) Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)Unclosed quotation mark after the character string", Some("105"), 0.99, "MSSQL unclosed quotation mark");
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)Line \d+:\s*Incorrect syntax near", Some("102"), 0.99, "MSSQL incorrect syntax near");
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)Microsoft OLE DB Provider for SQL Server", None, 0.99, "MSSQL OLE DB provider error");
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)System\.Data\.SqlClient\.SqlException", None, 0.99, ".NET SqlClient exception");
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)\[Microsoft\]\[ODBC SQL Server Driver\]", None, 0.99, "MSSQL ODBC Driver error");
        Self::add_sig(&mut sigs, DbmsType::MsSql, r"(?i)Conversion failed when converting the varchar value \S+ to data type int", Some("245"), 0.99, "MSSQL type conversion failure");

        // ----------------------------------------------------
        // 5. Oracle Database Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)ORA-00933:\s*SQL command not properly ended", Some("ORA-00933"), 0.99, "Oracle command not properly ended");
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)ORA-00904:\s*invalid identifier", Some("ORA-00904"), 0.98, "Oracle invalid identifier");
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)ORA-01756:\s*quoted string not properly terminated", Some("ORA-01756"), 0.99, "Oracle unterminated string");
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)ORA-00936:\s*missing expression", Some("ORA-00936"), 0.98, "Oracle missing expression");
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)Oracle\.DataAccess\.Client\.OracleException", None, 0.99, "Oracle DataAccess Exception");
        Self::add_sig(&mut sigs, DbmsType::Oracle, r"(?i)ORA-00942:\s*table or view does not exist", Some("ORA-00942"), 0.98, "Oracle table does not exist");

        // ----------------------------------------------------
        // 6. IBM DB2 & Informix Error Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::Db2, r"(?i)DB2 SQL Error:\s*SQLCODE=-\d+", None, 0.99, "IBM DB2 SQL Error");
        Self::add_sig(&mut sigs, DbmsType::Db2, r"(?i)\[IBM\]\[CLI Driver\]\[DB2/\S+\]", None, 0.99, "IBM DB2 CLI Driver");
        Self::add_sig(&mut sigs, DbmsType::Informix, r"(?i)Informix ODBC Driver", None, 0.99, "Informix ODBC Driver");
        Self::add_sig(&mut sigs, DbmsType::Informix, r"(?i)SQL syntax error has occurred", None, 0.95, "Informix SQL syntax error");

        // ----------------------------------------------------
        // 7. Sybase / SAP ASE
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::Sybase, r"(?i)Sybase message:", None, 0.98, "Sybase message");
        Self::add_sig(&mut sigs, DbmsType::Sybase, r"(?i)SybSQLException", None, 0.98, "Sybase SQL exception");

        // ----------------------------------------------------
        // 8. Generic SQL / ODBC / JDBC Signatures
        // ----------------------------------------------------
        Self::add_sig(&mut sigs, DbmsType::GenericSql, r"(?i)Syntax error in string in query expression", None, 0.90, "Access/JET syntax error");
        Self::add_sig(&mut sigs, DbmsType::GenericSql, r"(?i)java\.sql\.SQLException:\s*Syntax error", None, 0.92, "Generic JDBC syntax error");
        Self::add_sig(&mut sigs, DbmsType::GenericSql, r"(?i)ODBC SQL (?:Server )?Driver", None, 0.85, "Generic ODBC driver error");

        Self { signatures: sigs }
    }

    fn add_sig(
        sigs: &mut Vec<DbmsErrorSignature>,
        dbms: DbmsType,
        pattern_str: &str,
        error_code: Option<&'static str>,
        confidence: f32,
        description: &'static str,
    ) {
        if let Ok(pattern) = Regex::new(pattern_str) {
            sigs.push(DbmsErrorSignature {
                dbms,
                pattern,
                error_code,
                confidence,
                description,
            });
        }
    }

    /// Scans a response body for DBMS error signatures.
    pub fn find_error(&self, response_body: &str) -> Option<DbmsErrorMatch> {
        for sig in &self.signatures {
            if let Some(mat) = sig.pattern.find(response_body) {
                // Extract surrounding snippet up to 120 chars
                let start = mat.start().saturating_sub(20);
                let end = (mat.end() + 100).min(response_body.len());
                let snippet = response_body[start..end].replace(['\r', '\n'], " ");

                return Some(DbmsErrorMatch {
                    dbms: sig.dbms,
                    error_code: sig.error_code.map(String::from),
                    confidence: sig.confidence,
                    matched_pattern: sig.pattern.as_str().to_string(),
                    snippet,
                    description: sig.description.to_string(),
                });
            }
        }
        None
    }

    /// Finds all matching DBMS errors in the response body.
    pub fn find_all_errors(&self, response_body: &str) -> Vec<DbmsErrorMatch> {
        let mut matches = Vec::new();
        for sig in &self.signatures {
            if let Some(mat) = sig.pattern.find(response_body) {
                let start = mat.start().saturating_sub(20);
                let end = (mat.end() + 100).min(response_body.len());
                let snippet = response_body[start..end].replace(['\r', '\n'], " ");

                matches.push(DbmsErrorMatch {
                    dbms: sig.dbms,
                    error_code: sig.error_code.map(String::from),
                    confidence: sig.confidence,
                    matched_pattern: sig.pattern.as_str().to_string(),
                    snippet,
                    description: sig.description.to_string(),
                });
            }
        }
        matches
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_postgres_error_match() {
        let catalog = DbmsErrorCatalog::new();
        let body = "Fatal error: ERROR:  syntax error at or near \"admin\" at character 42 in query...";
        let matched = catalog.find_error(body).unwrap();
        assert_eq!(matched.dbms, DbmsType::PostgreSql);
        assert_eq!(matched.error_code.as_deref(), Some("42601"));
        assert!(matched.confidence >= 0.95);
    }

    #[test]
    fn test_mysql_error_match() {
        let catalog = DbmsErrorCatalog::new();
        let body = "SQLSTATE[42000]: You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''admin'' at line 1";
        let matched = catalog.find_error(body).unwrap();
        assert_eq!(matched.dbms, DbmsType::MySql);
        assert_eq!(matched.error_code.as_deref(), Some("1064"));
    }

    #[test]
    fn test_sqlite_error_match() {
        let catalog = DbmsErrorCatalog::new();
        let body = "SQLite3::SQLException: near \"xyz\": syntax error";
        let matched = catalog.find_error(body).unwrap();
        assert_eq!(matched.dbms, DbmsType::Sqlite);
    }

    #[test]
    fn test_mssql_error_match() {
        let catalog = DbmsErrorCatalog::new();
        let body = "Microsoft OLE DB Provider for SQL Server: Unclosed quotation mark after the character string 'admin'.";
        let matched = catalog.find_error(body).unwrap();
        assert_eq!(matched.dbms, DbmsType::MsSql);
    }

    #[test]
    fn test_oracle_error_match() {
        let catalog = DbmsErrorCatalog::new();
        let body = "ORA-01756: quoted string not properly terminated in EXECUTE IMMEDIATE...";
        let matched = catalog.find_error(body).unwrap();
        assert_eq!(matched.dbms, DbmsType::Oracle);
        assert_eq!(matched.error_code.as_deref(), Some("ORA-01756"));
    }

    #[test]
    fn test_clean_response_no_error() {
        let catalog = DbmsErrorCatalog::new();
        let body = "<html><body><h1>Welcome User</h1><p>Status: Active</p></body></html>";
        assert!(catalog.find_error(body).is_none());
    }
}
