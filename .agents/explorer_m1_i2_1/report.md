# Milestone M1 Iteration 2 — Explorer 1 Technical Investigation Report
**Subsystem**: `sentinel_repeater` Raw Socket Execution & Primed Race Engine  
**Target File**: `sentinel_core/crates/sentinel_repeater/src/executor.rs`  
**Author**: Explorer 1 (`teamwork_preview_explorer`)  
**Parent Conversation ID**: `94d601fe-cc12-4b39-babd-492e9642f362`  
**Date**: 2026-09-11T08:30:00Z  

---

## 1. Executive Summary

Milestone M1 Iteration 1 was **REJECTED** by Challenger 1 due to a critical defect in single-packet race synchronization:
In `sentinel_core/crates/sentinel_repeater/src/executor.rs:587-602` (`send_plain_primed_race`) and lines `671-686` (`send_tls_primed_race`), the socket read loop waits exclusively for an EOF signal (`Ok(0)`). When `execute_parallel_race` targets standard HTTP/1.1 persistent servers (which maintain open TCP connections under `Connection: keep-alive`), the server never closes the socket, causing all racing worker tasks to **hang indefinitely** until killed by external timeouts.

Conversely, `RepeaterExecutor::execute_raw` executes against the identical persistent server in **sub-millisecond latency (< 1ms)** because it delegates to `Self::read_http_response`, which parses HTTP/1.1 message framing (`Content-Length` and `Transfer-Encoding: chunked`).

This investigation provides:
1. A root-cause code analysis of the defect in `send_plain_primed_race` and `send_tls_primed_race`.
2. A deep-dive audit of `read_http_response`, identifying two latent defects (premature body truncation on 500ms timeout slices and 80ms delay on 204/304 responses) and providing a hardened implementation.
3. The exact code refactoring and unified diff to adapt `read_http_response` for `send_plain_primed_race` and `send_tls_primed_race`.
4. A complete verification test suite to prove zero hangs, immediate keep-alive termination, and preserved microsecond race synchronization.

---

## 2. Root Cause Analysis: The Indefinite Hang in Primed Race Execution

### 2.1 Code Inspection

In `sentinel_core/crates/sentinel_repeater/src/executor.rs`, lines 558–629 (`send_plain_primed_race`):
```rust
    async fn send_plain_primed_race(
        addr: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let mut stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            stream.write_all(head).await...;
            let _ = stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            stream.write_all(last).await...;
            let _ = stream.flush().await;

            // DEFECTIVE READ LOOP 1:
            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break, // Only breaks on EOF!
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => return Err(SentinelError::NetworkError(format!("Failed to read response: {}", e))),
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            stream.write_all(request_bytes).await...;
            let _ = stream.flush().await;

            // DEFECTIVE READ LOOP 2 (DUPLICATED):
            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break, // Only breaks on EOF!
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => return Err(SentinelError::NetworkError(format!("Failed to read response: {}", e))),
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        }
    }
```

The exact same duplication and defective read loops occur in `send_tls_primed_race` (lines 671–686 and lines 697–711) over `tls_stream`.

### 2.2 Mechanism of Failure

1. **Protocol Asymmetry**:
   - In HTTP/1.0 or non-keep-alive HTTP/1.1 (`Connection: close`), the server writes the response and immediately calls `close()` on the TCP socket. The client's `stream.read()` returns `Ok(0)`, exiting the loop.
   - Under standard RFC 7230 HTTP/1.1 (the default when `Connection: keep-alive` is preserved), the server transmits `HTTP/1.1 200 OK`, `Content-Length: X`, and the body, but **maintains the TCP connection open** waiting for the next request on the same socket.
2. **Infinite Blocking**:
   - `stream.read(&mut chunk)` has **no timeout wrapper** in `send_plain_primed_race` and `send_tls_primed_race`.
   - Because the server does not send EOF, `stream.read(&mut chunk).await` blocks indefinitely on the operating system socket.
3. **Empirical Reproduction**:
   - Verified via `cargo test -p sentinel_repeater --test empirical_challenge_test -- test_repeater_race_with_persistent_keepalive_server --nocapture`.
   - Result: `execute_parallel_race` hung until the outer test timeout (2.092s) fired:
     `[CRITICAL FINDING] execute_parallel_race HUNG on persistent keep-alive server! send_plain_primed_race lacks framing/timeout and waits for EOF!`

