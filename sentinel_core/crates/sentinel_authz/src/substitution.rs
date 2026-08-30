//! AST-based IDOR / BOLA Parameter Discovery and Substitution Engine.
//!
//! Replaces target resource identifiers across URL path segments, query parameters,
//! JSON request bodies, and headers without breaking underlying encodings or AST structures.

use sentinel_common::errors::SentinelError;

pub struct AstIdorSubstitutor;

impl AstIdorSubstitutor {
    /// Replaces specific path identifier token in a URI.
    /// Example: `/api/v1/users/usr_100/orders/ord_5` with target `usr_100` -> `usr_999`
    pub fn extract_and_substitute_path(uri: &str, target_val: &str, replacement: &str) -> String {
        let parts: Vec<&str> = uri.split('?').collect();
        let path_part = parts[0];
        let query_part = if parts.len() > 1 { Some(parts[1]) } else { None };

        let segments: Vec<&str> = path_part.split('/').collect();
        let new_segments: Vec<String> = segments
            .into_iter()
            .map(|s| {
                if s == target_val {
                    replacement.to_string()
                } else {
                    s.to_string()
                }
            })
            .collect();

        let new_path = new_segments.join("/");
        if let Some(q) = query_part {
            format!("{}?{}", new_path, q)
        } else {
            new_path
        }
    }

    /// Replaces query parameter value matching `param_name` with `replacement`.
    pub fn extract_and_substitute_query(uri: &str, param_name: &str, replacement: &str) -> String {
        let parts: Vec<&str> = uri.split('?').collect();
        if parts.len() < 2 {
            return uri.to_string();
        }

        let path = parts[0];
        let query = parts[1];

        let pairs: Vec<&str> = query.split('&').collect();
        let mut new_pairs = Vec::new();
        let mut replaced = false;

        for pair in pairs {
            let kv: Vec<&str> = pair.splitn(2, '=').collect();
            if kv.is_empty() {
                continue;
            }
            if kv[0].eq_ignore_ascii_case(param_name) {
                new_pairs.push(format!("{}={}", kv[0], replacement));
                replaced = true;
            } else {
                new_pairs.push(pair.to_string());
            }
        }

        if !replaced {
            return uri.to_string();
        }

        format!("{}?{}", path, new_pairs.join("&"))
    }

    /// Navigates and updates JSON request body AST for any field matching `json_key`.
    pub fn extract_and_substitute_json(
        body: &str,
        json_key: &str,
        replacement: &serde_json::Value,
    ) -> Result<String, SentinelError> {
        let mut val: serde_json::Value = serde_json::from_str(body)
            .map_err(|e| SentinelError::parse_error(format!("Invalid JSON body for AST substitution: {}", e)))?;

        Self::substitute_json_recursive(&mut val, json_key, replacement);
        serde_json::to_string(&val).map_err(|e| SentinelError::serialization(e.to_string()))
    }

    /// Updates headers matching `header_name` with `replacement`.
    pub fn extract_and_substitute_headers(
        headers: &[(String, String)],
        header_name: &str,
        replacement: &str,
    ) -> Vec<(String, String)> {
        headers
            .iter()
            .map(|(k, v)| {
                if k.eq_ignore_ascii_case(header_name) {
                    (k.clone(), replacement.to_string())
                } else {
                    (k.clone(), v.clone())
                }
            })
            .collect()
    }

    fn substitute_json_recursive(
        val: &mut serde_json::Value,
        target_key: &str,
        replacement: &serde_json::Value,
    ) {
        match val {
            serde_json::Value::Object(map) => {
                for (k, v) in map.iter_mut() {
                    if k.eq_ignore_ascii_case(target_key) {
                        *v = replacement.clone();
                    } else {
                        Self::substitute_json_recursive(v, target_key, replacement);
                    }
                }
            }
            serde_json::Value::Array(arr) => {
                for item in arr.iter_mut() {
                    Self::substitute_json_recursive(item, target_key, replacement);
                }
            }
            _ => {}
        }
    }
}
