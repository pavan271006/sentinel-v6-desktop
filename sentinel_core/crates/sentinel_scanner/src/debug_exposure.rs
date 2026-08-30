//! Debug Interface & Framework Exposure Engine
//!
//! Probes for dangerous debug endpoints and framework consoles:
//! - Spring Boot Actuator (/actuator/env, /actuator/heapdump, /actuator/health)
//! - Symfony / Django / Laravel Profilers (/_profiler/, /__debug__/, /telescope)
//! - API documentation leaks (/v2/api-docs, /swagger.json, /openapi.json)
//! - GraphQL schema introspection endpoints
//! - Uses Content-Type and payload AST signatures to eliminate Single-Page-App (SPA) soft-404 false positives.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposedInterfaceType {
    SpringBootActuatorEnv,
    SpringBootActuatorHeapdump,
    SymfonyProfiler,
    DjangoDebugToolbar,
    PhpInfo,
    SwaggerApiDocs,
    GraphqlIntrospection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DebugProbeTarget {
    pub path: &'static str,
    pub expected_content_types: &'static [&'static str],
    pub body_keywords: &'static [&'static str],
    pub interface_type: ExposedInterfaceType,
    pub title: &'static str,
    pub severity: &'static str,
}

pub const DEBUG_PROBES: &[DebugProbeTarget] = &[
    DebugProbeTarget {
        path: "/actuator/env",
        expected_content_types: &["application/json", "application/vnd.spring-boot.actuator"],
        body_keywords: &["propertySources", "activeProfiles"],
        interface_type: ExposedInterfaceType::SpringBootActuatorEnv,
        title: "Spring Boot Actuator /env Exposure",
        severity: "HIGH",
    },
    DebugProbeTarget {
        path: "/actuator/heapdump",
        expected_content_types: &["application/octet-stream", "application/x-java-heap-dump"],
        body_keywords: &["JAVA PROFILE", "HPROF"],
        interface_type: ExposedInterfaceType::SpringBootActuatorHeapdump,
        title: "Spring Boot Actuator /heapdump Exposure",
        severity: "CRITICAL",
    },
    DebugProbeTarget {
        path: "/_profiler/empty/search/results",
        expected_content_types: &["text/html"],
        body_keywords: &["Symfony Profiler", "sf-toolbar"],
        interface_type: ExposedInterfaceType::SymfonyProfiler,
        title: "Symfony Web Profiler Exposure",
        severity: "HIGH",
    },
    DebugProbeTarget {
        path: "/__debug__/render_panel/",
        expected_content_types: &["text/html", "application/json"],
        body_keywords: &["djdt", "djDebug"],
        interface_type: ExposedInterfaceType::DjangoDebugToolbar,
        title: "Django Debug Toolbar Exposure",
        severity: "HIGH",
    },
    DebugProbeTarget {
        path: "/phpinfo.php",
        expected_content_types: &["text/html"],
        body_keywords: &["PHP Version", "Configuration File (php.ini) Path"],
        interface_type: ExposedInterfaceType::PhpInfo,
        title: "PHP Info Diagnostic Exposure",
        severity: "MEDIUM",
    },
    DebugProbeTarget {
        path: "/v2/api-docs",
        expected_content_types: &["application/json"],
        body_keywords: &["swagger", "paths", "definitions"],
        interface_type: ExposedInterfaceType::SwaggerApiDocs,
        title: "Swagger / OpenAPI Specification Exposure",
        severity: "LOW",
    },
    DebugProbeTarget {
        path: "/graphql",
        expected_content_types: &["application/json"],
        body_keywords: &["__schema", "queryType"],
        interface_type: ExposedInterfaceType::GraphqlIntrospection,
        title: "GraphQL Introspection Enabled",
        severity: "LOW",
    },
];

pub struct DebugExposureAnalyzer;

impl DebugExposureAnalyzer {
    /// Returns the list of standard debug paths to probe
    pub fn get_probe_targets() -> &'static [DebugProbeTarget] {
        DEBUG_PROBES
    }

    /// Evaluates response for a debug probe, ensuring true positive and rejecting SPA soft-404s
    pub fn evaluate_response(
        target: &DebugProbeTarget,
        status: u16,
        content_type: Option<&str>,
        body: &str,
    ) -> bool {
        // Must return 200 OK
        if status != 200 {
            return false;
        }

        // Must match expected Content-Type
        if let Some(ct) = content_type {
            let ct_lower = ct.to_ascii_lowercase();
            let ct_match = target
                .expected_content_types
                .iter()
                .any(|&expected| ct_lower.contains(expected));
            if !ct_match {
                return false;
            }
        } else {
            return false;
        }

        // SPA soft-404 filter: if body is HTML containing "<div id=\"root\">" or "<div id=\"app\">"
        // but target expects JSON, reject it
        if target.expected_content_types.contains(&"application/json") {
            if body.trim().starts_with("<!DOCTYPE") || body.trim().starts_with("<html") {
                return false;
            }
            // Must be valid JSON
            if serde_json::from_str::<serde_json::Value>(body).is_err() {
                return false;
            }
        }

        // Must match all required body keywords
        target
            .body_keywords
            .iter()
            .all(|&keyword| body.contains(keyword))
    }
}
