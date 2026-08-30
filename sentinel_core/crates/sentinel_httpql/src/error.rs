//! HTTPQL Error Types

use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum HttpqlError {
    #[error("Lexer error at position {position}: {message}")]
    LexerError { position: usize, message: String },

    #[error("Parser syntax error at position {position}: {message}")]
    ParseError { position: usize, message: String },

    #[error("Type mismatch for field '{field}': expected {expected}, found {found}")]
    TypeError {
        field: String,
        expected: String,
        found: String,
    },

    #[error("Invalid regex pattern '{pattern}': {reason}")]
    InvalidRegex { pattern: String, reason: String },

    #[error("Compilation error: {0}")]
    CompileError(String),

    #[error("Evaluation error: {0}")]
    EvaluationError(String),
}
