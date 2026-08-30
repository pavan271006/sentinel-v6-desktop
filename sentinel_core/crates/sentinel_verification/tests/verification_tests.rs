//! Test Suite for Verification, Evidence & Findings Subsystem

use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::domain::core::{Candidate, VerificationStrategyRef};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::enums::{FindingLifecycle, Provenance, VerificationStrategy};
use sentinel_common::operational::OastEvidence;
use sentinel_common::traits::{EventBus, VerificationEngine};
use sentinel_verification::{
    DefaultVerificationEngine, FindingLifecycleManager, StrategyEvaluator,
};

#[test]
fn test_finding_lifecycle_transitions() {
    let state = FindingLifecycle::Candidate;
    let verified = FindingLifecycleManager::transition(state, FindingLifecycle::Verified).unwrap();
    assert_eq!(verified, FindingLifecycle::Verified);

    let confirmed =
        FindingLifecycleManager::transition(verified, FindingLifecycle::Confirmed).unwrap();
    assert_eq!(confirmed, FindingLifecycle::Confirmed);

    let remediated =
        FindingLifecycleManager::transition(confirmed, FindingLifecycle::Remediated).unwrap();
    assert_eq!(remediated, FindingLifecycle::Remediated);

    let regression =
        FindingLifecycleManager::transition(remediated, FindingLifecycle::Regression).unwrap();
    assert_eq!(regression, FindingLifecycle::Regression);

    // Invalid transition
    let invalid = FindingLifecycleManager::transition(
        FindingLifecycle::Candidate,
        FindingLifecycle::Remediated,
    );
    assert!(invalid.is_err());
}

#[test]
fn test_strategy_evaluators() {
    let vid = Uuid::new_v4();

    // 1. Content
    let (s1, conf1, ev1) = StrategyEvaluator::evaluate_content(
        vid,
        b"response contains vulnerable payload",
        "vulnerable",
    );
    assert!(s1);
    assert_eq!(conf1, 1.0);
    assert_eq!(ev1.len(), 1);

    // 2. Differential
    let (s2, conf2, ev2) = StrategyEvaluator::evaluate_differential(vid, 200, 500, 500, 1500);
    assert!(s2);
    assert!(conf2 > 0.8);
    assert_eq!(ev2.len(), 1);

    // 3. Timing
    let (s3, conf3, ev3) = StrategyEvaluator::evaluate_timing(
        vid,
        Duration::from_millis(5000),
        Duration::from_millis(4800),
    );
    assert!(s3);
    assert!(conf3 > 0.9);
    assert_eq!(ev3.len(), 1);

    // 4. SQL Error
    let (s4, conf4, _ev4) =
        StrategyEvaluator::evaluate_sql_error(vid, b"ORA-00933: SQL command not properly ended");
    assert!(s4);
    assert!(conf4 >= 0.95);
}

#[tokio::test]
async fn test_verification_engine_flow() {
    let bus = Arc::new(ChannelEventBus::new(EventBusConfig::default()));
    let mut crit_rx = bus.subscribe_critical();

    let engine = DefaultVerificationEngine::new().with_event_bus(bus.clone());

    let candidate = Candidate {
        meta: EntityMetadata::new(Provenance::Scanner),
        source_observation_id: Uuid::new_v4(),
        hypothesis: "Target endpoint is vulnerable to SQL injection".to_string(),
        status: "Hypothesized".to_string(),
    };

    let strat = VerificationStrategyRef {
        strategy_type: VerificationStrategy::ContentVerification,
        version: "1.0".to_string(),
    };

    let result = engine.verify_candidate(&candidate, strat).await.unwrap();
    assert!(result.success);

    let ev = crit_rx.recv().await.unwrap();
    if let sentinel_common::events::CriticalEvent::FindingCreated(id) = ev {
        assert_ne!(id, Uuid::nil());
    } else {
        panic!("Expected FindingCreated event");
    }
}

#[tokio::test]
async fn test_oast_correlation() {
    let engine = DefaultVerificationEngine::new();
    let token = "oast_probe_token_xyz";

    engine.register_oast_interaction(OastEvidence {
        token: token.to_string(),
        interaction_time: chrono::Utc::now(),
    });

    let correlated = engine.correlate_oast(token).await.unwrap();
    assert!(correlated.is_some());
    assert_eq!(correlated.unwrap().token, token);
}

#[test]
fn test_deep_sqli_engine() {
    use sentinel_verification::{DatabaseEngine, SqliEngine, SqliTechnique};

    // 1. Error-based detection across engines
    let pg_error = b"PSQLException: syntax error at or near 'admin'";
    let res_pg = SqliEngine::evaluate_error_based(pg_error).unwrap();
    assert_eq!(res_pg.database_engine, DatabaseEngine::PostgreSql);
    assert_eq!(res_pg.technique, SqliTechnique::ErrorBased);

    let mysql_error = b"Warning: mysql_fetch_array(): You have an error in your SQL syntax";
    let res_mysql = SqliEngine::evaluate_error_based(mysql_error).unwrap();
    assert_eq!(res_mysql.database_engine, DatabaseEngine::MySql);

    // 2. Boolean blind inversion
    let base = "<html><body>Welcome Alice, your balance is $500</body></html>";
    let p_true = "<html><body>Welcome Alice, your balance is $500</body></html>";
    let p_false = "<html><body>No user found</body></html>";
    let p_inv = "<html><body>Welcome Alice, your balance is $500</body></html>";
    let res_bool = SqliEngine::evaluate_boolean_oracle(base, p_true, p_false, p_inv).unwrap();
    assert_eq!(res_bool.technique, SqliTechnique::BooleanBlindInversion);

    // 3. Time-based blind injection
    let res_time = SqliEngine::evaluate_timing_blind(50, 5080, 7120).unwrap();
    assert_eq!(res_time.technique, SqliTechnique::TimeBasedBlind);

    // 4. UNION column count discovery
    let cols = vec![(1, true, 500), (2, true, 500), (3, false, 200)];
    let res_union = SqliEngine::evaluate_union_columns(&cols).unwrap();
    assert_eq!(res_union.column_count, Some(3));
}

