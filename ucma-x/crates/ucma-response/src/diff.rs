//! Structural tokenization and differential analysis engine.
//! Computes Levenshtein, Jaccard, and DOM/JSON structural similarity metrics to categorize response behavior.

use crate::masking::{DynamicContentMasker, MaskingConfig};
use crate::signatures::{DbmsErrorCatalog, DbmsErrorMatch};
use crate::structural::{HtmlStructuralTokenizer, JsonStructuralTokenizer, TextTokenizer};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ucma_core::snapshot::ResponseSnapshot;

/// Categorization of divergence between two responses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ResponseDivergenceType {
    /// Responses are bit-for-bit identical.
    Identical,
    /// Responses differ only by non-deterministic dynamic tokens (timestamps, CSRF tokens, UUIDs).
    EquivalentMasked,
    /// Responses share identical HTML DOM or JSON structure, but content/values differ.
    ContentDivergence,
    /// Responses have distinct structural skeletons (e.g. elements inserted/removed).
    StructuralDivergence,
    /// Response contains an explicit DBMS syntax or driver exception.
    ErrorDivergence,
}

/// Detailed differential analysis report comparing a baseline and probe response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseDiffResult {
    pub divergence_type: ResponseDivergenceType,
    pub raw_similarity: f64,
    pub masked_similarity: f64,
    pub structural_similarity: f64,
    pub jaccard_similarity: f64,
    pub status_code_changed: bool,
    pub baseline_status: u16,
    pub candidate_status: u16,
    pub dbms_error: Option<DbmsErrorMatch>,
}

/// Differential analysis engine for HTTP responses.
pub struct ResponseDiffer {
    masker: DynamicContentMasker,
    error_catalog: DbmsErrorCatalog,
}

impl Default for ResponseDiffer {
    fn default() -> Self {
        Self::new()
    }
}

impl ResponseDiffer {
    pub fn new() -> Self {
        Self {
            masker: DynamicContentMasker::new(MaskingConfig::default()),
            error_catalog: DbmsErrorCatalog::new(),
        }
    }

    /// Compares two full ResponseSnapshots.
    pub fn diff_snapshots(
        &self,
        base: &ResponseSnapshot,
        candidate: &ResponseSnapshot,
    ) -> ResponseDiffResult {
        let base_body = std::str::from_utf8(&base.body).unwrap_or("");
        let cand_body = std::str::from_utf8(&candidate.body).unwrap_or("");

        let mut result = self.diff_texts(base_body, cand_body);
        result.baseline_status = base.status_code;
        result.candidate_status = candidate.status_code;
        result.status_code_changed = base.status_code != candidate.status_code;

        if result.status_code_changed && result.candidate_status >= 500 && result.dbms_error.is_some() {
            result.divergence_type = ResponseDivergenceType::ErrorDivergence;
        }

        result
    }

    /// Compares two response body strings across all similarity dimensions.
    pub fn diff_texts(&self, base: &str, candidate: &str) -> ResponseDiffResult {
        // 1. Check for DBMS errors
        let dbms_error = self.error_catalog.find_error(candidate);

        // 2. Check exact equality
        if base == candidate {
            return ResponseDiffResult {
                divergence_type: if dbms_error.is_some() {
                    ResponseDivergenceType::ErrorDivergence
                } else {
                    ResponseDivergenceType::Identical
                },
                raw_similarity: 1.0,
                masked_similarity: 1.0,
                structural_similarity: 1.0,
                jaccard_similarity: 1.0,
                status_code_changed: false,
                baseline_status: 200,
                candidate_status: 200,
                dbms_error,
            };
        }

        // 3. Check masked equality
        let masked_base = self.masker.mask(base);
        let masked_cand = self.masker.mask(candidate);

        let raw_similarity = Self::levenshtein_similarity(base, candidate);
        let masked_similarity = Self::levenshtein_similarity(&masked_base, &masked_cand);

        // 4. Token Jaccard similarity
        let tokens_base = TextTokenizer::tokenize_words(base);
        let tokens_cand = TextTokenizer::tokenize_words(candidate);
        let jaccard_similarity = Self::jaccard_similarity(&tokens_base, &tokens_cand);

        // 5. Structural skeleton similarity (HTML or JSON)
        let structural_similarity = if let (Some(json_b), Some(json_c)) = (
            JsonStructuralTokenizer::tokenize(base),
            JsonStructuralTokenizer::tokenize(candidate),
        ) {
            Self::jaccard_similarity(&json_b.token_set, &json_c.token_set)
        } else {
            let html_b = HtmlStructuralTokenizer::tokenize(base);
            let html_c = HtmlStructuralTokenizer::tokenize(candidate);
            Self::jaccard_similarity(&html_b.token_set, &html_c.token_set)
        };

        // 6. Categorize divergence
        let divergence_type = if dbms_error.is_some() {
            ResponseDivergenceType::ErrorDivergence
        } else if masked_base == masked_cand {
            ResponseDivergenceType::EquivalentMasked
        } else if structural_similarity >= 0.95 {
            ResponseDivergenceType::ContentDivergence
        } else {
            ResponseDivergenceType::StructuralDivergence
        };

        ResponseDiffResult {
            divergence_type,
            raw_similarity,
            masked_similarity,
            structural_similarity,
            jaccard_similarity,
            status_code_changed: false,
            baseline_status: 200,
            candidate_status: 200,
            dbms_error,
        }
    }

