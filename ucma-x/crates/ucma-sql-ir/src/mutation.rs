//! Semantic mutation point detection and injection boundary conditions for SQL IR.

use crate::ir::{ExpressionIr, ProjectionIr, SelectIr, SqlSemanticIr, StatementIr};
use crate::types::LiteralIr;
use serde::{Deserialize, Serialize};
use ucma_parameter::InjectionContext;

/// A detected semantic injection point within an IR expression tree.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MutationPoint {
    pub point_id: usize,
    pub path: String,
    pub original_expr: ExpressionIr,
    pub inferred_context: InjectionContext,
}

/// Scanner that identifies all testable injection sites in a SQL IR tree.
pub struct MutationScanner;

impl MutationScanner {
    /// Scans a SqlSemanticIr and extracts all candidate mutation points.
    pub fn scan_points(ir: &SqlSemanticIr) -> Vec<MutationPoint> {
        let mut points = Vec::new();
        let mut next_id = 1;

        match &ir.statement {
            StatementIr::Select(select) => {
                Self::scan_select(select, "select", &mut next_id, &mut points);
            }
            StatementIr::Insert(insert) => {
                for (r_idx, row) in insert.values.iter().enumerate() {
                    for (c_idx, expr) in row.iter().enumerate() {
                        let path = format!("insert.values[{}][{}]", r_idx, c_idx);
                        Self::scan_expr(expr, &path, &mut next_id, &mut points);
                    }
                }
            }
            StatementIr::Update(update) => {
                for (k, expr) in &update.assignments {
                    let path = format!("update.set.{}", k);
                    Self::scan_expr(expr, &path, &mut next_id, &mut points);
                }
                if let Some(w) = &update.where_clause {
                    Self::scan_expr(w, "update.where", &mut next_id, &mut points);
                }
            }
            StatementIr::Delete(delete) => {
                if let Some(w) = &delete.where_clause {
                    Self::scan_expr(w, "delete.where", &mut next_id, &mut points);
                }
            }
            StatementIr::Union(union_ir) => {
                let left_ir = SqlSemanticIr {
                    statement: *union_ir.left.clone(),
                };
                let right_ir = SqlSemanticIr {
                    statement: *union_ir.right.clone(),
                };
                points.extend(Self::scan_points(&left_ir));
                points.extend(Self::scan_points(&right_ir));
            }
            StatementIr::Raw(_) => {}
        }

        points
    }

    fn scan_select(
        select: &SelectIr,
        path: &str,
        next_id: &mut usize,
        points: &mut Vec<MutationPoint>,
    ) {
        // Scan projections
        for (i, proj) in select.projections.iter().enumerate() {
            if let ProjectionIr::Column { expr, .. } = proj {
                let proj_path = format!("{}.proj[{}]", path, i);
                Self::scan_expr(expr, &proj_path, next_id, points);
            }
        }

        // Scan WHERE clause
        if let Some(where_clause) = &select.where_clause {
            let where_path = format!("{}.where", path);
            Self::scan_expr(where_clause, &where_path, next_id, points);
        }

        // Scan HAVING clause
        if let Some(having) = &select.having {
            let having_path = format!("{}.having", path);
            Self::scan_expr(having, &having_path, next_id, points);
        }

        // Scan ORDER BY clause
        for (i, order) in select.order_by.iter().enumerate() {
            let order_path = format!("{}.orderby[{}]", path, i);
            Self::scan_expr(&order.expr, &order_path, next_id, points);
        }
    }

    fn scan_expr(
        expr: &ExpressionIr,
        path: &str,
        next_id: &mut usize,
        points: &mut Vec<MutationPoint>,
    ) {
        match expr {
            ExpressionIr::Literal(lit) => {
                let context = match lit {
                    LiteralIr::Integer(_) | LiteralIr::Float(_) => InjectionContext::Numeric,
                    LiteralIr::String(_) => InjectionContext::SingleQuoteString,
                    LiteralIr::Boolean(_) => InjectionContext::Numeric,
                    LiteralIr::Null | LiteralIr::Blob(_) => InjectionContext::Unknown("literal".to_string()),
                };

                points.push(MutationPoint {
                    point_id: *next_id,
                    path: path.to_string(),
                    original_expr: expr.clone(),
                    inferred_context: context,
                });
                *next_id += 1;
            }
            ExpressionIr::Identifier(_) => {
                points.push(MutationPoint {
                    point_id: *next_id,
                    path: path.to_string(),
                    original_expr: expr.clone(),
                    inferred_context: InjectionContext::DoubleQuoteIdentifier,
                });
                *next_id += 1;
            }
            ExpressionIr::BinaryOp { left, right, .. } => {
                Self::scan_expr(left, &format!("{}.left", path), next_id, points);
                Self::scan_expr(right, &format!("{}.right", path), next_id, points);
            }
            ExpressionIr::UnaryOp { expr, .. } => {
                Self::scan_expr(expr, &format!("{}.expr", path), next_id, points);
            }
            ExpressionIr::Function(func) => {
                for (i, arg) in func.args.iter().enumerate() {
                    Self::scan_expr(arg, &format!("{}.arg[{}]", path, i), next_id, points);
                }
            }
            ExpressionIr::Parenthesized(inner) => {
                Self::scan_expr(inner, &format!("{}.inner", path), next_id, points);
            }
            ExpressionIr::BoundaryInjectionPoint { original, .. } => {
                Self::scan_expr(original, path, next_id, points);
            }
            _ => {}
        }
    }
}

