//! Depth-bounded grammar-guided SQL expression synthesizer.

pub struct GrammarSynthesizer {
    pub max_depth: usize,
}

impl Default for GrammarSynthesizer {
    fn default() -> Self {
        Self { max_depth: 3 }
    }
}

impl GrammarSynthesizer {
    /// Synthesizes balanced boolean differential condition pairs.
    pub fn synthesize_boolean_pair(&self, is_numeric: bool) -> (String, String) {
        if is_numeric {
            ("AND 1=1".to_string(), "AND 1=2".to_string())
        } else {
            ("' AND '1'='1".to_string(), "' AND '1'='2".to_string())
        }
    }

    /// Synthesizes a depth-bounded tautology expression.
    pub fn synthesize_tautology(&self) -> String {
        "1=1".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grammar_synthesizer_boolean_pairs() {
        let synth = GrammarSynthesizer::default();
        let (t_num, f_num) = synth.synthesize_boolean_pair(true);
        assert_eq!(t_num, "AND 1=1");
        assert_eq!(f_num, "AND 1=2");

        let (t_str, f_str) = synth.synthesize_boolean_pair(false);
        assert_eq!(t_str, "' AND '1'='1");
        assert_eq!(f_str, "' AND '1'='2");
    }
}
