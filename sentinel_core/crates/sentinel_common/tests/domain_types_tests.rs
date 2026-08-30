// SENTINEL V6: Comprehensive Domain Types and Lifecycle Tests
// crates/sentinel_common/tests/domain_types_tests.rs

use chrono::Utc;
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

use sentinel_common::*;

#[test]
fn test_all_27_domain_types_construction_and_serde() {
    let now = Utc::now();
    let meta = EntityMetadata::new(Provenance::Scanner).with_scope(Uuid::new_v4());

    // 1. Transaction
    let tx = Transaction {
        meta: meta.clone(),
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::POST,
                uri: "https://example.com/api/v1/auth".to_string(),
                version: "HTTP/1.1".to_string(),
                headers: vec![(b"Host".to_vec(), b"example.com".to_vec())],
            },
            normalized_text: "POST /api/v1/auth HTTP/1.1\r\nHost: example.com\r\n\r\n".to_string(),
        },
        response: Some(MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::POST,
                uri: "".to_string(),
                version: "HTTP/1.1".to_string(),
                headers: vec![(b"Content-Type".to_vec(), b"application/json".to_vec())],
            },
            normalized_text: "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{}"
                .to_string(),
        }),
        timing: Duration::from_millis(42),
        tls_info: Some(TlsData {
            protocol: "TLSv1.3".to_string(),
            cipher: "TLS_AES_256_GCM_SHA384".to_string(),
            server_name: Some("example.com".to_string()),
            alpn: Some("h2".to_string()),
        }),
    };
    let json = serde_json::to_string(&tx).expect("Transaction serialization failed");
    let tx_deser: Transaction =
        serde_json::from_str(&json).expect("Transaction deserialization failed");
    assert_eq!(tx, tx_deser);

    // 2. Observation
    let obs = Observation {
        meta: meta.clone(),
        source: ObservationSource::Proxy,
        data_ref: tx.meta.id,
    };
    let json = serde_json::to_string(&obs).expect("Observation serialization failed");
    let obs_deser: Observation = serde_json::from_str(&json).unwrap();
    assert_eq!(obs, obs_deser);

    // 3. Candidate
    let cand = Candidate {
        meta: meta.clone(),
        source_observation_id: obs.meta.id,
        hypothesis: "SQL Injection in parameter 'id'".to_string(),
        status: "Hypothesized".to_string(),
    };
    let json = serde_json::to_string(&cand).expect("Candidate serialization failed");
    let cand_deser: Candidate = serde_json::from_str(&json).unwrap();
    assert_eq!(cand, cand_deser);

    // 4. Evidence (with all 5 EvidenceVariants)
    let ev1 = Evidence {
        id: Uuid::new_v4(),
        verification_id: Uuid::new_v4(),
        variant: EvidenceVariant::TransactionEvidence(tx.meta.id),
        created_at: now,
    };
    let ev2 = Evidence {
        id: Uuid::new_v4(),
        verification_id: Uuid::new_v4(),
        variant: EvidenceVariant::OastEvidence(Uuid::new_v4()),
        created_at: now,
    };
    let ev3 = Evidence {
        id: Uuid::new_v4(),
        verification_id: Uuid::new_v4(),
        variant: EvidenceVariant::BrowserSnapshot(Uuid::new_v4()),
        created_at: now,
    };
    let ev4 = Evidence {
        id: Uuid::new_v4(),
        verification_id: Uuid::new_v4(),
        variant: EvidenceVariant::TimingVariance {
            expected: Duration::from_secs(1),
            actual: Duration::from_secs(5),
        },
        created_at: now,
    };
    let diff = DiffData {
        structural_similarity: 0.95,
        bytes_added: 120,
        bytes_removed: 10,
        status_code_changed: true,
        content_type_changed: false,
    };
    let ev5 = Evidence {
        id: Uuid::new_v4(),
        verification_id: Uuid::new_v4(),
        variant: EvidenceVariant::Differential(diff),
        created_at: now,
    };
    for ev in &[&ev1, &ev2, &ev3, &ev4, &ev5] {
        let json = serde_json::to_string(ev).unwrap();
        let deser: Evidence = serde_json::from_str(&json).unwrap();
        assert_eq!(ev.id, deser.id);
    }

    // 5. VerificationResult
    let ver_res = VerificationResult {
        id: Uuid::new_v4(),
        candidate_id: cand.meta.id,
        strategy_ref: VerificationStrategyRef {
            strategy_type: VerificationStrategy::ResponseDifferential,
            version: "1.0.0".to_string(),
        },
        success: true,
        confidence: 0.98,
        evidence: vec![ev1, ev5],
        executed_at: now,
    };
    let json = serde_json::to_string(&ver_res).unwrap();
    let ver_deser: VerificationResult = serde_json::from_str(&json).unwrap();
    assert_eq!(ver_res.id, ver_deser.id);
    assert_eq!(ver_res.success, ver_deser.success);

    // 6. Finding
    let finding = Finding {
        meta: meta.clone(),
        title: "Verified SQL Injection on /api/v1/auth".to_string(),
        severity: Severity::Critical,
        verification_id: ver_res.id,
        state: FindingLifecycle::Verified,
    };
    let json = serde_json::to_string(&finding).unwrap();
    let finding_deser: Finding = serde_json::from_str(&json).unwrap();
    assert_eq!(finding, finding_deser);

    // 7. Scope
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 2,
        timestamp: now,
        includes: vec!["*.target.com".to_string(), "10.0.0.0/8".to_string()],
        excludes: vec!["logout.target.com".to_string()],
    };
    let json = serde_json::to_string(&scope).unwrap();
    let scope_deser: Scope = serde_json::from_str(&json).unwrap();
    assert_eq!(scope, scope_deser);

    // 8. ScopeDecision
    let dec_allow = ScopeDecision::allow(
        "https://target.com/api",
        2,
        Some(Uuid::new_v4()),
        "Rule matched",
    );
    let dec_deny = ScopeDecision::deny("https://evil.com", 2, None, "Rule rejected");
    assert!(dec_allow.allowed);
    assert!(!dec_deny.allowed);
    let json = serde_json::to_string(&dec_allow).unwrap();
    let dec_deser: ScopeDecision = serde_json::from_str(&json).unwrap();
    assert_eq!(dec_allow, dec_deser);

    // 9. Endpoint
    let endpoint = Endpoint {
        id: Uuid::new_v4(),
        host: "target.com".to_string(),
        path: "/api/users".to_string(),
        method: HttpMethod::GET,
        timestamp: now,
        graph_node_id: Uuid::new_v4(),
    };
    let json = serde_json::to_string(&endpoint).unwrap();
    let ep_deser: Endpoint = serde_json::from_str(&json).unwrap();
    assert_eq!(endpoint, ep_deser);

    // 10. Payload
    let payload = Payload {
        id: Uuid::new_v4(),
        injection_point: ParamLocation::Query,
        payload_string: "' OR 1=1--".to_string(),
        expected_behavior: VerificationStrategy::ResponseDifferential,
    };
    let json = serde_json::to_string(&payload).unwrap();
    let pay_deser: Payload = serde_json::from_str(&json).unwrap();
    assert_eq!(payload, pay_deser);

    // 11. Identity
    let identity = Identity {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: now,
        username: "security_admin".to_string(),
        roles: vec!["admin".to_string(), "auditor".to_string()],
        meta: Some(meta.clone()),
    };
    let json = serde_json::to_string(&identity).unwrap();
    let id_deser: Identity = serde_json::from_str(&json).unwrap();
    assert_eq!(identity, id_deser);

    // 12. Session
    let mut cookies = HashMap::new();
    cookies.insert("sid".to_string(), "session_token_123".to_string());
    let mut headers = HashMap::new();
    headers.insert("X-CSRF-Token".to_string(), "csrf_token_abc".to_string());
    let session = Session {
        id: Uuid::new_v4(),
        identity_id: identity.id,
        cookies,
        headers,
        created_at: now,
        expires_at: Some(now + chrono::Duration::hours(8)),
    };
    let json = serde_json::to_string(&session).unwrap();
    let sess_deser: Session = serde_json::from_str(&json).unwrap();
    assert_eq!(session, sess_deser);

    // 13. Credential & 14. SecretReference
    let secret_ref = SecretReference::new("linux_keyring");
    let credential = Credential::new(
        identity.id,
        "ApiKey",
        secret_ref.reference_id,
        AccessLevel::Admin,
    );
    let json = serde_json::to_string(&credential).unwrap();
    let cred_deser: Credential = serde_json::from_str(&json).unwrap();
    assert_eq!(credential, cred_deser);

    // 15. Asset
    let mut asset_meta = HashMap::new();
    asset_meta.insert("datacenter".to_string(), "us-east-1".to_string());
    let asset = Asset {
        id: Uuid::new_v4(),
        asset_type: "Host".to_string(),
        identifier: "10.10.10.10".to_string(),
        metadata: asset_meta,
    };
    let json = serde_json::to_string(&asset).unwrap();
    let asset_deser: Asset = serde_json::from_str(&json).unwrap();
    assert_eq!(asset, asset_deser);

    // 16. Technology
    let tech = Technology {
        id: "tech_nginx".to_string(),
        name: "Nginx".to_string(),
        category: "Web Server".to_string(),
        version: Some("1.24.0".to_string()),
        confidence: 0.95,
    };
    let json = serde_json::to_string(&tech).unwrap();
    let tech_deser: Technology = serde_json::from_str(&json).unwrap();
    assert_eq!(tech.id, tech_deser.id);

    // 17. State
    let state = State {
        state_id: "state_logged_in".to_string(),
        state_type: "AuthenticationState".to_string(),
        payload_json: "{\"authenticated\": true}".to_string(),
    };
    let json = serde_json::to_string(&state).unwrap();
    let state_deser: State = serde_json::from_str(&json).unwrap();
    assert_eq!(state, state_deser);

    // 18. Workflow
    let workflow = Workflow {
        id: Uuid::new_v4(),
        name: "OAuth Authorization Flow".to_string(),
        steps_json: "[{\"step\": 1, \"action\": \"GET /login\"}]".to_string(),
        created_at: now,
    };
    let json = serde_json::to_string(&workflow).unwrap();
    let wf_deser: Workflow = serde_json::from_str(&json).unwrap();
    assert_eq!(workflow, wf_deser);

    // 19. Resource
    let resource = Resource {
        resource_type: "NetworkBandwidthBytes".to_string(),
        limit_value: 10_000_000,
        current_usage: 4_500_000,
    };
    let json = serde_json::to_string(&resource).unwrap();
    let res_deser: Resource = serde_json::from_str(&json).unwrap();
    assert_eq!(resource, res_deser);

    // 20. Action
    let mut params = HashMap::new();
    params.insert("target".to_string(), "https://example.com".to_string());
    let action = Action {
        action_id: Uuid::new_v4(),
        action_type: "ExecuteProbe".to_string(),
        parameters: params,
    };
    let json = serde_json::to_string(&action).unwrap();
    let act_deser: Action = serde_json::from_str(&json).unwrap();
    assert_eq!(action, act_deser);

    // 21. Task
    let task = Task {
        id: Uuid::new_v4(),
        task_type: "PortScan".to_string(),
        priority: 5,
        state: TaskLifecycle::Running,
        progress_pct: 45.0,
    };
    let json = serde_json::to_string(&task).unwrap();
    let task_deser: Task = serde_json::from_str(&json).unwrap();
    assert_eq!(task.id, task_deser.id);
    assert_eq!(task.state, task_deser.state);

    // 22. Report
    let report = Report {
        id: Uuid::new_v4(),
        title: "Quarterly Penetration Test Report".to_string(),
        format: ReportFormat::Markdown,
        file_path: "/reports/pentest_q3.md".to_string(),
        config_json: "{}".to_string(),
        generated_at: now,
    };
    let json = serde_json::to_string(&report).unwrap();
    let rep_deser: Report = serde_json::from_str(&json).unwrap();
    assert_eq!(report, rep_deser);

    // 23. RegressionTest
    let reg_test = RegressionTest {
        id: Uuid::new_v4(),
        finding_id: finding.meta.id,
        seed_transaction_id: tx.meta.id,
        expected_status: "403 Forbidden".to_string(),
        created_at: now,
    };
    let json = serde_json::to_string(&reg_test).unwrap();
    let reg_deser: RegressionTest = serde_json::from_str(&json).unwrap();
    assert_eq!(reg_test, reg_deser);

    // 24. OASTInteraction / OastInteraction
    let oast_int = OASTInteraction {
        id: Uuid::new_v4(),
        token_id: Uuid::new_v4(),
        protocol: "DNS".to_string(),
        source_ip: "1.2.3.4".to_string(),
        raw_blob_id: Uuid::new_v4(),
        timestamp: now,
    };
    let json = serde_json::to_string(&oast_int).unwrap();
    let oast_deser: OastInteraction = serde_json::from_str(&json).unwrap();
    assert_eq!(oast_int, oast_deser);

    // 25. AttackPath
    let attack_path = AttackPath {
        id: Uuid::new_v4(),
        start_node_id: Uuid::new_v4(),
        target_node_id: Uuid::new_v4(),
        edge_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
        risk_score: 8.5,
        discovered_at: now,
    };
    let json = serde_json::to_string(&attack_path).unwrap();
    let ap_deser: AttackPath = serde_json::from_str(&json).unwrap();
    assert_eq!(attack_path.id, ap_deser.id);

    // 26. Note
    let note = Note {
        id: Uuid::new_v4(),
        target_id: finding.meta.id,
        author: "pentester_alice".to_string(),
        content: "Verified manual reproduction via sqlmap and differential timing.".to_string(),
        timestamp: now,
    };
    let json = serde_json::to_string(&note).unwrap();
    let note_deser: Note = serde_json::from_str(&json).unwrap();
    assert_eq!(note, note_deser);

    // 27. Screenshot
    let screenshot = Screenshot {
        id: Uuid::new_v4(),
        blob_id: Uuid::new_v4(),
        full_page: true,
        timestamp: now,
    };
    let json = serde_json::to_string(&screenshot).unwrap();
    let ss_deser: Screenshot = serde_json::from_str(&json).unwrap();
    assert_eq!(screenshot, ss_deser);
}

