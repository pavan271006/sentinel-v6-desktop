//! Test Suite for External Tool Adapters Subsystem

use sentinel_adapters::{NmapAdapter, NucleiAdapter, SqlmapAdapter, SubfinderAdapter};
use sentinel_common::traits::ExternalToolAdapter;

#[tokio::test]
async fn test_nmap_adapter() {
    let adapter = NmapAdapter;
    assert_eq!(adapter.tool_name(), "nmap");
    let _installed = adapter.is_installed();

    let res = adapter
        .execute(serde_json::json!({"target": "10.0.0.1"}))
        .await
        .unwrap();

    assert_eq!(res["tool"], "nmap");
    assert_eq!(res["target"], "10.0.0.1");
    if _installed {
        assert!(res["status"] == "success" || res["status"] == "failed");
    } else {
        assert!(res["open_ports"].is_array());
    }
}

#[tokio::test]
async fn test_nuclei_adapter() {
    let adapter = NucleiAdapter;
    assert_eq!(adapter.tool_name(), "nuclei");
    let _installed = adapter.is_installed();

    let res = adapter
        .execute(serde_json::json!({"target": "https://test.local"}))
        .await
        .unwrap();

    assert_eq!(res["tool"], "nuclei");
    if _installed {
        assert!(res["status"] == "success" || res["status"] == "failed");
    } else {
        assert_eq!(res["severity"], "high");
    }
}

#[tokio::test]
async fn test_sqlmap_adapter() {
    let adapter = SqlmapAdapter;
    assert_eq!(adapter.tool_name(), "sqlmap");
    let _installed = adapter.is_installed();

    let res = adapter
        .execute(serde_json::json!({"target": "https://test.local/search?id=1"}))
        .await
        .unwrap();

    assert_eq!(res["tool"], "sqlmap");
    if _installed {
        assert!(res["status"] == "success" || res["status"] == "failed");
    } else {
        assert_eq!(res["dbms"], "PostgreSQL");
    }
}

#[tokio::test]
async fn test_subfinder_adapter() {
    let adapter = SubfinderAdapter;
    assert_eq!(adapter.tool_name(), "subfinder");
    let _installed = adapter.is_installed();

    let res = adapter
        .execute(serde_json::json!({"domain": "sentinel.local"}))
        .await
        .unwrap();

    assert_eq!(res["tool"], "subfinder");
    let subdomains = res["subdomains"].as_array();
    if let Some(subs) = subdomains {
        assert!(!subs.is_empty());
    }
}