---

## 3. Deep-Dive Audit of `read_http_response`

`RepeaterExecutor::read_http_response` (lines 305–401) was written to solve this exact problem for `execute_raw`. Let us examine its structure and identify both its strengths and latent issues.

### 3.1 Existing Implementation

```rust
    async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
        stream: &mut S,
    ) -> Result<Vec<u8>, SentinelError> {
        let mut buffer = Vec::with_capacity(16384);
        let mut chunk = [0u8; 16384];
        let mut headers_parsed = false;
        let mut content_length: Option<usize> = None;
        let mut is_chunked = false;
        let mut header_end_offset = 0;

        let total_timeout = std::time::Duration::from_secs(12);
        let start_read = std::time::Instant::now();

        loop {
            if start_read.elapsed() > total_timeout {
                break;
            }

            let read_timeout = if headers_parsed {
                if content_length.is_some() || is_chunked {
                    std::time::Duration::from_millis(500)
                } else {
                    std::time::Duration::from_millis(80)
                }
            } else {
                std::time::Duration::from_millis(1500)
            };

            let read_future = stream.read(&mut chunk);
            let n = match tokio::time::timeout(read_timeout, read_future).await {
                Ok(Ok(0)) => break,
                Ok(Ok(n)) => n,
                Ok(Err(e)) => {
                    if !buffer.is_empty() {
                        break;
                    }
                    return Err(SentinelError::NetworkError(format!("Read error: {}", e)));
                }
                Err(_) => {
                    if headers_parsed {
                        if let Some(cl) = content_length {
                            if buffer.len() >= header_end_offset + cl {
                                break;
                            }
                        } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                            break;
                        } else if !buffer.is_empty() {
                            break;
                        }
                    }
                    if !buffer.is_empty() && start_read.elapsed() > std::time::Duration::from_millis(500) {
                        break;
                    }
                    continue;
                }
            };

            buffer.extend_from_slice(&chunk[..n]);

            if !headers_parsed {
                if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end_offset = pos + 4;
                    headers_parsed = true;

                    let header_bytes = &buffer[..pos];
                    let header_str = String::from_utf8_lossy(header_bytes).to_ascii_lowercase();

                    for line in header_str.lines() {
                        if let Some(val) = line.strip_prefix("content-length:") {
                            content_length = val.trim().parse::<usize>().ok();
                        } else if let Some(val) = line.strip_prefix("transfer-encoding:") {
                            if val.contains("chunked") {
                                is_chunked = true;
                            }
                        }
                    }
                } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                    header_end_offset = pos + 2;
                    headers_parsed = true;
                }
            }

            if headers_parsed {
                if let Some(cl) = content_length {
                    if buffer.len() >= header_end_offset + cl {
                        break;
                    }
                } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                    break;
                }
            }
        }

        Ok(buffer)
    }
```

### 3.2 Audit Findings & Latent Defects in `read_http_response`

1. **Latent Defect 1: Premature Response Truncation on Slow Multi-Packet Bodies**:
   - In lines 344–361 (`Err(_)` timeout slice branch):
     ```rust
     if !buffer.is_empty() && start_read.elapsed() > std::time::Duration::from_millis(500) {
         break;
     }
     ```
   - If a target server returns headers and begins streaming a large body (e.g., 50KB) over a connection with network jitter, or if a database query takes >500ms between chunks, this condition fires and **prematurely breaks the loop**, returning an incomplete truncated body.
   - **Fix**: When `content_length` or `is_chunked` is active, the loop must NEVER prematurely break on a 500ms slice timeout. It must only break when `buffer.len() >= header_end_offset + cl`, when the terminal chunk is read, on peer EOF (`Ok(0)`), or when the full `total_timeout` (12s) expires.

