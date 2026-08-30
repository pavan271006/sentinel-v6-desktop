# SENTINEL V6 — CANONICAL SPECIFICATION & SCHEMA REPORT

**Author**: `worker_canonical_spec_1` (Teamwork Preview Worker)  
**Date**: 2026-08-17  
**Workspace**: `c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`  
**Deliverables**:
1. `architecture/v6/V6_CANONICAL_SPEC_SCHEMA.yaml`
2. `architecture/v6/V6_CANONICAL_SPEC.yaml`

---

## 1. Executive Summary

In accordance with `ORIGINAL_REQUEST.md` and the findings of `spec_miner_survey_1`, `spec_miner_survey_2`, and `explorer_survey_3`, `worker_canonical_spec_1` has authored the definitive, machine-readable single source of truth for SENTINEL V6: `V6_CANONICAL_SPEC.yaml` along with its formal schema validator `V6_CANONICAL_SPEC_SCHEMA.yaml`.

This canonical specification replaces all prior informal and fragmented representations. It resolves all historical split-brain contradictions, arithmetic mismatches, missing traits, missing protocol abstractions, and incomplete relational tables.

---

## 2. Deliverables Summary

### 2.1 `V6_CANONICAL_SPEC_SCHEMA.yaml`
- **Specification Standard**: JSON Schema (Draft 7 / 2020-12 Compatible) authored in YAML.
- **Enforcement Rules**:
  - Enforces all 19 top-level mandatory keys.
  - Validates exact subsystem taxonomy arithmetic (14 Core + 7 Pro + 4 Adapter + 3 Research = 28 Total).
  - Validates all 28 subsystem definitions (`SUB-01` to `SUB-28`).
  - Validates core domain lifecycle progression (`Transaction` → `Observation` → `Candidate` → `VerificationResult` → `Evidence` → `Finding`).
  - Enforces schemas for all 20 supporting entities, 28 subsystem traits, channels, durable/broadcast events, IPC Protobuf messages, configuration registries, error hierarchies, 32 SQLite tables, protocol framing abstractions, fuzzer mutators, plugin sandboxing, research modules, AI safety layers, HTTPQL PEG grammar, and SEC-01 through SEC-12 security invariants.

### 2.2 `V6_CANONICAL_SPEC.yaml`
- **Version**: `6.0.0`
- **Subsystem Architecture**:
  - Exact taxonomy: CORE (14), PROFESSIONAL (7), ADAPTER (4), RESEARCH (3), TOTAL (28).
  - All 28 subsystems defined with exact IDs (`SUB-01` to `SUB-28`), canonical crates, responsibilities, hard dependencies, emitted/consumed events, traits provided/consumed, permissions, storage access, and security boundaries.
  - External adapters (`SUB-22 SubfinderAdapter`, `SUB-23 CloudFoxAdapter`, `SUB-24 SemgrepAdapter`, `SUB-25 OpenApiParser`) completely replace legacy monolithic engine names.
- **Domain Model & Lifecycle**:
  - 6-stage evidence progression: `Transaction` → `Observation` → `Candidate` → `VerificationResult` → `Evidence` → `Finding`.
  - Full definitions for 6 core entities and 20 supporting entities (`Scope`, `Endpoint`, `Payload`, `Identity`, `Session`, `Credential`, `SecretReference`, `Asset`, `Technology`, `State`, `Workflow`, `Resource`, `Action`, `Task`, `Report`, `RegressionTest`, `OASTInteraction`, `AttackPath`, `Note`, `Screenshot`).
  - Complete domain enums: `HttpMethod`, `ParamLocation`, `DataType`, `Provenance`, `LifecycleState`, `TaskLifecycle`, `ScanLifecycle`, `Severity`, `FindingLifecycle`, `ObservationSource`, `AccessLevel`, `ReportFormat`, `MutatorType`, `VerificationStrategy`, `ParameterClass`, `PolicyResultType`.
- **Credential Security & Scope Model**:
  - Zero-Knowledge Vault: `Credential` → `SecretReference (UUID)` → OS Keychain / Secure Vault.
  - Zero plaintext secrets in SQLite, logs, telemetry events, reports, or crash dumps.
  - Structured `ScopeDecision` with fail-closed default DENY policy, socket-level DNS rebinding defense, and 100ms ReDoS bounded regex evaluation.
- **Interfaces & Traits**:
  - All 28 primary subsystem traits defined with complete method signatures, argument types, return types, and `SentinelError` mappings.
