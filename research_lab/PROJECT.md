# Project: Security Research Laboratory

## Architecture
The Security Research Laboratory is a self-contained, air-gapped experimental environment designed for automated vulnerability discovery, hypothesis-driven black-box testing, independent verification, and academic/prior-art novelty evaluation.

```
research_lab/
├── lab/
│   ├── target/                  # Hardened production-like multi-tenant application baseline
│   ├── ground_truth/            # Seeded vulnerable test fixtures (CWE-89, 79, 639, 862, 367, 347, 918, H-006)
│   └── fixed_controls/          # Matched fixed and benign negative control counterparts
├── research_engine/             # Black-box autonomous discovery engine
│   ├── observer/                # Traffic & attack surface reconstruction
│   ├── context/                 # Multi-entity state graph & semantic model
│   ├── hypothesis/              # Formal hypothesis generators H1–H10
│   ├── planner/                 # Risk/coverage adaptive test scheduler
│   └── differential/            # Semantic & statistical divergence engine
├── verifier/                    # Air-gapped independent verification & novelty gate
│   ├── harness/                 # Clean-room test rebuilder & execution harness
│   ├── controls/                # Dual-oracle positive vs negative control assertions
│   ├── prior_art/               # Multi-source CVE/NVD/GHSA/OSV/KEV/Academic search engine
│   └── classifier/              # 4-tier rubric (KNOWN, VARIANT, NOVEL-CANDIDATE, CONFIRMED-NOVEL)
├── benchmarks/                  # Multi-architecture & adversarial stress test harness
├── tools/                       # Minimal standalone CLI detector (built only upon confirmed novel gate)
├── RESEARCH_LANDSCAPE.md
├── HARDENED_TARGET_SECURITY_BASELINE.md
├── TOP_10_CANDIDATE_REPORT.md
├── RESEARCH_BENCHMARK.md
├── ADVERSARIAL_EVALUATION.md
└── FINAL_RESEARCH_RESULTS.md
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SOTA Discovery Engine Taxonomy | Catalog Nuclei, Neo, Burp, ZAP, Caido, FFUF, Katana, Interactsh | M1 | R1 |
| 2 | SOTA Vulnerability Intelligence Catalog | Catalog CVE, NVD, CISA KEV, GHSA, OSV.dev, Academic search | M1 | R1 |
| 3 | Hardened Multi-Tenant Application Baseline | Realistic multi-tenant app with auth, RBAC/ABAC, invoices, ledgers, workflows | M1 | R2 |
| 4 | Hardened Baseline Security Audit | Automated baseline audit verifying 0 critical flaws in baseline | M1 | R2 |
| 5 | Seeded CWE Vulnerability Fixtures | Labeled fixtures (SQLi, XSS, BOLA, BFLA, TOCTOU, JWT, SSRF, H-006) | M2 | R3 |
| 6 | Fixed & Benign Negative Controls | Remediation fixtures for all CWE classes ensuring 0% FP baseline | M2 | R3 |
| 7 | Vulnerability Registry Index | Structured registry with metadata, preconditions, and assertions | M2 | R3 |
| 8 | Observer Surface Scanner | Black-box endpoint, parameter, and interaction graph extractor | M3 | R4 |
| 9 | Context Model & State Graph | Multi-actor entity graph, session tracking, state transition model | M3 | R4 |
| 10 | Formal Hypothesis Engine (H1–H10) | Generators for H1–H10 (State, Auth, Differentials, Races, Types, etc.) | M3 | R4 |
| 11 | Adaptive Test Planner & Scheduler | Risk/coverage optimized next-probe scheduler | M3 | R4 |
| 12 | Differential Security Engine | Multi-session, multi-role divergence & anomaly detection | M3 | R4 |
| 13 | Air-Gapped Test Rebuilder | Clean-room test case reconstruction from declarative descriptors | M4 | R5 |
| 14 | Dual-Oracle Control Harness | Verification on positive target vs negative controls (0% FP) | M4 | R5 |
| 15 | Multi-Source Prior-Art Search Engine | Vector/lexical prior-art search across CVE/NVD/GHSA/OSV/KEV/Academic | M4 | R5 |
| 16 | 4-Tier Novelty Classification Gate | Strict classification: KNOWN, VARIANT, NOVEL-CANDIDATE, CONFIRMED-NOVEL | M4 | R5 |
| 17 | Multi-Architecture Benchmark Suite | Comparative evaluation vs Regex, Single-step DAST, Random Fuzzing | M5 | R6 |
| 18 | Adversarial Jitter & Chaos Stress Test | Stress testing with latency jitter, noise injection, and 0% FP gate | M5 | R6 |
| 19 | Standalone Detection CLI Tool | Standalone CLI tool generated upon confirmed novel gate | M5 | R6 |
| 20 | Four Canonical Deliverable Reports | TOP_10_CANDIDATE, RESEARCH_BENCHMARK, ADVERSARIAL_EVAL, FINAL_RESULTS | M6 | R6 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | SOTA Research Landscape & Hardened Baseline | `RESEARCH_LANDSCAPE.md`, `lab/target/`, `HARDENED_TARGET_SECURITY_BASELINE.md` | none | DONE |
| M2 | Ground-Truth Lab & Negative Controls | `lab/ground_truth/`, `lab/fixed_controls/`, `lab/registry.py` | M1 | DONE |
| M3 | Autonomous Research & Hypothesis Engine | `research_engine/` (Observer, Context, Hypotheses H1–H10, Planner, Differential) | M2 | IN_PROGRESS |
| M4 | Independent Verifier & Novelty Gate | `verifier/` (Harness, Controls, Prior-Art Search, Classifier) | M3 | PLANNED |
| M5 | Benchmarking, Generalization & Tool Generation | `benchmarks/`, `tools/` (TSDE CLI tool, multi-arch eval, jitter test) | M4 | PLANNED |
| M6 | Final Synthesis & Deliverable Reports | `TOP_10_CANDIDATE_REPORT.md`, `RESEARCH_BENCHMARK.md`, `ADVERSARIAL_EVALUATION.md`, `FINAL_RESEARCH_RESULTS.md` | M5 | PLANNED |

---

## Interface Contracts

### 1. Hardened Target & Lab Fixtures ↔ Black-Box Engine
- **Protocol**: HTTP/1.1 REST + JSON (ASGI/AsyncIO)
- **Authentication**: Bearer JWT tokens (`sub`, `tenant_id`, `role`, `org_id`), API Keys (`X-API-Key`)
- **Headers**: `X-Tenant-ID`, `X-CSRF-Token`, `Content-Type: application/json`
- **Port / Endpoint Layout**:
  - Hardened Target: `http://127.0.0.1:8801`
  - Ground-Truth Lab: `http://127.0.0.1:8802`
  - Fixed Negative Controls: `http://127.0.0.1:8803`

