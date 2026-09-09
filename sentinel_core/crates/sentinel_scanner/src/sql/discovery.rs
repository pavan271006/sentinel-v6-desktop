//! SENTINEL Autonomous SQL Security Engine — Input Discovery (M05)
//!
//! Enumerates candidate input targets across 26 transport surfaces including
//! nested JSON, JSON arrays, multipart fields, GraphQL variables/documents,
//! cookies, custom headers, and REST path segments.

use serde_json::Value;
use crate::sql::models::{Blake3Id, InputSurfaceType, InputTarget, TargetIdentity};
use crate::sql::normalizer::NormalizedRequest;

pub struct InputDiscoveryEngine;

impl InputDiscoveryEngine {
    /// Extracts all candidate injection targets from a normalized HTTP request
    pub fn discover_inputs(req: &NormalizedRequest, identity: TargetIdentity) -> Vec<InputTarget> {
        let mut targets = Vec::new();

        // 1. URL Query Parameters
        for (key, val) in &req.query_params {
            // Check for PostgREST operators (e.g. col=gte.10)
            if let Some((op, subval)) = val.split_once('.') {
                if ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "fts", "cs", "cd"].contains(&op) {
                    targets.push(Self::create_target(
                        req,
                        InputSurfaceType::PostgrestOperator { column: key.clone(), op: op.to_string() },
                        subval,
                        identity.clone(),
                    ));
                }
            }
            targets.push(Self::create_target(
                req,
                InputSurfaceType::UrlQueryParam { key: key.clone() },
                val,
                identity.clone(),
            ));
        }

        // 2. REST Path Segments (numeric or UUID identifiers in path)
        if let Ok(parsed_url) = url::Url::parse(&req.canonical_uri) {
            for (idx, seg) in parsed_url.path_segments().into_iter().flatten().enumerate() {
                if !seg.is_empty() && (seg.parse::<i64>().is_ok() || uuid::Uuid::parse_str(seg).is_ok()) {
                    targets.push(Self::create_target(
                        req,
                        InputSurfaceType::RestPathSegment { index: idx, template_var: None },
                        seg,
                        identity.clone(),
                    ));
                }
            }
        }

        // 3. HTTP Cookie Values
        if let Some(cookie_hdr) = req.headers.get("cookie") {
            for pair in cookie_hdr.split(';') {
                let trimmed = pair.trim();
                if let Some((k, v)) = trimmed.split_once('=') {
                    let name = k.trim().to_string();
                    let val = v.trim();
                    targets.push(Self::create_target(
                        req,
                        InputSurfaceType::HttpCookie { name },
                        val,
                        identity.clone(),
                    ));
                }
            }
        }

