# Project: Sentinel V6 — Final Total Consistency & Implementation Repair

## Architecture
Sentinel V6 is a modern, modular, high-performance web security testing framework and platform.
The architecture comprises:
- Core Tiers (Subsystems across Core, Professional, Adapter, Research)
- Authoritative Domain Lifecycle: Transaction → Observation → Candidate → VerificationResult → Evidence → Finding
- Secure Secret Reference Architecture
- Fail-Closed Scope Decision Engine
- Dual Event Model (Fan-Out Broadcast vs. Durable/Auditable Critical Events)
- Single Machine-Readable Source of Truth: `V6_CANONICAL_SPEC.yaml`
- Multi-protocol traffic engine (HTTP/1.1, HTTP/2, HTTP/3, QUIC, TLS, WS, SSE, gRPC)
- Standalone Automated Specification-Conformance Validator

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Full Architecture Survey & Mapping | Read all 26+ files in architecture/v6, mine all types, interfaces, events, schemas, rules | Phase 1 (Survey) | ORIGINAL_REQUEST §1 |
| 2 | Canonical Machine-Readable Spec | Author `V6_CANONICAL_SPEC.yaml` encompassing all subsystems, types, interfaces, events, configs, invariants | Phase 2 (Spec) | ORIGINAL_REQUEST §2 |
| 3 | Conformance Validator & Test Suite | Standalone executable validator with full test suite & negative fixtures | Phase 3 (Validator) | ORIGINAL_REQUEST §3 |
| 4 | Total Workspace Reconciliation & Repair | Reconcile all 16 architecture/v6 areas against canonical spec | Phase 4 (Reconciliation) | ORIGINAL_REQUEST §4 |
| 5 | Multi-Pass Convergence & Freeze | DISCOVER -> REPAIR -> VALIDATE -> RED-TEAM -> REVALIDATE -> Freeze | Phase 5 (Convergence) | ORIGINAL_REQUEST §5 |
| 6 | Final Conformance & Repair Reports | Generate `V6_SPEC_CONFORMANCE_REPORT.md`, `V6_FINAL_REPAIR_AUDIT.md`, `V6_IMPLEMENTATION_READY.md` | Phase 5 (Reporting) | ORIGINAL_REQUEST §5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Survey & Specification Mining | Map all 26+ files in architecture/v6, categorize discrepancies | none | IN_PROGRESS |
| 2 | Canonical Specification Authoring | Create `V6_CANONICAL_SPEC.yaml` as single source of truth | M1 | PLANNED |
| 3 | Consistency Validator Engine & Tests | Build automated validator script and failure test fixtures | M2 | PLANNED |
| 4 | Comprehensive Workspace Reconciliation | Reconcile markdown, rust, proto, sql, pest, and yaml files | M2, M3 | PLANNED |
| 5 | Multi-Pass Convergence, Freeze & Reports | Achieve 0 blockers, verify independently, freeze architecture, write final reports | M4 | PLANNED |

## Interface Contracts
Interface contracts will be codified in `V6_CANONICAL_SPEC.yaml` and verified by `validate_v6_spec.py`.
