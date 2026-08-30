"""
Dual-Oracle Fixture Test Runner
Executes comprehensive ground-truth vulnerability verification and fixed negative control validation.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from fastapi.testclient import TestClient
from lab.ground_truth.app import create_ground_truth_app
from lab.ground_truth.auth import create_unsigned_none_token
from lab.fixed_controls.app import create_fixed_controls_app
from lab.registry import get_all_fixtures

def get_token(client: TestClient, username: str = "alice", password: str = "password123") -> str:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]

def run_tests():
    print("============================================================")
    print("RUNNING DUAL-ORACLE LABORATORY FIXTURE TESTS (M2)")
    print("============================================================")

    gt_app = create_ground_truth_app(db_path=":memory:")
    fc_app = create_fixed_controls_app(db_path=":memory:")
    gt_client = TestClient(gt_app)
    fc_client = TestClient(fc_app)

    fixtures = get_all_fixtures()
    results = []

    for f in fixtures:
        print(f"Testing {f.id}: {f.name}...")
        
        # Test 1: SQL Injection
        if f.id == "LAB-SQLI-001":
            token_gt = get_token(gt_client, "alice")
            r_gt = gt_client.get("/api/v1/search?q=' OR 1=1 --", headers={"Authorization": f"Bearer {token_gt}"})
            assert r_gt.status_code == 200 and len(r_gt.json().get("invoices", [])) > 2
            
            token_fc = get_token(fc_client, "alice")
            r_fc = fc_client.get("/api/v1/search?q=' OR 1=1 --", headers={"Authorization": f"Bearer {token_fc}"})
            assert r_fc.status_code == 200 and len(r_fc.json().get("invoices", [])) == 0
            results.append((f.id, "PASS"))

        # Test 2: XSS
        elif f.id == "LAB-XSS-001":
            token_gt = get_token(gt_client, "alice")
            r_gt = gt_client.get("/api/v1/preview?template=<script>alert(1)</script>", headers={"Authorization": f"Bearer {token_gt}"})
            assert "<script>alert(1)</script>" in r_gt.text
            
            token_fc = get_token(fc_client, "alice")
            r_fc = fc_client.get("/api/v1/preview?template=<script>alert(1)</script>", headers={"Authorization": f"Bearer {token_fc}"})
            assert "<script>" not in r_fc.text and "&lt;script&gt;" in r_fc.text
            results.append((f.id, "PASS"))

        # Test 3: BOLA / IDOR
        elif f.id == "LAB-BOLA-001":
            token_gt_charlie = get_token(gt_client, "charlie") # Charlie is org_beta
            r_gt = gt_client.get("/api/v1/invoices/1", headers={"Authorization": f"Bearer {token_gt_charlie}"}) # Inv 1 is org_alpha
            assert r_gt.status_code == 200 and r_gt.json().get("tenant_id") == "org_alpha"

            token_fc_charlie = get_token(fc_client, "charlie")
            r_fc = fc_client.get("/api/v1/invoices/1", headers={"Authorization": f"Bearer {token_fc_charlie}"})
            assert r_fc.status_code in [403, 404]
            results.append((f.id, "PASS"))

        # Test 4: BFLA
        elif f.id == "LAB-BFLA-001":
            token_gt_bob = get_token(gt_client, "bob") # Bob is member
            r_gt = gt_client.post("/api/v1/admin/promote", json={"username": "bob", "new_role": "admin"}, headers={"Authorization": f"Bearer {token_gt_bob}"})
            assert r_gt.status_code == 200

            token_fc_bob = get_token(fc_client, "bob")
            r_fc = fc_client.post("/api/v1/admin/promote", json={"username": "bob", "new_role": "admin"}, headers={"Authorization": f"Bearer {token_fc_bob}"})
            assert r_fc.status_code == 403
            results.append((f.id, "PASS"))

        # Test 5: TOCTOU
        elif f.id == "LAB-TOCTOU-001":
            token_gt = get_token(gt_client, "bob")
            r1 = gt_client.post("/api/v1/transfer", json={"recipient": "alice", "amount": 50.0}, headers={"Authorization": f"Bearer {token_gt}"})
            assert r1.status_code == 200
            
            token_fc = get_token(fc_client, "bob")
            r_fc = fc_client.post("/api/v1/transfer", json={"recipient": "alice", "amount": 99999.0}, headers={"Authorization": f"Bearer {token_fc}"})
            assert r_fc.status_code == 400
            results.append((f.id, "PASS"))

        # Test 6: JWT None Alg
        elif f.id == "LAB-JWT-001":
            none_token = create_unsigned_none_token("u_alpha_admin", "alice", "org_alpha", "admin")
            r_gt = gt_client.get("/api/v1/secure-vault", headers={"Authorization": f"Bearer {none_token}"})
            assert r_gt.status_code == 200

            r_fc = fc_client.get("/api/v1/secure-vault", headers={"Authorization": f"Bearer {none_token}"})
            assert r_fc.status_code in [401, 403]
            results.append((f.id, "PASS"))

        # Test 7: SSRF
        elif f.id == "LAB-SSRF-001":
            token_gt = get_token(gt_client, "alice")
            r_gt = gt_client.post("/api/v1/webhooks/test", json={"target_url": "http://127.0.0.1:80/internal"}, headers={"Authorization": f"Bearer {token_gt}"})
            assert r_gt.status_code in [200, 502] # Allowed trigger

            token_fc = get_token(fc_client, "alice")
            r_fc = fc_client.post("/api/v1/webhooks/test", json={"target_url": "http://127.0.0.1:80/internal"}, headers={"Authorization": f"Bearer {token_fc}"})
            assert r_fc.status_code in [400, 403]
            results.append((f.id, "PASS"))

        # Test 8: State Machine Desynchronization (LAB-DESYNC-001 / CAND-001 / H-006)
        elif f.id in ["LAB-DESYNC-001", "CAND-001"]:
            token_gt_bob = get_token(gt_client, "bob") # org_alpha
            token_gt_charlie = get_token(gt_client, "charlie") # org_beta
            
            # Step 1: Bob initiates
            wf_id = "wf_desync_test_001"
            r_init = gt_client.post("/api/v1/workflow/initiate", json={"workflow_id": wf_id, "payload": {"contract": "secret_merger"}}, headers={"Authorization": f"Bearer {token_gt_bob}"})
            assert r_init.status_code == 200
            
            # Step 2: Bob rollbacks
            r_roll = gt_client.post("/api/v1/workflow/stage", json={"workflow_id": wf_id, "action": "rollback"}, headers={"Authorization": f"Bearer {token_gt_bob}"})
            assert r_roll.status_code == 200
            
            # Step 3: Charlie hijacks commit
            r_hijack = gt_client.post("/api/v1/workflow/commit", json={"workflow_id": wf_id}, headers={"Authorization": f"Bearer {token_gt_charlie}"})
            assert r_hijack.status_code == 200 and r_hijack.json().get("status") == "APPROVED_AND_EXECUTED"

            # Fixed Control test
            token_fc_bob = get_token(fc_client, "bob")
            token_fc_charlie = get_token(fc_client, "charlie")
            wf_id_fc = "wf_desync_fc_001"
            r_init_fc = fc_client.post("/api/v1/workflow/initiate", json={"workflow_id": wf_id_fc, "payload": {"contract": "secret_merger"}}, headers={"Authorization": f"Bearer {token_fc_bob}"})
            assert r_init_fc.status_code == 200
            r_roll_fc = fc_client.post("/api/v1/workflow/stage", json={"workflow_id": wf_id_fc, "action": "rollback"}, headers={"Authorization": f"Bearer {token_fc_bob}"})
            assert r_roll_fc.status_code == 200
            r_hijack_fc = fc_client.post("/api/v1/workflow/commit", json={"workflow_id": wf_id_fc}, headers={"Authorization": f"Bearer {token_fc_charlie}"})
            assert r_hijack_fc.status_code == 403
            results.append((f.id, "PASS"))

    print("============================================================")
    print(f"DUAL-ORACLE FIXTURES PASSED: {len(results)}/{len(fixtures)}")
    print("============================================================")
    return len(results) == len(fixtures)

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
