//! Parameter mutation and injection reconstitution engine.
//! Injects transformed payloads back into their original protocol structures.

use crate::encoding::CodecEngine;
use crate::extractor::ExtractedParameter;
use serde_json::Value;
use std::collections::HashMap;
use ucma_core::parameter::ParameterLocation;
use ucma_core::request::RawRequest;
use url::Url;

/// Reconstitution and mutation engine.
pub struct ParameterMutator;

impl ParameterMutator {
    /// Injects a new payload value into a target parameter within a RawRequest.
    /// Automatically applies the parameter's encoding chain.
    pub fn mutate_request(
        req: &RawRequest,
        target_param: &ExtractedParameter,
        new_payload: &str,
    ) -> RawRequest {
        let mut new_req = req.clone();
        let encoded_value = CodecEngine::encode_chain(new_payload, &target_param.encoding_chain);

        match target_param.location {
            ParameterLocation::Query => {
                if let Ok(mutated_url_str) = Self::mutate_query_url(&req.url, &target_param.name, &encoded_value)
                    && let Ok(parsed) = Url::parse(&mutated_url_str) {
                        new_req.url = parsed;
                    }
            }
            ParameterLocation::BodyForm => {
                if !req.body.is_empty()
                    && let Ok(body_str) = std::str::from_utf8(&req.body) {
                        let mutated = Self::mutate_form(body_str, &target_param.name, &encoded_value);
                        new_req.body = mutated.into_bytes();
                    }
            }
            ParameterLocation::BodyJson => {
                if !req.body.is_empty()
                    && let Ok(body_str) = std::str::from_utf8(&req.body)
                        && let Ok(mutated) = Self::mutate_json(body_str, &target_param.name, &encoded_value) {
                            new_req.body = mutated.into_bytes();
                        }
            }
            ParameterLocation::BodyXml => {
                if !req.body.is_empty()
                    && let Ok(body_str) = std::str::from_utf8(&req.body)
                        && let Ok(mutated) = Self::mutate_xml(body_str, &target_param.name, &encoded_value) {
                            new_req.body = mutated.into_bytes();
                        }
            }
            ParameterLocation::Multipart => {
                if !req.body.is_empty() {
                    let content_type = req
                        .headers
                        .iter()
                        .find(|(k, _)| k.eq_ignore_ascii_case("content-type"))
                        .map(|(_, v)| v.as_str())
                        .unwrap_or("");
                    let boundary = content_type
                        .split("boundary=")
                        .nth(1)
                        .unwrap_or("")
                        .trim_matches('"');
                    let mutated = Self::mutate_multipart(&req.body, boundary, &target_param.name, &encoded_value);
                    new_req.body = mutated;
                }
            }
            ParameterLocation::Header => {
                new_req.headers = Self::mutate_headers_map(&req.headers, &target_param.name, &encoded_value);
            }
            ParameterLocation::Cookie => {
                new_req.headers = Self::mutate_cookie_in_headers_map(&req.headers, &target_param.name, &encoded_value);
            }
            _ => {}
        }

        new_req
    }

    /// Mutates a query parameter in a Url.
    pub fn mutate_query_url(url: &Url, param_name: &str, new_encoded_val: &str) -> Result<String, String> {
        let mut parsed_url = url.clone();
        let mut pairs: Vec<(String, String)> = parsed_url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        let mut matched = false;
        for (k, v) in pairs.iter_mut() {
            if k == param_name {
                *v = new_encoded_val.to_string();
                matched = true;
                break;
            }
        }
        if !matched {
            pairs.push((param_name.to_string(), new_encoded_val.to_string()));
        }

        parsed_url.query_pairs_mut().clear().extend_pairs(pairs.iter());
        Ok(parsed_url.to_string())
    }

    /// Mutates a query parameter in a URL string.
    pub fn mutate_query(url_str: &str, param_name: &str, new_encoded_val: &str) -> String {
        if let Ok(parsed) = Url::parse(url_str) {
            Self::mutate_query_url(&parsed, param_name, new_encoded_val).unwrap_or_else(|_| url_str.to_string())
        } else {
            url_str.to_string()
        }
    }

