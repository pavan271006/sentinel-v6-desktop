//! Context Lattice Inversion Engine.
//! Evaluates 5-tuple context coordinates C = ⟨Q,D,K,E,T⟩, applies paired escape diagnostics
//! for string contexts, arithmetic invariants for numeric contexts, and strictly bans quote
//! injection into integer parameters.

use crate::extractor::ExtractedParameter;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum LatticeError {
    #[error("Classification failure: {0}")]
    Classification(String),
    #[error("String context validation failed: paired escape did not restore baseline")]
    StringValidationFailed(String),
    #[error("Numeric context validation failed: arithmetic invariant violated")]
    NumericValidationFailed(String),
    #[error("Quote injection strictly banned in integer parameter context")]
    QuoteInjectionInInteger,
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
}

/// Query clause type Q (SELECT, INSERT, UPDATE, etc.)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum QueryType {
    Select,
    Insert,
    Update,
    Delete,
    Unknown,
}

/// Target SQL Dialect D
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SqlDialect {
    PostgreSQL,
    MySQL,
    Oracle,
    MSSQL,
    SQLite,
    CockroachDB,
    Snowflake,
    TiDB,
    ClickHouse,
    Standard,
    Unknown,
}

/// Syntactic Keyword/Clause position K
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Keyword {
    Where,
    OrderBy,
    GroupBy,
    Having,
    Join,
    Values,
    Set,
    Limit,
    Unknown,
}

/// Boundary Escape Sequence E
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Escape {
    SingleQuote,
    DoubleQuote,
    Backtick,
    DollarQuote,
    Bracket,
    None,
}

/// Semantic Data Type Context T
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TypeContext {
    String,
    Numeric,
    Integer,
    Identifier,
    JsonPath,
    Boolean,
    Unknown,
}

/// 5-Tuple Context Coordinate C = ⟨Q, D, K, E, T⟩
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextCoordinate {
    pub query_type: QueryType,
    pub dialect: SqlDialect,
    pub keyword: Keyword,
    pub escape_sequence: Escape,
    pub type_context: TypeContext,
    pub parenthesis_depth: usize,
}

/// Initial parameter context classifier.
#[derive(Debug, Clone, Default)]
pub struct ContextClassifier;

impl ContextClassifier {
    pub fn classify(&self, param: &ExtractedParameter) -> Result<ContextCoordinate, LatticeError> {
        let name_lower = param.name.to_lowercase();
        let val_trimmed = param.raw_value.trim();

        // 1. Determine TypeContext
        let type_context = if !val_trimmed.is_empty() && val_trimmed.parse::<i64>().is_ok() {
            TypeContext::Integer
        } else if !val_trimmed.is_empty() && val_trimmed.parse::<f64>().is_ok() {
            TypeContext::Numeric
        } else if name_lower.contains("order") || name_lower.contains("sort") {
            TypeContext::Identifier
        } else if val_trimmed.starts_with('{') || val_trimmed.starts_with('[') {
            TypeContext::JsonPath
        } else if val_trimmed == "true" || val_trimmed == "false" {
            TypeContext::Boolean
        } else {
            TypeContext::String
        };

        // 2. Determine Escape Sequence
        let escape_sequence = match type_context {
            TypeContext::Integer | TypeContext::Numeric | TypeContext::Boolean => Escape::None,
            TypeContext::Identifier => Escape::Backtick,
            _ => Escape::SingleQuote,
        };

        // 3. Determine Keyword
        let keyword = if name_lower.contains("order") || name_lower.contains("sort") {
            Keyword::OrderBy
        } else if name_lower.contains("group") {
            Keyword::GroupBy
        } else if name_lower.contains("limit") || name_lower.contains("offset") {
            Keyword::Limit
        } else {
            Keyword::Where
        };

        Ok(ContextCoordinate {
            query_type: QueryType::Select,
            dialect: SqlDialect::Standard,
            keyword,
            escape_sequence,
            type_context,
            parenthesis_depth: 0,
        })
    }
}

/// Diagnostic engine for paired escape validation in string contexts.
#[derive(Debug, Clone, Default)]
pub struct EscapeDiagnostic;

impl EscapeDiagnostic {
    /// Validates string context using paired escapes:
    /// Probe A (Broken Quote): V || ' -> triggers divergence (broken syntax)
    /// Probe B (Repaired Quote): V || '' -> restores baseline behavior (valid escape)
    pub fn validate_string_context(
        &self,
        broken_diverges: bool,
        repaired_restores_baseline: bool,
    ) -> Result<bool, LatticeError> {
        if broken_diverges && repaired_restores_baseline {
            Ok(true)
        } else {
            Err(LatticeError::StringValidationFailed(
                "Paired escape invariant (' vs '') not satisfied".to_string(),
            ))
        }
    }
}