2. **Latent Defect 2: Unnecessary 80ms Inactivity Lag on Body-Less HTTP Statuses (RFC 7230 §3.3.3)**:
   - According to RFC 7230 §3.3.3, any response with status `1xx`, `204` (No Content), or `304` (Not Modified) **must not contain a message body**, regardless of whether `Content-Length` is present.
   - In the current code, a `204 No Content` response on a keep-alive connection has `content_length: None` and `is_chunked: false`. It does not break in the header processing block and instead falls back to waiting for the 80ms inactivity timeout slice.
   - **Fix**: Inspect the HTTP status code upon header completion. If status is `1xx`, `204`, or `304`, set `content_length = Some(0)`. This causes `buffer.len() >= header_end_offset + 0` to evaluate to `true` immediately, terminating the read in **0ms**.

3. **Latent Defect 3: Header Whitespace Sensitivity**:
   - `line.strip_prefix("content-length:")` fails if there is any whitespace before the colon (e.g., `Content-Length : 100`) or leading line whitespace.
   - **Fix**: Use `line.trim().split_once(':')` to extract header name and value robustly.

---

## 4. Architectural Fix Strategy

### 4.1 Harden `read_http_response`
Refactor `read_http_response` to:
- Use `line.trim().split_once(':')` for header key-value parsing.
- Recognize RFC 7230 §3.3.3 body-less status codes (`1xx`, `204`, `304`) and set `content_length = Some(0)`.
- Use an idle slice timeout of 5 seconds when awaiting a known body (`content_length.is_some() || is_chunked`), and only use 80ms when framing is indeterminate.
- Eliminate premature truncation (`start_read.elapsed() > 500ms`) during valid body transmission.

### 4.2 Adapt `send_plain_primed_race`
Refactor `send_plain_primed_race` (lines 558–629):
1. Collapse the branch duplication between `request_bytes.len() > 1` and the `else` branch:
   - Compute and return `fire_instant: Instant` from the pre-flight transmission block.
2. Replace both 16-line raw read loops (`loop { match stream.read(&mut chunk)... }`) with a single call:
   ```rust
   let buffer = Self::read_http_response(&mut stream).await?;
   let duration = fire_instant.elapsed();
   Ok((buffer, fire_instant, duration))
   ```
3. Benefits:
   - Sockets read until the HTTP framing signals completion.
   - Immediate return on `Content-Length` or chunked completion (sub-millisecond latency).
   - Microsecond precision `fire_instant` and `duration` are fully preserved.
   - 40 lines of dead, duplicated, bug-prone code eliminated.

### 4.3 Adapt `send_tls_primed_race`
Refactor `send_tls_primed_race` (lines 631–713):
1. Collapse the branch duplication identically to `send_plain_primed_race`.
2. Replace both 16-line raw read loops over `tls_stream` with:
   ```rust
   let buffer = Self::read_http_response(&mut tls_stream).await?;
   let duration = fire_instant.elapsed();
   Ok((buffer, fire_instant, duration))
   ```
3. Because `read_http_response` is generic over `<S: tokio::io::AsyncRead + Unpin>`, `tokio_rustls::client::TlsStream<TcpStream>` satisfies the trait bounds out of the box without any adapters or allocations.

---

## 5. Exact Recommended Code Diffs

Target File: `sentinel_core/crates/sentinel_repeater/src/executor.rs`

### 5.1 Hardened `read_http_response` (Lines 305–401)

