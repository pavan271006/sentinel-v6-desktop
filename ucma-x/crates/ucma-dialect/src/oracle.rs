//! Oracle Database dialect implementation.

use crate::dialect::{DbmsDialect, DbmsType};

pub struct OracleDialect;

impl DbmsDialect for OracleDialect {
    fn name(&self) -> &'static str {
        "Oracle"
    }

    fn dbms_type(&self) -> DbmsType {
        DbmsType::Oracle
    }

    fn quote_identifier(&self, ident: &str) -> String {
        let clean = ident.replace('"', "\"\"");
        format!("\"{}\"", clean)
    }

    fn quote_string_literal(&self, val: &str) -> String {
        let clean = val.replace('\'', "''");
        format!("'{}'", clean)
    }

    fn concat_expression(&self, operands: &[String]) -> String {
        if operands.is_empty() {
            "''".to_string()
        } else if operands.len() == 1 {
            operands[0].clone()
        } else {
            operands.join(" || ")
        }
    }

    fn comment_syntax(&self, comment_text: &str, inline: bool) -> String {
        if inline {
            format!("/* {} */", comment_text)
        } else {
            format!("-- {}", comment_text)
        }
    }

    fn line_comment_prefix(&self) -> &'static str {
        "-- "
    }

    fn version_query(&self) -> &'static str {
        "SELECT banner FROM v$version WHERE ROWNUM = 1"
    }

    fn current_user_query(&self) -> &'static str {
        "SELECT USER FROM dual"
    }

    fn current_database_query(&self) -> &'static str {
        "SELECT ora_database_name FROM dual"
    }

    fn sleep_payload(&self, seconds: f64) -> String {
        let secs = seconds.round() as u64;
        format!("dbms_pipe.receive_message(('p'), {})", secs)
    }

    fn limit_offset_clause(&self, limit: Option<usize>, offset: Option<usize>) -> String {
        match (limit, offset) {
            (Some(l), Some(o)) => format!("OFFSET {} ROWS FETCH NEXT {} ROWS ONLY", o, l),
            (Some(l), None) => format!("OFFSET 0 ROWS FETCH NEXT {} ROWS ONLY", l),
            (None, Some(o)) => format!("OFFSET {} ROWS", o),
            (None, None) => String::new(),
        }
    }

    fn cast_syntax(&self, expr_sql: &str, target_type: &str) -> String {
        format!("CAST({} AS {})", expr_sql, target_type)
    }

    fn schema_tables_query(&self) -> &'static str {
        "SELECT table_name FROM all_tables WHERE owner = (SELECT user FROM dual)"
    }

    fn schema_columns_query(&self, table_name: &str) -> String {
        let clean = self.quote_string_literal(table_name.to_uppercase().as_str());
        format!(
            "SELECT column_name, data_type FROM all_tab_columns WHERE table_name = {}",
            clean
        )
    }

    fn error_patterns(&self) -> Vec<&'static str> {
        vec![
            r"(?i)ORA-00933:\s*SQL command not properly ended",
            r"(?i)ORA-00904:\s*invalid identifier",
            r"(?i)ORA-01756:\s*quoted string not properly terminated",
            r"(?i)ORA-00936:\s*missing expression",
            r"(?i)Oracle\.DataAccess\.Client\.OracleException",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oracle_dialect() {
        let oracle = OracleDialect;
        assert_eq!(oracle.quote_identifier("USER_TAB"), "\"USER_TAB\"");
        assert_eq!(oracle.version_query(), "SELECT banner FROM v$version WHERE ROWNUM = 1");
        assert_eq!(oracle.sleep_payload(4.0), "dbms_pipe.receive_message(('p'), 4)");
    }
}
