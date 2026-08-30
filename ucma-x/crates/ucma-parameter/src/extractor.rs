//! Multi-format parameter extraction engine.
//! Extracts testable parameters from Query strings, Form bodies, JSON, XML, Multipart, Headers, and Cookies.

use crate::context::{ContextInferenceEngine, InjectionContext};
use crate::encoding::{CodecEngine, EncodingType};
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use ucma_core::ids::{EndpointId, ParameterId};
use ucma_core::parameter::{ParameterLocation, ParameterType};
use ucma_core::request::RawRequest;

/// An extracted parameter representation with type and injection context inference.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExtractedParameter {
    pub id: ParameterId,
    pub name: String,
    pub location: ParameterLocation,
    pub raw_value: String,
    pub inferred_type: ParameterType,
    pub inferred_context: InjectionContext,
    pub encoding_chain: Vec<EncodingType>,
}

impl ExtractedParameter {
    pub fn new(
        endpoint_id: &EndpointId,
        name: impl Into<String>,
        location: ParameterLocation,
        raw_value: impl Into<String>,
    ) -> Self {
        let name_str = name.into();
        let val_str = raw_value.into();
        let id = ParameterId::derive(endpoint_id, location.as_str(), &name_str);

        let inferred_type = infer_primitive_type(&val_str);
        let context_report = ContextInferenceEngine::infer(&name_str, &val_str);
        let encoding_chain = CodecEngine::detect_encoding_chain(&val_str);

        Self {
            id,
            name: name_str,
            location,
            raw_value: val_str,
            inferred_type,
            inferred_context: context_report.primary_context,
            encoding_chain,
        }
    }
}

fn infer_primitive_type(val: &str) -> ParameterType {
    let trimmed = val.trim();
    if trimmed.is_empty() {
        return ParameterType::String;
    }
    if trimmed.parse::<i64>().is_ok() {
        return ParameterType::Integer;
    }
    if trimmed.parse::<f64>().is_ok() {
        return ParameterType::Float;
    }
    if trimmed.eq_ignore_ascii_case("true") || trimmed.eq_ignore_ascii_case("false") {
        return ParameterType::Boolean;
    }
    if ((trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']')))
        && serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return ParameterType::Json;
        }
    if uuid::Uuid::parse_str(trimmed).is_ok() {
        return ParameterType::Uuid;
    }
    ParameterType::String
}

/// Parameter extraction engine.
pub struct ParameterExtractor;

impl ParameterExtractor {
    /// Extracts all parameters from an HTTP RawRequest across all supported locations.
    pub fn extract_all(endpoint_id: &EndpointId, req: &RawRequest) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();

        // 1. Query parameters
        if let Some(query) = req.url.query() {
            params.extend(Self::extract_from_query(endpoint_id, query));
        }