    /// Mutates a parameter in a form-urlencoded body.
    pub fn mutate_form(form_body: &str, param_name: &str, new_encoded_val: &str) -> String {
        let mut parts: Vec<String> = Vec::new();
        let mut matched = false;

        for pair in form_body.split('&') {
            if pair.is_empty() {
                continue;
            }
            let mut kv = pair.splitn(2, '=');
            let key = kv.next().unwrap_or("");
            let _val = kv.next().unwrap_or("");

            let decoded_key = urlencoding::decode(key).unwrap_or(std::borrow::Cow::Borrowed(key));
            if decoded_key == param_name {
                parts.push(format!("{}={}", key, urlencoding::encode(new_encoded_val)));
                matched = true;
            } else {
                parts.push(pair.to_string());
            }
        }

        if !matched {
            parts.push(format!(
                "{}={}",
                urlencoding::encode(param_name),
                urlencoding::encode(new_encoded_val)
            ));
        }

        parts.join("&")
    }

    /// Mutates a value in a JSON string given a JSON path (e.g. `$.user.id` or `$.items[0]`).
    pub fn mutate_json(json_str: &str, json_path: &str, new_val: &str) -> Result<String, String> {
        let mut root: Value = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
        let path_clean = json_path.strip_prefix("$.").unwrap_or(json_path.strip_prefix('$').unwrap_or(json_path));

        Self::set_json_path(&mut root, path_clean, new_val)?;
        serde_json::to_string(&root).map_err(|e| e.to_string())
    }

    fn set_json_path(curr: &mut Value, path: &str, new_val: &str) -> Result<(), String> {
        if path.is_empty() {
            *curr = if let Ok(parsed) = serde_json::from_str::<Value>(new_val) {
                parsed
            } else {
                Value::String(new_val.to_string())
            };
            return Ok(());
        }

        if path.starts_with('[')
            && let Some(end_bracket) = path.find(']') {
                let idx_str = &path[1..end_bracket];
                let idx: usize = idx_str.parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
                let remaining = path[end_bracket + 1..].strip_prefix('.').unwrap_or(&path[end_bracket + 1..]);
                if let Value::Array(arr) = curr
                    && idx < arr.len() {
                        return Self::set_json_path(&mut arr[idx], remaining, new_val);
                    }
                return Err(format!("Array index {} out of bounds", idx));
            }

        let mut end_pos = path.len();
        if let Some(dot_pos) = path.find('.') {
            end_pos = end_pos.min(dot_pos);
        }
        if let Some(bracket_pos) = path.find('[') {
            end_pos = end_pos.min(bracket_pos);
        }

        let key = &path[..end_pos];
        let remaining = if end_pos < path.len() && &path[end_pos..=end_pos] == "." {
            &path[end_pos + 1..]
        } else {
            &path[end_pos..]
        };

        if let Value::Object(map) = curr
            && let Some(child) = map.get_mut(key) {
                return Self::set_json_path(child, remaining, new_val);
            }

        Err(format!("Key '{}' not found in JSON path", key))
    }

