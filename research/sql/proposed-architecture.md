# Proposed Sentinel Future Architecture: Research-Derived System Model

**Document Identifier:** SENTINEL-RES-ARCH-16  
**Classification:** Autonomous Investigation Engine Architecture Proposal  
**Status:** Conceptual System Design (Pre-Implementation Specification)  

---

## 1. System Block Diagram

```
                                  ONE RAW HTTP REQUEST
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 1. Zero-Knowledge Ingress Extractor   │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 2. Multi-Sample Baseline Profiler     │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 3. Bayesian Hypothesis & Entropy Model│
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 4. EIG Active Planner & Pruner        │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 5. Semantic AST & Dialect Compiler    │
                       └───────────────────┬───────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
     ┌─────────────────────────────┐               ┌─────────────────────────────┐
     │ 6a. Bounded Worker Pool     │               │ 6b. Sequential Timing Lane  │
     │     (10x to 50x Concurrency)│               │     (Wald SPRT Engine)      │
     └──────────────┬──────────────┘               └──────────────┬──────────────┘
                    └──────────────────────┬──────────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 7. Multi-Oracle Evaluator & Echo Mask │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 8. 5-Step Counterfactual Causal Proof │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 9. Recursive Database Explorer        │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ 10. Impact Separation & Evidence CAS  │
                       └───────────────────────────────────────┘
```

---

## 2. Component Specifications

### Component 1: Zero-Knowledge Ingress Extractor
* **Problem It Solves**: Eliminates manual parameter and protocol configuration.
* **Research Basis**: RFC 7230, RFC 8259 (JSON), GraphQL Spec, Multipart RFC 7578.
* **Expected Benefit**: Discovers all candidate vectors across Query, JSON, Headers, Cookies, Path, and GraphQL automatically.
* **Potential Limitation**: Complex binary serializations (Protobuf/gRPC) require pre-compiled schema definitions.

### Component 2: Multi-Sample Baseline Profiler
* **Problem It Solves**: Prevents false positives caused by dynamic nonces, fluctuating timestamps, and unstable server responses.
* **Research Basis**: Empirical Variance Modeling & Levenshtein Token Masking.
* **Expected Benefit**: Identifies stable response regions and measures baseline latency distribution ($\mu_0, \sigma$).

### Component 3: Bayesian Hypothesis & Shannon Entropy Model
* **Problem It Solves**: Replaces rigid sequential payload execution with probabilistic uncertainty tracking.
* **Research Basis**: Shannon Information Theory ($H(P) = -\sum p \log_2 p$) and Bayesian Active Learning.
* **Expected Benefit**: Quantifies exact uncertainty across SQL Contexts, DBMSs, and Vulnerability probabilities.

### Component 4: Expected Information Gain (EIG) Planner & Pruner
* **Problem It Solves**: Solves the combinatorial explosion problem by selecting tests that maximize information gain per request cost.
* **Research Basis**: Decision Theory & Active Inquiry Optimization.
* **Expected Benefit**: Reduces scan requests by up to $80\%$ via compatibility pruning and intelligent early stopping.

### Component 5: Semantic AST & Dialect Compiler
* **Problem It Solves**: Decouples abstract test intent (e.g. `TRUE_FALSE_DIFFERENTIAL`) from engine syntax nuances.
* **Research Basis**: Squirrel (ACM CCS 2020) & SQLRight (USENIX Security 2022).
* **Expected Benefit**: Synthesizes syntactically valid dialect expressions for PostgreSQL, MySQL, MSSQL, Oracle, and SQLite.

### Component 6: Bounded Concurrent Safety Executor
* **Problem It Solves**: Balances maximum scan throughput against target stability and measurement integrity.
* **Research Basis**: Concurrency Semaphore Governance & Traffic Isolation.
* **Expected Benefit**: Achieves 10–50x parallel extraction throughput for `PARALLEL_SAFE` probes while maintaining 100% low-jitter integrity for `TIMING_SENSITIVE` SPRT probes.

### Component 7: Multi-Oracle Evaluator & Differential Echo Mask
* **Problem It Solves**: Eliminates reflection false positives and combines orthogonal evidence channels.
* **Research Basis**: Multi-Sensor Evidence Fusion & Dynamic Content Masking.
* **Expected Benefit**: Evaluates 15 channels simultaneously (Canary, CAST, Boolean Diff, SPRT, DOM) while masking reflected inputs.

### Component 8: 5-Step Counterfactual Causal Verifier
* **Problem It Solves**: Guarantees zero false positives through scientific empirical proof.
* **Research Basis**: Pearl's Counterfactual Causal Inference ($P(Y \mid \text{do}(X))$).
* **Expected Benefit**: Requires positive intervention ($s_1$), counterfactual control ($s_2$), noise rejection ($s_3$), and clean-room reproduction ($s_4$) before promoting findings.

### Component 9: Recursive Database Explorer
* **Problem It Solves**: Extracts verified database schemas and sample data without using hardcoded dictionary lists.
* **Research Basis**: Data Dictionary Metamodeling & Automated Entity Extraction.
* **Expected Benefit**: Maps database catalogs, application vs. system tables, columns, and data types with automatic sensitive data masking.

### Component 10: Impact Separation & Evidence CAS Engine
* **Problem It Solves**: Prevents speculative vulnerability inflation.
* **Research Basis**: CVSS v4.0 & BLAKE3 Content-Addressable Storage (CAS).
* **Expected Benefit**: Strictly separates Root Vulnerability from Demonstrated Capability and Speculative Impact with cryptographic proof hashes.
