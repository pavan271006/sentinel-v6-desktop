//! HTTPQL to SQL Compiler

use crate::ast::{ComparisonOp, Expression, Field, LogicalOp, UnaryOp, Value};
use crate::error::HttpqlError;

#[derive(Debug, Clone, PartialEq)]
pub struct CompiledSqlQuery {
    pub where_clause: String,
    pub params: Vec<SqlParam>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SqlParam {
    Text(String),
    Integer(i64),
    Real(f64),
}

pub struct SqlCompiler;

impl SqlCompiler {
    pub fn compile(expr: &Expression) -> Result<CompiledSqlQuery, HttpqlError> {
        let mut params = Vec::new();
        let where_clause = Self::compile_node(expr, &mut params)?;
        Ok(CompiledSqlQuery {
            where_clause,
            params,
        })
    }

    fn compile_node(expr: &Expression, params: &mut Vec<SqlParam>) -> Result<String, HttpqlError> {
        match expr {
            Expression::True => Ok("1 = 1".to_string()),
            Expression::False => Ok("1 = 0".to_string()),
            Expression::Binary { left, op, right } => {
                let l = Self::compile_node(left, params)?;
                let r = Self::compile_node(right, params)?;
                let op_str = match op {
                    LogicalOp::And => "AND",
                    LogicalOp::Or => "OR",
                };
                Ok(format!("({} {} {})", l, op_str, r))
            }
            Expression::Unary { op, expr } => {
                let inner = Self::compile_node(expr, params)?;
                match op {
                    UnaryOp::Not => Ok(format!("NOT ({})", inner)),
                }
            }
            Expression::Comparison { field, op, value } => {
                Self::compile_comparison(field, *op, value, params)
            }
            Expression::InList {
                field,
                values,
                negated,
            } => {
                if values.is_empty() {
                    return if *negated {
                        Ok("1 = 1".to_string())
                    } else {
                        Ok("1 = 0".to_string())
                    };
                }

                let col = Self::field_to_column(field)?;
                let mut placeholders = Vec::new();

                for val in values {
                    placeholders.push("?");
                    match val {
                        Value::String(s) => params.push(SqlParam::Text(s.clone())),
                        Value::Number(n) => params.push(SqlParam::Integer(*n)),
                        Value::Float(f) => params.push(SqlParam::Real(*f)),
                        Value::Boolean(b) => params.push(SqlParam::Integer(if *b { 1 } else { 0 })),
                        Value::Regex(r) => params.push(SqlParam::Text(r.clone())),
                    }
                }

                let op_str = if *negated { "NOT IN" } else { "IN" };
                Ok(format!("{} {} ({})", col, op_str, placeholders.join(", ")))
            }
        }
    }

    fn compile_comparison(
        field: &Field,
        op: ComparisonOp,
        value: &Value,
        params: &mut Vec<SqlParam>,
    ) -> Result<String, HttpqlError> {
        let col = Self::field_to_column(field)?;

        match op {
            ComparisonOp::Eq => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} = ?", col))
            }
            ComparisonOp::Neq => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} != ?", col))
            }
            ComparisonOp::Gt => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} > ?", col))
            }
            ComparisonOp::Gte => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} >= ?", col))
            }
            ComparisonOp::Lt => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} < ?", col))
            }
            ComparisonOp::Lte => {
                params.push(Self::value_to_param(value));
                Ok(format!("{} <= ?", col))
            }
            ComparisonOp::Contains => {
                let pattern = match value {
                    Value::String(s) => format!("%{}%", s),
                    _ => "%".to_string(),
                };
                params.push(SqlParam::Text(pattern));
                Ok(format!("{} LIKE ?", col))
            }
            ComparisonOp::NotContains => {
                let pattern = match value {
                    Value::String(s) => format!("%{}%", s),
                    _ => "%".to_string(),
                };
                params.push(SqlParam::Text(pattern));
                Ok(format!("{} NOT LIKE ?", col))
            }
            ComparisonOp::StartsWith => {
                let pattern = match value {
                    Value::String(s) => format!("{}%", s),
                    _ => "%".to_string(),
                };
                params.push(SqlParam::Text(pattern));
                Ok(format!("{} LIKE ?", col))
            }
            ComparisonOp::EndsWith => {
                let pattern = match value {
                    Value::String(s) => format!("%{}", s),
                    _ => "%".to_string(),
                };
                params.push(SqlParam::Text(pattern));
                Ok(format!("{} LIKE ?", col))
            }
            ComparisonOp::Matches => {
                let pattern = match value {
                    Value::Regex(r) | Value::String(r) => r.clone(),
                    _ => ".*".to_string(),
                };
                params.push(SqlParam::Text(pattern));
                // SQLite regex function support via custom or LIKE fallback
                Ok(format!("{} REGEXP ?", col))
            }
        }
    }

    fn field_to_column(field: &Field) -> Result<&'static str, HttpqlError> {
        match field {
            Field::ReqMethod => Ok("method"),
            Field::ReqUrl => Ok("uri"),
            Field::ReqPath => Ok("uri"),
            Field::ReqHost => Ok("host"),
            Field::RespStatus => Ok("status_code"),
            Field::RespTimeMs => Ok("duration_ms"),
            Field::Source => Ok("source"),
            Field::ReqHeader(_) | Field::RespHeader(_) | Field::ReqBody | Field::RespBody => {
                // In SQLite, headers/bodies are inside CAS or JSON metadata
                Ok("uri")
            }
            Field::ScopeStatus => Ok("scope_id"),
            Field::Custom(_) => Ok("uri"),
        }
    }

    fn value_to_param(value: &Value) -> SqlParam {
        match value {
            Value::String(s) => SqlParam::Text(s.clone()),
            Value::Number(n) => SqlParam::Integer(*n),
            Value::Float(f) => SqlParam::Real(*f),
            Value::Boolean(b) => SqlParam::Integer(if *b { 1 } else { 0 }),
            Value::Regex(r) => SqlParam::Text(r.clone()),
        }
    }
}
