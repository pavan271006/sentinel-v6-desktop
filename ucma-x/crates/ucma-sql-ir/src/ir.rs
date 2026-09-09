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

    pub fn cast(expr: ExpressionIr, target_type: impl Into<String>) -> Self {
        Self::Cast {
            expr: Box::new(expr),
            target_type: target_type.into(),
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

/// Type alias aligning with the UCMA-X Revision 5 specification.
pub type SqlIrExpr = ExpressionIr;

#[derive(thiserror::Error, Debug, Clone, PartialEq)]
pub enum CompilationError {
    #[error("Unsupported expression: {0}")]
    Unsupported(String),
    #[error("Dialect formatting error: {0}")]
    Formatting(String),
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Abstract contract for compiling dialect-neutral IR to engine-specific SQL.
pub trait SqlDialectCompiler: Send + Sync {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError>;
    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect>;
}

pub struct PostgresCompiler;
impl SqlDialectCompiler for PostgresCompiler {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError> {
        match ir {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => Ok("NULL".to_string()),
                LiteralIr::Integer(i) => Ok(i.to_string()),
                LiteralIr::Float(f) => Ok(f.to_string()),
                LiteralIr::String(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
                LiteralIr::Boolean(b) => Ok(if *b { "TRUE".to_string() } else { "FALSE".to_string() }),
                LiteralIr::Blob(b) => Ok(format!("'\\x{}'", bytes_to_hex(b))),
            },
            ExpressionIr::Identifier(ident) => Ok(ident.name.clone()),
            ExpressionIr::BinaryOp { left, op, right } => {
                let left_str = self.compile(left)?;
                let right_str = self.compile(right)?;
                let op_str = match op {
                    BinaryOpIr::Concat => "||",
                    BinaryOpIr::ILike => "ILIKE",
                    _ => op.as_sql_operator(),
                };
                Ok(format!("({} {} {})", left_str, op_str, right_str))
            }
            ExpressionIr::UnaryOp { op, expr } => {
                let inner = self.compile(expr)?;
                if op.is_postfix() {
                    Ok(format!("({}{})", inner, op.as_sql_operator()))
                } else {
                    Ok(format!("({}{})", op.as_sql_operator(), inner))
                }
            }
            ExpressionIr::Function(func) => {
                let arg_strings: Result<Vec<_>, _> = func.args.iter().map(|arg| self.compile(arg)).collect();
                Ok(format!("{}({})", func.name, arg_strings?.join(", ")))
            }
            ExpressionIr::Cast { expr, target_type } => {
                let inner = self.compile(expr)?;
                Ok(format!("{}::{}", inner, target_type))
            }
            ExpressionIr::Parenthesized(expr) => {
                let inner = self.compile(expr)?;
                Ok(format!("({})", inner))
            }
            _ => Err(CompilationError::Unsupported("Expression not supported by Postgres compiler".to_string())),
        }
    }

    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect> {
        for query in sample_queries {
            let q_upper = query.to_uppercase();
            if query.contains("::") || q_upper.contains("ILIKE") || q_upper.contains("PG_SLEEP") {
                return Some(ucma_parameter::SqlDialect::PostgreSQL);
            }
        }
        None
    }
}

pub struct MySqlCompiler;
impl SqlDialectCompiler for MySqlCompiler {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError> {
        match ir {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => Ok("NULL".to_string()),
                LiteralIr::Integer(i) => Ok(i.to_string()),
                LiteralIr::Float(f) => Ok(f.to_string()),
                LiteralIr::String(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
                LiteralIr::Boolean(b) => Ok(if *b { "1".to_string() } else { "0".to_string() }),
                LiteralIr::Blob(b) => Ok(format!("0x{}", bytes_to_hex(b))),
            },
            ExpressionIr::Identifier(ident) => Ok(format!("`{}`", ident.name)),
            ExpressionIr::BinaryOp { left, op, right } => {
                let left_str = self.compile(left)?;
                let right_str = self.compile(right)?;
                let op_str = match op {
                    BinaryOpIr::Concat => return Ok(format!("CONCAT({}, {})", left_str, right_str)),
                    _ => op.as_sql_operator(),
                };
                Ok(format!("({} {} {})", left_str, op_str, right_str))
            }
            ExpressionIr::Function(func) => {
                let arg_strings: Result<Vec<_>, _> = func.args.iter().map(|arg| self.compile(arg)).collect();
                Ok(format!("{}({})", func.name, arg_strings?.join(", ")))
            }
            ExpressionIr::Parenthesized(expr) => {
                let inner = self.compile(expr)?;
                Ok(format!("({})", inner))
            }
            _ => Err(CompilationError::Unsupported("Expression not supported by MySQL compiler".to_string())),
        }
    }

    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect> {
        for query in sample_queries {
            let q_upper = query.to_uppercase();
            if query.contains('`') || q_upper.contains("SLEEP(") || q_upper.contains("@@VERSION") {
                return Some(ucma_parameter::SqlDialect::MySQL);
            }
        }
        None
    }
}

pub struct SqliteCompiler;
impl SqlDialectCompiler for SqliteCompiler {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError> {
        match ir {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => Ok("NULL".to_string()),
                LiteralIr::Integer(i) => Ok(i.to_string()),
                LiteralIr::Float(f) => Ok(f.to_string()),
                LiteralIr::String(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
                LiteralIr::Boolean(b) => Ok(if *b { "1".to_string() } else { "0".to_string() }),
                LiteralIr::Blob(b) => Ok(format!("X'{}'", bytes_to_hex(b))),
            },
            ExpressionIr::Identifier(ident) => Ok(ident.name.clone()),
            ExpressionIr::BinaryOp { left, op, right } => {
                let left_str = self.compile(left)?;
                let right_str = self.compile(right)?;
                Ok(format!("({} {} {})", left_str, op.as_sql_operator(), right_str))
            }
            ExpressionIr::Function(func) => {
                let arg_strings: Result<Vec<_>, _> = func.args.iter().map(|arg| self.compile(arg)).collect();
                Ok(format!("{}({})", func.name, arg_strings?.join(", ")))
            }
            ExpressionIr::Parenthesized(expr) => {
                let inner = self.compile(expr)?;
                Ok(format!("({})", inner))
            }
            _ => Err(CompilationError::Unsupported("Expression not supported by SQLite compiler".to_string())),
        }
    }

    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect> {
        for query in sample_queries {
            let q_upper = query.to_uppercase();
            if q_upper.contains("SQLITE_MASTER") || q_upper.contains("SQLITE_VERSION") {
                return Some(ucma_parameter::SqlDialect::SQLite);
            }
        }
        None
    }
}

pub struct MssqlCompiler;
impl SqlDialectCompiler for MssqlCompiler {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError> {
        match ir {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => Ok("NULL".to_string()),
                LiteralIr::Integer(i) => Ok(i.to_string()),
                LiteralIr::Float(f) => Ok(f.to_string()),
                LiteralIr::String(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
                LiteralIr::Boolean(b) => Ok(if *b { "1".to_string() } else { "0".to_string() }),
                LiteralIr::Blob(b) => Ok(format!("0x{}", bytes_to_hex(b))),
            },
            ExpressionIr::Identifier(ident) => Ok(format!("[{}]", ident.name)),
            ExpressionIr::BinaryOp { left, op, right } => {
                let left_str = self.compile(left)?;
                let right_str = self.compile(right)?;
                let op_str = match op {
                    BinaryOpIr::Concat => "+",
                    _ => op.as_sql_operator(),
                };
                Ok(format!("({} {} {})", left_str, op_str, right_str))
            }
            ExpressionIr::Function(func) => {
                let arg_strings: Result<Vec<_>, _> = func.args.iter().map(|arg| self.compile(arg)).collect();
                Ok(format!("{}({})", func.name, arg_strings?.join(", ")))
            }
            ExpressionIr::Parenthesized(expr) => {
                let inner = self.compile(expr)?;
                Ok(format!("({})", inner))
            }
            _ => Err(CompilationError::Unsupported("Expression not supported by MSSQL compiler".to_string())),
        }
    }

    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect> {
        for query in sample_queries {
            let q_upper = query.to_uppercase();
            if q_upper.contains("WAITFOR DELAY") || q_upper.contains("SYSOBJECTS") {
                return Some(ucma_parameter::SqlDialect::MSSQL);
            }
        }
        None
    }
}

pub struct OracleCompiler;
impl SqlDialectCompiler for OracleCompiler {
    fn compile(&self, ir: &SqlIrExpr) -> Result<String, CompilationError> {
        match ir {
            ExpressionIr::Literal(lit) => match lit {
                LiteralIr::Null => Ok("NULL".to_string()),
                LiteralIr::Integer(i) => Ok(i.to_string()),
                LiteralIr::Float(f) => Ok(f.to_string()),
                LiteralIr::String(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
                LiteralIr::Boolean(b) => Ok(if *b { "1".to_string() } else { "0".to_string() }),
                LiteralIr::Blob(b) => Ok(format!("HEXTORAW('{}')", bytes_to_hex(b))),
            },
            ExpressionIr::Identifier(ident) => Ok(ident.name.clone()),
            ExpressionIr::BinaryOp { left, op, right } => {
                let left_str = self.compile(left)?;
                let right_str = self.compile(right)?;
                Ok(format!("({} {} {})", left_str, op.as_sql_operator(), right_str))
            }
            ExpressionIr::Function(func) => {
                let arg_strings: Result<Vec<_>, _> = func.args.iter().map(|arg| self.compile(arg)).collect();
                Ok(format!("{}({})", func.name, arg_strings?.join(", ")))
            }
            ExpressionIr::Parenthesized(expr) => {
                let inner = self.compile(expr)?;
                Ok(format!("({})", inner))
            }
            _ => Err(CompilationError::Unsupported("Expression not supported by Oracle compiler".to_string())),
        }
    }

    fn identify_dialect(&self, sample_queries: &[String]) -> Option<ucma_parameter::SqlDialect> {
        for query in sample_queries {
            let q_upper = query.to_uppercase();
            if q_upper.contains("FROM DUAL") || q_upper.contains("DBMS_PIPE") || q_upper.contains("UTL_INADDR") {
                return Some(ucma_parameter::SqlDialect::Oracle);
            }
        }
        None
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

    #[test]
    fn test_postgres_compiler_binary_op_and_casting() {
        let compiler = PostgresCompiler;
        let ir = ExpressionIr::cast(
            ExpressionIr::binary(ExpressionIr::int(1), BinaryOpIr::Add, ExpressionIr::int(1)),
            "text",
        );
        let compiled = compiler.compile(&ir).expect("Postgres compilation should succeed");
        assert_eq!(compiled, "(1 + 1)::text");
    }

    #[test]
    fn test_mysql_compiler_concat_and_identifiers() {
        let compiler = MySqlCompiler;
        let ir = ExpressionIr::binary(
            ExpressionIr::string("a"),
            BinaryOpIr::Concat,
            ExpressionIr::string("b"),
        );
        let compiled = compiler.compile(&ir).expect("MySQL compilation should succeed");
        assert_eq!(compiled, "CONCAT('a', 'b')");
    }
}

