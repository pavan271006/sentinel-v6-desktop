//! SENTINEL Autonomous SQL Security Engine — Parametric Test Compiler (M11)
//!
//! Synthesizes concrete serialized HTTP requests from abstract TestIntents,
//! dialect rules, and syntactic AST context models.

use crate::sql::dbms::DbmsHypothesisEngine;
use crate::sql::models::{InputSurfaceType, InputTarget, TestIntent};
use crate::sql::normalizer::NormalizedRequest;

pub struct TestCompiler;

impl TestCompiler {
    /// Compiles a TestIntent into a serialized payload string tailored to the target DBMS & Context
    pub fn compile_payload(intent: &TestIntent, original_value: &str) -> String {
        let comment = DbmsHypothesisEngine::comment_marker(&intent.target_dbms_id);
        let sleep_cmd = DbmsHypothesisEngine::sleep_probe(&intent.target_dbms_id, 3);

        let mut payload = intent.raw_payload_template.clone();
        payload = payload.replace("[COMMENT]", comment);
        payload = payload.replace("[SLEEP_FUNC]", &sleep_cmd);
        payload = payload.replace("[ORIGINAL]", original_value);

        payload
    }

    /// Mutates a NormalizedRequest by inserting the compiled payload into the target input surface
    pub fn mutate_request(
        base_req: &NormalizedRequest,
        target: &InputTarget,
        compiled_payload: &str,
    ) -> Result<Vec<u8>, String> {
        match &target.surface {
            InputSurfaceType::UrlQueryParam { key } => {
                let mut new_query = Vec::new();
                for (k, v) in &base_req.query_params {
                    if k == key {
                        new_query.push((k.clone(), compiled_payload.to_string()));
                    } else {
                        new_query.push((k.clone(), v.clone()));
                    }
                }
                Self::build_http_request(base_req, Some(new_query), None, None)
            }
            InputSurfaceType::HttpCookie { name } => {
                let mut new_headers = base_req.headers.clone();
                if let Some(cookie_hdr) = new_headers.get_mut("cookie") {
                    let mut pairs: Vec<String> = Vec::new();
                    for p in cookie_hdr.split(';') {
                        if let Some((k, _)) = p.split_once('=') {
                            if k.trim() == name {
                                pairs.push(format!("{}={}", k.trim(), compiled_payload));
                                continue;
                            }
                        }
                        pairs.push(p.to_string());
                    }
                    *cookie_hdr = pairs.join("; ");
                }
                Self::build_http_request(base_req, None, Some(new_headers), None)
            }
            InputSurfaceType::CustomGatewayHeader { name } => {
                let mut new_headers = base_req.headers.clone();
                new_headers.insert(name.to_lowercase(), compiled_payload.to_string());
                Self::build_http_request(base_req, None, Some(new_headers), None)
            }
            InputSurfaceType::FormBodyField { key } => {
                let mut pairs: Vec<String> = Vec::new();
                if let Ok(body_str) = std::str::from_utf8(&base_req.body) {
                    for (k, v) in url::form_urlencoded::parse(body_str.as_bytes()) {
                        let enc_k: String = url::form_urlencoded::byte_serialize(k.as_bytes()).collect();
                        if k == *key {
                            let enc_val: String = url::form_urlencoded::byte_serialize(compiled_payload.as_bytes()).collect();
                            pairs.push(format!("{}={}", enc_k, enc_val));
                        } else {
                            let enc_val: String = url::form_urlencoded::byte_serialize(v.as_bytes()).collect();
                            pairs.push(format!("{}={}", enc_k, enc_val));
                        }
                    }
                }
                let new_body = pairs.join("&").into_bytes();
                Self::build_http_request(base_req, None, None, Some(new_body))
            }
            InputSurfaceType::JsonScalarField { path: _ } => {
                // If body is JSON, replace the scalar value
                if let Ok(mut json_val) = serde_json::from_slice::<serde_json::Value>(&base_req.body) {
                    Self::mutate_json_val(&mut json_val, target, compiled_payload);
                    let new_body = serde_json::to_vec(&json_val).map_err(|e| e.to_string())?;
                    Self::build_http_request(base_req, None, None, Some(new_body))
                } else {
                    Err("Failed to parse JSON body for mutation".to_string())
                }
            }
            InputSurfaceType::XmlElement { tag } => {
                if let Ok(body_str) = std::str::from_utf8(&base_req.body) {
                    let pattern = format!(r#"(<{tag}[^>]*>)[^<]*(</{tag}>)"#, tag = regex::escape(tag));
                    if let Ok(re) = regex::Regex::new(&pattern) {
                        let replaced = re.replace(body_str, format!("${{1}}{}${{2}}", compiled_payload));
                        let new_body = replaced.into_owned().into_bytes();
                        Self::build_http_request(base_req, None, None, Some(new_body))
                    } else {
                        Err("Failed to compile XML regex".to_string())
                    }
                } else {
                    Err("Non-UTF8 XML body".to_string())
                }
            }
            InputSurfaceType::XmlAttribute { tag, attr } => {
                if let Ok(body_str) = std::str::from_utf8(&base_req.body) {
                    let pattern = format!(r#"(<{tag}[^>]*\s+{attr}=\")[^\"]*(\"[^>]*>)"#, tag = regex::escape(tag), attr = regex::escape(attr));
                    if let Ok(re) = regex::Regex::new(&pattern) {
                        let replaced = re.replace(body_str, format!("${{1}}{}${{2}}", compiled_payload));
                        let new_body = replaced.into_owned().into_bytes();
                        Self::build_http_request(base_req, None, None, Some(new_body))
                    } else {
                        Err("Failed to compile XML attribute regex".to_string())
                    }
                } else {
                    Err("Non-UTF8 XML body".to_string())
                }
            }
            _ => {
                // Fallback direct raw mutation
                Self::build_http_request(base_req, None, None, None)
            }
        }
    }

    /// Encodes a payload string into XML Hexadecimal entities (e.g. 'U' -> '&#x55;') to evade WAFs
    pub fn encode_xml_hex_entities(payload: &str) -> String {
        payload.chars().map(|c| format!("&#x{:x};", c as u32)).collect()
    }

    /// Encodes a payload string into XML Decimal entities (e.g. 'U' -> '&#85;') to evade WAFs
    pub fn encode_xml_decimal_entities(payload: &str) -> String {
        payload.chars().map(|c| format!("&#{};", c as u32)).collect()
    }

    fn mutate_json_val(val: &mut serde_json::Value, target: &InputTarget, payload: &str) {
        if let serde_json::Value::Object(map) = val {
            for (_, v) in map.iter_mut() {
                if let serde_json::Value::String(s) = v {
                    if *s == target.original_value {
                        *v = serde_json::Value::String(payload.to_string());
                        return;
                    }
                }
                Self::mutate_json_val(v, target, payload);
            }
        }
    }

    fn build_http_request(
        req: &NormalizedRequest,
        query: Option<Vec<(String, String)>>,
        headers: Option<std::collections::BTreeMap<String, String>>,
        body: Option<Vec<u8>>,
    ) -> Result<Vec<u8>, String> {
        let headers = headers.unwrap_or_else(|| req.headers.clone());
        let body = body.unwrap_or_else(|| req.body.clone());

        let path = if let Some(q) = query {
            let q_str = q
                .iter()
                .map(|(k, v)| {
                    let enc_k: String = url::form_urlencoded::byte_serialize(k.as_bytes()).collect();
                    let enc_v: String = url::form_urlencoded::byte_serialize(v.as_bytes()).collect();
                    format!("{}={}", enc_k, enc_v)
                })
                .collect::<Vec<_>>()
                .join("&");
            if q_str.is_empty() { req.canonical_uri.clone() } else { format!("{}?{}", req.canonical_uri.split('?').next().unwrap_or("/"), q_str) }
        } else {
            req.canonical_uri.clone()
        };

        let mut output = Vec::new();
        output.extend_from_slice(format!("{} {} {}\r\n", req.method, path, req.http_version).as_bytes());
        for (k, v) in &headers {
            if k != "content-length" {
                output.extend_from_slice(format!("{}: {}\r\n", k, v).as_bytes());
            }
        }
        output.extend_from_slice(format!("content-length: {}\r\n\r\n", body.len()).as_bytes());
        output.extend_from_slice(&body);

        Ok(output)
    }
}
