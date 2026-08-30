//! SENTINEL V6: HTTPQL Query & Filter Engine (WP-3.2 / SUB-03)
//!
//! Provides a high-performance, fault-tolerant query language for filtering,
//! searching, and matching HTTP transactions, observations, and proxy traffic.

pub mod ast;
pub mod compiler;
pub mod error;
pub mod evaluator;
pub mod lexer;
pub mod parser;
pub mod token;

pub use ast::{ComparisonOp, Expression, Field, LogicalOp, UnaryOp, Value};
pub use compiler::{CompiledSqlQuery, SqlCompiler, SqlParam};
pub use error::HttpqlError;
pub use evaluator::{EvalContext, Evaluator};
pub use lexer::Lexer;
pub use parser::Parser;
pub use token::{SpannedToken, Token};

/// Parses an HTTPQL query string into an executable AST.
pub fn parse_query(query: &str) -> Result<Expression, HttpqlError> {
    Parser::parse_str(query)
}

/// Evaluates an HTTPQL query directly against request and response objects in-memory.
pub fn evaluate_query(
    query: &str,
    req: &sentinel_common::operational::ParsedRequest,
    resp: Option<&sentinel_common::operational::ParsedResponse>,
) -> Result<bool, HttpqlError> {
    let expr = parse_query(query)?;
    let ctx = EvalContext::new(req, resp);
    Evaluator::evaluate(&expr, &ctx)
}

/// Compiles an HTTPQL query string into a parameterized SQL WHERE clause.
pub fn compile_to_sql(query: &str) -> Result<CompiledSqlQuery, HttpqlError> {
    let expr = parse_query(query)?;
    SqlCompiler::compile(&expr)
}
