# SENTINEL V6 — CANONICAL EVENT REGISTRY

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE — 100% SYNCHRONIZED  
> **CANONICAL SPEC**: `V6_CANONICAL_SPEC.yaml` § 4  
> **RUST IMPLEMENTATION**: `V6_COMMON_TYPES.rs` (`SentinelEvent`, `CriticalEvent`)  
> **PROTOBUF IPC**: `V6_IPC_CONTRACTS.proto` (`SentinelUiStream`)

All events traversing the `EventBus` are classified into two strict delivery tiers:

---

## 1. Broadcast / Telemetry Events (`broadcast::Receiver<SentinelEvent>`)

Best-effort, high-throughput fan-out delivery. Bounded buffer (capacity: 10,000). Dropped upon severe consumer lag without blocking the producer.

| Rust Variant (`SentinelEvent`) | Producer Subsystem | Primary Consumers | Payload Data | IPC Message (`SentinelUiStream`) |
|---|---|---|---|---|
| `ObservationCreated(Uuid)` | `ProxyEngine` (SUB-01) | `ObservationStore`, UI | Observation UUID | `UiTrafficEvent` |
| `ContextDetected(Uuid)` | `ContextEngine` (SUB-10) | `KnowledgeEngine`, UI | Target Endpoint UUID | `UiContextEvent` |
| `CoverageUpdate(Uuid)` | `CoverageEngine` (SUB-11) | `ScanOrchestrator`, UI | Scope UUID | `UiCoverageEvent` |
| `ScanProgress(ScanProgressUpdate)` | `ScanOrchestrator` (SUB-07) | UI, Task Monitor | Scan ID, phase, pct, completed checks | `UiScanProgressEvent` |
| `TaskStatus(TaskStateUpdate)` | `TaskScheduler` (SUB-06) | UI, Health Monitor | Task ID, TaskLifecycle, progress, err | `UiTaskStatusEvent` |

---

## 2. Durable / Critical Events (`mpsc::Receiver<CriticalEvent>`)

Guaranteed, lossless delivery with bounded backpressure. Never silently dropped. Directly updates state machine and ACID WAL logs.

| Rust Variant (`CriticalEvent`) | Producer Subsystem | Primary Consumers | Payload Data | IPC Message (`SentinelUiStream`) |
|---|---|---|---|---|
| `FindingCreated(Uuid)` | `VerificationEngine` (SUB-09) | `ObservationStore`, ReportEngine, UI | Finding UUID | `UiFindingEvent` |
| `CandidateVerified(Uuid)` | `VerificationEngine` (SUB-09) | `ObservationStore`, UI | Candidate UUID | `UiCandidateVerifiedEvent` |
| `ScopeViolationAttempt` | `ProxyEngine` (SUB-01) | Security Logger, UI, Audit Log | Source, Target, ScopeDecision | `UiScopeViolationEvent` |

---

## 3. Event Delivery Invariants

1. **Backpressure Policy**: Critical events yield the async task if the queue is full (`tokio::sync::mpsc` bounded buffer).
2. **Lag Policy**: Telemetry broadcast channels drop oldest frames if a slow UI consumer lags past buffer bounds, without slowing network proxying.
3. **Audit Trail**: Every critical event is immutably appended to SQLite WAL before dispatch confirmation.
