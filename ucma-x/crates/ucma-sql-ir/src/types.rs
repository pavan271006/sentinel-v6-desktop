//! Core SQL types, operators, and literals for dialect-neutral semantic IR.

use serde::{Deserialize, Serialize};

/// Standard SQL literal values.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LiteralIr {
    Null,
    Integer(i64),
    Float(f64),
    String(String),
    Boolean(bool),
    Blob(Vec<u8>),
}

impl LiteralIr {
    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }

    pub fn type_name(&self) -> &'static str {
        match self {
            Self::Null => "NULL",
            Self::Integer(_) => "INTEGER",
            Self::Float(_) => "FLOAT",
            Self::String(_) => "STRING",
            Self::Boolean(_) => "BOOLEAN",
            Self::Blob(_) => "BLOB",
        }
    }
}

/// SQL column or table identifier.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IdentifierIr {
    pub name: String,
    pub qualifier: Option<String>, // e.g. table or schema name
    pub is_quoted: bool,
}

impl IdentifierIr {
    pub fn simple(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            qualifier: None,
            is_quoted: false,
        }
    }

    pub fn qualified(qualifier: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            qualifier: Some(qualifier.into()),
            is_quoted: false,
        }
    }
}

/// Binary operators supported in dialect-neutral SQL expressions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BinaryOpIr {
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Concat,

    // Comparison
    Eq,
    NotEq,
    Lt,
    Lte,
    Gt,
    Gte,
    Like,
    NotLike,
    ILike,
    NotILike,

    // Logical
    And,
    Or,

    // Bitwise
    BitwiseAnd,
    BitwiseOr,
    BitwiseXor,

    // Identity / Null-safe
    Is,
    IsNot,
}

impl BinaryOpIr {
    pub fn as_sql_operator(&self) -> &'static str {
        match self {
            Self::Add => "+",
            Self::Sub => "-",
            Self::Mul => "*",
            Self::Div => "/",
            Self::Mod => "%",
            Self::Concat => "||",
            Self::Eq => "=",
            Self::NotEq => "<>",
            Self::Lt => "<",
            Self::Lte => "<=",
            Self::Gt => ">",
            Self::Gte => ">=",
            Self::Like => "LIKE",
            Self::NotLike => "NOT LIKE",
            Self::ILike => "ILIKE",
            Self::NotILike => "NOT ILIKE",
            Self::And => "AND",
            Self::Or => "OR",
            Self::BitwiseAnd => "&",
            Self::BitwiseOr => "|",
            Self::BitwiseXor => "^",
            Self::Is => "IS",
            Self::IsNot => "IS NOT",
        }
    }

    pub fn is_logical(&self) -> bool {
        matches!(self, Self::And | Self::Or)
    }

    pub fn is_comparison(&self) -> bool {
        matches!(
            self,
            Self::Eq
                | Self::NotEq
                | Self::Lt
                | Self::Lte
                | Self::Gt
                | Self::Gte
                | Self::Like
                | Self::NotLike
                | Self::ILike
                | Self::NotILike
                | Self::Is
                | Self::IsNot
        )
    }
}

/// Unary operators.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum UnaryOpIr {
    Not,
    Neg,
    Plus,
    IsNull,
    IsNotNull,
    BitwiseNot,
}

/// Join types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JoinTypeIr {
    Inner,
    LeftOuter,
    RightOuter,
    FullOuter,
    Cross,
    Natural,
}

/// Order direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OrderDirection {
    Asc,
    Desc,
}

/// Nulls ordering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NullsOrder {
    NullsFirst,
    NullsLast,
}
