# SENTINEL V6 — BIDIRECTIONAL TRACEABILITY

> **DATE**: 2026-08-17 (Repair Cycle)
> **STATUS**: AUTHORITATIVE

This document maps the architectural requirements to the concrete code contracts (`V6_COMMON_TYPES.rs` and `V6_IPC_CONTRACTS.proto`), ensuring no orphaned code exists and no requirement is left unfulfilled.

## Forward Traceability: Requirement → Code

| Architectural Requirement | Target Subsystem | Implementation Trait | Data Type | Key Event |
|---------------------------|------------------|----------------------|-----------|-----------|
| Must intercept TLS traffic | `ProxyEngine` | `ProxyEngine` | `Transaction` | `ObservationCreated` |
| Must strictly enforce scope | `ScopeEngine` | `ScopeEngine` | `Scope` | `ScopeViolationAttempt` |
| Must isolate plugin execution | `PluginRuntime` | `PluginRuntime` | `Capabilities` | N/A |
| Must track tasks reliably | `TaskScheduler` | `TaskScheduler` | `TaskConfig` | `TaskStatus` |
| Must generate deterministic proofs | `VerificationEngine`| `VerificationEngine` | `VerificationResult` | `FindingCreated` |
| Must allow LLM prompt generation | `AIEngine` | `AiEngine` | `AiRequest` | N/A |
| Must prevent LLM destructive acts | `AIPolicyEngine` | `AiPolicyEngine` | `PolicyResult` | N/A |
| Must support external active recon | `SubfinderAdapter`| `ExternalToolAdapter`| `SubdomainAsset` | N/A |

## Backward Traceability: Code → Requirement

| Implementation Element | Source Requirement | Consumer / Dependency | Acceptance Criteria |
|------------------------|--------------------|-----------------------|---------------------|
| `trait HttpParser` | Must resist HTTP desync attacks | `ProxyEngine` | Differential fuzzing passes |
| `enum LifecycleState` | Must track object lifetimes | DB queries, UI | Soft-delete behaves properly |
| `struct DiffData` | Must verify parameter injection | `VerificationEngine` | High confidence structural diff |
| `message UiScopeViolationEvent`| Must alert user on dropped packets| UI Frontend | User receives toast notification |
| `struct OastEvidence` | Must correlate out-of-band | `VerificationEngine` | Poll retrieves token matches |

**Conclusion:** All contracts have been bound bidirectionally to a core architectural requirement. There are no orphaned contracts.