        // 2. Headers & Cookies
        for (k, v) in &req.headers {
            if k.eq_ignore_ascii_case("cookie") {
                params.extend(Self::extract_from_cookies(endpoint_id, v));
            } else if !Self::is_transport_header(k) {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    k.clone(),
                    ParameterLocation::Header,
                    v.clone(),
                ));
            }
        }

        // 3. Body parameters
        if !req.body.is_empty()
            && let Ok(body_str) = std::str::from_utf8(&req.body) {
                let content_type = req
                    .headers
                    .iter()
                    .find(|(k, _)| k.eq_ignore_ascii_case("content-type"))
                    .map(|(_, v)| v.as_str())
                    .unwrap_or("");

                if content_type.contains("application/x-www-form-urlencoded") {
                    params.extend(Self::extract_from_form(endpoint_id, body_str));
                } else if content_type.contains("application/json") || body_str.trim().starts_with('{') || body_str.trim().starts_with('[') {
                    params.extend(Self::extract_from_json(endpoint_id, body_str));
                } else if content_type.contains("xml") || body_str.trim().starts_with('<') {
                    params.extend(Self::extract_from_xml(endpoint_id, body_str));
                } else if content_type.contains("multipart/form-data") {
                    let boundary = content_type
                        .split("boundary=")
                        .nth(1)
                        .unwrap_or("")
                        .trim_matches('"');
                    params.extend(Self::extract_from_multipart(endpoint_id, &req.body, boundary));
                }
            }

        params
    }

    /// Extracts parameters from a URL query string (e.g. `id=10&sort=asc&filter[name]=admin`).
    pub fn extract_from_query(endpoint_id: &EndpointId, query: &str) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        for pair in query.split('&') {
            if pair.is_empty() {
                continue;
            }
            let mut parts = pair.splitn(2, '=');
            let key = parts.next().unwrap_or("");
            let val = parts.next().unwrap_or("");
            let key_space = key.replace('+', " ");
            let val_space = val.replace('+', " ");
            let decoded_key = urlencoding::decode(&key_space).unwrap_or(std::borrow::Cow::Borrowed(&key_space));
            let decoded_val = urlencoding::decode(&val_space).unwrap_or(std::borrow::Cow::Borrowed(&val_space));

            params.push(ExtractedParameter::new(
                endpoint_id,
                decoded_key.into_owned(),
                ParameterLocation::Query,
                decoded_val.into_owned(),
            ));
        }
        params
    }

    /// Extracts parameters from application/x-www-form-urlencoded body.
    pub fn extract_from_form(endpoint_id: &EndpointId, form_body: &str) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        for pair in form_body.split('&') {
            if pair.is_empty() {
                continue;
            }
            let mut parts = pair.splitn(2, '=');
            let key = parts.next().unwrap_or("");
            let val = parts.next().unwrap_or("");
            let key_space = key.replace('+', " ");
            let val_space = val.replace('+', " ");
            let decoded_key = urlencoding::decode(&key_space).unwrap_or(std::borrow::Cow::Borrowed(&key_space));
            let decoded_val = urlencoding::decode(&val_space).unwrap_or(std::borrow::Cow::Borrowed(&val_space));

            params.push(ExtractedParameter::new(
                endpoint_id,
                decoded_key.into_owned(),
                ParameterLocation::BodyForm,
                decoded_val.into_owned(),
            ));
        }
        params
    }

    /// Extracts nested parameters from JSON bodies using JSON Path notation.
    pub fn extract_from_json(endpoint_id: &EndpointId, json_str: &str) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
            Self::traverse_json_value(endpoint_id, &value, "$", &mut params);
        }
        params
    }

    fn traverse_json_value(
        endpoint_id: &EndpointId,
        val: &serde_json::Value,
        path: &str,
        params: &mut Vec<ExtractedParameter>,
    ) {
        match val {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    let next_path = if path == "$" {
                        format!("$.{}", k)
                    } else {
                        format!("{}.{}", path, k)
                    };
                    Self::traverse_json_value(endpoint_id, v, &next_path, params);
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, v) in arr.iter().enumerate() {
                    let next_path = format!("{}[{}]", path, i);
                    Self::traverse_json_value(endpoint_id, v, &next_path, params);
                }
            }
            serde_json::Value::String(s) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::BodyJson,
                    s.clone(),
                ));
            }
            serde_json::Value::Number(n) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::BodyJson,
                    n.to_string(),
                ));
            }
            serde_json::Value::Bool(b) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::BodyJson,
                    b.to_string(),
                ));
            }
            serde_json::Value::Null => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::BodyJson,
                    "null",
                ));
            }
        }
    }

    /// Extracts parameters from XML bodies (element texts and attributes).
    pub fn extract_from_xml(endpoint_id: &EndpointId, xml_str: &str) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        let mut reader = Reader::from_str(xml_str);
        reader.config_mut().trim_text(true);

        let mut path_stack: Vec<String> = Vec::new();
        let mut buf = Vec::new();

        while let Ok(event) = reader.read_event_into(&mut buf) {
            match event {
                Event::Start(e) => {
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    path_stack.push(tag_name.clone());

                    // Attributes
                    for attr in e.attributes().flatten() {
                        let attr_name = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let attr_val = String::from_utf8_lossy(&attr.value).to_string();
                        let attr_path = format!("{}[@{}]", path_stack.join("/"), attr_name);
                        params.push(ExtractedParameter::new(
                            endpoint_id,
                            attr_path,
                            ParameterLocation::BodyXml,
                            attr_val,
                        ));
                    }
                }
                Event::End(_) => {
                    path_stack.pop();
                }
                Event::Text(e) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if !text.trim().is_empty() {
                        let elem_path = path_stack.join("/");
                        params.push(ExtractedParameter::new(
                            endpoint_id,
                            elem_path,
                            ParameterLocation::BodyXml,
                            text,
                        ));
                    }
                }
                Event::Eof => break,
                _ => {}
            }
            buf.clear();
        }

        params
    }

    /// Extracts parameters from multipart/form-data payloads.
    pub fn extract_from_multipart(
        endpoint_id: &EndpointId,
        body: &[u8],
        boundary: &str,
    ) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        let body_str = String::from_utf8_lossy(body);
        let delimiter = format!("--{}", boundary);
        let name_re = regex::Regex::new(r#"name="([^"]+)""#).unwrap();

        for part in body_str.split(&delimiter) {
            let part_trimmed = part.trim();
            if part_trimmed.is_empty() || part_trimmed == "--" {
                continue;
            }

            // Separate headers from content
            let mut sections = part_trimmed.splitn(2, "\r\n\r\n");
            let headers_part = sections.next().unwrap_or("");
            let content_part = sections.next().unwrap_or("").trim_end_matches("\r\n");

            // Extract name from Content-Disposition
            if let Some(caps) = name_re.captures(headers_part) {
                let name = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    name.to_string(),
                    ParameterLocation::Multipart,
                    content_part.to_string(),
                ));
            }
        }

        params
    }

    /// Extracts individual cookies from a Cookie header string.
    pub fn extract_from_cookies(endpoint_id: &EndpointId, cookie_header: &str) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();
        for item in cookie_header.split(';') {
            let trimmed = item.trim();
            if trimmed.is_empty() {
                continue;
            }
            let mut parts = trimmed.splitn(2, '=');
            let name = parts.next().unwrap_or("").trim();
            let val = parts.next().unwrap_or("").trim();
            if !name.is_empty() {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    name.to_string(),
                    ParameterLocation::Cookie,
                    val.to_string(),
                ));
            }
        }
        params
    }

    fn is_transport_header(header: &str) -> bool {
        let h = header.to_lowercase();
        matches!(
            h.as_str(),
            "content-length"
                | "connection"
                | "accept-encoding"
                | "host"
                | "upgrade-insecure-requests"
                | "sec-fetch-mode"
                | "sec-fetch-site"
                | "sec-fetch-dest"
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_core::ids::TargetId;

    #[test]
    fn test_extract_query_params() {
        let tid = TargetId::derive("https://example.com");
        let eid = EndpointId::derive(&tid, "GET", "/items");
        let params = ParameterExtractor::extract_from_query(&eid, "id=123&name=Alice&filter%5Btype%5D=admin");
        assert_eq!(params.len(), 3);
        assert_eq!(params[0].name, "id");
        assert_eq!(params[0].raw_value, "123");
        assert_eq!(params[0].inferred_type, ParameterType::Integer);
        assert_eq!(params[0].inferred_context, InjectionContext::Numeric);

        assert_eq!(params[1].name, "name");
        assert_eq!(params[1].raw_value, "Alice");
        assert_eq!(params[1].inferred_type, ParameterType::String);

        assert_eq!(params[2].name, "filter[type]");
        assert_eq!(params[2].raw_value, "admin");
    }

    #[test]
    fn test_extract_json_params() {
        let tid = TargetId::derive("https://example.com");
        let eid = EndpointId::derive(&tid, "POST", "/api/user");
        let json_body = r#"{
            "user": {
                "id": 42,
                "username": "admin",
                "roles": ["read", "write"],
                "active": true
            }
        }"#;
        let params = ParameterExtractor::extract_from_json(&eid, json_body);
        assert_eq!(params.len(), 5);
        assert!(params.iter().any(|p| p.name == "$.user.id" && p.raw_value == "42"));
        assert!(params.iter().any(|p| p.name == "$.user.username" && p.raw_value == "admin"));
        assert!(params.iter().any(|p| p.name == "$.user.roles[0]" && p.raw_value == "read"));
        assert!(params.iter().any(|p| p.name == "$.user.active" && p.raw_value == "true"));
    }

    #[test]
    fn test_extract_xml_params() {
        let tid = TargetId::derive("https://example.com");
        let eid = EndpointId::derive(&tid, "POST", "/soap");
        let xml_body = r#"<request version="1.0"><auth><user id="101">test_user</user></auth></request>"#;
        let params = ParameterExtractor::extract_from_xml(&eid, xml_body);
        assert_eq!(params.len(), 3);
        assert!(params.iter().any(|p| p.name == "request[@version]" && p.raw_value == "1.0"));
        assert!(params.iter().any(|p| p.name == "request/auth/user[@id]" && p.raw_value == "101"));
        assert!(params.iter().any(|p| p.name == "request/auth/user" && p.raw_value == "test_user"));
    }

    #[test]
    fn test_extract_multipart_params() {
        let tid = TargetId::derive("https://example.com");
        let eid = EndpointId::derive(&tid, "POST", "/upload");
        let boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        let body = format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\nMy Document\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"category_id\"\r\n\r\n99\r\n--{boundary}--\r\n"
        );
        let params = ParameterExtractor::extract_from_multipart(&eid, body.as_bytes(), boundary);
        assert_eq!(params.len(), 2);
        assert_eq!(params[0].name, "title");
        assert_eq!(params[0].raw_value, "My Document");
        assert_eq!(params[1].name, "category_id");
        assert_eq!(params[1].raw_value, "99");
    }

    #[test]
    fn test_extract_cookies() {
        let tid = TargetId::derive("https://example.com");
        let eid = EndpointId::derive(&tid, "GET", "/dashboard");
        let cookies = "session_id=abc123xyz; theme=dark; auth_token=token456";
        let params = ParameterExtractor::extract_from_cookies(&eid, cookies);
        assert_eq!(params.len(), 3);
        assert_eq!(params[0].name, "session_id");
        assert_eq!(params[0].raw_value, "abc123xyz");
        assert_eq!(params[1].name, "theme");
        assert_eq!(params[1].raw_value, "dark");
    }
}
