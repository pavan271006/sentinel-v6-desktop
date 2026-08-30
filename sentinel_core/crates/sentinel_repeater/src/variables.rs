//! Dynamic Variable Extraction & Templating Engine

use std::collections::HashMap;

use chrono::Utc;
use regex::Regex;
use uuid::Uuid;

#[derive(Debug, Clone, Default)]
pub struct VariableEnvironment {
    variables: HashMap<String, String>,
}

impl VariableEnvironment {
    pub fn new() -> Self {
        Self {
            variables: HashMap::new(),
        }
    }

    pub fn set(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.variables.insert(key.into(), value.into());
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.variables.get(key)
    }

    pub fn interpolate(&self, raw: &[u8]) -> Vec<u8> {
        let text = String::from_utf8_lossy(raw);
        let re = Regex::new(r"\{\{([a-zA-Z0-9_\$]+)\}\}").unwrap();

        let result = re.replace_all(&text, |caps: &regex::Captures| {
            let var_name = &caps[1];

            // Built-in dynamic variables
            if var_name == "$uuid" {
                return Uuid::new_v4().to_string();
            } else if var_name == "$timestamp" {
                return Utc::now().timestamp().to_string();
            } else if var_name == "$random_int" {
                return (Utc::now().timestamp_subsec_millis() % 9000 + 1000).to_string();
            }

            if let Some(val) = self.variables.get(var_name) {
                val.clone()
            } else {
                caps[0].to_string() // keep placeholder if undefined
            }
        });

        result.into_owned().into_bytes()
    }

    pub fn extract_from_json(&mut self, key: &str, json_bytes: &[u8], path: &str) -> bool {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(json_bytes) {
            let mut curr = &val;
            let parts: Vec<&str> = path.split('.').collect();
            let mut found = true;

            for part in parts {
                if let Some(next) = curr.get(part) {
                    curr = next;
                } else {
                    found = false;
                    break;
                }
            }

            if found {
                let extracted = match curr {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
                self.set(key, extracted);
                return true;
            }
        }
        false
    }

    pub fn extract_from_headers(
        &mut self,
        key: &str,
        headers: &[(Vec<u8>, Vec<u8>)],
        header_name: &str,
    ) -> bool {
        if let Some((_, val)) = headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(header_name.as_bytes()))
        {
            self.set(key, String::from_utf8_lossy(val));
            return true;
        }
        false
    }
}
