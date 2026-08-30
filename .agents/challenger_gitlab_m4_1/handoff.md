# Adversarial Challenge & Stress-Test Handoff Report: Clean-Room Verifier & Negative Controls

- **Author**: `challenger_gitlab_m4_1` (Empirical Challenger: critic, specialist)
- **Target Modules**:
  - `gitlab_research_lab/verifier/clean_room_verifier.py`
  - `gitlab_research_lab/verifier/negative_controls.py`
  - `gitlab_research_lab/verifier/cas_evidence_vault.py`
- **Specification References**:
  - `gitlab_research_lab/PROJECT.md`
  - `gitlab_research_lab/docs/GITLAB_HYPOTHESIS_CATALOG.md`
- **Verdict**: `REQUEST_CHANGES` (Hardening patches required for 3 empirical defect conditions)

---

## 1. Observation

Direct empirical observations obtained via dedicated stress-test executions against the clean-room verification engine:

### 1.1 Test Suite Execution
- **Command**: `python c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/challenger_gitlab_m4_1/test_adversarial_clean_room.py`
- **Output**:
  ```text
  Ran 29 tests in 0.020s
  OK
  ADVERSARIAL STRESS TEST SUMMARY: {'tests_run': 29, 'failures': 0, 'errors': 0, 'skipped': 0, 'elapsed_seconds': 0.0198, 'passed': True}
  ```
- **Master Test Runner Command**: `python c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab/tests/run_all_research_tests.py`
- **Output**: `75/75 tests passed (100% pass rate across M1-M5) in 0.005 seconds`.

---

### 1.2 Defect 1: Unhandled `TypeError` on Nested Binary Payloads in CAS Vault
- **File**: `gitlab_research_lab/verifier/cas_evidence_vault.py:43-52`
- **Code**:
  ```python
  def _normalize_payload(self, data: Any) -> Any:
      """Ensure payload is cleanly JSON-serializable."""
      if isinstance(data, (dict, list, int, float, bool)) or data is None:
          return data
      if isinstance(data, bytes):
          try:
              return data.decode("utf-8")
          except UnicodeDecodeError:
              return data.hex()
      return str(data)
  ```
- **Observed Failure**: When `data` is a `dict` or `list` containing nested `bytes` (e.g. multipart bodies, binary headers, raw git packfiles `{"payload": b"\x89PNG\r\n..."}`), `_normalize_payload` returns the outer `dict` without recursing into elements.
- **Traceback**:
  ```text
  File "gitlab_research_lab/verifier/cas_evidence_vault.py", line 81, in record_evidence
      serialized = json.dumps(payload_obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
  TypeError: Object of type bytes is not JSON serializable
  ```

---

### 1.3 Defect 2: Unhandled `AttributeError` on `actor_matrix: None`
- **File**: `gitlab_research_lab/verifier/clean_room_verifier.py:43-44`
- **Code**:
  ```python
  actor_matrix = spec.get("actor_matrix", {})
  attacker_role = actor_matrix.get("attacker_role", "Guest")
  ```
- **Observed Failure**: When a candidate specification is loaded from YAML where `actor_matrix:` is declared as a null key (or `spec = {"actor_matrix": None}`), `spec.get("actor_matrix", {})` returns `None` (because the key exists with `None` value). Subsequently, `None.get("attacker_role")` crashes.
- **Command Output**:
  ```text
  AttributeError: 'NoneType' object has no attribute 'get'
  ```

---

### 1.4 Defect 3: Role Casing Sensitivity Inverts Negative Control Evaluation
- **File**: `gitlab_research_lab/verifier/negative_controls.py:23-24`, `48-52`
- **Code**:
  ```python
  UNPRIVILEGED_ROLES = {"Guest", "Reporter", "External", "Anonymous"}
  AUTHORIZED_ADMIN_ROLES = {"Maintainer", "Owner", "Admin"}
  ...
  is_unprivileged = user_role in cls.UNPRIVILEGED_ROLES
  is_blocked = simulated_status in cls.EXPECTED_DENIAL_CODES
  passed = is_blocked if is_unprivileged else (simulated_status in cls.EXPECTED_SUCCESS_CODES)
  ```
- **Observed Failure**: When `user_role` is supplied in lowercase (e.g., `"guest"`, `"reporter"`), `is_unprivileged` evaluates to `False`. For an unprivileged access denial returning HTTP `403 Forbidden`, `passed` evaluates as `403 in {200, 201, 202, 204} -> False`.
- **Empirical Output**:
  ```python
  NegativeControlTester.assert_unprivileged_rejection('guest', 'action', 403)
  # Returns: {'is_unprivileged_role': False, 'properly_blocked': True, 'negative_control_passed': False}
  ```

---

### 1.5 Robust Invariants Verified
1. **Timing Jitter Invariance**: Evaluated across 10ms, 25ms, 50ms, 100ms, 200ms, 300ms, 400ms, 500ms jitter ranges. Deterministic denial/success behaviors held invariant (`deterministic_behavior: True`, `all_runs_succeeded: True`). Flaky/non-deterministic transitions were accurately flagged (`deterministic_behavior: False`).
2. **Cryptographic CAS Determinism & Tamper Detection**:
   - Byte-for-byte identical SHA-256 digests produced for identical payloads across separate vault instances.
   - Single-bit mutations immediately invalidate `verify_evidence(digest)` and prevent receipt export.
