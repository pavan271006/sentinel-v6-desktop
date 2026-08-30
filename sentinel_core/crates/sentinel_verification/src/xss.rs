//! Cross-Site Scripting (XSS) & Context-Aware Reflection Engine
//!
//! Evaluates injection reflection across HTML contexts:
//! - HTML Body context (<sentinel_tag_uuid>)
//! - HTML Attribute context ("><sentinel_tag> or " onfocus="alert(1)")
//! - JavaScript execution context (';alert(1)// or </script><script>)
//! - URI attribute context (javascript:alert(1))
//! - Asserts unescaped reflection (< and > not entity-encoded as &lt; and &gt;)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum XssContext {
    HtmlBody,
    QuotedAttribute,
    UnquotedAttribute,
    ScriptTag,
    UriAttribute,
    DomTaintSink,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XssProbe {
    pub context: XssContext,
    pub payload: String,
    pub unescaped_marker: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XssVerificationResult {
    pub is_vulnerable: bool,
    pub context: XssContext,
    pub confidence: f32,
    pub unescaped_reflection: String,
    pub description: String,
}

pub struct XssEngine;

impl XssEngine {
    /// Generates context-aware XSS canary probes
    pub fn generate_canary_probes(canary_seed: &str) -> Vec<XssProbe> {
        let tag_marker = format!("<sentinel-xss-{}>", canary_seed);
        let attr_breakout = format!("\" onfocus=\"sentinel_{}()\" autofocus=\"", canary_seed);
        let script_breakout = format!("';sentinel_{}();//", canary_seed);
        let js_uri = format!("javascript:sentinel_{}()", canary_seed);

        vec![
            XssProbe {
                context: XssContext::HtmlBody,
                payload: tag_marker.clone(),
                unescaped_marker: tag_marker,
            },
            XssProbe {
                context: XssContext::QuotedAttribute,
                payload: attr_breakout.clone(),
                unescaped_marker: attr_breakout,
            },
            XssProbe {
                context: XssContext::ScriptTag,
                payload: script_breakout.clone(),
                unescaped_marker: script_breakout,
            },
            XssProbe {
                context: XssContext::UriAttribute,
                payload: js_uri.clone(),
                unescaped_marker: js_uri,
            },
        ]
    }

    /// Evaluates if response reflects unescaped executable HTML/JS tokens
    pub fn evaluate_response(
        probe: &XssProbe,
        response_body: &str,
    ) -> Option<XssVerificationResult> {
        // Must contain unescaped marker (not entity encoded like &lt; or &quot;)
        if response_body.contains(&probe.unescaped_marker) {
            return Some(XssVerificationResult {
                is_vulnerable: true,
                context: probe.context.clone(),
                confidence: 0.98,
                unescaped_reflection: probe.unescaped_marker.clone(),
                description: format!(
                    "Cross-Site Scripting (XSS) Confirmed in {:?} Context: Reflected executable payload without entity escaping.",
                    probe.context
                ),
            });
        }
        None
    }
}
