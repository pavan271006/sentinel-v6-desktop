## 2026-08-30T15:27:07Z
You are teamwork_preview_worker for UCMA-X Milestone 1 (Safe Foundation & Scope Control).
Your working directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ucmax_m1
Project Directory: c:\Users\Legion 5 pro\Desktop\cyber sec\ucma-x
Authoritative User Request: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md (under ## 2026-08-30T15:20:35Z)
Project Architecture: c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md
Explorer Reports to Review:
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\spec_miner_ucmax_survey\analysis.md
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ucmax_codebase\analysis.md
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ucmax_milestones\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL INVARIANT FOR MILESTONE 1:
INVARIANT: Zero SQL logic in Milestone 1. (No SQL parsing, no AST, no injection logic in M1).

Your Objective:
Implement Milestone 1 (Safe Foundation) completely across the workspace crates in ucma-x/:
1. Root Cargo.toml: Configure workspace members (ucma-core, ucma-scope, ucma-http, ucma-session, ucma-bench), shared dependencies (tokio, serde, blake3, reqwest, thiserror, tracing, bytes, url, ipnet, async-trait, etc.), and compilation settings.
2. ucma-core:
   - Target models, request models, endpoint models, parameter models.
   - Deterministic BLAKE3 content-derived IDs (`ids.rs`).
   - Response snapshots (`snapshot.rs`).
   - In-memory evidence store (`evidence.rs`).
   - Session trait abstractions (`session.rs`).
3. ucma-scope:
   - Centralized fail-closed default-deny scope policy (`policy.rs`).
   - Scope matcher with IP/CIDR, domain, and regex rules (`matcher.rs`).
   - URL canonicalization (`canonicalize.rs`).
   - Anti-SSRF DNS resolution with loopback (127.0.0.0/8, ::1), private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7), link-local (169.254.0.0/16, fe80::/10), and multicast blocking (`dns.rs`).
   - Hop-by-hop redirect validation.
   - `AuthorizedRequest` capability token (opaque token required to make HTTP requests).
4. ucma-http:
   - Safe HTTP client wrapper (`client.rs`) requiring `AuthorizedRequest` capability token.
   - Resource limits: body size limits (e.g. 5MB cap), timeouts (connect, read, overall) (`limits.rs`).
   - Safe redirect handling (`redirect.rs`).
   - Automatic response snapshot creation with BLAKE3 hash of raw wire bytes (`response.rs`, `snapshot.rs`).
5. ucma-session:
   - Session tracking, cookie jars, header management, credential container.
6. ucma-bench:
   - In-memory benchmark harness (`harness.rs`), synthetic mock fixtures (`fixtures.rs`).
7. docs/:
   - Create docs/ARCHITECTURE.md and docs/SECURITY_MODEL.md as single sources of truth.
8. Comprehensive Unit & Integration Tests:
   - Write thorough unit tests and integration tests in all crates verifying scope enforcement, SSRF blocking, DNS pinning, redirect safety, capability token verification, BLAKE3 hash determinism, and HTTP limits.
   - Run `cargo check --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, and `cargo test --workspace --locked` to ensure 100% build and test pass.

Write your implementation report to c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ucmax_m1\handoff.md and send a completion message to the orchestrator.
