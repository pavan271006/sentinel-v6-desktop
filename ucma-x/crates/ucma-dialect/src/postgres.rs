//! PostgreSQL dialect implementation.

use crate::dialect::{DbmsDialect, DbmsType};

pub struct PostgreSqlDialect;

impl DbmsDialect for PostgreSqlDialect {
    fn name(&self) -> &'static str {
        "PostgreSQL"
    }

    fn dbms_type(&self) -> DbmsType {
        DbmsType::PostgreSql
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
        "SELECT VERSION()"
    }

    fn current_user_query(&self) -> &'static str {
        "SELECT CURRENT_USER"
    }

    fn current_database_query(&self) -> &'static str {
        "SELECT CURRENT_DATABASE()"
    }

    fn sleep_payload(&self, seconds: f64) -> String {
        format!("pg_sleep({:.2})", seconds)
    }

    fn limit_offset_clause(&self, limit: Option<usize>, offset: Option<usize>) -> String {
        match (limit, offset) {
            (Some(l), Some(o)) => format!("LIMIT {} OFFSET {}", l, o),
            (Some(l), None) => format!("LIMIT {}", l),
            (None, Some(o)) => format!("OFFSET {}", o),
            (None, None) => String::new(),
        }
    }

    fn cast_syntax(&self, expr_sql: &str, target_type: &str) -> String {
        format!("CAST({} AS {})", expr_sql, target_type)
    }

    fn schema_tables_query(&self) -> &'static str {
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
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
            r"(?i)ERROR:\s+syntax error at or near",
            r"(?i)ERROR:\s+unterminated quoted string",
            r"(?i)PG::SyntaxError:",
            r"(?i)org\.postgresql\.util\.PSQLException",
            r"(?i)invalid input syntax for",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_postgres_quoting_and_concat() {
        let pg = PostgreSqlDialect;
        assert_eq!(pg.quote_identifier("my_col"), "\"my_col\"");
        assert_eq!(pg.quote_string_literal("admin'--"), "'admin''--'");
        assert_eq!(
            pg.concat_expression(&["'a'".to_string(), "'b'".to_string()]),
            "'a' || 'b'"
        );
        assert_eq!(pg.sleep_payload(2.5), "pg_sleep(2.50)");
    }
}
