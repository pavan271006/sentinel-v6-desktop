//! Dialect-aware SQL Abstract Syntax Tree (AST) definitions.

use serde::{Deserialize, Serialize};
use ucma_sql_ir::{ExpressionIr, ProjectionIr, SqlSemanticIr, StatementIr, TableRefIr};

/// An SQL AST node container.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
pub enum AstNode {
    Statement(StatementIr),
    Expression(ExpressionIr),
    Table(TableRefIr),
    Projection(ProjectionIr),
}

/// Abstract Syntax Tree root representation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SqlAst {
    pub root: AstNode,
}

impl SqlAst {
    pub fn new(root: AstNode) -> Self {
        Self { root }
    }

    pub fn from_statement(stmt: StatementIr) -> Self {
        Self {
            root: AstNode::Statement(stmt),
        }
    }

    pub fn from_ir(ir: &SqlSemanticIr) -> Self {
        Self {
            root: AstNode::Statement(ir.statement.clone()),
        }
    }

    pub fn to_ir(&self) -> Option<SqlSemanticIr> {
        match &self.root {
            AstNode::Statement(stmt) => Some(SqlSemanticIr {
                statement: stmt.clone(),
            }),
            _ => None,
        }
    }
}
