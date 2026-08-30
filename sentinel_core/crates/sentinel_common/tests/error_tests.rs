// SENTINEL V6: Canonical Error Hierarchy Tests
// crates/sentinel_common/tests/error_tests.rs

use sentinel_common::SentinelError;
use std::io;

#[test]
fn test_sentinel_error_all_variants_and_error_codes() {
    let io_err = io::Error::new(io::ErrorKind::NotFound, "file not found");
    let err_io = SentinelError::from(io_err);
    assert_eq!(err_io.error_code(), "ERR_IO_002");
    assert!(!err_io.is_retryable());

    let err_fts = SentinelError::Tantivy("query syntax error".to_string());
    assert_eq!(err_fts.error_code(), "ERR_FTS_003");
    assert!(!err_fts.is_retryable());

    let err_scope = SentinelError::scope_violation("Host not in allowed scope");
    assert_eq!(err_scope.error_code(), "ERR_SCOPE_004");
    assert!(!err_scope.is_retryable());
    assert_eq!(
        format!("{}", err_scope),
        "Scope engine rejected interaction: Host not in allowed scope"
    );

    let err_bus = SentinelError::BusOverflow { count: 128 };
    assert_eq!(err_bus.error_code(), "ERR_BUS_005");
    assert!(err_bus.is_retryable());
    assert_eq!(
        format!("{}", err_bus),
        "Event bus overflow: dropped 128 messages"
    );

    let err_parse = SentinelError::parse_error("Invalid HTTP header delimiter");
    assert_eq!(err_parse.error_code(), "ERR_PARSE_006");
    assert!(!err_parse.is_retryable());

    let err_ai = SentinelError::AiEngine("LLM provider rate limited".to_string());
    assert_eq!(err_ai.error_code(), "ERR_AI_007");
    assert!(err_ai.is_retryable());

    let err_sandbox =
        SentinelError::SandboxViolation("Unauthorized file write attempt".to_string());
    assert_eq!(err_sandbox.error_code(), "ERR_SANDBOX_008");
    assert!(!err_sandbox.is_retryable());

    let err_invar = SentinelError::invariant_violation("Finding created without verified evidence");
    assert_eq!(err_invar.error_code(), "ERR_INVAR_009");
    assert!(!err_invar.is_retryable());

    let err_tls = SentinelError::TlsError("Handshake failure: certificate expired".to_string());
    assert_eq!(err_tls.error_code(), "ERR_TLS_010");
    assert!(err_tls.is_retryable());

    let err_net = SentinelError::NetworkError("Connection reset by peer".to_string());
    assert_eq!(err_net.error_code(), "ERR_NET_011");
    assert!(err_net.is_retryable());

    let err_time = SentinelError::timeout("Scan execution exceeded budget");
    assert_eq!(err_time.error_code(), "ERR_TIME_012");
    assert!(err_time.is_retryable());

    let err_auth = SentinelError::auth_error("Invalid HMAC signature");
    assert_eq!(err_auth.error_code(), "ERR_AUTH_013");
    assert!(!err_auth.is_retryable());

    let err_cfg = SentinelError::invalid_configuration("Missing storage directory path");
    assert_eq!(err_cfg.error_code(), "ERR_CFG_014");
    assert!(!err_cfg.is_retryable());

    let err_ser = SentinelError::serialization("JSON syntax error");
    assert_eq!(err_ser.error_code(), "ERR_SER_015");
    assert!(!err_ser.is_retryable());

    let err_str = SentinelError::storage("Disk block write failed");
    assert_eq!(err_str.error_code(), "ERR_STR_016");
    assert!(!err_str.is_retryable());

    let err_int = SentinelError::integrity("SHA-256 CAS hash mismatch");
    assert_eq!(err_int.error_code(), "ERR_INT_017");
    assert!(!err_int.is_retryable());
}

#[test]
fn test_serde_json_error_conversion() {
    let bad_json = "{ invalid_json: 123 ";
    let serde_result: Result<serde_json::Value, serde_json::Error> = serde_json::from_str(bad_json);
    let serde_err = serde_result.unwrap_err();
    let sentinel_err: SentinelError = serde_err.into();

    match sentinel_err {
        SentinelError::Serialization(msg) => {
            assert!(!msg.is_empty());
        }
        other => panic!("Expected SentinelError::Serialization, got {:?}", other),
    }
}
