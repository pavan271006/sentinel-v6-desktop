//! Server-Side Template Injection (SSTI) Engine
//!
//! Evaluates template expression evaluation across template engines:
//! - Jinja2 / Twig / Nunjucks ({{7*7}} -> 49, {{7*'7'}} -> '7777777' vs '49')
//! - FreeMarker / Velocity (${7*7} -> 49)
//! - ERB / EJS (<%= 7*7 %> -> 49)
//! - Ruby / Spring EL (#{7*7} -> 49)
//! - Thymeleaf (*{7*7} -> 49)
//! - Multi-stage math verification to eliminate false positives ($49 \notin \text{baseline}$)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateEngine {
    Jinja2,
    Twig,
    FreeMarker,
    Velocity,
    ErbEjs,
    SpringEl,
    Thymeleaf,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SstiProbe {
    pub expression: &'static str,
    pub expected_arithmetic_result: &'static str,
    pub secondary_expression: &'static str,
    pub secondary_expected_result: &'static str,
    pub candidate_engine: TemplateEngine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SstiVerificationResult {
    pub is_vulnerable: bool,
    pub detected_engine: TemplateEngine,
    pub confidence: f32,
    pub expression_used: String,
    pub evaluated_result: String,
}

pub const SSTI_POLYGLOT_PROBES: &[SstiProbe] = &[
    SstiProbe {
        expression: "{{7*7}}",
        expected_arithmetic_result: "49",
        secondary_expression: "{{31245*3}}",
        secondary_expected_result: "93735",
        candidate_engine: TemplateEngine::Jinja2,
    },
    SstiProbe {
        expression: "${7*7}",
        expected_arithmetic_result: "49",
        secondary_expression: "${31245*3}",
        secondary_expected_result: "93735",
        candidate_engine: TemplateEngine::FreeMarker,
    },
    SstiProbe {
        expression: "<%= 7*7 %>",
        expected_arithmetic_result: "49",
        secondary_expression: "<%= 31245*3 %>",
        secondary_expected_result: "93735",
        candidate_engine: TemplateEngine::ErbEjs,
    },
    SstiProbe {
        expression: "#{7*7}",
        expected_arithmetic_result: "49",
        secondary_expression: "#{31245*3}",
        secondary_expected_result: "93735",
        candidate_engine: TemplateEngine::SpringEl,
    },
    SstiProbe {
        expression: "*{7*7}",
        expected_arithmetic_result: "49",
        secondary_expression: "*{31245*3}",
        secondary_expected_result: "93735",
        candidate_engine: TemplateEngine::Thymeleaf,
    },
];

pub struct SstiEngine;

impl SstiEngine {
    /// Returns the standard SSTI probe matrix
    pub fn get_probes() -> &'static [SstiProbe] {
        SSTI_POLYGLOT_PROBES
    }

    /// Evaluates two-stage arithmetic verification for SSTI
    pub fn evaluate_response(
        probe: &SstiProbe,
        baseline_body: &str,
        stage1_body: &str,
        stage2_body: &str,
    ) -> Option<SstiVerificationResult> {
        // Stage 1: result (49) must be in stage1_body and NOT in baseline_body
        let stage1_valid = !baseline_body.contains(probe.expected_arithmetic_result)
            && stage1_body.contains(probe.expected_arithmetic_result);

        // Stage 2: secondary result (93735) must be in stage2_body and NOT in baseline_body
        let stage2_valid = !baseline_body.contains(probe.secondary_expected_result)
            && stage2_body.contains(probe.secondary_expected_result);

        if stage1_valid && stage2_valid {
            return Some(SstiVerificationResult {
                is_vulnerable: true,
                detected_engine: probe.candidate_engine.clone(),
                confidence: 0.99,
                expression_used: probe.expression.to_string(),
                evaluated_result: probe.expected_arithmetic_result.to_string(),
            });
        }

        None
    }

    /// Disambiguates between Jinja2 (Python) and Twig (PHP) using {{7*'7'}}
    pub fn disambiguate_jinja_twig(probe_body: &str) -> TemplateEngine {
        if probe_body.contains("7777777") {
            TemplateEngine::Jinja2
        } else if probe_body.contains("49") {
            TemplateEngine::Twig
        } else {
            TemplateEngine::Unknown
        }
    }
}
