# AI, Machine Learning & Deterministic Hybrid Systems in SQL Security

**Document Identifier:** SENTINEL-RES-AI-15  
**Classification:** Artificial Intelligence, LLM Security & Hybrid Architecture  

---

## 1. Comparative Analysis: AI vs. Deterministic Approaches

A major trend in modern security tooling is the unconstrained application of Large Language Models (LLMs) to security analysis. However, rigorous empirical evaluation reveals that **applying LLMs as direct vulnerability oracles produces unacceptable hallucination rates and non-deterministic results**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HYBRID ARCHITECTURAL DIVISION OF RESPONSIBILITY                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ DETERMINISTIC / STATISTICAL ENGINE   │ AI / LLM REASONING LAYER             │
│ • AST parsing & Dialect compilation  │ • Complex API documentation parsing  │
│ • Bayesian Belief state updating     │ • Workflow sequence dependency infer │
│ • Wald SPRT sequential timing        │ • Executive summary generation       │
│ • Counterfactual Causal Verification │ • Remediation code synthesis         │
│ (ZERO HALLUCINATION INVARIANTS)      │ (HIGH-LEVEL COGNITIVE ASSISTANCE)    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Capability Comparison Matrix

| Evaluation Dimension | Deterministic AST & Rules | Bayesian State Planner | Wald Statistical SPRT | LLM / Generative AI | Recommended Hybrid Role |
|:---|:---|:---|:---|:---|:---|
| **Syntactic Correctness** | **100% Guaranteed** | N/A | N/A | ~85% (May emit malformed SQL) | **Deterministic AST Engine** |
| **Execution Latency** | **< 1ms** | < 2ms | < 5ms | 500ms – 3000ms | **Deterministic Engine** |
| **False-Positive Rate** | Low (if well-scoped) | **Extremely Low** | **< 0.1%** | High (Hallucinates vulnerabilities) | **Bayesian + SPRT Core** |
| **Reproducibility** | **100% Deterministic**| **100% Mathematical**| **100% Statistical**| Variable (Temperature-dependent) | **Causal Verifier** |
| **Unstructured API Analysis**| Ineffective | Ineffective | Ineffective | **Excellent** | **LLM Semantic Parser** |
| **Multi-Step Flow Reasoning**| Complex | Medium | Ineffective | **Excellent** | **LLM Sequence Generator** |
| **Executive Reporting** | Rigid templates | Raw data | Raw data | **Fluent & Context-Aware** | **LLM Report Generator** |

---

## 3. Best-Practice Hybrid Architecture

1. **Deterministic Core Execution**: Generating AST payloads, calculating checksums, compiling SQL dialect strings, and evaluating multi-oracle responses MUST remain 100% deterministic and mathematical.
2. **Bayesian Active Planner**: Test selection must be governed by Expected Information Gain over Shannon entropy distributions, ensuring predictable, optimal experiment ordering.
3. **AI Cognitive Layer**: LLMs should be employed strictly for:
   - Reading Swagger/OpenAPI specifications to extract complex stateful workflows.
   - Summarizing multi-stage vulnerability proof artifacts into human-readable executive reports.
   - Generating tailored developer remediation snippets (e.g. converting raw SQL to parameterized ORM calls).
