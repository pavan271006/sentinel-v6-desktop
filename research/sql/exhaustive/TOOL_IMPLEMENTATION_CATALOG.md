# Security Tooling & Fuzzer Implementation Catalog (28 Architecture Patterns)

**Document Identifier:** SENTINEL-EXH-TOOL-19  
**Classification:** Open-Source Implementation Analysis, Tool Architectures & Algorithmic Benchmarking  

---

## 1. Tool Architectural Matrix

| Security System | Primary Architecture | Detection Paradigm | Concurrency Scheduling | Blind Inference Algorithm | Primary Structural Bottlenecks |
|:---|:---|:---|:---|:---|:---|
| **`sqlmap`** | Boundary + XML Templates (`payloads.xml`, `queries.xml`) | Static boundary testing + character extraction | Multi-threaded (`--threads`), but serial per parameter | Binary search / bitwise with fixed sleep threshold | Combinatorial overhead; rigid sequential loop; jitter false positives. |
| **`Burp Suite Scanner`** | Dynamic insertion points + insertion transforms | Response diffing + collaborator OAST | Thread pool with rate-limiting controls | Heuristic boolean diff + Collaborator polling | Proprietary closed-source; opaque decision heuristics. |
| **`OWASP ZAP`** | Rule-based active scanner plugins | Regex pattern matching + response codes | Concurrent target threads | Basic boolean true/false diffs | High false-positive rate on noisy dynamic endpoints. |
| **`Nuclei`** | Declarative YAML template matching | Static matchers (status, body, word) | High-speed async I/O worker pool | Limited (primarily in-band / error matching) | Ineffective for multi-stage blind inference or dynamic extraction. |
| **`libinjection`** | Deterministic C lexical tokenizer | Fingerprint mapping (`sqli_fingerprints.h`) | Microsecond $O(N)$ string evaluation | N/A (WAF token filter, not a DAST scanner) | Context-blind; misses arithmetic, second-order, and AST expressions. |
| **`SQLancer`** | Metamorphic testing (TLP, NoREC, PQS) | Relational query plan / count comparison | Single-database test harness | N/A (Database engine fuzzing, not web DAST) | Designed for direct SQL clients; requires direct SQL interface. |
| **`ghauri`** | Advanced boolean & time-based engine | Differential token matching + regex | Multi-threaded | Adaptive binary search | Limited dialect coverage beyond PostgreSQL/MySQL. |
| **`dsss`** | Compact heuristic python script | Single quote error & boolean reflection | Single-threaded | Basic true/false diff | Naive heuristics; no AST parsing. |

---

## 2. Key Algorithmic Lessons for Sentinel

1. **Active Planners vs. Static Templates (`sqlmap` Evolution)**:
   - `sqlmap`'s rigid boundary iteration (`boundaries.xml` $\times$ `payloads.xml`) forces hundreds of redundant tests. Sentinel replaces this with a **Bayesian Active Test Planner** computing Expected Information Gain (EIG) over Shannon entropy distributions.
2. **Lexical Tokens as Priors, Not Oracles (`libinjection` Evolution)**:
   - Token-level fingerprinting cannot prove SQL execution on a backend server. Sentinel uses lexical fingerprinting exclusively to initialize prior probabilities ($P(\text{Context})$).
3. **Metamorphic Invariants for Web DAST (`SQLancer` Evolution)**:
   - Ternary Logic Partitioning (TLP) enables relational verification without triggering database runtime errors or WAF alarms.
