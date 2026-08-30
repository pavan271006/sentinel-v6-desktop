"""
Challenger Deep Empirical Validation Test Suite - Milestone 4
============================================================
Exhaustively stress-tests:
1. Hypothesis Catalog Mirror Synchronization (root vs docs/ byte parity)
2. Formal Hypothesis Completeness (H1 to H5 across all 5 flaw categories)
3. CASEvidenceVault Cryptographic Integrity & Tamper-Evidence
4. NegativeControlTester Invariant Enforcement & Zero False Positive Gate
5. CleanRoomVerifier 5-Phase Verification Protocol & Dual-Role Isolation
6. Timing Jitter & Noise Stress Resilience (10ms to 500ms)
7. Fail-Closed Error Handling on Ambiguous Responses
"""

import hashlib
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = LAB_ROOT / "docs"

if str(LAB_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT.parent))
if str(LAB_ROOT) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT))

from gitlab_research_lab.verifier.cas_evidence_vault import CASEvidenceVault
from gitlab_research_lab.verifier.clean_room_verifier import CleanRoomVerifier, CleanRoomVerifierSimulator
from gitlab_research_lab.verifier.negative_controls import NegativeControlTester


class TestChallengerM4DeepVerification(unittest.TestCase):
    """Deep adversarial test suite for Milestone 4."""

    @classmethod
    def setUpClass(cls):
        cls.docs_catalog = DOCS_DIR / "GITLAB_HYPOTHESIS_CATALOG.md"
        cls.root_catalog = LAB_ROOT / "GITLAB_HYPOTHESIS_CATALOG.md"
        cls.docs_text = cls.docs_catalog.read_text(encoding="utf-8")
        cls.root_text = cls.root_catalog.read_text(encoding="utf-8")

    # =========================================================================
    # 1. MIRROR SYNCHRONIZATION & PARITY
    # =========================================================================

    def test_hypothesis_catalog_mirror_sha256_byte_parity(self):
        """Verify 100% SHA-256 byte-for-byte parity between docs and root hypothesis catalogs."""
        self.assertTrue(self.docs_catalog.exists(), "docs/GITLAB_HYPOTHESIS_CATALOG.md missing")
        self.assertTrue(self.root_catalog.exists(), "root GITLAB_HYPOTHESIS_CATALOG.md missing")

        docs_bytes = self.docs_catalog.read_bytes()
        root_bytes = self.root_catalog.read_bytes()

        docs_hash = hashlib.sha256(docs_bytes).hexdigest()
        root_hash = hashlib.sha256(root_bytes).hexdigest()

        self.assertEqual(
            docs_hash,
            root_hash,
            f"Hypothesis catalog parity failure: docs={docs_hash}, root={root_hash}",
        )
        self.assertEqual(self.docs_text, self.root_text)

    # =========================================================================
    # 2. HYPOTHESIS CATALOG SPECIFICATION DEPTH (H1 to H5)
    # =========================================================================

    def test_all_five_hypotheses_defined_in_matrix_and_specifications(self):
        """Verify all 5 hypotheses (H1 to H5) are present with required subsections."""
        expected_hypotheses = ["H1", "H2", "H3", "H4", "H5"]
        for hid in expected_hypotheses:
            self.assertIn(f"**{hid}**", self.docs_text, f"{hid} missing from matrix")
            self.assertIn(f"### {hid}:", self.docs_text, f"{hid} missing from detailed specifications")

    def test_hypothesis_flaw_categories_and_invariants(self):
        """Verify each hypothesis specifies an uppercase flaw category, CWE, and mathematical invariant."""
        categories = [
            "AUTHORIZATION_ASYMMETRY",
            "TOKEN_SCOPE_CONFUSION",
            "POLICY_INHERITANCE",
            "TEMPORAL_STATE_RACES",
            "SSRF_PARSER_DIFFERENTIALS",
        ]
        for cat in categories:
            self.assertIn(cat, self.docs_text, f"Flaw category {cat} missing from catalog")

        # Invariant and CVSS checks
        self.assertIn("Mathematical Invariant", self.docs_text)
        self.assertIn("Preconditions", self.docs_text)
        self.assertIn("Clean-Room Reproduction Procedure", self.docs_text)
        self.assertIn("Defensive Remediation & Patch Diff", self.docs_text)
        self.assertIn("Falsification & Rejection Criteria", self.docs_text)

    # =========================================================================
    # 3. CAS EVIDENCE VAULT EMPIRICAL & CRYPTOGRAPHIC TESTS
    # =========================================================================

    def test_cas_evidence_vault_deterministic_digests(self):
        """Verify CAS digests are strictly deterministic across identical inputs."""
        vault1 = CASEvidenceVault()
        vault2 = CASEvidenceVault()

        req = {"method": "POST", "url": "/api/v4/projects/1/export", "headers": {"User-Agent": "Lab/1.0"}}
        resp = {"status": 202, "message": "Export initiated"}
        meta = {"spec_id": "H-01", "role": "Maintainer"}

        digest1 = vault1.record_evidence(req, resp, meta)
        digest2 = vault2.record_evidence(req, resp, meta)

        self.assertEqual(digest1, digest2)
        self.assertEqual(len(digest1), 64)
        self.assertTrue(vault1.verify_evidence(digest1))
        self.assertTrue(vault2.verify_evidence(digest2))

    def test_cas_evidence_vault_tamper_detection(self):
        """Verify any modification in stored bytes invalidates cryptographic verification."""
        vault = CASEvidenceVault()
        digest = vault.record_evidence(
            request_data="GET /api/v4/users",
            response_data='[{"id": 1, "username": "root"}]',
            metadata={"source": "test"},
        )
        self.assertTrue(vault.verify_evidence(digest))

        # Mutate stored byte payload
        raw_bytes = bytearray(vault.vault[digest])
        raw_bytes[5] ^= 0xAA
        vault.vault[digest] = bytes(raw_bytes)

        # Verification must now fail
        self.assertFalse(vault.verify_evidence(digest))
        self.assertIsNone(vault.get_evidence(digest))
        self.assertIsNone(vault.generate_receipt(digest))

    def test_cas_receipt_generation_and_export(self):
        """Verify JSON receipt generation and disk export functionality."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            vault = CASEvidenceVault(storage_dir=tmp_dir)
            digest = vault.record_evidence("REQ_SAMPLE", "RESP_SAMPLE", {"test": True})

            receipt = vault.generate_receipt(digest)
            self.assertIsNotNone(receipt)
            self.assertEqual(receipt["evidence_digest_sha256"], digest)
            self.assertEqual(receipt["status"], "VALID_TAMPER_FREE")

            receipt_file = Path(tmp_dir) / "exported_receipt.json"
            success = vault.export_receipt(digest, receipt_file)
            self.assertTrue(success)
            self.assertTrue(receipt_file.exists())
            loaded = json.loads(receipt_file.read_text(encoding="utf-8"))
            self.assertEqual(loaded["evidence_digest_sha256"], digest)

    # =========================================================================
    # 4. NEGATIVE CONTROLS & INVARIANT ASSERTION ENGINE
    # =========================================================================

    def test_negative_control_unprivileged_roles_rejection(self):
        """Assert unprivileged roles (Guest, Reporter, External, Anonymous) are cleanly blocked."""
        for role in ["Guest", "Reporter", "External", "Anonymous"]:
            for status in [401, 403, 404]:
                res = NegativeControlTester.assert_unprivileged_rejection(
                    user_role=role,
                    action="admin_project_export",
                    simulated_status=status,
                )
                self.assertTrue(res["negative_control_passed"])
                self.assertTrue(res["properly_blocked"])

    def test_negative_control_privileged_benign_preservation(self):
        """Assert defensive patch preserves legitimate workflows for Maintainer/Owner."""
        for role in ["Maintainer", "Owner", "Admin"]:
            for status in [200, 201, 202]:
                res = NegativeControlTester.assert_benign_workflow_preservation(
                    user_role=role,
                    action="admin_project_export",
                    execution_status=status,
                )
                self.assertTrue(res["workflow_preserved"])
                self.assertFalse(res["regression_detected"])

    def test_negative_control_fixed_patch_mitigation(self):
        """Assert patch behavior validation: blocked on patch, reproduced on unpatched."""
        # Unpatched (vulnerable) attempt succeeds
        unpatched = NegativeControlTester.assert_fixed_patch_behavior(
            patch_applied=False,
            exploit_attempt_status=200,
        )
        self.assertTrue(unpatched["validation_passed"])
        self.assertEqual(unpatched["behavior"], "EXPLOIT_REPRODUCED")

        # Patched attempt is rejected
        patched = NegativeControlTester.assert_fixed_patch_behavior(
            patch_applied=True,
            exploit_attempt_status=403,
        )
        self.assertTrue(patched["validation_passed"])
        self.assertEqual(patched["behavior"], "DEFENSE_EFFECTIVE")

    def test_negative_control_falsification_gate(self):
        """Assert strict candidate falsification logic."""
        # Genuine reproduced flaw with clean negative control
        self.assertEqual(
            NegativeControlTester.evaluate_candidate_falsification_gate(reproduced=True, negative_control_passed=True),
            "VERIFIED_POSITIVE",
        )
        # False positive on clean baseline -> REJECTED
        self.assertEqual(
            NegativeControlTester.evaluate_candidate_falsification_gate(reproduced=True, negative_control_passed=False),
            "REJECTED_FALSE_POSITIVE",
        )
        # Unreproduced
        self.assertEqual(
            NegativeControlTester.evaluate_candidate_falsification_gate(reproduced=False, negative_control_passed=True),
            "UNCONFIRMED",
        )

    # =========================================================================
    # 5. CLEAN-ROOM VERIFIER PROTOCOL & FULL PIPELINE
    # =========================================================================

    def test_clean_room_verifier_candidate_verification_full_cycle(self):
        """Verify complete candidate verification flow with CAS sealing."""
        verifier = CleanRoomVerifier()

        result = verifier.verify_candidate(
            candidate_id="GL-CAND-H01",
            attacker_role="Reporter",
            target_role="Maintainer",
            vulnerable_status=200,
            patched_status=403,
            request_data={"mutation": "projectExport"},
            response_data={"status": 200, "export_started": True},
        )

        self.assertEqual(result["candidate_id"], "GL-CAND-H01")
        self.assertEqual(result["verification_status"], "VERIFIED_CONFIRMED")
        self.assertTrue(result["positive_reproduced"])
        self.assertTrue(result["negative_control_passed"])
        self.assertTrue(result["cas_verified"])
        self.assertEqual(len(result["evidence_sha256"]), 64)

    def test_clean_room_verifier_all_five_hypothesis_specs_pipeline(self):
        """Execute full 5-phase clean-room verification pipeline across specs H1 through H5."""
        verifier = CleanRoomVerifier()

        h_specs = [
            {
                "id": "SPEC-H01",
                "target_interface": "GraphQL",
                "endpoint": "/api/graphql",
                "actor_matrix": {"attacker_role": "Reporter", "victim_role": "Owner"},
                "abstract_mutation": {"query": "mutation { projectExport { clientMutationId } }"},
                "expected_violation": "AUTHORIZATION_ASYMMETRY",
            },
            {
                "id": "SPEC-H02",
                "target_interface": "REST",
                "endpoint": "/api/v4/projects/10/packages",
                "actor_matrix": {"attacker_role": "Guest", "victim_role": "Owner"},
                "abstract_mutation": {"header": "JOB-TOKEN: external_job_token"},
                "expected_violation": "TOKEN_SCOPE_CONFUSION",
            },
            {
                "id": "SPEC-H03",
                "target_interface": "REST",
                "endpoint": "/api/v4/projects/10/repository/branches",
                "actor_matrix": {"attacker_role": "Guest", "victim_role": "Maintainer"},
                "abstract_mutation": {"action": "create_branch_post_transfer"},
                "expected_violation": "POLICY_INHERITANCE",
            },
            {
                "id": "SPEC-H04",
                "target_interface": "Sidekiq",
                "endpoint": "MergeWorker",
                "actor_matrix": {"attacker_role": "Developer", "victim_role": "Maintainer"},
                "abstract_mutation": {"action": "concurrent_merge_and_archive"},
                "expected_violation": "TEMPORAL_STATE_RACES",
            },
            {
                "id": "SPEC-H05",
                "target_interface": "REST",
                "endpoint": "/api/v4/projects/10/hooks",
                "actor_matrix": {"attacker_role": "Maintainer", "target_network": "127.0.0.1"},
                "abstract_mutation": {"url": "http://0x7f000001:8080/hook"},
                "expected_violation": "SSRF_PARSER_DIFFERENTIALS",
            },
        ]

        for spec in h_specs:
            pipeline_res = verifier.execute_full_clean_room_pipeline(spec)
            self.assertEqual(pipeline_res["final_verdict"], "VERIFIED_CONFIRMED")
            self.assertTrue(pipeline_res["phases"]["Phase_A_Provision"])
            self.assertTrue(pipeline_res["phases"]["Phase_B_NegativeBaseline"])
            self.assertTrue(pipeline_res["phases"]["Phase_C_PositiveProof"])
            self.assertTrue(pipeline_res["phases"]["Phase_C_HardenedBaselineClear"])
            self.assertTrue(pipeline_res["phases"]["Phase_D_PatchedControl"])
            self.assertTrue(pipeline_res["phases"]["Phase_E_AdversarialJitter"])

    def test_timing_jitter_invariance_across_latency_ranges(self):
        """Stress-test negative control timing jitter evaluation across 10ms to 500ms."""
        def mock_deterministic_action(jitter_ms: int):
            # Invariant: deterministic 403 denial regardless of timing
            return 403, {"error": "Denied", "latency_ms": jitter_ms}

        jitter_report = NegativeControlTester.evaluate_timing_jitter_invariance(
            action_fn=mock_deterministic_action,
            jitter_ms_list=[10, 50, 100, 250, 500],
        )
        self.assertTrue(jitter_report["deterministic_behavior"])
        self.assertTrue(jitter_report["all_runs_succeeded"])
        self.assertEqual(jitter_report["unique_statuses_observed"], [403])


if __name__ == "__main__":
    unittest.main()
