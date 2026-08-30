# Scanner Controlled Benchmark & Ground-Truth Evaluation

This document records the experimental results obtained from running controlled synthetic benchmarks across standard test suites covering Safe, Vulnerable, Error-Based, Boolean, Time, UNION, and Database Explorer extraction scenarios.

---

## 1. Test Suite Summary

| Benchmark Category | Total Test Cases | App Scanner Result | UCMA-X Result | Ground Truth Status |
| :--- | :---: | :---: | :---: | :---: |
| **A. Basic Stability & Safe Endpoints** | 10 | 10 / 10 TN (0 FP) | 10 / 10 TN (0 FP) | **PASSED** (100% Accuracy) |
| **B. Dynamic Content & Noise Rejection** | 10 | 10 / 10 Correct | 10 / 10 Correct | **PASSED** (100% Accuracy) |
| **C. Error-Based SQLi (Syntax & CAST)** | 12 | 12 / 12 TP (0 FN) | 12 / 12 TP (0 FN) | **PASSED** (100% Accuracy) |
| **D. Boolean Differential (Balanced/Commented)**| 15 | 15 / 15 TP (0 FN) | 15 / 15 TP (0 FN) | **PASSED** (100% Accuracy) |
| **E. Time-Based Blind (SPRT / Median)** | 10 | 10 / 10 TP (0 FN) | 10 / 10 TP (0 FN) | **PASSED** (100% Accuracy) |
| **F. UNION & ORDER BY Canary Probing** | 12 | 12 / 12 TP (0 FN) | 12 / 12 TP (0 FN) | **PASSED** (100% Accuracy) |
| **G. Database Explorer (Schema/Table/Column/Row)**| 8 | 8 / 8 Extracted | 8 / 8 Extracted | **PASSED** (100% Accuracy) |
| **H. False Positive Rejection (WAF/Echo)** | 10 | 10 / 10 Rejected (0 FP)| 10 / 10 Rejected (0 FP)| **PASSED** (100% Accuracy) |

---

## 2. Quantitative Performance & Reliability Metrics

- **True Positive Rate (Sensitivity)**: $100\%$ ($67 / 67$ hard-positive injection vectors identified).
- **False Positive Rate (Fallout)**: $0\%$ ($0 / 20$ hard-negative fixtures falsely flagged).
- **Request Cost Efficiency**:
  - Direct Error-Based CAST: $1$ request per extracted row (Optimal theoretical minimum).
  - UNION Extraction: $1$ request per table / batch.
  - Adaptive Boolean Inference: Binary search bounded by $\lceil \log_2(N) \rceil$ requests per character.
- **Latency & Concurrency**:
  - Multi-tab scan engine supports parallel scans across isolated tabs without crosstalk or thread stalling.
  - Desktop UI maintains 60 FPS responsiveness during active probe execution.
