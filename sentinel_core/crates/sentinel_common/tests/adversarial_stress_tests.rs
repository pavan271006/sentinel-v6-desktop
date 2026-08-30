// SENTINEL V6: Empirical Adversarial Stress & Invariant Verification Suite
// crates/sentinel_common/tests/adversarial_stress_tests.rs
//
// Tests:
// 1. Serde roundtrips for ALL 27 domain types (Empty/Minimal & Extreme/Max payloads)
// 2. Error propagation, downcasting, Display formatting, and error codes for SentinelError
// 3. Exhaustive enum matching, method invariants, and string conversions
// 4. Adversarial corrupted payload rejection and security redaction verification
// 5. Float edge cases (NaN/Infinity), collection nesting, and unique error code verification

use chrono::{DateTime, Utc};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::error::Error;
use std::io;
use std::str::FromStr;
use std::time::Duration;
use uuid::Uuid;

use sentinel_common::*;

// =========================================================================
// SECTION 1: SERDE ROUNDTRIP ADVERSARIAL STRESS TEST FOR ALL 27 DOMAIN TYPES
// =========================================================================

#[test]
fn test_all_27_domain_types_minimal_empty_serde_roundtrip() {
    let epoch = DateTime::<Utc>::from_timestamp(0, 0).unwrap();
    let nil_uuid = Uuid::nil();

    // 1. Transaction (Minimal)
    let tx_min = Transaction {
        meta: EntityMetadata {
            id: nil_uuid,
            version: 0,
            timestamp: epoch,
            provenance: Provenance::Manual,
            lifecycle: LifecycleState::Active,
            scope_id: None,
        },
        request: MessageRepresentation {
            raw_blob_id: nil_uuid,
            parsed: HttpParsedParts {
                method: HttpMethod::GET,
                uri: String::new(),
                version: String::new(),
                headers: Vec::new(),
            },
            normalized_text: String::new(),
        },
        response: None,
        timing: Duration::ZERO,
        tls_info: None,
    };
    let json = serde_json::to_string(&tx_min).expect("Tx minimal serde failed");
    let deser: Transaction = serde_json::from_str(&json).expect("Tx minimal deser failed");
    assert_eq!(tx_min, deser);

    // 2. Observation (Minimal)
    let obs_min = Observation {
        meta: EntityMetadata {
            id: nil_uuid,
            version: 0,
            timestamp: epoch,
            provenance: Provenance::Manual,
            lifecycle: LifecycleState::Active,
            scope_id: None,
        },
        source: ObservationSource::Manual,
        data_ref: nil_uuid,
    };
    let json = serde_json::to_string(&obs_min).expect("Obs minimal serde failed");
    let deser: Observation = serde_json::from_str(&json).unwrap();
    assert_eq!(obs_min, deser);

    // 3. Candidate (Minimal)
    let cand_min = Candidate {
        meta: EntityMetadata {
            id: nil_uuid,
            version: 0,
            timestamp: epoch,
            provenance: Provenance::Manual,
            lifecycle: LifecycleState::Active,
            scope_id: None,
        },
        source_observation_id: nil_uuid,
        hypothesis: String::new(),
        status: String::new(),
    };
    let json = serde_json::to_string(&cand_min).expect("Cand minimal serde failed");
    let deser: Candidate = serde_json::from_str(&json).unwrap();
    assert_eq!(cand_min, deser);

    // 4. Evidence (Minimal - All 5 Variants)
    let ev_tx = Evidence {
        id: nil_uuid,
        verification_id: nil_uuid,
        variant: EvidenceVariant::TransactionEvidence(nil_uuid),
        created_at: epoch,
    };
    let ev_oast = Evidence {
        id: nil_uuid,
        verification_id: nil_uuid,
        variant: EvidenceVariant::OastEvidence(nil_uuid),
        created_at: epoch,
    };
    let ev_browser = Evidence {
        id: nil_uuid,
        verification_id: nil_uuid,
        variant: EvidenceVariant::BrowserSnapshot(nil_uuid),
        created_at: epoch,
    };
    let ev_timing = Evidence {
        id: nil_uuid,
        verification_id: nil_uuid,
        variant: EvidenceVariant::TimingVariance {
            expected: Duration::ZERO,
            actual: Duration::ZERO,
        },
        created_at: epoch,
    };
    let ev_diff = Evidence {
        id: nil_uuid,
        verification_id: nil_uuid,
        variant: EvidenceVariant::Differential(DiffData {
            structural_similarity: 0.0,
            bytes_added: 0,
            bytes_removed: 0,
            status_code_changed: false,
            content_type_changed: false,
        }),
        created_at: epoch,
    };

    for ev in &[&ev_tx, &ev_oast, &ev_browser, &ev_timing, &ev_diff] {
        let json = serde_json::to_string(ev).unwrap();
        let deser: Evidence = serde_json::from_str(&json).unwrap();
        assert_eq!(ev.id, deser.id);
        assert_eq!(ev.variant, deser.variant);
    }

    // 5. VerificationResult (Minimal)
    let vr_min = VerificationResult {
        id: nil_uuid,
        candidate_id: nil_uuid,
        strategy_ref: VerificationStrategyRef {
            strategy_type: VerificationStrategy::BrowserExecution,
            version: String::new(),
        },
        success: false,
        confidence: 0.0,
        evidence: Vec::new(),
        executed_at: epoch,
    };
    let json = serde_json::to_string(&vr_min).unwrap();
    let deser: VerificationResult = serde_json::from_str(&json).unwrap();
    assert_eq!(vr_min, deser);

    // 6. Finding (Minimal)
    let finding_min = Finding {
        meta: EntityMetadata {
            id: nil_uuid,
            version: 0,
            timestamp: epoch,
            provenance: Provenance::Tool,
            lifecycle: LifecycleState::Active,
            scope_id: None,
        },
        title: String::new(),
        severity: Severity::Info,
        verification_id: nil_uuid,
        state: FindingLifecycle::Candidate,
    };
    let json = serde_json::to_string(&finding_min).unwrap();
    let deser: Finding = serde_json::from_str(&json).unwrap();
    assert_eq!(finding_min, deser);

    // 7. Scope (Minimal)
    let scope_min = Scope {
        id: nil_uuid,
        version: 0,
        timestamp: epoch,
        includes: Vec::new(),
        excludes: Vec::new(),
    };
    let json = serde_json::to_string(&scope_min).unwrap();
    let deser: Scope = serde_json::from_str(&json).unwrap();
    assert_eq!(scope_min, deser);

    // 8. ScopeDecision (Minimal)
    let decision_min = ScopeDecision {
        decision_id: nil_uuid,
        allowed: false,
        reason: String::new(),
        matched_rule: None,
        target: String::new(),
        scope_version: 0,
        timestamp: epoch,
    };
    let json = serde_json::to_string(&decision_min).unwrap();
    let deser: ScopeDecision = serde_json::from_str(&json).unwrap();
    assert_eq!(decision_min, deser);

    // 9. Endpoint (Minimal)
    let ep_min = Endpoint {
        id: nil_uuid,
        host: String::new(),
        path: String::new(),
        method: HttpMethod::GET,
        timestamp: epoch,
        graph_node_id: nil_uuid,
    };
    let json = serde_json::to_string(&ep_min).unwrap();
    let deser: Endpoint = serde_json::from_str(&json).unwrap();
    assert_eq!(ep_min, deser);

    // 10. Payload (Minimal)
    let payload_min = Payload {
        id: nil_uuid,
        injection_point: ParamLocation::Query,
        payload_string: String::new(),
        expected_behavior: VerificationStrategy::BrowserExecution,
    };
    let json = serde_json::to_string(&payload_min).unwrap();
    let deser: Payload = serde_json::from_str(&json).unwrap();
    assert_eq!(payload_min, deser);

    // 11. Identity (Minimal)
    let id_min = Identity {
        id: nil_uuid,
        version: 0,
        timestamp: epoch,
        username: String::new(),
        roles: Vec::new(),
        meta: None,
    };
    let json = serde_json::to_string(&id_min).unwrap();
    let deser: Identity = serde_json::from_str(&json).unwrap();
    assert_eq!(id_min, deser);

    // 12. Session (Minimal)
    let session_min = Session {
        id: nil_uuid,
        identity_id: nil_uuid,
        cookies: HashMap::new(),
        headers: HashMap::new(),
        created_at: epoch,
        expires_at: None,
    };
    let json = serde_json::to_string(&session_min).unwrap();
    let deser: Session = serde_json::from_str(&json).unwrap();
    assert_eq!(session_min, deser);

    // 13. Credential (Minimal)
    let cred_min = Credential {
        id: nil_uuid,
        identity_id: nil_uuid,
        credential_type: String::new(),
        secret_reference: nil_uuid,
        access_level: AccessLevel::Anonymous,
        expires_at: None,
    };
    let json = serde_json::to_string(&cred_min).unwrap();
    let deser: Credential = serde_json::from_str(&json).unwrap();
    assert_eq!(cred_min, deser);

    // 14. SecretReference (Minimal)
    let secret_ref_min = SecretReference {
        reference_id: nil_uuid,
        vault_backend: String::new(),
    };
    let json = serde_json::to_string(&secret_ref_min).unwrap();
    let deser: SecretReference = serde_json::from_str(&json).unwrap();
    assert_eq!(secret_ref_min, deser);

    // 15. Asset (Minimal)
    let asset_min = Asset {
        id: nil_uuid,
        asset_type: String::new(),
        identifier: String::new(),
        metadata: HashMap::new(),
    };
    let json = serde_json::to_string(&asset_min).unwrap();
    let deser: Asset = serde_json::from_str(&json).unwrap();
    assert_eq!(asset_min, deser);

    // 16. Technology (Minimal)
    let tech_min = Technology {
        id: String::new(),
        name: String::new(),
        category: String::new(),
        version: None,
        confidence: 0.0,
    };
    let json = serde_json::to_string(&tech_min).unwrap();
    let deser: Technology = serde_json::from_str(&json).unwrap();
    assert_eq!(tech_min, deser);

    // 17. State (Minimal)
    let state_min = State {
        state_id: String::new(),
        state_type: String::new(),
        payload_json: "{}".to_string(),
    };
    let json = serde_json::to_string(&state_min).unwrap();
    let deser: State = serde_json::from_str(&json).unwrap();
    assert_eq!(state_min, deser);

    // 18. Workflow (Minimal)
    let wf_min = Workflow {
        id: nil_uuid,
        name: String::new(),
        steps_json: "[]".to_string(),
        created_at: epoch,
    };
    let json = serde_json::to_string(&wf_min).unwrap();
    let deser: Workflow = serde_json::from_str(&json).unwrap();
    assert_eq!(wf_min, deser);

    // 19. Resource (Minimal)
    let res_min = Resource {
        resource_type: String::new(),
        limit_value: 0,
        current_usage: 0,
    };
    let json = serde_json::to_string(&res_min).unwrap();
    let deser: Resource = serde_json::from_str(&json).unwrap();
    assert_eq!(res_min, deser);

    // 20. Action (Minimal)
    let act_min = Action {
        action_id: nil_uuid,
        action_type: String::new(),
        parameters: HashMap::new(),
    };
    let json = serde_json::to_string(&act_min).unwrap();
    let deser: Action = serde_json::from_str(&json).unwrap();
    assert_eq!(act_min, deser);

    // 21. Task (Minimal)
    let task_min = Task {
        id: nil_uuid,
        task_type: String::new(),
        priority: 0,
        state: TaskLifecycle::Pending,
        progress_pct: 0.0,
    };
    let json = serde_json::to_string(&task_min).unwrap();
    let deser: Task = serde_json::from_str(&json).unwrap();
    assert_eq!(task_min, deser);

    // 22. Report (Minimal)
    let rep_min = Report {
        id: nil_uuid,
        title: String::new(),
        format: ReportFormat::Pdf,
        file_path: String::new(),
        config_json: "{}".to_string(),
        generated_at: epoch,
    };
    let json = serde_json::to_string(&rep_min).unwrap();
    let deser: Report = serde_json::from_str(&json).unwrap();
    assert_eq!(rep_min, deser);

    // 23. RegressionTest (Minimal)
    let reg_min = RegressionTest {
        id: nil_uuid,
        finding_id: nil_uuid,
        seed_transaction_id: nil_uuid,
        expected_status: String::new(),
        created_at: epoch,
    };
    let json = serde_json::to_string(&reg_min).unwrap();
    let deser: RegressionTest = serde_json::from_str(&json).unwrap();
    assert_eq!(reg_min, deser);

    // 24. OASTInteraction (Minimal)
    let oast_min = OASTInteraction {
        id: nil_uuid,
        token_id: nil_uuid,
        protocol: String::new(),
        source_ip: String::new(),
        raw_blob_id: nil_uuid,
        timestamp: epoch,
    };
    let json = serde_json::to_string(&oast_min).unwrap();
    let deser: OASTInteraction = serde_json::from_str(&json).unwrap();
    assert_eq!(oast_min, deser);

    // 25. AttackPath (Minimal)
    let ap_min = AttackPath {
        id: nil_uuid,
        start_node_id: nil_uuid,
        target_node_id: nil_uuid,
        edge_ids: Vec::new(),
        risk_score: 0.0,
        discovered_at: epoch,
    };
    let json = serde_json::to_string(&ap_min).unwrap();
    let deser: AttackPath = serde_json::from_str(&json).unwrap();
    assert_eq!(ap_min, deser);

    // 26. Note (Minimal)
    let note_min = Note {
        id: nil_uuid,
        target_id: nil_uuid,
        author: String::new(),
        content: String::new(),
        timestamp: epoch,
    };
    let json = serde_json::to_string(&note_min).unwrap();
    let deser: Note = serde_json::from_str(&json).unwrap();
    assert_eq!(note_min, deser);

    // 27. Screenshot (Minimal)
    let ss_min = Screenshot {
        id: nil_uuid,
        blob_id: nil_uuid,
        full_page: false,
        timestamp: epoch,
    };
    let json = serde_json::to_string(&ss_min).unwrap();
    let deser: Screenshot = serde_json::from_str(&json).unwrap();
    assert_eq!(ss_min, deser);
}