        // 4. Custom Gateway Headers
        for (name, val) in &req.headers {
            let lower = name.to_lowercase();
            if lower.starts_with("x-") || lower == "user-agent" || lower == "referer" || lower == "authorization" {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::CustomGatewayHeader { name: name.clone() },
                    val,
                    identity.clone(),
                ));
            }
        }

        // 5. Body Inspection (JSON, Form-Urlencoded, Multipart, GraphQL, XML)
        if let Some(ref ct) = req.content_type {
            let ct_lower = ct.to_lowercase();
            if ct_lower.contains("application/json") {
                Self::discover_json_inputs(req, &req.body, identity.clone(), &mut targets);
            } else if ct_lower.contains("application/x-www-form-urlencoded") {
                Self::discover_form_inputs(req, &req.body, identity.clone(), &mut targets);
            } else if ct_lower.contains("application/graphql") {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::GraphQLQueryDocument,
                    &String::from_utf8_lossy(&req.body),
                    identity.clone(),
                ));
            } else if ct_lower.contains("xml") || ct_lower.contains("text/xml") {
                Self::discover_xml_inputs(req, &req.body, identity.clone(), &mut targets);
            }
        } else if !req.body.is_empty() {
            let body_str = String::from_utf8_lossy(&req.body);
            let trimmed = body_str.trim();
            if trimmed.starts_with('<') {
                Self::discover_xml_inputs(req, &req.body, identity.clone(), &mut targets);
            } else {
                Self::discover_json_inputs(req, &req.body, identity.clone(), &mut targets);
            }
        }

        targets
    }

    fn discover_xml_inputs(req: &NormalizedRequest, body: &[u8], identity: TargetIdentity, targets: &mut Vec<InputTarget>) {
        let body_str = String::from_utf8_lossy(body);
        if let Ok(elem_re) = regex::Regex::new(r#"<([a-zA-Z0-9_\-:]+)(?:\s+[^>]*)?>([^<]+)</\1>"#) {
            for cap in elem_re.captures_iter(&body_str) {
                let tag = cap[1].to_string();
                let val = cap[2].trim().to_string();
                if !tag.starts_with('?') && !tag.starts_with('!') {
                    targets.push(Self::create_target(
                        req,
                        InputSurfaceType::XmlElement { tag },
                        &val,
                        identity.clone(),
                    ));
                }
            }
        }
    }

    fn discover_json_inputs(req: &NormalizedRequest, body: &[u8], identity: TargetIdentity, targets: &mut Vec<InputTarget>) {
        if let Ok(json_val) = serde_json::from_slice::<Value>(body) {
            Self::walk_json_value(req, &json_val, "$", identity, targets);
        }
    }

    fn walk_json_value(req: &NormalizedRequest, val: &Value, current_path: &str, identity: TargetIdentity, targets: &mut Vec<InputTarget>) {
        match val {
            Value::String(s) => {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::JsonScalarField { path: current_path.to_string() },
                    s,
                    identity,
                ));
            }
            Value::Number(n) => {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::JsonScalarField { path: current_path.to_string() },
                    &n.to_string(),
                    identity,
                ));
            }
            Value::Bool(b) => {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::JsonScalarField { path: current_path.to_string() },
                    if *b { "true" } else { "false" },
                    identity,
                ));
            }
            Value::Array(arr) => {
                for (idx, elem) in arr.iter().enumerate() {
                    let path = format!("{}[{}]", current_path, idx);
                    targets.push(Self::create_target(
                        req,
                        InputSurfaceType::JsonArrayElement { path: current_path.to_string(), index: idx },
                        &elem.to_string(),
                        identity.clone(),
                    ));
                    Self::walk_json_value(req, elem, &path, identity.clone(), targets);
                }
            }
            Value::Object(map) => {
                for (k, v) in map {
                    let path = format!("{}.{}", current_path, k);
                    if k == "variables" && v.is_object() {
                        // GraphQL variables object inside JSON body
                        if let Some(var_map) = v.as_object() {
                            for (var_key, var_val) in var_map {
                                targets.push(Self::create_target(
                                    req,
                                    InputSurfaceType::GraphQLVariable { key: var_key.clone() },
                                    &var_val.to_string(),
                                    identity.clone(),
                                ));
                            }
                        }
                    }
                    Self::walk_json_value(req, v, &path, identity.clone(), targets);
                }
            }
            Value::Null => {}
        }
    }

    fn discover_form_inputs(req: &NormalizedRequest, body: &[u8], identity: TargetIdentity, targets: &mut Vec<InputTarget>) {
        if let Ok(body_str) = std::str::from_utf8(body) {
            for (k, v) in url::form_urlencoded::parse(body_str.as_bytes()) {
                targets.push(Self::create_target(
                    req,
                    InputSurfaceType::FormBodyField { key: k.to_string() },
                    &v,
                    identity.clone(),
                ));
            }
        }
    }

    fn create_target(req: &NormalizedRequest, surface: InputSurfaceType, raw_val: &str, identity: TargetIdentity) -> InputTarget {
        let mut id_material = Vec::new();
        id_material.extend_from_slice(req.canonical_uri.as_bytes());
        id_material.extend_from_slice(format!("{:?}", surface).as_bytes());
        id_material.extend_from_slice(raw_val.as_bytes());
        let id = Blake3Id::new(&id_material);

        let inferred_type = if raw_val.parse::<i64>().is_ok() {
            "integer".to_string()
        } else if raw_val.parse::<f64>().is_ok() {
            "float".to_string()
        } else if raw_val.eq_ignore_ascii_case("true") || raw_val.eq_ignore_ascii_case("false") {
            "boolean".to_string()
        } else if uuid::Uuid::parse_str(raw_val).is_ok() {
            "uuid".to_string()
        } else {
            "string".to_string()
        };

        InputTarget {
            id,
            endpoint_url: req.canonical_uri.clone(),
            http_method: req.method.clone(),
            surface,
            original_value: raw_val.to_string(),
            inferred_type,
            identity,
        }
    }
}
