# SENTINEL V6 — FINAL PERFORMANCE SPECIFICATION

> **DATE**: 2026-08-17 (Remediation Cycle 2)  
> **SCOPE**: Realistic and Measurable Targets

---

## 1. Core Throughput

| Target | Minimum Acceptable | Expected | Benchmark Method | Hardware Base |
|--------|--------------------|----------|------------------|---------------|
| **Proxy Pass-Through** | 2k req/sec | 5k req/sec | Locust load test against local Nginx via ProxyEngine | 8-core, 16GB RAM |
| **Proxy Burst (No DB)** | 5k req/sec | 10k req/sec | wrk load test, DB queue saturated | 8-core, 16GB RAM |
| **Fuzzer Mutations** | 5k mut/sec | 15k mut/sec | In-memory generation loop | 8-core |
| **Observation Writes** | 1k batched/sec | 5k batched/sec | Random payload inserts into SQLite WAL | NVMe SSD |

## 2. Latency & Responsiveness

| Target | Minimum Acceptable | Expected | Benchmark Method | Dataset Size |
|--------|--------------------|----------|------------------|--------------|
| **Scope Resolution** | 5ms | <1ms | Compiled regex execution time | N/A |
| **UI Traffic Load** | 500ms | <100ms | Tauri IPC fetching 100 records | 1M total records |
| **Full Text Search** | 1000ms | <200ms | Tantivy BM25 search for common word | 1M records (20GB) |
| **Graph Path (3-hop)** | 500ms | <100ms | SQLite recursive CTE | 1M nodes |

## 3. Resource Consumption

| Target | Minimum Acceptable | Expected | Conditions |
|--------|--------------------|----------|------------|
| **Core Memory (Idle)** | 200MB | <100MB | SQLite connection open, Tauri UI loaded |
| **Core Memory (Scan)** | 1GB | <500MB | 100 concurrent requests, DB writing |
| **Browser Context** | 300MB/ctx | <150MB/ctx | Playwright rendering simple SPA |
| **Storage Overhead** | 5x raw traffic | <3x raw traffic | Raw + Parsed + Normalized + FTS Index |

## 4. Verification & Precision

| Target | Minimum Acceptable | Expected | Dataset |
|--------|--------------------|----------|---------|
| **Tech Fingerprinting** | 80% accuracy | 90% accuracy | Top 50 web stacks |
| **False Positive Rate** | <5% | <1% | Automated verified findings vs OWASP Benchmark |
| **IRA+ Authz FP Rate** | <5% | <2% | Identity replay against known access matrix |

---

> **NOTE**: The previously claimed absolute targets ("0 false positives", "99% block rate") have been permanently removed from the architecture. Absolute perfection is impossible in heuristic security testing; measurable statistics are the only valid engineering standard.
