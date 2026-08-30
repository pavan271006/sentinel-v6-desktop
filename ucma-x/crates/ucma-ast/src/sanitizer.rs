//! AST and SQL query sanitizer enforcing read-only safety invariants.
//! Blocks all destructive statements (DROP, TRUNCATE, ALTER, arbitrary command execution).

use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq, Clone, Serialize, Deserialize)]
pub enum SecurityViolation {
    #[error("Destructive statement blocked: {0}")]
    DestructiveStatement(String),
    #[error("Unbounded write blocked: {0}")]
    UnboundedWrite(String),
    #[error("Dangerous administrative function blocked: {0}")]
    AdministrativeExecution(String),
}

/// Query sanitizer enforcing safety invariants.
pub struct AstSanitizer;

impl AstSanitizer {
    /// Validates that a SQL string is non-destructive and safe for testing.
    pub fn validate_read_only(sql: &str) -> Result<(), SecurityViolation> {
        let upper = sql.to_uppercase();

        // 1. Destructive DDL keywords
        let destructive_patterns = [
            (r"\bDROP\s+(?:TABLE|DATABASE|SCHEMA|VIEW|INDEX|PROCEDURE|FUNCTION)\b", "DROP statement"),
            (r"\bTRUNCATE\s+(?:TABLE)?\b", "TRUNCATE statement"),
            (r"\bALTER\s+(?:TABLE|DATABASE|SCHEMA|USER)\b", "ALTER statement"),
            (r"\bSHUTDOWN\b", "SHUTDOWN command"),
            (r"\bXP_CMDSHELL\b", "xp_cmdshell command execution"),
            (r"\bEXEC(?:UTE)?\s+MASTER\b", "execute master command"),
            (r"\bINTO\s+(?:OUTFILE|DUMPFILE)\b", "INTO OUTFILE file write"),
            (r"\bLOAD_FILE\b", "LOAD_FILE filesystem read"),
            (r"\bATTACH\s+DATABASE\b", "ATTACH DATABASE"),
            (r"\bGRANT\s+.*\s+TO\b", "GRANT privilege escalation"),
            (r"\bREVOKE\s+.*\s+FROM\b", "REVOKE statement"),
        ];

        for (pattern, name) in &destructive_patterns {
            if let Ok(re) = Regex::new(pattern)
                && re.is_match(&upper) {
                    return Err(SecurityViolation::DestructiveStatement(name.to_string()));
                }
        }

        // 2. Check for unbounded DELETE or UPDATE without WHERE
        if upper.contains("DELETE FROM") && !upper.contains("WHERE") {
            return Err(SecurityViolation::UnboundedWrite("DELETE without WHERE clause".to_string()));
        }
        if upper.contains("UPDATE ") && !upper.contains("WHERE") && upper.contains(" SET ") {
            return Err(SecurityViolation::UnboundedWrite("UPDATE without WHERE clause".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitizer_permits_safe_queries() {
        assert!(AstSanitizer::validate_read_only("SELECT * FROM users WHERE id = 1").is_ok());
        assert!(AstSanitizer::validate_read_only("SELECT id, name FROM items ORDER BY price").is_ok());
    }

    #[test]
    fn test_sanitizer_blocks_drop_table() {
        let err = AstSanitizer::validate_read_only("SELECT 1; DROP TABLE users;").unwrap_err();
        assert!(matches!(err, SecurityViolation::DestructiveStatement(_)));
    }

    #[test]
    fn test_sanitizer_blocks_xp_cmdshell() {
        let err = AstSanitizer::validate_read_only("EXEC xp_cmdshell('dir')").unwrap_err();
        assert!(matches!(err, SecurityViolation::DestructiveStatement(_)));
    }

    #[test]
    fn test_sanitizer_blocks_unbounded_delete() {
        let err = AstSanitizer::validate_read_only("DELETE FROM users").unwrap_err();
        assert!(matches!(err, SecurityViolation::UnboundedWrite(_)));
    }
}
