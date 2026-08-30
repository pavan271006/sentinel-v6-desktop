//! AST/IR Visitor trait for traversing and mutating SQL IR expression trees.

use crate::ir::{ExpressionIr, FunctionIr, ProjectionIr, SelectIr, StatementIr, TableRefIr};

/// Read-only visitor trait for SQL IR trees.
pub trait IrVisitor {
    fn visit_statement(&mut self, stmt: &StatementIr) {
        match stmt {
            StatementIr::Select(select) => self.visit_select(select),
            StatementIr::Insert(insert) => {
                for row in &insert.values {
                    for expr in row {
                        self.visit_expression(expr);
                    }
                }
                if let Some(q) = &insert.query {
                    self.visit_select(q);
                }
            }
            StatementIr::Update(update) => {
                for (_, expr) in &update.assignments {
                    self.visit_expression(expr);
                }
                if let Some(w) = &update.where_clause {
                    self.visit_expression(w);
                }
            }
            StatementIr::Delete(delete) => {
                if let Some(w) = &delete.where_clause {
                    self.visit_expression(w);
                }
            }
            StatementIr::Union(union_ir) => {
                self.visit_statement(&union_ir.left);
                self.visit_statement(&union_ir.right);
            }
            StatementIr::Raw(_) => {}
        }
    }

    fn visit_select(&mut self, select: &SelectIr) {
        for proj in &select.projections {
            if let ProjectionIr::Column { expr, .. } = proj {
                self.visit_expression(expr);
            }
        }
        if let Some(from) = &select.from {
            self.visit_table_ref(from);
        }
        if let Some(where_clause) = &select.where_clause {
            self.visit_expression(where_clause);
        }
        for g in &select.group_by {
            self.visit_expression(g);
        }
        if let Some(having) = &select.having {
            self.visit_expression(having);
        }
        for o in &select.order_by {
            self.visit_expression(&o.expr);
        }
    }

    fn visit_table_ref(&mut self, table: &TableRefIr) {
        match table {
            TableRefIr::Table { .. } => {}
            TableRefIr::Subquery { query, .. } => self.visit_select(query),
            TableRefIr::Join {
                left,
                right,
                condition,
                ..
            } => {
                self.visit_table_ref(left);
                self.visit_table_ref(right);
                if let Some(cond) = condition {
                    self.visit_expression(cond);
                }
            }
        }
    }

    fn visit_expression(&mut self, expr: &ExpressionIr) {
        match expr {
            ExpressionIr::Literal(_) | ExpressionIr::Identifier(_) => {}
            ExpressionIr::BinaryOp { left, right, .. } => {
                self.visit_expression(left);
                self.visit_expression(right);
            }
            ExpressionIr::UnaryOp { expr, .. } => {
                self.visit_expression(expr);
            }
            ExpressionIr::Function(FunctionIr { args, .. }) => {
                for arg in args {
                    self.visit_expression(arg);
                }
            }
            ExpressionIr::Subquery(sub) => {
                self.visit_select(sub);
            }
            ExpressionIr::InList { expr, list, .. } => {
                self.visit_expression(expr);
                for item in list {
                    self.visit_expression(item);
                }
            }
            ExpressionIr::InSubquery { expr, subquery, .. } => {
                self.visit_expression(expr);
                self.visit_select(subquery);
            }
            ExpressionIr::Between {
                expr, low, high, ..
            } => {
                self.visit_expression(expr);
                self.visit_expression(low);
                self.visit_expression(high);
            }
            ExpressionIr::Case {
                operand,
                when_then,
                else_expr,
            } => {
                if let Some(op) = operand {
                    self.visit_expression(op);
                }
                for (w, t) in when_then {
                    self.visit_expression(w);
                    self.visit_expression(t);
                }
                if let Some(el) = else_expr {
                    self.visit_expression(el);
                }
            }
            ExpressionIr::Cast { expr, .. } => {
                self.visit_expression(expr);
            }
            ExpressionIr::Exists { subquery, .. } => {
                self.visit_select(subquery);
            }
            ExpressionIr::Parenthesized(inner) => {
                self.visit_expression(inner);
            }
            ExpressionIr::BoundaryInjectionPoint { original, .. } => {
                self.visit_expression(original);
            }
        }
    }
}
