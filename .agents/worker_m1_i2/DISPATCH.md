## 2026-09-11T09:00:45Z
You are Worker Subagent for Milestone M1 Iteration 2 (Remediation: HTTP Framing Parsers & TCP Connection Pooling).

Your Identity & Working Directory:
- Working Directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m1_i2
- Workspace Root: c:\Users\Legion 5 pro\Desktop\cyber sec
- Parent Conversation ID: 94d601fe-cc12-4b39-babd-492e9642f362
- Archetype: teamwork_preview_worker

MANDATORY INPUT:
You MUST read:
1. c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md (under ## 2026-09-11T07:48:59Z)
2. c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md
3. Challenger 1 Rejection Report: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\challenger_m1_1\handoff.md
4. Explorer 1 Report (Race Framing): c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_1\report.md
5. Explorer 2 Report (Dispatcher Framing): c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_2\report.md
6. Explorer 3 Report (Connection Pooling Architecture): c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_3\report.md

WRITE OWNERSHIP:
You have exclusive write ownership of:
1. `sentinel_core/crates/sentinel_repeater/src/executor.rs`
2. `sentinel_core/crates/sentinel_dispatch/src/client.rs`
3. `sentinel_core/crates/sentinel_dispatch/src/pool.rs`
4. `sentinel_core/crates/sentinel_dispatch/src/lib.rs`
5. `src-tauri/src/state.rs`
6. `src-tauri/src/commands.rs`

TASKS:
1. Fix `sentinel_repeater/src/executor.rs`:
   - Harden `RepeaterExecutor::read_http_response` to parse `Content-Length`, `Transfer-Encoding: chunked`, and 1xx/204/304 status codes.
   - Refactor `send_plain_primed_race` and `send_tls_primed_race` to delegate response reading directly to `Self::read_http_response` so race execution against persistent keep-alive endpoints completes immediately once the response is read, without hanging.
2. Fix `sentinel_dispatch/src/client.rs`:
   - Implement HTTP response framing parsing (`Content-Length`, chunked transfer, 1xx/204/304) in `send_plain` and `send_tls` so responses return immediately upon completion rather than waiting for the 15-second `read_timeout` to fire.
3. Implement TCP Connection Pooling (Feature 2) in `sentinel_dispatch/src/pool.rs`:
   - Create thread-safe `HttpConnectionPool` supporting pooled transport (plain TCP and TLS streams), non-blocking health check (`try_read`), idle connection recycling, and integrate into `HttpDispatcher`.
4. Integrate Connection Pool into `src-tauri/src/state.rs` and `commands.rs`:
   - Add `HttpConnectionPool` to `AppState` so that outbound requests in `cmd_repeater_send_request` share persistent TCP connections across requests, eliminating Windows `TIME_WAIT` port exhaustion.
5. Verification:
   Run all tests and builds:
   - `cargo check --manifest-path src-tauri/Cargo.toml`
   - `cargo test -p sentinel_repeater --test empirical_challenge_test -- --nocapture`
   - `cargo nextest run --manifest-path sentinel_core/Cargo.toml`
   - `npm run build`
   Ensure all pass with zero errors.
