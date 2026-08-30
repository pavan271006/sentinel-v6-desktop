//! Recursive-descent SQL AST parser for parsing SQL queries into structured AST trees.

use crate::ast::{AstNode, SqlAst};
use ucma_sql_ir::{
    BinaryOpIr, DeleteIr, ExpressionIr, InsertIr, LimitOffsetIr, OrderByIr,
    OrderDirection, ProjectionIr, SelectIr, StatementIr, TableRefIr, UpdateIr,
};

/// SQL AST Parser.
pub struct SqlAstParser;

impl SqlAstParser {
    /// Parses an SQL string into a SqlAst tree.
    pub fn parse(sql: &str) -> Result<SqlAst, String> {
        let tokens = Self::tokenize(sql);
        if tokens.is_empty() {
            return Err("Empty SQL query".to_string());
        }

        let first = tokens[0].to_uppercase();
        let stmt = match first.as_str() {
            "SELECT" => StatementIr::Select(Self::parse_select(&tokens)?),
            "INSERT" => StatementIr::Insert(Self::parse_insert(&tokens)?),
            "UPDATE" => StatementIr::Update(Self::parse_update(&tokens)?),
            "DELETE" => StatementIr::Delete(Self::parse_delete(&tokens)?),
            _ => StatementIr::Raw(sql.to_string()),
        };

        Ok(SqlAst::new(AstNode::Statement(stmt)))
    }

    fn tokenize(sql: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut chars = sql.chars().peekable();

        while let Some(&c) = chars.peek() {
            if c.is_whitespace() {
                chars.next();
            } else if c == '\'' || c == '"' || c == '`' || c == '[' {
                let quote = c;
                let close_quote = if quote == '[' { ']' } else { quote };
                chars.next();
                let mut s = String::new();
                s.push(quote);
                for ch in chars.by_ref() {
                    s.push(ch);
                    if ch == close_quote {
                        break;
                    }
                }
                tokens.push(s);
            } else if c == ',' || c == '(' || c == ')' || c == ';' {
                chars.next();
                tokens.push(c.to_string());
            } else if c == '=' || c == '<' || c == '>' || c == '!' {
                chars.next();
                let mut op = c.to_string();
                if let Some(&next_c) = chars.peek()
                    && (next_c == '=' || next_c == '>') {
                        chars.next();
                        op.push(next_c);
                    }
                tokens.push(op);
            } else {
                let mut word = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_whitespace()
                        || ch == ','
                        || ch == '('
                        || ch == ')'
                        || ch == ';'
                        || ch == '='
                        || ch == '<'
                        || ch == '>'
                        || ch == '!'
                        || ch == '\''
                        || ch == '"'
                        || ch == '`'
                    {
                        break;
                    }
                    word.push(ch);
                    chars.next();
                }
                tokens.push(word);
            }
        }

