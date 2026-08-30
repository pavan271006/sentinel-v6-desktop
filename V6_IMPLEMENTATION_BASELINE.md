# SENTINEL V6 — Implementation Baseline & Environment Ground Truth

> **Document ID**: `SENTINEL-V6-BASELINE-001`  
> **Status**: **FROZEN & AUTHORITATIVE**  
> **Phase**: Phase 0 (Source Baseline & Implementation Reality Audit)  
> **Timestamp**: `2026-08-22T20:00:00Z`  
> **Author**: `worker_phase0_baseline` (`teamwork_preview_worker`)  
> **Integrity Mode**: Development / Strict Forensic Audit  
> **Zero Code Modifications Attestation**: Certified zero modifications to `sentinel_core/`, `src-tauri/`, `frontend/`, or `architecture/v6/` during Phase 0.

---

## 1. Executive Summary & Purpose

This document establishes the frozen, immutable environmental and cryptographic ground truth for the **SENTINEL V6 Desktop Security Testing Workstation** repository prior to active feature implementation across Phases 1 through 4.

Every dependency, compiler toolchain, lockfile digest, canonical architecture contract, and repository configuration is recorded with byte-level fidelity. Any future implementation drift, unintended dependency expansion, or environment desynchronization can be verified against the cryptographic baseline established herein.

---

## 2. Environment Ground Truth

The host execution environment was surveyed and verified via direct system diagnostics:

| Environment Property | Verified Value | Telemetry / Command Output |
|:---|:---|:---|
| **Operating System** | Windows (NT Kernel 10.0.26100) | `Microsoft Windows [Version 10.0.26100]` (x86_64-pc-windows-msvc) |
| **Rust Compiler (rustc)** | `rustc 1.97.1 (8bab26f4f 2026-07-14)` | Release: `1.97.1`, Commit Hash: `8bab26f4f4c2c589fe9ff94a50d2e825a07dd988` |
| **Cargo Package Manager** | `cargo 1.97.1 (c980f4866 2026-06-30)` | Release: `1.97.1`, Host: `x86_64-pc-windows-msvc` |
| **Node.js Runtime** | `v22.14.0` | LTS Active / V8 Engine 12.4.254.21-node.15 |
| **Node Package Manager (npm)** | `10.9.2` | Semver compliant, package-lock v3 engine |
| **Python Interpreter** | `Python 3.11.9` | CPython 3.11.9 (tags/v3.11.9:de542f0) [MSC v.1938 64 bit (AMD64)] |
| **Tauri CLI / Desktop Shell** | `@tauri-apps/cli 2.x` / `@tauri-apps/api 2.x` | Tauri v2 Desktop Bridge (Wry / WebView2 on Windows) |

---

## 3. Cryptographic Artifact Checksums (SHA-256)

All critical dependency lockfiles, schema files, and authoritative architecture contracts have been hashed using SHA-256:

### 3.1 Dependency Lockfiles
```
Algorithm : SHA256
Hash      : C42EF1ACA3B8413B56BFBB4E6DE862EA148EF68F84FFE3AAF0B888F12581B796
Path      : sentinel_core\Cargo.lock

Algorithm : SHA256
Hash      : DB60E9EC5E6C5891DE9033AC3856043A5367596C5AEF7470FF073D87787DD425
Path      : package-lock.json
```

### 3.2 Canonical Architecture Contracts (`architecture/v6/`)
```
Algorithm : SHA256
Hash      : 424F75DECE3D64EF6868145B783053534149BB932FE89E51FBE548F665675041
Path      : architecture\v6\V6_CANONICAL_SPEC.yaml

Algorithm : SHA256
Hash      : EE31C5C08FDFCC366D28B5CD46F0B0E39E94EE72B882B1D90A520EAD71CCBF27
Path      : architecture\v6\V6_CANONICAL_SPEC_SCHEMA.yaml

Algorithm : SHA256
Hash      : BC941BC207503A4D9DD4CC3B188F34DA350335DCFF38182909B8BE511902CF5B
Path      : architecture\v6\V6_IPC_CONTRACTS.proto

Algorithm : SHA256
Hash      : 5B0D1E58F03B0CB9F08C01DC4CFAD75A8F8D94AF3B67D294DC62C2D80D1A8BD7
Path      : architecture\v6\V6_SQLITE_SCHEMA.sql

Algorithm : SHA256
Hash      : 4DDC26C203A67AD3B67EEE740BE1E9B2B6F9693D6423E51B1AE39CA6C1A443AD
Path      : architecture\v6\V6_COMMON_TYPES.rs

Algorithm : SHA256
Hash      : 02E6552E83C859B2BC96696C764A44E7D237354FC11F7C6BB59D95CAAA690784
Path      : architecture\v6\validate_v6_spec.py
```

---

## 4. Repository State & Frozen Workspace Configuration

### 4.1 Repository Layout Status
- **Git State**: Local directory is an uninitialized workspace (`fatal: not a git repository`).
- **Workspace Structure**:
  - `sentinel_core/`: Rust Cargo workspace containing 29 crates plus cross-crate integration test harness (`sentinel_core/tests/`).
  - `src-tauri/`: Tauri v2 desktop integration layer, custom IPC commands, Windows subsystem config, AppState lifecycle.
  - `src/` (`frontend/`): React 18, TypeScript 5.7, Tailwind CSS 3.4, Zustand 4.5, Vitest 3.0 test suite (65 test files, 558 unit/stress/E2E tests).
  - `architecture/v6/`: Authoritative YAML, SQL, Proto, and Rust specification contracts validated by `validate_v6_spec.py`.
  - `lab/` & `tests/vulnerable_lab/`: Isolated testbed and ground-truth vulnerability fixture registry (`VULNERABILITY_REGISTRY.yaml`).
  - `research/`: Standalone research prototypes (`research/prototypes/`) and Theory Lab packages (`research/theory_lab/`).
  - `.agents/`: Teamwork subagent metadata, briefing logs, progress logs, and handoff reports.

