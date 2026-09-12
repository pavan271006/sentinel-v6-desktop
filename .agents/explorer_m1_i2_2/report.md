# Technical Investigation Report: HTTP Framing Detection for `HttpDispatcher`
**Milestone**: M1 Iteration 2 (Wire Forensics & Network Throughput Hardening)  
**Agent**: Explorer 2 (`teamwork_preview_explorer`)  
**Target Crate**: `sentinel_core/crates/sentinel_dispatch`  
**Target Source File**: `sentinel_core/crates/sentinel_dispatch/src/client.rs`  
**Reference Sources**: `sentinel_core/crates/sentinel_repeater/src/executor.rs`, `sentinel_core/crates/sentinel_parser/src/`  
**Date**: 2026-09-11  

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Defect
Milestone M1 Iteration 1 was rejected by Challenger 1 because `HttpDispatcher::dispatch` exhibits a catastrophic latency delay when targeting standard HTTP/1.1 persistent keep-alive servers:
- In `sentinel_core/crates/sentinel_dispatch/src/client.rs`:
  - Lines 313–339 (`send_plain`)
  - Lines 371–396 (`send_tls`)
- The response read loop executes `stream.read(&mut chunk)` inside an unbounded loop that only terminates upon:
  1. `Ok(0)` (EOF / TCP FIN from server)
  2. `read_timeout` expiration (default 15,000ms = 15 seconds)
- When targeting standard HTTP/1.1 servers that honor `Connection: keep-alive` (or default persistent connections), the server transmits the response headers and body, then maintains the TCP socket open awaiting further requests. The server never sends EOF (`Ok(0)`).
- Consequently, `HttpDispatcher` blocks on `stream.read()` until `self.read_timeout` fires. Only then does it break from the loop (because `!buffer.is_empty()`) and return the response.

### 1.2 System-Wide Impact
`HttpDispatcher` is the core dispatch pipeline used across multiple Sentinel subsystems:
- **`sentinel_scanner`**: High-concurrency active/passive vulnerability detection (SQLi, XSS, SSRF).
- **`sentinel_fuzzer`**: Payload mutation and perimeter fuzzing.
- **`sentinel_verification`**: Multi-oracle automated proof generation.
- **`sentinel_auth` & `sentinel_authz`**: Multi-role tenant matrix testing (BOLA, IDOR, BFLA).
- **`sentinel_logic`**: Business logic race condition and state machine exploration.

A 15-second latency delay per request against persistent servers reduces throughput from >1,000 requests/second to <1 request/second per worker, causing semaphore starvation in `dispatch_batch` and rendering automated scanning unusable.

---

## 2. HTTP/1.1 & RFC 9112 Framing Semantics

To determine when an HTTP response is complete without waiting for TCP connection closure (EOF), the dispatcher must conform to RFC 9112 §6 / RFC 7230 §3.3.3:

1. **Header Delimiter Detection**:
   An HTTP response begins with headers terminated by `\r\n\r\n` (CRLF CRLF) or `\n\n` (LF LF for fault tolerance). Until this boundary is observed, the response is incomplete.
2. **Status Codes with Zero Message Body**:
   RFC 9112 §6.3 specifies that:
   - Any `1xx` Informational response (100–199, e.g. `100 Continue`, `101 Switching Protocols`)
   - `204 No Content`
   - `304 Not Modified`
   MUST NOT contain a message body. The response is complete immediately upon reaching the header delimiter.
3. **`HEAD` Requests**:
   RFC 9112 §6.3 specifies that responses to `HEAD` requests never contain a message body, regardless of any `Content-Length` header present.
4. **`Transfer-Encoding: chunked`**:
   Per RFC 9112 §6.1, if `Transfer-Encoding` is present and specifies `chunked`, it overrides any `Content-Length` header. The body is framed as a series of hexadecimal-sized chunks ending with a terminating zero-chunk (`0\r\n\r\n`, or `0;ext=val\r\n\r\n`, or `0\r\n` followed by trailer headers and `\r\n\r\n`).
5. **`Content-Length: <n>`**:
   If `Content-Length` is present without `Transfer-Encoding: chunked`, the message body length is exactly `n` octets. Total expected message length is `header_end_offset + n`. As soon as `buffer.len() >= header_end_offset + n`, the response is complete.
6. **Close-Delimited (Fallback)**:
   In the absence of (2), (3), (4), and (5), the response body is delimited by the server closing the TCP connection (EOF `Ok(0)`).

---

## 3. Architecture & Proposed Fix Strategy

