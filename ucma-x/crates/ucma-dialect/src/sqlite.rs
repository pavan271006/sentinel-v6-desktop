//! SQLite dialect implementation.

use crate::dialect::{DbmsDialect, DbmsType};

pub struct SqliteDialect;

impl DbmsDialect for SqliteDialect {
    fn name(&self) -> &'static str {
        "SQLite"
    }

    fn dbms_type(&self) -> DbmsType {
        DbmsType::Sqlite
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
        "SELECT sqlite_version()"
    }

    fn current_user_query(&self) -> &'static str {
        "SELECT ''"
    }

    fn current_database_query(&self) -> &'static str {
        "SELECT 'main'"
    }

    fn sleep_payload(&self, seconds: f64) -> String {
        // SQLite has no native sleep, so we generate a heavy compute/randomblob workload scaled by seconds
        let blob_size = ((seconds.max(0.1) * 25_000_000.0) as u64).min(100_000_000);
        format!(
            "(SELECT count(*) FROM (SELECT 1 UNION SELECT 2) WHERE LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB({})))))",
            blob_size
        )
    }

    fn limit_offset_clause(&self, limit: Option<usize>, offset: Option<usize>) -> String {
        match (limit, offset) {
            (Some(l), Some(o)) => format!("LIMIT {} OFFSET {}", l, o),
            (Some(l), None) => format!("LIMIT {}", l),
            (None, Some(o)) => format!("LIMIT -1 OFFSET {}", o),
            (None, None) => String::new(),
        }
    }

    fn cast_syntax(&self, expr_sql: &str, target_type: &str) -> String {
        format!("CAST({} AS {})", expr_sql, target_type)
    }

    fn schema_tables_query(&self) -> &'static str {
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    }

    fn schema_columns_query(&self, table_name: &str) -> String {
        format!("PRAGMA table_info({})", self.quote_identifier(table_name))
    }

    fn error_patterns(&self) -> Vec<&'static str> {
        vec![
            r"(?i)near \S+:\s*syntax error",
            r#"(?i)unrecognized token:\s*["']"#,
            r"(?i)incomplete input",
            r"(?i)SQLite3::SQLException",
            r"(?i)no such (?:table|column):",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_dialect() {
        let sqlite = SqliteDialect;
        assert_eq!(sqlite.quote_identifier("items"), "\"items\"");
        assert_eq!(sqlite.version_query(), "SELECT sqlite_version()");
        assert_eq!(
            sqlite.limit_offset_clause(Some(10), Some(20)),
            "LIMIT 10 OFFSET 20"
        );
    }
}
