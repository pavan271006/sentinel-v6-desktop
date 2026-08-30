//! In-Memory Stream HTTPQL Evaluator

use regex::Regex;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};

use crate::ast::{ComparisonOp, Expression, Field, LogicalOp, UnaryOp, Value};
use crate::error::HttpqlError;

pub struct EvalContext<'a> {
    pub request: Option<&'a ParsedRequest>,
    pub response: Option<&'a ParsedResponse>,
    pub duration_ms: Option<u64>,
    pub source: Option<&'a str>,
    pub in_scope: Option<bool>,
}

impl<'a> EvalContext<'a> {
    pub fn new(req: &'a ParsedRequest, resp: Option<&'a ParsedResponse>) -> Self {
        Self {
            request: Some(req),
            response: resp,
            duration_ms: None,
            source: None,
            in_scope: None,
        }
    }

    pub fn with_duration(mut self, ms: u64) -> Self {
        self.duration_ms = Some(ms);
        self
    }

    pub fn with_source(mut self, src: &'a str) -> Self {
        self.source = Some(src);
        self
    }

    pub fn with_scope(mut self, in_scope: bool) -> Self {
        self.in_scope = Some(in_scope);
        self
    }
}

pub struct Evaluator;

impl Evaluator {
    pub fn evaluate(expr: &Expression, ctx: &EvalContext) -> Result<bool, HttpqlError> {
        match expr {
            Expression::True => Ok(true),
            Expression::False => Ok(false),
            Expression::Binary { left, op, right } => {
                let l = Self::evaluate(left, ctx)?;
                match op {
                    LogicalOp::And => {
                        if !l {
                            Ok(false) // short-circuit
                        } else {
                            Self::evaluate(right, ctx)
                        }
                    }
                    LogicalOp::Or => {
                        if l {
                            Ok(true) // short-circuit
                        } else {
                            Self::evaluate(right, ctx)
                        }
                    }
                }
            }
            Expression::Unary { op, expr } => {
                let val = Self::evaluate(expr, ctx)?;
                match op {
                    UnaryOp::Not => Ok(!val),
                }
            }
            Expression::Comparison { field, op, value } => {
                Self::evaluate_comparison(field, *op, value, ctx)
            }
            Expression::InList {
                field,
                values,
                negated,
            } => {
                let mut matched = false;
                for val in values {
                    if Self::evaluate_comparison(field, ComparisonOp::Eq, val, ctx)? {
                        matched = true;
                        break;
                    }
                }
                if *negated {
                    Ok(!matched)
                } else {
                    Ok(matched)
                }
            }
        }
    }

