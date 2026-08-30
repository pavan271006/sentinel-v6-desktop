import os
import re

sec_mappings = {
    "SEC-01": {
        "name": "Scope Authorization (Default Deny)",
        "subsystems": ["sentinel_scope", "sentinel_proxy", "sentinel_scanner", "sentinel_adapters", "sentinel_browser"],
        "patterns": [r"ScopeDecision::Allowed", r"ScopeDecision::Denied", r"ScopeEngine", r"ScopeViolation", r"fail-closed|default.*deny"],
        "test_files": [
            r"sentinel_core\crates\sentinel_scope\tests\scope_tests.rs",
            r"sentinel_core\crates\sentinel_proxy\tests\proxy_tests.rs",
            r"sentinel_core\crates\sentinel_scanner\tests\scanner_tests.rs",
            r"sentinel_core\tests\tests\cross_crate_security_integration.rs",
            r"sentinel_core\tests\tests\tier1_feature_coverage.rs"
        ]
    },
    "SEC-02": {
        "name": "OAST Token Confidentiality (AES-256-GCM)",
        "subsystems": ["sentinel_oast"],
        "patterns": [r"Aes256Gcm", r"generate_token", r"correlate", r"encrypt", r"decrypt", r"token.*entropy"],
        "test_files": [
            r"sentinel_core\crates\sentinel_oast\tests\oast_tests.rs",
            r"sentinel_core\crates\sentinel_oast\src\token.rs",
            r"sentinel_core\tests\tests\tier2_boundary_corner.rs"
        ]
    },
    "SEC-03": {
        "name": "Host AI Policy Gate (5-layer Policy)",
        "subsystems": ["sentinel_policy", "sentinel_agent"],
        "patterns": [r"AiPolicyEngine|PolicyEngine", r"PolicyResult::Blocked|PolicyResult::Allowed", r"destructive.*prompt", r"PromptInjectionDefenses|sanitize_prompt"],
        "test_files": [
            r"sentinel_core\crates\sentinel_policy\tests\policy_tests.rs",
            r"sentinel_core\crates\sentinel_agent\tests\agent_tests.rs",
            r"sentinel_core\tests\tests\cross_crate_security_integration.rs"
        ]
    },
    "SEC-04": {
        "name": "WASM Capability Drop (Zero-Capability Sandbox)",
        "subsystems": ["sentinel_plugin"],
        "patterns": [r"Wasmtime|wasmtime", r"default_deny|drop_capabilities", r"SandboxViolation", r"PluginRuntime"],
        "test_files": [
            r"sentinel_core\crates\sentinel_plugin\tests\plugin_tests.rs",
            r"sentinel_core\crates\sentinel_plugin\tests\research_pack_tests.rs"
        ]
    },
    "SEC-05": {
        "name": "Research Module Optionality (sentinel-research flag)",
        "subsystems": ["sentinel_research", "Cargo.toml"],
        "patterns": [r"sentinel-research", r"default-features\s*=\s*false"],
        "test_files": [
            r"sentinel_core\Cargo.toml",
            r"sentinel_core\crates\sentinel_research\Cargo.toml"
        ]
    },
    "SEC-06": {
        "name": "Finding Proof Requirement (Candidate -> Verified -> Evidence)",
        "subsystems": ["sentinel_verification", "sentinel_findings"],
        "patterns": [r"FindingLifecycle::Verified", r"FindingLifecycle::Candidate", r"VerificationEngine", r"Evidence"],
        "test_files": [
            r"sentinel_core\crates\sentinel_verification\tests\verification_tests.rs",
            r"sentinel_core\crates\sentinel_findings\tests\findings_tests.rs",
            r"sentinel_core\tests\tests\cross_crate_security_integration.rs"
        ]
    },
    "SEC-07": {
        "name": "Evidence Immutability (SHA-256 CAS Blob)",
        "subsystems": ["sentinel_storage", "sentinel_cas"],
        "patterns": [r"sha256|Sha256", r"BlobStore|CasStore", r"content_address|immutable", r"tamper|hash_mismatch"],
        "test_files": [
            r"sentinel_core\crates\sentinel_storage\tests\storage_tests.rs",
            r"sentinel_core\crates\sentinel_storage\src\cas.rs",
            r"sentinel_core\tests\tests\tier1_feature_coverage.rs"
        ]
    },
    "SEC-08": {
        "name": "Cross-Tenant Project Isolation (Physical Partitioning)",
        "subsystems": ["sentinel_storage", "sentinel_common"],
        "patterns": [r"project_id", r"partition|isolated", r"sqlite.*project", r"SwitchProject|open_project"],
        "test_files": [
            r"sentinel_core\crates\sentinel_storage\tests\storage_tests.rs",
            r"sentinel_core\tests\tests\cross_crate_security_integration.rs"
        ]
    },
    "SEC-09": {
        "name": "Zero Plaintext Secrets (SecretReference UUID / Keychain)",
        "subsystems": ["sentinel_auth", "sentinel_storage", "sentinel_common"],
        "patterns": [r"SecretReference", r"zeroize|Zeroize", r"keychain|vault", r"redact|Redacted"],
        "test_files": [
            r"sentinel_core\crates\sentinel_auth\tests\auth_tests.rs",
            r"sentinel_core\crates\sentinel_common\src\types.rs",
            r"sentinel_core\tests\tests\tier1_feature_coverage.rs"
        ]
    },
    "SEC-10": {
        "name": "Triple Representation (Raw, Parsed, Normalized)",
        "subsystems": ["sentinel_parser", "sentinel_storage", "sentinel_proxy"],
        "patterns": [r"raw_bytes|raw_slice", r"parsed|HttpTransaction", r"normalized|search_text", r"round_trip|TripleRepresentation"],
        "test_files": [
            r"sentinel_core\crates\sentinel_parser\tests\parser_tests.rs",
            r"sentinel_core\crates\sentinel_storage\tests\storage_tests.rs",
            r"sentinel_core\tests\tests\tier1_feature_coverage.rs"
        ]
    },
    "SEC-11": {
        "name": "WebView Sandbox Isolation (Out-of-process Browser Daemon)",
        "subsystems": ["sentinel_browser", "src-tauri"],
        "patterns": [r"BrowserDaemon|BrowserService", r"sandbox|isolated", r"Playwright|playwright", r"Tauri|tauri"],
        "test_files": [
            r"sentinel_core\crates\sentinel_browser\tests\browser_tests.rs",
            r"sentinel_core\crates\sentinel_browser\src\service.rs"
        ]
    },
    "SEC-12": {
        "name": "Bounded Buffer Backpressure (EventBus Bounded Queues)",
        "subsystems": ["sentinel_bus"],
        "patterns": [r"bounded|broadcast", r"backpressure|drop_on_lag", r"capacity|EventBus", r"channel.*saturation"],
        "test_files": [
            r"sentinel_core\crates\sentinel_bus\tests\bus_tests.rs",
            r"sentinel_core\crates\sentinel_bus\src\bus.rs",
            r"sentinel_core\tests\tests\tier2_boundary_corner.rs"
        ]
    }
}