        tokens
    }

    fn parse_select(tokens: &[String]) -> Result<SelectIr, String> {
        let mut select = SelectIr::default();
        let mut idx = 1; // skip SELECT

        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("DISTINCT") {
            select.distinct = true;
            idx += 1;
        }

        // Parse projections up to FROM, WHERE, or EOF
        let mut proj_tokens = Vec::new();
        while idx < tokens.len() {
            let t = &tokens[idx];
            if t.eq_ignore_ascii_case("FROM")
                || t.eq_ignore_ascii_case("WHERE")
                || t.eq_ignore_ascii_case("ORDER")
                || t.eq_ignore_ascii_case("LIMIT")
                || t == ";"
            {
                break;
            }
            proj_tokens.push(t.clone());
            idx += 1;
        }

        select.projections = Self::parse_projection_list(&proj_tokens)?;

        // FROM clause
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("FROM") {
            idx += 1;
            if idx < tokens.len() {
                let table_name = Self::strip_quotes(&tokens[idx]);
                idx += 1;
                let alias = if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("AS") {
                    idx += 1;
                    let a = tokens.get(idx).map(|s| Self::strip_quotes(s));
                    if a.is_some() {
                        idx += 1;
                    }
                    a
                } else if idx < tokens.len()
                    && !tokens[idx].eq_ignore_ascii_case("WHERE")
                    && !tokens[idx].eq_ignore_ascii_case("ORDER")
                    && !tokens[idx].eq_ignore_ascii_case("LIMIT")
                    && tokens[idx] != ";"
                {
                    let a = Some(Self::strip_quotes(&tokens[idx]));
                    idx += 1;
                    a
                } else {
                    None
                };

                select.from = Some(TableRefIr::Table {
                    name: table_name,
                    schema: None,
                    alias,
                });
            }
        }

        // WHERE clause
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("WHERE") {
            idx += 1;
            let mut where_tokens = Vec::new();
            while idx < tokens.len() {
                let t = &tokens[idx];
                if t.eq_ignore_ascii_case("ORDER")
                    || t.eq_ignore_ascii_case("GROUP")
                    || t.eq_ignore_ascii_case("LIMIT")
                    || t == ";"
                {
                    break;
                }
                where_tokens.push(t.clone());
                idx += 1;
            }
            select.where_clause = Some(Self::parse_expression_tokens(&where_tokens)?);
        }

        // ORDER BY clause
        if idx + 1 < tokens.len()
            && tokens[idx].eq_ignore_ascii_case("ORDER")
            && tokens[idx + 1].eq_ignore_ascii_case("BY")
        {
            idx += 2;
            let mut order_tokens = Vec::new();
            while idx < tokens.len() {
                let t = &tokens[idx];
                if t.eq_ignore_ascii_case("LIMIT") || t == ";" {
                    break;
                }
                order_tokens.push(t.clone());
                idx += 1;
            }
            select.order_by = Self::parse_order_by_list(&order_tokens)?;
        }

        // LIMIT / OFFSET clause
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("LIMIT") {
            idx += 1;
            let limit = if idx < tokens.len() {
                let l = tokens[idx].parse::<usize>().ok();
                idx += 1;
                l
            } else {
                None
            };

            let mut offset = None;
            if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("OFFSET") {
                idx += 1;
                if idx < tokens.len() {
                    offset = tokens[idx].parse::<usize>().ok();
                }
            }

            select.limit_offset = Some(LimitOffsetIr { limit, offset });
        }

        Ok(select)
    }

    fn parse_insert(tokens: &[String]) -> Result<InsertIr, String> {
        let mut idx = 1; // skip INSERT
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("INTO") {
            idx += 1;
        }

        let table_name = if idx < tokens.len() {
            let t = Self::strip_quotes(&tokens[idx]);
            idx += 1;
            t
        } else {
            return Err("Missing table name in INSERT".to_string());
        };

        let mut columns = Vec::new();
        if idx < tokens.len() && tokens[idx] == "(" {
            idx += 1;
            while idx < tokens.len() && tokens[idx] != ")" {
                if tokens[idx] != "," {
                    columns.push(Self::strip_quotes(&tokens[idx]));
                }
                idx += 1;
            }
            if idx < tokens.len() && tokens[idx] == ")" {
                idx += 1;
            }
        }

        let mut values = Vec::new();
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("VALUES") {
            idx += 1;
            if idx < tokens.len() && tokens[idx] == "(" {
                idx += 1;
                let mut row = Vec::new();
                while idx < tokens.len() && tokens[idx] != ")" {
                    if tokens[idx] != "," {
                        row.push(Self::parse_atom(&tokens[idx]));
                    }
                    idx += 1;
                }
                values.push(row);
            }
        }

        Ok(InsertIr {
            table: TableRefIr::simple(table_name),
            columns,
            values,
            query: None,
        })
    }

    fn parse_update(tokens: &[String]) -> Result<UpdateIr, String> {
        let mut idx = 1; // skip UPDATE
        let table_name = if idx < tokens.len() {
            let t = Self::strip_quotes(&tokens[idx]);
            idx += 1;
            t
        } else {
            return Err("Missing table name in UPDATE".to_string());
        };

        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("SET") {
            idx += 1;
        }

        let mut assignments = Vec::new();
        while idx < tokens.len() && !tokens[idx].eq_ignore_ascii_case("WHERE") && tokens[idx] != ";" {
            let col = Self::strip_quotes(&tokens[idx]);
            idx += 1;
            if idx < tokens.len() && tokens[idx] == "=" {
                idx += 1;
            }
            if idx < tokens.len() {
                let val = Self::parse_atom(&tokens[idx]);
                assignments.push((col, val));
                idx += 1;
            }
            if idx < tokens.len() && tokens[idx] == "," {
                idx += 1;
            }
        }

        let mut where_clause = None;
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("WHERE") {
            idx += 1;
            let mut where_tokens = Vec::new();
            while idx < tokens.len() && tokens[idx] != ";" {
                where_tokens.push(tokens[idx].clone());
                idx += 1;
            }
            where_clause = Some(Self::parse_expression_tokens(&where_tokens)?);
        }

        Ok(UpdateIr {
            table: TableRefIr::simple(table_name),
            assignments,
            where_clause,
        })
    }

    fn parse_delete(tokens: &[String]) -> Result<DeleteIr, String> {
        let mut idx = 1; // skip DELETE
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("FROM") {
            idx += 1;
        }

        let table_name = if idx < tokens.len() {
            let t = Self::strip_quotes(&tokens[idx]);
            idx += 1;
            t
        } else {
            return Err("Missing table name in DELETE".to_string());
        };

        let mut where_clause = None;
        if idx < tokens.len() && tokens[idx].eq_ignore_ascii_case("WHERE") {
            idx += 1;
            let mut where_tokens = Vec::new();
            while idx < tokens.len() && tokens[idx] != ";" {
                where_tokens.push(tokens[idx].clone());
                idx += 1;
            }
            where_clause = Some(Self::parse_expression_tokens(&where_tokens)?);
        }

        Ok(DeleteIr {
            table: TableRefIr::simple(table_name),
            where_clause,
        })
    }

    fn parse_projection_list(tokens: &[String]) -> Result<Vec<ProjectionIr>, String> {
        let mut projections = Vec::new();
        if tokens.is_empty() {
            return Ok(vec![ProjectionIr::All]);
        }

        let items: Vec<&[String]> = tokens.split(|t| t == ",").collect();
        for item in items {
            if item.is_empty() {
                continue;
            }
            if item.len() == 1 && item[0] == "*" {
                projections.push(ProjectionIr::All);
            } else if item.len() == 3 && item[1].eq_ignore_ascii_case("AS") {
                let expr = Self::parse_atom(&item[0]);
                let alias = Some(Self::strip_quotes(&item[2]));
                projections.push(ProjectionIr::Column { expr, alias });
            } else {
                let expr = Self::parse_expression_tokens(item)?;
                projections.push(ProjectionIr::Column { expr, alias: None });
            }
        }

        Ok(projections)
    }

    fn parse_order_by_list(tokens: &[String]) -> Result<Vec<OrderByIr>, String> {
        let mut orders = Vec::new();
        let items: Vec<&[String]> = tokens.split(|t| t == ",").collect();

        for item in items {
            if item.is_empty() {
                continue;
            }
            let mut dir = OrderDirection::Asc;
            let mut expr_tokens = Vec::new();

            for t in item {
                if t.eq_ignore_ascii_case("ASC") {
                    dir = OrderDirection::Asc;
                } else if t.eq_ignore_ascii_case("DESC") {
                    dir = OrderDirection::Desc;
                } else {
                    expr_tokens.push(t.clone());
                }
            }

            let expr = Self::parse_expression_tokens(&expr_tokens)?;
            orders.push(OrderByIr {
                expr,
                direction: dir,
                nulls_order: None,
            });
        }

        Ok(orders)
    }

    fn parse_expression_tokens(tokens: &[String]) -> Result<ExpressionIr, String> {
        if tokens.is_empty() {
            return Err("Empty expression".to_string());
        }

        // Check for OR operator at top level
        for (i, t) in tokens.iter().enumerate() {
            if t.eq_ignore_ascii_case("OR") && i > 0 && i < tokens.len() - 1 {
                let left = Self::parse_expression_tokens(&tokens[..i])?;
                let right = Self::parse_expression_tokens(&tokens[i + 1..])?;
                return Ok(ExpressionIr::binary(left, BinaryOpIr::Or, right));
            }
        }

        // Check for AND operator
        for (i, t) in tokens.iter().enumerate() {
            if t.eq_ignore_ascii_case("AND") && i > 0 && i < tokens.len() - 1 {
                let left = Self::parse_expression_tokens(&tokens[..i])?;
                let right = Self::parse_expression_tokens(&tokens[i + 1..])?;
                return Ok(ExpressionIr::binary(left, BinaryOpIr::And, right));
            }
        }

        // Check comparison operators
        for (i, t) in tokens.iter().enumerate() {
            let op = match t.as_str() {
                "=" => Some(BinaryOpIr::Eq),
                "<>" | "!=" => Some(BinaryOpIr::NotEq),
                "<" => Some(BinaryOpIr::Lt),
                "<=" => Some(BinaryOpIr::Lte),
                ">" => Some(BinaryOpIr::Gt),
                ">=" => Some(BinaryOpIr::Gte),
                "LIKE" | "like" => Some(BinaryOpIr::Like),
                _ => None,
            };

            if let Some(binary_op) = op
                && i > 0 && i < tokens.len() - 1 {
                    let left = Self::parse_expression_tokens(&tokens[..i])?;
                    let right = Self::parse_expression_tokens(&tokens[i + 1..])?;
                    return Ok(ExpressionIr::binary(left, binary_op, right));
                }
        }

        // Single atom or parenthesized expression
        if tokens.len() == 1 {
            return Ok(Self::parse_atom(&tokens[0]));
        }

        if tokens.first().map(|s| s.as_str()) == Some("(") && tokens.last().map(|s| s.as_str()) == Some(")") {
            let inner = Self::parse_expression_tokens(&tokens[1..tokens.len() - 1])?;
            return Ok(ExpressionIr::Parenthesized(Box::new(inner)));
        }

        Ok(Self::parse_atom(&tokens.join(" ")))
    }

    fn parse_atom(token: &str) -> ExpressionIr {
        let trimmed = token.trim();
        if trimmed.eq_ignore_ascii_case("NULL") {
            ExpressionIr::null()
        } else if trimmed.eq_ignore_ascii_case("TRUE") {
            ExpressionIr::bool(true)
        } else if trimmed.eq_ignore_ascii_case("FALSE") {
            ExpressionIr::bool(false)
        } else if let Ok(n) = trimmed.parse::<i64>() {
            ExpressionIr::int(n)
        } else if let Ok(f) = trimmed.parse::<f64>() {
            ExpressionIr::float(f)
        } else if (trimmed.starts_with('\'') && trimmed.ends_with('\''))
            || (trimmed.starts_with('"') && trimmed.ends_with('"'))
        {
            let val = &trimmed[1..trimmed.len() - 1];
            ExpressionIr::string(val.replace("''", "'"))
        } else {
            ExpressionIr::ident(Self::strip_quotes(trimmed))
        }
    }

    fn strip_quotes(s: &str) -> String {
        let t = s.trim();
        if (t.starts_with('"') && t.ends_with('"'))
            || (t.starts_with('`') && t.ends_with('`'))
            || (t.starts_with('[') && t.ends_with(']'))
            || (t.starts_with('\'') && t.ends_with('\''))
        {
            t[1..t.len() - 1].to_string()
        } else {
            t.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_select_query() {
        let sql = "SELECT id, username AS user, role FROM users WHERE id = 42 AND active = true ORDER BY id DESC LIMIT 10 OFFSET 20";
        let ast = SqlAstParser::parse(sql).unwrap();

        match ast.root {
            AstNode::Statement(StatementIr::Select(s)) => {
                assert_eq!(s.projections.len(), 3);
                assert!(s.where_clause.is_some());
                assert_eq!(s.order_by.len(), 1);
                assert_eq!(s.order_by[0].direction, OrderDirection::Desc);
                assert_eq!(s.limit_offset.unwrap().limit, Some(10));
                assert_eq!(s.limit_offset.unwrap().offset, Some(20));
            }
            _ => panic!("Expected Select"),
        }
    }

    #[test]
    fn test_parse_insert_query() {
        let sql = "INSERT INTO users (name, age) VALUES ('Alice', 30)";
        let ast = SqlAstParser::parse(sql).unwrap();
        match ast.root {
            AstNode::Statement(StatementIr::Insert(i)) => {
                assert_eq!(i.columns, vec!["name", "age"]);
                assert_eq!(i.values.len(), 1);
                assert_eq!(i.values[0].len(), 2);
            }
            _ => panic!("Expected Insert"),
        }
    }
}
