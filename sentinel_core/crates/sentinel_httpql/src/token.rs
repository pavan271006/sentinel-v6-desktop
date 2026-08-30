//! HTTPQL Lexer Token Definitions

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Ident(String),
    StringLiteral(String),
    NumberLiteral(i64),
    FloatLiteral(f64),
    BooleanLiteral(bool),
    RegexLiteral(String),

    // Comparison Operators
    Eq,          // == or =
    Neq,         // !=
    Gt,          // >
    Gte,         // >=
    Lt,          // <
    Lte,         // <=
    Contains,    // contains or ~=
    NotContains, // not_contains or !~=
    Matches,     // matches or =~
    StartsWith,  // starts_with
    EndsWith,    // ends_with
    In,          // in
    NotIn,       // not in / not_in

    // Logical Operators
    And, // && or and
    Or,  // || or or
    Not, // ! or not

    // Delimiters
    LParen,   // (
    RParen,   // )
    LBracket, // [
    RBracket, // ]
    Comma,    // ,

    Eof,
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Token::Ident(s) => write!(f, "identifier '{}'", s),
            Token::StringLiteral(s) => write!(f, "\"{}\"", s),
            Token::NumberLiteral(n) => write!(f, "{}", n),
            Token::FloatLiteral(fl) => write!(f, "{}", fl),
            Token::BooleanLiteral(b) => write!(f, "{}", b),
            Token::RegexLiteral(r) => write!(f, "/{}/", r),
            Token::Eq => write!(f, "=="),
            Token::Neq => write!(f, "!="),
            Token::Gt => write!(f, ">"),
            Token::Gte => write!(f, ">="),
            Token::Lt => write!(f, "<"),
            Token::Lte => write!(f, "<="),
            Token::Contains => write!(f, "contains"),
            Token::NotContains => write!(f, "not_contains"),
            Token::Matches => write!(f, "matches"),
            Token::StartsWith => write!(f, "starts_with"),
            Token::EndsWith => write!(f, "ends_with"),
            Token::In => write!(f, "in"),
            Token::NotIn => write!(f, "not in"),
            Token::And => write!(f, "&&"),
            Token::Or => write!(f, "||"),
            Token::Not => write!(f, "!"),
            Token::LParen => write!(f, "("),
            Token::RParen => write!(f, ")"),
            Token::LBracket => write!(f, "["),
            Token::RBracket => write!(f, "]"),
            Token::Comma => write!(f, ","),
            Token::Eof => write!(f, "<EOF>"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SpannedToken {
    pub token: Token,
    pub position: usize,
}
