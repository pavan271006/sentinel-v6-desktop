"""
Zero-Day Discovery Research Gate: Independent Verifier Harness
Role: VERIFIER (Independent from RESEARCHER)
Executes independent reproduction, negative controls, and boundary validation.
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
import urllib.error

LAB_SCRIPT = os.path.join(os.path.dirname(__file__), "app.py")
BASE_URL = "http://127.0.0.1:8889"

def start_lab_process(mode="vulnerable", port=8889):
    env = os.environ.copy()
    env["LAB_MODE"] = mode
    env["LAB_PORT"] = str(port)
    proc = subprocess.Popen(
        [sys.executable, LAB_SCRIPT, f"--mode={mode}", f"--port={port}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    # Wait for server ready
    for _ in range(30):
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/api/health")
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.1)
    return proc

def http_post(path, data, token=None, base_url=None):
    if base_url is None:
        base_url = BASE_URL
    url = f"{base_url}{path}"
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}

def http_get(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}

def run_independent_verification():
    print("============================================================")
    print("STARTING INDEPENDENT VERIFICATION GATE (CAND-001 / H-006)")
    print("============================================================")
    results = {}

    # TEST 1: POSITIVE CONTROL (Vulnerable Mode)
    print("[1/3] Testing Positive Control against VULNERABLE target...")
    vuln_proc = start_lab_process(mode="vulnerable", port=8889)
    try:
        # Auth Alice (Tenant A)
        _, alice_auth = http_post("/api/auth/login", {"username": "alice_admin", "password": "pass123"})
        token_a = alice_auth["token"]
        
        # Auth Bob (Tenant B)
        _, bob_auth = http_post("/api/auth/login", {"username": "bob_user", "password": "pass123"})
        token_b = bob_auth["token"]

        # Step 1: Alice initiates workflow
        s_init, r_init = http_post("/api/workflow/initiate", {"payload": {"test": "high_security_transfer"}}, token_a)
        wf_id = r_init.get("workflow_id")
        assert s_init == 201, f"Failed to initiate workflow: {r_init}"

        # Baseline check: Direct unauthorized commit should fail before rollback
        s_direct, _ = http_post("/api/workflow/commit", {"workflow_id": wf_id}, token_b)
        assert s_direct == 403, f"Expected 403 on direct BOLA, got {s_direct}"

        # Step 2: Trigger async rollback
        s_roll, r_roll = http_post("/api/workflow/stage", {"workflow_id": wf_id, "action": "rollback"}, token_a)
        assert s_roll == 200, f"Failed rollback: {r_roll}"
        assert r_roll.get("status") == "STAGED_AWAITING_RETRY"

        # Step 3: Bob hijacks commit post-rollback
        s_hijack, r_hijack = http_post("/api/workflow/commit", {"workflow_id": wf_id}, token_b)
        assert s_hijack == 200, f"Expected 200 on hijack commit, got {s_hijack}"
        assert r_hijack.get("status") == "APPROVED_AND_EXECUTED"
        assert r_hijack.get("original_tenant") == "tenant_a"
        assert r_hijack.get("executing_actor") == "bob_user"

        print("  --> Positive Control Result: REPRODUCED (Exploit succeeded on vulnerable target)")
        results["positive_control"] = "PASS_EXPLOITED"
    finally:
        vuln_proc.terminate()
        vuln_proc.wait()

    # TEST 2: NEGATIVE CONTROL (Fixed Mode)
    print("[2/3] Testing Negative Control against FIXED target...")
    time.sleep(0.5)
    fixed_proc = start_lab_process(mode="fixed", port=8889)
    try:
        # Auth Alice & Bob
        _, alice_auth = http_post("/api/auth/login", {"username": "alice_admin", "password": "pass123"})
        token_a = alice_auth["token"]
        _, bob_auth = http_post("/api/auth/login", {"username": "bob_user", "password": "pass123"})
        token_b = bob_auth["token"]

        # Alice initiates
        s_init, r_init = http_post("/api/workflow/initiate", {"payload": {"test": "fixed_transfer"}}, token_a)
        wf_id = r_init.get("workflow_id")
        assert s_init == 201

        # Alice triggers rollback
        s_roll, r_roll = http_post("/api/workflow/stage", {"workflow_id": wf_id, "action": "rollback"}, token_a)
        assert s_roll == 200

        # Bob attempts hijack commit post-rollback on fixed target
        s_hijack, r_hijack = http_post("/api/workflow/commit", {"workflow_id": wf_id}, token_b)
        assert s_hijack == 403, f"Expected 403 on fixed target, got {s_hijack}: {r_hijack}"

        print("  --> Negative Control (Fixed) Result: PASS (Fixed target safely blocked exploit)")
        results["negative_control_fixed"] = "PASS_BLOCKED"
    finally:
        fixed_proc.terminate()
        fixed_proc.wait()

    # TEST 3: NEGATIVE CONTROL (Benign Normal Flow)
    print("[3/3] Testing Negative Control (Benign Normal Execution)...")
    time.sleep(0.5)
    benign_proc = start_lab_process(mode="fixed", port=8889)
    try:
        _, alice_auth = http_post("/api/auth/login", {"username": "alice_admin", "password": "pass123"})
        token_a = alice_auth["token"]

        s_init, r_init = http_post("/api/workflow/initiate", {"payload": {"test": "normal"}}, token_a)
        wf_id = r_init["workflow_id"]
        
        s_adv, r_adv = http_post("/api/workflow/stage", {"workflow_id": wf_id, "action": "advance"}, token_a)
        assert s_adv == 200

        s_com, r_com = http_post("/api/workflow/commit", {"workflow_id": wf_id}, token_a)
        assert s_com == 200 and r_com.get("status") == "APPROVED_AND_EXECUTED"

        print("  --> Negative Control (Benign) Result: PASS (Normal operations undisturbed)")
        results["negative_control_benign"] = "PASS_NORMAL"
    finally:
        benign_proc.terminate()
        benign_proc.wait()

    print("============================================================")
    print(f"VERIFICATION SUMMARY: {json.dumps(results, indent=2)}")
    print("VERDICT: CAND-001 INDEPENDENT REPRODUCTION CONFIRMED")
    print("============================================================")
    return results

if __name__ == "__main__":
    res = run_independent_verification()
    all_pass = (
        res.get("positive_control") == "PASS_EXPLOITED" and
        res.get("negative_control_fixed") == "PASS_BLOCKED" and
        res.get("negative_control_benign") == "PASS_NORMAL"
    )
    sys.exit(0 if all_pass else 1)
