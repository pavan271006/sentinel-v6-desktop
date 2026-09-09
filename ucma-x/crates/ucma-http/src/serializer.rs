//! Wire serialization and payload injection engine for JSON, GraphQL, and HTTP Cookies.

use serde_json::Value;

pub struct WireSerializer;

impl WireSerializer {
    /// Injects a payload into a JSON object by path (e.g., "user.id" or "/user/id").
    pub fn inject_json(root: &mut Value, path: &str, payload: &str) -> bool {
        let normalized_path = if path.starts_with('/') {
            path.trim_start_matches('/').replace('/', ".")
        } else {
            path.to_string()
        };

        let parts: Vec<&str> = normalized_path.split('.').collect();
        if parts.is_empty() {
            return false;
        }

        Self::inject_json_recursive(root, &parts, payload)
    }

    fn inject_json_recursive(current: &mut Value, parts: &[&str], payload: &str) -> bool {
        if parts.is_empty() {
            return false;
        }

        let key = parts[0];
        if parts.len() == 1 {
            match current {
                Value::Object(map) => {
                    map.insert(key.to_string(), Value::String(payload.to_string()));
                    true
                }
                Value::Array(arr) => {
                    if let Ok(idx) = key.parse::<usize>() {
                        if idx < arr.len() {
                            arr[idx] = Value::String(payload.to_string());
                            return true;
                        }
                    }
                    false
                }
                _ => false,
            }
        } else {
            match current {
                Value::Object(map) => {
                    if let Some(next) = map.get_mut(key) {
                        Self::inject_json_recursive(next, &parts[1..], payload)
                    } else {
                        false
                    }
                }
                Value::Array(arr) => {
                    if let Ok(idx) = key.parse::<usize>() {
                        if let Some(next) = arr.get_mut(idx) {
                            Self::inject_json_recursive(next, &parts[1..], payload)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                }
                _ => false,
            }
        }
    }

    /// Injects payload into a GraphQL request payload.
    /// Handles both `variables: { target: "..." }` and inline query string replacement.
    pub fn inject_graphql(
        body_json: &str,
        param_name: &str,
        payload: &str,
    ) -> Result<String, String> {
        let mut parsed: Value = serde_json::from_str(body_json)
            .map_err(|e| format!("Failed to parse GraphQL request as JSON: {}", e))?;

        let mut injected = false;

        // 1. Try injecting into variables object
        if let Some(vars) = parsed.get_mut("variables") {
            if let Value::Object(map) = vars {
                if map.contains_key(param_name) {
                    map.insert(param_name.to_string(), Value::String(payload.to_string()));
                    injected = true;
                }
            }
        }

        // 2. If not in variables, check if query contains param pattern or rewrite query
        if !injected {
            if let Some(query) = parsed.get_mut("query") {
                if let Value::String(q_str) = query {
                    let target_pattern = format!("${}", param_name);
                    if q_str.contains(&target_pattern) {
                        // Ensure variables object exists
                        if parsed.get("variables").is_none() || !parsed["variables"].is_object() {
                            parsed["variables"] = serde_json::json!({});
                        }
                        if let Some(vars) = parsed.get_mut("variables") {
                            if let Value::Object(map) = vars {
                                map.insert(param_name.to_string(), Value::String(payload.to_string()));
                                injected = true;
                            }
                        }
                    }
                }
            }
        }

        if !injected {
            return Err(format!("Parameter '{}' not found in GraphQL payload", param_name));
        }

        serde_json::to_string(&parsed).map_err(|e| format!("Failed to serialize GraphQL JSON: {}", e))
    }

    /// Injects or replaces a cookie value inside an HTTP Cookie header string.
    pub fn inject_cookie(existing_header: Option<&str>, cookie_name: &str, payload: &str) -> String {
        let mut cookies = Vec::new();
        let mut found = false;

        if let Some(header) = existing_header {
            for item in header.split(';') {
                let trimmed = item.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Some((name, _)) = trimmed.split_once('=') {
                    if name.trim() == cookie_name {
                        cookies.push(format!("{}={}", cookie_name, payload));
                        found = true;
                    } else {
                        cookies.push(trimmed.to_string());
                    }
                } else {
                    cookies.push(trimmed.to_string());
                }
            }
        }

        if !found {
            cookies.push(format!("{}={}", cookie_name, payload));
        }

        cookies.join("; ")
    }

    /// Injects or replaces a parameter in a URL query string.
    pub fn inject_query_string(query_string: &str, param_name: &str, payload: &str) -> String {
        let mut params = Vec::new();
        let mut found = false;

        let query = query_string.trim_start_matches('?');
        if !query.is_empty() {
            for pair in query.split('&') {
                if pair.is_empty() {
                    continue;
                }
                if let Some((key, _)) = pair.split_once('=') {
                    if key == param_name {
                        params.push(format!("{}={}", param_name, urlencoding::encode(payload)));
                        found = true;
                    } else {
                        params.push(pair.to_string());
                    }
                } else if pair == param_name {
                    params.push(format!("{}={}", param_name, urlencoding::encode(payload)));
                    found = true;
                } else {
                    params.push(pair.to_string());
                }
            }
        }

        if !found {
            params.push(format!("{}={}", param_name, urlencoding::encode(payload)));
        }

        params.join("&")
    }
}

// Simple urlencoding fallback module if crate not imported
mod urlencoding {
    pub fn encode(data: &str) -> String {
        let mut result = String::with_capacity(data.len() * 3);
        for byte in data.bytes() {
            match byte {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_json_path() {
        let mut json = serde_json::json!({
            "user": {
                "id": 123,
                "profile": {
                    "name": "alice"
                }
            }
        });

        let success = WireSerializer::inject_json(&mut json, "user.profile.name", "' OR 1=1--");
        assert!(success);
        assert_eq!(json["user"]["profile"]["name"], "' OR 1=1--");
    }

    #[test]
    fn test_inject_graphql() {
        let gql = r#"{"query":"query GetUser($id: ID!) { user(id: $id) { name } }","variables":{"id":"10"}}"#;
        let injected = WireSerializer::inject_graphql(gql, "id", "10' OR '1'='1").unwrap();
        let parsed: Value = serde_json::from_str(&injected).unwrap();
        assert_eq!(parsed["variables"]["id"], "10' OR '1'='1");
    }

    #[test]
    fn test_inject_cookie() {
        let cookie_hdr = "session_id=xyz123; TrackingId=orig_token";
        let modified = WireSerializer::inject_cookie(Some(cookie_hdr), "TrackingId", "injected_token'");
        assert_eq!(modified, "session_id=xyz123; TrackingId=injected_token'");

        // Cookie not present
        let added = WireSerializer::inject_cookie(Some("theme=dark"), "TrackingId", "test");
        assert_eq!(added, "theme=dark; TrackingId=test");
    }

    #[test]
    fn test_inject_query_string() {
        let qs = "cat=books&page=1";
        let modified = WireSerializer::inject_query_string(qs, "cat", "gifts'--");
        assert_eq!(modified, "cat=gifts%27--&page=1");
    }
}
