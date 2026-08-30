//! Unit tests for Request Smuggling and Protocol Anomaly Detection

use sentinel_common::enums::Severity;
use sentinel_parser::SentinelHttpParser;

#[test]
fn test_cl_te_dual_framing_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST / HTTP/1.1\r\nHost: target.corp\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let cl_te_warning = rich
        .warnings
        .iter()
        .find(|w| w.code == "SMUG_CL_TE_DUAL_FRAMING");

    assert!(
        cl_te_warning.is_some(),
        "Must emit SMUG_CL_TE_DUAL_FRAMING warning"
    );
    assert_eq!(cl_te_warning.unwrap().severity, Severity::Critical);
}

#[test]
fn test_te_cl_dual_framing_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST / HTTP/1.1\r\nHost: target.corp\r\nTransfer-Encoding: chunked\r\nContent-Length: 6\r\n\r\n0\r\n\r\n";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let te_cl_warning = rich
        .warnings
        .iter()
        .find(|w| w.code == "SMUG_TE_CL_DUAL_FRAMING");

    assert!(
        te_cl_warning.is_some(),
        "Must emit SMUG_TE_CL_DUAL_FRAMING warning"
    );
}

#[test]
fn test_duplicate_content_length_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST / HTTP/1.1\r\nHost: target.corp\r\nContent-Length: 5\r\nContent-Length: 10\r\n\r\nhello";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let dup_cl = rich
        .warnings
        .iter()
        .find(|w| w.code == "SMUG_DUPLICATE_CONTENT_LENGTH");

    assert!(
        dup_cl.is_some(),
        "Must detect duplicate Content-Length headers"
    );
}

#[test]
fn test_space_before_colon_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET / HTTP/1.1\r\nHost : example.com\r\nContent-Length : 0\r\n\r\n";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let space_warnings: Vec<_> = rich
        .warnings
        .iter()
        .filter(|w| w.code == "SMUG_HEADER_SPACE_BEFORE_COLON")
        .collect();

    assert!(
        !space_warnings.is_empty(),
        "Must flag space before colon anomalies"
    );
}

#[test]
fn test_obs_fold_line_folding_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET / HTTP/1.1\r\nHost: example.com\r\nCustom-Header: line1\r\n continuation_line\r\n\r\n";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let obs_warning = rich
        .warnings
        .iter()
        .find(|w| w.code == "SMUG_OBSOLETE_LINE_FOLDING");

    assert!(
        obs_warning.is_some(),
        "Must detect obsolete line folding (obs-fold)"
    );
}

#[test]
fn test_obfuscated_transfer_encoding_detection() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST / HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: xchunked\r\n\r\ntest";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    let obf_te = rich
        .warnings
        .iter()
        .find(|w| w.code == "SMUG_OBFUSCATED_TRANSFER_ENCODING");

    assert!(
        obf_te.is_some(),
        "Must detect obfuscated Transfer-Encoding value"
    );
}
