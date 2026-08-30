# SENTINEL V6 — FINAL SCANNER & SCAN ORCHESTRATOR VERIFICATION

**Subsystems Evaluated**: `sentinel_scanner` (SUB-08), `sentinel_context` (SUB-10), `sentinel_coverage` (SUB-12)  
**Status**: 🟢 **SCANNER LIFECYCLE & INVARIANTS FULLY VERIFIED**  
**Verification Date**: 2026-08-17  

---

## 1. Scan Orchestrator State Machine & Lifecycle

The Scan Orchestrator coordinates distributed and local active/passive scans across configured endpoints:

```
[ Created ] ──► [ Queued ] ──► [ Running ] ──┬──► [ Paused ] ──► [ Running ]
                                     │       ├──► [ Completed ]
                                     │       ├──► [ Cancelled ]
                                     │       └──► [ Failed ]
```

- **Lifecycle Transitions**: Verified all state transitions (`Pause`, `Resume`, `Cancel`, `Complete`) in `test_scan_orchestrator_lifecycle`.
- **Checkpointing & Persistence**: Scan state and progress are saved to SQLite, allowing seamless resumption after process restarts.
- **Budget Limits**: Enforces request rate limits (RPS caps), maximum total requests per scan, and timeout limits.

---

## 2. Security Check Engine: Passive & Active Capabilities

| Check Type | Target Surface | Detection Logic | Evidence Produced |
|:---|:---|:---|:---|
| **Passive: Security Headers** | Response Headers | Missing `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` | Raw response headers with missing flags highlighted |
| **Passive: Cookie Flags** | `Set-Cookie` Headers | Missing `HttpOnly`, `Secure`, or `SameSite=Strict/Lax` | Captured cookie attributes |
| **Passive: Info Disclosure** | Response Body/Headers | Exposed stack traces, debug banners, server version disclosures (`Server`, `X-Powered-By`) | Fingerprinted banner snippet |
| **Active: Parameter Probes** | URL / Body Params | Automated insertion of SQLi, SSTI, XSS, Path Traversal, and Command Injection markers | HTTP Transaction pair + Diff |
| **Active: Auth Bypass** | Protected Routes | Unauthenticated or modified credential requests | Status code + Body comparison |

---

## 3. Finding Generation & SEC-06 Compliance

- **No Unverified Findings**: Active scan probes generate `Candidate` entities. The scanner **never** writes directly to `FindingState::Confirmed`.
- **Proof Pipeline**: Candidates are routed through the `VerificationEngine`. Only candidates with reproducible response differentials, content matches, or OAST callbacks are promoted to `FindingState::Confirmed`.
- **Scope Compliance (SEC-01)**: The scanner passes every target URL to `ScopeEngine::is_in_scope()`. Out-of-scope targets are skipped and logged as security events.
