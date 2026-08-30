## 2026-08-17T13:40:38Z
<USER_REQUEST>
You are the Backend Capability Auditor for Phase UI-0 of the Sentinel V6 Desktop Application build.

Your working directory is: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui0_backend\
Authoritative Request: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md
Architecture & Spec Root: c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6
Core Codebase: c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core

TASKS:
1. Deeply inspect the Sentinel V6 core codebase in `sentinel_core` (all crates, modules, SQLite schema, proxy/traffic engine, repeater engine, scanner/mutation fuzzer, auth matrix engine, browser integration, OAST server, findings CAS storage, graph queries, export generators, diagnostics).
2. For EVERY single capability required by the Sentinel V6 UI across all 15 phases (UI-0 to UI-14), evaluate the current backend implementation status:
   - `BACKEND_IMPLEMENTED`: Fully working backend logic/API ready for UI hookup.
   - `BACKEND_PARTIAL`: Partially working or needs minor IPC adapter/glue.
   - `BACKEND_EXPERIMENTAL`: Implemented behind flags or prototype.
   - `BACKEND_DEFERRED`: Planned/designed in spec but not implemented in core.
   - `BACKEND_UNAVAILABLE`: Not present in backend; UI must show disabled with explicit explanation per Backend Truth Rule.
3. Verify `cargo test --workspace` or relevant crate tests to verify which backend components are actively working and tested.
4. Generate the definitive `UI_BACKEND_CAPABILITY_MATRIX.md` at project root (`c:\Users\Legion 5 pro\Desktop\cyber sec\UI_BACKEND_CAPABILITY_MATRIX.md`).
5. Write your detailed audit report and handoff to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui0_backend\handoff.md` and send a completion message to the parent orchestrator.
</USER_REQUEST>
