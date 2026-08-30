//! Structural tokenization engine for HTML DOM, JSON schemas, and text structures.

use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};

/// Structural skeleton and token profile of an HTTP response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StructuralProfile {
    pub skeleton_signature: String,
    pub tag_tokens: Vec<String>,
    pub tag_frequency: BTreeMap<String, usize>,
    pub max_depth: usize,
    pub token_set: HashSet<String>,
}

/// Tokenizer for HTML DOM structure.
pub struct HtmlStructuralTokenizer;

impl HtmlStructuralTokenizer {
    /// Tokenizes an HTML string into a structural DOM skeleton and tag frequency profile.
    pub fn tokenize(html: &str) -> StructuralProfile {
        let mut reader = Reader::from_str(html);
        reader.config_mut().trim_text(true);

        let mut path_stack: Vec<String> = Vec::new();
        let mut skeletons: Vec<String> = Vec::new();
        let mut tag_tokens: Vec<String> = Vec::new();
        let mut tag_frequency: BTreeMap<String, usize> = BTreeMap::new();
        let mut token_set: HashSet<String> = HashSet::new();
        let mut max_depth = 0;

        let mut buf = Vec::new();

        while let Ok(event) = reader.read_event_into(&mut buf) {
            match event {
                Event::Start(e) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    path_stack.push(tag.clone());
                    max_depth = max_depth.max(path_stack.len());

                    let current_path = path_stack.join("/");
                    skeletons.push(current_path.clone());
                    tag_tokens.push(format!("<{}>", tag));
                    token_set.insert(current_path);

                    *tag_frequency.entry(tag).or_insert(0) += 1;
                }
                Event::Empty(e) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    path_stack.push(tag.clone());
                    max_depth = max_depth.max(path_stack.len());

                    let current_path = path_stack.join("/");
                    skeletons.push(current_path.clone());
                    tag_tokens.push(format!("<{}/>", tag));
                    token_set.insert(current_path);

                    *tag_frequency.entry(tag).or_insert(0) += 1;
                    path_stack.pop();
                }
                Event::End(_) => {
                    path_stack.pop();
                }
                Event::Eof => break,
                _ => {}
            }
            buf.clear();
        }

        let skeleton_signature = if skeletons.is_empty() {
            // Fallback for non-xml/html text: tag-like tokens
            Self::fallback_tokenize(html, &mut token_set, &mut tag_tokens, &mut tag_frequency)
        } else {
            skeletons.join(";")
        };

        StructuralProfile {
            skeleton_signature,
            tag_tokens,
            tag_frequency,
            max_depth,
            token_set,
        }
    }

    fn fallback_tokenize(
        text: &str,
        token_set: &mut HashSet<String>,
        tag_tokens: &mut Vec<String>,
        tag_frequency: &mut BTreeMap<String, usize>,
    ) -> String {
        for word in text.split_whitespace() {
            let clean = word
                .trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase();
            if !clean.is_empty() {
                tag_tokens.push(clean.clone());
                token_set.insert(clean.clone());
                *tag_frequency.entry(clean).or_insert(0) += 1;
            }
        }
        tag_tokens.join(" ")
    }
}

/// Tokenizer for JSON key and type structure.
pub struct JsonStructuralTokenizer;

impl JsonStructuralTokenizer {
    /// Tokenizes a JSON string into a structural key skeleton ignoring leaf scalar values.
    pub fn tokenize(json_str: &str) -> Option<StructuralProfile> {
        let val = serde_json::from_str::<Value>(json_str).ok()?;
        let mut key_paths = Vec::new();
        let mut tag_frequency = BTreeMap::new();
        let mut token_set = HashSet::new();
        let mut max_depth = 0;

        Self::traverse_json(&val, "$", 1, &mut key_paths, &mut tag_frequency, &mut token_set, &mut max_depth);

        let skeleton_signature = key_paths.join(";");
        Some(StructuralProfile {
            skeleton_signature,
            tag_tokens: key_paths,
            tag_frequency,
            max_depth,
            token_set,
        })
    }

    fn traverse_json(
        val: &Value,
        path: &str,
        depth: usize,
        paths: &mut Vec<String>,
        freq: &mut BTreeMap<String, usize>,
        tokens: &mut HashSet<String>,
        max_depth: &mut usize,
    ) {
        *max_depth = (*max_depth).max(depth);
        match val {
            Value::Object(map) => {
                for (k, v) in map {
                    let child_path = if path == "$" {
                        format!("$.{}", k)
                    } else {
                        format!("{}.{}", path, k)
                    };
                    paths.push(child_path.clone());
                    tokens.insert(child_path.clone());
                    *freq.entry(k.clone()).or_insert(0) += 1;
                    Self::traverse_json(v, &child_path, depth + 1, paths, freq, tokens, max_depth);
                }
            }
            Value::Array(arr) => {
                let child_path = format!("{}[]", path);
                paths.push(child_path.clone());
                tokens.insert(child_path.clone());
                *freq.entry("[]".to_string()).or_insert(0) += 1;
                for v in arr {
                    Self::traverse_json(v, &child_path, depth + 1, paths, freq, tokens, max_depth);
                }
            }
            Value::String(_) => {
                paths.push(format!("{}:str", path));
                tokens.insert(format!("{}:str", path));
            }
            Value::Number(_) => {
                paths.push(format!("{}:num", path));
                tokens.insert(format!("{}:num", path));
            }
            Value::Bool(_) => {
                paths.push(format!("{}:bool", path));
                tokens.insert(format!("{}:bool", path));
            }
            Value::Null => {
                paths.push(format!("{}:null", path));
                tokens.insert(format!("{}:null", path));
            }
        }
    }
}

/// General word and delimiter text tokenizer.
pub struct TextTokenizer;

impl TextTokenizer {
    /// Extracts a set of unique word/symbol tokens from plain text.
    pub fn tokenize_words(text: &str) -> HashSet<String> {
        let mut tokens = HashSet::new();
        for word in text.split_whitespace() {
            let clean = word
                .trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase();
            if !clean.is_empty() {
                tokens.insert(clean);
            }
        }
        tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_html_structural_tokenization() {
        let html = "<html><head><title>App</title></head><body><div><table><tr><td>1</td></tr></table></div></body></html>";
        let profile = HtmlStructuralTokenizer::tokenize(html);
        assert!(profile.skeleton_signature.contains("html/body/div/table/tr/td"));
        assert_eq!(profile.max_depth, 6);
        assert_eq!(profile.tag_frequency.get("td"), Some(&1));
        assert_eq!(profile.tag_frequency.get("table"), Some(&1));
    }

    #[test]
    fn test_json_structural_tokenization() {
        let json = r#"{"status": "ok", "users": [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]}"#;
        let profile = JsonStructuralTokenizer::tokenize(json).unwrap();
        assert!(profile.token_set.contains("$.status:str"));
        assert!(profile.token_set.contains("$.users[]"));
        assert!(profile.token_set.contains("$.users[].id:num"));
        assert!(profile.token_set.contains("$.users[].name:str"));
    }
}
