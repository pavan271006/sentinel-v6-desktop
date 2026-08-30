import sys
import os
import json
import hashlib

sys.path.insert(0, r"c:\Users\Legion 5 pro\Desktop\cyber sec")

from gitlab_research_lab.verifier.cas_evidence_vault import CASEvidenceVault
from gitlab_research_lab.verifier.negative_controls import NegativeControlTester
from gitlab_research_lab.verifier.clean_room_verifier import CleanRoomVerifier

print("Running Independent Verifier Forensics...")

# 1. CAS Evidence Vault Checks
vault = CASEvidenceVault()
req = {"endpoint": "/api/v4/projects/101/export", "method": "POST", "body": None}
resp = {"status": 202, "msg": "Export queued"}
meta = {"spec_id": "H-01", "actor": "maintainer"}

digest = vault.record_evidence(req, resp, meta)
print(f"Recorded digest: {digest}")
assert len(digest) == 64, "Digest length must be 64"
assert vault.verify_evidence(digest) is True, "Verification of valid digest must succeed"

# Tamper test
raw_bytes = vault.get_raw_payload(digest)
tampered_bytes = bytearray(raw_bytes)
tampered_bytes[5] ^= 0x55
vault.vault[digest] = bytes(tampered_bytes)
assert vault.verify_evidence(digest) is False, "Verification of tampered evidence must fail"
print("CAS Tamper Detection: PASS")

# Restore valid bytes
vault.vault[digest] = raw_bytes
receipt = vault.generate_receipt(digest)
assert receipt["status"] == "VALID_TAMPER_FREE", "Receipt status must be valid"
print("CAS Receipt Generation: PASS")

# 2. Negative Controls Checks
controls = NegativeControlTester()

# Unprivileged actor
res_unprivileged = controls.assert_unprivileged_rejection("Guest", "export_project", 403)
assert res_unprivileged["negative_control_passed"] is True, "Guest rejection must pass"

res_unprivileged_leak = controls.assert_unprivileged_rejection("Guest", "export_project", 200)
assert res_unprivileged_leak["negative_control_passed"] is False, "Guest 200 on protected action must fail negative control"

# Fixed patch behavior
res_patch_effective = controls.assert_fixed_patch_behavior(patch_applied=True, exploit_attempt_status=403)
assert res_patch_effective["behavior"] == "DEFENSE_EFFECTIVE"
assert res_patch_effective["validation_passed"] is True

res_patch_bypass = controls.assert_fixed_patch_behavior(patch_applied=True, exploit_attempt_status=200)
assert res_patch_bypass["behavior"] == "PATCH_BYPASS_DETECTED"
assert res_patch_bypass["validation_passed"] is False

# Benign workflow preservation
res_benign_ok = controls.assert_benign_workflow_preservation("Maintainer", "export_project", 202)
assert res_benign_ok["workflow_preserved"] is True

res_benign_broken = controls.assert_benign_workflow_preservation("Maintainer", "export_project", 500)
assert res_benign_broken["workflow_preserved"] is False

# Falsification gate
assert controls.evaluate_candidate_falsification_gate(True, True) == "VERIFIED_POSITIVE"
assert controls.evaluate_candidate_falsification_gate(True, False) == "REJECTED_FALSE_POSITIVE"
assert controls.evaluate_candidate_falsification_gate(False, True) == "UNCONFIRMED"
print("Negative Controls Logic: PASS")

# 3. Clean-Room Verifier Checks
verifier = CleanRoomVerifier()

spec_h1 = {
    "id": "SPEC-H01",
    "target_interface": "GraphQL",
    "endpoint": "/api/graphql",
    "actor_matrix": {"attacker_role": "Reporter", "victim_role": "Owner"},
    "abstract_mutation": {
        "query": "mutation { projectExport(input: { projectPath: \"group/priv\" }) { errors } }"
    },
    "expected_violation": "AUTHORIZATION_ASYMMETRY",
}

pipeline_res = verifier.execute_full_clean_room_pipeline(spec_h1)
assert pipeline_res["final_verdict"] == "VERIFIED_CONFIRMED", f"Pipeline failed: {pipeline_res}"
assert pipeline_res["phases"]["Phase_A_Provision"] is True
assert pipeline_res["phases"]["Phase_B_NegativeBaseline"] is True
assert pipeline_res["phases"]["Phase_C_PositiveProof"] is True
assert pipeline_res["phases"]["Phase_C_HardenedBaselineClear"] is True
assert pipeline_res["phases"]["Phase_D_PatchedControl"] is True
assert pipeline_res["phases"]["Phase_E_AdversarialJitter"] is True
print("Clean-Room Verifier Pipeline: PASS")

# Candidate verification method
cand_res = verifier.verify_candidate(
    candidate_id="GL-CAND-2026-001",
    attacker_role="Reporter",
    target_role="Maintainer",
    vulnerable_status=200,
    patched_status=403,
    request_data={"mutation": "export"},
    response_data={"status": "exported"},
)
assert cand_res["positive_reproduced"] is True
assert cand_res["negative_control_passed"] is True
assert cand_res["verification_status"] == "VERIFIED_CONFIRMED"
assert cand_res["cas_verified"] is True
print("Candidate Verification: PASS")

print("ALL INDEPENDENT FORENSIC VERIFIER CHECKS PASSED.")
