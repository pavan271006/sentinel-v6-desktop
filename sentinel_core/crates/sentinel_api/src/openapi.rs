//! OpenAPI 3.0/3.1 & Swagger 2.0 Spec Ingestion, $ref Resolution and Spec-Driven Fuzzing Engine.
//!
//! Provides:
//! - Full RFC 6901 JSON Pointer & $ref resolution with circular/recursion cycle guards
//! - Parameter & route template extraction (Path, Query, Header, Cookie, RequestBody)
//! - Support for JSON Schema 2020-12 polymorphism (oneOf, anyOf, allOf)
//! - Comprehensive spec-driven vulnerability fuzz generation

use sentinel_common::enums::HttpMethod;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::PRoute;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiEndpointSchema {
    pub path: String,
    pub method: String,
    pub summary: Option<String>,
    pub parameters: Vec<OpenApiParameter>,
    pub request_body_schema: Option<serde_json::Value>,
    pub request_body_required: bool,
    pub security_schemes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiParameter {
    pub name: String,
    pub location: String, // "path", "query", "header", "cookie"
    pub required: bool,
    pub schema_type: String, // "integer", "string", "boolean", "array", "object"
    pub format: Option<String>,
    pub minimum: Option<i64>,
    pub maximum: Option<i64>,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub pattern: Option<String>,
    pub enum_values: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecDrivenFuzzCase {
    pub target_path: String,
    pub method: String,
    pub test_name: String,
    pub attack_category: String,
    pub parameter_payloads: Vec<(String, String)>,
    pub body_payload: Option<serde_json::Value>,
    pub expected_status_boundary: u16, // e.g. 400 Bad Request / 422 Unprocessable
}

/// JSON Pointer & $ref resolver with cycle detection and external document support.
#[derive(Debug, Clone)]
pub struct JsonPointerResolver {
    pub root_doc: serde_json::Value,
    pub external_docs: HashMap<String, serde_json::Value>,
    pub max_depth: usize,
}

impl JsonPointerResolver {
    pub fn new(root_doc: serde_json::Value) -> Self {
        Self {
            root_doc,
            external_docs: HashMap::new(),
            max_depth: 64,
        }
    }

    pub fn add_external_doc(&mut self, uri: String, doc: serde_json::Value) {
        self.external_docs.insert(uri, doc);
    }

    /// Resolves a $ref pointer string, detecting recursion cycles.
    pub fn resolve_ref(
        &self,
        ref_str: &str,
        visited: &mut HashSet<String>,
    ) -> Result<serde_json::Value, SentinelError> {
        if visited.contains(ref_str) {
            // Cycle guard: return placeholder object with original $ref to break loop
            return Ok(serde_json::json!({
                "type": "circular_ref_stub",
                "$ref": ref_str
            }));
        }
        visited.insert(ref_str.to_string());

        if let Some(fragment) = ref_str.strip_prefix('#') {
            self.resolve_fragment(&self.root_doc, fragment, visited)
        } else if ref_str.contains('#') {
            let parts: Vec<&str> = ref_str.split('#').collect();
            let doc = self.external_docs.get(parts[0]).ok_or_else(|| {
                SentinelError::parse_error(format!("External ref doc not loaded: {}", parts[0]))
            })?;
            self.resolve_fragment(doc, parts[1], visited)
        } else {
            self.external_docs
                .get(ref_str)
                .cloned()
                .ok_or_else(|| SentinelError::parse_error(format!("External ref not found: {}", ref_str)))
        }
    }

    /// Recursively expands all $ref instances in a schema value.
    pub fn expand_schema(
        &self,
        schema: &serde_json::Value,
        visited: &mut HashSet<String>,
    ) -> serde_json::Value {
        self.expand_schema_depth(schema, visited, 0)
    }

    fn expand_schema_depth(
        &self,
        schema: &serde_json::Value,
        visited: &mut HashSet<String>,
        depth: usize,
    ) -> serde_json::Value {
        if depth > self.max_depth {
            return schema.clone();
        }

        if let Some(ref_str) = schema.get("$ref").and_then(|r| r.as_str()) {
            if schema.get("type").and_then(|t| t.as_str()) == Some("circular_ref_stub") {
                return schema.clone();
            }

            if let Ok(resolved) = self.resolve_ref(ref_str, visited) {
                if resolved.get("type").and_then(|t| t.as_str()) == Some("circular_ref_stub") {
                    return resolved;
                }

                // Merge resolved schema with local sibling properties
                let mut merged = resolved.clone();
                if let (Some(m_obj), Some(s_obj)) = (merged.as_object_mut(), schema.as_object()) {
                    for (k, v) in s_obj {
                        if k != "$ref" {
                            m_obj.insert(k.clone(), v.clone());
                        }
                    }
                }
                return self.expand_schema_depth(&merged, visited, depth + 1);
            }
        }

        match schema {
            serde_json::Value::Object(map) => {
                let mut out = serde_json::Map::new();
                for (k, v) in map {
                    out.insert(k.clone(), self.expand_schema_depth(v, visited, depth + 1));
                }
                serde_json::Value::Object(out)
            }
            serde_json::Value::Array(arr) => {
                let out = arr
                    .iter()
                    .map(|item| self.expand_schema_depth(item, visited, depth + 1))
                    .collect();
                serde_json::Value::Array(out)
            }
            other => other.clone(),
        }
    }

    fn resolve_fragment(
        &self,
        doc: &serde_json::Value,
        fragment: &str,
        visited: &mut HashSet<String>,
    ) -> Result<serde_json::Value, SentinelError> {
        let tokens: Vec<String> = fragment
            .split('/')
            .filter(|s| !s.is_empty())
            .map(|s| s.replace("~1", "/").replace("~0", "~"))
            .collect();

        let mut curr = doc;
        for token in tokens {
            if let Some(obj) = curr.as_object() {
                curr = obj.get(&token).ok_or_else(|| {
                    SentinelError::parse_error(format!("Pointer token '{}' not found in document", token))
                })?;
            } else if let Some(arr) = curr.as_array() {
                let idx: usize = token.parse().map_err(|_| {
                    SentinelError::parse_error(format!("Invalid array index '{}' in pointer", token))
                })?;
                curr = arr.get(idx).ok_or_else(|| {
                    SentinelError::parse_error(format!("Array index {} out of bounds", idx))
                })?;
            } else {
                return Err(SentinelError::parse_error(format!(
                    "Cannot traverse primitive with token '{}'",
                    token
                )));
            }
        }

        // If target is itself a $ref, resolve it
        if let Some(nested_ref) = curr.get("$ref").and_then(|r| r.as_str()) {
            return self.resolve_ref(nested_ref, visited);
        }

        Ok(curr.clone())
    }
}

pub struct OpenApiParser;

impl OpenApiParser {
    /// Ingests OpenAPI specification and returns basic PRoutes.
    pub fn parse_spec(spec_json: &str) -> Result<Vec<PRoute>, SentinelError> {
        let schemas = Self::parse_detailed_schemas(spec_json)?;
        let mut routes = Vec::new();

        for s in schemas {
            if let Ok(method) = s.method.parse::<HttpMethod>() {
                let expected_params = s.parameters.into_iter().map(|p| p.name).collect();
                routes.push(PRoute {
                    path_template: s.path,
                    method,
                    expected_params,
                });
            }
        }

        Ok(routes)
    }

    /// Ingests OpenAPI 3.0/3.1 or Swagger 2.0 with full $ref resolution and schema extraction.
    pub fn parse_detailed_schemas(spec_json: &str) -> Result<Vec<OpenApiEndpointSchema>, SentinelError> {
        let raw_val: serde_json::Value = serde_json::from_str(spec_json)
            .map_err(|e| SentinelError::parse_error(format!("Invalid OpenAPI JSON: {}", e)))?;

        let resolver = JsonPointerResolver::new(raw_val.clone());
        let mut visited = HashSet::new();
        let expanded = resolver.expand_schema(&raw_val, &mut visited);

        let paths = expanded
            .get("paths")
            .and_then(|p| p.as_object())
            .ok_or_else(|| SentinelError::parse_error("Missing 'paths' object in OpenAPI spec".to_string()))?;

        let mut endpoints = Vec::new();

        for (path_str, path_item) in paths {
            if let Some(methods) = path_item.as_object() {
                // Top-level path item parameters
                let mut path_level_params = Vec::new();
                if let Some(params_arr) = path_item.get("parameters").and_then(|p| p.as_array()) {
                    for p in params_arr {
                        if let Some(param) = Self::parse_parameter(p) {
                            path_level_params.push(param);
                        }
                    }
                }

                for (method_str, op) in methods {
                    if method_str.eq_ignore_ascii_case("parameters") || method_str.starts_with('x') {
                        continue;
                    }

                    let summary = op.get("summary").and_then(|s| s.as_str()).map(String::from);
                    let mut parameters = path_level_params.clone();

                    if let Some(params_arr) = op.get("parameters").and_then(|p| p.as_array()) {
                        for p in params_arr {
                            if let Some(param) = Self::parse_parameter(p) {
                                // Overwrite path-level parameter if same name and location
                                parameters.retain(|existing| {
                                    !(existing.name == param.name && existing.location == param.location)
                                });
                                parameters.push(param);
                            }
                        }
                    }

                    // Parse requestBody (OpenAPI 3.x)
                    let mut request_body_schema = None;
                    let mut request_body_required = false;

                    if let Some(req_body) = op.get("requestBody") {
                        request_body_required = req_body
                            .get("required")
                            .and_then(|r| r.as_bool())
                            .unwrap_or(false);

                        if let Some(content) = req_body.get("content").and_then(|c| c.as_object()) {
                            if let Some(json_content) = content.get("application/json") {
                                request_body_schema = json_content.get("schema").cloned();
                            } else if let Some((_, first_content)) = content.iter().next() {
                                request_body_schema = first_content.get("schema").cloned();
                            }
                        }
                    }

                    // Security schemes
                    let mut security_schemes = Vec::new();
                    if let Some(sec_arr) = op.get("security").and_then(|s| s.as_array()) {
                        for req in sec_arr {
                            if let Some(obj) = req.as_object() {
                                for k in obj.keys() {
                                    security_schemes.push(k.clone());
                                }
                            }
                        }
                    }

                    endpoints.push(OpenApiEndpointSchema {
                        path: path_str.clone(),
                        method: method_str.to_uppercase(),
                        summary,
                        parameters,
                        request_body_schema,
                        request_body_required,
                        security_schemes,
                    });
                }
            }
        }

        Ok(endpoints)
    }

    fn parse_parameter(param_json: &serde_json::Value) -> Option<OpenApiParameter> {
        let name = param_json.get("name").and_then(|n| n.as_str())?.to_string();
        let location = param_json
            .get("in")
            .and_then(|l| l.as_str())
            .unwrap_or("query")
            .to_string();
        let required = param_json
            .get("required")
            .and_then(|r| r.as_bool())
            .unwrap_or(location == "path");

        let schema = param_json.get("schema").unwrap_or(param_json);
        let schema_type = schema
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("string")
            .to_string();
        let format = schema.get("format").and_then(|f| f.as_str()).map(String::from);
        let minimum = schema.get("minimum").and_then(|m| m.as_i64());
        let maximum = schema.get("maximum").and_then(|m| m.as_i64());
        let min_length = schema.get("minLength").and_then(|m| m.as_u64()).map(|u| u as usize);
        let max_length = schema.get("maxLength").and_then(|m| m.as_u64()).map(|u| u as usize);
        let pattern = schema.get("pattern").and_then(|p| p.as_str()).map(String::from);
        let enum_values = schema.get("enum").and_then(|e| e.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        });

        Some(OpenApiParameter {
            name,
            location,
            required,
            schema_type,
            format,
            minimum,
            maximum,
            min_length,
            max_length,
            pattern,
            enum_values,
        })
    }

    /// Generates spec-driven fuzzing test cases covering the entire attack matrix.
    pub fn generate_spec_fuzz_cases(endpoint: &OpenApiEndpointSchema) -> Vec<SpecDrivenFuzzCase> {
        let mut cases = Vec::new();

        for param in &endpoint.parameters {
            // 1. Required parameter omission
            if param.required {
                cases.push(SpecDrivenFuzzCase {
                    target_path: endpoint.path.clone(),
                    method: endpoint.method.clone(),
                    test_name: format!("OmitRequiredParam_{}", param.name),
                    attack_category: "RequiredOmission".to_string(),
                    parameter_payloads: vec![],
                    body_payload: None,
                    expected_status_boundary: 400,
                });
            }

            // 2. Type mismatch fuzzing
            match param.schema_type.as_str() {
                "integer" | "number" => {
                    cases.push(SpecDrivenFuzzCase {
                        target_path: endpoint.path.clone(),
                        method: endpoint.method.clone(),
                        test_name: format!("TypeMismatch_StringIntoInt_{}", param.name),
                        attack_category: "TypeConfusion".to_string(),
                        parameter_payloads: vec![(param.name.clone(), "not_an_int".to_string())],
                        body_payload: None,
                        expected_status_boundary: 400,
                    });

                    // Boundary extremes
                    let min_val = param.minimum.unwrap_or(0);
                    cases.push(SpecDrivenFuzzCase {
                        target_path: endpoint.path.clone(),
                        method: endpoint.method.clone(),
                        test_name: format!("BoundaryUnderflow_{}", param.name),
                        attack_category: "BoundaryExtreme".to_string(),
                        parameter_payloads: vec![(param.name.clone(), (min_val - 1).to_string())],
                        body_payload: None,
                        expected_status_boundary: 400,
                    });

                    let max_val = param.maximum.unwrap_or(i32::MAX as i64);
                    cases.push(SpecDrivenFuzzCase {
                        target_path: endpoint.path.clone(),
                        method: endpoint.method.clone(),
                        test_name: format!("BoundaryOverflow_{}", param.name),
                        attack_category: "BoundaryExtreme".to_string(),
                        parameter_payloads: vec![(param.name.clone(), (max_val + 1).to_string())],
                        body_payload: None,
                        expected_status_boundary: 400,
                    });
                }
                "boolean" => {
                    cases.push(SpecDrivenFuzzCase {
                        target_path: endpoint.path.clone(),
                        method: endpoint.method.clone(),
                        test_name: format!("TypeMismatch_IntIntoBool_{}", param.name),
                        attack_category: "TypeConfusion".to_string(),
                        parameter_payloads: vec![(param.name.clone(), "12345".to_string())],
                        body_payload: None,
                        expected_status_boundary: 400,
                    });
                }
                "string" => {
                    if let Some(min_len) = param.min_length {
                        if min_len > 0 {
                            cases.push(SpecDrivenFuzzCase {
                                target_path: endpoint.path.clone(),
                                method: endpoint.method.clone(),
                                test_name: format!("StringUnderflow_EmptyString_{}", param.name),
                                attack_category: "StringConstraint".to_string(),
                                parameter_payloads: vec![(param.name.clone(), String::new())],
                                body_payload: None,
                                expected_status_boundary: 400,
                            });
                        }
                    }

                    // Oversized string payload
                    let max_len = param.max_length.unwrap_or(1024);
                    cases.push(SpecDrivenFuzzCase {
                        target_path: endpoint.path.clone(),
                        method: endpoint.method.clone(),
                        test_name: format!("StringOverflow_Oversized_{}", param.name),
                        attack_category: "StringConstraint".to_string(),
                        parameter_payloads: vec![(param.name.clone(), "A".repeat(max_len + 500))],
                        body_payload: None,
                        expected_status_boundary: 400,
                    });

                    // Format violation
                    if let Some(fmt) = &param.format {
                        match fmt.as_str() {
                            "uuid" => {
                                cases.push(SpecDrivenFuzzCase {
                                    target_path: endpoint.path.clone(),
                                    method: endpoint.method.clone(),
                                    test_name: format!("FormatViolation_InvalidUuid_{}", param.name),
                                    attack_category: "FormatValidation".to_string(),
                                    parameter_payloads: vec![(param.name.clone(), "not-a-valid-uuid".to_string())],
                                    body_payload: None,
                                    expected_status_boundary: 400,
                                });
                            }
                            "email" => {
                                cases.push(SpecDrivenFuzzCase {
                                    target_path: endpoint.path.clone(),
                                    method: endpoint.method.clone(),
                                    test_name: format!("FormatViolation_InvalidEmail_{}", param.name),
                                    attack_category: "FormatValidation".to_string(),
                                    parameter_payloads: vec![(param.name.clone(), "plainaddress".to_string())],
                                    body_payload: None,
                                    expected_status_boundary: 400,
                                });
                            }
                            "uri" => {
                                cases.push(SpecDrivenFuzzCase {
                                    target_path: endpoint.path.clone(),
                                    method: endpoint.method.clone(),
                                    test_name: format!("FormatViolation_PathTraversalUri_{}", param.name),
                                    attack_category: "FormatValidation".to_string(),
                                    parameter_payloads: vec![(param.name.clone(), "../../../etc/passwd".to_string())],
                                    body_payload: None,
                                    expected_status_boundary: 400,
                                });
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }

            // 3. Enum violation
            if let Some(valid_enums) = &param.enum_values {
                cases.push(SpecDrivenFuzzCase {
                    target_path: endpoint.path.clone(),
                    method: endpoint.method.clone(),
                    test_name: format!("EnumViolation_{}", param.name),
                    attack_category: "EnumValidation".to_string(),
                    parameter_payloads: vec![(param.name.clone(), "INVALID_ENUM_VALUE_XYZ".to_string())],
                    body_payload: None,
                    expected_status_boundary: 400,
                });
                let _ = valid_enums;
            }
        }

        // 4. Mass Assignment / Prototype Pollution in Request Body
        if endpoint.request_body_schema.is_some() || endpoint.request_body_required {
            cases.push(SpecDrivenFuzzCase {
                target_path: endpoint.path.clone(),
                method: endpoint.method.clone(),
                test_name: "MassAssignment_AdminPrivilege".to_string(),
                attack_category: "MassAssignment".to_string(),
                parameter_payloads: vec![],
                body_payload: Some(serde_json::json!({
                    "role": "admin",
                    "isAdmin": true,
                    "superuser": true,
                    "permissions": ["*"]
                })),
                expected_status_boundary: 400,
            });

            cases.push(SpecDrivenFuzzCase {
                target_path: endpoint.path.clone(),
                method: endpoint.method.clone(),
                test_name: "MassAssignment_PrototypePollution".to_string(),
                attack_category: "PrototypePollution".to_string(),
                parameter_payloads: vec![],
                body_payload: Some(serde_json::json!({
                    "__proto__": {
                        "admin": true,
                        "polluted": "yes"
                    },
                    "constructor": {
                        "prototype": {
                            "role": "admin"
                        }
                    }
                })),
                expected_status_boundary: 400,
            });
        }

        cases
    }
}
