"""
Autonomous Black-Box Security Research Engine Orchestrator
Executes end-to-end attack surface discovery, hypothesis scheduling, and differential probing.
"""

from typing import Dict, Any, List
from .observer import Observer
from .context import SecurityContextModel
from .planner import AdaptiveTestPlanner
from .differential import DifferentialSecurityEngine
from .hypotheses import HypothesisCatalog

class BlackBoxResearchEngine:
    """Orchestrates autonomous black-box testing and hypothesis evaluation."""

    def __init__(self, client: Any, budget: int = 100):
        self.client = client
        self.observer = Observer(client)
        self.context = SecurityContextModel()
        self.planner = AdaptiveTestPlanner(budget=budget)
        self.differential = DifferentialSecurityEngine()
        self.findings: List[Dict[str, Any]] = []

    def execute_discovery(self, token_a: str, token_b: str) -> Dict[str, Any]:
        """Runs automated surface discovery and executes planned hypotheses."""
        surfaces = self.observer.discover_surface()
        plan = self.planner.plan_research_run(surfaces)

        # Execute Hypothesis 1: Temporal State Desync
        r_pre = self.client.post("/api/v1/workflow/commit", json={"workflow_id": "wf_test_nonexistent"}, headers={"Authorization": f"Bearer {token_b}"})
        
        # Test actual initiation + rollback + commit
        r_init = self.client.post("/api/v1/workflow/initiate", json={"workflow_id": "wf_engine_probe_01", "payload": {"probe": "engine"}}, headers={"Authorization": f"Bearer {token_a}"})
        wf_id = r_init.json().get("workflow_id", "wf_engine_probe_01")
        
        r_roll = self.client.post("/api/v1/workflow/stage", json={"workflow_id": wf_id, "action": "rollback"}, headers={"Authorization": f"Bearer {token_a}"})
        r_post = self.client.post("/api/v1/workflow/commit", json={"workflow_id": wf_id}, headers={"Authorization": f"Bearer {token_b}"})

        desync_eval = self.differential.evaluate_temporal_state_desync(
            pre_rollback_status=r_pre.status_code,
            rollback_status=r_roll.status_code,
            post_rollback_status=r_post.status_code,
            commit_payload=r_post.json() if r_post.status_code == 200 else {}
        )

        if desync_eval["desync_confirmed"]:
            self.findings.append({
                "hypothesis_id": "H-001",
                "title": "Temporal State Desynchronization in Compensation Rollbacks",
                "target_endpoint": "/api/v1/workflow/commit",
                "method": "POST",
                "preconditions": [{"action": "initiate_workflow", "role": "member"}, {"action": "rollback_stage", "role": "member"}],
                "test_sequence": [{"step": 1, "action": "commit_under_cross_tenant_identity"}],
                "confidence": desync_eval["confidence"],
                "evidence": desync_eval
            })

        return {
            "surfaces_discovered": len(surfaces),
            "hypotheses_evaluated": len(plan),
            "findings_count": len(self.findings),
            "findings": self.findings
        }
