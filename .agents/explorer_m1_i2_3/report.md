# Technical Architecture Report: TCP Connection Pooling & Keep-Alive Reuse in Sentinel

**Author**: Explorer 3 (`teamwork_preview_explorer`)  
**Milestone**: M1 Iteration 2 (Wire Forensics & Network Throughput Hardening)  
**Target Subsystems**: `sentinel_dispatch`, `sentinel_repeater`, `src-tauri`  
**Date**: 2026-09-11T08:35:00Z  
**Status**: Investigation Complete — Ready for Implementation

---

## 1. Executive Summary & Root Cause Diagnosis

### 1.1 The Windows `TIME_WAIT` Socket Accumulation Problem
Under TCP (RFC 793), the endpoint that initiates the active close (sending the first `FIN` packet) transitions into the `TIME_WAIT` state. In the Windows TCP/IP stack (`tcpip.sys`), the default `TcpTimedWaitDelay` is 120 seconds, and the default ephemeral port pool spans 16,384 ports (49152–65535).

In Milestone M1 Iteration 1, the worker removed the header mutation in `src-tauri/src/commands.rs:1665` that previously forced `Connection: close`, intending to preserve `Connection: keep-alive`. However, **no connection pool or socket reuse mechanism was implemented**:
1. When the client sends `Connection: keep-alive`, a standard RFC 7230 HTTP/1.1 server leaves the TCP socket open waiting for subsequent requests.
2. Because neither `HttpDispatcher` nor `RepeaterExecutor` cached the connected socket, the client function completed and dropped the `TcpStream`.
3. In Rust, dropping `TcpStream` immediately invokes `closesocket()`, transmitting an active `FIN` from the client side.
4. Consequently, **the client endpoint (the pentester's Windows desktop) entered `TIME_WAIT` on every single request**.
5. When running high-throughput scans, fuzzing, or multi-tab Repeater replays, thousands of ephemeral ports were locked in `TIME_WAIT` for 2 minutes, directly triggering `WSAEADDRINUSE (10048)` socket exhaustion.

### 1.2 The HTTP Response Framing Defects (Challenger Findings)
Connection pooling requires strict HTTP message framing so the client knows exactly when a response ends without waiting for the connection to close. The Challenger 1 report revealed two critical regressions caused by preserving `keep-alive` without framing parsing:
1. **`RepeaterExecutor::execute_parallel_race` Hangs Indefinitely**:
   In `sentinel_repeater/src/executor.rs:587–602` (`send_plain_primed_race`) and `671–686` (`send_tls_primed_race`), the read loop contains:
   ```rust
   loop {
       match stream.read(&mut chunk).await {
           Ok(0) => break,
           Ok(n) => buffer.extend_from_slice(&chunk[..n]),
           Err(e) => return Err(...),
       }
   }
   ```
   This loop only breaks on EOF (`Ok(0)`). Against a persistent keep-alive server, the server keeps the socket open, causing the primed race worker threads to hang indefinitely with zero timeout.
2. **`HttpDispatcher::dispatch` 15-Second Latency Delay**:
   In `sentinel_dispatch/src/client.rs:313–339` (`send_plain`) and `371–396` (`send_tls`), the loop reads until `Ok(0)` or until `self.read_timeout` (default 15s) expires. Against a keep-alive server, every probe dispatched incurs a 15-second latency penalty.

### 1.3 Architectural Requirement
Milestone M1 Feature 2 requires a clean, thread-safe, high-performance TCP connection pool that:
- Keys idle connections by `(host, port, is_tls)`.
- Reuses healthy connected `TcpStream` and TLS streams across requests.
- Integrates complete RFC 7230 HTTP response framing (`Content-Length`, `Transfer-Encoding: chunked`, 1xx/204/304 status codes).
- Implements instantaneous, non-blocking health checks (`try_read`) to detect server-side disconnects before reuse.
- Supports pool limits (`max_idle_per_host`, `max_total_idle`, `idle_timeout`).
- Transparently retries on stale connections if a server disconnects during the acquisition window.

---

## 2. Cross-Crate Dependency Topology & Placement Strategy

A critical question is where the connection pool should reside in the modular architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop UI / src-tauri                   │
│         AppState (owns Arc<HttpConnectionPool>)             │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│       sentinel_repeater       │ │     sentinel_scanner    │
│  (RepeaterExecutor / Manager) │ │  sentinel_fuzzer        │
│                               │ │  sentinel_verification  │
│                               │ │  sentinel_auth / logic    │
└───────────────┬───────────────┘ └───────────┬───────────────┘
                │                             │
                │                             ▼
                │                ┌────────────────────────────┐
                │                │     sentinel_dispatch      │
                └───────────────►│    HttpDispatcher / Pool   │
                                 └────────────────────────────┘
```

### 2.1 Why `sentinel_dispatch` Must Own the Connection Pool
1. **Dependency Analysis**:
   - `sentinel_repeater/Cargo.toml` line 14: `sentinel_dispatch = { path = "../sentinel_dispatch" }`.
   - `sentinel_scanner`, `sentinel_fuzzer`, `sentinel_verification`, `sentinel_auth`, `sentinel_logic`, and `sentinel_agent` already depend on `sentinel_dispatch`.
   - Placing `HttpConnectionPool` in `sentinel_dispatch::pool` enables all 8 security engines and the desktop app shell to share the exact same pooling infrastructure without introducing circular dependencies or code duplication.

2. **Lifecycles in `sentinel_repeater` vs `sentinel_dispatch`**:
   - **`HttpDispatcher`**: Long-lived instance instantiated in `ScanOrchestrator`, `FuzzerEngine`, etc. Owning an internal `Arc<HttpConnectionPool>` allows it to automatically reuse sockets throughout a multi-thousand request test run.
   - **`RepeaterExecutor`**: Currently instantiated per request inside `src-tauri/src/commands.rs:1654` (`cmd_repeater_send_request`). If the pool were only an internal field of a newly created `RepeaterExecutor`, the pool would be destroyed when the command returns!
   - **Solution**: `AppState` in `src-tauri/src/state.rs` must store an `Arc<HttpConnectionPool>`. In `cmd_repeater_send_request`, this pool is passed into `RepeaterExecutor::with_pool(state.connection_pool.clone())`. This guarantees that user clicks across Repeater tabs reuse the persistent socket.

3. **Race Condition Testing Isolation**:
   - In `RepeaterExecutor::execute_parallel_race`, requests must hit the server **simultaneously**.
   - Reusing a single TCP connection would serialize HTTP/1.1 requests, destroying race synchronization.
   - Therefore, `execute_parallel_race` must continue to use dedicated parallel sockets per racing worker, but **must call the framing reader (`read_http_response`)** instead of looping until `Ok(0)`.

---

## 3. Detailed Design of `HttpConnectionPool`

### 3.1 Pool Keying
```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PoolKey {
    pub host: String,
    pub port: u16,
    pub is_tls: bool,
}

impl PoolKey {
    pub fn new(host: impl Into<String>, port: u16, is_tls: bool) -> Self {
        Self { host: host.into(), port, is_tls }
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
```

### 3.2 Unified Transport Abstraction (`PooledTransport`)
To support both plain HTTP and HTTPS with identical pooling semantics:

```rust
pub enum PooledTransport {
    Plain(tokio::net::TcpStream),
    Tls(tokio_rustls::client::TlsStream<tokio::net::TcpStream>),
}
```

#### Non-Blocking Health Check:
Before handing a pooled connection to an engine, we must verify that the remote server has not closed or reset it while it was idle.
In Tokio, `TcpStream::try_read(&self, buf: &mut [u8])` performs an instantaneous, non-blocking OS check:
- `Err(ref e) if e.kind() == ErrorKind::WouldBlock`: The connection is alive, open, and has no stale unread data. **HEALTHY**.
- `Ok(0)`: The remote peer transmitted `FIN`. The connection is closed. **DEAD**.
- `Ok(n)`: Unexpected unread bytes in buffer (out-of-sync or pipelined response). **DESYNCED / DISCARD**.
- `Err(_)`: Socket reset (`WSAECONNRESET`) or network abort. **DEAD**.

For `TlsStream<TcpStream>`, `tls_stream.get_ref().0` provides direct reference to the underlying `TcpStream`, allowing identical `try_read` health checking without decrypting!

```rust
impl PooledTransport {
    pub fn is_healthy(&self) -> bool {
        let mut buf = [0u8; 1];
        let res = match self {
            PooledTransport::Plain(s) => s.try_read(&mut buf),
            PooledTransport::Tls(s) => s.get_ref().0.try_read(&mut buf),
        };
        match res {
            Ok(0) => false,
            Ok(_) => false,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => true,
            Err(_) => false,
        }
    }
}
```

Furthermore, implementing `tokio::io::AsyncRead` and `tokio::io::AsyncWrite` for `PooledTransport` allows all writing, framing reading, and timeout logic to operate generically on `&mut PooledTransport`.

### 3.3 Thread Safety and Locking Invariants
1. **Lock Granularity**: The pool data structure is guarded by `parking_lot::Mutex<PoolInner>`.
2. **Zero Lock Across Async Await**: Sockets are NEVER dialed while holding the lock.
   - `try_acquire()` takes the lock, checks health, pops the connection, and releases the lock (< 1 microsecond).
   - If no idle connection exists, the lock is dropped before `TcpStream::connect(&addr).await` or TLS handshake occurs.
   - `release()` takes the lock, checks capacity, pushes to the queue, and releases the lock (< 1 microsecond).
3. **Bounded Capacity**:
   - `max_idle_per_host`: Default 16 connections.
   - `max_total_idle`: Default 128 connections.
   - `idle_timeout`: Default 45 seconds.
   - `connect_timeout`: Default 10 seconds.
4. **Periodic Reaper Task**:
   A background task runs periodically (e.g. every 15s) calling `pool.reap_idle()` to close connections that exceeded `idle_timeout`, preventing idle socket leaks during dormant periods.

### 3.4 HTTP/1.1 Framing Engine (`read_http_response_framed`)
To know whether a connection is safe to return to the pool:

```rust
pub struct ResponseReadResult {
    pub raw_response: Vec<u8>,
    pub is_reusable: bool,
}
```

1. **Header Parsing Phase**:
   - Accumulate bytes until `\r\n\r\n` (or `\n\n`) is reached.
   - Inspect status code:
     - 1xx (Informational), 204 (No Content), 304 (Not Modified): No message body. Complete immediately.
   - Inspect headers:
     - `Content-Length: X` -> Target body length is `X`.
     - `Transfer-Encoding: chunked` -> Chunked stream.
     - `Connection: close` -> Server signals close after response.
2. **Body Accumulation Phase**:
   - If `Content-Length: X`: Read until `buffer.len() >= header_end_offset + X`. Complete immediately!
   - If `Transfer-Encoding: chunked`: Read until chunked stream terminates with `\r\n0\r\n\r\n` or `0\r\n\r\n`. Complete immediately!
   - If neither: Body length delimited by connection close (read until `Ok(0)`). Mark `is_reusable = false`.
3. **Recycling Decision**:
   - If request contained `Connection: close` -> `can_reuse = false`.
   - If response contained `Connection: close` -> `can_reuse = false`.
   - If response had exact known framing and was completely read -> `can_reuse = true`.
   - If `can_reuse == true`: `pool.release(key, transport)`.
   - Else: Drop transport (OS closes socket).

### 3.5 Transparent Stale Retry
If a connection is acquired from the pool, but the remote server closes it in the minuscule timing window between `try_acquire` and `write_all`, the initial write or read fails with `ConnectionReset` or `BrokenPipe`.
When `is_reused == true`, `dispatch` catches this error, discards the dead connection, establishes a fresh connection via `pool.connect(&key).await`, and transparently retries the request once. This provides 100% resilience against keep-alive race conditions.

---

## 4. Concrete Code Implementation Plan

### 4.1 Crate `sentinel_dispatch`

#### [NEW FILE] `sentinel_core/crates/sentinel_dispatch/src/pool.rs`
Contains:
1. `PoolKey`: `(host, port, is_tls)`
2. `PooledTransport`: Enum wrapping `TcpStream` and `TlsStream<TcpStream>`, implementing `AsyncRead`, `AsyncWrite`, and `is_healthy()`.
3. `PoolConfig`: `max_idle_per_host`, `max_total_idle`, `idle_timeout`, `connect_timeout`.
4. `HttpConnectionPool`: Thread-safe pool managing `HashMap<PoolKey, VecDeque<IdleEntry>>`.
   - `acquire(&self, key: &PoolKey) -> Result<(PooledTransport, bool), SentinelError>`
   - `release(&self, key: PoolKey, transport: PooledTransport)`
   - `reap_idle(&self) -> usize`
   - `metrics(&self) -> PoolMetrics`
5. `read_http_response_framed<S: AsyncRead + Unpin>(stream: &mut S, read_timeout: Duration) -> Result<ResponseReadResult, SentinelError>`

#### [MODIFIED FILE] `sentinel_core/crates/sentinel_dispatch/src/lib.rs`
```rust
pub mod budget;
pub mod client;
pub mod pool; // <-- Add module

pub use budget::DispatchBudget;
pub use client::{DispatchResult, HttpDispatcher};
pub use pool::{HttpConnectionPool, PoolConfig, PoolKey, PooledTransport, PoolMetrics};
```

#### [MODIFIED FILE] `sentinel_core/crates/sentinel_dispatch/src/client.rs`
1. Add `pool: Arc<HttpConnectionPool>` to `HttpDispatcher`.
2. In `HttpDispatcher::new`, initialize `self.pool` using `HttpConnectionPool::new(PoolConfig::default(), self.tls_config.clone())`.
3. Add builder method `pub fn with_pool(mut self, pool: Arc<HttpConnectionPool>) -> Self`.
4. Refactor `HttpDispatcher::dispatch`:
   - Replace calls to `send_plain` / `send_tls` with:
   ```rust
   let pool_key = PoolKey::new(&host, port, is_https);
   let raw_response = self.dispatch_with_pool(&pool_key, raw_request).await?;
   ```
5. Implement `dispatch_with_pool`:
   - Acquire connection from `self.pool`.
   - Execute request bytes on transport. If reused connection fails on initial write/read, retry once with fresh connection.
   - Read response using `read_http_response_framed` with `self.read_timeout`.
   - If reusable (`res.is_reusable && !request_is_close`), call `self.pool.release(pool_key, transport)`.

---

### 4.2 Crate `sentinel_repeater`

#### [MODIFIED FILE] `sentinel_core/crates/sentinel_repeater/src/executor.rs`
1. Add `pool: Arc<sentinel_dispatch::HttpConnectionPool>` to `RepeaterExecutor`.
2. Add builder method `pub fn with_pool(mut self, pool: Arc<HttpConnectionPool>) -> Self`.
3. In `RepeaterExecutor::execute_raw`:
   - Use `self.pool.acquire(&pool_key)` and `self.pool.release(pool_key, transport)` for single request executions.
4. **Fix Challenger Critical Defect 1 in `send_plain_primed_race` (lines 587–602) and `send_tls_primed_race` (lines 671–686)**:
   - Replace the raw `loop { match stream.read(&mut chunk).await { Ok(0) => break, ... } }` with `Self::read_http_response(&mut stream).await`.
   - This ensures race worker threads terminate immediately when the HTTP response body is fully received, rather than waiting indefinitely for EOF on persistent keep-alive connections.

---

### 4.3 Crate `src-tauri`

#### [MODIFIED FILE] `src-tauri/src/state.rs`
Add `pub connection_pool: Arc<sentinel_dispatch::HttpConnectionPool>` to `AppState`:
```rust
pub struct AppState {
    // ...
    pub event_bus: Arc<SentinelEventBus>,
    pub connection_pool: Arc<sentinel_dispatch::HttpConnectionPool>, // <-- NEW
    pub proxy_engine: Arc<Mutex<Option<SentinelProxyEngine>>>,
}

impl AppState {
    pub fn new() -> Self {
        // ...
        let pool = Arc::new(sentinel_dispatch::HttpConnectionPool::default());
        Self {
            // ...
            connection_pool: pool,
            // ...
        }
    }
}
```

#### [MODIFIED FILE] `src-tauri/src/commands.rs`
In `cmd_repeater_send_request` (lines 1654–1655):
```rust
let mut executor = sentinel_repeater::RepeaterExecutor::new(scope_engine_arc)
    .with_event_bus(state.event_bus.clone())
    .with_pool(state.connection_pool.clone()); // <-- Pass shared pool
```
This guarantees that successive clicks in Repeater tabs reuse the open TCP/TLS connection instead of creating and dropping a new socket every time.

---

## 5. Verification Plan & Test Suite Recommendations

To independently and empirically verify the implementation, the following tests must be added to the test suite:

### Test 1: Genuine Socket Reuse & Zero TIME_WAIT
- **Scenario**: Send 50 sequential HTTP/1.1 requests to a mock persistent server via `HttpDispatcher`.
- **Assertion**:
  - The mock server records exactly `1` accepted TCP connection (`server_accept_count == 1`).
  - All 50 requests succeed with status 200.
  - No client-side sockets enter `TIME_WAIT`.

### Test 2: Framing-Based Immediate Return on Keep-Alive (Challenger Defect 2 Verification)
- **Scenario**: Send a request to a mock server that sends a 17-byte response with `Connection: keep-alive` and sleeps for 5 seconds without closing.
- **Assertion**:
  - `HttpDispatcher::dispatch` completes in `< 50ms` (proving it does NOT block for `read_timeout`).

### Test 3: Primed Race with Persistent Keep-Alive Server (Challenger Defect 1 Verification)
- **Scenario**: Run `RepeaterExecutor::execute_parallel_race` with 5 concurrent requests against a mock persistent keep-alive server.
- **Assertion**:
  - All 5 requests complete in `< 100ms`.
  - Zero thread hangs; `timing_spread_micros` correctly recorded.

### Test 4: Stale Connection Recovery
- **Scenario**: Acquire a connection, return it to the pool, and have the mock server explicitly close the connection.
- **Assertion**:
  - When the next request is dispatched, `HttpDispatcher` detects the closed socket via `is_healthy` (or transparent retry), dials a fresh socket, and succeeds with zero error.

### Test 5: 100-Worker Concurrency Under Pool Limit
- **Scenario**: Dispatch 100 requests across 10 workers to the same host with `max_idle_per_host: 10`.
- **Assertion**:
  - Total sockets opened on server is bounded (`<= 10`).
  - Total pooled connections after completion does not exceed `max_idle_per_host`.
  - 100% of requests succeed.

---

## 6. Security & Invariant Adherence

- **SEC-01 (Fail-Closed Scope Gate)**:
  Scope evaluation (`scope_engine.is_in_scope`) occurs strictly **before** pool acquisition or socket dialing. If out-of-scope, no socket is retrieved from the pool, no network transmission occurs, and a critical audit event is published.
- **SEC-06 & SEC-07 (Cryptographic CAS Proof)**:
  SHA-256 CAS dual-write tracking remains strictly active on both raw request and raw response bytes, completely agnostic of whether the socket was pooled or newly dialed.
- **SEC-09 (Secret Zeroization)**:
  Connection pooling operates at the raw byte / transport layer, with zero caching or leaking of plain-text credentials in pool logs.
