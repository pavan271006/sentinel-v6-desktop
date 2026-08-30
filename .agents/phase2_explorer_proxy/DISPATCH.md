## 2026-08-17T08:19:41Z
You are the Proxy Explorer for Phase 2: Traffic, Proxy & Protocol Engine.
Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_explorer_proxy`
You must read `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md` and `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md` before starting.

YOUR TASK:
1. Investigate the design and implementation strategy for `crates/sentinel_proxy`:
   - Requirements for `ProxyEngine` trait and `ProxyInterceptor` pipeline.
   - Async Tokio TCP listener for MITM proxying (HTTP/1.1 forward/CONNECT, HTTP/2 upstream, WebSocket upgrade).
   - Dynamic TLS CA generation and on-the-fly certificate forging (using `rustls` and `rcgen`).
   - Scope integration (SEC-01): consult `ScopeEngine` prior to opening upstream socket; emit `ScopeViolationAttempt` critical event if out-of-scope.
   - Interceptor pipeline: synchronous / async inspection, modification, drop, and rule evaluation (`proxy_intercept_rules`).
   - Dual-write persistence: save transactions and observations to `ObservationStore` / CAS and emit `ObservationCreated` telemetry on `EventBus`.
   - Performance targets: 5,000 req/sec sustained, <5ms added latency.
2. Recommend concrete crate layout, modules (`proxy::server`, `proxy::tls`, `proxy::pipeline`, `proxy::connection`, `proxy::handler`), error handling, and test harness (mock servers, MITM tests, TLS tests, interceptor tests).
3. Write your complete report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\phase2_explorer_proxy\handoff.md`.
4. Maintain `progress.md` with timestamps.
5. Message the orchestrator (ID: ebf19a92-a9bf-4dc2-830a-557507a9aa67) when done.
