//! Test Suite for Plugins & Sandboxed Research Packs Subsystem

use std::collections::HashMap;

use sentinel_common::operational::{
    CapabilitySet, PluginInput, PluginSandboxConfig, ResourceLimits,
};
use sentinel_common::traits::{PluginRuntime, ResearchPackManager};
use sentinel_plugin::{DefaultPluginRuntime, DefaultResearchPackManager};

fn default_sandbox_config() -> PluginSandboxConfig {
    PluginSandboxConfig {
        capabilities: CapabilitySet {
            network: false,
            filesystem: false,
            secrets: false,
            database: false,
            browser: false,
        },
        limits: ResourceLimits {
            max_memory_mb: 64,
            max_execution_ms: 1000,
            max_network_requests: 0,
        },
    }
}

#[tokio::test]
async fn test_plugin_runtime_wasm_and_rhai_lifecycle() {
    let runtime = DefaultPluginRuntime::new();
    let cfg = default_sandbox_config();

    // 1. WASM loading and execution
    let valid_wasm = b"\0asm\x01\0\0\0";
    let wasm_id = runtime.load_wasm(valid_wasm, cfg.clone()).await.unwrap();

    let input = PluginInput {
        transaction_id: None,
        config_overrides: HashMap::new(),
    };
    let out = runtime.execute(wasm_id, input.clone()).await.unwrap();
    assert!(out.output.contains("WASM executed"));

    // 2. Rhai loading and execution
    let rhai_id = runtime
        .load_rhai("print(\"hello\");", cfg.clone())
        .await
        .unwrap();
    let out_rhai = runtime.execute(rhai_id, input).await.unwrap();
    assert!(out_rhai.output.contains("Rhai script"));

    // 3. Unload
    assert!(runtime.unload(wasm_id).await.is_ok());
    assert!(runtime.unload(wasm_id).await.is_err());
}

#[tokio::test]
async fn test_research_pack_manager_lifecycle() {
    let mgr = DefaultResearchPackManager::new();

    let manifest = mgr.load_pack("cve/2026/graphql").await.unwrap();
    assert_eq!(manifest.id, "pack_cve_2026_graphql");

    let is_valid = mgr.verify_signature(&manifest).await.unwrap();
    assert!(is_valid);

    let checks = mgr.list_checks(&manifest.id).await.unwrap();
    assert_eq!(checks.len(), 1);
    assert_eq!(checks[0].id, "pack_cve_2026_graphql_check_01");

    assert!(mgr.hot_reload(&manifest.id).await.is_ok());
}

#[tokio::test]
async fn test_wasm_zero_capability_sandbox_and_fuel_metering() {
    use sentinel_plugin::sandbox::PluginSandboxEnvironment;

    let valid_wasm = b"\0asm\x01\0\0\0";
    let cfg = default_sandbox_config();

    // 1. Sandbox Initialization
    let env = PluginSandboxEnvironment::new(valid_wasm, cfg.clone()).unwrap();
    let input = PluginInput {
        transaction_id: None,
        config_overrides: HashMap::new(),
    };
    let output = env.execute_transaction(&input).await.unwrap();
    assert!(output.output.contains("success"));

    // 2. Capability Drop Violation (SEC-04: network enabled violates zero capability)
    let bad_cfg = PluginSandboxConfig {
        capabilities: CapabilitySet {
            network: true,
            filesystem: false,
            secrets: false,
            database: false,
            browser: false,
        },
        limits: ResourceLimits {
            max_memory_mb: 32,
            max_execution_ms: 500,
            max_network_requests: 0,
        },
    };
    let bad_env = PluginSandboxEnvironment::new(valid_wasm, bad_cfg).unwrap();
    let err = bad_env.execute_transaction(&input).await;
    assert!(err.is_err());
}

#[test]
fn test_key_revocation_list_verification_and_enforcement() {
    use sentinel_plugin::krl::{KeyRevocationList, RevocationReason};

    let mut krl = KeyRevocationList::new(1);
    let master_key = b"sentinel-master-root-krl-key";

    let key_alpha = b"signing-key-alpha-999";
    let key_beta = b"signing-key-beta-888";

    // 1. Add revoked key
    krl.add_revoked_key("key-alpha", key_alpha, RevocationReason::KeyCompromise);

    // 2. Sign KRL
    krl.sign_krl(master_key);
    assert!(krl.verify_krl_signature(master_key).unwrap());

    // 3. Verify key status
    assert!(krl.is_key_revoked("key-alpha", key_alpha));
    assert!(!krl.is_key_revoked("key-beta", key_beta));
}
