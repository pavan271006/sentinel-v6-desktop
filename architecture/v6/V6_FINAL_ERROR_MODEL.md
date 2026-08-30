# SENTINEL V6 — FINAL ERROR MODEL

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE

All subsystems MUST use the canonical `SentinelError` enum for unrecoverable errors. Subsystems may NOT invent incompatible `Result` error models for cross-boundary communication.

## 1. Canonical Error Types

| Variant | Purpose | Retryable? | Affected Subsystems |
|---------|---------|------------|---------------------|
| `SentinelError::Database` | SQLite/WAL transaction failures | Yes (if locking), No (if constraint) | ObservationStore, ReportEngine |
| `SentinelError::Io` | File system access failures | No | ProxyEngine, PluginRuntime |
| `SentinelError::Tantivy` | FTS indexing or search syntax errors | No | ObservationStore |
| `SentinelError::ScopeViolation` | Network request blocked by ACL | No | ProxyEngine, BrowserService, SubfinderAdapter |
| `SentinelError::BusOverflow` | mpsc queue full | Yes (backoff) | EventBus, ScanOrchestrator |
| `SentinelError::ParseError` | Malformed HTTP or API responses | No | HTTPParser, OpenApiParser |
| `SentinelError::AiEngine` | LLM API timeout or Policy block | Yes (timeout) | AiEngine |
| `SentinelError::SandboxViolation`| WASM attempted illegal capability | No | PluginRuntime |
| `SentinelError::InvariantViolation`| Internal architectural logic error | No (Crash) | All (triggers panic wrapper) |

## 2. Error Propagation Policy

1. **Never Swallow Errors**: Errors must be propagated up to the orchestrator or logged via `tracing::error!`.
2. **Crash Safely**: If an `InvariantViolation` occurs, the thread MUST panic safely. The SQLite WAL and EventBus checkpointing guarantee data is not lost on restart.
3. **Graceful Degradation**: If `SentinelError::AiEngine` occurs, the `AiEngine` degrades to a fallback state. It does NOT halt the `ScanOrchestrator`.

Zero non-canonical error models may traverse the `pub trait` boundaries defined in `V6_COMMON_TYPES.rs`.
