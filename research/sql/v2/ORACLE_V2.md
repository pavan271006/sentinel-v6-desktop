# Validated Observation Oracle Catalog V2 (18 Channels)

**Document Reference:** SENTINEL-V2-ORC-16  
**Classification:** Observation Sensors, Evidence Channels & Empirical Validation Standards  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Multi-Sensor Evidence Spectrum

In V2, redundant sub-channels (such as separate status vs redirect or body vs json canaries) are consolidated into **18 Distinct Observation Channels**:

```
                              18 VALIDATED OBSERVATION ORACLES
                                              │
    ┌──────────────────────┬──────────────────┼──────────────────┬──────────────────────┐
    ▼                      ▼                  ▼                  ▼                      ▼
[In-Band Reflection]   [Error Induction]  [Boolean Relational][Statistical Time]    [Out-of-Band Network]
• ORC-01: Canary Body  • ORC-03: CAST Err • ORC-07: Text Diff • ORC-12: SPRT Time   • ORC-14: OOB DNS
• ORC-02: Canary Struct• ORC-04: Syntax   • ORC-08: Status   • ORC-13: Compute Lock • ORC-15: OOB HTTP
                       • ORC-05: XPath    • ORC-09: DOM Diff                        • ORC-16: OOB SMB
                       • ORC-06: Div-Zero • ORC-10: Headers                         [Metamorphic & State]
                                          • ORC-11: Redirect                        • ORC-17: Metamorphic
                                                                                    • ORC-18: State Read
```

---

## 2. Comprehensive Oracle Analysis & Verification Invariants

| Oracle ID | Observable Signal | Required Preconditions | Qualitative Reliability | Primary Noise Sources | False-Positive Sources | False-Negative Sources | Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **`ORC-01`** | `ORC-CANARY-BODY` | Visible output projection in response body. | **Extremely High** | Static page caching. | Reflected search box echoes (mitigated via Echo Mask).| Backend query results discarded. | **`E5`** |
| **`ORC-02`** | `ORC-CANARY-STRUCT` | Nonce reflection inside JSON / XML structures. | **Extremely High** | Structure serialization errors. | Reflected request parameters. | Field filtering before rendering. | **`E5`** |
| **`ORC-03`** | `ORC-CAST-ERROR` | Verbose runtime type conversion exception. | **High** | Custom 500 error pages. | Application validation errors. | Production error suppression. | **`E5`** |
| **`ORC-04`** | `ORC-SYNTAX-ERROR` | Database parser syntax exception string. | **Moderate** | Input validation error messages.| Search terms containing word "syntax".| Production error suppression. | **`E5`** |
| **`ORC-05`** | `ORC-XPATH-ERROR` | MySQL XPath error leaking string data. | **High** | MySQL 8.0+ truncation. | Application XML errors. | MySQL 8.4+ / 9.0 deprecation. | **`E5`** |
| **`ORC-06`** | `ORC-DIV-ZERO-ERROR`| Status 500 on TRUE; Status 200 on FALSE. | **High** | Unhandled web exceptions. | Slash character rejected by WAF. | Division by zero returning NULL. | **`E5`** |
| **`ORC-07`** | `ORC-BOOLEAN-DIFF` | Text token delta between TRUE and FALSE. | **High** | Dynamic timestamps, rotating ads.| Reflected input text. | Fixed static error pages. | **`E5`** |
| **`ORC-08`** | `ORC-BOOLEAN-STATUS`| Status code transition (200 OK vs 500 Error).| **High** | Transient gateway throttling. | Rate limiter 429 errors. | Generic 200 OK error handlers. | **`E5`** |
| **`ORC-09`** | `ORC-DOM-STRUCT-DIFF`| HTML DOM element count / visibility delta. | **High** | Client-side hydration noise. | Dynamic UI carousel changes. | CSS-hidden element rendering. | **`E5`** |
| **`ORC-10`** | `ORC-HEADER-DIFF` | Response header divergence (`X-Total-Count`).| **High** | Dynamic session cookie refreshes. | Nonce header updates. | Static proxy header caching. | **`E5`** |
| **`ORC-11`** | `ORC-REDIRECT-DIFF`| Location header mutation (`/admin` vs `/login`).| **High** | Session timeouts. | Expired login redirects. | Unconditional redirects. | **`E5`** |
| **`ORC-12`** | `ORC-TIME-SPRT` | Sequential probability ratio latency shift. | **Extremely High** | Severe network congestion. | High server latency drift. | Strict gateway timeouts ($< 3\text{s}$). | **`E5`** |
| **`ORC-13`** | `ORC-TIME-COMPUTE`| Heavy computation latency shift (`BENCHMARK`).| **Moderate** | Multi-tenant CPU throttling. | Server workload bursts. | Optimizer short-circuiting. | **`E4`** |
| **`ORC-14`** | `ORC-OOB-DNS` | Authoritative DNS resolution query logged. | **Extremely High** | Recursive DNS caching. | Zero (Cryptographic nonce token). | Outbound UDP 53 firewall blocks. | **`E5`** |
| **`ORC-15`** | `ORC-OOB-HTTP` | Outbound HTTP callback logged on listener. | **Extremely High** | Proxy timeouts. | Zero. | Outbound TCP 80/443 blocks. | **`E5`** |
| **`ORC-16`** | `ORC-OOB-SMB` | Outbound SMB negotiation probe logged. | **Extremely High** | Windows firewall blocks. | Zero. | Port 445 network filtering. | **`E5`** |
| **`ORC-17`** | `ORC-METAMORPHIC` | TLP / NoREC relational count invariance. | **High** | Concurrent row deletions. | Data mutation during sweep. | Static pagination limits. | **`E4`** |
| **`ORC-18`** | `ORC-STATE-READ` | Dependent read endpoint reflects mutation. | **High** | Multi-user race conditions. | Test data overwritten. | State purged before read. | **`E5`** |