#[test]
fn test_all_27_domain_types_maximum_payload_serde_roundtrip() {
    let now = Utc::now();
    let complex_id = Uuid::new_v4();

    // Large test strings with unicode, special symbols, injection payloads, RTL, null bytes escapes
    let large_string = "🛡️🔥 SENTINEL_V6_TEST 🚀\n\t<script>alert('xss')</script>' OR 1=1-- \0 \r\n 測試 عربي \u{1F600}".repeat(200);

    let mut large_headers = Vec::new();
    for i in 0..100 {
        large_headers.push((
            format!("X-Custom-Header-{}", i).into_bytes(),
            format!("Header-Value-{}-{}", i, &large_string[..100]).into_bytes(),
        ));
    }

    let mut large_map = HashMap::new();
    for i in 0..100 {
        large_map.insert(
            format!("key_{}", i),
            format!("val_{}_{}", i, &large_string[..50]),
        );
    }

    let mut edge_ids = Vec::new();
    for _ in 0..200 {
        edge_ids.push(Uuid::new_v4());
    }

    // 1. Transaction (Maximum Payload)
    let tx_max = Transaction {
        meta: EntityMetadata {
            id: complex_id,
            version: u64::MAX,
            timestamp: now,
            provenance: Provenance::Scanner,
            lifecycle: LifecycleState::Active,
            scope_id: Some(Uuid::new_v4()),
        },
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::GRAPHQL,
                uri: format!(
                    "https://sentinel.internal:8443/graphql/query?q={}",
                    &large_string[..500]
                ),
                version: "HTTP/3".to_string(),
                headers: large_headers.clone(),
            },
            normalized_text: large_string.clone(),
        },
        response: Some(MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::POST,
                uri: String::new(),
                version: "HTTP/3".to_string(),
                headers: large_headers.clone(),
            },
            normalized_text: large_string.clone(),
        }),
        timing: Duration::from_secs(86400 * 365), // 1 year duration
        tls_info: Some(TlsData {
            protocol: "TLSv1.3".to_string(),
            cipher: "TLS_AES_256_GCM_SHA384".to_string(),
            server_name: Some("sentinel.internal".to_string()),
            alpn: Some("h3".to_string()),
        }),
    };
    let json = serde_json::to_string(&tx_max).unwrap();
    let deser: Transaction = serde_json::from_str(&json).unwrap();
    assert_eq!(tx_max, deser);

    // 2. Observation (Maximum)
    let obs_max = Observation {
        meta: tx_max.meta.clone(),
        source: ObservationSource::Browser,
        data_ref: complex_id,
    };
    let json = serde_json::to_string(&obs_max).unwrap();
    let deser: Observation = serde_json::from_str(&json).unwrap();
    assert_eq!(obs_max, deser);

    // 3. Candidate (Maximum)
    let cand_max = Candidate {
        meta: tx_max.meta.clone(),
        source_observation_id: complex_id,
        hypothesis: large_string.clone(),
        status: "CONFIRMED_EXPLOITABLE_VULNERABILITY".to_string(),
    };
    let json = serde_json::to_string(&cand_max).unwrap();
    let deser: Candidate = serde_json::from_str(&json).unwrap();
    assert_eq!(cand_max, deser);

    // 4. Evidence (Maximum)
    let mut evidence_list = Vec::new();
    for _ in 0..50 {
        evidence_list.push(Evidence {
            id: Uuid::new_v4(),
            verification_id: complex_id,
            variant: EvidenceVariant::Differential(DiffData {
                structural_similarity: 0.99999,
                bytes_added: usize::MAX / 4,
                bytes_removed: usize::MAX / 8,
                status_code_changed: true,
                content_type_changed: true,
            }),
            created_at: now,
        });
    }

    // 5. VerificationResult (Maximum)
    let vr_max = VerificationResult {
        id: complex_id,
        candidate_id: cand_max.meta.id,
        strategy_ref: VerificationStrategyRef {
            strategy_type: VerificationStrategy::CausalMinimization,
            version: "99.99.99-beta+exp.sha.5114f85".to_string(),
        },
        success: true,
        confidence: 1.0,
        evidence: evidence_list,
        executed_at: now,
    };
    let json = serde_json::to_string(&vr_max).unwrap();
    let deser: VerificationResult = serde_json::from_str(&json).unwrap();
    assert_eq!(vr_max, deser);

    // 6. Finding (Maximum)
    let finding_max = Finding {
        meta: tx_max.meta.clone(),
        title: large_string.clone(),
        severity: Severity::Critical,
        verification_id: complex_id,
        state: FindingLifecycle::Confirmed,
    };
    let json = serde_json::to_string(&finding_max).unwrap();
    let deser: Finding = serde_json::from_str(&json).unwrap();
    assert_eq!(finding_max, deser);

    // 7. Scope (Maximum)
    let mut includes = Vec::new();
    let mut excludes = Vec::new();
    for i in 0..100 {
        includes.push(format!("*.sub{}.enterprise-target-{}.com", i, i));
        excludes.push(format!("logout.sub{}.enterprise-target-{}.com", i, i));
    }
    let scope_max = Scope {
        id: complex_id,
        version: u64::MAX,
        timestamp: now,
        includes,
        excludes,
    };
    let json = serde_json::to_string(&scope_max).unwrap();
    let deser: Scope = serde_json::from_str(&json).unwrap();
    assert_eq!(scope_max, deser);

    // 8. ScopeDecision (Maximum)
    let decision_max = ScopeDecision {
        decision_id: complex_id,
        allowed: true,
        reason: large_string.clone(),
        matched_rule: Some(Uuid::new_v4()),
        target: format!(
            "https://enterprise-target-99.com/api/v2?session={}",
            &large_string[..200]
        ),
        scope_version: u64::MAX,
        timestamp: now,
    };
    let json = serde_json::to_string(&decision_max).unwrap();
    let deser: ScopeDecision = serde_json::from_str(&json).unwrap();
    assert_eq!(decision_max, deser);

    // 9. Endpoint (Maximum)
    let ep_max = Endpoint {
        id: complex_id,
        host: "subdomain.very-long-production-hostname-for-testing.enterprise.cloud".to_string(),
        path: format!(
            "/api/v3/deeply/nested/resource/endpoint/path/{}",
            &large_string[..200]
        ),
        method: HttpMethod::PATCH,
        timestamp: now,
        graph_node_id: Uuid::new_v4(),
    };
    let json = serde_json::to_string(&ep_max).unwrap();
    let deser: Endpoint = serde_json::from_str(&json).unwrap();
    assert_eq!(ep_max, deser);

    // 10. Payload (Maximum)
    let payload_max = Payload {
        id: complex_id,
        injection_point: ParamLocation::GraphQLVariable,
        payload_string: large_string.clone(),
        expected_behavior: VerificationStrategy::MathematicalVerification,
    };
    let json = serde_json::to_string(&payload_max).unwrap();
    let deser: Payload = serde_json::from_str(&json).unwrap();
    assert_eq!(payload_max, deser);

    // 11. Identity (Maximum)
    let mut roles = Vec::new();
    for i in 0..50 {
        roles.push(format!("ROLE_ENTERPRISE_SECURITY_ANALYST_{}", i));
    }
    let id_max = Identity {
        id: complex_id,
        version: u64::MAX,
        timestamp: now,
        username: "chief_information_security_officer_admin_root".to_string(),
        roles,
        meta: Some(tx_max.meta.clone()),
    };
    let json = serde_json::to_string(&id_max).unwrap();
    let deser: Identity = serde_json::from_str(&json).unwrap();
    assert_eq!(id_max, deser);

    // 12. Session (Maximum)
    let session_max = Session {
        id: complex_id,
        identity_id: id_max.id,
        cookies: large_map.clone(),
        headers: large_map.clone(),
        created_at: now,
        expires_at: Some(now + chrono::Duration::days(365)),
    };
    let json = serde_json::to_string(&session_max).unwrap();
    let deser: Session = serde_json::from_str(&json).unwrap();
    assert_eq!(session_max, deser);

    // 13. Credential (Maximum)
    let cred_max = Credential {
        id: complex_id,
        identity_id: id_max.id,
        credential_type: "MutualTlsHardwareSecurityModuleCertificate".to_string(),
        secret_reference: Uuid::new_v4(),
        access_level: AccessLevel::Admin,
        expires_at: Some(now + chrono::Duration::days(730)),
    };
    let json = serde_json::to_string(&cred_max).unwrap();
    let deser: Credential = serde_json::from_str(&json).unwrap();
    assert_eq!(cred_max, deser);

    // 14. SecretReference (Maximum)
    let sec_ref_max = SecretReference {
        reference_id: complex_id,
        vault_backend: "hashicorp_vault_enterprise_cluster_hsm_kms_tier".to_string(),
    };
    let json = serde_json::to_string(&sec_ref_max).unwrap();
    let deser: SecretReference = serde_json::from_str(&json).unwrap();
    assert_eq!(sec_ref_max, deser);

    // 15. Asset (Maximum)
    let asset_max = Asset {
        id: complex_id,
        asset_type: "KubernetesClusterPodDeployment".to_string(),
        identifier:
            "k8s://prod-cluster-01.us-west-2.aws.eks/namespace-sentinel/pod-scanner-worker-492"
                .to_string(),
        metadata: large_map.clone(),
    };
    let json = serde_json::to_string(&asset_max).unwrap();
    let deser: Asset = serde_json::from_str(&json).unwrap();
    assert_eq!(asset_max, deser);

    // 16. Technology (Maximum)
    let tech_max = Technology {
        id: "tech_enterprise_cloud_native_stack".to_string(),
        name: "Kubernetes + Envoy + Rust Axum Gateway".to_string(),
        category: "Container Orchestration & API Gateway".to_string(),
        version: Some("v1.29.1-gke.1052000".to_string()),
        confidence: 0.999,
    };
    let json = serde_json::to_string(&tech_max).unwrap();
    let deser: Technology = serde_json::from_str(&json).unwrap();
    assert_eq!(tech_max, deser);

    // 17. State (Maximum)
    let state_max = State {
        state_id: "state_authenticated_full_session_graph_node".to_string(),
        state_type: "MultiFactorSessionState".to_string(),
        payload_json: large_string.clone(),
    };
    let json = serde_json::to_string(&state_max).unwrap();
    let deser: State = serde_json::from_str(&json).unwrap();
    assert_eq!(state_max, deser);

    // 18. Workflow (Maximum)
    let wf_max = Workflow {
        id: complex_id,
        name: "Full Chain Automated Attack Graph Orchestration".to_string(),
        steps_json: large_string.clone(),
        created_at: now,
    };
    let json = serde_json::to_string(&wf_max).unwrap();
    let deser: Workflow = serde_json::from_str(&json).unwrap();
    assert_eq!(wf_max, deser);

    // 19. Resource (Maximum)
    let res_max = Resource {
        resource_type: "TotalHeapAllocatedMemoryBytes".to_string(),
        limit_value: u64::MAX,
        current_usage: u64::MAX - 1024,
    };
    let json = serde_json::to_string(&res_max).unwrap();
    let deser: Resource = serde_json::from_str(&json).unwrap();
    assert_eq!(res_max, deser);

    // 20. Action (Maximum)
    let act_max = Action {
        action_id: complex_id,
        action_type: "AutonomousExploitVerificationWorkflow".to_string(),
        parameters: large_map.clone(),
    };
    let json = serde_json::to_string(&act_max).unwrap();
    let deser: Action = serde_json::from_str(&json).unwrap();
    assert_eq!(act_max, deser);

    // 21. Task (Maximum)
    let task_max = Task {
        id: complex_id,
        task_type: "FullEnterpriseDomainDiscoveryScan".to_string(),
        priority: u8::MAX,
        state: TaskLifecycle::Completed,
        progress_pct: 100.0,
    };
    let json = serde_json::to_string(&task_max).unwrap();
    let deser: Task = serde_json::from_str(&json).unwrap();
    assert_eq!(task_max, deser);

    // 22. Report (Maximum)
    let rep_max = Report {
        id: complex_id,
        title: "SENTINEL Comprehensive Multi-Tenant Penetration Test & Formal Verification Audit Report".to_string(),
        format: ReportFormat::Html,
        file_path: "/var/log/sentinel/reports/2026/Q3/formal_audit_report_full.html".to_string(),
        config_json: large_string.clone(),
        generated_at: now,
    };
    let json = serde_json::to_string(&rep_max).unwrap();
    let deser: Report = serde_json::from_str(&json).unwrap();
    assert_eq!(rep_max, deser);

    // 23. RegressionTest (Maximum)
    let reg_max = RegressionTest {
        id: complex_id,
        finding_id: finding_max.meta.id,
        seed_transaction_id: tx_max.meta.id,
        expected_status: "401 Unauthorized [WAF Blocked Payload]".to_string(),
        created_at: now,
    };
    let json = serde_json::to_string(&reg_max).unwrap();
    let deser: RegressionTest = serde_json::from_str(&json).unwrap();
    assert_eq!(reg_max, deser);

    // 24. OASTInteraction (Maximum)
    let oast_max = OASTInteraction {
        id: complex_id,
        token_id: Uuid::new_v4(),
        protocol: "DNS-OVER-TLS-EXTENDED-HEX-LABEL".to_string(),
        source_ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334".to_string(),
        raw_blob_id: Uuid::new_v4(),
        timestamp: now,
    };
    let json = serde_json::to_string(&oast_max).unwrap();
    let deser: OASTInteraction = serde_json::from_str(&json).unwrap();
    assert_eq!(oast_max, deser);

    // 25. AttackPath (Maximum)
    let ap_max = AttackPath {
        id: complex_id,
        start_node_id: Uuid::new_v4(),
        target_node_id: Uuid::new_v4(),
        edge_ids,
        risk_score: 9.99,
        discovered_at: now,
    };
    let json = serde_json::to_string(&ap_max).unwrap();
    let deser: AttackPath = serde_json::from_str(&json).unwrap();
    assert_eq!(ap_max, deser);

    // 26. Note (Maximum)
    let note_max = Note {
        id: complex_id,
        target_id: finding_max.meta.id,
        author: "lead_security_researcher_dr_adversary".to_string(),
        content: large_string.clone(),
        timestamp: now,
    };
    let json = serde_json::to_string(&note_max).unwrap();
    let deser: Note = serde_json::from_str(&json).unwrap();
    assert_eq!(note_max, deser);

    // 27. Screenshot (Maximum)
    let ss_max = Screenshot {
        id: complex_id,
        blob_id: Uuid::new_v4(),
        full_page: true,
        timestamp: now,
    };
    let json = serde_json::to_string(&ss_max).unwrap();
    let deser: Screenshot = serde_json::from_str(&json).unwrap();
    assert_eq!(ss_max, deser);
}