```rust
<<<<
    async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
        stream: &mut S,
    ) -> Result<Vec<u8>, SentinelError> {
        let mut buffer = Vec::with_capacity(16384);
        let mut chunk = [0u8; 16384];
        let mut headers_parsed = false;
        let mut content_length: Option<usize> = None;
        let mut is_chunked = false;
        let mut header_end_offset = 0;

        let total_timeout = std::time::Duration::from_secs(12);
        let start_read = std::time::Instant::now();

        loop {
            if start_read.elapsed() > total_timeout {
                break;
            }

            // If headers are already parsed and we are waiting for EOF, use a very short timeout slice
            let read_timeout = if headers_parsed {
                if content_length.is_some() || is_chunked {
                    std::time::Duration::from_millis(500)
                } else {
                    std::time::Duration::from_millis(80)
                }
            } else {
                std::time::Duration::from_millis(1500)
            };

            let read_future = stream.read(&mut chunk);
            let n = match tokio::time::timeout(read_timeout, read_future).await {
                Ok(Ok(0)) => break,
                Ok(Ok(n)) => n,
                Ok(Err(e)) => {
                    if !buffer.is_empty() {
                        break;
                    }
                    return Err(SentinelError::NetworkError(format!("Read error: {}", e)));
                }
                Err(_) => {
                    // Timeout slice: check if full response already buffered
                    if headers_parsed {
                        if let Some(cl) = content_length {
                            if buffer.len() >= header_end_offset + cl {
                                break;
                            }
                        } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                            break;
                        } else if !buffer.is_empty() {
                            break;
                        }
                    }
                    if !buffer.is_empty() && start_read.elapsed() > std::time::Duration::from_millis(500) {
                        break;
                    }
                    continue;
                }
            };

            buffer.extend_from_slice(&chunk[..n]);

            if !headers_parsed {
                if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end_offset = pos + 4;
                    headers_parsed = true;

                    let header_bytes = &buffer[..pos];
                    let header_str = String::from_utf8_lossy(header_bytes).to_ascii_lowercase();

                    for line in header_str.lines() {
                        if let Some(val) = line.strip_prefix("content-length:") {
                            content_length = val.trim().parse::<usize>().ok();
                        } else if let Some(val) = line.strip_prefix("transfer-encoding:") {
                            if val.contains("chunked") {
                                is_chunked = true;
                            }
                        }
                    }
                } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                    header_end_offset = pos + 2;
                    headers_parsed = true;
                }
            }

            if headers_parsed {
                if let Some(cl) = content_length {
                    if buffer.len() >= header_end_offset + cl {
                        break;
                    }
                } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                    break;
                }
            }
        }

        Ok(buffer)
    }
====
    async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
        stream: &mut S,
    ) -> Result<Vec<u8>, SentinelError> {
        let mut buffer = Vec::with_capacity(16384);
        let mut chunk = [0u8; 16384];
        let mut headers_parsed = false;
        let mut content_length: Option<usize> = None;
        let mut is_chunked = false;
        let mut header_end_offset = 0;

        let total_timeout = std::time::Duration::from_secs(12);
        let start_read = std::time::Instant::now();

        loop {
            if start_read.elapsed() > total_timeout {
                break;
            }

            // Inactivity slice timeout:
            // - When framing is known (Content-Length or chunked), allow up to 5s idle between packets.
            // - When framing is indeterminate (no headers or keep-alive without framing), use 80ms.
            let read_timeout = if headers_parsed {
                if content_length.is_some() || is_chunked {
                    std::time::Duration::from_secs(5)
                } else {
                    std::time::Duration::from_millis(80)
                }
            } else {
                std::time::Duration::from_secs(3)
            };

            let read_future = stream.read(&mut chunk);
            let n = match tokio::time::timeout(read_timeout, read_future).await {
                Ok(Ok(0)) => break, // EOF reached: socket closed by peer
                Ok(Ok(n)) => n,
                Ok(Err(e)) => {
                    if !buffer.is_empty() {
                        break;
                    }
                    return Err(SentinelError::NetworkError(format!("Read error: {}", e)));
                }
                Err(_) => {
                    // Inactivity timeout slice fired
                    if headers_parsed {
                        if let Some(cl) = content_length {
                            if buffer.len() >= header_end_offset + cl {
                                break;
                            }
                            if start_read.elapsed() > total_timeout {
                                break;
                            }
                        } else if is_chunked {
                            if buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n") {
                                break;
                            }
                            if start_read.elapsed() > total_timeout {
                                break;
                            }
                        } else if !buffer.is_empty() {
                            // Indeterminate framing on keep-alive connection: inactivity indicates stream end
                            break;
                        }
                    } else if start_read.elapsed() > total_timeout {
                        break;
                    }
                    continue;
                }
            };

            buffer.extend_from_slice(&chunk[..n]);

            if !headers_parsed {
                if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end_offset = pos + 4;
                    headers_parsed = true;

                    let header_bytes = &buffer[..pos];
                    let header_str = String::from_utf8_lossy(header_bytes).to_ascii_lowercase();

                    // RFC 7230 §3.3.3: 1xx, 204, 304 have no message body regardless of headers
                    let status_line = header_str.lines().next().unwrap_or("");
                    let mut parts = status_line.split_whitespace();
                    parts.next(); // Skip HTTP-Version
                    if let Some(code_str) = parts.next() {
                        if let Ok(code) = code_str.parse::<u16>() {
                            if (100..200).contains(&code) || code == 204 || code == 304 {
                                content_length = Some(0);
                            }
                        }
                    }

                    for line in header_str.lines() {
                        let line = line.trim();
                        if let Some((k, v)) = line.split_once(':') {
                            let key = k.trim();
                            let val = v.trim();
                            if key == "content-length" {
                                content_length = val.parse::<usize>().ok();
                            } else if key == "transfer-encoding" && val.contains("chunked") {
                                is_chunked = true;
                            }
                        }
                    }
                } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                    header_end_offset = pos + 2;
                    headers_parsed = true;
                }
            }

            if headers_parsed {
                if let Some(cl) = content_length {
                    if buffer.len() >= header_end_offset + cl {
                        break;
                    }
                } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                    break;
                }
            }
        }

        Ok(buffer)
    }
>>>>
```

