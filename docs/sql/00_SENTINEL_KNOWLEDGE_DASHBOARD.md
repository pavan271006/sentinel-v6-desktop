---
title: Sentinel V7 — Master Security & Architecture Dashboard
tags:
  - moc
  - architecture
  - security
  - sql-injection
  - graybox
updated: 2026-09-13
---

# 🛡️ Sentinel V7 Knowledge & Architecture Hub

Welcome to the **Sentinel V7 Obsidian Knowledge Hub**. This repository unifies authoritative security audits, causal proof models, dialect grammar dictionaries, and gray-box instrumentation docs.

---

## 🗺️ Visual Architecture Canvases
- 🎨 [[Sentinel_Architecture.canvas|Sentinel Complete Architecture Canvas]] — Interactive visual DAG of the 8-stage pipeline, gray-box boundaries, and data flows.

---

## 🏛️ Core Platform Architecture & Execution
- [[SQL_SCANNER_ARCHITECTURE|SQL Scanner Architecture]]: End-to-end scanner component inventory, 8-stage pipeline, and orchestration logic.
- [[SCANNER_CALL_GRAPH|Scanner Execution Call Graph]]: Step-by-step runtime tracing from UI trigger to network repeater.
- [[REAL_WORLD_SQL_DEFENSES|17-Layer SQL Defense Model]]: Architectural breakdown from L1 Edge WAF down to L17 OS isolation.
- [[BURP_ALTERNATIVE|Sentinel vs Burp Suite / sqlmap]]: Differentiator and competitive positioning analysis.

---

## 📚 Master Attack Universe & Audits
- [[SENTINEL_MASTER_SQL_ATTACK_UNIVERSE|Sentinel Master SQL Attack Universe]]: Complete encyclopedia of SQL injection attacks, 14+ dialects, 16 mechanisms, 36 classes, and bypass vectors.
- [[SENTINEL_V7_EXHAUSTIVE_AUDIT_REPORT|Sentinel V7 Exhaustive Audit Report]]: Active implementation status, test matrix (215/215 passing), and verified real-world DAST coverage (89.5%).
- [[SENTINEL_V6_SQL_INDEPENDENT_AUDIT_REPORT|Sentinel V6 Independent Audit Report]]: Foundational independent security audit baseline.

---

## 🔬 Gray-Box & Hybrid Subsystems
- **IAST Runtime Sensor:** In-process database driver AST taint inspection for zero-egress environments.
- **Headless DOM Bridge:** Pre-encryption DOM injection neutralizing client-side WebCrypto / HMAC signing.
- **Macro State Replay:** HAR ingestion, session propagation, and automated 2FA/OTP handling.
- **WAF Bypass Orchestrator:** Test clearance cookies (`cf_clearance`) and authorized staging tokens.

---

## 🛠️ Developer & Environment Tooling
- **Tauri Desktop Shell:** `src-tauri` (Rust IPC bridge, window management, local system integration).
- **Core Rust Crates:** `sentinel_core/` (30+ crates) & `ucma-x/` (20+ crates).
- **Frontend Workspace:** React 18 + Vite + Tailwind + Zustand (`src/workspaces/`).
- **Telemetry Storage:** SQLite WAL database (`sentinel_storage.db`).

---
> [!TIP]
> Press **Ctrl + G** in Obsidian to open the **Graph View** and explore the relationships between architectural components, database dialects, and evasion techniques.