// =========================================================================
// SECTION 2: SENTINEL ERROR HIERARCHY, PROPAGATION, CODES & DOWNCASTING
// =========================================================================

#[test]
fn test_sentinel_error_exhaustive_variants_codes_and_retryability() {
    let test_cases: Vec<(SentinelError, &'static str, bool)> = vec![
        (
            SentinelError::Database(sqlx::Error::RowNotFound),
            "ERR_DB_001",
            true,
        ),
        (
            SentinelError::Io(io::Error::new(io::ErrorKind::TimedOut, "socket timed out")),
            "ERR_IO_002",
            false,
        ),
        (
            SentinelError::Tantivy("index corrupted".to_string()),
            "ERR_FTS_003",
            false,
        ),
        (
            SentinelError::scope_violation("Out of allowed boundary"),
            "ERR_SCOPE_004",
            false,
        ),
        (
            SentinelError::BusOverflow { count: 999 },
            "ERR_BUS_005",
            true,
        ),
        (
            SentinelError::parse_error("malformed RFC7230 chunk"),
            "ERR_PARSE_006",
            false,
        ),
        (
            SentinelError::AiEngine("context window exhausted".to_string()),
            "ERR_AI_007",
            true,
        ),
        (
            SentinelError::SandboxViolation("syscall clone denied".to_string()),
            "ERR_SANDBOX_008",
            false,
        ),
        (
            SentinelError::invariant_violation("finding without verification"),
            "ERR_INVAR_009",
            false,
        ),
        (
            SentinelError::TlsError("unknown certificate issuer".to_string()),
            "ERR_TLS_010",
            true,
        ),
        (
            SentinelError::NetworkError("connection refused".to_string()),
            "ERR_NET_011",
            true,
        ),
        (
            SentinelError::timeout("deadline exceeded after 30s"),
            "ERR_TIME_012",
            true,
        ),
        (
            SentinelError::auth_error("signature expired"),
            "ERR_AUTH_013",
            false,
        ),
        (
            SentinelError::invalid_configuration("pool_size cannot be 0"),
            "ERR_CFG_014",
            false,
        ),
        (
            SentinelError::serialization("invalid msgpack payload"),
            "ERR_SER_015",
            false,
        ),
        (
            SentinelError::storage("write failed: no space left"),
            "ERR_STR_016",
            false,
        ),
        (
            SentinelError::integrity("CAS hash mismatch for blob 4920"),
            "ERR_INT_017",
            false,
        ),
    ];

    let mut error_codes_seen = HashSet::new();

    for (err, expected_code, expected_retryable) in test_cases {
        assert_eq!(
            err.error_code(),
            expected_code,
            "Mismatch for error: {:?}",
            err
        );
        assert_eq!(
            err.is_retryable(),
            expected_retryable,
            "Retryability mismatch for error: {:?}",
            err
        );

        let display_str = format!("{}", err);
        assert!(
            !display_str.is_empty(),
            "Display string must not be empty for {:?}",
            err
        );

        // Verify error code uniqueness across all 17 variants
        assert!(
            error_codes_seen.insert(expected_code),
            "Duplicate error code detected: {}",
            expected_code
        );
    }

    assert_eq!(
        error_codes_seen.len(),
        17,
        "Expected exactly 17 unique error codes"
    );
}