---

### 5.2 Refactored `send_plain_primed_race` (Lines 558–629)

```rust
<<<<
    async fn send_plain_primed_race(
        addr: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let mut stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write head: {}", e)))?;
            let _ = stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write last byte: {}", e)))?;
            let _ = stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;
            let _ = stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        }
    }
====
    async fn send_plain_primed_race(
        addr: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let mut stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        let fire_instant = if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write head: {}", e)))?;
            let _ = stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write last byte: {}", e)))?;
            let _ = stream.flush().await;
            fire_instant
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;
            let _ = stream.flush().await;
            fire_instant
        };

        let buffer = Self::read_http_response(&mut stream).await?;
        let duration = fire_instant.elapsed();
        Ok((buffer, fire_instant, duration))
    }
>>>>
```

---

### 5.3 Refactored `send_tls_primed_race` (Lines 631–713)

```rust
<<<<
    async fn send_tls_primed_race(
        addr: &str,
        host: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
        tls_config: Arc<ClientConfig>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let connector = TlsConnector::from(tls_config);
        let stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
            SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
        })?;

        let mut tls_stream = connector.connect(server_name, stream).await.map_err(|e| {
            SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e))
        })?;

        if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            tls_stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS head: {}", e)))?;
            let _ = tls_stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            tls_stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS last byte: {}", e)))?;
            let _ = tls_stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match tls_stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read TLS response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            tls_stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS request: {}", e)))?;
            let _ = tls_stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match tls_stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read TLS response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        }
    }
====
    async fn send_tls_primed_race(
        addr: &str,
        host: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
        tls_config: Arc<ClientConfig>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let connector = TlsConnector::from(tls_config);
        let stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
            SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
        })?;

        let mut tls_stream = connector.connect(server_name, stream).await.map_err(|e| {
            SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e))
        })?;

        let fire_instant = if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            tls_stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS head: {}", e)))?;
            let _ = tls_stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            tls_stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS last byte: {}", e)))?;
            let _ = tls_stream.flush().await;
            fire_instant
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            tls_stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS request: {}", e)))?;
            let _ = tls_stream.flush().await;
            fire_instant
        };

        let buffer = Self::read_http_response(&mut tls_stream).await?;
        let duration = fire_instant.elapsed();
        Ok((buffer, fire_instant, duration))
    }
>>>>
```

---

## 6. Verification Test Suite Recommendations

Target File: `sentinel_core/crates/sentinel_repeater/tests/empirical_challenge_test.rs`

### 6.1 Convert Test 4 into Strict Hard Assertion

Currently, `test_repeater_race_with_persistent_keepalive_server` prints a critical finding upon timeout instead of failing. Replace lines 214–231 with:

```rust
    let summary = race_result
        .expect("execute_parallel_race must complete within 2s without hanging on persistent keep-alive")
        .expect("Race execution must succeed");

    assert_eq!(summary.total_requests, 5, "Total requests must match input count");
    assert_eq!(summary.successful_responses, 5, "All 5 race requests must succeed");
    assert_eq!(summary.outputs.len(), 5, "Must produce 5 output entries");
    for output in &summary.outputs {
        assert_eq!(output.status_code, Some(200));
        assert!(
            String::from_utf8_lossy(&output.raw_response).contains("race_finished"),
            "Response body must be fully read"
        );
    }
```

