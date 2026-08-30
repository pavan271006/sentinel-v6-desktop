# SENTINEL V6 — FINAL DOMAIN MODEL

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE — IMPLEMENTATION READY  
> **CANONICAL REFERENCE**: `V6_CANONICAL_SPEC.yaml` § 2 (Domain Model)

---

## 1. Authoritative 6-Stage Vulnerability Lifecycle Pipeline

The core domain model enforces a strict, unidirectional 6-stage verification lifecycle:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Transaction │ ──> │ Observation │ ──> │  Candidate  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌────────────────────┐
│   Finding   │ <── │  Evidence   │ <── │ VerificationResult │
└─────────────┘     └─────────────┘     └────────────────────┘
```

1. **`Transaction`**: Raw, immutable network exchange captured at the socket or proxy boundary. Maintains triple representation (raw blob, parsed parts, normalized text).
2. **`Observation`**: Specific, factual phenomenon identified passively or actively from a Transaction (e.g., parameter reflection, anomalous status code, header disclosure).
3. **`Candidate`**: Formal hypothesis that an Observation constitutes a security vulnerability, containing test parameters and expected verification strategy.
4. **`VerificationResult`**: Result of executing an active verification strategy (Browser execution, OAST token correlation, differential analysis, timing variance).
5. **`Evidence`**: Cryptographic, content-addressed artifact proving the vulnerability without ambiguity.
6. **`Finding`**: Confirmed vulnerability record ready for reporting and remediation tracking. No Finding can exist without underlying verified Evidence.

---

## 2. Core Domain Entities (6 Entities)

| Entity | Primary Key / ID | Key Attributes | Invariants & Security Boundaries |
|--------|------------------|----------------|----------------------------------|
| **`Transaction`** | `meta.id` (Uuid) | `meta`, `request`, `response`, `timing`, `tls_info` | Content-addressed raw blobs; immutable once persisted; TLS cipher and timing recorded. |
| **`Observation`** | `meta.id` (Uuid) | `meta`, `source`, `data_ref` | Soft-deleted only; references raw transaction data_ref; provenance tagged. |
| **`Candidate`** | `meta.id` (Uuid) | `meta`, `source_observation_id`, `hypothesis`, `status` | Bound to source observation; requires active verification before becoming a Finding. |
| **`VerificationResult`**| `id` (Uuid) | `candidate_id`, `strategy_ref`, `success`, `confidence`, `evidence`, `executed_at` | Contains execution confidence (0.0 to 1.0) and collection of cryptographic evidence. |
| **`Evidence`** | `id` (Uuid) | `verification_id`, `variant`, `created_at` | Variants include `TransactionEvidence`, `OastEvidence`, `BrowserSnapshot`, `TimingVariance`, `Differential`. Content-addressed SHA-256 blobs. |
| **`Finding`** | `meta.id` (Uuid) | `meta`, `title`, `severity`, `verification_id`, `state` | Lifecycle states: `Candidate`, `Verified`, `Confirmed`, `Reported`, `Remediated`, `FalsePositive`, `AcceptedRisk`, `Regression`. |

---

## 3. Supporting Domain Entities (20 Entities)

1. **`Scope`**: Network access control definition containing inclusion/exclusion glob/regex patterns and rule versions.
2. **`Endpoint`**: Unique HTTP route defined by `host`, `path`, and `method`, linked to a knowledge graph node.
3. **`Payload`**: Mutated test vector targeting a specific `ParamLocation` with expected verification behavior.
4. **`Identity`**: Security principal representation containing username, role assignments, and session bindings.
5. **`Session`**: Active authentication session containing cookie jars, session headers, creation, and expiry timestamps.
6. **`Credential`**: Secret wrapper referencing a secure vault backend (`secret_reference`) with `access_level` and type.
7. **`SecretReference`**: Indirection pointer (`reference_id`, `vault_backend`) ensuring zero plaintext secrets exist in memory/disk.
8. **`Asset`**: Discovered infrastructure component (`Domain`, `IP`, `CloudService`, `Repository`).
9. **`Technology`**: Fingerprinted software stack item with category, version, and detection confidence.
10. **`State`**: Application state machine node capturing DOM structure, URL path, and session state.
11. **`Workflow`**: Multi-step attack sequence or automation routine definition.
12. **`Resource`**: System resource consumption tracker enforcing execution limits and quotas.
13. **`Action`**: Discrete operation executed by an engine or plugin with parameter bindings.
14. **`Task`**: Unit of background work tracked by the scheduler with lifecycle state and progress metrics.
15. **`Report`**: Generated assessment deliverable in Markdown, PDF, HTML, or JSON format.
16. **`RegressionTest`**: Automated test case derived from a verified finding to validate patch effectiveness.
17. **`OASTInteraction`**: Out-of-band interaction record containing token ID, protocol, remote IP, and raw packet blob.
18. **`AttackPath`**: Directed acyclic graph traversal connecting entry points to high-value assets with composite risk scores.
19. **`Note`**: User or AI annotation attached to any domain entity.
20. **`Screenshot`**: Visual evidence artifact capturing rendered web views or DOM state.

---

## 4. Credential Security & Zero Plaintext Secrets

SENTINEL V6 enforces strict zero-plaintext storage across all domain entities and logs:
- **`Credential -> SecretReference -> OS Keychain / Encrypted Vault`**.
- Domain objects, SQLite tables, event payloads, logs, telemetry, and crash reports ONLY store `secret_reference` UUIDs.
- Secrets are decrypted in memory strictly at the socket/transport layer immediately prior to transmission and scrubbed from memory buffers post-flight.

---

## 5. Scope Model & Structured Decision Engine

All active and passive network interactions require a mandatory **`ScopeDecision`** evaluation:

- **Default Action**: **`DENY`** (Fail-Closed).
- **Evaluation Order**: Explicit Deny Rules → Explicit Allow Rules → Default Deny.
- **`ScopeDecision` Schema**:
  - `decision_id`: Unique evaluation UUID
  - `allowed`: Boolean authorization verdict
  - `reason`: Structured human-readable rationale
  - `matched_rule`: Optional UUID of the determining scope rule
  - `target`: Evaluated URI, hostname, or IP address
  - `scope_version`: Revision number of the active scope configuration
  - `timestamp`: UTC evaluation timestamp
