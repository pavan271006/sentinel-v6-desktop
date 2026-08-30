//! MySQL / MariaDB dialect implementation.

use crate::dialect::{DbmsDialect, DbmsType};

pub struct MySqlDialect;

impl DbmsDialect for MySqlDialect {
    fn name(&self) -> &'static str {
        "MySQL"
    }

    fn dbms_type(&self) -> DbmsType {
        DbmsType::MySql
    }

    fn quote_identifier(&self, ident: &str) -> String {
        let clean = ident.replace('`', "``");
        format!("`{}`", clean)
    }

    fn quote_string_literal(&self, val: &str) -> String {
        let clean = val.replace('\\', "\\\\").replace('\'', "''");
        format!("'{}'", clean)
    }

    fn concat_expression(&self, operands: &[String]) -> String {
        if operands.is_empty() {
            "''".to_string()
        } else if operands.len() == 1 {
            operands[0].clone()
        } else {
            format!("CONCAT({})", operands.join(", "))
        }
    }

    fn comment_syntax(&self, comment_text: &str, inline: bool) -> String {
        if inline {
            format!("/* {} */", comment_text)
        } else {
            format!("# {}", comment_text)
        }
    }

    fn line_comment_prefix(&self) -> &'static str {
        "# "
    }

    fn version_query(&self) -> &'static str {
        "SELECT @@VERSION"
    }

    fn current_user_query(&self) -> &'static str {
        "SELECT USER()"
    }

    fn current_database_query(&self) -> &'static str {
        "SELECT DATABASE()"
    }

    fn sleep_payload(&self, seconds: f64) -> String {
        format!("SLEEP({})", seconds.round() as u64)
    }

    fn limit_offset_clause(&self, limit: Option<usize>, offset: Option<usize>) -> String {
        match (limit, offset) {
            (Some(l), Some(o)) => format!("LIMIT {}, {}", o, l),
            (Some(l), None) => format!("LIMIT {}", l),
            (None, Some(o)) => format!("LIMIT {}, 18446744073709551615", o),
            (None, None) => String::new(),
        }
    }

    fn cast_syntax(&self, expr_sql: &str, target_type: &str) -> String {
        format!("CAST({} AS {})", expr_sql, target_type)
    }

    fn schema_tables_query(&self) -> &'static str {
        "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    }

    fn schema_columns_query(&self, table_name: &str) -> String {
        let clean = self.quote_string_literal(table_name);
        format!(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = {}",
            clean
        )
    }

    fn error_patterns(&self) -> Vec<&'static str> {
        vec![
            r"(?i)You have an error in your SQL syntax",
            r"(?i)com\.mysql\.jdbc\.exceptions",
            r"(?i)MySQLSyntaxErrorException",
            r"(?i)Table '\S+' doesn't exist",
            r"(?i)Unknown column '\S+' in",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mysql_quoting_and_concat() {
        let mysql = MySqlDialect;
        assert_eq!(mysql.quote_identifier("users"), "`users`");
        assert_eq!(mysql.quote_string_literal("O'Reilly"), "'O''Reilly'");
        assert_eq!(
            mysql.concat_expression(&["'a'".to_string(), "'b'".to_string()]),
            "CONCAT('a', 'b')"
        );
        assert_eq!(mysql.sleep_payload(3.0), "SLEEP(3)");
    }
}
