# Handoff Report: Explorer 3 — TCP Connection Pooling & Keep-Alive Reuse

**Agent**: Explorer 3 (`teamwork_preview_explorer`)  
**Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_3`  
**Parent Conversation ID**: `94d601fe-cc12-4b39-babd-492e9642f362`  
**Milestone**: M1 Iteration 2 (Wire Forensics & Network Throughput Hardening)  
**Date**: 2026-09-11T08:35:00Z  
**Type**: Hard Handoff (Investigation Complete)

---

## 1. Observation

1. **Missing Connection Pool in Codebase**:
   - `sentinel_core/crates/sentinel_dispatch/src/client.rs`:
     - Lines 300–307 (`send_plain`):
       ```rust
       let connect_fut = TcpStream::connect(addr);
       let mut stream = tokio::time::timeout(self.connect_timeout, connect_fut)
           .await
           ...;
       stream.set_nodelay(true).ok();
       ```
     - Lines 350–356 (`send_tls`):
       ```rust
       let connect_fut = TcpStream::connect(addr);
       let stream = tokio::time::timeout(self.connect_timeout, connect_fut)
           .await
           ...;
       stream.set_nodelay(true).ok();
       ```
     - Every single invocation dials a brand new TCP connection (`TcpStream::connect(addr)`). There is no connection cache, map, or pool structure in `sentinel_dispatch`.
   - `sentinel_core/crates/sentinel_repeater/src/executor.rs`:
     - Lines 265–268 (`send_plain`): `let mut stream = TcpStream::connect(addr).await...`
     - Lines 285–288 (`send_tls`): `let stream = TcpStream::connect(addr).await...`
     - Lines 563–566 (`send_plain_primed_race`): `let mut stream = TcpStream::connect(addr).await...`
     - Lines 639–642 (`send_tls_primed_race`): `let stream = TcpStream::connect(addr).await...`
     - All 4 connection sites dial new sockets on every invocation with zero socket reuse.
   - `src-tauri/src/commands.rs`:
     - Lines 1654–1655 (`cmd_repeater_send_request`):
       ```rust
       let mut executor = sentinel_repeater::RepeaterExecutor::new(scope_engine_arc)
           .with_event_bus(state.event_bus.clone());
       ```
     - `RepeaterExecutor` is instantiated as a local ephemeral variable on every incoming command, meaning any local state on `RepeaterExecutor` is dropped as soon as `cmd_repeater_send_request` exits.

2. **Challenger Empirical Test Results (`empirical_challenge_test.rs`)**:
   - Running `cargo nextest run --manifest-path sentinel_core/Cargo.toml -p sentinel_repeater --test empirical_challenge_test`:
     - Test 5 (`test_dispatcher_with_persistent_keepalive_server`) took **0.376s** against a 300ms timeout server because `HttpDispatcher` lacks framing parsing and waits for the full read timeout.
     - Test 6 (`test_repeater_race_with_persistent_keepalive_server`) took **2.034s** because `execute_parallel_race` hung until the outer test timeout fired.
     - Tests 1, 2, 3, 4 passed.

3. **Crate Dependency Topology**:
   - In `sentinel_core/crates/sentinel_repeater/Cargo.toml` line 14:
     `sentinel_dispatch = { path = "../sentinel_dispatch" }`
   - In `src-tauri/Cargo.toml` lines 25–42:
     Both `sentinel_repeater` and `sentinel_dispatch` (via workspace transitive dependencies) are integrated.
   - `sentinel_scanner`, `sentinel_fuzzer`, `sentinel_verification`, `sentinel_auth`, `sentinel_logic`, and `sentinel_agent` all depend directly on `sentinel_dispatch`.

4. **Socket Option & Health Check Capabilities**:
   - `tokio::net::TcpStream::try_read(&self, buf: &mut [u8])` is a non-blocking check:
     - Returns `Err(ErrorKind::WouldBlock)` when the connection is open and idle.
     - Returns `Ok(0)` when the remote end has sent FIN (closed).
   - In `tokio_rustls::client::TlsStream<TcpStream>`, the inner `TcpStream` is directly accessible via `tls_stream.get_ref().0`.

---

## 2. Logic Chain

1. **Why Removing Header Mutation Without a Pool Causes TIME_WAIT Exhaustion**:
   - RFC 793 states that the endpoint initiating active close transitions into `TIME_WAIT`.
   - On Windows, `TcpTimedWaitDelay` keeps sockets in `TIME_WAIT` for 120 seconds.
   - With `Connection: keep-alive` preserved, the server keeps the socket open waiting for further requests (Observation 1).
   - Because neither `HttpDispatcher` nor `RepeaterExecutor` pools connections, the client drops `TcpStream` immediately upon receiving the response (Observation 1).
   - Dropping `TcpStream` sends an active client `FIN`, placing the client endpoint into `TIME_WAIT`.
   - Preserving `keep-alive` without a pool therefore inverts the connection closure model, causing local ephemeral port exhaustion (`WSAEADDRINUSE 10048`) under load.

2. **Why HTTP Framing is the Prerequisite for Connection Pooling**:
   - To return a connection to a pool, the client must know with 100% certainty that the current HTTP response has been completely read and that no trailing bytes remain in the socket buffer.
   - In `execute_parallel_race`, worker threads looped until EOF (`Ok(0)`), causing an infinite hang on keep-alive servers (Observation 2).
   - In `HttpDispatcher`, the read loop waited for EOF or read timeout (Observation 1, 2).
   - Integrating full HTTP framing (`Content-Length`, `Transfer-Encoding: chunked`, 1xx/204/304 status codes) allows immediate response completion (< 1ms) and safe socket recycling.

3. **Placement and Thread-Safety Rationale**:
   - Since `sentinel_repeater` already depends on `sentinel_dispatch` (Observation 3), placing the pool in `sentinel_dispatch::pool::HttpConnectionPool` provides a single authoritative pooling implementation for all 8 security subsystems.
   - `HttpConnectionPool` can be keyed by `PoolKey { host, port, is_tls }` and store `PooledTransport` (wrapping `TcpStream` and `TlsStream<TcpStream>`).
   - Guiding internal queues with `parking_lot::Mutex` and executing all asynchronous socket operations (`connect().await`, `read().await`, `write().await`) outside the lock guarantees zero lock contention and zero deadlocks.
   - In `src-tauri`, storing `Arc<HttpConnectionPool>` in `AppState` and passing it to `RepeaterExecutor` via `with_pool` ensures that repeated user clicks across tabs share persistent sockets rather than discarding them when the command returns (Observation 1).

4. **Transparent Stale Connection Handling**:
   - Sockets idle in the pool can be closed asynchronously by the server.
   - Calling `try_read` before loaning a socket from the pool filters out dead connections instantaneously (Observation 4).
   - Retrying once on a fresh socket if a reused connection fails on initial write/read eliminates race conditions where the server closes the connection during the acquisition slice.

---

## 3. Caveats

1. **Race Condition Testing Isolation**:
   In `RepeaterExecutor::execute_parallel_race`, racing requests must NOT share a single pooled connection. Reusing a single connection would serialize HTTP/1.1 requests, defeating barrier synchronization and race condition discovery. Parallel race workers must continue using dedicated sockets, while using `read_http_response` to avoid keep-alive hangs.
2. **HTTP/2 & HTTP/3 Considerations**:
   This architecture focuses on HTTP/1.1 TCP and TLS connection pooling. HTTP/2 multiplexes over a single connection and HTTP/3 uses QUIC/UDP, which are governed by distinct framing protocols.
3. **Custom Proxies / Upstreams**:
   If an upstream HTTP proxy is configured in the future, the `PoolKey` should incorporate the proxy endpoint rather than the origin destination.

---

## 4. Conclusion

Milestone M1 Feature 2 ("TCP connection pooling & keep-alive reuse in repeater/dispatcher") can be cleanly, safely, and completely resolved through the following concrete changes:

1. **Add `sentinel_core/crates/sentinel_dispatch/src/pool.rs`**:
   Implement `HttpConnectionPool`, `PoolKey`, `PooledTransport`, `PoolConfig`, and `read_http_response_framed`.
2. **Refactor `sentinel_dispatch::client::HttpDispatcher`**:
   Incorporate `Arc<HttpConnectionPool>`, delegate dispatch to pooled connections with transparent stale retry, and replace the 15-second timeout read loop with framed reading.
3. **Fix `sentinel_repeater::executor::RepeaterExecutor`**:
   - Fix `send_plain_primed_race` and `send_tls_primed_race` by calling `read_http_response` to resolve Challenger Defect 1.
   - Add `with_pool` to `RepeaterExecutor` and integrate pooling into `execute_raw`.
4. **Wire `AppState` in `src-tauri`**:
   Store `pub connection_pool: Arc<HttpConnectionPool>` in `AppState` and pass `state.connection_pool.clone()` into `RepeaterExecutor` in `cmd_repeater_send_request`.
5. **Empirical Verification**:
   Verify that 50 sequential requests to a persistent server generate only 1 TCP connection on the server, with zero client-side `TIME_WAIT` accumulation, `< 1ms` subsequent latency, and zero race hangs.

Detailed code architecture, structs, and methods are fully documented in `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_3\report.md`.

---

## 5. Verification Method

1. **Inspect Architecture Report**:
   ```bash
   view_file AbsolutePath="c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m1_i2_3\report.md"
   ```
2. **Run Challenger Test Suite (Current Baseline)**:
   ```bash
   cargo nextest run --manifest-path sentinel_core/Cargo.toml -p sentinel_repeater --test empirical_challenge_test
   ```
   - Current status: Test 5 blocks for 300ms, Test 6 times out after 2s.
3. **Run Full Workspace Compilation Check**:
   ```bash
   cargo check --workspace --manifest-path sentinel_core/Cargo.toml
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
