//! Dynamic content masking engine.
//! Replaces volatile and non-deterministic response elements (timestamps, nonces, CSRF tokens, UUIDs, session IDs)
//! with normalized placeholder tokens to enable deterministic differential analysis.

use regex::Regex;
use serde::{Deserialize, Serialize};

/// Configuration options for dynamic content masking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaskingConfig {
    pub mask_timestamps: bool,
    pub mask_uuids: bool,
    pub mask_csrf_tokens: bool,
    pub mask_session_tokens: bool,
    pub mask_nonces: bool,
    pub custom_patterns: Vec<(String, String)>, // (Regex pattern, Replacement)
}

impl Default for MaskingConfig {
    fn default() -> Self {
        Self {
            mask_timestamps: true,
            mask_uuids: true,
            mask_csrf_tokens: true,
            mask_session_tokens: true,
            mask_nonces: true,
            custom_patterns: Vec::new(),
        }
    }
}

/// Dynamic content masking engine.
pub struct DynamicContentMasker {
    config: MaskingConfig,
    uuid_regex: Regex,
    iso_time_regex: Regex,
    epoch_millis_regex: Regex,
    epoch_seconds_regex: Regex,
    csrf_regex: Regex,
    jwt_regex: Regex,
    hex_nonce_regex: Regex,
}

impl DynamicContentMasker {
    /// Creates a new masker with standard configuration.
    pub fn new(config: MaskingConfig) -> Self {
        Self {
            config,
            uuid_regex: Regex::new(
                r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            )
            .unwrap(),
            iso_time_regex: Regex::new(
                r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?",
            )
            .unwrap(),
            epoch_millis_regex: Regex::new(r"\b1[6-9]\d{11}\b").unwrap(),
            epoch_seconds_regex: Regex::new(r"\b1[6-9]\d{8}\b").unwrap(),
            csrf_regex: Regex::new(
                r#"(?i)["']?(?:csrf[-_]?token|authenticity[-_]?token|_token|__RequestVerificationToken)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-+/=]{16,128})["']?"#,
            )
            .unwrap(),
            jwt_regex: Regex::new(
                r"eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+",
            )
            .unwrap(),
            hex_nonce_regex: Regex::new(
                r#"(?i)["']?(?:nonce|state|auth_nonce)["']?\s*[:=]\s*["']?([0-9a-fA-F]{16,64})["']?"#,
            )
            .unwrap(),
        }
    }

    /// Masks dynamic content in the provided response string.
    pub fn mask(&self, input: &str) -> String {
        let mut result = input.to_string();

        // 1. Mask UUIDs
        if self.config.mask_uuids {
            result = self.uuid_regex.replace_all(&result, "<UUID>").into_owned();
        }

        // 2. Mask Timestamps
        if self.config.mask_timestamps {
            result = self
                .iso_time_regex
                .replace_all(&result, "<TIMESTAMP>")
                .into_owned();
            result = self
                .epoch_millis_regex
                .replace_all(&result, "<TIMESTAMP_EPOCH_MS>")
                .into_owned();
            result = self
                .epoch_seconds_regex
                .replace_all(&result, "<TIMESTAMP_EPOCH_SEC>")
                .into_owned();
        }

        // 3. Mask CSRF tokens
        if self.config.mask_csrf_tokens {
            result = self
                .csrf_regex
                .replace_all(&result, "csrf_token=\"<CSRF_TOKEN>\"")
                .into_owned();
        }

        // 4. Mask JWTs and session tokens
        if self.config.mask_session_tokens {
            result = self.jwt_regex.replace_all(&result, "<JWT_TOKEN>").into_owned();
        }

        // 5. Mask Nonces
        if self.config.mask_nonces {
            result = self
                .hex_nonce_regex
                .replace_all(&result, "nonce=\"<NONCE>\"")
                .into_owned();
        }

        // 6. Custom patterns
        for (pattern, replacement) in &self.config.custom_patterns {
            if let Ok(re) = Regex::new(pattern) {
                result = re.replace_all(&result, replacement.as_str()).into_owned();
            }
        }

        result
    }

    /// Masks reflected input occurrences in response body.
    pub fn mask_reflection(input: &str, reflected_value: &str) -> String {
        if reflected_value.trim().len() < 3 {
            return input.to_string();
        }
        input.replace(reflected_value, "<REFLECTED>")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_masking_uuid_and_time() {
        let masker = DynamicContentMasker::new(MaskingConfig::default());
        let raw = "Response generated at 2026-08-30T15:20:00Z for req 550e8400-e29b-41d4-a716-446655440000";
        let masked = masker.mask(raw);
        assert_eq!(
            masked,
            "Response generated at <TIMESTAMP> for req <UUID>"
        );
    }

    #[test]
    fn test_masking_jwt_and_csrf() {
        let masker = DynamicContentMasker::new(MaskingConfig::default());
        let raw = r#"{"auth": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_p", "csrf_token": "a1b2c3d4e5f6g7h8i9j0k1l2"}"#;
        let masked = masker.mask(raw);
        assert!(masked.contains("<JWT_TOKEN>"));
        assert!(masked.contains("<CSRF_TOKEN>"));
    }

    #[test]
    fn test_mask_reflection() {
        let raw = "Hello admin' OR 1=1 --, welcome back!";
        let masked = DynamicContentMasker::mask_reflection(raw, "admin' OR 1=1 --");
        assert_eq!(masked, "Hello <REFLECTED>, welcome back!");
    }
}
