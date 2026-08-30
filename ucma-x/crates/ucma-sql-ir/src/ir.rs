//! Dialect-neutral SQL Semantic Intermediate Representation (IR).

use crate::types::{
    BinaryOpIr, IdentifierIr, JoinTypeIr, LiteralIr, NullsOrder, OrderDirection, UnaryOpIr,
};
use serde::{Deserialize, Serialize};
use ucma_parameter::InjectionContext;

/// Function call representation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FunctionIr {
    pub name: String,
    pub args: Vec<ExpressionIr>,
    pub is_aggregate: bool,
}

/// SQL Expression representation in the Semantic IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ExpressionIr {
    Literal(LiteralIr),
    Identifier(IdentifierIr),
    BinaryOp {
        left: Box<ExpressionIr>,
        op: BinaryOpIr,
        right: Box<ExpressionIr>,
    },
    UnaryOp {
        op: UnaryOpIr,
        expr: Box<ExpressionIr>,
    },
    Function(FunctionIr),
    Subquery(Box<SelectIr>),
    InList {
        expr: Box<ExpressionIr>,
        list: Vec<ExpressionIr>,
        negated: bool,
    },
    InSubquery {
        expr: Box<ExpressionIr>,
        subquery: Box<SelectIr>,
        negated: bool,
    },
    Between {
        expr: Box<ExpressionIr>,
        low: Box<ExpressionIr>,
        high: Box<ExpressionIr>,
        negated: bool,
    },
    Case {
        operand: Option<Box<ExpressionIr>>,
        when_then: Vec<(ExpressionIr, ExpressionIr)>,
        else_expr: Option<Box<ExpressionIr>>,
    },
    Cast {
        expr: Box<ExpressionIr>,
        target_type: String,
    },
    Exists {
        subquery: Box<SelectIr>,
        negated: bool,
    },
    Parenthesized(Box<ExpressionIr>),
    BoundaryInjectionPoint {
        original: Box<ExpressionIr>,
        context: InjectionContext,
        point_id: usize,
    },
}

impl ExpressionIr {
    pub fn int(val: i64) -> Self {
        Self::Literal(LiteralIr::Integer(val))
    }

    pub fn float(val: f64) -> Self {
        Self::Literal(LiteralIr::Float(val))
    }

    pub fn string(val: impl Into<String>) -> Self {
        Self::Literal(LiteralIr::String(val.into()))
    }

    pub fn bool(val: bool) -> Self {
        Self::Literal(LiteralIr::Boolean(val))
    }

    pub fn null() -> Self {
        Self::Literal(LiteralIr::Null)
    }

    pub fn ident(name: impl Into<String>) -> Self {
        Self::Identifier(IdentifierIr::simple(name))
    }

    pub fn qualified_ident(qualifier: impl Into<String>, name: impl Into<String>) -> Self {
        Self::Identifier(IdentifierIr::qualified(qualifier, name))
    }

    pub fn binary(left: ExpressionIr, op: BinaryOpIr, right: ExpressionIr) -> Self {
        Self::BinaryOp {
            left: Box::new(left),
            op,
            right: Box::new(right),
        }
    }

    pub fn unary(op: UnaryOpIr, expr: ExpressionIr) -> Self {
        Self::UnaryOp {
            op,
            expr: Box::new(expr),
        }
    }
}

/// Column projection in a SELECT statement.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ProjectionIr {
    All,
    AllFrom(String),
    Column {
        expr: ExpressionIr,
        alias: Option<String>,
    },
}

/// Table reference in a FROM or JOIN clause.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TableRefIr {
    Table {
        name: String,
        schema: Option<String>,
        alias: Option<String>,
    },
    Subquery {
        query: Box<SelectIr>,
        alias: String,
    },
    Join {
        left: Box<TableRefIr>,
        right: Box<TableRefIr>,
        join_type: JoinTypeIr,
        condition: Option<ExpressionIr>,
    },
}

impl TableRefIr {
    pub fn simple(name: impl Into<String>) -> Self {
        Self::Table {
            name: name.into(),
            schema: None,
            alias: None,
        }
    }

    pub fn with_alias(name: impl Into<String>, alias: impl Into<String>) -> Self {
        Self::Table {
            name: name.into(),
            schema: None,
            alias: Some(alias.into()),
        }
    }
}

/// Order By item.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderByIr {
    pub expr: ExpressionIr,
    pub direction: OrderDirection,
    pub nulls_order: Option<NullsOrder>,
}

/// Limit and Offset clause.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct LimitOffsetIr {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Dialect-neutral SELECT statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[derive(Default)]
pub struct SelectIr {
    pub distinct: bool,
    pub projections: Vec<ProjectionIr>,
    pub from: Option<TableRefIr>,
    pub where_clause: Option<ExpressionIr>,
    pub group_by: Vec<ExpressionIr>,
    pub having: Option<ExpressionIr>,
    pub order_by: Vec<OrderByIr>,
    pub limit_offset: Option<LimitOffsetIr>,
}


/// INSERT statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InsertIr {
    pub table: TableRefIr,
    pub columns: Vec<String>,
    pub values: Vec<Vec<ExpressionIr>>,
    pub query: Option<Box<SelectIr>>,
}

/// UPDATE statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UpdateIr {
    pub table: TableRefIr,
    pub assignments: Vec<(String, ExpressionIr)>,
    pub where_clause: Option<ExpressionIr>,
}

/// DELETE statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeleteIr {
    pub table: TableRefIr,
    pub where_clause: Option<ExpressionIr>,
}

/// UNION statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UnionIr {
    pub left: Box<StatementIr>,
    pub right: Box<StatementIr>,
    pub is_all: bool,
}

/// Top-level SQL statement IR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum StatementIr {
    Select(SelectIr),
    Insert(InsertIr),
    Update(UpdateIr),
    Delete(DeleteIr),
    Union(UnionIr),
    Raw(String),
}

/// Complete Semantic IR container for a SQL unit.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SqlSemanticIr {
    pub statement: StatementIr,
}

impl SqlSemanticIr {
    pub fn select(select: SelectIr) -> Self {
        Self {
            statement: StatementIr::Select(select),
        }
    }

    pub fn insert(insert: InsertIr) -> Self {
        Self {
            statement: StatementIr::Insert(insert),
        }
    }

    pub fn update(update: UpdateIr) -> Self {
        Self {
            statement: StatementIr::Update(update),
        }
    }

    pub fn delete(delete: DeleteIr) -> Self {
        Self {
            statement: StatementIr::Delete(delete),
        }
    }

    pub fn raw(sql: impl Into<String>) -> Self {
        Self {
            statement: StatementIr::Raw(sql.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_ir_builder() {
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

        let ir = SqlSemanticIr::select(select);
        match ir.statement {
            StatementIr::Select(s) => {
                assert_eq!(s.projections.len(), 1);
                assert!(s.where_clause.is_some());
            }
            _ => panic!("Expected Select statement"),
        }
    }
}
