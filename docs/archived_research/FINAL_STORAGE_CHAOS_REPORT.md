# SENTINEL V6 — FINAL STORAGE CHAOS & INTEGRITY REPORT

**Subsystems Evaluated**: `sentinel_storage` (SUB-02)  
**Database**: SQLite with Write-Ahead Logging (WAL)  
**Blob Store**: Content-Addressed Storage (SHA-256 CAS)  
**Status**: 🟢 **ALL STORAGE INVARIANTS & CHAOS RECOVERIES VERIFIED**  
**Verification Date**: 2026-08-17  

---

## 1. Mandatory SQLite Pragmas & Schema Integrity

All database connections enforce the 6 mandatory SQLite pragmas defined in the canonical specification:

| Mandatory Pragma | Configured Value | Verification Assertion | Status |
|:---|:---:|:---|:---:|
| `PRAGMA journal_mode` | `WAL` | High-concurrency reader/writer isolation | 🟢 **PASS** |
| `PRAGMA synchronous` | `NORMAL` | Optimized write throughput without corruption | 🟢 **PASS** |
| `PRAGMA foreign_keys` | `ON` | Foreign key constraint violation rejection | 🟢 **PASS** |
| `PRAGMA busy_timeout` | `5000` | 5000ms lock acquisition retry window | 🟢 **PASS** |
| `PRAGMA cache_size` | `-64000` | 64MB page cache allocation | 🟢 **PASS** |
| `PRAGMA temp_store` | `MEMORY` | Ephemeral tables kept in RAM | 🟢 **PASS** |

### Relational Schema & Migration Verification
- **Total Tables**: 32 relational tables (`projects`, `transactions`, `observations`, `findings`, `evidence`, `audit_events`, `candidates`, `knowledge_nodes`, etc.).
- **Migration Idempotency**: Verified repeated execution of `MigrationManager::run_migrations()` produces zero errors or duplicate indexes (`test_migration_idempotency_on_repeated_runs`).
- **Foreign Key Cascade**: Enforced; inserting orphan records without valid parent project/finding fails with `SqliteError(FOREIGN KEY constraint failed)`.

---

## 2. Content-Addressed Storage (CAS) & SEC-07 Verification

- **Atomic Writes**: Implemented via ephemeral `.tmp_{hash}_{uuid}.blob` files and atomic filesystem rename (`fs::rename`) within the same volume.
- **Directory Fan-Out**: Stored as `<project_root>/blobs/{sha256[0:2]}/{sha256}.blob` to prevent directory lookup degradation with >100,000 files.
- **Deduplication**: Identical payload bytes skip re-writing and return existing blob descriptor.
- **Tampering Detection**: Intentionally flipping 1 bit in a stored blob on disk causes `BlobStorage::get_verified()` to immediately reject the read and return `SentinelError::InvariantViolation("Blob SHA-256 hash mismatch (SEC-07)...")`.

---

## 3. Crash Recovery & Resilience Testing

- **WAL Abrupt Rollback**: Transactions containing partial observation batches aborted mid-execution (`ROLLBACK`) leave the database in a completely clean, uncorrupted state.
- **Process Crash Simulation**: Simulating immediate teardown while active WAL files (`.db-wal`, `.db-shm`) are open, followed by database re-opening, successfully replays pending WAL commits without loss or index corruption.
- **Physical Project Isolation (SEC-08)**: Tested directory traversal payloads (`../../outside_project`) and cross-project queries. Verified strict physical containment within each project's directory hierarchy.
