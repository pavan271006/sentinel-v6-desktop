//! Dialect-aware SQL AST renderer.
//! Serializes AST/IR trees into valid SQL according to the target DBMS dialect rules.

use crate::ast::AstNode;
use ucma_dialect::DbmsDialect;
use ucma_sql_ir::{
    BinaryOpIr, DeleteIr, ExpressionIr, FunctionIr, InsertIr, JoinTypeIr, LimitOffsetIr, LiteralIr,
    NullsOrder, OrderByIr, OrderDirection, ProjectionIr, SelectIr, StatementIr, TableRefIr,
    UnaryOpIr, UnionIr, UpdateIr,
};

/// Dialect-aware SQL Serializer/Renderer.
pub struct AstRenderer;

impl AstRenderer {
    /// Renders any AST node into a dialect-formatted SQL string.
    pub fn render(node: &AstNode, dialect: &dyn DbmsDialect) -> String {
        match node {
            AstNode::Statement(stmt) => Self::render_statement(stmt, dialect),
            AstNode::Expression(expr) => Self::render_expression(expr, dialect),
            AstNode::Table(table) => Self::render_table_ref(table, dialect),
            AstNode::Projection(proj) => Self::render_projection(proj, dialect),
        }
    }

    /// Renders a top-level SQL Statement.
    pub fn render_statement(stmt: &StatementIr, dialect: &dyn DbmsDialect) -> String {
        match stmt {
            StatementIr::Select(select) => Self::render_select(select, dialect),
            StatementIr::Insert(insert) => Self::render_insert(insert, dialect),
            StatementIr::Update(update) => Self::render_update(update, dialect),
            StatementIr::Delete(delete) => Self::render_delete(delete, dialect),
            StatementIr::Union(union_ir) => Self::render_union(union_ir, dialect),
            StatementIr::Raw(raw) => raw.clone(),
        }
    }

    /// Renders a SELECT query.
    pub fn render_select(select: &SelectIr, dialect: &dyn DbmsDialect) -> String {
        let mut parts = Vec::new();
        parts.push("SELECT".to_string());

        if select.distinct {
            parts.push("DISTINCT".to_string());
        }

        // Projections
        if select.projections.is_empty() {
            parts.push("*".to_string());
        } else {
            let projs: Vec<String> = select
                .projections
                .iter()
                .map(|p| Self::render_projection(p, dialect))
                .collect();
            parts.push(projs.join(", "));
        }

        // FROM
        if let Some(from) = &select.from {
            parts.push(format!("FROM {}", Self::render_table_ref(from, dialect)));
        }

        // WHERE
        if let Some(where_clause) = &select.where_clause {
            parts.push(format!(
                "WHERE {}",
                Self::render_expression(where_clause, dialect)
            ));
        }

        // GROUP BY
        if !select.group_by.is_empty() {
            let groups: Vec<String> = select
                .group_by
                .iter()
                .map(|g| Self::render_expression(g, dialect))
                .collect();
            parts.push(format!("GROUP BY {}", groups.join(", ")));
        }

        // HAVING
        if let Some(having) = &select.having {
            parts.push(format!(
                "HAVING {}",
                Self::render_expression(having, dialect)
            ));
        }

        // ORDER BY
        if !select.order_by.is_empty() {
            let orders: Vec<String> = select
                .order_by
                .iter()
                .map(|o| Self::render_order_by(o, dialect))
                .collect();
            parts.push(format!("ORDER BY {}", orders.join(", ")));
        }

        // LIMIT / OFFSET
        if let Some(LimitOffsetIr { limit, offset }) = select.limit_offset {
            let clause = dialect.limit_offset_clause(limit, offset);
            if !clause.is_empty() {
                parts.push(clause);
            }
        }

        parts.join(" ")
    }

