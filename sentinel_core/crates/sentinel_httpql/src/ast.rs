//! HTTPQL Abstract Syntax Tree (AST)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Expression {
    Binary {
        left: Box<Expression>,
        op: LogicalOp,
        right: Box<Expression>,
    },
    Unary {
        op: UnaryOp,
        expr: Box<Expression>,
    },
    Comparison {
        field: Field,
        op: ComparisonOp,
        value: Value,
    },
    InList {
        field: Field,
        values: Vec<Value>,
        negated: bool,
    },
    True,
    False,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum UnaryOp {
    Not,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ComparisonOp {
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    Contains,
    NotContains,
    Matches,
    StartsWith,
    EndsWith,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Field {
    ReqMethod,
    ReqUrl,
    ReqPath,
    ReqHost,
    ReqHeader(String),
    ReqBody,
    RespStatus,
    RespHeader(String),
    RespBody,
    RespTimeMs,
    Source,
    ScopeStatus,
    Custom(String),
}

impl Field {
    pub fn parse_field_name(name: &str) -> Self {
        let lower = name.to_ascii_lowercase();
        match lower.as_str() {
            "req.method" | "method" => Field::ReqMethod,
            "req.url" | "url" | "req.uri" | "uri" => Field::ReqUrl,
            "req.path" | "path" => Field::ReqPath,
            "req.host" | "host" => Field::ReqHost,
            "req.body" => Field::ReqBody,
            "resp.status" | "status" | "status_code" => Field::RespStatus,
            "resp.body" => Field::RespBody,
            "resp.time" | "resp.time_ms" | "duration_ms" => Field::RespTimeMs,
            "source" => Field::Source,
            "scope.status" | "scope" => Field::ScopeStatus,
            _ => {
                if let Some(h) = lower.strip_prefix("req.header.") {
                    Field::ReqHeader(h.to_string())
                } else if let Some(h) = lower.strip_prefix("req.headers.") {
                    Field::ReqHeader(h.to_string())
                } else if let Some(h) = lower.strip_prefix("resp.header.") {
                    Field::RespHeader(h.to_string())
                } else if let Some(h) = lower.strip_prefix("resp.headers.") {
                    Field::RespHeader(h.to_string())
                } else {
                    Field::Custom(name.to_string())
                }
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Value {
    String(String),
    Number(i64),
    Float(f64),
    Boolean(bool),
    Regex(String),
}

impl Value {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s),
            Value::Regex(r) => Some(r),
            _ => None,
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Value::Number(n) => Some(*n),
            _ => None,
        }
    }
}