    /// Computes normalized Levenshtein similarity: 1.0 - (dist / max(len1, len2)).
    pub fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
        if s1 == s2 {
            return 1.0;
        }
        let max_len = s1.chars().count().max(s2.chars().count());
        if max_len == 0 {
            return 1.0;
        }
        let dist = Self::levenshtein_distance(s1, s2);
        (1.0 - (dist as f64 / max_len as f64)).max(0.0)
    }

    /// Standard bounded memory Levenshtein distance implementation.
    pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
        let v1: Vec<char> = s1.chars().collect();
        let v2: Vec<char> = s2.chars().collect();

        let len1 = v1.len();
        let len2 = v2.len();

        if len1 == 0 {
            return len2;
        }
        if len2 == 0 {
            return len1;
        }

        // Optimize for large strings: limit diff to max 5000 chars for safety
        let (v1, v2) = if len1 > 5000 || len2 > 5000 {
            (&v1[..len1.min(5000)], &v2[..len2.min(5000)])
        } else {
            (&v1[..], &v2[..])
        };

        let mut prev_row: Vec<usize> = (0..=v2.len()).collect();
        let mut curr_row: Vec<usize> = vec![0; v2.len() + 1];

        for (i, &c1) in v1.iter().enumerate() {
            curr_row[0] = i + 1;
            for (j, &c2) in v2.iter().enumerate() {
                let cost = if c1 == c2 { 0 } else { 1 };
                curr_row[j + 1] = (prev_row[j + 1] + 1)
                    .min(curr_row[j] + 1)
                    .min(prev_row[j] + cost);
            }
            prev_row.clone_from_slice(&curr_row);
        }

        prev_row[v2.len()]
    }

    /// Computes Jaccard index: |A ∩ B| / |A ∪ B|.
    pub fn jaccard_similarity<T: std::hash::Hash + Eq>(set_a: &HashSet<T>, set_b: &HashSet<T>) -> f64 {
        if set_a.is_empty() && set_b.is_empty() {
            return 1.0;
        }
        let intersection = set_a.intersection(set_b).count();
        let union = set_a.union(set_b).count();
        if union == 0 {
            1.0
        } else {
            intersection as f64 / union as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_diff() {
        let differ = ResponseDiffer::new();
        let body = "<html><body><h1>Dashboard</h1></body></html>";
        let diff = differ.diff_texts(body, body);
        assert_eq!(diff.divergence_type, ResponseDivergenceType::Identical);
        assert_eq!(diff.raw_similarity, 1.0);
        assert_eq!(diff.structural_similarity, 1.0);
    }

    #[test]
    fn test_equivalent_masked_diff() {
        let differ = ResponseDiffer::new();
        let body1 = "Generated at 2026-08-30T10:00:00Z for req 550e8400-e29b-41d4-a716-446655440000";
        let body2 = "Generated at 2026-08-30T11:00:00Z for req 123e4567-e89b-12d3-a456-426614174000";
        let diff = differ.diff_texts(body1, body2);
        assert_eq!(diff.divergence_type, ResponseDivergenceType::EquivalentMasked);
        assert_eq!(diff.masked_similarity, 1.0);
    }

    #[test]
    fn test_content_divergence_diff() {
        let differ = ResponseDiffer::new();
        let body1 = r#"{"status": "ok", "user": {"id": 1, "name": "Alice"}}"#;
        let body2 = r#"{"status": "ok", "user": {"id": 2, "name": "Bob"}}"#;
        let diff = differ.diff_texts(body1, body2);
        assert_eq!(diff.divergence_type, ResponseDivergenceType::ContentDivergence);
        assert_eq!(diff.structural_similarity, 1.0);
        assert!(diff.raw_similarity < 1.0);
    }

    #[test]
    fn test_error_divergence_diff() {
        let differ = ResponseDiffer::new();
        let base = "<html><body><h1>Profile</h1><div>User: Alice</div></body></html>";
        let candidate = "<html><body><h1>Error</h1><p>ERROR:  syntax error at or near 'admin'</p></body></html>";
        let diff = differ.diff_texts(base, candidate);
        assert_eq!(diff.divergence_type, ResponseDivergenceType::ErrorDivergence);
        assert!(diff.dbms_error.is_some());
    }
}