#[test]
fn test_nosqli_and_cmdi_engines() {
    use sentinel_verification::{CommandInjectionEngine, NoSqliEngine, NoSqliOperator};

    // 1. NoSQL injection evaluation
    let probes = NoSqliEngine::generate_probes("username");
    assert_eq!(probes.len(), 3);
    let res_nosql = NoSqliEngine::evaluate_response(NoSqliOperator::NotEqual, 401, 200, "{\"token\":\"jwt\"}", 401).unwrap();
    assert!(res_nosql.is_vulnerable);

    // 2. Command injection math canary
    let base = "Response: invalid input";
    let probe_body = "Response: 60999";
    let res_cmdi = CommandInjectionEngine::evaluate_math_canary_response(base, probe_body, "60999").unwrap();
    assert!(res_cmdi.is_vulnerable);
    assert_eq!(res_cmdi.confidence, 0.99);

    // 3. Command injection timing delay
    let res_timing = CommandInjectionEngine::evaluate_timing_probe(50, 5080, 5).unwrap();
    assert!(res_timing.is_vulnerable);
}

#[test]
fn test_ssti_and_xxe_engines() {
    use sentinel_verification::{SstiEngine, TemplateEngine, XxeEngine};

    // 1. SSTI polyglot arithmetic
    let probes = SstiEngine::get_probes();
    let jinja_probe = &probes[0]; // {{7*7}} -> 49, {{31245*3}} -> 93735
    let res_ssti = SstiEngine::evaluate_response(jinja_probe, "Hello user", "Hello 49", "Hello 93735").unwrap();
    assert!(res_ssti.is_vulnerable);
    assert_eq!(res_ssti.detected_engine, TemplateEngine::Jinja2);

    // Disambiguation
    assert_eq!(SstiEngine::disambiguate_jinja_twig("Output: 7777777"), TemplateEngine::Jinja2);
    assert_eq!(SstiEngine::disambiguate_jinja_twig("Output: 49"), TemplateEngine::Twig);

    // 2. XXE file disclosure
    let xxe_probes = XxeEngine::generate_file_disclosure_probes();
    let unix_probe = &xxe_probes[0];
    let unix_resp = "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin";
    let res_xxe = XxeEngine::evaluate_response(unix_probe, unix_resp).unwrap();
    assert!(res_xxe.is_vulnerable);
}

#[test]
fn test_traversal_xss_deserialization_prototype_pollution() {
    use sentinel_verification::{
        DeserializationEngine, DeserializationPlatform, PathTraversalEngine,
        PollutionScope, PrototypePollutionEngine, TraversalTargetOs, XssContext, XssEngine,
    };

    // 1. Path Traversal
    let traversal_probes = PathTraversalEngine::generate_probes();
    let win_probe = traversal_probes.iter().find(|p| p.target_os == TraversalTargetOs::Windows).unwrap();
    let win_resp = "[fonts]\nArial=arial.ttf\n[extensions]\n";
    let res_traversal = PathTraversalEngine::evaluate_response(win_probe, win_resp).unwrap();
    assert!(res_traversal.is_vulnerable);

    // 2. XSS context-aware reflection
    let xss_probes = XssEngine::generate_canary_probes("test12345");
    let script_probe = xss_probes.iter().find(|p| p.context == XssContext::ScriptTag).unwrap();
    let reflected_body = "<html><script>var x = '';sentinel_test12345();//';</script></html>";
    let res_xss = XssEngine::evaluate_response(script_probe, reflected_body).unwrap();
    assert!(res_xss.is_vulnerable);

    // 3. Safe Deserialization URLDNS
    let urldns_bytes = DeserializationEngine::generate_java_urldns_payload("probe123.oast.sentinel.dev");
    assert!(urldns_bytes.starts_with(&[0xac, 0xed, 0x00, 0x05]));
    let res_deser = DeserializationEngine::evaluate_oast_correlation(
        DeserializationPlatform::JavaUrlDns,
        true,
        "probe123.oast.sentinel.dev",
    );
    assert!(res_deser.is_vulnerable);

    // 4. Prototype Pollution
    let server_res = PrototypePollutionEngine::evaluate_server_reflection(
        "sentinel_polluted_prop",
        "sentinel_val",
        "{\"status\":\"ok\",\"sentinel_polluted_prop\":\"sentinel_val\"}",
    ).unwrap();
    assert_eq!(server_res.scope, PollutionScope::ServerSideNodeJs);

    let dom_res = PrototypePollutionEngine::evaluate_dom_pollution("sentinel_client_prop", true).unwrap();
    assert_eq!(dom_res.scope, PollutionScope::ClientSideBrowserDom);
}

