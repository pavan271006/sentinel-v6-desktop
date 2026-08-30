//! HTTPQL Lexer Tokenizer

use crate::error::HttpqlError;
use crate::token::{SpannedToken, Token};

pub struct Lexer<'a> {
    input: &'a str,
    chars: Vec<(usize, char)>,
    cursor: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        let chars: Vec<(usize, char)> = input.char_indices().collect();
        Self {
            input,
            chars,
            cursor: 0,
        }
    }

    pub fn tokenize(&mut self) -> Result<Vec<SpannedToken>, HttpqlError> {
        let mut tokens = Vec::new();

        while let Some((pos, ch)) = self.peek() {
            if ch.is_whitespace() {
                self.advance();
                continue;
            }

            // Line comments
            if ch == '#' || (ch == '/' && self.peek_next() == Some('/')) {
                self.skip_comment();
                continue;
            }

            match ch {
                '(' => {
                    tokens.push(SpannedToken {
                        token: Token::LParen,
                        position: pos,
                    });
                    self.advance();
                }
                ')' => {
                    tokens.push(SpannedToken {
                        token: Token::RParen,
                        position: pos,
                    });
                    self.advance();
                }
                '[' => {
                    tokens.push(SpannedToken {
                        token: Token::LBracket,
                        position: pos,
                    });
                    self.advance();
                }
                ']' => {
                    tokens.push(SpannedToken {
                        token: Token::RBracket,
                        position: pos,
                    });
                    self.advance();
                }
                ',' => {
                    tokens.push(SpannedToken {
                        token: Token::Comma,
                        position: pos,
                    });
                    self.advance();
                }
                '=' => {
                    self.advance();
                    if let Some((_, '=')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Eq,
                            position: pos,
                        });
                    } else if let Some((_, '~')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Matches,
                            position: pos,
                        });
                    } else {
                        tokens.push(SpannedToken {
                            token: Token::Eq,
                            position: pos,
                        });
                    }
                }
                '!' => {
                    self.advance();
                    if let Some((_, '=')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Neq,
                            position: pos,
                        });
                    } else if let Some((_, '~')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::NotContains,
                            position: pos,
                        });
                    } else {
                        tokens.push(SpannedToken {
                            token: Token::Not,
                            position: pos,
                        });
                    }
                }
                '<' => {
                    self.advance();
                    if let Some((_, '=')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Lte,
                            position: pos,
                        });
                    } else {
                        tokens.push(SpannedToken {
                            token: Token::Lt,
                            position: pos,
                        });
                    }
                }
                '>' => {
                    self.advance();
                    if let Some((_, '=')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Gte,
                            position: pos,
                        });
                    } else {
                        tokens.push(SpannedToken {
                            token: Token::Gt,
                            position: pos,
                        });
                    }
                }
                '~' => {
                    self.advance();
                    if let Some((_, '=')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Contains,
                            position: pos,
                        });
                    } else {
                        tokens.push(SpannedToken {
                            token: Token::Contains,
                            position: pos,
                        });
                    }
                }
                '&' => {
                    self.advance();
                    if let Some((_, '&')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::And,
                            position: pos,
                        });
                    } else {
                        return Err(HttpqlError::LexerError {
                            position: pos,
                            message: "Unexpected single '&', expected '&&'".to_string(),
                        });
                    }
                }
                '|' => {
                    self.advance();
                    if let Some((_, '|')) = self.peek() {
                        self.advance();
                        tokens.push(SpannedToken {
                            token: Token::Or,
                            position: pos,
                        });
                    } else {
                        return Err(HttpqlError::LexerError {
                            position: pos,
                            message: "Unexpected single '|', expected '||'".to_string(),
                        });
                    }
                }
                '"' | '\'' => {
                    let (tok, p) = self.tokenize_string(ch, pos)?;
                    tokens.push(SpannedToken {
                        token: tok,
                        position: p,
                    });
                }
                '/' => {
                    let (tok, p) = self.tokenize_regex(pos)?;
                    tokens.push(SpannedToken {
                        token: tok,
                        position: p,
                    });
                }
                '0'..='9' => {
                    let (tok, p) = self.tokenize_number(pos);
                    tokens.push(SpannedToken {
                        token: tok,
                        position: p,
                    });
                }
                _ if ch.is_alphabetic() || ch == '_' => {
                    let (tok, p) = self.tokenize_ident(pos);
                    tokens.push(SpannedToken {
                        token: tok,
                        position: p,
                    });
                }
                _ => {
                    return Err(HttpqlError::LexerError {
                        position: pos,
                        message: format!("Unexpected character: '{}'", ch),
                    });
                }
            }
        }

        let eof_pos = self.input.len();
        tokens.push(SpannedToken {
            token: Token::Eof,
            position: eof_pos,
        });
        Ok(tokens)
    }

    fn peek(&self) -> Option<(usize, char)> {
        if self.cursor < self.chars.len() {
            Some(self.chars[self.cursor])
        } else {
            None
        }
    }

    fn peek_next(&self) -> Option<char> {
        if self.cursor + 1 < self.chars.len() {
            Some(self.chars[self.cursor + 1].1)
        } else {
            None
        }
    }

    fn advance(&mut self) -> Option<(usize, char)> {
        if self.cursor < self.chars.len() {
            let ch = self.chars[self.cursor];
            self.cursor += 1;
            Some(ch)
        } else {
            None
        }
    }

    fn skip_comment(&mut self) {
        while let Some((_, ch)) = self.peek() {
            self.advance();
            if ch == '\n' {
                break;
            }
        }
    }

    fn tokenize_string(
        &mut self,
        quote: char,
        start_pos: usize,
    ) -> Result<(Token, usize), HttpqlError> {
        self.advance(); // consume opening quote
        let mut s = String::new();
        let mut escaped = false;

        while let Some((_, ch)) = self.peek() {
            self.advance();
            if escaped {
                match ch {
                    'n' => s.push('\n'),
                    'r' => s.push('\r'),
                    't' => s.push('\t'),
                    '\\' => s.push('\\'),
                    '\'' => s.push('\''),
                    '"' => s.push('"'),
                    _ => {
                        s.push('\\');
                        s.push(ch);
                    }
                }
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == quote {
                return Ok((Token::StringLiteral(s), start_pos));
            } else {
                s.push(ch);
            }
        }

        Err(HttpqlError::LexerError {
            position: start_pos,
            message: "Unterminated string literal".to_string(),
        })
    }

    fn tokenize_regex(&mut self, start_pos: usize) -> Result<(Token, usize), HttpqlError> {
        self.advance(); // consume opening '/'
        let mut pattern = String::new();
        let mut escaped = false;

        while let Some((_, ch)) = self.peek() {
            self.advance();
            if escaped {
                pattern.push('\\');
                pattern.push(ch);
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '/' {
                return Ok((Token::RegexLiteral(pattern), start_pos));
            } else {
                pattern.push(ch);
            }
        }

        Err(HttpqlError::LexerError {
            position: start_pos,
            message: "Unterminated regex literal".to_string(),
        })
    }

    fn tokenize_number(&mut self, start_pos: usize) -> (Token, usize) {
        let mut num_str = String::new();
        let mut is_float = false;

        while let Some((_, ch)) = self.peek() {
            if ch.is_ascii_digit() {
                num_str.push(ch);
                self.advance();
            } else if ch == '.'
                && !is_float
                && self
                    .peek_next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
            {
                is_float = true;
                num_str.push(ch);
                self.advance();
            } else {
                break;
            }
        }

        if is_float {
            let val = num_str.parse::<f64>().unwrap_or(0.0);
            (Token::FloatLiteral(val), start_pos)
        } else {
            let val = num_str.parse::<i64>().unwrap_or(0);
            (Token::NumberLiteral(val), start_pos)
        }
    }

    fn tokenize_ident(&mut self, start_pos: usize) -> (Token, usize) {
        let mut ident = String::new();

        while let Some((_, ch)) = self.peek() {
            if ch.is_alphanumeric() || ch == '_' || ch == '.' || ch == '-' {
                ident.push(ch);
                self.advance();
            } else {
                break;
            }
        }

        let lower = ident.to_ascii_lowercase();
        let token = match lower.as_str() {
            "and" => Token::And,
            "or" => Token::Or,
            "not" => Token::Not,
            "contains" => Token::Contains,
            "not_contains" => Token::NotContains,
            "matches" => Token::Matches,
            "starts_with" => Token::StartsWith,
            "ends_with" => Token::EndsWith,
            "in" => Token::In,
            "not_in" => Token::NotIn,
            "true" => Token::BooleanLiteral(true),
            "false" => Token::BooleanLiteral(false),
            _ => Token::Ident(ident),
        };

        (token, start_pos)
    }
}
