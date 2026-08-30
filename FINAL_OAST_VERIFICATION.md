# SENTINEL V6 — FINAL OAST ENGINE & CORRELATION AUDIT

**Subsystem Evaluated**: `sentinel_oast` (SUB-18)  
**Protocol Handlers**: DNS (Port 53), HTTP (Port 80), HTTPS (Port 443)  
**Status**: 🟢 **ALL OAST SECURITY INVARIANTS & CORRELATION RULES VERIFIED**  
**Verification Date**: 2026-08-17  

---

## 1. Stateless AES-256-GCM Token Generator (SEC-02)

To prevent cross-tenant correlation leaks, replay attacks, and token guessing, OAST tokens are generated statelessly with AES-256-GCM:

```
+-------------------------------------------------------------------------------+
|                             OAST Token Payload                                |
|  [ Candidate UUID (16B) ] [ Project UUID (16B) ] [ Timestamp (8B) ] [ Nonce ]|
|  ────────────────────────────────────────────────────────────────────────────  |
|               AES-256-GCM Encrypted & Base32 Encoded Subdomain                |
|                    e.g. `c7f9a1b2d3e4...sentinel-oast.net`                     |
+-------------------------------------------------------------------------------+
```

- **Stateless Verification**: The OAST server does not require shared memory state to decrypt and validate incoming DNS/HTTP requests.
- **Collision Resistance**: 128-bit cryptographic candidate entropy guarantees zero token collision across concurrent scans.
- **Confidentiality**: Project ID and Candidate ID are encrypted inside the token, preventing external observers from discerning project names or vulnerability types.

---

## 2. Protocol Listeners & Interaction Recording

| Listener Protocol | Port | Interaction Trigger | Data Captured |
|:---|:---:|:---|:---|
| **DNS** | 53 (UDP/TCP) | A, AAAA, TXT, CNAME lookups | Source IP, Query Type, Raw Subdomain, Timestamp |
| **HTTP** | 80 (TCP) | Outbound SSRF / XXE / RCE curl | Source IP, Method, Headers, User-Agent, Body |
| **HTTPS** | 443 (TCP) | TLS handshake + HTTP payload | Client TLS cipher suites, SNI, HTTP Headers |

---

## 3. Correlation Engine & Verification Pipeline

- **Automatic Verification**: When an interaction matches an active scan candidate, the correlation engine emits an `OastInteraction` event.
- **Evidence Promotion**: The interaction details (DNS query bytes or HTTP request) are stored in CAS and attached to the `VerificationResult` as proof.
- **Adversarial Resilience**:
  - *Expired Tokens*: Callbacks received past expiration window (`ttl`) are logged as orphan interactions without promoting findings.
  - *Malformed / Bogus Tokens*: Decryption failures are rejected immediately without raising errors or crashing listeners.
  - *Duplicate Callbacks*: Deduplicated; only the initial callback transitions candidate state.
