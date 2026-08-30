# SENTINEL V6 — FINAL TEST ARCHITECTURE

> **DATE**: 2026-08-17
> **STATUS**: AUTHORITATIVE

## 1. Unit Testing
* **Requirement**: All pure functions and parsers MUST have 100% branch coverage.
* **Focus**: `HTTPParser`, `FuzzerEngine` mutators, `ScopeEngine` ACL logic.

## 2. Property-Based & Fuzzing (proptest / libfuzzer)
* **Requirement**: Critical parsers and state machines MUST be differential-fuzzed against standard implementations.
* **Focus**: `HTTPParser` against `hyper` and `httparse` to detect desync/smuggling differentials.

## 3. Integration Testing
* **Requirement**: All database queries must run against an in-memory SQLite WAL instance using `sqlx::test`.
* **Focus**: `ObservationStore`, `KnowledgeEngine`.

## 4. End-to-End (E2E) Acceptance Testing
* **Requirement**: The `ScanOrchestrator` MUST be able to execute a complete attack chain against a local vulnerable Docker container (e.g., OWASP Juice Shop).
* **Metrics**: 0 False Positives on known paths, 100% detection of mapped vulnerabilities within resource bounds.
