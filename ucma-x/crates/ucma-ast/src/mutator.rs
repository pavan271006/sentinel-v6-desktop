//! Boundary injection mutator for AST-guided metamorphic and differential payload generation.

use crate::parser::SqlAstParser;
use crate::renderer::AstRenderer;
use ucma_dialect::DbmsDialect;
use ucma_parameter::InjectionContext;
use ucma_sql_ir::{BinaryOpIr, ExpressionIr, MutationScanner, SemanticMutator};

/// Candidate metamorphic probe pair.
#[derive(Debug, Clone, PartialEq)]
pub struct MetamorphicProbePair {
    pub tautology_sql: String,
    pub contradiction_sql: String,
    pub original_sql: String,
    pub point_id: usize,
    pub context: InjectionContext,
}

/// AST-guided boundary injection mutator.
pub struct BoundaryInjectionMutator;

impl BoundaryInjectionMutator {
    /// Generates tautology and contradiction probe pairs for every identified mutation point in a SQL query.
    pub fn generate_boundary_probes(
        sql: &str,
        dialect: &dyn DbmsDialect,
    ) -> Vec<MetamorphicProbePair> {
        let ast = match SqlAstParser::parse(sql) {
            Ok(a) => a,
            Err(_) => return Vec::new(),
        };

        let ir = match ast.to_ir() {
            Some(i) => i,
            None => return Vec::new(),
        };

        let points = MutationScanner::scan_points(&ir);
        let mut pairs = Vec::new();

        for pt in points {
            let (tautology_expr, contradiction_expr) = match &pt.inferred_context {
                InjectionContext::Numeric => (
                    ExpressionIr::binary(
                        pt.original_expr.clone(),
                        BinaryOpIr::Or,
                        ExpressionIr::binary(
                            ExpressionIr::int(1),
                            BinaryOpIr::Eq,
                            ExpressionIr::int(1),
                        ),
                    ),
                    ExpressionIr::binary(
                        pt.original_expr.clone(),
                        BinaryOpIr::And,
                        ExpressionIr::binary(
                            ExpressionIr::int(1),
                            BinaryOpIr::Eq,
                            ExpressionIr::int(2),
                        ),
                    ),
                ),
                _ => (
                    ExpressionIr::binary(
                        pt.original_expr.clone(),
                        BinaryOpIr::Or,
                        ExpressionIr::binary(
                            ExpressionIr::string("1"),
                            BinaryOpIr::Eq,
                            ExpressionIr::string("1"),
                        ),
                    ),
                    ExpressionIr::binary(
                        pt.original_expr.clone(),
                        BinaryOpIr::And,
                        ExpressionIr::binary(
                            ExpressionIr::string("1"),
                            BinaryOpIr::Eq,
                            ExpressionIr::string("2"),
                        ),
                    ),
                ),
            };

            let tautology_ir = SemanticMutator::replace_point(&ir, pt.point_id, tautology_expr);
            let contradiction_ir =
                SemanticMutator::replace_point(&ir, pt.point_id, contradiction_expr);

            let taut_sql = AstRenderer::render_statement(&tautology_ir.statement, dialect);
            let cont_sql = AstRenderer::render_statement(&contradiction_ir.statement, dialect);

            pairs.push(MetamorphicProbePair {
                tautology_sql: taut_sql,
                contradiction_sql: cont_sql,
                original_sql: sql.to_string(),
                point_id: pt.point_id,
                context: pt.inferred_context,
            });
        }

        pairs
    }

    /// Injects an inline trailing comment truncation probe into a parameter value.
    pub fn create_comment_truncation(
        prefix_val: &str,
        injected_sql: &str,
        dialect: &dyn DbmsDialect,
    ) -> String {
        format!(
            "{}{}{}",
            prefix_val,
            injected_sql,
            dialect.line_comment_prefix()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_dialect::PostgreSqlDialect;

    #[test]
    fn test_generate_boundary_probes() {
        let pg = PostgreSqlDialect;
        let sql = "SELECT username FROM users WHERE id = 10";
        let pairs = BoundaryInjectionMutator::generate_boundary_probes(sql, &pg);

        assert!(!pairs.is_empty());
        let numeric_probe = pairs
            .iter()
            .find(|p| p.context == InjectionContext::Numeric)
            .unwrap();
        assert!(numeric_probe.tautology_sql.contains("1 = 1"));
        assert!(numeric_probe.contradiction_sql.contains("1 = 2"));
    }
}
