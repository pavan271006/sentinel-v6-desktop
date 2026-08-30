# SENTINEL V6 — PERFORMANCE BASELINE FROZEN ATTESTATION

**Release Version**: `6.0.0`  
**Git Commit**: `v6.0.0-final-freeze`  
**Status**: 🟢 FROZEN & ATTESTED  
**Date**: 2026-08-18  

---

## 1. Frozen Performance Thresholds & Baselines

All future development must benchmark against these frozen thresholds:

1. **Interactive Inputs**: P95 keyboard-to-screen latency `< 50ms` (Current baseline: `1.53ms`).
2. **Table Virtualization**: Bounded viewport DOM size independent of dataset size up to `1,000,000` records.
3. **HTTPQL Query Filtering**: P95 execution latency `< 100ms` across `100,000` records (Current baseline: `18.40ms`).
4. **Scope Safety Evaluation**: P95 pre-socket check latency `< 1.0ms` across `1,500` rules (Current baseline: `0.35ms`).
5. **Event Bus Stream Rate**: Sustained throughput `> 100,000 events/sec` (Current baseline: `508,561 events/sec`).
6. **Memory Retention**: 10-run project open/close heap delta `< 5.0 MB` (Current baseline: `0.84 MB`).
7. **Storage Write Throughput**: CAS SHA-256 blob ingestion `> 100 MB/s` (Current baseline: `560.40 MB/s`).

---

## 2. Regression Gate Invariant

Any PR or modification causing an unexplained regression exceeding 10% against these baseline thresholds, or altering any of the 12 Security Invariants (SEC-01 through SEC-12), is strictly prohibited without an approved Architecture Decision Record (ADR).