### 3.1 Design Principles
1. **Zero Unnecessary Socket Blocking**: As soon as framing conditions are satisfied, `break` immediately without issuing another `stream.read()`.
2. **Unified Helper Function**: Eliminate duplicate read logic between `send_plain` and `send_tls` by implementing a generic asynchronous helper `read_http_response<S: AsyncRead + Unpin>`.
3. **Respect Configured `read_timeout`**: Bounded by `self.read_timeout` using elapsed time calculation (`self.read_timeout - elapsed`), preserving slow-probe tolerances (e.g. 5-second SQL time-based blind injection) while preventing infinite hangs.
4. **Leverage Existing `sentinel_parser`**: `sentinel_dispatch` already depends on `sentinel_parser`. We can leverage `sentinel_parser::ChunkedDecoder` to handle trailers and chunk extensions safely with zero regex overhead.

### 3.2 Detection State Machine
The helper maintains:
- `headers_parsed: bool`: False until header delimiter (`\r\n\r\n` or `\n\n`) is discovered.
- `header_end_offset: usize`: Position where headers end and body begins.
- `no_body_expected: bool`: True if status code is 1xx, 204, 304, or request is HEAD.
- `is_chunked: bool`: True if `transfer-encoding` header contains `"chunked"`.
- `content_length: Option<usize>`: Parsed numeric value of `content-length` header.

Upon each read chunk:
1. Append `chunk[..n]` to `buffer`.
2. If `!headers_parsed`, scan for `\r\n\r\n` (or `\n\n`). If found:
   - Mark `headers_parsed = true`.
   - Parse status line -> extract status code; if `(100..=199).contains(&code) || code == 204 || code == 304`, set `no_body_expected = true`.
   - Iterate header lines (case-insensitive):
     - `content-length:` -> parse `usize`.
     - `transfer-encoding:` -> check for `"chunked"`.
3. If `headers_parsed`:
   - If `no_body_expected`: **`break` immediately**.
   - If `is_chunked`:
     - Fast path: check `buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")`.
     - Robust RFC path: decode body via `sentinel_parser::ChunkedDecoder::decode(&buffer[header_end_offset..], usize::MAX)`. If `Ok(_)`, **`break` immediately**.
   - If `let Some(cl) = content_length`:
     - If `buffer.len() >= header_end_offset + cl`: **`break` immediately**.
4. If EOF (`Ok(0)`), `break`.
5. If timeout occurs:
   - If `!buffer.is_empty()`, return partial buffer (graceful handling of non-conforming servers).
   - If `buffer.is_empty()`, return `SentinelError::NetworkError(format!("Read timeout from {}", addr))`.

---

## 4. Exact Code Diffs (Unified Patch Format)

### 4.1 Target File: `sentinel_core/crates/sentinel_dispatch/src/client.rs`

