// crates/sentinel_scope/src/matchers/url.rs
//
// URL Matching Engine supporting exact URLs, prefix paths, and ReDoS-bounded Regex matching.
// Strictly enforces V6_CANONICAL_SPEC.yaml (§ 4 ReDoS Protection):
// - Pattern length <= 1000 characters
// - Execution timeout <= 100ms
// - Fail-closed on syntax error, pattern too long, or timeout.

use std::time::{Duration, Instant};
use url::Url;

pub const MAX_REGEX_PATTERN_LENGTH: usize = 1000;
pub const MAX_REGEX_TIMEOUT: Duration = Duration::from_millis(100);
pub const MAX_REGEX_EVAL_STEPS: usize = 50_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UrlMatchResult {
    Matched,
    NotMatched,
    Timeout,
    SyntaxError(String),
    PatternTooLong,
}

impl UrlMatchResult {
    pub fn is_matched(&self) -> bool {
        matches!(self, UrlMatchResult::Matched)
    }

    pub fn is_fail_closed_error(&self) -> bool {
        matches!(
            self,
            UrlMatchResult::Timeout
                | UrlMatchResult::SyntaxError(_)
                | UrlMatchResult::PatternTooLong
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UrlMatcher {
    /// Exact URL match (e.g. `https://example.com/api/v1/users`).
    Exact(String),
    /// URL prefix match (e.g. `https://example.com/api/` or `https://example.com/api/*`).
    Prefix(String),
    /// ReDoS-bounded Regex pattern.
    Regex { raw_pattern: String, ast: RegexAst },
    /// Invalid regex stored to fail closed on evaluation.
    InvalidRegex { raw_pattern: String, reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegexAst {
    Sequence(Vec<RegexAst>),
    Alternate(Vec<RegexAst>),
    Repeat {
        node: Box<RegexAst>,
        min: usize,
        max: Option<usize>,
    },
    CharClass(CharClass),
    Literal(char),
    AnyChar,
    StartAnchor,
    EndAnchor,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CharClass {
    Digit,                          // \d
    NonDigit,                       // \D
    Word,                           // \w
    NonWord,                        // \W
    Whitespace,                     // \s
    NonWhitespace,                  // \S
    Range(Vec<(char, char)>, bool), // [a-z0-9] or [^a-z]
}

impl CharClass {
    pub fn matches(&self, c: char) -> bool {
        match self {
            CharClass::Digit => c.is_ascii_digit(),
            CharClass::NonDigit => !c.is_ascii_digit(),
            CharClass::Word => c.is_ascii_alphanumeric() || c == '_',
            CharClass::NonWord => !(c.is_ascii_alphanumeric() || c == '_'),
            CharClass::Whitespace => c.is_whitespace(),
            CharClass::NonWhitespace => !c.is_whitespace(),
            CharClass::Range(ranges, negated) => {
                let inside = ranges.iter().any(|&(start, end)| c >= start && c <= end);
                if *negated {
                    !inside
                } else {
                    inside
                }
            }
        }
    }
}

impl UrlMatcher {
    /// Parses a URL rule into an `Exact`, `Prefix`, or `Regex` matcher.
    pub fn parse(pattern: &str) -> Self {
        let pattern = pattern.trim();

        // 1. Check if pattern is a regex rule (starts with ^ or has regex metacharacters)
        if Self::is_regex_syntax(pattern) {
            if pattern.len() > MAX_REGEX_PATTERN_LENGTH {
                return UrlMatcher::InvalidRegex {
                    raw_pattern: pattern.to_string(),
                    reason: format!(
                        "Regex pattern exceeds maximum length of {} characters (actual: {})",
                        MAX_REGEX_PATTERN_LENGTH,
                        pattern.len()
                    ),
                };
            }

            match RegexParser::parse(pattern) {
                Ok(ast) => UrlMatcher::Regex {
                    raw_pattern: pattern.to_string(),
                    ast,
                },
                Err(err) => UrlMatcher::InvalidRegex {
                    raw_pattern: pattern.to_string(),
                    reason: err,
                },
            }
        } else if pattern.ends_with('*') {
            // Prefix rule with trailing wildcard
            let prefix = pattern.trim_end_matches('*');
            UrlMatcher::Prefix(prefix.to_string())
        } else if pattern.starts_with("http://") || pattern.starts_with("https://") {
            // Check if it should be prefix or exact
            if pattern.ends_with('/') {
                UrlMatcher::Prefix(pattern.to_string())
            } else {
                UrlMatcher::Exact(pattern.to_string())
            }
        } else {
            // Default prefix/exact
            UrlMatcher::Prefix(pattern.to_string())
        }
    }

    /// Determines if a pattern string contains regex metacharacters.
    fn is_regex_syntax(pattern: &str) -> bool {
        pattern.starts_with('^')
            || pattern.ends_with('$')
            || pattern.contains(r"\d")
            || pattern.contains(r"\w")
            || pattern.contains(r"\s")
            || pattern.contains(r"\D")
            || pattern.contains(r"\W")
            || pattern.contains(r"\S")
            || pattern.contains(".*")
            || pattern.contains(".+")
            || pattern.contains("(?:")
            || (pattern.contains('(') && pattern.contains(')'))
            || (pattern.contains('[') && pattern.contains(']'))
            || pattern.contains('|')
    }

    /// Evaluates a candidate URI against this URL matcher with strict ReDoS boundaries.
    pub fn evaluate(&self, candidate_uri: &str) -> UrlMatchResult {
        let candidate_uri = candidate_uri.trim();
        if candidate_uri.is_empty() {
            return UrlMatchResult::NotMatched;
        }

        match self {
            UrlMatcher::Exact(expected) => {
                if candidate_uri == expected {
                    UrlMatchResult::Matched
                } else if let (Ok(u1), Ok(u2)) = (Url::parse(candidate_uri), Url::parse(expected)) {
                    if u1.scheme() == u2.scheme()
                        && u1.host_str() == u2.host_str()
                        && u1.port_or_known_default() == u2.port_or_known_default()
                        && u1.path() == u2.path()
                        && u1.query() == u2.query()
                    {
                        UrlMatchResult::Matched
                    } else {
                        UrlMatchResult::NotMatched
                    }
                } else {
                    UrlMatchResult::NotMatched
                }
            }
            UrlMatcher::Prefix(prefix) => {
                if candidate_uri.starts_with(prefix) {
                    UrlMatchResult::Matched
                } else {
                    // Try parsing both as URLs for scheme/host normalization
                    if let (Ok(c_url), Ok(p_url)) = (Url::parse(candidate_uri), Url::parse(prefix))
                    {
                        if c_url.scheme() == p_url.scheme()
                            && c_url.host_str() == p_url.host_str()
                            && c_url.port_or_known_default() == p_url.port_or_known_default()
                            && c_url.path().starts_with(p_url.path())
                        {
                            return UrlMatchResult::Matched;
                        }
                    }
                    UrlMatchResult::NotMatched
                }
            }
            UrlMatcher::Regex {
                raw_pattern: _,
                ast,
            } => {
                let start_time = Instant::now();
                let deadline = start_time + MAX_REGEX_TIMEOUT;
                let mut step_count = 0;

                let chars: Vec<char> = candidate_uri.chars().collect();
                let matched = RegexExecutor::execute(ast, &chars, deadline, &mut step_count);

                match matched {
                    Ok(true) => UrlMatchResult::Matched,
                    Ok(false) => UrlMatchResult::NotMatched,
                    Err(ExecError::Timeout) => UrlMatchResult::Timeout,
                }
            }
            UrlMatcher::InvalidRegex {
                raw_pattern: _,
                reason,
            } => {
                if reason.contains("exceeds maximum length") {
                    UrlMatchResult::PatternTooLong
                } else {
                    UrlMatchResult::SyntaxError(reason.clone())
                }
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum ExecError {
    Timeout,
}

struct RegexParser<'a> {
    input: &'a [char],
    pos: usize,
}

impl<'a> RegexParser<'a> {
    pub fn parse(pattern: &str) -> Result<RegexAst, String> {
        let chars: Vec<char> = pattern.chars().collect();
        let mut parser = RegexParser {
            input: &chars,
            pos: 0,
        };
        let ast = parser.parse_alternate()?;
        if parser.pos < parser.input.len() {
            return Err(format!(
                "Unexpected character at pos {}: '{}'",
                parser.pos, parser.input[parser.pos]
            ));
        }
        Ok(ast)
    }

    fn peek(&self) -> Option<char> {
        if self.pos < self.input.len() {
            Some(self.input[self.pos])
        } else {
            None
        }
    }

    fn next(&mut self) -> Option<char> {
        if self.pos < self.input.len() {
            let ch = self.input[self.pos];
            self.pos += 1;
            Some(ch)
        } else {
            None
        }
    }

    fn parse_alternate(&mut self) -> Result<RegexAst, String> {
        let mut branches = Vec::new();
        branches.push(self.parse_sequence()?);

        while self.peek() == Some('|') {
            self.next(); // consume '|'
            branches.push(self.parse_sequence()?);
        }

        if branches.len() == 1 {
            Ok(branches.remove(0))
        } else {
            Ok(RegexAst::Alternate(branches))
        }
    }

    fn parse_sequence(&mut self) -> Result<RegexAst, String> {
        let mut nodes = Vec::new();
        while let Some(ch) = self.peek() {
            if ch == '|' || ch == ')' {
                break;
            }
            nodes.push(self.parse_quantified_element()?);
        }

        if nodes.len() == 1 {
            Ok(nodes.remove(0))
        } else {
            Ok(RegexAst::Sequence(nodes))
        }
    }

    fn parse_quantified_element(&mut self) -> Result<RegexAst, String> {
        let node = self.parse_atom()?;

        if let Some(ch) = self.peek() {
            match ch {
                '*' => {
                    self.next();
                    Ok(RegexAst::Repeat {
                        node: Box::new(node),
                        min: 0,
                        max: None,
                    })
                }
                '+' => {
                    self.next();
                    Ok(RegexAst::Repeat {
                        node: Box::new(node),
                        min: 1,
                        max: None,
                    })
                }
                '?' => {
                    self.next();
                    Ok(RegexAst::Repeat {
                        node: Box::new(node),
                        min: 0,
                        max: Some(1),
                    })
                }
                '{' => {
                    self.next(); // consume '{'
                    let (min, max) = self.parse_range_bounds()?;
                    Ok(RegexAst::Repeat {
                        node: Box::new(node),
                        min,
                        max,
                    })
                }
                _ => Ok(node),
            }
        } else {
            Ok(node)
        }
    }

    fn parse_range_bounds(&mut self) -> Result<(usize, Option<usize>), String> {
        let mut num_str = String::new();
        while let Some(ch) = self.peek() {
            if ch.is_ascii_digit() {
                num_str.push(ch);
                self.next();
            } else {
                break;
            }
        }

        let min = num_str
            .parse::<usize>()
            .map_err(|_| "Invalid range min number".to_string())?;

        match self.peek() {
            Some('}') => {
                self.next();
                Ok((min, Some(min)))
            }
            Some(',') => {
                self.next(); // consume ','
                let mut max_str = String::new();
                while let Some(ch) = self.peek() {
                    if ch.is_ascii_digit() {
                        max_str.push(ch);
                        self.next();
                    } else {
                        break;
                    }
                }
                if self.peek() == Some('}') {
                    self.next();
                    if max_str.is_empty() {
                        Ok((min, None))
                    } else {
                        let max = max_str
                            .parse::<usize>()
                            .map_err(|_| "Invalid range max number".to_string())?;
                        Ok((min, Some(max)))
                    }
                } else {
                    Err("Expected '}' in range quantifier".to_string())
                }
            }
            _ => Err("Expected ',' or '}' in range quantifier".to_string()),
        }
    }

    fn parse_atom(&mut self) -> Result<RegexAst, String> {
        let ch = self
            .next()
            .ok_or_else(|| "Unexpected end of regex input".to_string())?;

        match ch {
            '^' => Ok(RegexAst::StartAnchor),
            '$' => Ok(RegexAst::EndAnchor),
            '.' => Ok(RegexAst::AnyChar),
            '(' => {
                // Check for non-capturing group (?:...)
                if self.peek() == Some('?') {
                    self.next();
                    if self.peek() == Some(':') {
                        self.next();
                    }
                }
                let inner = self.parse_alternate()?;
                if self.next() != Some(')') {
                    return Err("Unclosed group parentheses".to_string());
                }
                Ok(inner)
            }
            '[' => {
                let negated = if self.peek() == Some('^') {
                    self.next();
                    true
                } else {
                    false
                };

                let mut ranges = Vec::new();
                let mut last_char: Option<char> = None;
                let mut closed = false;

                while let Some(c) = self.next() {
                    if c == ']' {
                        closed = true;
                        break;
                    }
                    if c == '-' && last_char.is_some() && self.peek() != Some(']') {
                        let end_char = self.next().ok_or_else(|| {
                            "Unexpected end of range in character class".to_string()
                        })?;
                        let start_char = last_char.unwrap();
                        ranges.push((start_char, end_char));
                        last_char = None;
                    } else {
                        if let Some(lc) = last_char {
                            ranges.push((lc, lc));
                        }
                        if c == '\\' {
                            let esc = self
                                .next()
                                .ok_or_else(|| "Escape at end of class".to_string())?;
                            last_char = Some(esc);
                        } else {
                            last_char = Some(c);
                        }
                    }
                }

                if !closed {
                    return Err("Unclosed bracket in character class".to_string());
                }

                if let Some(lc) = last_char {
                    ranges.push((lc, lc));
                }

                Ok(RegexAst::CharClass(CharClass::Range(ranges, negated)))
            }
            '\\' => {
                let esc = self
                    .next()
                    .ok_or_else(|| "Escape at end of pattern".to_string())?;
                match esc {
                    'd' => Ok(RegexAst::CharClass(CharClass::Digit)),
                    'D' => Ok(RegexAst::CharClass(CharClass::NonDigit)),
                    'w' => Ok(RegexAst::CharClass(CharClass::Word)),
                    'W' => Ok(RegexAst::CharClass(CharClass::NonWord)),
                    's' => Ok(RegexAst::CharClass(CharClass::Whitespace)),
                    'S' => Ok(RegexAst::CharClass(CharClass::NonWhitespace)),
                    other => Ok(RegexAst::Literal(other)),
                }
            }
            other => Ok(RegexAst::Literal(other)),
        }
    }
}

struct RegexExecutor;

impl RegexExecutor {
    pub fn execute(
        ast: &RegexAst,
        chars: &[char],
        deadline: Instant,
        step_count: &mut usize,
    ) -> Result<bool, ExecError> {
        // If pattern has StartAnchor, match only at pos 0; otherwise match at any start pos.
        let has_start_anchor = Self::has_start_anchor(ast);
        if has_start_anchor {
            Self::match_node(ast, chars, 0, deadline, step_count).map(|matches| {
                matches.contains(&chars.len()) || matches.iter().any(|&p| p <= chars.len())
            })
        } else {
            for start_pos in 0..=chars.len() {
                let matches = Self::match_node(ast, chars, start_pos, deadline, step_count)?;
                if !matches.is_empty() {
                    return Ok(true);
                }
            }
            Ok(false)
        }
    }

    fn has_start_anchor(ast: &RegexAst) -> bool {
        match ast {
            RegexAst::StartAnchor => true,
            RegexAst::Sequence(nodes) => nodes.first().is_some_and(Self::has_start_anchor),
            RegexAst::Alternate(nodes) => nodes.iter().all(Self::has_start_anchor),
            _ => false,
        }
    }

    fn match_node(
        ast: &RegexAst,
        chars: &[char],
        pos: usize,
        deadline: Instant,
        step_count: &mut usize,
    ) -> Result<Vec<usize>, ExecError> {
        *step_count += 1;
        if *step_count > MAX_REGEX_EVAL_STEPS || Instant::now() > deadline {
            return Err(ExecError::Timeout);
        }

        match ast {
            RegexAst::StartAnchor => {
                if pos == 0 {
                    Ok(vec![0])
                } else {
                    Ok(vec![])
                }
            }
            RegexAst::EndAnchor => {
                if pos == chars.len() {
                    Ok(vec![pos])
                } else {
                    Ok(vec![])
                }
            }
            RegexAst::AnyChar => {
                if pos < chars.len() {
                    Ok(vec![pos + 1])
                } else {
                    Ok(vec![])
                }
            }
            RegexAst::Literal(c) => {
                if pos < chars.len() && chars[pos] == *c {
                    Ok(vec![pos + 1])
                } else {
                    Ok(vec![])
                }
            }
            RegexAst::CharClass(class) => {
                if pos < chars.len() && class.matches(chars[pos]) {
                    Ok(vec![pos + 1])
                } else {
                    Ok(vec![])
                }
            }
            RegexAst::Sequence(nodes) => {
                let mut current_positions = vec![pos];
                for node in nodes {
                    let mut next_positions = Vec::new();
                    for &p in &current_positions {
                        let matches = Self::match_node(node, chars, p, deadline, step_count)?;
                        next_positions.extend(matches);
                    }
                    if next_positions.is_empty() {
                        return Ok(vec![]);
                    }
                    next_positions.sort_unstable();
                    next_positions.dedup();
                    current_positions = next_positions;
                }
                Ok(current_positions)
            }
            RegexAst::Alternate(branches) => {
                let mut all_positions = Vec::new();
                for branch in branches {
                    let matches = Self::match_node(branch, chars, pos, deadline, step_count)?;
                    all_positions.extend(matches);
                }
                all_positions.sort_unstable();
                all_positions.dedup();
                Ok(all_positions)
            }
            RegexAst::Repeat { node, min, max } => {
                let mut results = Vec::new();
                let mut states = vec![(pos, 0usize)]; // (current_pos, match_count)

                while let Some((curr_p, count)) = states.pop() {
                    *step_count += 1;
                    if *step_count > MAX_REGEX_EVAL_STEPS || Instant::now() > deadline {
                        return Err(ExecError::Timeout);
                    }

                    if count >= *min {
                        results.push(curr_p);
                    }

                    if max.is_none_or(|m| count < m) {
                        let next_positions =
                            Self::match_node(node, chars, curr_p, deadline, step_count)?;
                        for np in next_positions {
                            if np > curr_p {
                                states.push((np, count + 1));
                            }
                        }
                    }
                }
                results.sort_unstable();
                results.dedup();
                Ok(results)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_and_prefix_urls() {
        let exact = UrlMatcher::parse("https://example.com/api/v1/users");
        assert_eq!(
            exact.evaluate("https://example.com/api/v1/users"),
            UrlMatchResult::Matched
        );
        assert_eq!(
            exact.evaluate("https://example.com/api/v1/users/"),
            UrlMatchResult::NotMatched
        );
        assert_eq!(
            exact.evaluate("https://example.com/api/v1/other"),
            UrlMatchResult::NotMatched
        );

        let prefix = UrlMatcher::parse("https://example.com/api/*");
        assert_eq!(
            prefix.evaluate("https://example.com/api/v1/users"),
            UrlMatchResult::Matched
        );
        assert_eq!(
            prefix.evaluate("https://example.com/api/settings"),
            UrlMatchResult::Matched
        );
        assert_eq!(
            prefix.evaluate("https://example.com/admin"),
            UrlMatchResult::NotMatched
        );
    }

    #[test]
    fn test_regex_url_matching() {
        let regex = UrlMatcher::parse(r"^https://example\.com/users/\d+$");
        assert_eq!(
            regex.evaluate("https://example.com/users/12345"),
            UrlMatchResult::Matched
        );
        assert_eq!(
            regex.evaluate("https://example.com/users/abc"),
            UrlMatchResult::NotMatched
        );
        assert_eq!(
            regex.evaluate("http://example.com/users/12345"),
            UrlMatchResult::NotMatched
        );
    }

    #[test]
    fn test_redos_catastrophic_backtracking_fail_closed() {
        // Catastrophic backtracking pattern: (a+)+$ against 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!'
        let evil_pattern = r"^(a+)+$";
        let regex = UrlMatcher::parse(evil_pattern);
        let non_matching_payload = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!";

        let res = regex.evaluate(non_matching_payload);
        assert!(
            res == UrlMatchResult::Timeout || res == UrlMatchResult::NotMatched,
            "ReDoS must either safely finish within budget or trigger Timeout Fail-Closed"
        );
    }

    #[test]
    fn test_pattern_too_long_fail_closed() {
        let long_pattern = format!("^{}$", "a".repeat(1005));
        let matcher = UrlMatcher::parse(&long_pattern);
        let res = matcher.evaluate("https://example.com");
        assert_eq!(res, UrlMatchResult::PatternTooLong);
    }

    #[test]
    fn test_invalid_syntax_fail_closed() {
        let bad_pattern = r"^https://example\.com/[unclosed-bracket";
        let matcher = UrlMatcher::parse(bad_pattern);
        let res = matcher.evaluate("https://example.com/test");
        assert!(matches!(res, UrlMatchResult::SyntaxError(_)));
    }
}