/// Diagnostic engine for pure arithmetic invariance in numeric contexts.
#[derive(Debug, Clone, Default)]
pub struct ArithmeticInvariant;

impl ArithmeticInvariant {
    /// Validates numeric context using arithmetic invariants:
    /// Probe A: val - 0 -> equivalent to baseline
    /// Probe B: val * 1 -> equivalent to baseline
    /// Probe C: val - 1 -> diverges from baseline
    pub fn validate_numeric_context(
        &self,
        minus_zero_matches_base: bool,
        minus_one_diverges: bool,
    ) -> Result<bool, LatticeError> {
        if minus_zero_matches_base && minus_one_diverges {
            Ok(true)
        } else {
            Err(LatticeError::NumericValidationFailed(
                "Arithmetic invariant (val-0 == base != val-1) not satisfied".to_string(),
            ))
        }
    }
}

/// Context Lattice Inversion Engine.
pub struct ContextLatticeInversionEngine {
    pub context_classifier: ContextClassifier,
    pub escape_diagnostic: EscapeDiagnostic,
    pub arithmetic_invariant: ArithmeticInvariant,
}

impl Default for ContextLatticeInversionEngine {
    fn default() -> Self {
        Self {
            context_classifier: ContextClassifier,
            escape_diagnostic: EscapeDiagnostic,
            arithmetic_invariant: ArithmeticInvariant,
        }
    }
}

impl ContextLatticeInversionEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Checks if a proposed probe payload contains illegal quotes in a numeric context.
    pub fn contains_illegal_quotes(&self, type_context: TypeContext, payload: &str) -> bool {
        if matches!(type_context, TypeContext::Integer | TypeContext::Numeric) {
            payload.contains('\'') || payload.contains('"') || payload.contains('`')
        } else {
            false
        }
    }

    /// Evaluates 5-tuple context coordinates C = ⟨Q,D,K,E,T⟩
    pub fn evaluate_context(
        &self,
        parameter: &ExtractedParameter,
        proposed_payload: Option<&str>,
    ) -> Result<ContextCoordinate, LatticeError> {
        let context = self.context_classifier.classify(parameter)?;

        // Strictly ban quote injection into integer/numeric parameters
        if let Some(payload) = proposed_payload {
            if self.contains_illegal_quotes(context.type_context, payload) {
                return Err(LatticeError::QuoteInjectionInInteger);
            }
        }

        Ok(context)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_core::ids::{ContentId, EndpointId};
    use ucma_core::parameter::ParameterLocation;

    #[test]
    fn test_strictly_bans_quotes_in_integer_parameters() {
        let engine = ContextLatticeInversionEngine::new();
        let endpoint_id = EndpointId::new(ContentId::from_data(b"ep_test"));
        let param = ExtractedParameter::new(
            &endpoint_id,
            "id",
            ParameterLocation::Query,
            "1082",
        );

        // Benign arithmetic payload -> Allowed
        let result_valid = engine.evaluate_context(&param, Some("1082-0"));
        assert!(result_valid.is_ok());
        let coord = result_valid.unwrap();
        assert_eq!(coord.type_context, TypeContext::Integer);
        assert_eq!(coord.escape_sequence, Escape::None);

        // Quote-injected payload -> Strictly Banned!
        let result_illegal = engine.evaluate_context(&param, Some("1082'"));
        assert_eq!(result_illegal, Err(LatticeError::QuoteInjectionInInteger));
    }

    #[test]
    fn test_paired_escape_string_diagnostic() {
        let diagnostic = EscapeDiagnostic;
        // Probe A (Broken Quote) diverges: true
        // Probe B (Repaired Quote) restores baseline: true
        let validation = diagnostic.validate_string_context(true, true);
        assert!(validation.is_ok());

        // Invariant broken: probe B doesn't restore baseline
        let failed = diagnostic.validate_string_context(true, false);
        assert!(failed.is_err());
    }

    #[test]
    fn test_arithmetic_invariance_numeric_diagnostic() {
        let invariant = ArithmeticInvariant;
        // val-0 == base (true) and val-1 != base (true)
        let validation = invariant.validate_numeric_context(true, true);
        assert!(validation.is_ok());

        // val-1 doesn't diverge (target is inert or non-numeric)
        let failed = invariant.validate_numeric_context(true, false);
        assert!(failed.is_err());
    }
}
