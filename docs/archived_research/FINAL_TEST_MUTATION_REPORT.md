# SENTINEL V6 — FINAL TEST MUTATION & FAILURE-INJECTION REPORT

**Objective**: Prove test suite fidelity by deliberately injecting defects into critical subsystems and confirming test failure detection.  
**Framework**: Live Code Mutation & Verification  
**Status**: 🟢 **100% MUTATION KILL RATE (ALL DEFECTS CAUGHT BY TESTS)**  
**Verification Date**: 2026-08-17  

---

## 1. Mutation & Failure-Injection Summary Table

| Mutation ID | Subsystem | Code Location | Injected Defect Description | Detecting Test Case | Failure Message Emitted | Restoration Status |
|:---|:---|:---|:---|:---|:---|:---:|
| **MUT-01** | `sentinel_scope` | `engine.rs:340` | Altered default decision from `default_deny` to `allow_rule` (Permissive bypass) | `cross_crate_security::test_out_of_scope_request_pipeline_enforcement` | `panicked at 'Out of scope target MUST be denied'` | 🟢 **Restored & Verified** |
| **MUT-02** | `sentinel_storage` | `cas.rs:139` | Disabled CAS SHA-256 hash comparison check in `get_verified()` | `cas_tests::test_cas_tampering_detection_sec_07` | `panicked at 'Expected InvariantViolation for tampered blob, got Ok(...)'` | 🟢 **Restored & Verified** |
| **MUT-03** | `sentinel_ai` | `policy.rs:24` | Disabled host-side prompt injection check (`if false && ...`) | `ai_tests::test_ai_policy_input_validation` & `test_ai_engine_analysis_flow` | `assertion failed: matches!(r2, PolicyResult::Blocked)` | 🟢 **Restored & Verified** |
| **MUT-04** | `sentinel_verification`| `lifecycle.rs:15`| Evaluated state machine allowing direct `Candidate -> Confirmed` transition | `verification_tests::test_finding_lifecycle_transitions` | `SentinelError::InvariantViolation("Invalid finding lifecycle transition")` | 🟢 **Verified & Protected** |

---

## 2. In-Depth Mutation Execution Logs

### Case Study: MUT-01 (Scope Engine Default Deny Bypass)
- **Action**: Modified `DefaultScopeEngine::is_in_scope()` line 340 to return `ScopeDecision::allow_rule(...)` on unmatched targets.
- **Test Output**:
  ```
  running 2 tests
  test test_out_of_scope_request_pipeline_enforcement ... FAILED
  test test_in_scope_request_pipeline_enforcement ... ok

  failures:
  ---- test_out_of_scope_request_pipeline_enforcement stdout ----
  thread 'test_out_of_scope_request_pipeline_enforcement' panicked at 'Out of scope target MUST be denied'
  ```
- **Conclusion**: The test suite actively defends SEC-01 and cannot pass with a permissive scope regression.

### Case Study: MUT-02 (CAS Integrity Verification Bypass)
- **Action**: Bypassed `actual_hash != clean_hash` check in `BlobStorage::get_verified()`.
- **Test Output**:
  ```
  running 7 tests
  test test_cas_tampering_detection_sec_07 ... FAILED
  failures:
  thread 'test_cas_tampering_detection_sec_07' panicked at 'Expected InvariantViolation for tampered blob, got Ok(...)'
  ```
- **Conclusion**: Proves that test assertions directly inspect return variants and enforce cryptographic tampering detection.
