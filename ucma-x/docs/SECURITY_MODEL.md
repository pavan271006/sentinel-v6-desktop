# UCMA-X Security Model & Invariant Specification

## 1. Security Overview

The UCMA-X security model enforces strict isolation, fail-closed access control, and cryptographic tamper-proofing across all execution phases. No component in the engine is permitted to initiate network operations without explicit, cryptographically verifiable authorization.

---

## 2. Invariant Specifications (SEC-01 through SEC-12)

### SEC-01: Fail-Closed Scope Gating
- **Requirement**: Any network request without an authenticated, unexpired `AuthorizedRequest` token is rejected prior to socket allocation.
- **Enforcement**: `ucma-http::SafeHttpClient::send(AuthorizedRequest)` cryptographically verifies the token's keyed BLAKE3 signature against the internal `ScopePolicy` secret salt before constructing or transmitting the request.

### SEC-02: SSRF & Cloud Metadata Protection
- **Requirement**: In production and testing environments (`allow_private_ips = false`), all requests to loopback, RFC1918 private subnets, link-local / cloud metadata services (e.g. `169.254.169.254`), CGNAT (`100.64.0.0/10`), multicast (`224.0.0.0/4`), IPv6 loopback (`::1`), IPv6 link-local/multicast, and IPv4-mapped IPv6 ranges must be rejected.
- **Enforcement**: `ucma-scope::IpValidator` checks all candidate IP addresses against blocked CIDRs.

### SEC-03: DNS Rebinding Defense & Pinning
- **Requirement**: DNS resolution must not allow malicious rebinding to private or un-authorized targets.
- **Enforcement**: `SafeDnsResolver` resolves hostnames pre-flight, validates all returned A/AAAA records against SSRF rules, and pins the resulting IP list to the `AuthorizedRequest` token. If any resolved IP fails validation, the entire authorization fails closed.

### SEC-04: Hop-by-Hop Redirect Authorization
- **Requirement**: HTTP redirects (301, 302, 303, 307, 308) cannot be followed automatically by third-party HTTP client libraries without re-authorization.
- **Enforcement**: Automatic redirects in `reqwest` are explicitly disabled (`Policy::none()`). `RedirectValidator::evaluate_hop(...)` intercepts every redirect hop, normalizes and canonicalizes the `Location` header, and passes the destination back through `ScopePolicy::authorize(...)`. Redirects targeting out-of-scope hosts or SSRF addresses abort immediately with `ScopeError`.

### SEC-05: Cryptographic Token Tamper-Proofing
- **Requirement**: `AuthorizedRequest` capability tokens cannot be forged, manipulated, or transferred across different policy domains.
- **Enforcement**: Tokens are signed using a keyed BLAKE3 MAC:
  `Signature = BLAKE3_KEYED(Salt, "UCMA_AUTH_CAPABILITY_TOKEN_V1:" || RequestId || TargetUrl || PinnedIPs || IssuedAt || ExpiresAt)`.
  Any modification to request attributes (URL, headers, body) breaks signature verification.

### SEC-06: Deterministic Identifier Derivation
- **Requirement**: Entity IDs must be collision-resistant and deterministically reproducible across independent engine runs.
- **Enforcement**: All IDs (`TargetId`, `EndpointId`, `ParameterId`, `RequestId`, `SnapshotId`, `EvidenceId`, `SessionId`) are derived from their structural content via BLAKE3 domain-separated hashing.

### SEC-07: Secret Zeroization on Drop
- **Requirement**: Sensitive credentials (tokens, basic auth credentials, session cookies, API keys) must not linger in memory after being dropped.
- **Enforcement**: `CredentialContainer` and `SessionState` implement `zeroize::Zeroize` and `zeroize::ZeroizeOnDrop`, clearing all memory buffers upon deallocation.

### SEC-08: Bounded Resource Consumption
- **Requirement**: Network operations must not cause unbounded memory allocation or hang indefinitely on slow/malicious servers.
- **Enforcement**: `HttpLimits` enforces connect timeouts, read timeouts, overall execution timeouts, maximum redirect hop counts (default: 5), and maximum response body streaming size (default: 5 MB). Over-sized responses are truncated safely.

### SEC-09: Deterministic Canonicalization
- **Requirement**: URLs representing the same logical resource must canonicalize to identical strings to prevent scope bypass through URL encoding, redundant ports, or path traversal.
- **Enforcement**: `ucma-scope::canonicalize` strips fragments, normalizes default ports (80/443), resolves `.` and `..` path segments, and deterministically sorts query parameter keys and values.

### SEC-10: Evidence Chain Immutability
- **Requirement**: Response evidence and vulnerability findings must provide verifiable proof of execution without possibility of post-hoc modification.
- **Enforcement**: `ResponseSnapshot` captures the raw wire response bytes along with `blake3_body_hash` and `blake3_raw_wire_hash`. `EvidenceStore` records immutable findings linked directly to the immutable snapshot IDs.

### SEC-11: Milestone Invariant — Zero SQL Logic in M1
- **Requirement**: Milestone 1 must not include any SQL parsing, AST analysis, dialect identification, or injection detection logic.
- **Enforcement**: Workspace crates in M1 provide only protocol-level network, scope, session, and snapshot infrastructure.

### SEC-12: Session Liveness and Health Tracking
- **Requirement**: Compromised or expired sessions must be detected and invalidated proactively.
- **Enforcement**: `SessionTracker` monitors response status codes; consecutive 401/403 responses mark the session unhealthy and prevent further usage until re-authenticated.
