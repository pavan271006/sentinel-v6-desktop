"""
Temporal State Desynchronization Engine (TSDE) - Core Implementation
Zero-dependency, standalone defensive vulnerability detection and verification engine.
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

class Observer:
    """Discovers and validates stateful workflow endpoints."""
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def probe_health(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.base_url}/api/health")
            with urllib.request.urlopen(req, timeout=2) as resp:
                return resp.status == 200
        except Exception:
            return False

class ExecutionEngine:
    """Safe bounded HTTP dispatcher with strict request budget."""
    def __init__(self, base_url: str, request_budget: int = 100):
        self.base_url = base_url.rstrip("/")
        self.request_budget = request_budget
        self.request_count = 0

    def dispatch(self, method: str, path: str, data: Optional[Dict[str, Any]] = None, token: Optional[str] = None) -> Tuple[int, Dict[str, Any], Dict[str, str]]:
        if self.request_count >= self.request_budget:
            raise RuntimeError(f"Request budget exceeded ({self.request_budget})")
        self.request_count += 1

        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                resp_headers = dict(resp.headers)
                raw = resp.read().decode("utf-8")
                try:
                    payload = json.loads(raw)
                except Exception:
                    payload = {"raw": raw}
                return resp.status, payload, resp_headers
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                payload = json.loads(raw)
            except Exception:
                payload = {"raw": raw}
            return e.code, payload, dict(e.headers)
        except Exception as e:
            return 599, {"error": str(e)}, {}

class DifferentialEngine:
    """Evaluates differential state authorization transitions."""
    @staticmethod
    def evaluate_desync(
        pre_rollback_code: int,
        rollback_code: int,
        post_rollback_code: int,
        post_rollback_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detects anomalous authorization state elevation:
        Pre-condition: Direct cross-tenant commit returns 403 Forbidden.
        Rollback condition: Intermediate compensation returns 200 OK.
        Post-condition: Post-rollback cross-tenant commit unexpectedly returns 200 OK.
        """
        is_vuln = (
            pre_rollback_code in [401, 403, 404] and
            rollback_code in [200, 201, 202] and
            post_rollback_code in [200, 201, 202]
        )
        
        confidence = 0.0
        if is_vuln:
            confidence = 0.95
            if post_rollback_payload.get("status") == "APPROVED_AND_EXECUTED":
                confidence = 0.99

        return {
            "vulnerability_detected": is_vuln,
            "confidence": confidence,
            "pre_rollback_code": pre_rollback_code,
            "rollback_code": rollback_code,
            "post_rollback_code": post_rollback_code,
            "payload_evidence": post_rollback_payload
        }

class TemporalStateDesyncDetector:
    """Main Scanner and Verification Pipeline."""
    def __init__(self, base_url: str, request_budget: int = 100):
        self.base_url = base_url
        self.executor = ExecutionEngine(base_url, request_budget=request_budget)
        self.observer = Observer(base_url)

    def scan_workflow(
        self,
        token_a: str,
        token_b: str,
        init_endpoint: str = "/api/workflow/initiate",
        stage_endpoint: str = "/api/workflow/stage",
        commit_endpoint: str = "/api/workflow/commit",
        workflow_id_key: str = "workflow_id"
    ) -> Dict[str, Any]:
        start_time = time.time()

        # Step 1: Identity A initiates workflow
        s_init, r_init, _ = self.executor.dispatch("POST", init_endpoint, {"payload": {"probe": "tsde_scan"}}, token=token_a)
        if s_init not in [200, 201]:
            return {"status": "ERROR", "reason": f"Failed to initiate workflow: {r_init}"}
        
        wf_id = r_init.get(workflow_id_key) or r_init.get("id")
        if not wf_id:
            return {"status": "ERROR", "reason": "Workflow ID not returned in initiation response"}

        # Step 2: Negative baseline check (Identity B direct access should be blocked)
        s_pre, r_pre, _ = self.executor.dispatch("POST", commit_endpoint, {workflow_id_key: wf_id}, token=token_b)

        # Step 3: Identity A triggers intermediate state compensation (rollback)
        s_roll, r_roll, _ = self.executor.dispatch("POST", stage_endpoint, {workflow_id_key: wf_id, "action": "rollback"}, token=token_a)

        # Step 4: Identity B re-attempts commit post-rollback
        s_post, r_post, _ = self.executor.dispatch("POST", commit_endpoint, {workflow_id_key: wf_id}, token=token_b)

        elapsed = time.time() - start_time
        diff_res = DifferentialEngine.evaluate_desync(s_pre, s_roll, s_post, r_post)

        return {
            "target": self.base_url,
            "elapsed_seconds": round(elapsed, 4),
            "requests_used": self.executor.request_count,
            "workflow_id": wf_id,
            "differential_result": diff_res
        }
