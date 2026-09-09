---
title: Sentinel V6 — Master Security & Architecture Dashboard
tags:
  - moc
  - architecture
  - security
  - sql-injection
  - graybox
updated: 2026-09-07
---

# 🛡️ Sentinel V6 Knowledge & Architecture Hub

Welcome to the **Sentinel V6 Obsidian Knowledge Graph**. This vault unites research specifications, causal proof models, dialect grammar dictionaries, and gray-box instrumentation docs.

---

## 🗺️ Visual Architecture Canvases
- 🎨 [[Sentinel_Architecture.canvas|Sentinel V6 Complete Architecture Canvas]] — Interactive visual DAG of the 8-stage pipeline, gray-box boundaries, and data flows.

---

## 🏛️ Core Platform Architecture
- [[SQL_SCANNER_ARCHITECTURE|SQL Scanner Architecture]]: End-to-end scanner component inventory and orchestration logic.
- [[ORACLE_MODEL|Multi-Oracle Model]]: 5-channel differential detection specifications (Error, Boolean, UNION, SPRT Timing, OAST).
- [[CAUSAL_VERIFICATION|Causal Counterfactual Verification]]: 5-step Judea Pearl $do$-calculus verification protocol.
- [[REAL_WORLD_SQL_DEFENSES|17-Layer SQL Defense Model]]: Architectural breakdown from L1 Edge WAF down to L17 OS isolation.
- [[SCANNER_CALL_GRAPH|Scanner Execution Call Graph]]: Runtime tracing through worker pools and sequential timing lanes.

---

## 🔬 Gray-Box & Hybrid Subsystems
- **IAST Runtime Sensor:** In-process database driver AST taint inspection for zero-egress environments.
- **Headless DOM Bridge:** Pre-encryption DOM injection neutralizing client-side WebCrypto / HMAC signing.
- **Macro State Replay:** HAR ingestion, session propagation, and automated 2FA/OTP handling.
- **WAF Bypass Orchestrator:** Test clearance cookies (`cf_clearance`) and authorized staging tokens.

---

## 📚 Database Grammar & Attack Taxonomy
- [[MASTER_SQL_SECURITY_TAXONOMY|Master SQL Security Taxonomy]]: CWE-89 classifications, contexts, and injection vectors.
- [[SQLI_COMPLETE_TAXONOMY|Complete Injection Matrix]]: Numeric, string, LIKE, and clause-level breakouts.
- [[TECHNIQUE_CATALOG|Technique Catalog]]: Payload catalog categorized by dialect and evasion tier.

---

## 🧪 Benchmark Results & Empirical Audits
- [[AUTONOMOUS_SCAN_VALIDATION|Autonomous Scan Validation]]: Pipeline benchmarks across diverse targets.
- [[CAUSAL_RUNTIME_VALIDATION|Causal Runtime Validation]]: False-positive rejection tests under network jitter.
- [[SCANNER_COMPARISON_MATRIX|Scanner Comparison Matrix]]: Sentinel V6 vs Legacy Tools (sqlmap, Commix, Burp).

---

## 🛠️ Developer & Environment Tooling
- **Tauri Desktop Shell:** `src-tauri` (Rust IPC bridge, window management, local system integration).
- **Core Rust Crates:** `sentinel_core/` (30+ crates) & `ucma-x/` (20+ crates).
- **Frontend Workspace:** React 18 + Vite + Tailwind + Zustand (`src/workspaces/`).
- **Telemetry Storage:** SQLite WAL database (`sentinel_storage.db`).

---
> [!TIP]
> Press **Ctrl + G** in Obsidian to open the **Graph View** and explore the relationships between architectural components, database dialects, and evasion techniques.
