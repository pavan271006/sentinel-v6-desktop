## 2026-08-23T04:38:03Z

You are worker_phase1_goldenpath (teamwork_preview_worker).
Your working directory is: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_phase1_goldenpath\

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md (specifically the latest request at 2026-08-22T19:52:12Z and the resume directive at 2026-08-23T04:33:25Z).
Also read `PROJECT.md` at:
c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md
and the Explorer reports for Phase 1:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_phase1_testbed\handoff.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_phase1_goldenpath\handoff.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_phase1_e2e_harness\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
Execute Phase 1 (Milestone 3): Isolated Multi-Target Testbed & End-to-End Vertical Slice (Golden Path):
1. **Merkle Proof Chain in `sentinel_storage`**:
   Implement native Rust `MerkleProofTree` / `MerkleProofChain` in `sentinel_storage::cas` (or `sentinel_storage::merkle`), porting the validated algorithm from `research/theory_lab/causal_evidence_engine/causal_engine.py`. Computes canonical Merkle root hash across CAS payload digests and provides tamper verification.
2. **Tauri IPC & Live Stream Wiring**:
   Update `src-tauri/src/commands.rs` to connect `cmd_traffic_get_page`, `cmd_traffic_get_details`, `cmd_repeater_send_request`, and `cmd_httpql_validate` to live backend engines (`ProjectStorage`, `SentinelProxyEngine`, `RepeaterExecutor`, `sentinel_httpql`) rather than synthetic mock stubs. Ensure `src-tauri/src/main.rs` supports background event emission from `SentinelEventBus`.
3. **Golden Path End-to-End Test Harness**:
   Create and execute the comprehensive integration test harness `sentinel_core/tests/tests/golden_path_e2e_harness.rs` proving the unbroken 9-stage dataflow:
   - Stage 1: Request Emitted (Wire bytes to loopback proxy)
   - Stage 2: Proxy Intercepts (`sentinel_proxy` Plain/TLS MITM)
   - Stage 3: Scope Allows (SEC-01 fail-closed pre-socket evaluation & default deny on out-of-scope)
   - Stage 4: SQLite Stores Row (`transactions`, `observations`)
   - Stage 5: CAS Stores Raw Payload (SEC-07 SHA-256 CAS blob storage & tamper detection)
   - Stage 6: Event Emitted (SEC-12 Tokio broadcast event delivery)
   - Stage 7: HTTPQL Filters Match (`sentinel_httpql` in-memory & SQL compilation)
   - Stage 8: Repeater Modifies & Replays (`sentinel_repeater` socket replay & Myers line diff)
   - Stage 9: Deterministic Oracle Verification & CAS Merkle Proof Chain (`sentinel_verification` SEC-06 oracle + `MerkleProofTree`)
4. **Tri-Target Confusion Matrix Verification**:
   Execute the test harness against the isolated testbed (Vulnerable on port 8888 / local mock, Fixed on port 8889, Benign Control) and verify:
   - Vulnerable Target: TP = 1, FN = 0 (100% Detection & Verification)
   - Fixed Target: TN = 1, FP = 0 (Zero False Positives)
   - Benign Target: TN = 1, FP = 0 (Zero False Positives)
5. **Continuous Regression Check**:
   Run `cargo test --workspace --locked`, `cargo check --manifest-path src-tauri/Cargo.toml`, `npm test`, and `python architecture/v6/validate_v6_spec.py`.
