# MULTI-PRINCIPAL AUTHORIZATION (IRA+), STATE MACHINE INFERENCE & TOKEN SECURITY SPECIFICATION
**SENTINEL V6 Enterprise Workstation — Frontier Authorization & State Research Dossier**
**Document ID**: `SENTINEL-AUTHZ-V6-2026-010-MASTER`
**Classification**: Authoritative Technical Research & Authorization Architecture Specification
**Target Platform**: SENTINEL V6 Master Program (`sentinel_auth`, `sentinel_diff`, `sentinel_logic`)
**Author**: Sentinel Identity, Authorization & State Machine Research Group
**Status**: COMPLETE / AUTHORITATIVE / AUDITED
**Date**: August 2026

---

## Table of Contents
1. [Executive Summary & Modern Authorization Vulnerabilities](#1-executive-summary--modern-authorization-vulnerabilities)
2. [Iterative Role-Based Authorization (IRA+) Architecture](#2-iterative-role-based-authorization-ira-architecture)
   - 2.1 Multi-Principal Matrix Model (Tenant A/B, Admin/User, Anonymous)
   - 2.2 `SecretReference` UUID Indirection & Zero-Leakage Storage (SEC-09)
   - 2.3 Automated Session & Token Lifecycle Management
3. [Automated Object Substitution & Cross-Replay Engine](#3-automated-object-substitution--cross-replay-engine)
   - 3.1 Multi-Dimensional Identifier Discovery (Path, Body, Query, Headers, GraphQL)
   - 3.2 4-Way Cross-Replay Permutation Grid (Horizontal, Vertical, Tenant, Unauthenticated)
   - 3.3 Dynamic Nonce, CSRF & Anti-Replay Synchronization
4. [Semantic Divergence Oracles & Response AST Diffing](#4-semantic-divergence-oracles--response-ast-diffing)
   - 4.1 The Flaws of Naive Response Diffing
   - 4.2 AST Structural Normalization & Volatile Masking ($H \ge 3.8$)
   - 4.3 Jaccard Similarity Oracles ($\tau_{\text{sim}} \ge 0.85$) & Status Code Matrices
   - 4.4 State-Mutation Confirmation Oracles (Read-After-Write Verification)
5. [State Machine Inference & Mealy FSM Modeling](#5-state-machine-inference--mealy-fsm-modeling)
   - 5.1 Passive HTTP Trace Mining & Session Sequence Graphs
   - 5.2 Formal Mealy Machine Model & $k$-Tails Equivalence ($k=2$)
   - 5.3 Step-Skipping, Workflow Bypass & Payment Race Conditions
   - 5.4 Revoked Session & Zombie Token Persistence Detection
6. [Token Lifecycle & Modern Authentication Protocol Probes](#6-token-lifecycle--modern-authentication-protocol-probes)
   - 6.1 JWT/JWS/JWE Attack Suite (Alg-Confusion, Key Traversal, Signature Stripping)
   - 6.2 OAuth 2.1 & OIDC Hardening Probes (PKCE Downgrade, Redirect Pollution)
   - 6.3 SAML / SSO Assertion & XML Signature Wrapping
7. [Cryptographic Evidence & Security Invariants](#7-cryptographic-evidence--security-invariants)
   - 7.1 Triangulated 3-Way Evidence Capture (SEC-06)
   - 7.2 CAS Merkle Proof Binding (SEC-07)
   - 7.3 SEC-09 Zeroized Memory & Secret Masking
8. [Conclusion & Operational Roadmap](#8-conclusion--operational-roadmap)

---

## 1. Executive Summary & Modern Authorization Vulnerabilities

Authorization flaws represent the single most prevalent and damaging category of vulnerabilities in modern enterprise cloud applications. As microservices and distributed APIs proliferate, access control decisions are often fractured across API gateways, reverse proxies, and individual application microservices. This decentralization gives rise to critical access control breakdowns:

1. **Broken Object Level Authorization (BOLA / IDOR - OWASP API1:2023)**: Endpoints accept client-supplied object identifiers (e.g. `/api/v1/invoices/10928`) without validating whether the authenticated principal owns or has explicit permission to access that specific resource.
2. **Broken Function Level Authorization (BFLA - OWASP API5:2023)**: Privileged administrative endpoints (e.g. `POST /api/v1/admin/users/export`) lack role-based access checks, allowing standard authenticated users to invoke sensitive administrative actions.
3. **Cross-Tenant Context Leakage**: Multi-tenant SaaS architectures failing to enforce strict workspace or organization boundaries, permitting Tenant A users to query, mutate, or delete Tenant B data.
4. **State Machine & Business Logic Bypass**: Multi-step transactional workflows (e.g. checkout, account verification, password reset, MFA challenges) failing to enforce state preconditions, allowing attackers to skip intermediate payment or verification steps.

Traditional vulnerability scanners fail to detect these flaws because authorization testing cannot be performed with static payload strings (like `' OR 1=1 --`). Authorization testing requires **Multi-Principal Contextual Modeling**, **Semantic Response Divergence Analysis**, and **State Machine Inference**.

SENTINEL V6 introduces the **Iterative Role-Based Authorization Engine (IRA+)** (`sentinel_auth`, `sentinel_diff`, `sentinel_logic`), establishing a deterministic mathematical and architectural standard for automated multi-principal access control validation.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      SENTINEL V6 IRA+ AUTHORIZATION ARCHITECTURE                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                  IDENTITY VAULT (sentinel_auth)                                  │
│  ┌─────────────────────────┬─────────────────────────┬─────────────────────────┬──────────────┐  │
│  │ Principal A (Tenant1-Ad)│ Principal B (Tenant1-Us)│ Principal C (Tenant2-Us)│ Anonymous    │  │
│  │ [SecretReference UUID]  │ [SecretReference UUID]  │ [SecretReference UUID]  │ [Empty/Null] │  │
│  └────────────┬────────────┴────────────┬────────────┴────────────┬────────────┴──────┬───────┘  │
│               │                         │                         │                   │          │
│               ▼                         ▼                         ▼                   ▼          │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ AUTOMATED OBJECT DISCOVERY & CROSS-REPLAY ENGINE (sentinel_auth::replay)                   │  │
│  │ - Parameter Extractors: URL Path ({id}), JSON Body (uuid), Query (?acc=), GraphQL (id:)   │  │
│  │ - 4-Way Permutation Grid: Horizontal, Vertical, Cross-Tenant, Anonymous Replay            │  │
│  └─────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                            │ (Multi-Principal HTTP Telemetry)                    │
│                                            ▼                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ SEMANTIC DIVERGENCE AST ORACLE (sentinel_diff: Shannon Entropy & Volatile Field Masking)   │  │
│  │ - Key Structure Jaccard Similarity (τ_sim >= 0.85) vs Status Code Differential Matrix       │  │
│  │ - State-Mutation Verification Oracle (Read-After-Write confirmation probe)                │  │
│  └─────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                            │ (Verified Authorization Anomaly)                    │
│                                            ▼                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ MEALY FSM STATE INFERENCE (sentinel_logic: k-Tails k=2 Workflow Model & Step-Skipping)     │  │
│  └─────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                            │                                                     │
│                                            ▼ (Triangulated CAS Evidence)                         │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ SHA-256 CAS MERKLE PROOF BINDING (sentinel_storage: SEC-06 Finding Proof Requirement)     │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Iterative Role-Based Authorization (IRA+) Architecture

### 2.1 Multi-Principal Matrix Model

The IRA+ engine models authorization testing across a formal 5-principal security matrix:

$$\mathcal{P} = \{ P_{\text{Tenant1-Admin}}, P_{\text{Tenant1-User}}, P_{\text{Tenant2-Admin}}, P_{\text{Tenant2-User}}, P_{\text{Anonymous}} \}$$

```rust
/// Canonical Principal Identity Definition in sentinel_auth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPrincipal {
    pub id: Uuid,
    pub label: String,
    pub tenant_id: String,
    pub role: PrincipalRole,
    pub credentials: PrincipalCredentials,
    pub session_state: SessionState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PrincipalRole {
    SuperAdmin,
    TenantAdmin,
    StandardUser,
    ReadOnlyUser,
    Anonymous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrincipalCredentials {
    pub auth_token_ref: SecretReference, // SEC-09 UUID Indirection
    pub cookie_jar_ref: SecretReference,
    pub custom_headers: HashMap<String, SecretReference>,
}
```

### 2.2 `SecretReference` UUID Indirection & Zero-Leakage Storage (SEC-09)

In compliance with **SEC-09 (Secret Redaction & Memory Zeroization)**:
- Raw credentials (JWT tokens, session cookies, API keys, basic auth passwords) are NEVER passed directly into test planners, agent context windows, audit logs, or serialized UI payloads.
- All secrets are stored in heap-allocated, zeroized memory buffers (`zeroize::Zeroizing<Vec<u8>>`) inside `sentinel_auth::vault`.
- Testing rules and HTTP telemetry reference credentials exclusively via an immutable 128-bit `SecretReference(Uuid)`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SecretReference(pub Uuid);
```

During request dispatch, the native network pipeline in `sentinel_proxy` resolves the `SecretReference` immediately prior to TCP socket write and immediately redacts the token before writing the transaction to SQLite WAL or CAS blobs.

### 2.3 Automated Session & Token Lifecycle Management

To prevent test corruption caused by session expiry:
1. **Token Health Sentinel**: Prior to executing an authorization replay grid, the engine dispatches a lightweight session-validation probe (e.g. `GET /api/v1/me`).
2. **Auto-Renewal & Rotation**: If a `401 Unauthorized` or token expiry is detected, the engine transparently invokes the principal's configured OAuth 2.0 refresh flow, updates the `SecretReference` vault buffer, and resumes testing without operator intervention.

---

## 3. Automated Object Substitution & Cross-Replay Engine

### 3.1 Multi-Dimensional Identifier Discovery

The IRA+ engine parses captured baseline traffic and automatically discovers entity identifiers across all protocol layers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   MULTI-DIMENSIONAL IDENTIFIER EXTRACTION MATRIX                                 │
├───────────────────┬───────────────────────────────────┬──────────────────────────────────────────┤
│ Protocol Layer    │ Syntax / Pattern Example          │ Extracted Entity Context                 │
├───────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ URL Path Segment  │ `/api/v1/workspaces/ws_9812/docs` │ Entity: `workspace_id` = `ws_9812`       │
│ URL Query Param   │ `?account_id=10928&format=json`   │ Entity: `account_id` = `10928`           │
│ JSON Request Body │ `{"userId": "usr_44", "role": 1}` │ Entity: `userId` = `usr_44`              │
│ GraphQL Variables │ `{"variables": {"docId": "d-88"}}`│ Entity: `docId` = `d-88`                 │
│ Custom Headers    │ `X-Tenant-Id: tnt_alpha_01`       │ Entity: `tenant_id` = `tnt_alpha_01`     │
└───────────────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

### 3.2 4-Way Cross-Replay Permutation Grid

For every discovered entity action, the engine constructs a full 4-way cross-replay permutation:

```
                                  Captured Request (Owner: P_Tenant1-User, Resource: Res_1)
                                                              │
                                                              ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │              IRA+ CROSS-REPLAY PERMUTATION GRID           │
                        └─────────────────────────────┬─────────────────────────────┘
                                                      │
         ┌────────────────────────────┬───────────────┴────────────┬────────────────────────────┐
         ▼                            ▼                            ▼                            ▼
  [ HORIZONTAL REPLAY ]        [ VERTICAL REPLAY ]       [ CROSS-TENANT REPLAY ]      [ UNAUTHENTICATED ]
  Replay as:                   Replay as:                Replay as:                   Replay as:
  P_Tenant1-User2              P_Tenant1-ReadOnly        P_Tenant2-User               P_Anonymous
  (Target: Res_1)              (Target: Res_AdminAction) (Target: Res_1)              (Target: Res_1)
         │                            │                            │                            │
         ▼                            ▼                            ▼                            ▼
  Assert: 403/404 Deny         Assert: 403 Deny          Assert: 403/404 Deny         Assert: 401/403 Deny
  (BOLA Detection)             (BFLA Detection)          (Tenant Boundary Flaw)       (Auth Bypass Flaw)
```

### 3.3 Dynamic Nonce, CSRF & Anti-Replay Synchronization

When replaying state-modifying requests (`POST`, `PUT`, `DELETE`):
1. The engine automatically extracts dynamic anti-CSRF tokens (`X-CSRF-Token`, `_csrf`, `authenticity_token`) from the target session's latest response.
2. The extracted token is injected into the replay request for the respective principal, ensuring that authorization checks test access control logic rather than failing trivially on CSRF validation.

---

## 4. Semantic Divergence Oracles & Response AST Diffing

### 4.1 The Flaws of Naive Response Diffing

Naive byte-level or status-code-only diffing fails catastrophically in modern web applications:
- **Dynamic Volatility**: Web responses contain timestamps (`"generated_at": 1724345600`), dynamic UUIDs, localized UI strings, and tracking tokens that produce 100% byte diffs even on identical access control responses.
- **Deceptive Status Codes**: Many REST and GraphQL APIs return HTTP `200 OK` with an embedded error payload (`{"error": "Access Denied"}` or `{"data": null, "errors": [{"message": "Unauthorized"}]}`).

### 4.2 AST Structural Normalization & Volatile Masking ($H \ge 3.8$)

The Differential Security Engine (`sentinel_diff`) parses response bodies into structured Abstract Syntax Trees (JSON AST, XML AST, HTML DOM) and applies **Shannon Token Entropy Masking**:

$$H(X) = -\sum_{i=1}^n P(x_i) \log_2 P(x_i)$$

1. Any leaf string field exhibiting $H \ge 3.8$ (e.g. random tokens, hashes, encrypted nonces) or matching UUID/timestamp regex is dynamically replaced with a canonical wildcard placeholder `{{VOLATILE_TOKEN}}`.
2. JSON key orders are deterministically sorted.

### 4.3 Jaccard Similarity Oracles ($\tau_{\text{sim}} \ge 0.85$) & Status Code Matrices

Let $y_{\text{baseline}}^*$ and $y_{\text{replay}}^*$ be the normalized, masked response ASTs. The structural Jaccard similarity is computed over key paths:

$$\mathcal{J}(K_1, K_2) = \frac{|K_1 \cap K_2|}{|K_1 \cup K_2|}$$

An authorization anomaly (potential BOLA/BFLA) is flagged iff:
$$\mathcal{J}(K_{\text{baseline}}, K_{\text{replay}}) \ge 0.85 \quad \land \quad \text{Status}(y_{\text{replay}}) \in \{ 200, 201, 204 \}$$

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   AUTHORIZATION VERDICT DECISION MATRIX                                          │
├──────────────────────────┬──────────────────────────┬────────────────────────────────────────────┤
│ Baseline vs Replay Status│ Key Set Similarity J(K)  │ Verdict Classification                     │
├──────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ 200 OK vs 403 Forbidden  │ N/A                      │ ✅ SAFE: Access Correctly Denied           │
│ 200 OK vs 404 Not Found  │ N/A                      │ ✅ SAFE: Tenant/Object Isolation Enforced  │
│ 200 OK vs 401 Unauth     │ N/A                      │ ✅ SAFE: Authentication Required           │
│ 200 OK vs 200 OK         │ J(K) >= 0.85 (Data Match)│ 🚨 VULNERABILITY: Confirmed BOLA / BFLA    │
│ 200 OK vs 200 OK         │ J(K) < 0.40 (Error Body) │ ✅ SAFE: Application-Level Error Returned  │
└──────────────────────────┴──────────────────────────┴────────────────────────────────────────────┘
```

### 4.4 State-Mutation Confirmation Oracles (Read-After-Write Verification)

To eliminate false positives on deceptive `200 OK` responses that did not actually perform the requested modification:
1. When Principal B attempts an unauthorized write (`PUT /api/v1/documents/doc_1` with payload `{"title": "Hacked"}`), and receives `200 OK`.
2. The engine immediately dispatches a **Read-After-Write Confirmation Query** using Principal A's credentials (`GET /api/v1/documents/doc_1`).
3. If the resource reflects the modified data (`"title": "Hacked"`), the vulnerability is promoted with $100\%$ mathematical certainty.

---

## 5. State Machine Inference & Mealy FSM Modeling

### 5.1 Passive HTTP Trace Mining & Session Sequence Graphs

Web applications enforce business logic through sequential state workflows. SENTINEL V6 passively constructs workflow graphs from captured traffic traces $\mathcal{T} = \{ \sigma_1, \sigma_2, \dots, \sigma_N \}$.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     E-COMMERCE CHECKOUT MEALY FINITE STATE MACHINE                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [ S0: Cart Empty ] ──( POST /cart/add )──► [ S1: Cart Populated ]                              │
│                                                     │                                            │
│                                            ( POST /checkout/address )                            │
│                                                     ▼                                            │
│   [ S3: Order Complete ] ◄──( POST /order/place )─── [ S2: Payment Pending ]                     │
│            ▲                                                │                                    │
│            │                                                │                                    │
│            └─────────────── [ ATTACK PROBE ] ───────────────┘                                    │
│                     ( Skip S2: POST /order/place directly )                                      │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Formal Mealy Machine Model & $k$-Tails Equivalence ($k=2$)

A workflow is modeled as a Mealy Machine $M = (Q, \Sigma, \Gamma, \delta, \lambda, q_0)$ where:
- $Q$: Finite set of application workflow states.
- $\Sigma$: Input alphabet of parameterized HTTP actions.
- $\Gamma$: Output alphabet of HTTP status codes and masked response signatures.
- $\delta: Q \times \Sigma \to Q$: State transition function.
- $\lambda: Q \times \Sigma \to \Gamma$: Output function.

Using **$k$-Tails Equivalence** ($k=2$), states $q_1, q_2$ in the Prefix Tree Acceptor (PTA) are merged iff their future transition sequences of length $\le 2$ produce identical inputs and outputs:

$$k\text{-tail}(q) = \{ w \in \Sigma^{\le 2} \mid \delta(q, w) \text{ is defined} \}$$

### 5.3 Step-Skipping, Workflow Bypass & Payment Race Conditions

Once the FSM is inferred, the engine tests for:
1. **Prerequisite Step Skipping**: Directly executing the terminal action ($S_3$) from an initial state ($S_0$ or $S_1$) without executing the mandatory intermediate payment state ($S_2$).
2. **State Re-Entrancy & Double-Spend Races**: Executing concurrent single-packet race bursts on the state transition `S2 -> S3` to trigger multiple fulfillments from a single payment authorization.

### 5.4 Revoked Session & Zombie Token Persistence Detection

The engine validates session lifecycle boundaries:
1. Authenticate Principal A $\to$ Transition to privileged state $S_{\text{priv}}$.
2. Execute Logout (`POST /auth/logout`).
3. Replay privileged action $a \in \Sigma_{\text{priv}}$ using the cached session token.
4. If $\delta(q_{\text{logout}}, a) = S_{\text{priv}}$ and $\lambda(q_{\text{logout}}, a) = 200$, a **Zombie Session Lifecycle Vulnerability** is reported.

---

## 6. Token Lifecycle & Modern Authentication Protocol Probes

### 6.1 JWT/JWS/JWE Attack Suite

SENTINEL V6 includes a comprehensive test suite for JSON Web Tokens (RFC 7519):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         JWT VULNERABILITY PROBE TAXONOMY                                         │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ Attack Vector             │ Mutation Technique & Verification Mechanism                          │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 1. Algorithm Confusion    │ Mutate `alg: RS256` -> `HS256`; sign token with server's public RSA  │
│    (CVE-2015-9235)        │ key in PEM/X.509 format. Assert 200 OK access.                       │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 2. Signature Stripping    │ Mutate `alg: none` (and casing variants `None`, `NONE`); remove      │
│    (None Algorithm)       │ signature bytes (`header.payload.`). Assert 200 OK access.           │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 3. Key ID (kid) Injection │ Inject `kid: "../../../dev/null"`, `kid: "/etc/passwd"`, or SQLi     │
│                           │ payload `kid: "key1' UNION SELECT 'secret' --"`. Sign with `secret`. │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 4. Header Parameter Abuse │ Inject `jku` (JWK Set URL) pointing to local OAST server or embed    │
│                           │ rogue public key in `jwk` header claim.                              │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 5. Weak Secret Cracking   │ Offline HMAC-SHA256 dictionary check against top 100k secrets.       │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

### 6.2 OAuth 2.1 & OIDC Hardening Probes

The engine audits OAuth 2.0 / 2.1 and OpenID Connect workflows:
1. **PKCE Downgrade**: Stripping `code_challenge` and `code_challenge_method=S256` from the authorization request to test if the authorization server allows unauthenticated authorization code exchange.
2. **Redirect URI Pollution & Path Traversal**: Testing `redirect_uri=https://target.com/oauth/callback/../../attacker` and parameter pollution `redirect_uri=https://target.com&redirect_uri=https://attacker.com`.
3. **State Parameter CSRF**: Testing whether the `/authorize` endpoint permits requests lacking the `state` parameter or accepts replayed/arbitrary state values.
4. **Scope Escalation**: Appending privileged scopes (`scope=openid+profile+email+admin+billing`) during token refresh.

### 6.3 SAML / SSO Assertion & XML Signature Wrapping

For enterprise SAML 2.0 endpoints:
1. **XML Signature Wrapping (XSW 1–8)**: Injecting cloned, unsigned SAML assertions inside the XML envelope while preserving the valid signature on the wrapper element.
2. **Entity Expansion & XXE**: Testing SAML assertion XML parsers for external entity resolution (`SYSTEM "http://sentinel-oast-token"`).

---

## 7. Cryptographic Evidence & Security Invariants

### 7.1 Triangulated 3-Way Evidence Capture (SEC-06)

In compliance with **SEC-06 (Finding Proof Requirement)**, every authorization vulnerability must record a complete 3-way cryptographic transaction set:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   TRIANGULATED AUTHORIZATION EVIDENCE BUNDLE                                     │
├───────────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ Transaction 1: Baseline Read  │ Principal A (Owner) reads Resource 1 -> Status 200 OK (CAS Hash) │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Transaction 2: Replay Probe   │ Principal B (Attacker) reads Resource 1 -> Status 200 OK (CAS)   │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Transaction 3: Negative Ctrl  │ Principal B reads Non-Existent Res -> Status 404/403 (CAS Hash)  │
└───────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### 7.2 CAS Merkle Proof Binding (SEC-07)

All three request/response pairs are hashed using SHA-256 and bound into a Merkle root stored in Content-Addressed Storage (`sentinel_storage`). The finding is permanently bound to this cryptographic proof root.

### 7.3 SEC-09 Zeroized Memory & Secret Masking

- In all generated evidence artifacts, authorization headers (`Authorization: Bearer <TOKEN>`) and cookie headers are sanitized and masked (`Authorization: Bearer {{REDACTED_SEC_09}}`).
- Secret material is purged from volatile buffers immediately upon transaction completion.

---

## 8. Conclusion & Operational Roadmap

The SENTINEL V6 Multi-Principal Authorization & State Machine Engine sets a new industry benchmark for access control validation. By combining the IRA+ multi-principal grid with automated object discovery, semantic AST divergence oracles, Mealy FSM inference, and cryptographic CAS proofs, SENTINEL V6 delivers zero-compromise authorization testing across complex enterprise cloud ecosystems.

**Target Crate Integration**: `sentinel_auth`, `sentinel_diff`, `sentinel_logic`, `sentinel_storage`  
**Security Invariant Conformance**: SEC-06, SEC-07, SEC-09 Verified.