    /// Mutates an XML element or attribute text.
    pub fn mutate_xml(xml_str: &str, xml_path: &str, new_val: &str) -> Result<String, String> {
        if xml_path.ends_with(']') && xml_path.contains("[@") {
            let parts: Vec<&str> = xml_path.split("[@").collect();
            let attr_name = parts[1].trim_end_matches(']');
            let pattern = format!(r#"({}=\")[^\"]*(\")"#, regex::escape(attr_name));
            let re = regex::Regex::new(&pattern).map_err(|e| e.to_string())?;
            let escaped_val = html_escape::encode_double_quoted_attribute(new_val);
            let replaced = re.replace(xml_str, format!("{}=\"{}\"", attr_name, escaped_val));
            return Ok(replaced.into_owned());
        }

        let tag_name = xml_path.split('/').next_back().unwrap_or(xml_path);
        let pattern = format!(r#"(<{tag}[^>]*>)[^<]*(</{tag}>)"#, tag = regex::escape(tag_name));
        let re = regex::Regex::new(&pattern).map_err(|e| e.to_string())?;
        let escaped_val = html_escape::encode_text(new_val);
        let replaced = re.replace(xml_str, format!("${{1}}{}${{2}}", escaped_val));
        Ok(replaced.into_owned())
    }

    /// Mutates a multipart part body by name.
    pub fn mutate_multipart(body: &[u8], boundary: &str, part_name: &str, new_val: &str) -> Vec<u8> {
        let body_str = String::from_utf8_lossy(body);
        let delimiter = format!("--{}", boundary);
        let mut new_parts = Vec::new();
        let name_re = regex::Regex::new(r#"name="([^"]+)""#).unwrap();

        for part in body_str.split(&delimiter) {
            let part_trimmed = part.trim();
            if part_trimmed.is_empty() || part_trimmed == "--" {
                continue;
            }

            let mut sections = part_trimmed.splitn(2, "\r\n\r\n");
            let headers_part = sections.next().unwrap_or("");
            let content_part = sections.next().unwrap_or("").trim_end_matches("\r\n");

            let matched = if let Some(caps) = name_re.captures(headers_part) {
                caps.get(1).map(|m| m.as_str() == part_name).unwrap_or(false)
            } else {
                false
            };

            if matched {
                new_parts.push(format!("{}\r\n\r\n{}", headers_part, new_val));
            } else {
                new_parts.push(format!("{}\r\n\r\n{}", headers_part, content_part));
            }
        }

        let mut output = String::new();
        for p in new_parts {
            output.push_str(&format!("{}\r\n{}\r\n", delimiter, p));
        }
        output.push_str(&format!("{}--\r\n", delimiter));
        output.into_bytes()
    }

    /// Mutates headers map with new value for header_name.
    pub fn mutate_headers_map(
        headers: &HashMap<String, String>,
        header_name: &str,
        new_val: &str,
    ) -> HashMap<String, String> {
        let mut modified = headers.clone();
        let mut key_to_update = header_name.to_string();
        for k in headers.keys() {
            if k.eq_ignore_ascii_case(header_name) {
                key_to_update = k.clone();
                break;
            }
        }
        modified.insert(key_to_update, new_val.to_string());
        modified
    }

    /// Mutates a specific cookie within the Cookie header in a HashMap.
    pub fn mutate_cookie_in_headers_map(
        headers: &HashMap<String, String>,
        cookie_name: &str,
        new_val: &str,
    ) -> HashMap<String, String> {
        let mut modified = headers.clone();
        let mut found_key = None;

        for (k, v) in headers {
            if k.eq_ignore_ascii_case("cookie") {
                found_key = Some((k.clone(), Self::mutate_cookie_str(v, cookie_name, new_val)));
                break;
            }
        }

        if let Some((k, new_cookie_header)) = found_key {
            modified.insert(k, new_cookie_header);
        } else {
            modified.insert("Cookie".to_string(), format!("{}={}", cookie_name, new_val));
        }

        modified
    }

    fn mutate_cookie_str(cookie_header: &str, cookie_name: &str, new_val: &str) -> String {
        let mut items = Vec::new();
        let mut found = false;
        for item in cookie_header.split(';') {
            let trimmed = item.trim();
            if trimmed.is_empty() {
                continue;
            }
            let mut kv = trimmed.splitn(2, '=');
            let name = kv.next().unwrap_or("").trim();
            let val = kv.next().unwrap_or("").trim();

            if name == cookie_name {
                items.push(format!("{}={}", name, new_val));
                found = true;
            } else {
                items.push(format!("{}={}", name, val));
            }
        }
        if !found {
            items.push(format!("{}={}", cookie_name, new_val));
        }
        items.join("; ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mutate_query() {
        let url = "https://example.com/api?id=1&name=test";
        let mutated = ParameterMutator::mutate_query(url, "id", "2 OR 1=1");
        assert!(mutated.contains("id=2+OR+1%3D1") || mutated.contains("id=2%20OR%201=1"));
    }

    #[test]
    fn test_mutate_json() {
        let json = r#"{"user":{"id":1,"name":"Alice"}}"#;
        let mutated = ParameterMutator::mutate_json(json, "$.user.name", "admin'--").unwrap();
        assert!(mutated.contains(r#""name":"admin'--""#));
    }

    #[test]
    fn test_mutate_xml() {
        let xml = r#"<root><user id="10">Alice</user></root>"#;
        let mutated_attr = ParameterMutator::mutate_xml(xml, "root/user[@id]", "99' OR '1'='1").unwrap();
        assert!(mutated_attr.contains(r#"id="99' OR '1'='1""#));

        let mutated_text = ParameterMutator::mutate_xml(xml, "root/user", "Bob'--").unwrap();
        assert!(mutated_text.contains("<user id=\"10\">Bob'--</user>"));
    }

    #[test]
    fn test_mutate_cookie() {
        let cookies = "session=123; user=alice";
        let mutated = ParameterMutator::mutate_cookie_str(cookies, "user", "admin'--");
        assert_eq!(mutated, "session=123; user=admin'--");
    }
}
