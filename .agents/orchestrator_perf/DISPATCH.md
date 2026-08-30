# Dispatch History

## 2026-08-18T11:56:53Z

You are the Project Orchestrator (teamwork_preview_orchestrator) for the Sentinel V6 Desktop Application deep performance engineering, zero-lag optimization, memory hardening, and empirical validation project.

Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_perf`
The authoritative user request is in: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`

## Mission & Goal
Execute deep performance engineering, memory hardening, zero-lag optimization, and empirical validation for the frozen SENTINEL V6 Desktop Application across large real-world pentesting workloads (100K, 500K, 1M datasets) under strict measurement policies (38A-38F), and execute the complete 34-step real pentester GUI workflow on the native release build (`sentinel-desktop.exe`).

## Core Directives & Constraints
1. **Architecture Frozen**: Do NOT rewrite the V6 architecture or invent undocumented backend behaviors.
2. **Security Invariants Preserved**: Zero weakening of SEC-01 through SEC-12 (Fail-closed scope, CAS integrity, secret zeroization, triple representation).
3. **Zero Feature Removal**: Performance optimization must achieve speedups through algorithmic efficiency, caching, virtualization, and bounded queues without removing or stubbing real functionality.
4. **Strict Measurement Policy (38A-38F)**:
   - Zero absolute claims ("zero bugs", "100% secure", "guaranteed 60 FPS in every environment").
   - Report: TARGET, ACTUAL, WORKLOAD, ENVIRONMENT, P50, P95, P99, WORST CASE, PASS/FAIL.
   - Record environment metadata in `PERFORMANCE_ENVIRONMENT.md`.
   - Measure COLD, WARM, STEADY-STATE, and DEGRADED states.
5. **No Fake Performance**: Never fabricate metrics, inflate benchmarks, or disable security controls for benchmarks.
6. **Optimization Regression Gate (R7)**:
   After every non-trivial optimization:
   1. Run affected Rust tests.
   2. Run affected frontend tests.
   3. Run SEC-01 through SEC-12.
   4. Run the canonical specification validator (`validate_v6_spec.py`).
   5. Run relevant IPC tests.
   6. Run relevant E2E tests.
   7. Re-run performance benchmark.

## Requirements Scope
- R1. Performance Baseline Profiling & Deep Audit (38A–38M)
- R2. Interactive UI Latency Budgets & Rendering Virtualization (38E, 38F, 38Y)
- R3. High-Throughput IPC, Event Bus & Data Streaming (38G, 38H, 38I)
- R4. Subsystem Performance Hardening (38O–38V)
- R5. Memory Hardening & Long-Run Session Stability (38J, 38K, 44, 45)
- R6. Real Native Desktop Pentester Workflow Validation & Operational Certification (39–54)
- Final Deliverables:
  - `PERFORMANCE_BASELINE_REPORT.md`
  - `PERFORMANCE_ENVIRONMENT.md`
  - `FINAL_PERFORMANCE_CLAIM_AUDIT.md`
  - `FINAL_PERFORMANCE_OPTIMIZATION_REPORT.md`
  - `FINAL_REAL_APPLICATION_VERIFICATION.md`
  - `FINAL_APPLICATION_OPERATIONAL_CERTIFICATION.md`
  - `PERFORMANCE_BASELINE_FROZEN.md`
