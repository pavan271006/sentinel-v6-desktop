//! Injection context inference engine.
//! Identifies the semantic SQL position and boundary context of an input vector.

use serde::{Deserialize, Serialize};

/// The semantic SQL/syntax context into which a parameter value is injected.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum InjectionContext {
    /// Injected directly into an unquoted numeric literal position (e.g. `WHERE id = $val` or `LIMIT $val`).
    Numeric,
    /// Injected into a standard single-quoted SQL string literal (e.g. `WHERE name = '$val'`).
    SingleQuoteString,
    /// Injected into a double-quoted string literal (e.g. MySQL string or standard SQL identifier `WHERE name = "$val"`).
    DoubleQuoteString,
    /// Injected into a backtick identifier (MySQL table/column: ``SELECT * FROM `$val` ``).
    BacktickIdentifier,
    /// Injected into a double-quote identifier (PostgreSQL / Oracle / SQLite: `SELECT "$val" FROM t`).
    DoubleQuoteIdentifier,
    /// Injected into MSSQL bracketed identifier (e.g. `SELECT * FROM [$val]`).
    BracketIdentifier,
    /// Injected inside a SQL comment (e.g. `/* $val */` or `-- $val`).
    CommentContext,
    /// Injected into a JSON / JSONB extraction path (e.g. `data->>'$val'`).
    JsonPath,
    /// Injected into an escaped string context (e.g. with backslash escaping `\'`).
    EscapedString,
    /// Injected into an ORDER BY / GROUP BY clause position (e.g. `ORDER BY $val ASC`).
    ClauseOrdering,
    /// Injected into a SELECT projection list (e.g. `SELECT $val FROM users`).
    ColumnProjection,
    /// Unknown or unclassified context.
    Unknown(String),
}

impl InjectionContext {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Numeric => "numeric",
            Self::SingleQuoteString => "single_quote_string",
            Self::DoubleQuoteString => "double_quote_string",
            Self::BacktickIdentifier => "backtick_identifier",
            Self::DoubleQuoteIdentifier => "double_quote_identifier",
            Self::BracketIdentifier => "bracket_identifier",
            Self::CommentContext => "comment_context",
            Self::JsonPath => "json_path",
            Self::EscapedString => "escaped_string",
            Self::ClauseOrdering => "clause_ordering",
            Self::ColumnProjection => "column_projection",
            Self::Unknown(s) => s.as_str(),
        }
    }

    /// Returns standard boundary closure characters that can terminate this context.
    pub fn boundary_escapes(&self) -> Vec<&'static str> {
        match self {
            Self::Numeric => vec!["", ")", "))", ")))"],
            Self::SingleQuoteString => vec!["'", "')", "'))", "')))", "' AND '1'='1"],
            Self::DoubleQuoteString => vec!["\"", "\")", "\"))", "\")))\""],
            Self::BacktickIdentifier => vec!["`", "`)", "` WHERE 1=1 --"],
            Self::DoubleQuoteIdentifier => vec!["\"", "\")", "\" WHERE 1=1 --"],
            Self::BracketIdentifier => vec!["]", "])", "] WHERE 1=1 --"],
            Self::CommentContext => vec!["*/", "\n", "\r\n"],
            Self::JsonPath => vec!["'", "\"}", "']", "'->>'a'"],
            Self::EscapedString => vec!["\\'", "\\\"", "\\\\'", "'"],
            Self::ClauseOrdering => vec!["", " ASC", " DESC", ", (SELECT 1)"],
            Self::ColumnProjection => vec!["", ", 1", " AS x, 1"],
            Self::Unknown(_) => vec!["'", "\"", ")", "*/"],
        }
    }
}

/// Inference analysis result for a given parameter.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ContextInferenceReport {
    pub primary_context: InjectionContext,
    pub candidate_contexts: Vec<(InjectionContext, f32)>,
    pub confidence: f32,
    pub suggested_escapes: Vec<String>,
}

/// Rule-based context inference engine for web parameters.
pub struct ContextInferenceEngine;