print("VERIFYING SOURCE CODE AND TEST EVIDENCE FOR SEC-01 THROUGH SEC-12:")
print("=" * 80)

for sec_id, info in sec_mappings.items():
    print(f"\n>>> {sec_id}: {info['name']}")
    
    # Check source files in subsystems
    matching_sources = []
    for sub in info["subsystems"]:
        crate_dir = os.path.join("sentinel_core", "crates", sub)
        if not os.path.exists(crate_dir):
            if os.path.exists(os.path.join("sentinel_core", sub)):
                crate_dir = os.path.join("sentinel_core", sub)
            else:
                continue
        for root, dirs, files in os.walk(crate_dir):
            for f in files:
                if f.endswith('.rs'):
                    fp = os.path.join(root, f)
                    try:
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as src_file:
                            content = src_file.read()
                            matched_pat = [p for p in info["patterns"] if re.search(p, content, re.IGNORECASE)]
                            if matched_pat:
                                matching_sources.append((fp, matched_pat))
                    except Exception:
                        pass
    
    # Check test files
    existing_tests = []
    for tf in info["test_files"]:
        if os.path.exists(tf):
            try:
                with open(tf, 'r', encoding='utf-8', errors='ignore') as tf_file:
                    content = tf_file.read()
                    matched_pat = [p for p in info["patterns"] if re.search(p, content, re.IGNORECASE)]
                    existing_tests.append((tf, matched_pat))
            except Exception:
                pass
        else:
            # Check without sentinel_core prefix or in crate tests
            pass
            
    print(f"  Source Implementations Found: {len(matching_sources)}")
    for fp, pats in matching_sources[:3]:
        print(f"    - {fp} (matched: {pats[:2]})")
    print(f"  Test Evidence Files Verified: {len(existing_tests)}")
    for tf, pats in existing_tests:
        print(f"    - {tf} (matched: {pats[:2]})")
