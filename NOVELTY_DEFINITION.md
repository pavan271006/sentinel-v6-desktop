# Zero-Day & Novelty Definition Framework

**Standard:** Root-Cause Invariant Security Verification  
**Policy:** Strict Taxonomic Classification (Anti-Hallucination)  

---

## 1. Taxonomic Classification Statuses

| Status | Exact Technical Definition | Criteria & Boundaries |
|---|---|---|
| **KNOWN** | Publicly documented vulnerability pattern, CVE, or CWE with identical root cause, trigger primitive, and affected abstraction layer. | Present in NVD, GHSA, CISA KEV, or major framework advisories. |
| **KNOWN-BUT-UNINDEXED** | Publicly discussed in research blogs, commit messages, bug bounties, or issue trackers, but lacking a formal CVE/GHSA identifier. | Verifiable prior public record exists in technical literature. |
| **VARIANT-OF-KNOWN** | Identical underlying root cause and security invariant violation occurring at a different URL, parameter, or sub-component. | e.g., Finding BOLA on `/api/v2/invoices` when BOLA on `/api/v1/invoices` is already cataloged. |
| **DUPLICATE** | Redundant candidate reporting the same defect via a different observed telemetry artifact. | Merged into existing primary candidate ID. |
| **FALSE-POSITIVE** | Apparent anomaly caused by expected application logic, benign error handling, test harness race conditions, or network jitter. | Fails negative control or fixed-implementation differential test. |
| **MISCONFIGURATION** | Flaw stemming from deployment environment, default credentials, or permissive operational flags rather than code architecture flaw. | Remedied solely by standard deployment baseline hardening. |
| **APPLICATION-SPECIFIC-FLAW** | Business-logic bug arising strictly from idiosyncratic customer business rules with zero generalizability across the software ecosystem. | Not reproducible in generalized architectural pattern. |
| **NOVEL-CANDIDATE** | Anomaly demonstrating verified security invariant violation with uncharacterized root cause, surviving initial negative controls. | Awaiting independent verifier reproduction and exhaustive prior-art clearance. |
| **CONFIRMED-NOVEL** | Satisfies ALL novelty gates: independent reproduction, root-cause uniqueness, prior-art clearance, generalized abstraction failure, and verified impact. | Eligible for standalone tool architecture or formal disclosure protocol. |
| **INCONCLUSIVE** | Behavior cannot be reliably reproduced, or security impact cannot be demonstrated under controlled conditions. | Archived with reproduction telemetry for future investigation. |

---

## 2. Mandatory Novelty Invariants

A vulnerability is **NEVER** classified as novel merely because:
1. No Nuclei template or Burp rule exists for it.
2. No exact CVE match was returned for the specific endpoint string.
3. An automated LLM or scanner labeled it "critical" or "unknown".
4. The target responded with HTTP 500 / 200 unexpectedly.

### True Novelty Requirement:
To reach **CONFIRMED-NOVEL**, the candidate must establish:
- **Novel Root Cause:** An uncharacterized failure mode in standard protocol composition, state synchronization, parser semantics, or trust boundary enforcement.
- **Reproducible Impact:** Concrete breach of Confidentiality, Integrity, or Availability under independent verification.
- **Negative Control Clearance:** Deterministic divergence between vulnerable and fixed target implementations under identical inputs.
- **Literature & Registry Clearance:** Zero overlap across CVE, NVD, GHSA, OSV, USENIX/IEEE/ACM/BlackHat archives, and commit histories.