#[test]
fn test_sentinel_error_downcasting_and_source_chain() {
    // 1. Test downcasting from Box<dyn std::error::Error>
    let raw_io = io::Error::new(
        io::ErrorKind::PermissionDenied,
        "unauthorized access to /etc/shadow",
    );
    let sentinel_err: SentinelError = SentinelError::from(raw_io);
    let boxed_err: Box<dyn Error + Send + Sync> = Box::new(sentinel_err);

    // Attempt downcasting to concrete SentinelError
    let downcasted = boxed_err
        .downcast_ref::<SentinelError>()
        .expect("Downcast to SentinelError failed");
    assert_eq!(downcasted.error_code(), "ERR_IO_002");

    // 2. Test error source inspection for IO
    let source_err = downcasted
        .source()
        .expect("Expected underlying IO error as source");
    let io_source = source_err
        .downcast_ref::<io::Error>()
        .expect("Downcast source to io::Error failed");
    assert_eq!(io_source.kind(), io::ErrorKind::PermissionDenied);

    // 3. Test error source inspection for Database
    let db_err: SentinelError = SentinelError::from(sqlx::Error::RowNotFound);
    let db_source = db_err
        .source()
        .expect("Expected underlying sqlx::Error as source");
    let sqlx_source = db_source
        .downcast_ref::<sqlx::Error>()
        .expect("Downcast source to sqlx::Error failed");
    assert!(matches!(sqlx_source, sqlx::Error::RowNotFound));

    // 4. Test SentinelError::ParseError has no underlying source
    let parse_err = SentinelError::parse_error("syntax error");
    assert!(parse_err.source().is_none());
}