impl ContextInferenceEngine {
    /// Infers the SQL injection context based on the parameter name, raw value, and optional location hint.
    pub fn infer(param_name: &str, raw_value: &str) -> ContextInferenceReport {
        let name_lower = param_name.to_lowercase();
        let val_trimmed = raw_value.trim();

        let mut candidates: Vec<(InjectionContext, f32)> = Vec::new();

        // Check if pure numeric
        if !val_trimmed.is_empty()
            && (val_trimmed.parse::<i64>().is_ok() || val_trimmed.parse::<f64>().is_ok())
        {
            let mut score = 0.85;
            if name_lower.contains("id")
                || name_lower.contains("page")
                || name_lower.contains("limit")
                || name_lower.contains("offset")
                || name_lower.contains("count")
                || name_lower.contains("num")
            {
                score = 0.95;
            }
            candidates.push((InjectionContext::Numeric, score));
            candidates.push((InjectionContext::SingleQuoteString, 0.40));
        }

        // Check ordering / sort keywords
        if name_lower.contains("sort")
            || name_lower.contains("order")
            || name_lower.contains("orderby")
            || name_lower.contains("by")
        {
            let mut score = 0.80;
            if val_trimmed.eq_ignore_ascii_case("asc") || val_trimmed.eq_ignore_ascii_case("desc")
            {
                score = 0.95;
            }
            candidates.push((InjectionContext::ClauseOrdering, score));
            candidates.push((InjectionContext::BacktickIdentifier, 0.60));
            candidates.push((InjectionContext::DoubleQuoteIdentifier, 0.60));
        }

        // Check identifier naming (column, table, field)
        if name_lower.contains("col")
            || name_lower.contains("field")
            || name_lower.contains("table")
            || name_lower.contains("group")
        {
            candidates.push((InjectionContext::BacktickIdentifier, 0.70));
            candidates.push((InjectionContext::DoubleQuoteIdentifier, 0.70));
            candidates.push((InjectionContext::SingleQuoteString, 0.50));
        }

        // Check JSON path keywords or syntax
        if val_trimmed.starts_with('$')
            || val_trimmed.contains("->")
            || name_lower.starts_with('$')
            || name_lower.contains("json")
            || name_lower.contains("path")
        {
            candidates.push((InjectionContext::JsonPath, 0.85));
        }

        // Check comment patterns
        if val_trimmed.contains("/*") || val_trimmed.contains("--") {
            candidates.push((InjectionContext::CommentContext, 0.75));
        }

        // Check escaped string patterns
        if val_trimmed.contains("\\'") || val_trimmed.contains("\\\"") {
            candidates.push((InjectionContext::EscapedString, 0.80));
        }

        // Default / String literal fallback
        if candidates.is_empty() {
            if val_trimmed.starts_with('"') && val_trimmed.ends_with('"') {
                candidates.push((InjectionContext::DoubleQuoteString, 0.80));
                candidates.push((InjectionContext::SingleQuoteString, 0.60));
            } else {
                candidates.push((InjectionContext::SingleQuoteString, 0.75));
                candidates.push((InjectionContext::DoubleQuoteString, 0.40));
                candidates.push((InjectionContext::Numeric, 0.20));
            }
        }

        // Sort candidates by score descending
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let primary_context = candidates
            .first()
            .map(|(c, _)| c.clone())
            .unwrap_or(InjectionContext::SingleQuoteString);

        let confidence = candidates.first().map(|(_, s)| *s).unwrap_or(0.5);

        let mut suggested_escapes = Vec::new();
        for escape in primary_context.boundary_escapes() {
            suggested_escapes.push(escape.to_string());
        }

        ContextInferenceReport {
            primary_context,
            candidate_contexts: candidates,
            confidence,
            suggested_escapes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_numeric_context_inference() {
        let report = ContextInferenceEngine::infer("user_id", "42");
        assert_eq!(report.primary_context, InjectionContext::Numeric);
        assert!(report.confidence >= 0.9);
        assert!(report.suggested_escapes.contains(&")".to_string()));
    }

    #[test]
    fn test_sort_order_context_inference() {
        let report = ContextInferenceEngine::infer("sort_order", "ASC");
        assert_eq!(report.primary_context, InjectionContext::ClauseOrdering);
        assert!(report.confidence >= 0.9);
    }

    #[test]
    fn test_string_context_inference() {
        let report = ContextInferenceEngine::infer("search_query", "admin");
        assert_eq!(report.primary_context, InjectionContext::SingleQuoteString);
        assert!(report.suggested_escapes.contains(&"'".to_string()));
    }

    #[test]
    fn test_json_path_context_inference() {
        let report = ContextInferenceEngine::infer("filter_path", "$.user.profile");
        assert_eq!(report.primary_context, InjectionContext::JsonPath);
    }
}
