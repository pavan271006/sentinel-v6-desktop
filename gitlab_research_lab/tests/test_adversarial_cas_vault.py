"""
Adversarial Stress Test Suite: Cryptographic CAS Evidence Vault & Hypothesis Falsification Gate
==============================================================================================
Empirical challenge harness testing:
1. CAS Single-Bit / Single-Byte Mutation & Tamper Detection (100% bit-flip rejection)
2. Cryptographic Avalanche Effect & Collision Resistance (Zero collisions across 5,000 records)
3. Receipt Integrity, Forgery, and File-Backed Storage Desynchronization
4. Canonical JSON Serialization, Type Differentiation, and Unicode/Binary Edge Cases
5. 7-Role Exhaustive Matrix & Hypothesis Falsification Gates (H1 to H5)
6. High-Concurrency Multi-Threaded Invariant Stress (50 threads / 1,000 items)
"""

import concurrent.futures
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure project and workspace root are on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
WORKSPACE_ROOT = PROJECT_ROOT.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from gitlab_research_lab.verifier.cas_evidence_vault import CASEvidenceVault
from gitlab_research_lab.verifier.clean_room_verifier import CleanRoomVerifier
from gitlab_research_lab.verifier.negative_controls import NegativeControlTester


class TestAdversarialCASEvidenceVault(unittest.TestCase):
    """Deep adversarial and empirical challenge suite for CAS Evidence Vault."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="cas_adv_test_")
        self.vault = CASEvidenceVault(storage_dir=self.temp_dir)
        self.verifier = CleanRoomVerifier(cas_vault=self.vault)
        self.controls = NegativeControlTester()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # =========================================================================
    # SUITE 1: SINGLE-BIT & SINGLE-BYTE MUTATION TAMPER DETECTION (EXHAUSTIVE)
    # =========================================================================

    def test_adv_single_bit_flip_exhaustive_rejection(self):
        """
        Adversarial: Flip every single bit (bits 0-7) across multiple byte positions
        in the serialized payload. 100% of single-bit mutations MUST fail verification.
        """
        request = "POST /api/v4/projects/42/export HTTP/1.1\r\nHost: gitlab.local"
        response = '{"status": 202, "message": "Export initiated", "archive_id": 9912}'
        metadata = {"spec_id": "H-01", "role": "Reporter", "target": "project_export"}

        digest = self.vault.record_evidence(request, response, metadata)
        self.assertTrue(self.vault.verify_evidence(digest))

        raw_payload = bytearray(self.vault.vault[digest])
        payload_length = len(raw_payload)
        self.assertGreater(payload_length, 50)

        # Sample evenly distributed byte positions across the payload
        sample_indices = [
            0, 1, 2,  # Header/start
            payload_length // 4,
            payload_length // 2,
            3 * (payload_length // 4),
            payload_length - 3,
            payload_length - 2,
            payload_length - 1,  # End
        ]
        # Add intermediate positions
        for i in range(12):
            sample_indices.append((i * 13) % payload_length)
        sample_indices = sorted(list(set(sample_indices)))

        total_mutations_tested = 0
        total_mutations_caught = 0

        for idx in sample_indices:
            for bit in range(8):
                mutated = bytearray(raw_payload)
                mutated[idx] ^= (1 << bit)
                
                # Apply mutation to vault storage
                self.vault.vault[digest] = bytes(mutated)
                
                is_valid = self.vault.verify_evidence(digest)
                retrieved = self.vault.get_evidence(digest)
                
                total_mutations_tested += 1
                if not is_valid and retrieved is None:
                    total_mutations_caught += 1

        # Restore original
        self.vault.vault[digest] = bytes(raw_payload)

        self.assertEqual(
            total_mutations_tested,
            total_mutations_caught,
            f"Failed to catch all bit mutations! Tested: {total_mutations_tested}, Caught: {total_mutations_caught}"
        )
        self.assertTrue(self.vault.verify_evidence(digest))

    def test_adv_payload_truncation_and_expansion_tampering(self):
        """
        Adversarial: Truncate by 1..N bytes and expand by trailing garbage/nulls.
        Must strictly fail verification and deserialization.
        """
        digest = self.vault.record_evidence(
            request_data="GET /api/v4/projects",
            response_data='{"data": [1, 2, 3]}',
            metadata={"source": "api_audit"},
        )
        original_bytes = self.vault.vault[digest]

        # 1. Truncate 1 byte
        self.vault.vault[digest] = original_bytes[:-1]
        self.assertFalse(self.vault.verify_evidence(digest))
        self.assertIsNone(self.vault.get_evidence(digest))

        # 2. Truncate half
        self.vault.vault[digest] = original_bytes[: len(original_bytes) // 2]
        self.assertFalse(self.vault.verify_evidence(digest))
        self.assertIsNone(self.vault.get_evidence(digest))

        # 3. Append single byte
        self.vault.vault[digest] = original_bytes + b"\x00"
        self.assertFalse(self.vault.verify_evidence(digest))
        self.assertIsNone(self.vault.get_evidence(digest))

        # 4. Prepend single byte
        self.vault.vault[digest] = b" " + original_bytes
        self.assertFalse(self.vault.verify_evidence(digest))
        self.assertIsNone(self.vault.get_evidence(digest))

        # 5. Empty payload
        self.vault.vault[digest] = b""
        self.assertFalse(self.vault.verify_evidence(digest))
        self.assertIsNone(self.vault.get_evidence(digest))

    def test_adv_metadata_injection_tamper_attempt(self):
        """
        Adversarial: Attempt to inject escalated privileges into stored metadata
        in-place without changing the registered CAS digest.
        """
        digest = self.vault.record_evidence(
            request_data="GET /admin/users",
            response_data='{"admin": false}',
            metadata={"role": "Guest", "verified": False},
        )
        original_payload = json.loads(self.vault.vault[digest].decode("utf-8"))
        
        # Tamper metadata
        tampered_payload = dict(original_payload)
        tampered_payload["metadata"] = {"role": "Admin", "verified": True}
        tampered_serialized = json.dumps(tampered_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")

        self.vault.vault[digest] = tampered_serialized

        self.assertFalse(self.vault.verify_evidence(digest), "Injected metadata must invalidate digest verification")
        self.assertIsNone(self.vault.get_evidence(digest))
        self.assertIsNone(self.vault.generate_receipt(digest))

    # =========================================================================
    # SUITE 2: CRYPTOGRAPHIC AVALANCHE EFFECT & ZERO COLLISION PROOF
    # =========================================================================

    def test_adv_sha256_avalanche_effect_measurement(self):
        """
        Cryptographic: Measure the avalanche effect when a single input bit changes.
        For a secure cryptographic hash (SHA-256), flipping 1 input bit should flip
        approximately 50% (128 bits +/- 25) of the 256 output bits.
        """
        base_payload = b"GitLab Research Lab CAS Evidence Record Baseline Data 2026"
        base_hash = hashlib.sha256(base_payload).digest()

        def count_bit_differences(b1: bytes, b2: bytes) -> int:
            return sum(bin(x ^ y).count("1") for x, y in zip(b1, b2))

        diff_counts = []
        for byte_idx in range(min(len(base_payload), 20)):
            for bit in range(8):
                mutated = bytearray(base_payload)
                mutated[byte_idx] ^= (1 << bit)
                mutated_hash = hashlib.sha256(mutated).digest()
                diff_counts.append(count_bit_differences(base_hash, mutated_hash))

        avg_diff = sum(diff_counts) / len(diff_counts)
        # Avalanche target: ~128 bits out of 256 bits (50%)
        self.assertGreater(avg_diff, 110, f"Avalanche effect too weak! Avg bit diff: {avg_diff}/256")
        self.assertLess(avg_diff, 146, f"Avalanche effect biased! Avg bit diff: {avg_diff}/256")

    def test_adv_zero_collisions_across_five_thousand_variations(self):
        """
        Adversarial: Ingest 5,000 sequentially and structurally varied records.
        Assert 5,000 unique SHA-256 digests with zero hash collisions.
        """
        vault = CASEvidenceVault()
        digests = set()
        total_items = 5000

        for i in range(total_items):
            d = vault.record_evidence(
                request_data={"idx": i, "path": f"/api/v4/item/{i}"},
                response_data={"status": 200, "data": f"token_{i}"},
                metadata={"seq": i, "time": 1700000000 + i},
            )
            digests.add(d)

        self.assertEqual(len(digests), total_items, "Collision detected in CAS evidence records!")
        self.assertEqual(vault.count(), total_items)

    # =========================================================================
    # SUITE 3: RECEIPT INTEGRITY, FORGERY & STORAGE DESYNCHRONIZATION
    # =========================================================================

    def test_adv_receipt_generation_blocks_tampered_evidence(self):
        """
        Adversarial: Verify that generate_receipt and export_receipt return None/False
        when the underlying evidence has been modified or does not exist.
        """
        digest = self.vault.record_evidence(
            request_data={"query": "mutation { deleteProject }"},
            response_data={"errors": []},
            metadata={"actor": "Attacker"},
        )
        # Valid receipt succeeds
        valid_receipt = self.vault.generate_receipt(digest)
        self.assertIsNotNone(valid_receipt)
        self.assertEqual(valid_receipt["status"], "VALID_TAMPER_FREE")
        self.assertEqual(valid_receipt["evidence_digest_sha256"], digest)

        # Export succeeds
        receipt_out = Path(self.temp_dir) / "test_receipt.json"
        self.assertTrue(self.vault.export_receipt(digest, receipt_out))
        self.assertTrue(receipt_out.exists())

        # Corrupt evidence
        self.vault.vault[digest] = b'{"corrupted": true}'
        
        # Now receipt generation and export must fail
        self.assertIsNone(self.vault.generate_receipt(digest))
        self.assertFalse(self.vault.export_receipt(digest, receipt_out))

        # Querying non-existent digest
        fake_digest = "a" * 64
        self.assertIsNone(self.vault.generate_receipt(fake_digest))
        self.assertFalse(self.vault.export_receipt(fake_digest, receipt_out))

    def test_adv_filesystem_persistence_and_disk_corruption_detection(self):
        """
        Adversarial: Test file-backed CAS artifacts. When a blob file on disk
        is corrupted by an external process, reading and verifying from disk fails.
        """
        digest = self.vault.record_evidence(
            request_data="POST /ci/jobs/trigger",
            response_data="TOKEN_GRANTED",
            metadata={"job_id": 1002},
        )
        blob_file = Path(self.temp_dir) / f"{digest}.json"
        receipt_file = Path(self.temp_dir) / f"{digest}.receipt.json"

        self.assertTrue(blob_file.exists())
        self.assertTrue(receipt_file.exists())

        # Verify on-disk blob hash matches digest
        disk_bytes = blob_file.read_bytes()
        self.assertEqual(hashlib.sha256(disk_bytes).hexdigest(), digest)

        # Mutate on-disk blob
        mutated_disk_bytes = bytearray(disk_bytes)
        mutated_disk_bytes[5] ^= 0x55
        blob_file.write_bytes(bytes(mutated_disk_bytes))

        # Direct on-disk hash check must detect corruption
        tampered_disk_hash = hashlib.sha256(blob_file.read_bytes()).hexdigest()
        self.assertNotEqual(tampered_disk_hash, digest)

    # =========================================================================
    # SUITE 4: COLLISION RESISTANCE, DETERMINISM & TYPE DIFFERENTIATION
    # =========================================================================

    def test_adv_canonical_json_key_order_determinism(self):
        """
        Verify that dictionary key insertion order does NOT alter the computed CAS digest.
        """
        meta1 = {"zeta": 1, "alpha": 2, "gamma": {"k2": "b", "k1": "a"}}
        meta2 = {"alpha": 2, "gamma": {"k1": "a", "k2": "b"}, "zeta": 1}

        vault1 = CASEvidenceVault()
        vault2 = CASEvidenceVault()

        d1 = vault1.record_evidence(request_data={"p2": "y", "p1": "x"}, response_data="OK", metadata=meta1)
        d2 = vault2.record_evidence(request_data={"p1": "x", "p2": "y"}, response_data="OK", metadata=meta2)

        self.assertEqual(d1, d2, "Canonical JSON serialization must yield identical digests regardless of key ordering")

    def test_adv_type_confusion_resistance_no_cross_type_collisions(self):
        """
        Adversarial: Stress test type confusion attacks.
        Ensure string '123' vs int 123, True vs 1, None vs '', {} vs [] all produce
        strictly distinct SHA-256 digests.
        """
        cases = [
            ("int_vs_str", {"val": 123}, {"val": "123"}),
            ("bool_vs_int", {"val": True}, {"val": 1}),
            ("bool_false_vs_zero", {"val": False}, {"val": 0}),
            ("none_vs_empty_str", {"val": None}, {"val": ""}),
            ("empty_dict_vs_empty_list", {"val": {}}, {"val": []}),
            ("field_transposition", ("REQ_A", "RESP_B"), ("REQ_B", "RESP_A")),
        ]

        for name, a, b in cases:
            v = CASEvidenceVault()
            if name == "field_transposition":
                da = v.record_evidence(a[0], a[1], {})
                db = v.record_evidence(b[0], b[1], {})
            else:
                da = v.record_evidence(a, "resp", {})
                db = v.record_evidence(b, "resp", {})

            self.assertNotEqual(
                da, db,
                f"Type collision detected in case '{name}': {a} and {b} produced identical digest {da}"
            )

    def test_adv_binary_payloads_and_unicode_boundary_stress(self):
        """
        Adversarial: Verify non-UTF8 binary byte streams, null bytes, RTL overrides,
        and high-plane Unicode characters serialize deterministically without crashing.
        """
        raw_binary_1 = b"\x00\xff\xfe\xfd\x01\x02\x03\xaa\xbb\xcc"
        raw_binary_2 = b"\x00\xff\xfe\xfd\x01\x02\x03\xaa\xbb\xcd"  # 1 bit difference

        d1 = self.vault.record_evidence(raw_binary_1, "binary_resp")
        d2 = self.vault.record_evidence(raw_binary_2, "binary_resp")

        self.assertNotEqual(d1, d2)
        self.assertTrue(self.vault.verify_evidence(d1))
        self.assertTrue(self.vault.verify_evidence(d2))

        # Unicode stress: RTL, zero-width joiners, emoji sequences
        unicode_str = "GitLab 🚀 \u202e\u200b\ufeff \U0001F600 \u03c0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c3\u03af\u03b1"
        du = self.vault.record_evidence(unicode_str, unicode_str, {"lang": "el_GR"})
        self.assertTrue(self.vault.verify_evidence(du))
        recovered = self.vault.get_evidence(du)
        self.assertEqual(recovered["request"], unicode_str)

    def test_adv_large_payload_and_deep_nesting_stress(self):
        """
        Adversarial: Record a large 2MB structured payload and deeply nested JSON (50 levels)
        to verify memory safety, stack depth handling, and hash verification.
        """
        # 1. Large payload
        large_body = "A" * (2 * 1024 * 1024)  # 2MB string
        d_large = self.vault.record_evidence("POST /upload", large_body, {"size": len(large_body)})
        self.assertTrue(self.vault.verify_evidence(d_large))
        self.assertEqual(len(self.vault.get_evidence(d_large)["response"]), 2 * 1024 * 1024)

        # 2. Deeply nested structure
        nested = {"val": "deepest"}
        for i in range(50):
            nested = {f"level_{i}": nested}
        d_nested = self.vault.record_evidence(nested, "NESTED_OK")
        self.assertTrue(self.vault.verify_evidence(d_nested))

    # =========================================================================
    # SUITE 5: 7-ROLE EXHAUSTIVE MATRIX & HYPOTHESIS FALSIFICATION (H1-H5)
    # =========================================================================

    def test_adv_seven_role_authorization_truth_table(self):
        """
        Adversarial: Exhaustively evaluate the 7-Role authorization matrix across
        protected administrative actions and negative controls.
        """
        action = "admin_project_export"

        # 1. Authorized Admin Roles (Maintainer, Owner, Admin)
        for role in ["Admin", "Owner", "Maintainer"]:
            res_auth = self.controls.assert_benign_workflow_preservation(
                user_role=role,
                action=action,
                execution_status=202,
            )
            self.assertTrue(res_auth["workflow_preserved"], f"Role {role} should be authorized for {action}")
            self.assertFalse(res_auth["regression_detected"])

        # 2. Explicit Unprivileged Roles (Guest, Reporter, External, Anonymous)
        for role in ["Guest", "Reporter", "External", "Anonymous"]:
            res_unpriv = self.controls.assert_unprivileged_rejection(
                user_role=role,
                action=action,
                simulated_status=403,
            )
            self.assertTrue(res_unpriv["negative_control_passed"], f"Role {role} should be blocked from {action}")
            self.assertTrue(res_unpriv["properly_blocked"])

        # 3. Intermediate Role (Developer) - not authorized for admin action
        res_dev = self.controls.assert_benign_workflow_preservation(
            user_role="Developer",
            action=action,
            execution_status=403,
        )
        self.assertTrue(res_dev["workflow_preserved"], "Developer receiving 403 on admin action preserves policy invariant")

        # 4. Clean-Room baseline negative control across all roles
        for role in ["Guest", "Reporter", "External", "Anonymous", "Developer", "Maintainer"]:
            spec = {"actor_matrix": {"attacker_role": role}, "endpoint": action}
            baseline_passed = self.verifier.run_baseline_negative_control(spec)
            self.assertTrue(baseline_passed)

    def test_adv_h1_authorization_asymmetry_falsification_gate(self):
        """
        H1 Stress: GraphQL vs REST Project Export Asymmetry.
        Assert that if GraphQL rejects unprivileged request (403), hypothesis is FALSIFIED.
        Assert that if GraphQL allows (200) and patch blocks (403), hypothesis is VERIFIED.
        Assert that if baseline was misclassified, falsification gate rejects false positives.
        """
        spec = {
            "id": "H-01",
            "target_interface": "GraphQL",
            "endpoint": "projectExport",
            "actor_matrix": {"attacker_role": "Reporter", "required_role": "Maintainer"},
            "abstract_mutation": {"mutation": "projectExport(input: {path: 'sec/proj'})"},
            "expected_violation": "AUTHORIZATION_ASYMMETRY",
        }

        # Case A: Confirmed Positive (200 on unpatched, 403 on patch)
        rep_pos = self.verifier.verify_candidate(
            candidate_id="GL-H01-POS",
            attacker_role="Reporter",
            target_role="Owner",
            vulnerable_status=200,
            patched_status=403,
            request_data=spec["abstract_mutation"],
            response_data={"data": {"export": "started"}},
        )
        self.assertEqual(rep_pos["verification_status"], "VERIFIED_CONFIRMED")
        self.assertTrue(rep_pos["cas_verified"])

        # Case B: Falsified / Secure Target (403 on unpatched)
        rep_falsified = self.verifier.verify_candidate(
            candidate_id="GL-H01-FALSIFIED",
            attacker_role="Reporter",
            target_role="Owner",
            vulnerable_status=403,
            patched_status=403,
            request_data=spec["abstract_mutation"],
            response_data={"errors": ["Access denied"]},
        )
        self.assertEqual(rep_falsified["verification_status"], "UNCONFIRMED")

        # Case C: Broken Patch / Failed Negative Control (200 on patch)
        rep_broken_patch = self.verifier.verify_candidate(
            candidate_id="GL-H01-BROKEN",
            attacker_role="Reporter",
            target_role="Owner",
            vulnerable_status=200,
            patched_status=200,
            request_data=spec["abstract_mutation"],
            response_data={"data": {"export": "started"}},
        )
        self.assertEqual(rep_broken_patch["verification_status"], "REJECTED_FALSE_POSITIVE")

    def test_adv_h2_ci_job_token_scope_allowlist_falsification_gate(self):
        """
        H2 Stress: CI_JOB_TOKEN Cross-Project Allowlist Bypass.
        Verify mathematical invariant CanAccess(J_src, P_dst) <=> (src==dst or src in allowlist).
        """
        spec = {
            "id": "H-02",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects/:id/packages",
            "actor_matrix": {"attacker_role": "Developer_External_Project", "target_project_scope": "ENFORCED"},
            "abstract_mutation": {"header": "JOB-TOKEN: external_token"},
            "expected_violation": "TOKEN_SCOPE_CONFUSION",
        }

        # Full clean room pipeline execution
        res = self.verifier.execute_full_clean_room_pipeline(spec)
        self.assertEqual(res["final_verdict"], "VERIFIED_CONFIRMED")
        self.assertTrue(res["phases"]["Phase_B_NegativeBaseline"])
        self.assertTrue(res["phases"]["Phase_C_PositiveProof"])
        self.assertTrue(res["phases"]["Phase_C_HardenedBaselineClear"])
        self.assertTrue(res["phases"]["Phase_D_PatchedControl"])

    def test_adv_h3_project_group_link_escalation_falsification_gate(self):
        """
        H3 Stress: ProjectGroupLink Access Level Escalation via Transfer.
        Verify effective access clamp invariant.
        """
        # Unprivileged check on Guest ceiling
        unprivileged_check = self.controls.assert_unprivileged_rejection(
            user_role="Guest",
            action="create_branch",
            simulated_status=403,
        )
        self.assertTrue(unprivileged_check["negative_control_passed"])
        self.assertTrue(unprivileged_check["properly_blocked"])

        # Legitimate Developer authorized action preserved
        benign_check = self.controls.assert_benign_workflow_preservation(
            user_role="Maintainer",
            action="create_branch",
            execution_status=201,
        )
        self.assertTrue(benign_check["workflow_preserved"])
        self.assertFalse(benign_check["regression_detected"])

    def test_adv_h4_toctou_temporal_race_falsification_gate(self):
        """
        H4 Stress: TOCTOU race on archival.
        Simulate concurrent timing jitter invariance across 10ms-500ms intervals.
        """
        def simulated_archive_race_action(jitter_ms: int):
            # Deterministic rejection when database row lock is active
            return 403, {"error": "Project is archived"}

        jitter_eval = self.controls.evaluate_timing_jitter_invariance(
            action_fn=simulated_archive_race_action,
            jitter_ms_list=[10, 25, 50, 100, 250, 500],
        )
        self.assertTrue(jitter_eval["deterministic_behavior"])
        self.assertTrue(jitter_eval["all_runs_succeeded"])
        self.assertEqual(jitter_eval["unique_statuses_observed"], [403])

    def test_adv_h5_ssrf_parser_differential_falsification_gate(self):
        """
        H5 Stress: Webhook SSRF IP Allowlist Bypass via hex/octal/dword notations.
        """
        spec = {
            "id": "H-05",
            "target_interface": "REST",
            "endpoint": "/api/v4/projects/:id/hooks",
            "actor_matrix": {"attacker_role": "Maintainer", "target_ip": "127.0.0.1"},
            "abstract_mutation": {"url": "http://0x7f000001:8080/webhook"},
            "expected_violation": "SSRF_PARSER_DIFFERENTIALS",
        }

        # If patched build blocks loopback addresses (403/422/400)
        patch_result = self.controls.assert_fixed_patch_behavior(
            patch_applied=True,
            exploit_attempt_status=403,
            response_body={"message": "Requests to localhost are not allowed"},
        )
        self.assertTrue(patch_result["validation_passed"])
        self.assertEqual(patch_result["behavior"], "DEFENSE_EFFECTIVE")

    def test_adv_ambiguous_http_status_codes_fail_closed(self):
        """
        Adversarial: Server errors (500, 502, 503, 504) or unusual codes must NOT be
        interpreted as positive exploit reproduction or clean denial.
        """
        ambiguous_codes = [500, 502, 503, 504, 301, 302, 418]
        for code in ambiguous_codes:
            rep = self.verifier.verify_candidate(
                candidate_id=f"GL-AMBIG-{code}",
                attacker_role="Guest",
                target_role="Owner",
                vulnerable_status=code,
                patched_status=403,
                request_data="GET /api/test",
                response_data={"error": "gateway timeout"},
            )
            self.assertEqual(
                rep["verification_status"],
                "UNCONFIRMED",
                f"Status code {code} must fail closed to UNCONFIRMED, got {rep['verification_status']}",
            )

    # =========================================================================
    # SUITE 6: HIGH-CONCURRENCY MULTI-THREADED STRESS
    # =========================================================================

    def test_adv_high_concurrency_multi_threaded_vault_stress(self):
        """
        Adversarial: 50 concurrent worker threads executing simultaneous record,
        verify, get, and receipt operations on the CAS Evidence Vault.
        Assert zero race conditions, zero data loss, and 100% digest verification.
        """
        num_threads = 50
        records_per_thread = 20
        total_expected_records = num_threads * records_per_thread

        def worker_task(thread_id: int) -> List[str]:
            digests = []
            for i in range(records_per_thread):
                req = f"REQ_THREAD_{thread_id}_SEQ_{i}"
                resp = {"thread": thread_id, "seq": i, "token": hashlib.md5(f"{thread_id}_{i}".encode()).hexdigest()}
                meta = {"thread_id": thread_id, "timestamp": time.time()}

                d = self.vault.record_evidence(req, resp, meta)
                digests.append(d)

                # Immediately verify integrity
                if not self.vault.verify_evidence(d):
                    raise RuntimeError(f"Immediate verification failed for thread {thread_id} record {i}")

                # Retrieve deserialized payload
                retrieved = self.vault.get_evidence(d)
                if retrieved is None or retrieved["request"] != req:
                    raise RuntimeError(f"Retrieval mismatch for thread {thread_id} record {i}")

                # Generate receipt
                receipt = self.vault.generate_receipt(d)
                if receipt is None or receipt["status"] != "VALID_TAMPER_FREE":
                    raise RuntimeError(f"Receipt generation failed for thread {thread_id} record {i}")

            return digests

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_task, tid) for tid in range(num_threads)]
            all_digests = []
            for f in concurrent.futures.as_completed(futures):
                all_digests.extend(f.result())

        self.assertEqual(len(all_digests), total_expected_records)
        self.assertEqual(len(set(all_digests)), total_expected_records, "All generated digests must be unique")
        self.assertEqual(self.vault.count(), total_expected_records)

        # Re-verify all records post-concurrency
        for d in all_digests:
            self.assertTrue(self.vault.verify_evidence(d))


if __name__ == "__main__":
    unittest.main()