```diff
--- a/sentinel_core/crates/sentinel_dispatch/src/client.rs
+++ b/sentinel_core/crates/sentinel_dispatch/src/client.rs
@@ -307,67 +307,112 @@ impl HttpDispatcher {
         stream
             .write_all(request_bytes)
             .await
             .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;
 
-        let mut buffer = Vec::with_capacity(8192);
-        let mut chunk = [0u8; 4096];
-        loop {
-            let read_fut = stream.read(&mut chunk);
-            let n = match tokio::time::timeout(self.read_timeout, read_fut).await {
-                Ok(Ok(0)) => break,
-                Ok(Ok(n)) => n,
-                Ok(Err(e)) => {
-                    return Err(SentinelError::NetworkError(format!(
-                        "Failed to read response: {}",
-                        e
-                    )))
-                }
-                Err(_) => {
-                    if !buffer.is_empty() {
-                        // Return what we received before read timeout
-                        break;
-                    }
-                    return Err(SentinelError::NetworkError(format!(
-                        "Read timeout from {}",
-                        addr
-                    )));
-                }
-            };
-            buffer.extend_from_slice(&chunk[..n]);
-        }
-
-        Ok(buffer)
+        let is_head = request_bytes.starts_with(b"HEAD ") || request_bytes.starts_with(b"head ");
+        self.read_http_response(&mut stream, addr, is_head).await
     }
 
     async fn send_tls(
         &self,
         addr: &str,
         host: &str,
         request_bytes: &[u8],
     ) -> Result<Vec<u8>, SentinelError> {
         let connector = TlsConnector::from(self.tls_config.clone());
         let connect_fut = TcpStream::connect(addr);
         let stream = tokio::time::timeout(self.connect_timeout, connect_fut)
             .await
             .map_err(|_| SentinelError::NetworkError(format!("Connection timeout to {}", addr)))?
             .map_err(|e| SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e)))?;
         stream.set_nodelay(true).ok();
 
         let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
             SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
         })?;
 
         let handshake_fut = connector.connect(server_name, stream);
         let mut tls_stream = tokio::time::timeout(self.connect_timeout, handshake_fut)
             .await
             .map_err(|_| SentinelError::TlsError(format!("TLS handshake timeout with {}", host)))?
             .map_err(|e| SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e)))?;
 
         tls_stream.write_all(request_bytes).await.map_err(|e| {
             SentinelError::NetworkError(format!("Failed to write TLS request: {}", e))
         })?;
 
+        let is_head = request_bytes.starts_with(b"HEAD ") || request_bytes.starts_with(b"head ");
+        self.read_http_response(&mut tls_stream, addr, is_head).await
+    }
+
+    /// Asynchronously reads an HTTP response from stream with RFC 9112 framing detection.
+    /// Completes as soon as the response body is fully received without waiting for timeout or EOF.
+    pub async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
+        &self,
+        stream: &mut S,
+        addr: &str,
+        is_head: bool,
+    ) -> Result<Vec<u8>, SentinelError> {
         let mut buffer = Vec::with_capacity(8192);
         let mut chunk = [0u8; 4096];
+        let mut headers_parsed = false;
+        let mut content_length: Option<usize> = None;
+        let mut is_chunked = false;
+        let mut no_body_expected = is_head;
+        let mut header_end_offset = 0;
+
+        let start_read = Instant::now();
+
         loop {
-            let read_fut = tls_stream.read(&mut chunk);
-            let n = match tokio::time::timeout(self.read_timeout, read_fut).await {
-                Ok(Ok(0)) => break,
+            let elapsed = start_read.elapsed();
+            if elapsed >= self.read_timeout {
+                if !buffer.is_empty() {
+                    break;
+                }
+                return Err(SentinelError::NetworkError(format!(
+                    "Read timeout from {}",
+                    addr
+                )));
+            }
+            let remaining = self.read_timeout - elapsed;
+
+            let read_fut = stream.read(&mut chunk);
+            let n = match tokio::time::timeout(remaining, read_fut).await {
+                Ok(Ok(0)) => break, // EOF reached: server closed connection
                 Ok(Ok(n)) => n,
                 Ok(Err(e)) => {
+                    if !buffer.is_empty() {
+                        break;
+                    }
                     return Err(SentinelError::NetworkError(format!(
-                        "Failed to read TLS response: {}",
+                        "Failed to read response: {}",
                         e
-                    )))
+                    )));
                 }
                 Err(_) => {
                     if !buffer.is_empty() {
                         break;
                     }
                     return Err(SentinelError::NetworkError(format!(
-                        "TLS read timeout from {}",
+                        "Read timeout from {}",
                         addr
                     )));
                 }
             };
+
             buffer.extend_from_slice(&chunk[..n]);
+
+            // Parse headers as soon as end of header block is observed
+            if !headers_parsed {
+                let found_delim = if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
+                    Some(pos + 4)
+                } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
+                    Some(pos + 2)
+                } else {
+                    None
+                };
+
+                if let Some(offset) = found_delim {
+                    header_end_offset = offset;
+                    headers_parsed = true;
+
+                    let header_bytes = &buffer[..header_end_offset];
+                    let header_str = String::from_utf8_lossy(header_bytes);
+
+                    let mut lines = header_str.lines();
+                    if let Some(status_line) = lines.next() {
+                        let mut parts = status_line.split_whitespace();
+                        let _version = parts.next();
+                        if let Some(code_str) = parts.next() {
+                            if let Ok(code) = code_str.parse::<u16>() {
+                                if (100..=199).contains(&code) || code == 204 || code == 304 {
+                                    no_body_expected = true;
+                                }
+                            }
+                        }
+                    }
+
+                    for line in lines {
+                        let line_lower = line.to_ascii_lowercase();
+                        if let Some(val) = line_lower.strip_prefix("content-length:") {
+                            if let Some(first) = val.trim().split(',').next() {
+                                if let Ok(cl) = first.trim().parse::<usize>() {
+                                    content_length = Some(cl);
+                                }
+                            }
+                        } else if let Some(val) = line_lower.strip_prefix("transfer-encoding:") {
+                            if val.contains("chunked") {
+                                is_chunked = true;
+                            }
+                        }
+                    }
+                }
+            }
+
+            // Check framing completion
+            if headers_parsed {
+                if no_body_expected {
+                    break;
+                }
+                if is_chunked {
+                    // Fast path: terminating zero-chunk without trailers
+                    if buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n") {
+                        break;
+                    }
+                    // Full RFC path: support chunk extensions and trailer headers
+                    let body_slice = &buffer[header_end_offset..];
+                    if body_slice.iter().any(|&b| b == b'0') {
+                        if sentinel_parser::ChunkedDecoder::decode(body_slice, usize::MAX).is_ok() {
+                            break;
+                        }
+                    }
+                } else if let Some(cl) = content_length {
+                    if buffer.len() >= header_end_offset + cl {
+                        break;
+                    }
+                }
+            }
         }
 
         Ok(buffer)
     }
```