    /// Renders an INSERT query.
    pub fn render_insert(insert: &InsertIr, dialect: &dyn DbmsDialect) -> String {
        let table_sql = Self::render_table_ref(&insert.table, dialect);
        let cols_sql = if insert.columns.is_empty() {
            String::new()
        } else {
            let cols: Vec<String> = insert
                .columns
                .iter()
                .map(|c| dialect.quote_identifier(c))
                .collect();
            format!(" ({})", cols.join(", "))
        };

        if let Some(query) = &insert.query {
            format!("INSERT INTO {}{} {}", table_sql, cols_sql, Self::render_select(query, dialect))
        } else {
            let rows: Vec<String> = insert
                .values
                .iter()
                .map(|row| {
                    let items: Vec<String> = row
                        .iter()
                        .map(|e| Self::render_expression(e, dialect))
                        .collect();
                    format!("({})", items.join(", "))
                })
                .collect();
            format!("INSERT INTO {}{} VALUES {}", table_sql, cols_sql, rows.join(", "))
        }
    }

    /// Renders an UPDATE query.
    pub fn render_update(update: &UpdateIr, dialect: &dyn DbmsDialect) -> String {
        let table_sql = Self::render_table_ref(&update.table, dialect);
        let assigns: Vec<String> = update
            .assignments
            .iter()
            .map(|(k, v)| {
                format!(
                    "{} = {}",
                    dialect.quote_identifier(k),
                    Self::render_expression(v, dialect)
                )
            })
            .collect();

        let mut sql = format!("UPDATE {} SET {}", table_sql, assigns.join(", "));
        if let Some(where_clause) = &update.where_clause {
            sql.push_str(&format!(
                " WHERE {}",
                Self::render_expression(where_clause, dialect)
            ));
        }
        sql
    }

    /// Renders a DELETE query.
    pub fn render_delete(delete: &DeleteIr, dialect: &dyn DbmsDialect) -> String {
        let table_sql = Self::render_table_ref(&delete.table, dialect);
        let mut sql = format!("DELETE FROM {}", table_sql);
        if let Some(where_clause) = &delete.where_clause {
            sql.push_str(&format!(
                " WHERE {}",
                Self::render_expression(where_clause, dialect)
            ));
        }
        sql
    }

    /// Renders a UNION query.
    pub fn render_union(union_ir: &UnionIr, dialect: &dyn DbmsDialect) -> String {
        let left_sql = Self::render_statement(&union_ir.left, dialect);
        let right_sql = Self::render_statement(&union_ir.right, dialect);
        let op = if union_ir.is_all { "UNION ALL" } else { "UNION" };
        format!("{} {} {}", left_sql, op, right_sql)
    }

    /// Renders an individual column projection.
    pub fn render_projection(proj: &ProjectionIr, dialect: &dyn DbmsDialect) -> String {
        match proj {
            ProjectionIr::All => "*".to_string(),
            ProjectionIr::AllFrom(table) => format!("{}.*", dialect.quote_identifier(table)),
            ProjectionIr::Column { expr, alias } => {
                let expr_sql = Self::render_expression(expr, dialect);
                if let Some(a) = alias {
                    format!("{} AS {}", expr_sql, dialect.quote_identifier(a))
                } else {
                    expr_sql
                }
            }
        }
    }

    /// Renders a table reference or JOIN hierarchy.
    pub fn render_table_ref(table: &TableRefIr, dialect: &dyn DbmsDialect) -> String {
        match table {
            TableRefIr::Table { name, schema, alias } => {
                let mut full_name = if let Some(s) = schema {
                    format!("{}.{}", dialect.quote_identifier(s), dialect.quote_identifier(name))
                } else {
                    dialect.quote_identifier(name)
                };
                if let Some(a) = alias {
                    full_name.push_str(&format!(" AS {}", dialect.quote_identifier(a)));
                }
                full_name
            }
            TableRefIr::Subquery { query, alias } => {
                format!(
                    "({}) AS {}",
                    Self::render_select(query, dialect),
                    dialect.quote_identifier(alias)
                )
            }
            TableRefIr::Join {
                left,
                right,
                join_type,
                condition,
            } => {
                let left_sql = Self::render_table_ref(left, dialect);
                let right_sql = Self::render_table_ref(right, dialect);
                let join_str = match join_type {
                    JoinTypeIr::Inner => "INNER JOIN",
                    JoinTypeIr::LeftOuter => "LEFT JOIN",
                    JoinTypeIr::RightOuter => "RIGHT JOIN",
                    JoinTypeIr::FullOuter => "FULL OUTER JOIN",
                    JoinTypeIr::Cross => "CROSS JOIN",
                    JoinTypeIr::Natural => "NATURAL JOIN",
                };
                if let Some(cond) = condition {
                    format!(
                        "{} {} {} ON {}",
                        left_sql,
                        join_str,
                        right_sql,
                        Self::render_expression(cond, dialect)
                    )
                } else {
                    format!("{} {} {}", left_sql, join_str, right_sql)
                }
            }
        }
    }