### 2. Research Engine ↔ Independent Verifier Contract
- **Air-Gap Separation**: Zero shared memory, zero shared code modules.
- **Contract Format**: Declarative JSON Finding Descriptor (`FindingDescriptor`)
- **Schema**:
  ```json
  {
    "finding_id": "FIND-2026-001",
    "hypothesis_id": "H-006",
    "title": "Temporal State Desynchronization in Multi-Step Workflow",
    "target_endpoint": "/api/v1/workflows/approve",
    "method": "POST",
    "preconditions": [
      {"action": "create_invoice", "role": "editor"},
      {"action": "submit_for_review", "role": "editor"}
    ],
    "test_sequence": [
      {
        "step": 1,
        "method": "POST",
        "path": "/api/v1/workflows/state-transition",
        "headers": {"Authorization": "Bearer {user_b_token}"},
        "body": {"transition": "draft_to_approved", "version_id": 1}
      }
    ],
    "verification_assertions": {
      "status_code": 200,
      "state_divergence": true,
      "unauthorized_state": "approved"
    }
  }
  ```

### 3. Verifier ↔ Benchmark / Tool Harness Contract
- **Verification Output Schema (`VerificationResult`)**:
  - `finding_id`: string
  - `positive_trigger_verified`: boolean (True if reproduced on ground truth)
  - `negative_control_passed`: boolean (True if 0 FP on fixed control)
  - `jitter_resilience_score`: float (0.0 to 1.0)
  - `prior_art_similarity`: float (0.0 to 1.0)
  - `matched_prior_art`: array of CVE/NVD/GHSA/Paper identifiers
  - `novelty_verdict`: "KNOWN" | "VARIANT" | "NOVEL-CANDIDATE" | "CONFIRMED-NOVEL"
  - `generalization_verified`: boolean

---

## Code Layout
```
research_lab/
├── lab/
│   ├── target/
│   │   ├── app.py
│   │   ├── auth.py
│   │   ├── rbac.py
│   │   ├── models.py
│   │   ├── database.py
│   │   └── services/
│   ├── ground_truth/
│   │   ├── app.py
│   │   ├── fixtures/
│   │   └── registry.py
│   └── fixed_controls/
│       ├── app.py
│       └── fixtures/
├── research_engine/
│   ├── observer/
│   ├── context/
│   ├── hypothesis/
│   │   ├── h1_state_sequence.py
│   │   ├── h2_auth_asymmetry.py
│   │   ├── h3_protocol_diff.py
│   │   ├── h4_toctou_race.py
│   │   ├── h5_type_juggling.py
│   │   ├── h6_business_logic.py
│   │   ├── h7_session_integrity.py
│   │   ├── h8_input_injection.py
│   │   ├── h9_ssrf_oast.py
│   │   └── h10_crypto_invariants.py
│   ├── planner/
│   ├── differential/
│   └── engine.py
├── verifier/
│   ├── harness.py
│   ├── controls.py
│   ├── prior_art.py
│   ├── classifier.py
│   └── verify.py
├── benchmarks/
│   ├── benchmark_runner.py
│   ├── noise_generator.py
│   └── comparison_baselines.py
├── tools/
│   └── tsde_scanner.py
├── tests/
└── run_all_checks.py
```
