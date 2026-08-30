"""
Zero-Day Discovery Research Gate: Tool Generalization Test Suite
Tests TSDE detector across diverse state-machine architectures, parameter conventions, and endpoints.
"""

import sys
import os
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from research.desync_detector.core import TemporalStateDesyncDetector

# Secondary Target: E-Commerce Refund State Machine
class RefundServerHandler(BaseHTTPRequestHandler):
    mode = "vulnerable"
    db = {}

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        auth = self.headers.get("Authorization", "")
        tenant = "tenant_a" if "token_a" in auth else ("tenant_b" if "token_b" in auth else "anonymous")

        if self.path == "/api/v2/orders/refund/start":
            job_id = f"job-{int(time.time()*1000)}"
            RefundServerHandler.db[job_id] = {"tenant": tenant, "state": "PENDING", "lock": tenant}
            self.send_json(201, {"job_id": job_id, "state": "PENDING"})
            return

        if self.path == "/api/v2/orders/refund/revert":
            job_id = body.get("job_id")
            rec = RefundServerHandler.db.get(job_id)
            if not rec:
                self.send_json(404, {"error": "Not found"})
                return
            if RefundServerHandler.mode == "vulnerable":
                rec["lock"] = None # Dissociate lock
                rec["state"] = "REVERTED_RETRY"
                self.send_json(200, {"job_id": job_id, "state": "REVERTED_RETRY"})
            else:
                if rec["tenant"] != tenant:
                    self.send_json(403, {"error": "Forbidden"})
                    return
                rec["state"] = "REVERTED_RETRY"
                self.send_json(200, {"job_id": job_id, "state": "REVERTED_RETRY"})
            return

        if self.path == "/api/v2/orders/refund/finalize":
            job_id = body.get("job_id")
            rec = RefundServerHandler.db.get(job_id)
            if not rec:
                self.send_json(404, {"error": "Not found"})
                return
            
            if RefundServerHandler.mode == "vulnerable":
                if rec["lock"] is None:
                    rec["state"] = "APPROVED_AND_EXECUTED"
                    self.send_json(200, {"job_id": job_id, "status": "APPROVED_AND_EXECUTED", "tenant": rec["tenant"]})
                    return
                else:
                    if rec["tenant"] != tenant:
                        self.send_json(403, {"error": "Forbidden"})
                        return
                    rec["state"] = "APPROVED_AND_EXECUTED"
                    self.send_json(200, {"job_id": job_id, "status": "APPROVED_AND_EXECUTED"})
                    return
            else:
                if rec["tenant"] != tenant:
                    self.send_json(403, {"error": "Forbidden"})
                    return
                rec["state"] = "APPROVED_AND_EXECUTED"
                self.send_json(200, {"job_id": job_id, "status": "APPROVED_AND_EXECUTED"})
                return

    def log_message(self, *args):
        return

def run_generalization_tests():
    print("============================================================")
    print("RUNNING GENERALIZATION TESTS (Multi-Architecture & Endpoints)")
    print("============================================================")

    # Start mock refund server on port 8891
    server = HTTPServer(("127.0.0.1", 8891), RefundServerHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    detector = TemporalStateDesyncDetector("http://127.0.0.1:8891", request_budget=50)

    # TEST 1: Secondary E-Commerce Target - Vulnerable Mode
    print("[1/2] Testing on E-Commerce Refund State Machine (VULNERABLE)...")
    RefundServerHandler.mode = "vulnerable"
    RefundServerHandler.db.clear()
    res_vuln = detector.scan_workflow(
        token_a="token_a_alice",
        token_b="token_b_bob",
        init_endpoint="/api/v2/orders/refund/start",
        stage_endpoint="/api/v2/orders/refund/revert",
        commit_endpoint="/api/v2/orders/refund/finalize",
        workflow_id_key="job_id"
    )
    assert res_vuln["differential_result"]["vulnerability_detected"] is True, f"Failed generalization detection on vuln target: {res_vuln}"
    print("  --> Detection across secondary architecture: SUCCESS (Vulnerability Detected)")

    # TEST 2: Secondary E-Commerce Target - Fixed Mode
    print("[2/2] Testing on E-Commerce Refund State Machine (FIXED)...")
    RefundServerHandler.mode = "fixed"
    RefundServerHandler.db.clear()
    res_fixed = detector.scan_workflow(
        token_a="token_a_alice",
        token_b="token_b_bob",
        init_endpoint="/api/v2/orders/refund/start",
        stage_endpoint="/api/v2/orders/refund/revert",
        commit_endpoint="/api/v2/orders/refund/finalize",
        workflow_id_key="job_id"
    )
    assert res_fixed["differential_result"]["vulnerability_detected"] is False, f"Failed negative control on fixed target: {res_fixed}"
    print("  --> Negative control across secondary architecture: SUCCESS (Zero False Positives)")

    server.shutdown()
    print("============================================================")
    print("GENERALIZATION EVALUATION RESULT: 100% PASS")
    print("============================================================")

if __name__ == "__main__":
    run_generalization_tests()
