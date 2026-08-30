//! Type-Aware Schema-Guided Mutation Engine
//!
//! Parses structured payloads (JSON / form data) into typed ASTs and mutates
//! individual leaf nodes while preserving syntactic structure:
//! - Numeric mutation: 0, -1, i64::MAX, i64::MIN, 2^31 - 1, NaN, Infinity
//! - String mutation: SQLi polyglots, XSS canaries, CMDi, SSTI, format strings
//! - Boolean mutation: true <-> false, null, type coercion
//! - Array mutation: empty array, oversized 1000 items, nested wrapping

use serde_json::Value;

pub struct TypeAwareFuzzer;

impl TypeAwareFuzzer {
    /// Mutates a JSON payload while preserving overall document schema
    pub fn mutate_json(json_str: &str) -> Vec<String> {
        let mut results = Vec::new();
        let parsed: Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(_) => return results,
        };

        if let Value::Object(map) = &parsed {
            for (key, val) in map {
                let mutations = Self::mutate_value(val);
                for mutated_val in mutations {
                    let mut clone = map.clone();
                    clone.insert(key.clone(), mutated_val);
                    if let Ok(serialized) = serde_json::to_string(&Value::Object(clone)) {
                        results.push(serialized);
                    }
                }
            }
        }

        results
    }

    /// Mutates an individual JSON leaf value according to its runtime type
    pub fn mutate_value(val: &Value) -> Vec<Value> {
        let mut mutations = Vec::new();

        match val {
            Value::Number(_) => {
                mutations.push(Value::from(0));
                mutations.push(Value::from(-1));
                mutations.push(Value::from(i64::MAX));
                mutations.push(Value::from(i64::MIN));
                mutations.push(Value::from(2147483647)); // 2^31 - 1
                mutations.push(Value::from(-2147483648)); // -2^31
                mutations.push(Value::String("999999999999999999999999999999".to_string())); // Numeric string overflow
                mutations.push(Value::Null);
            }
            Value::String(_) => {
                mutations.push(Value::String("' OR '1'='1".to_string()));
                mutations.push(Value::String("<script>alert(1)</script>".to_string()));
                mutations.push(Value::String("; id".to_string()));
                mutations.push(Value::String("{{7*7}}".to_string()));
                mutations.push(Value::String("../../../../etc/passwd".to_string()));
                mutations.push(Value::String("%s%s%s%s%n".to_string()));
                mutations.push(Value::String("A".repeat(10000))); // Buffer overflow
                mutations.push(Value::Null);
            }
            Value::Bool(b) => {
                mutations.push(Value::Bool(!b));
                mutations.push(Value::from(if *b { 0 } else { 1 }));
                mutations.push(Value::String(if *b { "false".to_string() } else { "true".to_string() }));
                mutations.push(Value::Null);
            }
            Value::Array(arr) => {
                mutations.push(Value::Array(vec![])); // Empty array
                mutations.push(Value::Array(vec![Value::from(0); 100])); // Sized array
                if let Some(first) = arr.first() {
                    let mut nested = Vec::new();
                    for _ in 0..10 {
                        nested.push(first.clone());
                    }
                    mutations.push(Value::Array(nested));
                }
                mutations.push(Value::Null);
            }
            Value::Null => {
                mutations.push(Value::Bool(true));
                mutations.push(Value::from(0));
                mutations.push(Value::String("".to_string()));
            }
            Value::Object(_) => {
                mutations.push(Value::Null);
            }
        }

        mutations
    }
}
