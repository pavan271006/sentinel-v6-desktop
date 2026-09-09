//! SENTINEL Autonomous SQL Security Engine — Application State Graph (M06)
//!
//! Models reachable application states, route transitions, prerequisites,
//! and multi-identity access models.

use std::collections::{HashMap, HashSet};
use chrono::Utc;
use regex::Regex;
use crate::sql::models::{AppStateNode, Blake3Id, TargetIdentity};
use crate::sql::normalizer::NormalizedRequest;

#[derive(Debug, Clone)]
pub struct StateTransition {
    pub from_state: Blake3Id,
    pub to_state: Blake3Id,
    pub trigger_method: String,
    pub trigger_action: String,
}

pub struct ApplicationStateGraph {
    pub nodes: HashMap<Blake3Id, AppStateNode>,
    pub transitions: Vec<StateTransition>,
    pub visited_states: HashSet<Blake3Id>,
    pub unvisited_queue: Vec<Blake3Id>,
}

impl ApplicationStateGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            transitions: Vec::new(),
            visited_states: HashSet::new(),
            unvisited_queue: Vec::new(),
        }
    }

    /// Registers the seed request as the root application state
    pub fn add_seed_request(&mut self, req: &NormalizedRequest, identity: TargetIdentity) -> Blake3Id {
        let node = AppStateNode {
            id: req.id,
            endpoint_url: req.canonical_uri.clone(),
            http_method: req.method.clone(),
            required_identity: identity,
            discovered_at: Utc::now(),
            is_seed: true,
            response_status: 0,
            content_type: req.content_type.clone().unwrap_or_default(),
        };

        let id = node.id;
        self.nodes.insert(id, node);
        self.unvisited_queue.push(id);
        id
    }

    /// Discovers linked routes, forms, and API endpoints from an HTTP response body
    pub fn extract_reachable_states(
        &mut self,
        source_id: Blake3Id,
        base_url: &str,
        response_body: &str,
        identity: TargetIdentity,
    ) -> Vec<Blake3Id> {
        let mut discovered = Vec::new();
        let base = match url::Url::parse(base_url) {
            Ok(u) => u,
            Err(_) => return discovered,
        };

        // 1. Extract HTML <a href="..."> links
        let link_re = Regex::new(r#"href\s*=\s*["']([^"'>]+)["']"#).unwrap();
        for cap in link_re.captures_iter(response_body) {
            let rel = &cap[1];
            if !rel.starts_with("javascript:") && !rel.starts_with('#') {
                if let Ok(joined) = base.join(rel) {
                    if joined.host_str() == base.host_str() {
                        let id = self.register_endpoint(joined.as_str(), "GET", identity.clone(), false);
                        self.transitions.push(StateTransition {
                            from_state: source_id,
                            to_state: id,
                            trigger_method: "GET".to_string(),
                            trigger_action: format!("Link click: {}", rel),
                        });
                        discovered.push(id);
                    }
                }
            }
        }

        // 2. Extract HTML <form action="..." method="...">
        let form_re = Regex::new(r#"<form[^>]*action\s*=\s*["']([^"'>]+)["'][^>]*method\s*=\s*["']([^"'>]+)["']"#).unwrap();
        for cap in form_re.captures_iter(response_body) {
            let rel = &cap[1];
            let method = cap[2].to_uppercase();
            if let Ok(joined) = base.join(rel) {
                if joined.host_str() == base.host_str() {
                    let id = self.register_endpoint(joined.as_str(), &method, identity.clone(), false);
                    self.transitions.push(StateTransition {
                        from_state: source_id,
                        to_state: id,
                        trigger_method: method,
                        trigger_action: format!("Form submit: {}", rel),
                    });
                    discovered.push(id);
                }
            }
        }

        // 3. Extract JSON API endpoints (e.g. "/api/v1/...")
        let api_re = Regex::new(r#"["'](/(?:api|v[0-9]+|graphql|rest)/[^"']+)["']"#).unwrap();
        for cap in api_re.captures_iter(response_body) {
            let api_path = &cap[1];
            if let Ok(joined) = base.join(api_path) {
                if joined.host_str() == base.host_str() {
                    let id = self.register_endpoint(joined.as_str(), "GET", identity.clone(), false);
                    discovered.push(id);
                }
            }
        }

        discovered
    }

    fn register_endpoint(&mut self, url_str: &str, method: &str, identity: TargetIdentity, is_seed: bool) -> Blake3Id {
        let mut id_bytes = Vec::new();
        id_bytes.extend_from_slice(method.as_bytes());
        id_bytes.push(b' ');
        id_bytes.extend_from_slice(url_str.as_bytes());
        let id = Blake3Id::new(&id_bytes);

        if !self.nodes.contains_key(&id) {
            let node = AppStateNode {
                id,
                endpoint_url: url_str.to_string(),
                http_method: method.to_string(),
                required_identity: identity,
                discovered_at: Utc::now(),
                is_seed,
                response_status: 0,
                content_type: String::new(),
            };
            self.nodes.insert(id, node);
            self.unvisited_queue.push(id);
        }

        id
    }
}