/// Mutates a SQL IR tree by replacing a specific mutation point with a target injection expression.
pub struct SemanticMutator;

impl SemanticMutator {
    /// Mutates an expression tree at a given point_id.
    pub fn replace_point(
        ir: &SqlSemanticIr,
        target_point_id: usize,
        replacement: ExpressionIr,
    ) -> SqlSemanticIr {
        let mut new_ir = ir.clone();
        let mut curr_id = 1;

        match &mut new_ir.statement {
            StatementIr::Select(select) => {
                Self::mutate_select(select, target_point_id, &replacement, &mut curr_id);
            }
            StatementIr::Update(update) => {
                for (_, expr) in &mut update.assignments {
                    Self::mutate_expr(expr, target_point_id, &replacement, &mut curr_id);
                }
                if let Some(w) = &mut update.where_clause {
                    Self::mutate_expr(w, target_point_id, &replacement, &mut curr_id);
                }
            }
            StatementIr::Delete(delete) => {
                if let Some(w) = &mut delete.where_clause {
                    Self::mutate_expr(w, target_point_id, &replacement, &mut curr_id);
                }
            }
            _ => {}
        }

        new_ir
    }

    fn mutate_select(
        select: &mut SelectIr,
        target_id: usize,
        replacement: &ExpressionIr,
        curr_id: &mut usize,
    ) {
        for proj in &mut select.projections {
            if let ProjectionIr::Column { expr, .. } = proj {
                Self::mutate_expr(expr, target_id, replacement, curr_id);
            }
        }
        if let Some(where_clause) = &mut select.where_clause {
            Self::mutate_expr(where_clause, target_id, replacement, curr_id);
        }
        for o in &mut select.order_by {
            Self::mutate_expr(&mut o.expr, target_id, replacement, curr_id);
        }
    }

    fn mutate_expr(
        expr: &mut ExpressionIr,
        target_id: usize,
        replacement: &ExpressionIr,
        curr_id: &mut usize,
    ) {
        match expr {
            ExpressionIr::Literal(_) | ExpressionIr::Identifier(_) => {
                if *curr_id == target_id {
                    *expr = replacement.clone();
                }
                *curr_id += 1;
            }
            ExpressionIr::BinaryOp { left, right, .. } => {
                Self::mutate_expr(left, target_id, replacement, curr_id);
                Self::mutate_expr(right, target_id, replacement, curr_id);
            }
            ExpressionIr::UnaryOp { expr: inner, .. } => {
                Self::mutate_expr(inner, target_id, replacement, curr_id);
            }
            ExpressionIr::Parenthesized(inner) => {
                Self::mutate_expr(inner, target_id, replacement, curr_id);
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ir::TableRefIr;
    use crate::types::BinaryOpIr;

    #[test]
    fn test_scan_and_mutate_points() {
        let select = SelectIr {
            from: Some(TableRefIr::simple("users")),
            where_clause: Some(ExpressionIr::binary(
                ExpressionIr::ident("id"),
                BinaryOpIr::Eq,
                ExpressionIr::int(100),
            )),
            ..Default::default()
        };

        let ir = SqlSemanticIr::select(select);
        let points = MutationScanner::scan_points(&ir);
        assert_eq!(points.len(), 2); // 'id' identifier (point 1) and '100' int literal (point 2)

        assert_eq!(points[1].point_id, 2);
        assert_eq!(points[1].inferred_context, InjectionContext::Numeric);

        // Mutate point 2 with `100 OR 1=1`
        let injected = ExpressionIr::binary(
            ExpressionIr::int(100),
            BinaryOpIr::Or,
            ExpressionIr::binary(ExpressionIr::int(1), BinaryOpIr::Eq, ExpressionIr::int(1)),
        );

        let mutated_ir = SemanticMutator::replace_point(&ir, 2, injected);
        let mutated_points = MutationScanner::scan_points(&mutated_ir);
        assert_eq!(mutated_points.len(), 4); // id, 100, 1, 1
    }
}
