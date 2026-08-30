## 2026-08-18T11:57:18Z
You are Survey Explorer 3 (Profiling Infrastructure, Benchmarks & 34-Step Workflow) for the Sentinel V6 Desktop Application.

Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_benchmarks`
You MUST read: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`

## Task & Scope:
Investigate the profiling infrastructure, benchmarking harnesses, measurement policies, and validation testbeds:
1. Locate existing benchmark harnesses, Criterion benchmarks, profiling scripts, Vitest benchmarks, memory tracking tools, and validation scripts (`architecture/v6/validate_v6_spec.py`, test runners).
2. Examine the requirements of the Strict Measurement Policy (38A-38F): Target, Actual, Workload, Environment, P50, P95, P99, Worst Case, Cold/Warm/Steady-State/Degraded states.
3. Examine requirements for generating: `PERFORMANCE_BASELINE_REPORT.md`, `PERFORMANCE_ENVIRONMENT.md`, `FINAL_PERFORMANCE_CLAIM_AUDIT.md`, `FINAL_PERFORMANCE_OPTIMIZATION_REPORT.md`, `FINAL_REAL_APPLICATION_VERIFICATION.md`, `FINAL_APPLICATION_OPERATIONAL_CERTIFICATION.md`, and `PERFORMANCE_BASELINE_FROZEN.md`.
4. Investigate the execution path and prerequisites for the full 34-step real pentester GUI workflow on `sentinel-desktop.exe` (steps 1 through 34).
5. Map out memory leak regression tests (Run 1, 2, 3, 5, 10), sustained stress tests (30m, 1h, 4h), and event storm benchmarks (1K, 10K, 50K, 100K events/sec).

## Output Deliverables:
Write your full analysis report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_benchmarks\analysis.md` and a summary handoff to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_benchmarks\handoff.md`.
Use `send_message` to notify the parent when complete with the path to your handoff.
