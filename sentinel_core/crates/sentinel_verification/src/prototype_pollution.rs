//! Prototype Pollution Engine (Server-side & Client-side DOM)
//!
//! Evaluates JavaScript prototype pollution vectors:
//! - Server-Side: Node.js/Express JSON bodies (`__proto__`, `constructor.prototype`)
//! - Non-destructive canary property injection and unmutated endpoint reflection check
//! - Client-Side: URL query parameter prototype pollution (`?__proto__[polluted]=1`)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PollutionScope {
    ServerSideNodeJs,
    ClientSideBrowserDom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrototypePollutionProbe {
    pub scope: PollutionScope,
    pub payload_json: String,
    pub query_param: String,
    pub canary_property: String,
    pub canary_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrototypePollutionResult {
    pub is_vulnerable: bool,
    pub scope: PollutionScope,
    pub confidence: f32,
    pub polluted_property: String,
    pub description: String,
}

pub struct PrototypePollutionEngine;

impl PrototypePollutionEngine {
    /// Generates prototype pollution canary probes
    pub fn generate_canary_probes(canary_seed: &str) -> Vec<PrototypePollutionProbe> {
        let prop = format!("sentinel_polluted_{}", canary_seed);
        let val = format!("sentinel_val_{}", canary_seed);

        vec![
            // 1. JSON __proto__ injection
            PrototypePollutionProbe {
                scope: PollutionScope::ServerSideNodeJs,
                payload_json: format!("{{\"__proto__\": {{\"{}\": \"{}\"}}}}", prop, val),
                query_param: format!("__proto__[{}荣耀]={}", prop, val),
                canary_property: prop.clone(),
                canary_value: val.clone(),
            },
            // 2. JSON constructor.prototype injection
            PrototypePollutionProbe {
                scope: PollutionScope::ServerSideNodeJs,
                payload_json: format!("{{\"constructor\": {{\"prototype\": {{\"{}\": \"{}\"}}}}}}", prop, val),
                query_param: format!("constructor.prototype[{}]={}", prop, val),
                canary_property: prop.clone(),
                canary_value: val.clone(),
            },
            // 3. Client-side URL query param
            PrototypePollutionProbe {
                scope: PollutionScope::ClientSideBrowserDom,
                payload_json: "".to_string(),
                query_param: format!("?__proto__[{}荣耀]={}", prop, val),
                canary_property: prop,
                canary_value: val,
            },
        ]
    }

    /// Evaluates server-side prototype pollution by checking if subsequent unpolluted endpoint reflects property
    pub fn evaluate_server_reflection(
        canary_property: &str,
        canary_value: &str,
        unmutated_endpoint_body: &str,
    ) -> Option<PrototypePollutionResult> {
        if unmutated_endpoint_body.contains(canary_property)
            && unmutated_endpoint_body.contains(canary_value)
        {
            return Some(PrototypePollutionResult {
                is_vulnerable: true,
                scope: PollutionScope::ServerSideNodeJs,
                confidence: 0.98,
                polluted_property: canary_property.to_string(),
                description: format!(
                    "Server-Side Prototype Pollution Confirmed: Injected property '{}' with value '{}' was reflected globally on an independent unmutated endpoint.",
                    canary_property, canary_value
                ),
            });
        }
        None
    }

    /// Evaluates client-side DOM prototype pollution evaluated in browser JS runtime
    pub fn evaluate_dom_pollution(
        canary_property: &str,
        has_own_property_in_object_proto: bool,
    ) -> Option<PrototypePollutionResult> {
        if has_own_property_in_object_proto {
            return Some(PrototypePollutionResult {
                is_vulnerable: true,
                scope: PollutionScope::ClientSideBrowserDom,
                confidence: 0.99,
                polluted_property: canary_property.to_string(),
                description: format!(
                    "Client-Side DOM Prototype Pollution Confirmed: Object.prototype.hasOwnProperty('{}') evaluated to true in browser context.",
                    canary_property
                ),
            });
        }
        None
    }
}