#[test]
fn test_enum_methods_and_helpers() {
    assert!(HttpMethod::GET.is_safe());
    assert!(HttpMethod::HEAD.is_safe());
    assert!(!HttpMethod::POST.is_safe());
    assert!(HttpMethod::PUT.is_idempotent());
    assert!(!HttpMethod::POST.is_idempotent());

    assert_eq!(HttpMethod::GET.to_string(), "GET");
    assert_eq!("POST".parse::<HttpMethod>().unwrap(), HttpMethod::POST);
    assert!("INVALID".parse::<HttpMethod>().is_err());

    assert!(TaskLifecycle::Completed.is_terminal());
    assert!(TaskLifecycle::Failed.is_terminal());
    assert!(TaskLifecycle::Cancelled.is_terminal());
    assert!(!TaskLifecycle::Running.is_terminal());

    assert!(ScanLifecycle::Running.is_active());
    assert!(!ScanLifecycle::Finished.is_active());

    assert!(Severity::Critical > Severity::High);
    assert!(Severity::High > Severity::Medium);
    assert!(Severity::Medium > Severity::Low);
    assert!(Severity::Low > Severity::Info);
    assert_eq!(Severity::Critical.score(), 10.0);

    assert!(FindingLifecycle::Verified.is_actionable());
    assert!(!FindingLifecycle::FalsePositive.is_actionable());

    assert_eq!(ReportFormat::Pdf.extension(), "pdf");
    assert_eq!(ReportFormat::Markdown.extension(), "md");

    let policy_approved = PolicyResult::Approved;
    assert!(policy_approved.is_approved());
    assert!(!policy_approved.is_blocked());
    assert_eq!(policy_approved.result_type(), PolicyResultType::Approved);

    let policy_blocked = PolicyResult::Blocked;
    assert!(policy_blocked.is_blocked());
    assert_eq!(policy_blocked.result_type(), PolicyResultType::Blocked);

    let policy_filtered = PolicyResult::Filtered("<script>".to_string());
    assert_eq!(policy_filtered.result_type(), PolicyResultType::Filtered);
}

#[test]
fn test_events_and_metadata_helpers() {
    let mut meta = EntityMetadata::new(Provenance::AI);
    assert_eq!(meta.version, 1);
    assert_eq!(meta.lifecycle, LifecycleState::Active);

    meta.advance_version();
    assert_eq!(meta.version, 2);

    let event = SentinelEvent::ObservationCreated(meta.id);
    assert_eq!(event.event_name(), "ObservationCreated");
    assert_eq!(event.topic(), "telemetry.observation");
    assert_eq!(event.subsystem(), "SUB-03 ObservationStore");

    let crit_event = CriticalEvent::FindingCreated(meta.id);
    assert_eq!(crit_event.event_name(), "FindingCreated");
    assert_eq!(crit_event.topic(), "audit.finding.created");
    assert_eq!(crit_event.subsystem(), "SUB-09 VerificationEngine");
}
