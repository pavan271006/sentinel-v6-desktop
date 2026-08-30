# Sentinel V6 Orchestration Plan

## Overview
Sentinel V6 Final Total Consistency & Implementation Repair requires resolving all inconsistencies, gaps, and mismatches across the architecture artifacts in `architecture/v6`, establishing `V6_CANONICAL_SPEC_SCHEMA.yaml` and `V6_CANONICAL_SPEC.yaml` as the machine-readable single source of truth, building an automated 11-step consistency validator, reconciling every derived artifact, and iterating until 0 blockers are achieved and cryptographically frozen.

## Phases & Work Breakdown

### Phase 1: Authoritative Material & Survey (Exploration & Spec Mining)
- Dispatch 3 parallel explorers / spec miners to survey the 26+ files in `architecture/v6`.
- Map all subsystems, tiers, domain types, interfaces/traits, events, IPC protos, configurations, error models, SQLite schema, HTTPQL grammar, rules, security invariants, permissions, and research modules.
- Identify known and latent inconsistencies, taxonomy discrepancies, and gaps.

### Phase 2: Create Canonical Machine-Readable Specification & Schema
- Create `V6_CANONICAL_SPEC_SCHEMA.yaml` defining the schema for the canonical specification.
- Create `V6_CANONICAL_SPEC.yaml` encompassing all subsystems, tiers, domain types, traits, interfaces, events (durable vs broadcast), IPC messages, config keys, error hierarchy, dependencies, security invariants, permissions/capabilities vs limits, AI tools & host policy rules, storage entities, versioning.

### Phase 3: Build Rigorous Consistency Validator & Test Suite (11-Step Sequence)
- Develop standalone executable specification-conformance validator script implementing the mandatory 11-step sequence:
  - Step 1: Validate V6_CANONICAL_SPEC.yaml against V6_CANONICAL_SPEC_SCHEMA.yaml
  - Step 2: Validate internal references within the canonical spec
  - Step 3: Validate subsystem taxonomy and arithmetic
  - Step 4: Validate types, traits, interfaces, events, config, permissions, resource limits, security invariants
  - Step 5: Compare canonical spec against Rust (V6_COMMON_TYPES.rs)
  - Step 6: Compare canonical spec against Protobuf/IPC (V6_IPC_CONTRACTS.proto)
  - Step 7: Compare canonical spec against SQL (V6_SQLITE_SCHEMA.sql)
  - Step 8: Compare canonical spec against Markdown registries (V6_FINAL_*.md)
  - Step 9: Run security-invariant checks
  - Step 10: Run dependency/graph checks
  - Step 11: Produce final conformance report
- Implement unit tests and negative failure fixtures for all validation steps.

### Phase 4: Total Workspace Reconciliation & Repair
- Reconcile all 16 domains across `architecture/v6`:
  1. Subsystem Manifest (`V6_FINAL_SUBSYSTEM_MANIFEST.md`, arithmetic, taxonomy)
  2. Domain Model & Lifecycle (`V6_FINAL_DOMAIN_MODEL.md`, Transaction -> Finding pipeline)
  3. Credential Security (`Credential -> SecretReference -> secure secret store`)
  4. Scope Model (`ScopeDecision`, default DENY)
  5. Type Registry & Rust Scaffolding (`V6_FINAL_TYPE_REGISTRY.md`, `V6_COMMON_TYPES.rs`)
  6. Interface & Trait Registry (`V6_FINAL_INTERFACE_REGISTRY.md`)
  7. Event Model & IPC Contracts (`V6_FINAL_EVENT_REGISTRY.md`, `V6_IPC_CONTRACTS.proto`)
  8. Configuration Registry (`V6_FINAL_CONFIGURATION_REGISTRY.md`)
  9. Error Model (`V6_FINAL_ERROR_MODEL.md`)
  10. Data & Storage (`V6_SQLITE_SCHEMA.sql`)
  11. Protocol / Traffic Repair (HTTP/1.1, HTTP/2, HTTP/3, QUIC, TLS, WS, SSE, gRPC)
  12. Scanner & Fuzzer Repair (Detection pipeline, FuzzProfile, Mutators, Oracles)
  13. Plugin Security (Capabilities vs ResourceLimits)
  14. Research Modules (SMT, RL, Crypto feature-gated)
  15. AI Security (Untrusted target content, host-side policy evaluation)
  16. Security Invariants (`V6_FINAL_SECURITY_INVARIANTS.md`)

### Phase 5: Multi-Pass Convergence, Cryptographic Freeze & Final Reports
- Execute DISCOVER -> REPAIR -> VALIDATE -> RED-TEAM -> REVALIDATE loop until BLOCKERS = 0.
- Execute independent verification pass.
- Update `V6_ARCHITECTURE_FROZEN.md` with:
  - Canonical specification SHA-256 hash
  - Specification version
  - Subsystem manifest SHA-256 hash
  - Rust contract SHA-256 hash
  - Protobuf contract SHA-256 hash
  - SQL schema SHA-256 hash
  - Validator version & commit/hash
  - Verification timestamp
  - Independent verification result & sign-off
- Generate final reports:
  - `V6_SPEC_CONFORMANCE_REPORT.md`
  - `V6_FINAL_REPAIR_AUDIT.md`
  - `V6_IMPLEMENTATION_READY.md`
- Report completion back to Sentinel.