### 6.2 Add Chunked Keep-Alive Race Test

```rust
/// Test: Verify execute_parallel_race with chunked transfer encoding against a persistent server.
#[tokio::test]
async fn test_repeater_race_with_chunked_keepalive_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n6\r\nchunk1\r\n6\r\nchunk2\r\n0\r\n\r\n";
                        let _ = stream.write_all(resp).await;
                        // Keep connection open
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = RepeaterExecutor::new(scope);
    let target_url = format!("http://127.0.0.1:{}/chunked_race", port);

    let requests: Vec<Vec<u8>> = (0..5)
        .map(|_| {
            format!(
                "GET /chunked_race HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
                port
            )
            .into_bytes()
        })
        .collect();

    let race_result = tokio::time::timeout(
        Duration::from_secs(2),
        executor.execute_parallel_race(&target_url, requests),
    )
    .await
    .expect("Chunked race must not hang on keep-alive")
    .expect("Race execution must succeed");

    assert_eq!(race_result.successful_responses, 5);
    for output in &race_result.outputs {
        assert_eq!(output.status_code, Some(200));
        let body = String::from_utf8_lossy(&output.raw_response);
        assert!(body.contains("chunk1"));
        assert!(body.contains("chunk2"));
    }
}
```

### 6.3 Add 204 No Content Keep-Alive Race Test

```rust
/// Test: Verify execute_parallel_race with 204 No Content terminates immediately without 80ms inactivity lag.
#[tokio::test]
async fn test_repeater_race_with_204_no_content_keepalive() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 204 No Content\r\nConnection: keep-alive\r\n\r\n";
                        let _ = stream.write_all(resp).await;
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = RepeaterExecutor::new(scope);
    let target_url = format!("http://127.0.0.1:{}/no_content_race", port);

    let requests: Vec<Vec<u8>> = (0..5)
        .map(|_| {
            format!(
                "POST /no_content_race HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\nContent-Length: 0\r\n\r\n",
                port
            )
            .into_bytes()
        })
        .collect();

    let start = Instant::now();
    let race_result = tokio::time::timeout(
        Duration::from_secs(1),
        executor.execute_parallel_race(&target_url, requests),
    )
    .await
    .expect("204 race must not hang")
    .expect("Race execution must succeed");

    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_millis(150),
        "204 No Content race took too long: {:?}",
        elapsed
    );
    assert_eq!(race_result.successful_responses, 5);
    for output in &race_result.outputs {
        assert_eq!(output.status_code, Some(204));
    }
}
```

---

## 7. Downstream Cross-Subsystem Alignment

While this investigation is strictly scoped to `sentinel_repeater`, Challenger 1 noted that `sentinel_dispatch` exhibits a related issue (Defect 2: 15-second latency delay on keep-alive servers due to lack of framing parsing in `HttpDispatcher::send_plain` and `send_tls`).

Because `sentinel_repeater` depends on `sentinel_dispatch` (not the reverse), `sentinel_dispatch` cannot directly import `RepeaterExecutor::read_http_response`. Explorer 2 / Worker should implement the identical framing parsing logic directly within `sentinel_dispatch/src/client.rs` lines 313–339 and 371–396. This will eliminate Defect 2 in parallel with Defect 1.

---

## 8. Summary Checklist for Worker

- [ ] Apply hardened `read_http_response` to `sentinel_core/crates/sentinel_repeater/src/executor.rs:305-401`.
- [ ] Refactor `send_plain_primed_race` to call `Self::read_http_response(&mut stream).await?` (lines 558-629).
- [ ] Refactor `send_tls_primed_race` to call `Self::read_http_response(&mut tls_stream).await?` (lines 631-713).
- [ ] Update `sentinel_core/crates/sentinel_repeater/tests/empirical_challenge_test.rs` with strict assertions and new tests.
- [ ] Verify using `cargo test -p sentinel_repeater --test empirical_challenge_test`.
