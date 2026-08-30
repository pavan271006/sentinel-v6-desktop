"""
Standalone CLI Vulnerability Scanner: Temporal State Desynchronization Engine (TSDE)
Zero-dependency, standalone defensive vulnerability detection and verification tool.
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error
import time
from typing import Dict, Any, Tuple, Optional

class TSDEScanner:
    def __init__(self, target_url: str, request_budget: int = 50):
        self.target_url = target_url.rstrip("/")
        self.request_budget = request_budget
        self.requests_sent = 0

    def _http_request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, token: Optional[str] = None) -> Tuple[int, Dict[str, Any]]:
        if self.requests_sent >= self.request_budget:
            raise RuntimeError("Request budget exceeded")
        self.requests_sent += 1

        url = f"{self.target_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode("utf-8")
                try:
                    return resp.status, json.loads(raw)
                except Exception:
                    return resp.status, {"raw": raw}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                return e.code, json.loads(raw)
            except Exception:
                return e.code, {"raw": raw}
        except Exception as e:
            return 599, {"error": str(e)}

    def scan_temporal_desync(
        self,
        token_a: str,
        token_b: str,
        init_path: str = "/api/v1/workflow/initiate",
        stage_path: str = "/api/v1/workflow/stage",
        commit_path: str = "/api/v1/workflow/commit",
        workflow_id: Optional[str] = None
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        wf_id = workflow_id or f"wf_scan_{int(time.time()*1000)}"

        # Step 1: Initiate under Identity A
        s_init, r_init = self._http_request("POST", init_path, {"workflow_id": wf_id, "payload": {"probe": "tsde"}}, token=token_a)
        
        # Step 2: Negative control baseline (Direct access under Identity B)
        s_pre, r_pre = self._http_request("POST", commit_path, {"workflow_id": wf_id}, token=token_b)

        # Step 3: Trigger intermediate compensation (Rollback) under Identity A
        s_roll, r_roll = self._http_request("POST", stage_path, {"workflow_id": wf_id, "action": "rollback"}, token=token_a)

        # Step 4: Re-attempt commit under Identity B
        s_post, r_post = self._http_request("POST", commit_path, {"workflow_id": wf_id}, token=token_b)
        t1 = time.perf_counter()

        is_vulnerable = (
            s_pre in [401, 403, 404] and
            s_roll in [200, 201, 202] and
            s_post in [200, 201, 202] and
            r_post.get("status") == "APPROVED_AND_EXECUTED"
        )

        return {
            "target": self.target_url,
            "workflow_id": wf_id,
            "vulnerability_detected": is_vulnerable,
            "confidence": 0.98 if is_vulnerable else 0.0,
            "requests_used": self.requests_sent,
            "elapsed_ms": round((t1 - t0) * 1000, 2),
            "telemetry": {
                "pre_rollback_status": s_pre,
                "rollback_status": s_roll,
                "post_rollback_status": s_post,
                "post_rollback_body": r_post
            }
        }

def main():
    parser = argparse.ArgumentParser(description="TSDE Scanner - Temporal State Desynchronization Detector")
    parser.add_argument("--url", default="http://127.0.0.1:8802", help="Target API URL")
    parser.add_argument("--token-a", required=True, help="Bearer token for Identity A (Owner)")
    parser.add_argument("--token-b", required=True, help="Bearer token for Identity B (Attacker)")
    parser.add_argument("--json", action="store_true", help="Output JSON")

    args = parser.parse_args()
    scanner = TSDEScanner(args.url)
    res = scanner.scan_temporal_desync(args.token_a, args.token_b)

    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"=== TSDE SCAN REPORT: {args.url} ===")
        print(f"Vulnerability Detected: {res['vulnerability_detected']}")
        print(f"Confidence: {res['confidence']}")
        print(f"Elapsed: {res['elapsed_ms']}ms")
        print(f"Requests: {res['requests_used']}")

    sys.exit(0 if res["vulnerability_detected"] else 1)

if __name__ == "__main__":
    main()
