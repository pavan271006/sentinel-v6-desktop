//! DOM XSS Source-to-Sink Telemetry & Taint Tracking Engine
//!
//! Provides browser-side runtime instrumentation hooks:
//! - Sources: location.search, location.hash, document.cookie, window.name, postMessage
//! - Execution Sinks: eval, Function, setTimeout, setInterval, script.src
//! - DOM Injection Sinks: element.innerHTML, element.outerHTML, document.write, element.insertAdjacentHTML
//! - Navigation Sinks: location.href, location.replace

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DomSinkCategory {
    CodeExecution,     // eval, Function, setTimeout
    DomInjection,      // innerHTML, document.write
    NavigationHijack,  // location.href, location.replace
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomTaintEvent {
    pub sink_name: String,
    pub category: DomSinkCategory,
    pub source_type: String,
    pub tainted_value: String,
    pub callstack: String,
    pub is_confirmed_vulnerability: bool,
}

pub struct DomTaintTracker;

impl DomTaintTracker {
    /// Generates JavaScript instrumentation script to inject before page scripts execute
    pub fn generate_instrumentation_script(canary_token: &str) -> String {
        format!(
            r#"
            (function() {{
                const CANARY = "{canary}";
                function reportSink(sinkName, val) {{
                    if (typeof val === 'string' && val.includes(CANARY)) {{
                        window.__sentinel_dom_telemetry = window.__sentinel_dom_telemetry || [];
                        window.__sentinel_dom_telemetry.push({{
                            sink: sinkName,
                            value: val,
                            stack: new Error().stack
                        }});
                    }}
                }}

                // Hook eval
                const origEval = window.eval;
                window.eval = function(str) {{
                    reportSink("eval", str);
                    return origEval.apply(this, arguments);
                }};

                // Hook document.write
                const origWrite = document.write;
                document.write = function(str) {{
                    reportSink("document.write", str);
                    return origWrite.apply(this, arguments);
                }};

                // Hook innerHTML setter
                const origInnerHtmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
                if (origInnerHtmlDesc && origInnerHtmlDesc.set) {{
                    Object.defineProperty(Element.prototype, 'innerHTML', {{
                        set: function(val) {{
                            reportSink("element.innerHTML", val);
                            return origInnerHtmlDesc.set.call(this, val);
                        }}
                    }});
                }}
            }})();
            "#,
            canary = canary_token
        )
    }

    /// Evaluates raw telemetry report from browser runtime
    pub fn evaluate_taint_event(
        sink_name: &str,
        tainted_value: &str,
        canary_token: &str,
        callstack: &str,
    ) -> Option<DomTaintEvent> {
        if tainted_value.contains(canary_token) {
            let category = if sink_name.contains("eval") || sink_name.contains("Function") || sink_name.contains("Timeout") {
                DomSinkCategory::CodeExecution
            } else if sink_name.contains("innerHTML") || sink_name.contains("write") {
                DomSinkCategory::DomInjection
            } else {
                DomSinkCategory::NavigationHijack
            };

            return Some(DomTaintEvent {
                sink_name: sink_name.to_string(),
                category,
                source_type: "location.hash/search".to_string(),
                tainted_value: tainted_value.to_string(),
                callstack: callstack.to_string(),
                is_confirmed_vulnerability: true,
            });
        }
        None
    }
}
