# Observation Oracle Catalog (28 Channels)

**Document Identifier:** SENTINEL-EXH-ORC-12  
**Classification:** Evidence Channels, Observation Oracles & Multi-Sensor Fusion  

---

## 1. Multi-Sensor Evidence Spectrum

```
                              28 OBSERVATION ORACLES
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[In-Band Projection]  [Error Induction] [Boolean Relational][Statistical Time] [Out-of-Band OAST]
• ORC-01: Canary Body • ORC-04: CAST Err• ORC-10: Text Diff• ORC-15: SPRT Time• ORC-18: OOB DNS
• ORC-02: Canary JSON • ORC-05: Syntax  • ORC-11: Status Code• ORC-16: Fixed Time• ORC-19: OOB HTTP
• ORC-03: Canary XML  • ORC-06: XPath   • ORC-12: DOM Diff • ORC-17: Compute  • ORC-20: OOB SMB
                      • ORC-07: Div-Zero• ORC-13: Headers                     • ORC-21: OOB ICMP
                      • ORC-08: Overflow• ORC-14: Redirect
                      • ORC-09: Regex
```

---

## 2. Comprehensive Oracle Analysis & Verification Invariants

| Oracle ID | Observable Signal | Required Preconditions | Intrinsic Reliability | Primary Noise Sources | False-Positive Risks | False-Negative Risks |
|:---|:---|:---|:---|:---|:---|:---|
| **`ORC-01`** | `ORC-CANARY-BODY` | Visible output rendering in HTML response. | **Highest ($>99.9\%$)** | Statically cached HTML pages. | Near zero if nonce is cryptographic. | High if backend query results are discarded. |
| **`ORC-02`** | `ORC-CANARY-JSON` | JSON response reflecting projected field. | **Highest ($>99.9\%$)** | Inverted JSON serializers. | Near zero. | High on non-projecting endpoints. |
| **`ORC-03`** | `ORC-CANARY-XML` | XML response reflecting projected field. | **Highest ($>99.9\%$)** | XML entity escaping. | Near zero. | High on non-projecting endpoints. |
| **`ORC-04`** | `ORC-CAST-ERROR` | Verbose runtime exception returned in response. | **High ($95\%$)** | Generic custom error pages. | Low (Distinct type conversion string).| High in hardened production systems. |
| **`ORC-05`** | `ORC-SYNTAX-ERROR` | Database parser exception message. | **Medium ($85\%$)** | Application-level validation error messages.| Search terms containing word "syntax".| High in production error suppression. |
| **`ORC-06`** | `ORC-XPATH-ERROR` | MySQL `EXTRACTVALUE` error string. | **High ($95\%$)** | MySQL 8.0+ error truncation. | Low. | High on MySQL 8.4+ / 9.0. |
| **`ORC-07`** | `ORC-DIV-ZERO-ERROR` | Status 500 on TRUE; Status 200 on FALSE. | **High ($90\%$)** | Backend unhandled runtime exceptions. | Input validation throwing 500 on slash. | High if division by zero returns NULL (MySQL). |
| **`ORC-08`** | `ORC-OVERFLOW-ERROR`| Math overflow exception on condition. | **High ($90\%$)** | Database integer boundary checks. | Type parser errors. | Silent overflow wrapping. |
| **`ORC-09`** | `ORC-REGEX-ERROR` | Regex backtracking timeout exception. | **Medium ($80\%$)** | Web server regex filters. | WAF regex timeouts. | High regex engine optimizations. |
| **`ORC-10`** | `ORC-BOOLEAN-DIFF` | Text token delta between TRUE and FALSE. | **High ($92\%$)** | Dynamic timestamps, rotating advertisements. | Search query string reflection in UI. | High if UI displays constant static view. |
| **`ORC-11`** | `ORC-BOOLEAN-STATUS`| Status code delta (200 OK vs 500 Error). | **High ($92\%$)** | Transient gateway throttling. | Rate limiter 429/500 errors. | High if all errors map to 200 OK. |
| **`ORC-12`** | `ORC-DOM-STRUCT-DIFF`| HTML DOM element count / visibility delta. | **High ($94\%$)** | Client-side hydration noise. | Dynamic UI carousel changes. | CSS-hidden element rendering. |
| **`ORC-13`** | `ORC-HEADER-DIFF` | Response header divergence (`X-Total-Count`). | **High ($90\%$)** | Dynamic session cookie refreshes. | Nonce header updates. | Static proxy header caching. |
| **`ORC-14`** | `ORC-REDIRECT-DIFF`| Location header mutation (`/admin` vs `/login`). | **High ($95\%$)** | Authentication state timeouts. | Expired login redirects. | Unconditional landing page redirects. |
| **`ORC-15`** | `ORC-TIME-SPRT` | Sequential probability ratio latency shift. | **Highest ($>99\%$)** | Severe network congestion / packet loss. | Eliminated via log-likelihood bounds. | Strict gateway timeout ($< 3\text{s}$). |
| **`ORC-16`** | `ORC-TIME-FIXED` | Single-threshold latency delay $> 3\sigma$. | **Medium ($75\%$)** | Transient network spikes, server load bursts.| **High on noisy networks.** | Strict gateway timeouts. |
| **`ORC-17`** | `ORC-TIME-COMPUTE`| Heavy computation latency shift (`BENCHMARK`).| **Medium ($80\%$)** | Multi-tenant CPU throttling. | Concurrent server workload spikes. | Database query optimizer short-circuiting. |
| **`ORC-18`** | `ORC-OOB-DNS` | Authoritative DNS lookup logged on listener. | **Highest ($>99.9\%$)** | DNS recursive resolver caching. | Zero (Unique cryptographic subdomain). | Strict outbound UDP 53 firewall blocks. |
| **`ORC-19`** | `ORC-OOB-HTTP` | Outbound HTTP callback logged on listener. | **Highest ($>99.9\%$)** | Proxy timeouts. | Zero. | Strict outbound TCP 80/443 firewall blocks. |
| **`ORC-20`** | `ORC-OOB-SMB` | Outbound SMB negotiation logged on listener. | **Highest ($>99.9\%$)** | Windows firewall outbound TCP 445 blocks. | Zero. | ISP-level Port 445 filtering. |
| **`ORC-21`** | `ORC-OOB-ICMP` | Outbound ICMP ping interaction logged. | **High ($95\%$)** | Network gateway ICMP filtering. | Zero. | Host-level ICMP disablement. |
| **`ORC-22`** | `ORC-STATE-READ` | Dependent read endpoint reflects state change. | **High ($95\%$)** | Concurrent multi-user state writes. | Test data overwritten by other sessions. | State purged before read execution. |
| **`ORC-23`** | `ORC-STATE-ROWCOUNT`| Pagination metadata `total_records` delta. | **High ($95\%$)** | Concurrent database inserts by other users. | Background table row insertion. | Cached count totals in Redis. |
| **`ORC-24`** | `ORC-METAMORPHIC-TLP`| Partitioned query row count sum matches base. | **High ($96\%$)** | Volatile database rows being deleted. | Data mutation during sweep. | Static pagination limiting rows. |
| **`ORC-25`** | `ORC-METAMORPHIC-NOREC`| Reference query sum matches base count. | **High ($96\%$)** | Floating point rounding errors. | Data mutation during sweep. | Complex subquery joins. |
| **`ORC-26`** | `ORC-AST-DIFF` | DOM AST token delta without raw text changes. | **High ($92\%$)** | Dynamic class name mangling (CSS modules). | Frontend styling updates. | Pure textual response bodies (JSON/Text). |
| **`ORC-27`** | `ORC-SIDE-CACHE` | Query cache hit latency ($< 1\text{ms}$) vs miss ($> 20\text{ms}$).| **Medium ($70\%$)** | High server I/O contention. | Database buffer pool churn. | Query cache disabled (MySQL 8.0+). |
| **`ORC-28`** | `ORC-MULTI-FUSED` | Weighted Bayesian fusion of multiple channels. | **Highest ($>99.9\%$)** | Correlated multi-channel network failures. | Lowest across all observation methods. | Negligible. |