---

### 4.2 Companion Patch for `sentinel_repeater/src/executor.rs`
For complete Milestone M1 resolution, the Worker should also apply this patch to eliminate the parallel race hang in `sentinel_repeater`:

```diff
--- a/sentinel_core/crates/sentinel_repeater/src/executor.rs
+++ b/sentinel_core/crates/sentinel_repeater/src/executor.rs
@@ -586,16 +586,3 @@
-            let mut buffer = Vec::with_capacity(4096);
-            let mut chunk = [0u8; 4096];
-            loop {
-                match stream.read(&mut chunk).await {
-                    Ok(0) => break,
-                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
-                    Err(e) => {
-                        return Err(SentinelError::NetworkError(format!(
-                            "Failed to read response: {}",
-                            e
-                        )))
-                    }
-                }
-            }
+            let buffer = Self::read_http_response(&mut stream).await?;
@@ -611,16 +598,3 @@
-            let mut buffer = Vec::with_capacity(4096);
-            let mut chunk = [0u8; 4096];
-            loop {
-                match stream.read(&mut chunk).await {
-                    Ok(0) => break,
-                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
-                    Err(e) => {
-                        return Err(SentinelError::NetworkError(format!(
-                            "Failed to read response: {}",
-                            e
-                        )))
-                    }
-                }
-            }
+            let buffer = Self::read_http_response(&mut stream).await?;
@@ -670,16 +644,3 @@
-            let mut buffer = Vec::with_capacity(4096);
-            let mut chunk = [0u8; 4096];
-            loop {
-                match tls_stream.read(&mut chunk).await {
-                    Ok(0) => break,
-                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
-                    Err(e) => {
-                        return Err(SentinelError::NetworkError(format!(
-                            "Failed to read TLS response: {}",
-                            e
-                        )))
-                    }
-                }
-            }
+            let buffer = Self::read_http_response(&mut tls_stream).await?;
@@ -696,16 +657,3 @@
-            let mut buffer = Vec::with_capacity(4096);
-            let mut chunk = [0u8; 4096];
-            loop {
-                match tls_stream.read(&mut chunk).await {
-                    Ok(0) => break,
-                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
-                    Err(e) => {
-                        return Err(SentinelError::NetworkError(format!(
-                            "Failed to read TLS response: {}",
-                            e
-                        )))
-                    }
-                }
-            }
+            let buffer = Self::read_http_response(&mut tls_stream).await?;
```

---

## 5. Verification Test Suite

The following comprehensive tests should be added to `sentinel_core/crates/sentinel_dispatch/tests/dispatch_tests.rs`:

```rust
#[tokio::test]
async fn test_dispatch_persistent_keepalive_content_length() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                if n > 0 {
                    let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\nConnection: keep-alive\r\n\r\ndispatch_finished";
                    let _ = stream.write_all(resp).await;
                    // Keep socket open: do NOT send EOF
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    // With 5s read_timeout, execution must finish in under 200ms due to framing detection
    let dispatcher = HttpDispatcher::new(Arc::new(scope))
        .with_timeouts(tokio::time::Duration::from_secs(2), tokio::time::Duration::from_secs(5));
    let target_url = format!("http://127.0.0.1:{}/dispatch", port);
    let raw_req = format!("GET /dispatch HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n", port);

    let start = std::time::Instant::now();
    let result = dispatcher.dispatch(&target_url, raw_req.as_bytes(), 1).await.expect("Dispatch succeeds");
    let elapsed = start.elapsed();

    assert!(
        elapsed < tokio::time::Duration::from_millis(200),
        "Dispatch must complete immediately upon reading Content-Length body, took {:?}",
        elapsed
    );
    assert_eq!(result.status_code, Some(200));
    assert_eq!(result.parsed_response.unwrap().body, b"dispatch_finished");
}

#[tokio::test]
async fn test_dispatch_persistent_keepalive_chunked() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n5\r\nalpha\r\n4\r\nbeta\r\n0\r\n\r\n";
                        let _ = stream.write_all(resp).await;
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = HttpDispatcher::new(Arc::new(scope))
        .with_timeouts(tokio::time::Duration::from_secs(2), tokio::time::Duration::from_secs(5));
    let target_url = format!("http://127.0.0.1:{}/chunked", port);
    let raw_req = format!("GET /chunked HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n", port);

    let start = std::time::Instant::now();
    let result = dispatcher.dispatch(&target_url, raw_req.as_bytes(), 1).await.expect("Dispatch succeeds");
    let elapsed = start.elapsed();

    assert!(elapsed < tokio::time::Duration::from_millis(200));
    assert_eq!(result.status_code, Some(200));
    assert_eq!(result.parsed_response.unwrap().body, b"alphabeta");
}

#[tokio::test]
async fn test_dispatch_persistent_keepalive_204_no_content() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 204 No Content\r\nConnection: keep-alive\r\n\r\n";
                        let _ = stream.write_all(resp).await;
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = HttpDispatcher::new(Arc::new(scope))
        .with_timeouts(tokio::time::Duration::from_secs(2), tokio::time::Duration::from_secs(5));
    let target_url = format!("http://127.0.0.1:{}/nocontent", port);
    let raw_req = format!("GET /nocontent HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n", port);

    let start = std::time::Instant::now();
    let result = dispatcher.dispatch(&target_url, raw_req.as_bytes(), 1).await.expect("Dispatch succeeds");
    let elapsed = start.elapsed();

    assert!(elapsed < tokio::time::Duration::from_millis(200));
    assert_eq!(result.status_code, Some(204));
    assert!(result.parsed_response.unwrap().body.is_empty());
}

#[tokio::test]
async fn test_dispatch_head_request_framing() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        // Response specifies Content-Length: 5000, but per RFC sends 0 body bytes
                        let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 5000\r\nConnection: keep-alive\r\n\r\n";
                        let _ = stream.write_all(resp).await;
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = HttpDispatcher::new(Arc::new(scope))
        .with_timeouts(tokio::time::Duration::from_secs(2), tokio::time::Duration::from_secs(5));
    let target_url = format!("http://127.0.0.1:{}/head", port);
    let raw_req = format!("HEAD /head HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n", port);

    let start = std::time::Instant::now();
    let result = dispatcher.dispatch(&target_url, raw_req.as_bytes(), 1).await.expect("Dispatch succeeds");
    let elapsed = start.elapsed();

    assert!(elapsed < tokio::time::Duration::from_millis(200));
    assert_eq!(result.status_code, Some(200));
}
```

---

## 6. Verification Method

To independently verify the fix once implemented by Worker:

1. **Run Unit & Integration Tests**:
   ```powershell
   cargo test -p sentinel_dispatch --test dispatch_tests
   ```
   All tests (including new persistent keep-alive tests) must pass with zero failures and sub-second elapsed times.

2. **Run Empirical Challenge Suite**:
   ```powershell
   cargo test -p sentinel_repeater --test empirical_challenge_test -- --nocapture
   ```
   - In `test_dispatcher_with_persistent_keepalive_server`:
     Update the assertion from `assert!(elapsed >= 290ms)` to `assert!(elapsed < 50ms)`.
     Observed latency should drop from `306ms` to `< 5ms`.
   - In `test_repeater_race_with_persistent_keepalive_server`:
     The test should immediately report `[PASS/UNEXPECTED] Race completed` instead of hanging for 2 seconds.

3. **Verify Workspace Invariants**:
   ```powershell
   cargo check --workspace --locked
   cargo clippy --workspace --all-targets --all-features
   ```
   Must pass with 0 errors and 0 warnings.

---

## 7. Interaction with Feature 2 (TCP Connection Pooling)

Challenger 1 noted that preserving `Connection: keep-alive` without socket reuse causes the client to send TCP FIN upon dropping `TcpStream`, which moves the local endpoint into `TIME_WAIT` (120s on Windows).

By implementing HTTP framing detection in `HttpDispatcher`:
1. The socket stream is now cleanly positioned at the exact boundary where the current HTTP response ends and the next HTTP request can begin.
2. Sockets can be safely stored in an active connection pool (`std::collections::HashMap<String, Vec<PooledConnection>>` or `deadpool`) keyed by `authority` (`host:port`).
3. Subsequent `dispatch` calls to the same host can pop an existing open connection from the pool, eliminating both TCP 3-way handshakes, TLS handshakes, and `TIME_WAIT` ephemeral port exhaustion.