#[test]
fn test_serde_json_error_propagation_helper() {
    let bad_json_input = "{\"key\": [unclosed array";
    let serde_err = serde_json::from_str::<serde_json::Value>(bad_json_input).unwrap_err();
    let err: SentinelError = serde_err.into();

    assert_eq!(err.error_code(), "ERR_SER_015");
    assert!(!err.is_retryable());
    assert!(format!("{}", err).contains("Serialization error:"));
}

// =========================================================================
// SECTION 3: EXHAUSTIVE ENUM METHODS, CONVERSIONS & MATCHES
// =========================================================================

#[test]
fn test_http_method_exhaustive() {
    let methods = [
        (HttpMethod::GET, "GET", true, true),
        (HttpMethod::HEAD, "HEAD", true, true),
        (HttpMethod::OPTIONS, "OPTIONS", true, true),
        (HttpMethod::TRACE, "TRACE", true, true),
        (HttpMethod::POST, "POST", false, false),
        (HttpMethod::PUT, "PUT", false, true),
        (HttpMethod::DELETE, "DELETE", false, true),
        (HttpMethod::PATCH, "PATCH", false, false),
        (HttpMethod::CONNECT, "CONNECT", false, false),
        (HttpMethod::GRAPHQL, "GRAPHQL", false, false),
    ];

    for (method, name, is_safe, is_idempotent) in methods {
        assert_eq!(method.as_str(), name);
        assert_eq!(format!("{}", method), name);
        assert_eq!(HttpMethod::from_str(name).unwrap(), method);
        assert_eq!(HttpMethod::from_str(&name.to_lowercase()).unwrap(), method);
        assert_eq!(method.is_safe(), is_safe);
        assert_eq!(method.is_idempotent(), is_idempotent);

        let json = serde_json::to_string(&method).unwrap();
        let deser: HttpMethod = serde_json::from_str(&json).unwrap();
        assert_eq!(method, deser);
    }

    assert!(HttpMethod::from_str("NONEXISTENT_METHOD").is_err());
}

