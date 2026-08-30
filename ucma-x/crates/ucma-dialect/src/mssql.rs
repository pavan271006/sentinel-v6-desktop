//! Microsoft SQL Server (MSSQL) dialect implementation.

use crate::dialect::{DbmsDialect, DbmsType};

pub struct MsSqlDialect;

impl DbmsDialect for MsSqlDialect {
    fn name(&self) -> &'static str {
        "MSSQL"
    }

    fn dbms_type(&self) -> DbmsType {
        DbmsType::MsSql
    }

    fn quote_identifier(&self, ident: &str) -> String {
        let clean = ident.replace(']', "]]");
        format!("[{}]", clean)
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
            operands.join(" + ")
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
        "SELECT @@VERSION"
    }

    fn current_user_query(&self) -> &'static str {
        "SELECT SYSTEM_USER"
    }

    fn current_database_query(&self) -> &'static str {
        "SELECT DB_NAME()"
    }

    fn sleep_payload(&self, seconds: f64) -> String {
        let secs = seconds.round() as u64;
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        let rem_secs = secs % 60;
        format!("WAITFOR DELAY '{:02}:{:02}:{:02}'", hours, mins, rem_secs)
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
        "SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE'"
    }

    fn schema_columns_query(&self, table_name: &str) -> String {
        let clean = self.quote_string_literal(table_name);
        format!(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = {}",
            clean
        )
    }

    fn error_patterns(&self) -> Vec<&'static str> {
        vec![
            r"(?i)Unclosed quotation mark after the character string",
            r"(?i)Line \d+:\s*Incorrect syntax near",
            r"(?i)Microsoft OLE DB Provider for SQL Server",
            r"(?i)System\.Data\.SqlClient\.SqlException",
            r"(?i)\[Microsoft\]\[ODBC SQL Server Driver\]",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mssql_dialect() {
        let mssql = MsSqlDialect;
        assert_eq!(mssql.quote_identifier("my table"), "[my table]");
        assert_eq!(
            mssql.concat_expression(&["'foo'".to_string(), "'bar'".to_string()]),
            "'foo' + 'bar'"
        );
        assert_eq!(mssql.sleep_payload(5.0), "WAITFOR DELAY '00:00:05'");
    }
}
