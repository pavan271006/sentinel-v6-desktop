# UCMA-X System Architecture — Milestone 1: Safe Foundation & Scope Control

## 1. Executive Summary

UCMA-X is a next-generation Universal Vulnerability & Semantic Verification Engine written in Rust. Milestone 1 establishes the **Safe Foundation & Scope Control** infrastructure, guaranteeing that all network egress, target modeling, session tracking, and evidence collection operate under strict cryptographic boundaries and fail-closed security invariants.

---

## 2. Workspace Crate Architecture & Dependency DAG

Milestone 1 implements the foundational layer of the 34-crate UCMA-X architecture:

```
                  ┌────────────────────────┐
                  │       ucma-bench       │ (Synthetic fixtures & bench harness)
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
     ┌───────────────────┐         ┌───────────────────┐
     │     ucma-http     │ ◄────── │    ucma-scope     │ (Anti-SSRF & Capability Gating)
     └─────────┬─────────┘         └─────────┬─────────┘
               │                             │
               │   ┌─────────────────────┐   │
               │   │    ucma-session     │   │ (Zeroizing session & cookie manager)
               │   └──────────┬──────────┘   │
               │              │              │
               ▼              ▼              ▼
     ┌─────────────────────────────────────────────────┐
     │                    ucma-core                    │ (BLAKE3 IDs, models, snapshots)
     └─────────────────────────────────────────────────┘
```

### Dependency Invariants
- `ucma-core`: Zero workspace dependencies. Foundational domain models and BLAKE3 identifier primitives.
- `ucma-scope`: Depends solely on `ucma-core`. Contains no network client code.
- `ucma-http`: Depends on `ucma-core` and `ucma-scope`. Cannot execute requests without `AuthorizedRequest` capability tokens.
- `ucma-session`: Depends on `ucma-core`. Manages authenticated states and auto-zeroizes sensitive credentials.
- `ucma-bench`: In-memory test fixtures and statistical benchmarking harness.

---

## 3. Core Component Design

### 3.1 `ucma-core` (Foundational Domain Models & Integrity)
- **BLAKE3 Content-Derived IDs**: Strongly-typed 32-byte identifiers (`TargetId`, `EndpointId`, `ParameterId`, `RequestId`, `SnapshotId`, `EvidenceId`, `SessionId`). Every ID is deterministically derived from its semantic inputs via BLAKE3 domain separation prefixes (`"TARGET:"`, `"ENDPOINT:"`, `"REQ:"`, etc.).
- **Target & Endpoint Modeling**: Explicit environment tagging (`Production`, `Staging`, `Development`, `Testing`, `LocalLab`), path whitelist/blacklist filtering, and parameter definitions (`Query`, `Header`, `Cookie`, `Path`, `BodyForm`, `BodyJson`, `BodyXml`, `Multipart`).
- **Response Snapshots**: Immutable records capturing HTTP status code, headers, body bytes, round-trip latency in nanoseconds, remote IP, and two cryptographic BLAKE3 hashes: `blake3_body_hash` and `blake3_raw_wire_hash`.
- **In-Memory Evidence Store**: Thread-safe concurrent storage (`Arc<RwLock<...>>`) supporting CRUD operations, severity tagging, snapshot linking, and target querying.

### 3.2 `ucma-scope` (Fail-Closed Scope & SSRF Defense)
- **URL Canonicalization**: Enforces valid schemes (`http`, `https`, `ws`, `wss`), resolves path traversal (`/..`), strips default ports (80/443), removes URL fragments (`#...`), and deterministically sorts query parameters alphabetically.
- **Anti-SSRF DNS Engine**: Evaluates resolved IP addresses against blocked CIDR blocks, including IPv4 loopback (`127.0.0.0/8`), RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Cloud Metadata / link-local (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), multicast (`224.0.0.0/4`), IPv6 loopback (`::1/128`), IPv6 ULA/link-local, and IPv4-mapped IPv6 addresses (`::ffff:w.x.y.z`).
- **DNS Pinning & Anti-Rebinding**: Pre-flight DNS resolution pins validated IP addresses directly to the authorized token. If any resolved IP belongs to a blocked subnet, the request fails closed immediately.
- **Cryptographic Capability Tokens (`AuthorizedRequest`)**: Minted by `ScopePolicy::authorize(...)` using a keyed BLAKE3 MAC over the request ID, target URL, pinned IPs, issue timestamp, and expiration timestamp. Tokens cannot be forged, tampered with, or reused across differing scope policy instances.

### 3.3 `ucma-http` (Scope-Gated Network Client)
- **Zero-Bypass Architecture**: `SafeHttpClient::send(AuthorizedRequest)` requires an unforgeable capability token. Disallowed or out-of-scope requests cannot be executed.
- **Hop-by-Hop Redirect Validation**: Native client redirects are disabled. Every 3xx redirect is intercepted by `RedirectValidator`, re-parsed, canonicalized, and re-submitted through `ScopePolicy::authorize(...)` before following. Redirects attempting SSRF or out-of-scope egress are rejected with `ScopeError`.
- **Bounded Resource Consumption**: Enforces strict timeout bounds (connect, read, overall) and maximum response body streaming limits (default 5 MB). Over-sized responses are truncated safely with the `truncated: true` flag set on the resulting snapshot.

### 3.4 `ucma-session` (Credential Protection & State Tracking)
- **Automatic Secret Zeroization**: `CredentialContainer` and `SessionState` implement `zeroize::Zeroize` and `zeroize::ZeroizeOnDrop`, ensuring bearer tokens, basic auth passwords, API keys, and session cookies are cleared from memory upon drop.
- **Thread-Safe Cookie Jar**: Thread-safe `CookieJar` matching cookie domains, paths, expiration dates, and Secure flags, formatting `Cookie` request headers.
- **Session Health Tracker**: Detects authentication degradation (e.g. repeated 401/403 responses) and flags sessions as invalid when health thresholds are breached.

### 3.5 `ucma-bench` (Synthetic Testbed & Performance Harness)
- **Synthetic HTTP Mock Server**: In-process `TcpListener` providing configurable mock endpoints (`/api/ok`, `/api/echo`, `/api/slow`, `/api/large`, `/redirect/in-scope`, `/redirect/out-of-scope`, `/redirect/ssrf`, `/redirect/loop`).
- **Benchmarking Harness**: Measures scope policy authorization throughput (ops/sec) and HTTP round-trip latency statistics (Mean, P50, P90, P99, Min, Max).

---

## 4. Key Invariants

1. **`ZERO_SQL_IN_M1`**: Milestone 1 contains zero SQL parsing, zero AST analysis, and zero SQL injection logic. All database-specific and vulnerability-specific analysis is deferred to Milestone 2 and beyond.
2. **`FAIL_CLOSED_SCOPE`**: All network egress is gated behind `AuthorizedRequest` capability tokens minted by `ScopePolicy`.
3. **`DETERMINISTIC_REPRODUCIBILITY`**: All entity identifiers and snapshot wire verifications are derived from BLAKE3 hashes.
4. **`ZEROIZE_ON_DROP`**: All credentials and sensitive session artifacts are zeroized upon drop.
