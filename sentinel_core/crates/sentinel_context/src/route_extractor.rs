//! JavaScript Route & Endpoint Extractor
//!
//! Scans client-side JavaScript code / bundles to discover unlinked API routes and parameters:
//! - React Router path patterns (path: "/api/v1/users/:id")
//! - Vue / Angular routing configurations
//! - Fetch / Axios / XHR endpoint strings (fetch("/api/..."), axios.post("/auth/..."))

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoveredRoute {
    pub path_template: String,
    pub http_methods: Vec<String>,
    pub parameters: Vec<String>,
    pub source_snippet: String,
}

pub struct RouteExtractorEngine;

impl RouteExtractorEngine {
    /// Extracts API endpoints and client routes from JavaScript source text
    pub fn extract_routes(js_content: &str) -> Vec<DiscoveredRoute> {
        let mut discovered = Vec::new();
        let mut seen_paths = HashSet::new();

        // 1. Match path: "/..." or path: '/...'
        let re_path = Regex::new(r#"path\s*:\s*["'](/[^"']+)["']"#).unwrap();
        for cap in re_path.captures_iter(js_content) {
            if let Some(m) = cap.get(1) {
                let path = m.as_str().to_string();
                if seen_paths.insert(path.clone()) {
                    let params = Self::extract_path_params(&path);
                    discovered.push(DiscoveredRoute {
                        path_template: path,
                        http_methods: vec!["GET".to_string()],
                        parameters: params,
                        source_snippet: cap.get(0).map(|s| s.as_str().to_string()).unwrap_or_default(),
                    });
                }
            }
        }

        // 2. Match fetch("/...") or axios.get("/...") or axios.post("/...")
        let re_api = Regex::new(r#"(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*["'`](/[^"'`\s]+)["'`]"#).unwrap();
        for cap in re_api.captures_iter(js_content) {
            if let Some(m) = cap.get(1) {
                let path = m.as_str().to_string();
                let method = if cap.get(0).unwrap().as_str().contains(".post") {
                    "POST"
                } else if cap.get(0).unwrap().as_str().contains(".put") {
                    "PUT"
                } else if cap.get(0).unwrap().as_str().contains(".delete") {
                    "DELETE"
                } else {
                    "GET"
                };

                if seen_paths.insert(path.clone()) {
                    let params = Self::extract_path_params(&path);
                    discovered.push(DiscoveredRoute {
                        path_template: path,
                        http_methods: vec![method.to_string()],
                        parameters: params,
                        source_snippet: cap.get(0).map(|s| s.as_str().to_string()).unwrap_or_default(),
                    });
                }
            }
        }

        // 3. Match generic API endpoints /api/v...
        let re_generic = Regex::new(r#"["'`](/api/v[0-9]+/[a-zA-Z0-9_\-/{}:]+)["'`]"#).unwrap();
        for cap in re_generic.captures_iter(js_content) {
            if let Some(m) = cap.get(1) {
                let path = m.as_str().to_string();
                if seen_paths.insert(path.clone()) {
                    let params = Self::extract_path_params(&path);
                    discovered.push(DiscoveredRoute {
                        path_template: path,
                        http_methods: vec!["GET".to_string(), "POST".to_string()],
                        parameters: params,
                        source_snippet: cap.get(0).map(|s| s.as_str().to_string()).unwrap_or_default(),
                    });
                }
            }
        }

        discovered
    }

    /// Extracts path parameter names (e.g. /users/:id or /users/{id})
    fn extract_path_params(path: &str) -> Vec<String> {
        let mut params = Vec::new();
        for segment in path.split('/') {
            if let Some(param) = segment.strip_prefix(':') {
                params.push(param.to_string());
            } else if segment.starts_with('{') && segment.ends_with('}') {
                let clean = &segment[1..segment.len() - 1];
                params.push(clean.to_string());
            }
        }
        params
    }
}
