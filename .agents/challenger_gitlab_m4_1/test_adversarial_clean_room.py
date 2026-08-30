"""
Adversarial Stress Test Suite: Clean-Room Verifier Engine & Negative Controls
=============================================================================
Author: challenger_gitlab_m4_1 (Empirical Challenger)
Subsystems Under Test:
  - gitlab_research_lab/verifier/clean_room_verifier.py
  - gitlab_research_lab/verifier/negative_controls.py
  - gitlab_research_lab/verifier/cas_evidence_vault.py

Test Dimensions Covered:
1. Invalid candidate specs & Schema Boundaries
2. Unprivileged Access Denials & Boundary Status Codes
3. Patched State Verification & Benign Workflow Preservation
4. Timing Jitter Invariance (10ms - 500ms) & Non-Determinism Detection
5. Falsification Conditions & Multi-Scenario Candidate Verification
6. Cryptographic CAS Vault Tamper-Resistance & Determinism
7. Concrete Hypotheses (H1 through H5) Full Pipeline Execution
8. Defect Demonstrations (Nested Byte TypeError, Null Matrix AttributeError)
"""

import hashlib
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure gitlab_research_lab is importable
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
LAB_ROOT = WORKSPACE_ROOT / "gitlab_research_lab"
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))
if str(LAB_ROOT) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT))

from gitlab_research_lab.verifier.clean_room_verifier import CleanRoomVerifier, CleanRoomVerifierSimulator
from gitlab_research_lab.verifier.negative_controls import NegativeControlTester
from gitlab_research_lab.verifier.cas_evidence_vault import CASEvidenceVault