3. **Formal Flaw Hypotheses (H1 to H5)**:
   - Full 5-phase clean-room pipelines executed for H-01 (GraphQL Asymmetry), H-02 (CI_JOB_TOKEN), H-03 (ProjectGroupLink), H-04 (TOCTOU Archival Race), and H-05 (Webhook SSRF). All passed phases A through E with valid CAS digests.
4. **Falsification Gate Truth Table**:
   - Exhaustive 4-cell truth table for `evaluate_candidate_falsification_gate` verified:
     - `(True, True)` -> `VERIFIED_POSITIVE`
     - `(True, False)` -> `REJECTED_FALSE_POSITIVE`
     - `(False, True)` -> `UNCONFIRMED`
     - `(False, False)` -> `REJECTED_FALSE_POSITIVE`

---

## 2. Logic Chain

1. **Premise 1**: Clean-room verifiers and evidence vaults in a production-grade research lab must accept arbitrary candidate inputs (including raw HTTP bytes, complex JSON/YAML fixtures, and varying casing) without crashing or inverting security decisions.
2. **Premise 2 (from Observation 1.2)**: `_normalize_payload` in `CASEvidenceVault` does not recurse into dictionary values or list items. When a request or response payload contains binary bytes within a dictionary, serialization throws an unhandled `TypeError`.
3. **Premise 3 (from Observation 1.3)**: `CleanRoomVerifier.run_baseline_negative_control` assumes `spec.get("actor_matrix", {})` is always a `dict`, but Python `dict.get(key, default)` returns `None` if `key` exists and maps to `None`. This causes an unhandled `AttributeError`.
4. **Premise 4 (from Observation 1.4)**: `NegativeControlTester` checks role membership against static capitalized string sets without normalizing casing (`user_role.capitalize()` or `.title()`), causing lowercase roles to be misclassified as authorized roles, resulting in false rejection of valid negative controls.
5. **Conclusion**: While the core mathematical model, dual-role architecture, and cryptographic invariants are sound and functional across all 75 master tests, the implementation requires defensive hardening patches to eliminate crashes and casing inversion on edge cases.

---

## 3. Caveats

- **Mocked / In-Memory Transport**: Tests were executed against in-memory clean room simulators and isolated Python processes as specified by the research lab topology; live TCP socket connections to a running GitLab container were not exercised in this test run.
- **204 Status Code Minor Parity**: `verify_candidate` checks `positive_reproduced` against `[200, 201, 202]` while `NegativeControlTester.EXPECTED_SUCCESS_CODES` includes `204`. This is minor but recommended to be unified.

---

## 4. Conclusion & Recommended Action

**VERDICT**: `REQUEST_CHANGES`

The verification engine and negative controls are architecturally sound and successfully demonstrate all 5 core research hypothesis lifecycles. To achieve full production hardening, the following 3 minimal patches should be applied:

### Patch 1: Recursive Payload Normalization in `cas_evidence_vault.py`
```diff
--- a/gitlab_research_lab/verifier/cas_evidence_vault.py
+++ b/gitlab_research_lab/verifier/cas_evidence_vault.py
@@ -44,6 +44,10 @@ class CASEvidenceVault:
     def _normalize_payload(self, data: Any) -> Any:
         """Ensure payload is cleanly JSON-serializable."""
+        if isinstance(data, dict):
+            return {str(k): self._normalize_payload(v) for k, v in data.items()}
+        if isinstance(data, (list, tuple, set)):
+            return [self._normalize_payload(item) for item in data]
         if isinstance(data, (int, float, bool)) or data is None:
             return data
         if isinstance(data, bytes):
```

### Patch 2: Safe Dict Resolution in `clean_room_verifier.py`
```diff
--- a/gitlab_research_lab/verifier/clean_room_verifier.py
+++ b/gitlab_research_lab/verifier/clean_room_verifier.py
@@ -43,3 +43,3 @@ class CleanRoomVerifier:
-        actor_matrix = spec.get("actor_matrix", {})
+        actor_matrix = spec.get("actor_matrix") or {}
         attacker_role = actor_matrix.get("attacker_role", "Guest")
```

### Patch 3: Casing Normalization in `negative_controls.py`
```diff
--- a/gitlab_research_lab/verifier/negative_controls.py
+++ b/gitlab_research_lab/verifier/negative_controls.py
@@ -48,3 +48,4 @@ class NegativeControlTester:
-        is_unprivileged = user_role in cls.UNPRIVILEGED_ROLES
+        normalized_role = str(user_role).strip().title()
+        is_unprivileged = normalized_role in cls.UNPRIVILEGED_ROLES
         is_blocked = simulated_status in cls.EXPECTED_DENIAL_CODES
```

---

## 5. Verification Method

To independently verify these findings:

1. **Run Full Adversarial Test Harness**:
   ```bash
   python "c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/challenger_gitlab_m4_1/test_adversarial_clean_room.py"
   ```
   *Expected Result*: 29/29 tests pass (confirming all invariants and defect reproductions).

2. **Run Master Lab Test Suite**:
   ```bash
   python "c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab/tests/run_all_research_tests.py"
   ```
   *Expected Result*: 75/75 tests pass across M1-M5.

3. **Inspect Defect Demonstrations**:
   - Review tests `test_adv_27`, `test_adv_28`, and `test_adv_29` in `.agents/challenger_gitlab_m4_1/test_adversarial_clean_room.py`.