    /// Renders an ORDER BY element.
    pub fn render_order_by(order: &OrderByIr, dialect: &dyn DbmsDialect) -> String {
        let mut sql = Self::render_expression(&order.expr, dialect);
        match order.direction {
            OrderDirection::Asc => sql.push_str(" ASC"),
            OrderDirection::Desc => sql.push_str(" DESC"),
        }
        if let Some(nulls) = &order.nulls_order {
            match nulls {
                NullsOrder::NullsFirst => sql.push_str(" NULLS FIRST"),
                NullsOrder::NullsLast => sql.push_str(" NULLS LAST"),
            }
        }
        sql
    }

    /// Renders an SQL Expression with dialect awareness.
    pub fn render_expression(expr: &ExpressionIr, dialect: &dyn DbmsDialect) -> String {
        match expr {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => "NULL".to_string(),
                LiteralIr::Integer(i) => i.to_string(),
                LiteralIr::Float(f) => f.to_string(),
                LiteralIr::String(s) => dialect.quote_string_literal(s),
                LiteralIr::Boolean(b) => {
                    if *b {
                        "TRUE".to_string()
                    } else {
                        "FALSE".to_string()
                    }
                }
                LiteralIr::Blob(bytes) => format!("0x{}", hex::encode(bytes)),
            },
            ExpressionIr::Identifier(ident) => {
                if let Some(q) = &ident.qualifier {
                    format!("{}.{}", dialect.quote_identifier(q), dialect.quote_identifier(&ident.name))
                } else {
                    dialect.quote_identifier(&ident.name)
                }
            }
            ExpressionIr::BinaryOp { left, op, right } => {
                let l_sql = Self::render_expression(left, dialect);
                let r_sql = Self::render_expression(right, dialect);

                if *op == BinaryOpIr::Concat {
                    dialect.concat_expression(&[l_sql, r_sql])
                } else {
                    format!("{} {} {}", l_sql, op.as_sql_operator(), r_sql)
                }
            }
            ExpressionIr::UnaryOp { op, expr } => {
                let inner_sql = Self::render_expression(expr, dialect);
                match op {
                    UnaryOpIr::Not => format!("NOT ({})", inner_sql),
                    UnaryOpIr::Neg => format!("-{}", inner_sql),
                    UnaryOpIr::Plus => format!("+{}", inner_sql),
                    UnaryOpIr::IsNull => format!("{} IS NULL", inner_sql),
                    UnaryOpIr::IsNotNull => format!("{} IS NOT NULL", inner_sql),
                    UnaryOpIr::BitwiseNot => format!("~{}", inner_sql),
                }
            }
            ExpressionIr::Function(FunctionIr { name, args, .. }) => {
                let args_sql: Vec<String> = args
                    .iter()
                    .map(|a| Self::render_expression(a, dialect))
                    .collect();
                format!("{}({})", name, args_sql.join(", "))
            }
            ExpressionIr::Subquery(sub) => {
                format!("({})", Self::render_select(sub, dialect))
            }
            ExpressionIr::InList { expr, list, negated } => {
                let expr_sql = Self::render_expression(expr, dialect);
                let list_sql: Vec<String> = list
                    .iter()
                    .map(|i| Self::render_expression(i, dialect))
                    .collect();
                let not_str = if *negated { "NOT " } else { "" };
                format!("{} {}IN ({})", expr_sql, not_str, list_sql.join(", "))
            }
            ExpressionIr::InSubquery {
                expr,
                subquery,
                negated,
            } => {
                let expr_sql = Self::render_expression(expr, dialect);
                let sub_sql = Self::render_select(subquery, dialect);
                let not_str = if *negated { "NOT " } else { "" };
                format!("{} {}IN ({})", expr_sql, not_str, sub_sql)
            }
            ExpressionIr::Between {
                expr,
                low,
                high,
                negated,
            } => {
                let expr_sql = Self::render_expression(expr, dialect);
                let low_sql = Self::render_expression(low, dialect);
                let high_sql = Self::render_expression(high, dialect);
                let not_str = if *negated { "NOT " } else { "" };
                format!("{} {}BETWEEN {} AND {}", expr_sql, not_str, low_sql, high_sql)
            }
            ExpressionIr::Case {
                operand,
                when_then,
                else_expr,
            } => {
                let mut parts = Vec::new();
                parts.push("CASE".to_string());
                if let Some(op) = operand {
                    parts.push(Self::render_expression(op, dialect));
                }
                for (w, t) in when_then {
                    parts.push(format!(
                        "WHEN {} THEN {}",
                        Self::render_expression(w, dialect),
                        Self::render_expression(t, dialect)
                    ));
                }
                if let Some(el) = else_expr {
                    parts.push(format!("ELSE {}", Self::render_expression(el, dialect)));
                }
                parts.push("END".to_string());
                parts.join(" ")
            }
            ExpressionIr::Cast { expr, target_type } => {
                let inner = Self::render_expression(expr, dialect);
                dialect.cast_syntax(&inner, target_type)
            }
            ExpressionIr::Exists { subquery, negated } => {
                let sub_sql = Self::render_select(subquery, dialect);
                let not_str = if *negated { "NOT " } else { "" };
                format!("{}EXISTS ({})", not_str, sub_sql)
            }
            ExpressionIr::Parenthesized(inner) => {
                format!("({})", Self::render_expression(inner, dialect))
            }
            ExpressionIr::BoundaryInjectionPoint { original, .. } => {
                Self::render_expression(original, dialect)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_dialect::{MsSqlDialect, MySqlDialect, PostgreSqlDialect};

    #[test]
    fn test_render_select_postgres() {
        let pg = PostgreSqlDialect;
        let mut select = SelectIr::default();
        select.projections.push(ProjectionIr::Column {
            expr: ExpressionIr::ident("username"),
            alias: None,
        });
        select.from = Some(TableRefIr::simple("users"));
        select.where_clause = Some(ExpressionIr::binary(
            ExpressionIr::ident("id"),
            BinaryOpIr::Eq,
            ExpressionIr::int(42),
        ));
        select.limit_offset = Some(LimitOffsetIr {
            limit: Some(10),
            offset: Some(0),
        });

        let sql = AstRenderer::render_select(&select, &pg);
        assert_eq!(
            sql,
            "SELECT \"username\" FROM \"users\" WHERE \"id\" = 42 LIMIT 10 OFFSET 0"
        );
    }

    #[test]
    fn test_render_concat_mysql_vs_postgres() {
        let pg = PostgreSqlDialect;
        let my = MySqlDialect;

        let expr = ExpressionIr::binary(
            ExpressionIr::string("hello "),
            BinaryOpIr::Concat,
            ExpressionIr::string("world"),
        );

        assert_eq!(AstRenderer::render_expression(&expr, &pg), "'hello ' || 'world'");
        assert_eq!(
            AstRenderer::render_expression(&expr, &my),
            "CONCAT('hello ', 'world')"
        );
    }

    #[test]
    fn test_render_mssql_brackets() {
        let mssql = MsSqlDialect;
        let mut select = SelectIr::default();
        select.projections.push(ProjectionIr::Column {
            expr: ExpressionIr::ident("user name"),
            alias: None,
        });
        select.from = Some(TableRefIr::simple("user table"));

        let sql = AstRenderer::render_select(&select, &mssql);
        assert_eq!(sql, "SELECT [user name] FROM [user table]");
    }
}