class TestAdversarialCleanRoomVerifier(unittest.TestCase):
    """Deep adversarial test suite challenging the Clean-Room Verifier and Negative Controls."""

    def setUp(self):
        self.vault = CASEvidenceVault()
        self.verifier = CleanRoomVerifier(cas_vault=self.vault)
        self.controls = NegativeControlTester()

    # =========================================================================
    # SECTION 1: MALFORMED & INVALID CANDIDATE SPECIFICATIONS
    # =========================================================================

    def test_adv_01_empty_candidate_spec_handling(self):
        """[Spec Stress] Verifier must handle completely empty spec dictionary gracefully."""
        empty_spec = {}
        # Phase B check
        baseline_res = self.verifier.run_baseline_negative_control(empty_spec)
        self.assertTrue(baseline_res, "Empty spec defaults to Guest role and passes unprivileged denial")

        # Full pipeline on empty spec must fail Phase A (provisioning) and return REJECTED_FALSE_POSITIVE
        report = self.verifier.execute_full_clean_room_pipeline(empty_spec)
        self.assertFalse(report["phases"]["Phase_A_Provision"], "Empty spec must fail Phase A (no endpoint/interface)")
        self.assertEqual(report["final_verdict"], "REJECTED_FALSE_POSITIVE")

    def test_adv_02_spec_with_missing_mutation_or_context(self):
        """[Spec Stress] Verifier handling of missing mutation field."""
        spec_missing_mutation = {
            "id": "SPEC-MALFORMED-01",
            "target_interface": "REST",
            "endpoint": "/api/v4/test",
            "actor_matrix": {"attacker_role": "Guest"},
            # abstract_mutation missing
        }
        reproduced, digest = self.verifier.run_positive_reproduction(spec_missing_mutation, "VULNERABLE")
        self.assertTrue(reproduced)
        self.assertEqual(len(digest), 64)
        self.assertTrue(self.vault.verify_evidence(digest))

    def test_adv_03_unregistered_and_hostile_attacker_roles(self):
        """[Spec Stress] Verifier handling of non-standard, custom, or privileged attacker roles."""
        hostile_roles = ["root", "Admin", "Owner", "CustomRole", "Anonymous", "External", ""]
        for role in hostile_roles:
            spec = {
                "id": f"SPEC-ROLE-{role}",
                "target_interface": "REST",
                "endpoint": "/api/v4/projects",
                "actor_matrix": {"attacker_role": role},
                "abstract_mutation": {"param": "value"},
            }
            res = self.verifier.run_baseline_negative_control(spec)
            # If role is in UNPRIVILEGED_ROLES, baseline evaluates role; otherwise falls back to Guest
            self.assertTrue(res, f"Role '{role}' should be cleanly handled in baseline control")

    def test_adv_04_complex_unicode_and_large_payload_normalization(self):
        """[Spec Stress] CAS Vault normalization under deeply nested, unicode, and large payloads."""
        complex_request = {
            "unicode_test": "GitLab 🚀 漏洞验证 \u0000\u001f",
            "nested": {"level_1": {"level_2": [1, 2, 3, None, True, False]}},
            "stringified_bytes": "deadbeef000102",
        }
        complex_response = {
            "status": 200,
            "data": "A" * 10000,
        }
        digest = self.vault.record_evidence(complex_request, complex_response, {"tag": "deep_nesting"})
        self.assertEqual(len(digest), 64)
        self.assertTrue(self.vault.verify_evidence(digest))

        evidence = self.vault.get_evidence(digest)
        self.assertIsNotNone(evidence)
        self.assertEqual(evidence["request"]["unicode_test"], "GitLab 🚀 漏洞验证 \u0000\u001f")

    # =========================================================================
    # SECTION 2: UNPRIVILEGED ACCESS DENIALS & NON-DENIAL HANDLING
    # =========================================================================

    def test_adv_05_unprivileged_roles_exact_denial_codes(self):
        """[Negative Control] Assert all UNPRIVILEGED_ROLES pass on 401, 403, 404."""
        for role in NegativeControlTester.UNPRIVILEGED_ROLES:
            for code in [401, 403, 404]:
                res = NegativeControlTester.assert_unprivileged_rejection(
                    user_role=role,
                    action="confidential_export",
                    simulated_status=code,
                )
                self.assertTrue(res["properly_blocked"])
                self.assertTrue(res["negative_control_passed"], f"Role {role} on status {code} should pass negative control")

    def test_adv_06_unprivileged_roles_rejection_on_success_codes(self):
        """[Negative Control] Assert all UNPRIVILEGED_ROLES FAIL negative control if receiving 200/201/202/204."""
        for role in NegativeControlTester.UNPRIVILEGED_ROLES:
            for code in [200, 201, 202, 204]:
                res = NegativeControlTester.assert_unprivileged_rejection(
                    user_role=role,
                    action="confidential_export",
                    simulated_status=code,
                )
                self.assertFalse(res["properly_blocked"])
                self.assertFalse(res["negative_control_passed"], f"Unprivileged role {role} receiving {code} must fail negative control")

    def test_adv_07_unprivileged_roles_handling_of_server_errors_and_redirects(self):
        """[Negative Control] Unprivileged roles receiving 500, 502, 504, 302, 400 must fail negative control (not clean denial)."""
        ambiguous_codes = [301, 302, 400, 405, 429, 500, 502, 503, 504]
        for role in NegativeControlTester.UNPRIVILEGED_ROLES:
            for code in ambiguous_codes:
                res = NegativeControlTester.assert_unprivileged_rejection(
                    user_role=role,
                    action="protected_action",
                    simulated_status=code,
                )
                self.assertFalse(res["properly_blocked"], f"Status code {code} is not a valid clean denial")
                self.assertFalse(res["negative_control_passed"])

    def test_adv_08_authorized_roles_behavior_on_unprivileged_assertion(self):
        """[Negative Control] Authorized roles (Maintainer/Owner/Admin) tested on assert_unprivileged_rejection."""
        for role in ["Maintainer", "Owner", "Admin"]:
            # If an authorized user receives 200, passed is True
            res_200 = NegativeControlTester.assert_unprivileged_rejection(
                user_role=role,
                action="admin_action",
                simulated_status=200,
            )
            self.assertTrue(res_200["negative_control_passed"])
            self.assertFalse(res_200["is_unprivileged_role"])

            # If an authorized user receives 403, passed is False
            res_403 = NegativeControlTester.assert_unprivileged_rejection(
                user_role=role,
                action="admin_action",
                simulated_status=403,
            )
            self.assertFalse(res_403["negative_control_passed"])

    # =========================================================================
    # SECTION 3: PATCHED STATE VERIFICATION & WORKFLOW PRESERVATION
    # =========================================================================

    def test_adv_09_patched_state_mitigation_enforcement(self):
        """[Patch Validation] Exploit attempt on patched build must return 401/403/404 to be DEFENSE_EFFECTIVE."""
        for code in [401, 403, 404]:
            res = NegativeControlTester.assert_fixed_patch_behavior(
                patch_applied=True,
                exploit_attempt_status=code,
            )
            self.assertTrue(res["validation_passed"])
            self.assertEqual(res["behavior"], "DEFENSE_EFFECTIVE")

    def test_adv_10_patched_state_bypass_detection(self):
        """[Patch Validation] Exploit attempt returning 200 or 500 on patched build flags PATCH_BYPASS_DETECTED."""
        for code in [200, 201, 202, 500, 502, 302, 400]:
            res = NegativeControlTester.assert_fixed_patch_behavior(
                patch_applied=True,
                exploit_attempt_status=code,
            )
            self.assertFalse(res["validation_passed"])
            self.assertEqual(res["behavior"], "PATCH_BYPASS_DETECTED")

    def test_adv_11_unpatched_state_exploit_reproduction(self):
        """[Patch Validation] Unpatched build exploit returning 200/201/202 is EXPLOIT_REPRODUCED."""
        for code in [200, 201, 202, 204]:
            res = NegativeControlTester.assert_fixed_patch_behavior(
                patch_applied=False,
                exploit_attempt_status=code,
            )
            self.assertTrue(res["validation_passed"])
            self.assertEqual(res["behavior"], "EXPLOIT_REPRODUCED")

        # Unpatched build failing to execute exploit returns BASELINE_FAILED
        for code in [401, 403, 404, 500]:
            res = NegativeControlTester.assert_fixed_patch_behavior(
                patch_applied=False,
                exploit_attempt_status=code,
            )
            self.assertFalse(res["validation_passed"])
            self.assertEqual(res["behavior"], "BASELINE_FAILED")

    def test_adv_12_benign_workflow_preservation(self):
        """[Workflow Preservation] Authorized admins must succeed, regressions detected on failure."""
        for role in ["Owner", "Maintainer", "Admin"]:
            res_ok = NegativeControlTester.assert_benign_workflow_preservation(
                user_role=role,
                action="merge_pull_request",
                execution_status=200,
            )
            self.assertTrue(res_ok["workflow_preserved"])
            self.assertFalse(res_ok["regression_detected"])

            res_fail = NegativeControlTester.assert_benign_workflow_preservation(
                user_role=role,
                action="merge_pull_request",
                execution_status=403,
            )
            self.assertFalse(res_fail["workflow_preserved"])
            self.assertTrue(res_fail["regression_detected"])

    # =========================================================================
    # SECTION 4: TIMING JITTER INVARIANCE & NON-DETERMINISM DETECTION
    # =========================================================================

    def test_adv_13_deterministic_jitter_invariance_sweep(self):
        """[Jitter Stress] Evaluate deterministic action across 10ms to 500ms jitter."""
        jitter_spectrum = [10, 25, 50, 100, 200, 300, 400, 500]

        # Action consistently returning 403
        action_fn = lambda j: (403, {"error": "Denied", "jitter_tested": j})
        res = NegativeControlTester.evaluate_timing_jitter_invariance(
            action_fn=action_fn,
            jitter_ms_list=jitter_spectrum,
        )
        self.assertTrue(res["deterministic_behavior"])
        self.assertTrue(res["all_runs_succeeded"])
        self.assertEqual(res["unique_statuses_observed"], [403])
        self.assertEqual(len(res["details"]), len(jitter_spectrum))

    def test_adv_14_non_deterministic_jitter_detection(self):
        """[Jitter Stress] Detect non-deterministic status codes induced by timing fluctuations."""
        flaky_action = lambda j: (200, "OK") if j < 100 else (504, "Gateway Timeout")
        res = NegativeControlTester.evaluate_timing_jitter_invariance(
            action_fn=flaky_action,
            jitter_ms_list=[10, 50, 100, 250, 500],
        )
        self.assertFalse(res["deterministic_behavior"], "Must detect non-deterministic variance in status codes")
        self.assertFalse(res["all_runs_succeeded"], "504 is not a recognized success or denial code")
        self.assertCountEqual(res["unique_statuses_observed"], [200, 504])

    def test_adv_15_clean_room_verifier_jitter_test_boundary_conditions(self):
        """[Jitter Stress] Verifier run_adversarial_jitter_test with boundary values."""
        spec = {"id": "SPEC-JITTER-BOUNDARIES"}
        # Positive jitter
        self.assertTrue(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=0))
        self.assertTrue(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=500))
        self.assertTrue(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=1000))
        # Negative jitter invalid
        self.assertFalse(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=-10))

        # Custom action_fn with valid code vs invalid code
        self.assertTrue(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=10, action_fn=lambda j: (403, None)))
        self.assertFalse(self.verifier.run_adversarial_jitter_test(spec, jitter_ms=10, action_fn=lambda j: (500, None)))

    # =========================================================================
    # SECTION 5: FALSIFICATION GATE & REJECTION MATRIX
    # =========================================================================

    def test_adv_16_falsification_gate_exhaustive_truth_table(self):
        """[Falsification Gate] Test all 4 permutations of (reproduced, negative_control_passed)."""
        gate = NegativeControlTester.evaluate_candidate_falsification_gate

        # (True, True) -> Verified Positive
        self.assertEqual(gate(reproduced=True, negative_control_passed=True), "VERIFIED_POSITIVE")

        # (True, False) -> False Positive detected on clean/patched build -> REJECTED
        self.assertEqual(gate(reproduced=True, negative_control_passed=False), "REJECTED_FALSE_POSITIVE")

        # (False, True) -> Failed to reproduce -> UNCONFIRMED
        self.assertEqual(gate(reproduced=False, negative_control_passed=True), "UNCONFIRMED")

        # (False, False) -> Fails negative control & doesn't reproduce -> REJECTED
        self.assertEqual(gate(reproduced=False, negative_control_passed=False), "REJECTED_FALSE_POSITIVE")

    def test_adv_17_verify_candidate_all_scenarios(self):
        """[Candidate Verification] Comprehensive verification matrix for candidate findings."""
        # Scenario 1: True Positive (Vulnerable=200, Patched=403)
        res_tp = self.verifier.verify_candidate(
            candidate_id="GL-CAND-TP-01",
            attacker_role="Guest",
            target_role="Owner",
            vulnerable_status=200,
            patched_status=403,
            request_data={"action": "exploit"},
            response_data={"secret": "leaked"},
        )
        self.assertTrue(res_tp["positive_reproduced"])
        self.assertTrue(res_tp["negative_control_passed"])
        self.assertEqual(res_tp["verification_status"], "VERIFIED_CONFIRMED")
        self.assertTrue(res_tp["cas_verified"])

        # Scenario 2: False Alarm / Patch Bypass (Vulnerable=200, Patched=200)
        res_fp = self.verifier.verify_candidate(
            candidate_id="GL-CAND-FP-01",
            attacker_role="Guest",
            target_role="Owner",
            vulnerable_status=200,
            patched_status=200,
            request_data={"action": "benign"},
            response_data={"data": "public"},
        )
        self.assertTrue(res_fp["positive_reproduced"])
        self.assertFalse(res_fp["negative_control_passed"])
        self.assertEqual(res_fp["verification_status"], "REJECTED_FALSE_POSITIVE")

        # Scenario 3: Unconfirmed / Non-Reproduced (Vulnerable=403, Patched=403)
        res_un = self.verifier.verify_candidate(
            candidate_id="GL-CAND-UN-01",
            attacker_role="Guest",
            target_role="Owner",
            vulnerable_status=403,
            patched_status=403,
            request_data={"action": "invalid"},
            response_data={"error": "denied"},
        )
        self.assertFalse(res_un["positive_reproduced"])
        self.assertTrue(res_un["negative_control_passed"])
        self.assertEqual(res_un["verification_status"], "UNCONFIRMED")

        # Scenario 4: Server Error / Ambiguous (Vulnerable=500, Patched=500)
        res_err = self.verifier.verify_candidate(
            candidate_id="GL-CAND-ERR-01",
            attacker_role="Guest",
            target_role="Owner",
            vulnerable_status=500,
            patched_status=500,
            request_data={"action": "crash"},
            response_data={"error": "500"},
        )
        self.assertFalse(res_err["positive_reproduced"])
        self.assertFalse(res_err["negative_control_passed"])
        self.assertEqual(res_err["verification_status"], "REJECTED_FALSE_POSITIVE")

    # =========================================================================
    # SECTION 6: CRYPTOGRAPHIC CAS VAULT TAMPER-RESISTANCE & INTEGRITY
    # =========================================================================

    def test_adv_18_cas_deterministic_hashing(self):
        """[CAS Vault] Assert identical payload tuples produce byte-for-byte identical digests."""
        v1 = CASEvidenceVault()
        v2 = CASEvidenceVault()

        req = {"method": "GET", "path": "/api/v4/projects/1/issues", "headers": {"Auth": "Bearer x"}}
        resp = {"issues": [{"id": 1, "confidential": True}]}
        meta = {"spec": "H1", "env": "gitlab-ce:17.3.0"}

        d1 = v1.record_evidence(req, resp, meta)
        d2 = v2.record_evidence(req, resp, meta)

        self.assertEqual(d1, d2, "Identical evidence must produce identical SHA-256 digests")

    def test_adv_19_cas_tamper_detection_single_bit_corruption(self):
        """[CAS Vault] Assert any single-bit mutation breaks cryptographic verification."""
        digest = self.vault.record_evidence(
            request_data="GET /api/v4/version",
            response_data='{"version": "17.3.0"}',
            metadata={"run": 101},
        )
        self.assertTrue(self.vault.verify_evidence(digest))

        # Corrupt 1 byte in stored vault payload
        raw = bytearray(self.vault.vault[digest])
        raw[5] ^= 0x01
        self.vault.vault[digest] = bytes(raw)

        # Verification must now fail
        self.assertFalse(self.vault.verify_evidence(digest), "Corrupted evidence must fail hash verification")
        self.assertIsNone(self.vault.get_evidence(digest), "Tampered evidence retrieval must return None")
        self.assertIsNone(self.vault.generate_receipt(digest), "Tampered evidence cannot produce valid receipt")

    def test_adv_20_cas_receipt_generation_and_export(self):
        """[CAS Vault] Structured cryptographic receipt generation and JSON file export."""
        digest = self.vault.record_evidence(
            request_data="POST /api/v4/projects",
            response_data='{"id": 42, "name": "research_project"}',
            metadata={"candidate": "GL-CAND-01"},
        )
        receipt = self.vault.generate_receipt(digest)
        self.assertIsNotNone(receipt)
        self.assertEqual(receipt["evidence_digest_sha256"], digest)
        self.assertEqual(receipt["status"], "VALID_TAMPER_FREE")
        self.assertTrue(receipt["evidence_summary"]["has_request"])
        self.assertTrue(receipt["evidence_summary"]["has_response"])

        with tempfile.TemporaryDirectory() as tmp_dir:
            out_file = Path(tmp_dir) / "receipt.json"
            success = self.vault.export_receipt(digest, out_file)
            self.assertTrue(success)
            self.assertTrue(out_file.exists())
            saved_data = json.loads(out_file.read_text(encoding="utf-8"))
            self.assertEqual(saved_data["evidence_digest_sha256"], digest)

    def test_adv_21_cas_filesystem_persistence(self):
        """[CAS Vault] Initializing CASEvidenceVault with storage_dir persists artifacts."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            fs_vault = CASEvidenceVault(storage_dir=tmp_dir)
            digest = fs_vault.record_evidence(
                request_data="GET /api/v4/users",
                response_data="[]",
                metadata={"test": "fs"},
            )
            blob_file = Path(tmp_dir) / f"{digest}.json"
            receipt_file = Path(tmp_dir) / f"{digest}.receipt.json"

            self.assertTrue(blob_file.exists())
            self.assertTrue(receipt_file.exists())
            self.assertEqual(fs_vault.count(), 1)
            self.assertIn(digest, fs_vault.all_digests())

    # =========================================================================
    # SECTION 7: FORMAL HYPOTHESES H1-H5 FULL PIPELINE VERIFICATION
    # =========================================================================

    def test_adv_22_full_pipeline_hypothesis_h1_graphql_asymmetry(self):
        """[Formal Pipeline] Execute H1 GraphQL Authorization Asymmetry through Clean-Room Verifier."""
        spec_h1 = {
            "id": "SPEC-H01",
            "title": "GraphQL vs REST Authorization Asymmetry on Project Export",
            "flaw_category": "AUTHORIZATION_ASYMMETRY",
            "target_interface": "GraphQL",
            "endpoint": "projectExport",
            "actor_matrix": {"attacker_role": "Reporter", "victim_role": "Owner"},
            "abstract_mutation": {
                "query": "mutation { projectExport(input: { projectPath: 'group/project' }) { errors } }"
            },
            "expected_violation": "UNAUTHORIZED_EXPORT_TRIGGER",
        }
        report = self.verifier.execute_full_clean_room_pipeline(spec_h1)
        self.assertEqual(report["final_verdict"], "VERIFIED_CONFIRMED")
        self.assertTrue(report["phases"]["Phase_A_Provision"])
        self.assertTrue(report["phases"]["Phase_B_NegativeBaseline"])
        self.assertTrue(report["phases"]["Phase_C_PositiveProof"])
        self.assertTrue(report["phases"]["Phase_C_HardenedBaselineClear"])
        self.assertTrue(report["phases"]["Phase_D_PatchedControl"])
        self.assertTrue(report["phases"]["Phase_E_AdversarialJitter"])

        # Check CAS digests
        d_vuln = report["evidence_digests"]["vulnerable_reproduction_sha256"]
        d_hard = report["evidence_digests"]["hardened_baseline_sha256"]
        self.assertTrue(self.vault.verify_evidence(d_vuln))
        self.assertTrue(self.vault.verify_evidence(d_hard))
        self.assertNotEqual(d_vuln, d_hard)

    def test_adv_23_full_pipeline_hypothesis_h2_job_token_bypass(self):
        """[Formal Pipeline] Execute H2 CI_JOB_TOKEN Cross-Project Inbound Allowlist Bypass."""
        spec_h2 = {
            "id": "SPEC-H02",
            "title": "CI_JOB_TOKEN Cross-Project Inbound Allowlist Bypass",
            "flaw_category": "TOKEN_SCOPE_CONFUSION",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects/:id/packages",
            "actor_matrix": {"attacker_role": "Guest", "victim_role": "Owner"},
            "abstract_mutation": {
                "header": "JOB-TOKEN",
                "target_project_id": 999,
            },
            "expected_violation": "CROSS_TENANT_ALLOWLIST_BYPASS",
        }
        report = self.verifier.execute_full_clean_room_pipeline(spec_h2)
        self.assertEqual(report["final_verdict"], "VERIFIED_CONFIRMED")

    def test_adv_24_full_pipeline_hypothesis_h3_project_group_link(self):
        """[Formal Pipeline] Execute H3 ProjectGroupLink Access Escalation via Group Transfer."""
        spec_h3 = {
            "id": "SPEC-H03",
            "title": "ProjectGroupLink Access Escalation via Group Transfer",
            "flaw_category": "POLICY_INHERITANCE",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects/:id/repository/branches",
            "actor_matrix": {"attacker_role": "Guest", "target_group": "Group_2"},
            "abstract_mutation": {"branch": "exploit-branch", "ref": "main"},
            "expected_violation": "LINK_CAP_ESCALATION",
        }
        report = self.verifier.execute_full_clean_room_pipeline(spec_h3)
        self.assertEqual(report["final_verdict"], "VERIFIED_CONFIRMED")

    def test_adv_25_full_pipeline_hypothesis_h4_toctou_archival_race(self):
        """[Formal Pipeline] Execute H4 TOCTOU Race Condition on Project Archival."""
        spec_h4 = {
            "id": "SPEC-H04",
            "title": "TOCTOU Race on Project Archival & Merge Request Push",
            "flaw_category": "TEMPORAL_STATE_RACES",
            "target_interface": "BackgroundWorker",
            "endpoint": "MergeWorker",
            "actor_matrix": {"attacker_role": "Developer"},
            "abstract_mutation": {"mr_id": 12, "concurrent_archive": True},
            "expected_violation": "ARCHIVED_PROJECT_WRITE",
        }
        report = self.verifier.execute_full_clean_room_pipeline(spec_h4)
        self.assertEqual(report["final_verdict"], "VERIFIED_CONFIRMED")

    def test_adv_26_full_pipeline_hypothesis_h5_webhook_ssrf(self):
        """[Formal Pipeline] Execute H5 Webhook SSRF IP Allowlist Bypass."""
        spec_h5 = {
            "id": "SPEC-H05",
            "title": "Webhook SSRF IP Allowlist Bypass via Parser Differentials",
            "flaw_category": "SSRF_PARSER_DIFFERENTIALS",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects/:id/hooks",
            "actor_matrix": {"attacker_role": "Maintainer"},
            "abstract_mutation": {"url": "http://0x7f000001:8080/hook"},
            "expected_violation": "SSRF_LOOPBACK_SOCKET_OPEN",
        }
        report = self.verifier.execute_full_clean_room_pipeline(spec_h5)
        self.assertEqual(report["final_verdict"], "VERIFIED_CONFIRMED")

    # =========================================================================
    # SECTION 8: HARDENED EDGE-CASE VERIFICATION (REMEDIATED BEHAVIORS)
    # =========================================================================

    def test_adv_27_hardened_nested_bytes_in_cas_vault(self):
        """[Hardening 1] CAS Vault cleanly normalizes nested dictionary containing bytes payload."""
        nested_bytes_payload = {
            "request_headers": {"Content-Type": "application/octet-stream"},
            "body_bytes": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR",
            "nested_list": [b"raw_bytes", {"inner_bytes": b"\x80\x01\x02"}],
        }
        digest = self.vault.record_evidence(nested_bytes_payload, {"status": 200})
        self.assertEqual(len(digest), 64)
        self.assertTrue(self.vault.verify_evidence(digest))
        evidence = self.vault.get_evidence(digest)
        self.assertIsNotNone(evidence)
        self.assertEqual(evidence["request"]["body_bytes"], b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR".hex())
        self.assertEqual(evidence["request"]["nested_list"][0], "raw_bytes")
        self.assertEqual(evidence["request"]["nested_list"][1]["inner_bytes"], "800102")

    def test_adv_28_hardened_none_actor_matrix(self):
        """[Hardening 2] CleanRoomVerifier safely handles spec['actor_matrix'] being None."""
        spec_with_none_matrix = {
            "id": "SPEC-NULL-MATRIX",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects",
            "actor_matrix": None,  # Common in YAML when key is specified without children
        }
        res = self.verifier.run_baseline_negative_control(spec_with_none_matrix)
        self.assertTrue(res, "spec with actor_matrix: None must safely default to Guest and pass baseline control")

    def test_adv_29_hardened_role_casing_normalization(self):
        """[Hardening 3] NegativeControlTester normalizes role string casing."""
        for role in ["guest", "GUEST", "Guest", "  guest  ", "reporter", "REPORTER", "Reporter", "external", "anonymous"]:
            res = NegativeControlTester.assert_unprivileged_rejection(role, "export", 403)
            self.assertTrue(
                res["negative_control_passed"],
                f"Role '{role}' receiving 403 must pass negative control after case normalization",
            )
            self.assertTrue(res["is_unprivileged_role"])


def run_empirical_adversarial_suite():
    """Execute all adversarial test suites and return structured summary."""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestAdversarialCleanRoomVerifier)
    runner = unittest.TextTestRunner(verbosity=2)
    start_time = time.time()
    result = runner.run(suite)
    elapsed = time.time() - start_time

    summary = {
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "elapsed_seconds": round(elapsed, 4),
        "passed": result.wasSuccessful(),
    }
    print("\n" + "=" * 70)
    print(f"ADVERSARIAL STRESS TEST SUMMARY: {summary}")
    print("=" * 70)
    return summary, result


if __name__ == "__main__":
    summary, result = run_empirical_adversarial_suite()
    if not summary["passed"]:
        sys.exit(1)
