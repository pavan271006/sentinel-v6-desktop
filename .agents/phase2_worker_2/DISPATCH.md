## 2026-08-17T08:40:43Z
You are the Replacement Implementation Worker for Phase 2: Traffic, Proxy & Protocol Engine.
Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_worker_2`

You MUST read the following files before starting work:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_worker\progress.md` (interruption point: `sentinel_parser` is already implemented and passing tests)
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_explorer_proxy\handoff.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_spec_miner\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\Cargo.toml`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_proxy\**`

YOUR TASKS:
1. Review existing `sentinel_parser` in `sentinel_core/crates/sentinel_parser` to confirm its API and exports.
2. Implement `crates/sentinel_proxy`:
   - Implement `ProxyEngine` trait and `ProxyInterceptor` pipeline from `sentinel_common::traits`.
   - Async Tokio TCP listener supporting HTTP/1.1 forward proxy, HTTPS CONNECT MITM tunneling, and HTTP/2.
   - Dynamic TLS Root CA and on-the-fly leaf certificate generation with caching using `rcgen` and `rustls`.
   - Enforce SEC-01 fail-closed scope checking via `ScopeEngine` prior to upstream socket connections; emit `ScopeViolationAttempt` critical event on `EventBus`.
   - Implement interceptor pipeline (modify, drop, rule matching).
   - Implement dual-write persistence to `ObservationStore` / CAS and telemetry emission to `EventBus` (SEC-12 backpressure).
   - Provide comprehensive unit tests, mock server integration tests, TLS MITM tests, and interceptor tests.
3. Update `sentinel_core/Cargo.toml` to include `crates/sentinel_proxy` in workspace members if not already present.
4. Execute and verify all Quality Gates:
   - `cargo check --workspace --locked` (0 errors)
   - `cargo fmt --check` (clean formatting)
   - `cargo clippy --workspace --all-targets --all-features` (0 warnings)
   - `cargo test --workspace --locked` (100% passing across all workspace tests)
   - `python architecture/v6/validate_v6_spec.py --workspace architecture/v6` (BLOCKERS = 0)
5. Document all implemented modules, tests, benchmark results, and verification commands in `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_worker_2\handoff.md`.
6. Maintain `progress.md` with timestamps.
7. Message the orchestrator (conversation ID: ebf19a92-a9bf-4dc2-830a-557507a9aa67) when done.
