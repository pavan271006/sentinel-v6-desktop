# Master Claim Corrections & False Certainty Audit V2

**Document Reference:** SENTINEL-V2-CORR-06  
**Classification:** Scientific Fact-Checking, Claim Audit & False Certainty Elimination  

---

## 1. Audit Principles

In accordance with scientific testing standards, all unsupported assertions, unbenchmarked percentage claims, and overgeneralized capabilities from the draft V1 corpus have been audited and corrected.

---

## 2. Comprehensive Claim Correction Matrix

| Draft V1 Assertion / Claim | Scientific Flaw / Overstatement | V2 Corrected Statement & Evidence Rating |
|:---|:---|:---|
| *"Canary in-band projection has 99.9% confidence."* | Unverified numerical precision. Reflection can occur in static echo pages without backend SQL execution. | **Corrected**: High qualitative reliability ($E5$) conditioned on verifying that the reflected canary is absent in negative baseline probes (Echo Masking). |
| *"Wald SPRT eliminates all false positives from jitter."* | Statistical tests control Type I error ($\alpha$) only under the assumed probability density function; non-stationary server drift can violate assumptions. | **Corrected**: Wald SPRT minimizes sample size and controls false alarms ($p < 0.01$) under stationary latency distributions; requires baseline drift recalibration ($E4$). |
| *"Shannon entropy search guarantees 4.2 requests per character and 38% network reduction."* | Theoretical simulation on English word frequency distributions; real-world database identifiers and random password hashes have higher entropy. | **Corrected**: **`THEORETICAL / DATASET-DEPENDENT`**. Achieves $\approx 4.2$ reqs/char on natural English text, but degrades to $O(\log_2 |\Sigma|) \approx 6.8$ reqs/char on uniform cryptographic hashes ($E4$). |
| *"DNS OOB exfiltration is universally allowed through firewalls."* | Enterprise cloud subnets and air-gapped enclaves frequently implement egress security groups blocking outbound UDP Port 53. | **Corrected**: OAST DNS resolution is network-environment-dependent; fails closed in strictly air-gapped database subnets ($E2$). |
| *"MySQL and PostgreSQL always support stacked queries via semicolon."* | Database engine support does not guarantee driver support. Default drivers (`mysql2`, `Connector/J`, `go-sql-driver`) disable multi-statements by default. | **Corrected**: Stacked queries require explicit driver configuration (`multipleStatements=true`, `allowMultiQueries=true`) in MySQL and Go/PHP drivers ($E2$). |
| *"Metamorphic TLP testing directly replaces DAST payloads."* | TLP was designed for DBMS engine fuzzing with direct SQL access; adapting TLP to web DAST requires application response branching on record counts. | **Corrected**: Metamorphic relational invariants serve as test oracles for boolean-blind DAST, requiring application count reflection ($E4$). |
| *"AI Prompt Injection is a fundamental SQL injection mechanism (MECH-14)."* | Conflates application-level prompt manipulation with database relational AST mutation. | **Corrected**: Prompt injection is an **Application-Layer Delivery Vector** where untrusted natural language causes an LLM to generate malicious SQL ($E3$). |
| *"Dynamic ORM object injection is a core SQL mechanism (MECH-15)."* | Conflates framework parameter binding bugs with relational grammar tokens. | **Corrected**: Reclassified under **Framework / Query Builder Abstraction Layer** ($E3$). |
