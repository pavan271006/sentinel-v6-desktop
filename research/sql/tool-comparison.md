# Comparative Analysis of Existing Security Tooling & Fuzzers

**Document Identifier:** SENTINEL-RES-TOOL-12  
**Classification:** Competitive Tool Architecture & Engineering Analysis  
**Systems Analyzed:** sqlmap, Burp Suite, OWASP ZAP, Nuclei, libinjection, SQLancer  

---

## 1. Architectural Capability Matrix

| System | Primary Architecture | Detection Paradigm | Concurrency Model | Blind Inference Model | Key Weakness / Bottleneck |
|:---|:---|:---|:---|:---|:---|
| **`sqlmap`** | Boundary + XML Templates (`payloads.xml`, `queries.xml`) | Static boundary testing + binary search | Multi-threaded (`--threads`), but serial per parameter | Binary search / bitwise with fixed sleep threshold | High request count; rigid sequential loop; jitter false positives. |
| **`Burp Suite Scanner`** | Dynamic insertion point insertion + heuristic diffing | Response diffing + collaborator OAST | Thread pool with rate-limiting controls | Heuristic boolean diff + Collaborator polling | Proprietary closed-source; opaque decision heuristics. |
| **`OWASP ZAP`** | Rule-based active scanner plugins | Regex pattern matching + response codes | Concurrent target threads | Basic boolean true/false diffs | High false-positive rate on noisy dynamic endpoints. |
| **`Nuclei`** | Declarative YAML template matching | Static matchers (status, body, word) | High-speed async I/O worker pool | Limited (primarily in-band / error matching) | Ineffective for complex multi-stage blind inference or data extraction. |
| **`libinjection`** | Deterministic C lexical tokenizer | Fingerprint mapping (`sqli_fingerprints.h`) | Microsecond $O(N)$ string evaluation | N/A (WAF token filter, not a DAST scanner) | Context-blind; misses arithmetic, second-order, and AST expressions. |
| **`SQLancer`** | Metamorphic testing (TLP, NoREC, PQS) | Relational query plan / count comparison | Single-database test harness | N/A (Database engine fuzzing, not web DAST) | Designed for raw database clients; requires direct SQL interface. |

---

## 2. Deep Architectural Lessons for Sentinel

### 2.1 From `sqlmap`: Active Planners vs. Static Templates
- *Lesson*: `sqlmap`'s rigid boundary iteration (`boundaries.xml` $\times$ `payloads.xml`) causes massive combinatorial overhead.
- *Sentinel Evolution*: Sentinel uses a **Bayesian Adaptive Test Planner** that computes Expected Information Gain (EIG) over Shannon entropy, selecting the single most informative experiment and pruning incompatible tests before transmission.

### 2.2 From `libinjection`: Lexical Priors, Not Ground Truth
- *Lesson*: Token-level fingerprinting is useful for fast heuristic classification, but cannot establish true vulnerability without observing backend execution.
- *Sentinel Evolution*: Uses lexical analysis solely as prior probabilities ($P(\text{Context})$) for the Bayesian engine.

### 2.3 From `SQLancer`: Metamorphic Invariants for DAST
- *Lesson*: Ternary Logic Partitioning (TLP) and metamorphic relations allow verifying relational logic without triggering syntax errors.
- *Sentinel Evolution*: Incorporates metamorphic relational invariants into the Multi-Oracle Evaluator to detect blind boolean SQLi without raising WAF alarm thresholds.
