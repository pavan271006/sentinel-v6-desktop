# Target Authorization & Research Scope Record

**Protocol:** Section 0 Mandatory Target Authorization Gate  
**Status:** `AWAITING_TARGET_AUTHORIZATION`  

---

## 1. Authorization Requirements

Before initiating any real-world active scanning or hypothesis execution, the following fields must be documented and verified:

| Field | Required Value | Current Status |
|---|---|---|
| **Target Host / URL** | Fully Qualified Domain Name (FQDN) or IP | *PENDING SPECIFICATION* |
| **Owner / Organization** | Legal entity or platform owner | *PENDING SPECIFICATION* |
| **Program Type** | Own Application / Public Bug Bounty / Explicit VDP | *PENDING SPECIFICATION* |
| **Documented Scope** | Exact in-scope paths, domains, and API endpoints | *PENDING SPECIFICATION* |
| **Allowed Techniques** | Bounded HTTP/REST/GraphQL probing, state analysis | *PENDING SPECIFICATION* |
| **Prohibited Techniques** | DoS, brute-force, data destruction, social engineering | *STRICTLY ENFORCED* |
| **Rate Limit Bound** | Maximum allowed requests per second (e.g., \(\le 5\) req/s) | *DEFAULT: 2 req/s* |
| **Authorization Proof** | Policy URL, security.txt, or explicit written consent | *PENDING SPECIFICATION* |

---

## 2. Hard Stop Condition

Per Rule 0:
If no explicit authorized real-world target and scope is provided by the operator:
**ACTIVE REAL-WORLD TESTING IS HALTED.**
Research continues only on local production-grade open-source reference instances.
