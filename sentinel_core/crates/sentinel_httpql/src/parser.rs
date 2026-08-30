//! HTTPQL Parser (Recursive Descent)

use crate::ast::{ComparisonOp, Expression, Field, LogicalOp, UnaryOp, Value};
use crate::error::HttpqlError;
use crate::lexer::Lexer;
use crate::token::{SpannedToken, Token};

pub struct Parser {
    tokens: Vec<SpannedToken>,
    cursor: usize,
}

impl Parser {
    pub fn new(tokens: Vec<SpannedToken>) -> Self {
        Self { tokens, cursor: 0 }
    }

    pub fn parse_str(input: &str) -> Result<Expression, HttpqlError> {
        let input = input.trim();
        if input.is_empty() {
            return Ok(Expression::True);
        }

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize()?;
        let mut parser = Parser::new(tokens);
        let expr = parser.parse_expression()?;

        if !parser.is_at_end() {
            let tok = parser.peek();
            return Err(HttpqlError::ParseError {
                position: tok.position,
                message: format!("Unexpected trailing token: {}", tok.token),
            });
        }

        Ok(expr)
    }

    pub fn parse_expression(&mut self) -> Result<Expression, HttpqlError> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<Expression, HttpqlError> {
        let mut expr = self.parse_and()?;

        while self.match_token(&[Token::Or]) {
            let right = self.parse_and()?;
            expr = Expression::Binary {
                left: Box::new(expr),
                op: LogicalOp::Or,
                right: Box::new(right),
            };
        }

        Ok(expr)
    }

    fn parse_and(&mut self) -> Result<Expression, HttpqlError> {
        let mut expr = self.parse_unary()?;

        while self.match_token(&[Token::And]) {
            let right = self.parse_unary()?;
            expr = Expression::Binary {
                left: Box::new(expr),
                op: LogicalOp::And,
                right: Box::new(right),
            };
        }

        Ok(expr)
    }

    fn parse_unary(&mut self) -> Result<Expression, HttpqlError> {
        if self.match_token(&[Token::Not]) {
            let expr = self.parse_unary()?;
            return Ok(Expression::Unary {
                op: UnaryOp::Not,
                expr: Box::new(expr),
            });
        }

        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<Expression, HttpqlError> {
        let current = self.peek().clone();

        // 1. Parenthesized expression
        if self.match_token(&[Token::LParen]) {
            let expr = self.parse_expression()?;
            self.consume(Token::RParen, "Expected ')' after expression")?;
            return Ok(expr);
        }

        // 2. Boolean literals
        if self.match_token(&[Token::BooleanLiteral(true)]) {
            return Ok(Expression::True);
        }
        if self.match_token(&[Token::BooleanLiteral(false)]) {
            return Ok(Expression::False);
        }

        // 3. Field comparison or In-list
        if let Token::Ident(ref field_name) = current.token {
            let field_pos = current.position;
            self.advance();
            let field = Field::parse_field_name(field_name);

            // Check for IN / NOT IN
            if self.match_token(&[Token::In]) {
                let values = self.parse_value_list()?;
                return Ok(Expression::InList {
                    field,
                    values,
                    negated: false,
                });
            } else if self.match_token(&[Token::NotIn]) {
                let values = self.parse_value_list()?;
                return Ok(Expression::InList {
                    field,
                    values,
                    negated: true,
                });
            } else if self.check(&Token::Not) && self.peek_next_token() == Some(&Token::In) {
                self.advance(); // consume Not
                self.advance(); // consume In
                let values = self.parse_value_list()?;
                return Ok(Expression::InList {
                    field,
                    values,
                    negated: true,
                });
            }

            // Comparison operator
            let op = self.parse_comparison_op(field_pos)?;
            let value = self.parse_value()?;

            return Ok(Expression::Comparison { field, op, value });
        }

        Err(HttpqlError::ParseError {
            position: current.position,
            message: format!(
                "Expected field identifier or expression, found {}",
                current.token
            ),
        })
    }

    fn parse_comparison_op(&mut self, pos: usize) -> Result<ComparisonOp, HttpqlError> {
        let tok = self.peek();
        let op = match tok.token {
            Token::Eq => ComparisonOp::Eq,
            Token::Neq => ComparisonOp::Neq,
            Token::Gt => ComparisonOp::Gt,
            Token::Gte => ComparisonOp::Gte,
            Token::Lt => ComparisonOp::Lt,
            Token::Lte => ComparisonOp::Lte,
            Token::Contains => ComparisonOp::Contains,
            Token::NotContains => ComparisonOp::NotContains,
            Token::Matches => ComparisonOp::Matches,
            Token::StartsWith => ComparisonOp::StartsWith,
            Token::EndsWith => ComparisonOp::EndsWith,
            _ => {
                return Err(HttpqlError::ParseError {
                    position: pos,
                    message: format!("Expected comparison operator, found {}", tok.token),
                });
            }
        };
        self.advance();
        Ok(op)
    }

    fn parse_value(&mut self) -> Result<Value, HttpqlError> {
        let current = self.peek();
        let val = match current.token {
            Token::StringLiteral(ref s) => Value::String(s.clone()),
            Token::NumberLiteral(n) => Value::Number(n),
            Token::FloatLiteral(f) => Value::Float(f),
            Token::BooleanLiteral(b) => Value::Boolean(b),
            Token::RegexLiteral(ref r) => Value::Regex(r.clone()),
            Token::Ident(ref s) => Value::String(s.clone()), // allow unquoted single-word strings e.g. req.method == GET
            _ => {
                return Err(HttpqlError::ParseError {
                    position: current.position,
                    message: format!(
                        "Expected value (string, number, regex), found {}",
                        current.token
                    ),
                });
            }
        };
        self.advance();
        Ok(val)
    }

    fn parse_value_list(&mut self) -> Result<Vec<Value>, HttpqlError> {
        self.consume(Token::LBracket, "Expected '[' for value list")?;
        let mut list = Vec::new();

        if !self.check(&Token::RBracket) {
            loop {
                list.push(self.parse_value()?);
                if !self.match_token(&[Token::Comma]) {
                    break;
                }
            }
        }

        self.consume(Token::RBracket, "Expected ']' at end of value list")?;
        Ok(list)
    }

    fn peek(&self) -> &SpannedToken {
        if self.cursor < self.tokens.len() {
            &self.tokens[self.cursor]
        } else {
            &self.tokens[self.tokens.len() - 1]
        }
    }

    fn advance(&mut self) -> &SpannedToken {
        if !self.is_at_end() {
            self.cursor += 1;
        }
        &self.tokens[self.cursor - 1]
    }

    fn peek_next_token(&self) -> Option<&Token> {
        if self.cursor + 1 < self.tokens.len() {
            Some(&self.tokens[self.cursor + 1].token)
        } else {
            None
        }
    }

    fn check(&self, token: &Token) -> bool {
        if self.is_at_end() {
            false
        } else {
            &self.peek().token == token
        }
    }

    fn match_token(&mut self, tokens: &[Token]) -> bool {
        for t in tokens {
            if self.check(t) {
                self.advance();
                return true;
            }
        }
        false
    }

    fn consume(&mut self, token: Token, err_msg: &str) -> Result<&SpannedToken, HttpqlError> {
        if self.check(&token) {
            Ok(self.advance())
        } else {
            let p = self.peek();
            Err(HttpqlError::ParseError {
                position: p.position,
                message: format!("{}: found {}", err_msg, p.token),
            })
        }
    }

    fn is_at_end(&self) -> bool {
        self.cursor >= self.tokens.len() || self.peek().token == Token::Eof
    }
}
