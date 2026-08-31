# Master Academic Research Synthesis & Validation V2 (22 Key Papers)

**Document Reference:** SENTINEL-V2-ACAD-21  
**Classification:** Peer-Reviewed Academic Literature, Formal Methods & Empirical Validation  
**Venues:** USENIX Security, ACM CCS, IEEE S&P, OOPSLA, ESEC/FSE, ICSE, Annals of Math Stats  

---

## 1. Academic Validation & DAST Applicability Matrix

```
[ Pure DBMS Engine Fuzzing ] ──► Adapted into ──► [ Web DAST Relational Invariants ]
• Rigger & Su: TLP (OOPSLA 2020)                   • Boolean Partition Record Count Invariance
• Rigger & Su: NoREC (FSE 2020)                    • Unoptimized Reference Plan Differential
• Ba & Rigger: SQLRight (USENIX 2022)              • Dialect-Specific Grammar Compiler
• Abraham Wald: SPRT (1945)                        • Sequential Statistical Timing Oracles
```

---

## 2. Definitive Academic Literature Inventory

| Citation & Authors | Publication Venue | Core Mathematical / Algorithmic Contribution | Validated DAST Applicability & Integration | Evidence |
|:---|:---|:---|:---|:---|
| **Rigger & Su (2020)** | ACM OOPSLA | **Ternary Logic Partitioning (TLP)**: Splits query into $Q_{\text{TRUE}}, Q_{\text{FALSE}}, Q_{\text{NULL}}$ where $\text{Count}(Q_{\text{All}}) = \sum \text{Count}(Q_i)$. | Adapted into boolean-blind verification by evaluating response record count partitions. | **`E4`** |
| **Rigger & Su (2020)** | ACM ESEC/FSE | **Non-Optimizing Reference Comparison (NoREC)**: Rewrites WHERE predicates into projection sums: $\text{SUM}(\text{CASE WHEN } \phi \text{ THEN } 1 \text{ ELSE } 0 \text{ END})$. | Provides metamorphic relational oracle verifying query evaluation without modifying state. | **`E4`** |
| **Zhong et al. (2020)** | ACM CCS | **Squirrel Database Fuzzing**: Language-valid AST mutations guided by code coverage feedback. | Demonstrates that AST-structured semantic generation outperforms random string fuzzing. | **`E4`** |
| **Ba & Rigger (2022)** | USENIX Security | **SQLRight Differential Testing**: Syntax-directed mutation preserving dialect-specific grammar invariants. | Foundation for separating Abstract Test Intent from Target Dialect AST Compilers. | **`E4`** |
| **Abraham Wald (1945)** | Annals of Math Stats | **Sequential Probability Ratio Test (SPRT)**: Computes $LLR_n$ iteratively to minimize sample count under $\alpha, \beta$ error bounds. | Optimal statistical latency verification, eliminating fixed-delay false alarms. | **`E5`** |
| **Judea Pearl (2009)** | Cambridge Univ Press | **Causal Counterfactuals & Interventions**: Modeling causal graphs using $do(\cdot)$ calculus. | 5-step counterfactual causal confirmation eliminating correlational false alarms. | **`E5`** |
| **Galbreath (2012)** | Black Hat USA | **libinjection Lexical Tokenizer**: Microsecond $O(N)$ string tokenization mapping to known SQL fingerprints. | Used exclusively as heuristic prior probability $P(\text{Context})$, never as proof. | **`E5`** |
| **Halfond & Orso (2006)** | IEEE TSE | **AMNESIA AST Monitoring**: Comparing runtime SQL AST against static application models. | Structural comparison oracle identifying parser tree divergence. | **`E4`** |
| **Alkhalaf et al. (2014)**| ACM ICSE | **Sanitizer Verification**: Formal verification of string sanitization routines. | Differential testing of input sanitizers against SQL parser semantics. | **`E4`** |
| **Bisht et al. (2010)** | ACM CCS | **CANDID Invariant Detection**: Dynamic mining of query structure invariants. | Baseline model tracking structural DOM/JSON response invariants. | **`E4`** |
