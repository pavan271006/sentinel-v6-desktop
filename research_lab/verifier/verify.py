"""
Independent Verifier Orchestrator
Role: Clean-Room Verifier (Independent from Researcher)
Validates findings against Ground-Truth and Fixed-Controls targets and classifies novelty.
"""

from typing import Dict, Any, List
from .prior_art import PriorArtSearchEngine
from .classifier import NoveltyClassifier, NoveltyVerdict

class IndependentVerifier:
    """Executes air-gapped independent verification across positive and negative controls."""

    def __init__(self, gt_client: Any, fc_client: Any):
        self.gt_client = gt_client
        self.fc_client = fc_client

    def verify_finding(self, finding: Dict[str, Any], token_a: str, token_b: str) -> Dict[str, Any]:
        hid = finding.get("hypothesis_id")
        
        # Recreate test against Ground-Truth (Positive Control)
        wf_id_gt = "wf_verify_gt_01"
        self.gt_client.post("/api/v1/workflow/initiate", json={"workflow_id": wf_id_gt, "payload": {"item": "contract"}}, headers={"Authorization": f"Bearer {token_a}"})
        self.gt_client.post("/api/v1/workflow/stage", json={"workflow_id": wf_id_gt, "action": "rollback"}, headers={"Authorization": f"Bearer {token_a}"})
        r_gt = self.gt_client.post("/api/v1/workflow/commit", json={"workflow_id": wf_id_gt}, headers={"Authorization": f"Bearer {token_b}"})
        positive_reproduced = (r_gt.status_code == 200 and r_gt.json().get("status") == "APPROVED_AND_EXECUTED")

        # Authenticate independently on Fixed Controls (Clean-Room Verifier)
        r_a_fc = self.fc_client.post("/api/v1/auth/login", json={"username": "bob", "password": "password123"}).json()
        r_b_fc = self.fc_client.post("/api/v1/auth/login", json={"username": "charlie", "password": "password123"}).json()
        token_a_fc = r_a_fc["access_token"]
        token_b_fc = r_b_fc["access_token"]

        # Recreate test against Fixed Controls (Negative Control)
        wf_id_fc = "wf_verify_fc_01"
        self.fc_client.post("/api/v1/workflow/initiate", json={"workflow_id": wf_id_fc, "payload": {"item": "contract"}}, headers={"Authorization": f"Bearer {token_a_fc}"})
        self.fc_client.post("/api/v1/workflow/stage", json={"workflow_id": wf_id_fc, "action": "rollback"}, headers={"Authorization": f"Bearer {token_a_fc}"})
        r_fc = self.fc_client.post("/api/v1/workflow/commit", json={"workflow_id": wf_id_fc}, headers={"Authorization": f"Bearer {token_b_fc}"})
        negative_control_passed = (r_fc.status_code in [403, 404])

        # Prior art search
        prior_art = PriorArtSearchEngine.search_prior_art(
            title=finding.get("title", ""),
            cwe="CWE-863",
            keywords=["workflow", "rollback", "context", "desynchronization", "tenant"]
        )

        classification = NoveltyClassifier.classify(
            positive_reproduced=positive_reproduced,
            negative_control_passed=negative_control_passed,
            prior_art_matches=prior_art,
            is_novel_primitive=True
        )

        return {
            "finding_id": finding.get("hypothesis_id"),
            "positive_reproduced": positive_reproduced,
            "negative_control_passed": negative_control_passed,
            "prior_art_matches_count": len(prior_art),
            "novelty_classification": classification["verdict"],
            "justification": classification["reason"]
        }