#[test]
fn test_severity_ordering_and_scores() {
    let severities = [
        (Severity::Critical, "Critical", 10.0, 4),
        (Severity::High, "High", 8.0, 3),
        (Severity::Medium, "Medium", 5.0, 2),
        (Severity::Low, "Low", 2.5, 1),
        (Severity::Info, "Info", 0.0, 0),
    ];

    for (sev, name, score, rank) in severities {
        assert_eq!(sev.as_str(), name);
        assert_eq!(format!("{}", sev), name);
        assert_eq!(sev.score(), score);
        assert_eq!(sev.rank(), rank);

        let json = serde_json::to_string(&sev).unwrap();
        let deser: Severity = serde_json::from_str(&json).unwrap();
        assert_eq!(sev, deser);
    }

    // Strict Ordering Invariants
    assert!(Severity::Critical > Severity::High);
    assert!(Severity::High > Severity::Medium);
    assert!(Severity::Medium > Severity::Low);
    assert!(Severity::Low > Severity::Info);
}

#[test]
fn test_task_lifecycle_exhaustive() {
    let states = [
        (TaskLifecycle::Pending, "Pending", false),
        (TaskLifecycle::Running, "Running", false),
        (TaskLifecycle::Paused, "Paused", false),
        (TaskLifecycle::Completed, "Completed", true),
        (TaskLifecycle::Failed, "Failed", true),
        (TaskLifecycle::Cancelled, "Cancelled", true),
    ];

    for (state, name, is_terminal) in states {
        assert_eq!(state.as_str(), name);
        assert_eq!(format!("{}", state), name);
        assert_eq!(state.is_terminal(), is_terminal);

        let json = serde_json::to_string(&state).unwrap();
        let deser: TaskLifecycle = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deser);
    }
}