    fn evaluate_comparison(
        field: &Field,
        op: ComparisonOp,
        value: &Value,
        ctx: &EvalContext,
    ) -> Result<bool, HttpqlError> {
        match field {
            Field::ReqMethod => {
                let method = ctx.request.map(|r| r.method.as_str()).unwrap_or("");
                Self::compare_str(method, op, value)
            }
            Field::ReqUrl => {
                let url = ctx.request.map(|r| r.uri.as_str()).unwrap_or("");
                Self::compare_str(url, op, value)
            }
            Field::ReqPath => {
                let path = ctx
                    .request
                    .map(|r| {
                        if let Some(pos) = r.uri.find('?') {
                            &r.uri[..pos]
                        } else {
                            &r.uri
                        }
                    })
                    .unwrap_or("");
                Self::compare_str(path, op, value)
            }
            Field::ReqHost => {
                let host = ctx
                    .request
                    .and_then(|r| {
                        r.headers
                            .iter()
                            .find(|(k, _)| k.eq_ignore_ascii_case(b"host"))
                            .map(|(_, v)| String::from_utf8_lossy(v).to_string())
                    })
                    .unwrap_or_default();
                Self::compare_str(&host, op, value)
            }
            Field::ReqHeader(name) => {
                let header_val = ctx
                    .request
                    .and_then(|r| {
                        r.headers
                            .iter()
                            .find(|(k, _)| k.eq_ignore_ascii_case(name.as_bytes()))
                            .map(|(_, v)| String::from_utf8_lossy(v).to_string())
                    })
                    .unwrap_or_default();
                Self::compare_str(&header_val, op, value)
            }
            Field::ReqBody => {
                let body = ctx
                    .request
                    .map(|r| String::from_utf8_lossy(&r.body).to_string())
                    .unwrap_or_default();
                Self::compare_str(&body, op, value)
            }
            Field::RespStatus => {
                let status = ctx.response.map(|r| r.status_code as i64).unwrap_or(0);
                Self::compare_num(status, op, value)
            }
            Field::RespHeader(name) => {
                let header_val = ctx
                    .response
                    .and_then(|r| {
                        r.headers
                            .iter()
                            .find(|(k, _)| k.eq_ignore_ascii_case(name.as_bytes()))
                            .map(|(_, v)| String::from_utf8_lossy(v).to_string())
                    })
                    .unwrap_or_default();
                Self::compare_str(&header_val, op, value)
            }
            Field::RespBody => {
                let body = ctx
                    .response
                    .map(|r| String::from_utf8_lossy(&r.body).to_string())
                    .unwrap_or_default();
                Self::compare_str(&body, op, value)
            }
            Field::RespTimeMs => {
                let ms = ctx.duration_ms.unwrap_or(0) as i64;
                Self::compare_num(ms, op, value)
            }
            Field::Source => {
                let src = ctx.source.unwrap_or("");
                Self::compare_str(src, op, value)
            }
            Field::ScopeStatus => {
                let in_scope = ctx.in_scope.unwrap_or(false);
                let val_bool = match value {
                    Value::Boolean(b) => *b,
                    Value::String(s) => {
                        s.eq_ignore_ascii_case("in_scope") || s.eq_ignore_ascii_case("true")
                    }
                    _ => false,
                };
                match op {
                    ComparisonOp::Eq => Ok(in_scope == val_bool),
                    ComparisonOp::Neq => Ok(in_scope != val_bool),
                    _ => Ok(false),
                }
            }
            Field::Custom(_) => Ok(false),
        }
    }

    fn compare_str(target: &str, op: ComparisonOp, value: &Value) -> Result<bool, HttpqlError> {
        let expected = match value {
            Value::String(s) => s.as_str(),
            Value::Number(_) => {
                return Self::compare_num(target.parse::<i64>().unwrap_or(0), op, value)
            }
            Value::Regex(r) => {
                let re = Regex::new(r).map_err(|e| HttpqlError::InvalidRegex {
                    pattern: r.clone(),
                    reason: e.to_string(),
                })?;
                return match op {
                    ComparisonOp::Matches | ComparisonOp::Eq => Ok(re.is_match(target)),
                    ComparisonOp::Neq => Ok(!re.is_match(target)),
                    _ => Ok(false),
                };
            }
            _ => "",
        };

        match op {
            ComparisonOp::Eq => Ok(target.eq_ignore_ascii_case(expected)),
            ComparisonOp::Neq => Ok(!target.eq_ignore_ascii_case(expected)),
            ComparisonOp::Contains => Ok(target
                .to_ascii_lowercase()
                .contains(&expected.to_ascii_lowercase())),
            ComparisonOp::NotContains => Ok(!target
                .to_ascii_lowercase()
                .contains(&expected.to_ascii_lowercase())),
            ComparisonOp::StartsWith => Ok(target
                .to_ascii_lowercase()
                .starts_with(&expected.to_ascii_lowercase())),
            ComparisonOp::EndsWith => Ok(target
                .to_ascii_lowercase()
                .ends_with(&expected.to_ascii_lowercase())),
            ComparisonOp::Matches => {
                let re = Regex::new(expected).map_err(|e| HttpqlError::InvalidRegex {
                    pattern: expected.to_string(),
                    reason: e.to_string(),
                })?;
                Ok(re.is_match(target))
            }
            _ => Ok(false),
        }
    }

    fn compare_num(target: i64, op: ComparisonOp, value: &Value) -> Result<bool, HttpqlError> {
        let expected = match value {
            Value::Number(n) => *n,
            Value::Float(f) => *f as i64,
            Value::String(s) => s.parse::<i64>().unwrap_or(0),
            _ => 0,
        };

        match op {
            ComparisonOp::Eq => Ok(target == expected),
            ComparisonOp::Neq => Ok(target != expected),
            ComparisonOp::Gt => Ok(target > expected),
            ComparisonOp::Gte => Ok(target >= expected),
            ComparisonOp::Lt => Ok(target < expected),
            ComparisonOp::Lte => Ok(target <= expected),
            _ => Ok(false),
        }
    }
}
