//! Shannon Entropy Volatile Token Masking Engine.
//!
//! Masks high-entropy dynamic response fields (CSRF tokens, session IDs, hashes, UUIDs, timestamps)
//! with deterministic placeholder `{{VOLATILE_TOKEN}}` to prevent false positive/negative divergence.

use regex::Regex;
use std::collections::HashMap;

pub struct ShannonEntropyMasker;

impl ShannonEntropyMasker {
    /// Computes Shannon entropy H(X) for a given string.
    /// Returns bits per character (0.0 to 8.0).
    pub fn calculate_entropy(s: &str) -> f64 {
        if s.is_empty() {
            return 0.0;
        }

        let mut frequencies = HashMap::new();
        for ch in s.chars() {
            *frequencies.entry(ch).or_insert(0usize) += 1;
        }

        let len = s.chars().count() as f64;
        let mut entropy = 0.0;

        for &count in frequencies.values() {
            let p = (count as f64) / len;
            entropy -= p * p.log2();
        }

        entropy
    }

    /// Masks volatile fields in a JSON string where H(X) >= threshold, or matches UUID / timestamp.
    /// Returns (masked_json_string, number_of_tokens_masked).
    pub fn mask_volatile_json(json_str: &str, entropy_threshold: f64) -> (String, usize) {
        if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(json_str) {
            let mut masked_count = 0;
            Self::mask_json_node(&mut val, entropy_threshold, &mut masked_count);
            let formatted = serde_json::to_string(&val).unwrap_or_else(|_| json_str.to_string());
            (formatted, masked_count)
        } else {
            Self::mask_volatile_text(json_str, entropy_threshold)
        }
    }

    /// Masks volatile tokens in plain text / raw response bodies.
    pub fn mask_volatile_text(text: &str, entropy_threshold: f64) -> (String, usize) {
        let uuid_re = Regex::new(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}").unwrap();
        let ts_re = Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?").unwrap();

        let mut masked = text.to_string();
        let mut count = 0;

        // Mask UUIDs
        for mat in uuid_re.find_iter(text) {
            masked = masked.replace(mat.as_str(), "{{VOLATILE_TOKEN}}");
            count += 1;
        }

        // Mask Timestamps
        for mat in ts_re.find_iter(text) {
            masked = masked.replace(mat.as_str(), "{{VOLATILE_TOKEN}}");
            count += 1;
        }

        // Words with high entropy
        let words: Vec<&str> = text.split(|c: char| c.is_whitespace() || c == '"' || c == '\'').collect();
        for word in words {
            if word.len() >= 16 && Self::calculate_entropy(word) >= entropy_threshold {
                masked = masked.replace(word, "{{VOLATILE_TOKEN}}");
                count += 1;
            }
        }

        (masked, count)
    }

    fn mask_json_node(val: &mut serde_json::Value, threshold: f64, count: &mut usize) {
        match val {
            serde_json::Value::String(s) => {
                if is_volatile_string(s, threshold) {
                    *s = "{{VOLATILE_TOKEN}}".to_string();
                    *count += 1;
                }
            }
            serde_json::Value::Object(map) => {
                for (key, v) in map.iter_mut() {
                    let key_lower = key.to_lowercase();
                    if key_lower.contains("csrf")
                        || key_lower.contains("nonce")
                        || key_lower.contains("timestamp")
                        || key_lower.contains("token")
                        || key_lower.contains("created")
                        || key_lower.contains("updated")
                        || key_lower == "iat"
                        || key_lower == "exp"
                        || key_lower == "nbf"
                        || key_lower == "trace_id"
                        || key_lower == "request_id"
                    {
                        *v = serde_json::Value::String("{{VOLATILE_TOKEN}}".to_string());
                        *count += 1;
                    } else {
                        Self::mask_json_node(v, threshold, count);
                    }
                }
            }
            serde_json::Value::Array(arr) => {
                for item in arr.iter_mut() {
                    Self::mask_json_node(item, threshold, count);
                }
            }
            _ => {}
        }
    }
}

fn is_volatile_string(s: &str, threshold: f64) -> bool {
    if s.is_empty() || s == "{{VOLATILE_TOKEN}}" {
        return false;
    }

    // 1. UUID check (36 chars with hyphens)
    if s.len() == 36 && s.chars().filter(|c| *c == '-').count() == 4 {
        return true;
    }

    // 2. ISO-8601 Timestamp check (e.g. 2026-08-23T10:00:00Z)
    if s.len() >= 19 && s.contains('T') && (s.ends_with('Z') || s.contains(':')) {
        return true;
    }

    // 3. High entropy token (length >= 16 and entropy >= threshold)
    if s.len() >= 16 && ShannonEntropyMasker::calculate_entropy(s) >= threshold {
        return true;
    }

    // 4. Hex hash (MD5 32 chars, SHA256 64 chars)
    if (s.len() == 32 || s.len() == 64) && s.chars().all(|c| c.is_ascii_hexdigit()) {
        return true;
    }

    false
}