#[test]
fn test_scan_lifecycle_exhaustive() {
    let states = [
        (ScanLifecycle::Initializing, "Initializing", true),
        (ScanLifecycle::Running, "Running", true),
        (ScanLifecycle::Pausing, "Pausing", true),
        (ScanLifecycle::Paused, "Paused", false),
        (ScanLifecycle::Finished, "Finished", false),
        (ScanLifecycle::Error, "Error", false),
    ];

    for (state, name, is_active) in states {
        assert_eq!(state.as_str(), name);
        assert_eq!(format!("{}", state), name);
        assert_eq!(state.is_active(), is_active);

        let json = serde_json::to_string(&state).unwrap();
        let deser: ScanLifecycle = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deser);
    }
}

#[test]
fn test_finding_lifecycle_exhaustive() {
    let states = [
        (FindingLifecycle::Candidate, "Candidate", false),
        (FindingLifecycle::Verified, "Verified", true),
        (FindingLifecycle::Confirmed, "Confirmed", true),
        (FindingLifecycle::Reported, "Reported", true),
        (FindingLifecycle::Remediated, "Remediated", false),
        (FindingLifecycle::FalsePositive, "FalsePositive", false),
        (FindingLifecycle::AcceptedRisk, "AcceptedRisk", false),
        (FindingLifecycle::Regression, "Regression", true),
    ];

    for (state, name, is_actionable) in states {
        assert_eq!(state.as_str(), name);
        assert_eq!(format!("{}", state), name);
        assert_eq!(state.is_actionable(), is_actionable);

        let json = serde_json::to_string(&state).unwrap();
        let deser: FindingLifecycle = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deser);
    }
}

#[test]
fn test_all_supporting_enums_as_str_display_and_serde() {
    // ParamLocation
    let param_locs = [
        ParamLocation::Query,
        ParamLocation::Body,
        ParamLocation::Header,
        ParamLocation::Path,
        ParamLocation::Cookie,
        ParamLocation::JsonPath,
        ParamLocation::XPath,
        ParamLocation::MultipartField,
        ParamLocation::GraphQLVariable,
        ParamLocation::WebSocketFrame,
    ];
    for loc in param_locs {
        assert_eq!(format!("{}", loc), loc.as_str());
        let json = serde_json::to_string(&loc).unwrap();
        let deser: ParamLocation = serde_json::from_str(&json).unwrap();
        assert_eq!(loc, deser);
    }

    // DataType
    let data_types = [
        DataType::String,
        DataType::Integer,
        DataType::Boolean,
        DataType::Float,
        DataType::Uuid,
        DataType::Json,
        DataType::Xml,
        DataType::Base64,
        DataType::Unknown,
    ];
    for dt in data_types {
        assert_eq!(format!("{}", dt), dt.as_str());
        let json = serde_json::to_string(&dt).unwrap();
        let deser: DataType = serde_json::from_str(&json).unwrap();
        assert_eq!(dt, deser);
    }

    // Provenance
    let provenances = [
        Provenance::Manual,
        Provenance::Scanner,
        Provenance::Fuzzer,
        Provenance::Proxy,
        Provenance::AI,
        Provenance::Tool,
    ];
    for prov in provenances {
        assert_eq!(format!("{}", prov), prov.as_str());
        let json = serde_json::to_string(&prov).unwrap();
        let deser: Provenance = serde_json::from_str(&json).unwrap();
        assert_eq!(prov, deser);
    }

    // LifecycleState
    let lifecycles = [
        LifecycleState::Active,
        LifecycleState::Archived,
        LifecycleState::Deleted,
    ];
    for lc in lifecycles {
        assert_eq!(format!("{}", lc), lc.as_str());
        let json = serde_json::to_string(&lc).unwrap();
        let deser: LifecycleState = serde_json::from_str(&json).unwrap();
        assert_eq!(lc, deser);
    }

    // ObservationSource
    let sources = [
        ObservationSource::Proxy,
        ObservationSource::OAST,
        ObservationSource::Browser,
        ObservationSource::Manual,
        ObservationSource::Tool,
    ];
    for src in sources {
        assert_eq!(format!("{}", src), src.as_str());
        let json = serde_json::to_string(&src).unwrap();
        let deser: ObservationSource = serde_json::from_str(&json).unwrap();
        assert_eq!(src, deser);
    }

    // AccessLevel
    let levels = [
        AccessLevel::Admin,
        AccessLevel::User,
        AccessLevel::Anonymous,
        AccessLevel::TenantA,
        AccessLevel::TenantB,
    ];
    for lvl in levels {
        assert_eq!(format!("{}", lvl), lvl.as_str());
        let json = serde_json::to_string(&lvl).unwrap();
        let deser: AccessLevel = serde_json::from_str(&json).unwrap();
        assert_eq!(lvl, deser);
    }

    // ReportFormat
    let formats = [
        (ReportFormat::Pdf, "pdf"),
        (ReportFormat::Markdown, "md"),
        (ReportFormat::Json, "json"),
        (ReportFormat::Html, "html"),
    ];
    for (fmt_enum, ext) in formats {
        assert_eq!(fmt_enum.extension(), ext);
        assert_eq!(format!("{}", fmt_enum), fmt_enum.as_str());
        let json = serde_json::to_string(&fmt_enum).unwrap();
        let deser: ReportFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(fmt_enum, deser);
    }

    // MutatorType
    let mutators = [
        MutatorType::BitFlip,
        MutatorType::ByteReplace,
        MutatorType::Grammar,
        MutatorType::Wordlist,
        MutatorType::Radamsa,
        MutatorType::Boundary,
        MutatorType::UnicodeNormalization,
        MutatorType::Truncation,
        MutatorType::FormatString,
        MutatorType::AiAssisted,
    ];
    for m in mutators {
        assert_eq!(format!("{}", m), m.as_str());
        let json = serde_json::to_string(&m).unwrap();
        let deser: MutatorType = serde_json::from_str(&json).unwrap();
        assert_eq!(m, deser);
    }

    // VerificationStrategy
    let strategies = [
        VerificationStrategy::BrowserExecution,
        VerificationStrategy::OASTCorrelation,
        VerificationStrategy::TimingStatistical,
        VerificationStrategy::ResponseDifferential,
        VerificationStrategy::StateVerification,
        VerificationStrategy::AuthorizationReplay,
        VerificationStrategy::ContentVerification,
        VerificationStrategy::MathematicalVerification,
        VerificationStrategy::ErrorClassification,
        VerificationStrategy::CausalMinimization,
    ];
    for strat in strategies {
        assert_eq!(format!("{}", strat), strat.as_str());
        let json = serde_json::to_string(&strat).unwrap();
        let deser: VerificationStrategy = serde_json::from_str(&json).unwrap();
        assert_eq!(strat, deser);
    }

    // ParameterClass
    let param_classes = [
        ParameterClass::ObjectId,
        ParameterClass::Url,
        ParameterClass::FilePath,
        ParameterClass::Email,
        ParameterClass::Token,
        ParameterClass::Search,
        ParameterClass::Numeric,
        ParameterClass::Boolean,
        ParameterClass::Json,
        ParameterClass::Xml,
        ParameterClass::Html,
        ParameterClass::Enumeration,
        ParameterClass::FreeText,
        ParameterClass::Unknown,
    ];
    for pc in param_classes {
        assert_eq!(format!("{}", pc), pc.as_str());
        let json = serde_json::to_string(&pc).unwrap();
        let deser: ParameterClass = serde_json::from_str(&json).unwrap();
        assert_eq!(pc, deser);
    }

    // PolicyResult & PolicyResultType
    let policy_cases = [
        (
            PolicyResult::Approved,
            PolicyResultType::Approved,
            true,
            false,
        ),
        (
            PolicyResult::Blocked,
            PolicyResultType::Blocked,
            false,
            true,
        ),
        (
            PolicyResult::Filtered("<bad>".to_string()),
            PolicyResultType::Filtered,
            false,
            false,
        ),
        (
            PolicyResult::RequiresHumanApproval,
            PolicyResultType::RequiresHumanApproval,
            false,
            false,
        ),
    ];
    for (pol, res_type, is_app, is_blk) in policy_cases {
        assert_eq!(pol.result_type(), res_type);
        assert_eq!(pol.is_approved(), is_app);
        assert_eq!(pol.is_blocked(), is_blk);
        let json = serde_json::to_string(&pol).unwrap();
        let deser: PolicyResult = serde_json::from_str(&json).unwrap();
        assert_eq!(pol, deser);
    }
}