- **Events & IPC Contracts**:
  - Standard broadcast telemetry channel (`tokio::sync::broadcast`, 10k capacity, drop-on-lag) vs Guaranteed critical channel (`tokio::sync::mpsc`, backpressured, appended to WAL).
  - Protobuf `BrowserDaemon` service definition (5 RPCs) and `SentinelUiStream` message with all 8 mapped UI events including `UiCandidateVerifiedEvent` (tag 8).
- **Configuration Registry**:
  - Unified configuration registries (`SentinelConfig`, `ProxyConfig`, `ScanConfig`, `ResourceBudget`, `PluginSandboxConfig`, `OastConfig`, `ReportConfig`, `AiConfig`, `ResearchConfig`).
- **Error Model**:
  - Root `SentinelError` enum with 14 typed variants (`Database`, `Io`, `Tantivy`, `ScopeViolation`, `BusOverflow`, `ParseError`, `AiEngine`, `SandboxViolation`, `InvariantViolation`, `TlsError`, `NetworkError`, `Timeout`, `AuthError`, `InvalidConfiguration`), retryability classifications, and crash-safe WAL recovery rules.
- **Storage & Relational Schema**:
  - 32 fully defined SQLite tables with primary keys, foreign keys, cascade rules, and indexes.
  - Addresses previously missing tables: `verifications`, `evidence`, `sessions`, `workflows`, `reports`, `regression_tests`, `notes`, `screenshots`, `attack_paths`.
  - Renames `casm_assets` to `subdomain_assets`.
  - Tantivy FTS schema and content-addressed blob storage layout.
- **Protocols**:
  - Dedicated framing and connection abstractions for HTTP/1.1, HTTP/2 (multiplexed streams), HTTP/3 (QUIC), TLS 1.2/1.3, WebSocket (RFC 6455), Server-Sent Events (SSE), and gRPC.
- **Scanner & Fuzzer**:
  - FuzzProfile, 10 MutatorTypes, 10 InsertionPoints, 7 FuzzOracles, ResourceBudget, delta debugging minimization, deterministic replay, and stop conditions.
- **Plugin Security**:
  - Bifurcation of `CapabilitySet` (boolean permissions) from `ResourceLimits` (quotas). Default DENY sandbox policy in Wasmtime / Rhai / Process. Ed25519 pack signatures.
- **Research Modules**:
  - Feature-gated behind `#[cfg(feature = "sentinel-research")]`. Strictly optional, memory/CPU isolated, non-core execution paths for `SmtSolverEngine`, `RlStateEngine`, `CryptoAnalysisEngine`.
- **AI Security**:
  - Host-side 5-layer policy evaluation engine (`AIPolicyEngine`) treating target data as untrusted, blocking destructive commands and prompt injection leaks.
- **Security Invariants**:
  - Full formal specifications for `SEC-01` through `SEC-12` with verification test assertions.
- **HTTPQL PEG Grammar & Built-in Rules**:
  - Header subfield matching (`res.header.Server`) and escaped string quote handling.
  - 9 built-in technology signatures, 12 parameter classifiers, and AI safety regex filters.

---

## 3. Validation & Conformance Results

The canonical specification was subjected to automated validation against `V6_CANONICAL_SPEC_SCHEMA.yaml` and internal consistency assertions:

```
Schema loaded successfully. Keys: ['$schema', 'title', 'description', 'type', 'required', 'properties', 'definitions']
Spec loaded successfully. Keys: ['metadata', 'subsystems', 'domain_model', 'credential_security', 'scope_model', 'interfaces_and_traits', 'events', 'ipc_contracts', 'configuration', 'error_model', 'storage', 'protocols', 'scanner_and_fuzzer', 'plugin_security', 'research_modules', 'ai_security', 'security_invariants', 'httpql_grammar', 'builtin_rules']
Subsystems Taxonomy: {'core_count': 14, 'professional_count': 7, 'adapter_count': 4, 'research_count': 3, 'total_count': 28}
Subsystems Definitions Count: 28
Traits count: 28
SQLite Tables count: 32
Security Invariants count: 12
JSON Schema validation PASSED!
ALL CHECKS PASSED!
```

---

## 4. Conclusion

`V6_CANONICAL_SPEC.yaml` and `V6_CANONICAL_SPEC_SCHEMA.yaml` now stand as the verified, complete, authoritative single source of truth for the entire SENTINEL V6 architecture. All downstream contracts (Rust code, SQL schema, Protobuf definitions, and Markdown registries) can now be validated and reconciled against this master specification.