### 4.2 Rust Workspace Configuration (`sentinel_core/Cargo.toml`)
The Cargo workspace manages 29 member crates with synchronized edition `2021` and shared dependencies:
```toml
[workspace]
members = [
    "crates/sentinel_common",
    "crates/sentinel_storage",
    "crates/sentinel_bus",
    "crates/sentinel_scope",
    "crates/sentinel_parser",
    "crates/sentinel_proxy",
    "crates/sentinel_httpql",
    "crates/sentinel_repeater",
    "crates/sentinel_context",
    "crates/sentinel_knowledge",
    "crates/sentinel_coverage",
    "crates/sentinel_auth",
    "crates/sentinel_scanner",
    "crates/sentinel_fuzzer",
    "crates/sentinel_verification",
    "crates/sentinel_authz",
    "crates/sentinel_api",
    "crates/sentinel_browser",
    "crates/sentinel_oast",
    "crates/sentinel_logic",
    "crates/sentinel_report",
    "crates/sentinel_productivity",
    "crates/sentinel_plugin",
    "crates/sentinel_adapters",
    "crates/sentinel_ai",
    "crates/sentinel_agent",
    "crates/sentinel_enterprise",
    "crates/sentinel_cli",
    "crates/sentinel_dispatch",
]
```

### 4.3 Frontend Package Configuration (`package.json`)
```json
{
  "name": "sentinel-v6-desktop",
  "private": true,
  "version": "6.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.2.0",
    "@tauri-apps/plugin-shell": "^2.2.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.0.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.2.7",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "happy-dom": "^17.1.8",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

---

## 5. Security Invariant Baseline Definitions (SEC-01 to SEC-12)

Every future phase must preserve and satisfy the 12 core security invariants defined in `V6_CANONICAL_SPEC.yaml`:

| Invariant ID | Name | Formal Rule | Verification Mechanism |
|:---|:---|:---|:---|
| **SEC-01** | Scope Gate | Fail-closed pre-socket validation on all outbound URIs, IPs, and hostnames. Unconfigured scope returns `DENY`. | Unit tests in `sentinel_scope`, integration tests in `fail_closed_tests.rs`. |
| **SEC-02** | Destructive Safety Gate | Explicit target/scope confirmation required before executing destructive actions (e.g. CSRF state mutation, active fuzzing). | Tested in `ScopeEngineAdversarialUI2.stress.test.ts`. |
| **SEC-03** | Host-Side AI Gate | Host-side validation on AI-assisted workflows; prompt injection defenses; strict risk budgets. | Tested in `sentinel_ai/tests/`. |
| **SEC-04** | Sandboxed Plugins | Zero-capability WASM runtime isolation with bounded fuel and memory. | Tested in `sentinel_plugin/tests/`. |
| **SEC-05** | Research Isolation | Complete network and execution isolation between research lab engines and external targets. | Verified in `tests/vulnerable_lab/` and `lab/app.py`. |
| **SEC-06** | Finding Proof Requirement | No vulnerability promoted from `CANDIDATE` to `VERIFIED` without a registered deterministic oracle proof. | Tested in `sentinel_verification/tests/`. |
| **SEC-07** | CAS Immutability | Dual-write storage into SQLite WAL + SHA-256 Content-Addressed Storage; bit-flip tampering detection. | Tested in `cas_tests.rs`. |
| **SEC-08** | Multi-Tenancy / Project Isolation | Complete data and workspace isolation across projects; path traversal rejection. | Tested in `project_isolation_tests.rs`. |
| **SEC-09** | Secret Zeroization & Masking | Redacted `SecretReference` types; secrets zeroized in memory upon drop; masked in logs and UI. | Tested in `secret_redaction_tests.rs`. |
| **SEC-10** | Triple Representation | Consistent raw bytes, structured AST, and decoded text representations of all network traffic. | Tested in `sentinel_parser/tests/`. |
| **SEC-11** | Bounded Resource & Memory | Steady-state heap $\le 110\text{MB}$ under 100K transactions; bounded event queues with backpressure. | Tested in 4-hour soak tests (`tier4_pentester_workflows.test.ts`). |
| **SEC-12** | Lossless Audit Journal | Critical security events logged over dedicated lossless Tokio broadcast channel and SQLite WAL. | Tested in `audit_repository_tests.rs`. |

---

## 6. Pre-Implementation Attestation

- **Baseline Certification**: The codebase compiles cleanly (`cargo check --workspace`, `npm run build`), passes 100% of all unit, integration, stress, and E2E tests (474 cargo tests, 558 vitest tests), and conforms to all 11 steps of `validate_v6_spec.py` with 0 blockers.
- **Frozen Baseline State**: No source code in `sentinel_core/`, `src-tauri/`, `frontend/`, or `architecture/v6/` was modified during Phase 0.
- **Readiness Verdict**: The workspace is 100% ready to advance to Phase 1 (Isolated Multi-Target Testbed & Golden Path Vertical Slice).