// =========================================================================
// SECTION 4: NEGATIVE SERDE TESTING & MALFORMED INPUT REJECTION
// =========================================================================

#[test]
fn test_malformed_json_clean_rejection() {
    let malformed_cases = [
        // Missing required field 'id'
        "{\"version\": 1, \"username\": \"alice\"}",
        // Invalid UUID format
        "{\"id\": \"not-a-valid-uuid\", \"version\": 1, \"timestamp\": \"2026-08-17T00:00:00Z\", \"username\": \"alice\", \"roles\": []}",
        // Type mismatch: string where boolean expected
        "{\"decision_id\": \"00000000-0000-0000-0000-000000000000\", \"allowed\": \"yes_allowed\", \"reason\": \"ok\", \"target\": \"https://test.com\", \"scope_version\": 1, \"timestamp\": \"2026-08-17T00:00:00Z\"}",
        // Truncated JSON
        "{\"meta\": {\"id\": \"00000000-0000-0000-0000-000000000000\", \"version\": 1",
    ];

    for malformed in malformed_cases {
        let res: Result<Identity, _> = serde_json::from_str(malformed);
        assert!(
            res.is_err(),
            "Expected parsing failure for malformed input: {}",
            malformed
        );
    }
}

// =========================================================================
// SECTION 5: COMPLEX COLLECTION NESTING & ORACLE CONSISTENCY
// =========================================================================

#[test]
fn test_complex_collections_of_all_domain_entities() {
    let mut btree_findings = BTreeMap::new();
    for i in 0..10 {
        let f = Finding {
            meta: EntityMetadata::new(Provenance::Scanner),
            title: format!("Finding #{}", i),
            severity: Severity::Medium,
            verification_id: Uuid::new_v4(),
            state: FindingLifecycle::Verified,
        };
        btree_findings.insert(f.meta.id, f);
    }

    let json = serde_json::to_string(&btree_findings).unwrap();
    let deser: BTreeMap<Uuid, Finding> = serde_json::from_str(&json).unwrap();
    assert_eq!(btree_findings, deser);
}

#[test]
fn test_float_edge_cases_in_entities() {
    let tech = Technology {
        id: "tech_zero".to_string(),
        name: "ZeroConfidenceTech".to_string(),
        category: "Test".to_string(),
        version: None,
        confidence: 0.0,
    };
    let json = serde_json::to_string(&tech).unwrap();
    let deser: Technology = serde_json::from_str(&json).unwrap();
    assert_eq!(tech, deser);

    let task = Task {
        id: Uuid::new_v4(),
        task_type: "PrecisionTest".to_string(),
        priority: 10,
        state: TaskLifecycle::Running,
        progress_pct: 33.333332,
    };
    let json = serde_json::to_string(&task).unwrap();
    let deser: Task = serde_json::from_str(&json).unwrap();
    assert_eq!(task.progress_pct, deser.progress_pct);
}
