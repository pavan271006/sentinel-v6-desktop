//! # UCMA-SQL-IR
//! Dialect-neutral SQL Semantic Intermediate Representation and mutation points for UCMA-X.

pub mod ir;
pub mod mutation;
pub mod types;
pub mod visitor;

pub use ir::{
    DeleteIr, ExpressionIr, FunctionIr, InsertIr, LimitOffsetIr, OrderByIr, ProjectionIr,
    SelectIr, SqlSemanticIr, StatementIr, TableRefIr, UnionIr, UpdateIr,
};
pub use mutation::{MutationPoint, MutationScanner, SemanticMutator};
pub use types::{
    BinaryOpIr, IdentifierIr, JoinTypeIr, LiteralIr, NullsOrder, OrderDirection, UnaryOpIr,
};
pub use visitor::IrVisitor;
