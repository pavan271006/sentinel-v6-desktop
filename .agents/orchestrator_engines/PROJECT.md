# Project: SENTINEL V6 Platform & Testing Engines

## Architecture
- Core Workspaces & Engines:
  - Global Security Tool Research & Coverage Taxonomy (Delivered)
  - Tool Ecosystem & Capability Consolidation (Delivered)
  - Advanced Testing Engines (Auth, Session, Config, Injection, HTTP/Protocol, Discovery, Fuzzing, Recon, OAST, API, Business Logic)
  - 5 Proprietary Engines (Security Context Graph, Adaptive Test Planner, Differential Security Engine, Security Regression Graph, Engagement Memory)
  - Current Vulnerability Intelligence Engine (NVD/CVE, KEV, GHSA, OSV, Advisory Ingestion)
  - Local Deliberately Vulnerable Lab & Negative Controls (`tests/vulnerable_lab/`)
  - Full Production Desktop GUI (Tauri/React) & End-to-End Vitest/Build Validation

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Global Tool Research & License Matrix | Research WSTG, API Top 10, PortSwigger, Nuclei, Caido, ZAP, FFUF, Katana, Interactsh, Param Miner, Semgrep, Trivy | M1 | ORIGINAL_REQUEST §Follow-up R1 |
| 2 | Coverage Taxonomy Matrix | Canonical research docs: GLOBAL_SECURITY_TOOL_RESEARCH.md, EXTERNAL_TOOL_LICENSE_MATRIX.md, SENTINEL_SECURITY_COVERAGE_MATRIX.md | M1 | ORIGINAL_REQUEST §Follow-up R1 |
| 3 | Tool Ecosystem & Capability Audit | Audit 26 workspaces/subsystems, rationalize into KEEP, MERGE, RENAME, REPLACE, DEPRECATE, CONTEXTUALIZE | M2 | ORIGINAL_REQUEST §Follow-up R2 |
| 4 | Final Tool Ecosystem & Core Workflow | Enforce Traffic → Understand → Test → Verify → Evidence → Finding → Retest → Report in TOOL_ECOSYSTEM_AUDIT.md and FINAL_TOOL_ECOSYSTEM.md | M2 | ORIGINAL_REQUEST §Follow-up R2 |
| 5 | Advanced Testing Engines | Implement Auth/Identity, Session, Config, Deep Injection (SQLi, NoSQLi, CMDi, SSTI, XXE, Traversal, XSS, DOM XSS, Deserialization, Prototype Pollution), HTTP/Protocol (smuggling, desync), Discovery, Fuzzing/Races, Crawling, OAST, API, State/Logic | M3 | ORIGINAL_REQUEST §Follow-up R3 |
| 6 | 5 Custom SENTINEL Engines | Implement Context Graph, Adaptive Test Planner, Differential Security Engine, Security Regression Graph, Engagement Memory | M4 | ORIGINAL_REQUEST §Follow-up R4 |
| 7 | Vulnerability Intelligence Engine | Ingest CVE, CISA KEV, GHSA, OSV; confidence correlation; Verification-First CVE Testing; Deliver intelligence docs & YAML registry | M5 | ORIGINAL_REQUEST §Follow-up R5 |
| 8 | Local Deliberately Vulnerable Lab | Isolated local app in tests/vulnerable_lab/, VULNERABILITY_REGISTRY.yaml, ground-truth & negative control fixtures | M6 | ORIGINAL_REQUEST §Follow-up R6 |
| 9 | Production Desktop GUI & End-to-End Validation | Vitest suite 100% pass, npm run build 0 errors, deliver all 8 final reports | M7 | ORIGINAL_REQUEST §Follow-up R7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Global Security Tool Research & Coverage Taxonomy | Deliver GLOBAL_SECURITY_TOOL_RESEARCH.md, EXTERNAL_TOOL_LICENSE_MATRIX.md, SENTINEL_SECURITY_COVERAGE_MATRIX.md | none | DONE |
| M2 | Capability Audit & Tool Consolidation | Deliver TOOL_ECOSYSTEM_AUDIT.md and FINAL_TOOL_ECOSYSTEM.md | M1 | DONE |
| M3 | Advanced Testing Engines | Implement/verify 11 test engine domains | M2 | DONE |
| M4 | 5 Custom SENTINEL Proprietary Engines | Implement/verify Context Graph, Test Planner, Diff Engine, Regression Graph, Memory | M3 | DONE |
| M5 | Current Vulnerability Intelligence | Ingestion, Correlation, Verification-First Testing, YAML registry, UI spec | M4 | IN_PROGRESS |
| M6 | Local Deliberately Vulnerable Lab & Negative Controls | Lab app under tests/vulnerable_lab/, ground truth & negative control tests | M5 | PLANNED |
| M7 | Production GUI & E2E Validation | Full Vitest suite, build compilation, 8 final validation reports | M6 | PLANNED |

## Interface Contracts
- Security Context Graph: Node types (Asset, Endpoint, Parameter, Request, Response, Finding), edge types (HAS_ENDPOINT, ACCEPTS_PARAM, EMITS_RESPONSE, EXHIBITS_FINDING).
- Adaptive Test Planner: Input (Context Graph + Policy), Output (Ranked Next-Best-Test list with deterministic WHY reason).
- Differential Security Engine: Input (Baseline Request/Response, Mutated Request/Response), Output (Semantic/Statistical Divergence Metric).
- Security Regression Graph: States (VULNERABLE, FIXED, REGRESSED), Transitions triggered by retest evidence.
- Vulnerability Intelligence: Schema (`VULNERABILITY_RULE_REGISTRY.yaml`), Target Matching (CPE/Technology + Version constraint -> Candidate -> Precondition -> Safe Probe -> Verification).

## Code Layout
- Root: `c:\Users\Legion 5 pro\Desktop\cyber sec`
- Metadata: `.agents/`
- Core Rust Workspace: `sentinel_core/`
- UI / Frontend Workspace: `src/`
- Local Vulnerable Lab: `tests/vulnerable_lab/`
- Deliverable Documents: Workspace root Markdown / YAML files
