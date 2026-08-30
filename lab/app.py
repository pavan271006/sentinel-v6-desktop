"""
Zero-Day Discovery Research Gate: Controlled Local Lab Target Application
Supports dual operating modes: --mode=vulnerable and --mode=fixed
Provides realistic multi-tenant authentication, state machines, and API endpoints.
"""

import sys
import os
import json
import sqlite3
import base64
import hmac
import hashlib
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("LAB_PORT", 8888))
MODE = os.environ.get("LAB_MODE", "vulnerable")
SECRET_KEY = b"sentinel_research_gate_secret_key_2026"

DB_LOCK = threading.Lock()

def get_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# Global shared DB in memory with thread safety
db_conn = get_db()

def init_db():
    with DB_LOCK:
        cursor = db_conn.cursor()
        cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                tenant_id TEXT,
                role TEXT,
                full_name TEXT,
                credits INTEGER,
                is_verified INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE invoices (
                id INTEGER PRIMARY KEY,
                tenant_id TEXT,
                title TEXT,
                amount REAL,
                secret_notes TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY,
                username TEXT,
                balance REAL
            )
        """)
        cursor.execute("""
            CREATE TABLE workflows (
                id TEXT PRIMARY KEY,
                tenant_id TEXT,
                initiator TEXT,
                current_stage INTEGER,
                status TEXT,
                payload TEXT,
                tenant_context_lock TEXT
            )
        """)
        
        # Seed users
        users = [
            (1, "alice_admin", "pass123", "tenant_a", "admin", "Alice Admin", 100, 1),
            (2, "alice_user", "pass123", "tenant_a", "member", "Alice Member", 50, 1),
            (3, "bob_admin", "pass123", "tenant_b", "admin", "Bob Admin", 200, 1),
            (4, "bob_user", "pass123", "tenant_b", "member", "Bob Member", 10, 1),
            (5, "mallory", "pass123", "tenant_untrusted", "member", "Mallory Attacker", 0, 0)
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)", users)
        
        # Seed invoices
        invoices = [
            (101, "tenant_a", "Q1 Financial Audit", 50000.0, "CONFIDENTIAL_TENANT_A_M&A_STRATEGY"),
            (102, "tenant_a", "Security Vendor Contract", 12000.0, "SECRET_INFRASTRUCTURE_IP_LIST"),
            (201, "tenant_b", "Office Supplies", 350.0, "TENANT_B_PUBLIC_OFFICE_EXPENSE"),
            (202, "tenant_b", "Cloud Hosting Q2", 4500.0, "TENANT_B_STANDARD_OPS")
        ]
        cursor.executemany("INSERT INTO invoices VALUES (?, ?, ?, ?, ?)", invoices)
        
        # Seed accounts
        accounts = [
            (1, "alice_admin", 1000.0),
            (2, "alice_user", 100.0),
            (3, "bob_admin", 500.0),
            (4, "bob_user", 50.0),
            (5, "mallory", 10.0)
        ]
        cursor.executemany("INSERT INTO accounts VALUES (?, ?, ?)", accounts)
        db_conn.commit()

# Lightweight JWT implementation
def create_token(payload, alg="HS256"):
    header = {"typ": "JWT", "alg": alg}
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    if alg == "none":
        return f"{h_b64}.{p_b64}."
    sig = hmac.new(SECRET_KEY, f"{h_b64}.{p_b64}".encode(), hashlib.sha256).digest()
    s_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{h_b64}.{p_b64}.{s_b64}"

def verify_token(token, mode="vulnerable"):
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        header_raw = base64.urlsafe_b64decode(parts[0] + "==").decode()
        header = json.loads(header_raw)
        payload_raw = base64.urlsafe_b64decode(parts[1] + "==").decode()
        payload = json.loads(payload_raw)
        
        alg = header.get("alg", "HS256")
        
        if mode == "vulnerable":
            # FIX-005: Vulnerable accepts 'none' algorithm
            if alg == "none":
                return payload
            
        if alg != "HS256":
            return None
            
        if len(parts) != 3:
            return None
            
        sig_check = hmac.new(SECRET_KEY, f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig_check).decode().rstrip("=")
        if sig_b64 == parts[2]:
            return payload
        return None
    except Exception:
        return None

class LabHandler(BaseHTTPRequestHandler):
    def send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Research-Lab-Mode", MODE)
        self.end_headers()
        self.wfile.write(body)

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[7:].strip()
        return verify_token(token, mode=MODE)

    def parse_json_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # Health check
        if path == "/api/health":
            self.send_json(200, {"status": "HEALTHY", "mode": MODE, "timestamp": time.time()})
            return

        # FIX-001: Invoice Retrieval (BOLA / IDOR)
        if path.startswith("/api/invoices/"):
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            invoice_id = path.replace("/api/invoices/", "").strip()
            with DB_LOCK:
                cursor = db_conn.cursor()
                if MODE == "vulnerable":
                    # Vulnerable: fetches solely by ID without tenant scope check
                    cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
                else:
                    # Fixed: checks tenant_id constraint
                    cursor.execute("SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user.get("tenant_id")))
                row = cursor.fetchone()
                
            if row:
                self.send_json(200, {
                    "id": row["id"],
                    "tenant_id": row["tenant_id"],
                    "title": row["title"],
                    "amount": row["amount"],
                    "secret_notes": row["secret_notes"]
                })
            else:
                self.send_json(404, {"error": "Invoice not found or access denied"})
            return

        # FIX-005: Secure Vault Endpoint
        if path == "/api/secure-vault":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                self.send_json(403, {"error": "Forbidden - Administrator privilege required"})
                return
            self.send_json(200, {"message": "VAULT_ACCESS_GRANTED", "secret": "SUPER_SECRET_ADMIN_TOKEN_1337", "user": user})
            return

        # CAND-001: Query workflow status
        if path.startswith("/api/workflow/status/"):
            wf_id = path.replace("/api/workflow/status/", "").strip()
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute("SELECT * FROM workflows WHERE id = ?", (wf_id,))
                row = cursor.fetchone()
            if row:
                self.send_json(200, {
                    "id": row["id"],
                    "tenant_id": row["tenant_id"],
                    "initiator": row["initiator"],
                    "stage": row["current_stage"],
                    "status": row["status"],
                    "payload": json.loads(row["payload"]) if row["payload"] else {},
                    "lock": row["tenant_context_lock"]
                })
            else:
                self.send_json(404, {"error": "Workflow not found"})
            return

        self.send_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_json_body()

        # Login endpoint
        if path == "/api/auth/login":
            username = body.get("username")
            password = body.get("password")
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
                row = cursor.fetchone()
            if row:
                payload = {
                    "sub": row["username"],
                    "tenant_id": row["tenant_id"],
                    "role": row["role"],
                    "full_name": row["full_name"],
                    "exp": time.time() + 3600
                }
                token = create_token(payload, alg="HS256")
                self.send_json(200, {"token": token, "user": dict(row)})
            else:
                self.send_json(401, {"error": "Invalid credentials"})
            return

        # FIX-002: Administrative Role Escalation (BFLA)
        if path == "/api/admin/promote":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            if MODE == "fixed":
                # Fixed: Enforces caller is admin
                if user.get("role") != "admin":
                    self.send_json(403, {"error": "Forbidden: Requires admin role"})
                    return
            
            target_username = body.get("username", user.get("sub"))
            new_role = body.get("role", "admin")
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute("UPDATE users SET role = ? WHERE username = ?", (new_role, target_username))
                cursor.execute("SELECT * FROM users WHERE username = ?", (target_username,))
                updated = cursor.fetchone()
                db_conn.commit()
            self.send_json(200, {"message": "User role updated successfully", "user": dict(updated)})
            return

        # FIX-003: Mass Assignment in Profile Update
        if path == "/api/profile/update":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            with DB_LOCK:
                cursor = db_conn.cursor()
                if MODE == "vulnerable":
                    # Vulnerable: Unpacks arbitrary body fields directly
                    for k, v in body.items():
                        if k not in ["id", "username", "password"]:
                            cursor.execute(f"UPDATE users SET {k} = ? WHERE username = ?", (v, user.get("sub")))
                else:
                    # Fixed: Strict whitelist DTO
                    if "full_name" in body:
                        cursor.execute("UPDATE users SET full_name = ? WHERE username = ?", (body["full_name"], user.get("sub")))
                
                cursor.execute("SELECT * FROM users WHERE username = ?", (user.get("sub"),))
                updated = cursor.fetchone()
                db_conn.commit()
            self.send_json(200, {"message": "Profile updated", "user": dict(updated)})
            return

        # FIX-004: Concurrency Transfer TOCTOU Race Condition
        if path == "/api/transfer":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            amount = float(body.get("amount", 0))
            recipient = body.get("recipient")
            sender = user.get("sub")
            
            if amount <= 0:
                self.send_json(400, {"error": "Invalid amount"})
                return

            if MODE == "vulnerable":
                # Vulnerable: Non-atomic check, delay simulation, then debit
                with DB_LOCK:
                    cursor = db_conn.cursor()
                    cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
                    row = cursor.fetchone()
                    bal = row["balance"] if row else 0
                
                if bal >= amount:
                    time.sleep(0.05) # Simulate async processing window for race
                    with DB_LOCK:
                        cursor = db_conn.cursor()
                        cursor.execute("UPDATE accounts SET balance = balance - ? WHERE username = ?", (amount, sender))
                        cursor.execute("UPDATE accounts SET balance = balance + ? WHERE username = ?", (amount, recipient))
                        cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
                        new_bal = cursor.fetchone()["balance"]
                        db_conn.commit()
                    self.send_json(200, {"message": "Transfer successful", "new_balance": new_bal})
                else:
                    self.send_json(400, {"error": "Insufficient funds"})
            else:
                # Fixed: Atomic conditional update
                with DB_LOCK:
                    cursor = db_conn.cursor()
                    cursor.execute("UPDATE accounts SET balance = balance - ? WHERE username = ? AND balance >= ?", (amount, sender, amount))
                    if cursor.rowcount > 0:
                        cursor.execute("UPDATE accounts SET balance = balance + ? WHERE username = ?", (amount, recipient))
                        cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
                        new_bal = cursor.fetchone()["balance"]
                        db_conn.commit()
                        self.send_json(200, {"message": "Transfer successful", "new_balance": new_bal})
                    else:
                        db_conn.rollback()
                        self.send_json(400, {"error": "Insufficient funds"})
            return

        # CAND-001: Stateful Approval Workflow Pipeline
        # Step 1: Initiate workflow
        if path == "/api/workflow/initiate":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            wf_id = f"wf-{int(time.time()*1000)}-{os.urandom(2).hex()}"
            tenant_id = user.get("tenant_id")
            payload = json.dumps(body.get("payload", {}))
            
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute(
                    "INSERT INTO workflows VALUES (?, ?, ?, 1, 'INITIATED', ?, ?)",
                    (wf_id, tenant_id, user.get("sub"), payload, tenant_id)
                )
                db_conn.commit()
            self.send_json(201, {"workflow_id": wf_id, "stage": 1, "status": "INITIATED", "tenant_id": tenant_id})
            return

        # Step 2: Intermediate Stage Execution with Asynchronous Rollback Simulation
        if path == "/api/workflow/stage":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            wf_id = body.get("workflow_id")
            action = body.get("action", "advance")
            
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute("SELECT * FROM workflows WHERE id = ?", (wf_id,))
                wf = cursor.fetchone()
                
                if not wf:
                    self.send_json(404, {"error": "Workflow not found"})
                    return
                
                if MODE == "vulnerable":
                    # Vulnerable: In asynchronous stage rollback, context lock is cleared or dissociated
                    if action == "rollback":
                        # Unpins the tenant security context during partial recovery
                        cursor.execute(
                            "UPDATE workflows SET status = 'STAGED_AWAITING_RETRY', tenant_context_lock = NULL WHERE id = ?",
                            (wf_id,)
                        )
                        db_conn.commit()
                        self.send_json(200, {"workflow_id": wf_id, "status": "STAGED_AWAITING_RETRY", "lock": None})
                        return
                    elif action == "advance":
                        cursor.execute("UPDATE workflows SET current_stage = current_stage + 1 WHERE id = ?", (wf_id,))
                        db_conn.commit()
                        self.send_json(200, {"workflow_id": wf_id, "stage": wf["current_stage"] + 1})
                        return
                else:
                    # Fixed: Tenant context is strictly immutable and required on every stage transition
                    if user.get("tenant_id") != wf["tenant_id"]:
                        self.send_json(403, {"error": "Cross-tenant workflow mutation prohibited"})
                        return
                    if action == "rollback":
                        cursor.execute("UPDATE workflows SET status = 'STAGED_AWAITING_RETRY' WHERE id = ?", (wf_id,))
                        db_conn.commit()
                        self.send_json(200, {"workflow_id": wf_id, "status": "STAGED_AWAITING_RETRY", "lock": wf["tenant_id"]})
                        return
                    elif action == "advance":
                        cursor.execute("UPDATE workflows SET current_stage = current_stage + 1 WHERE id = ?", (wf_id,))
                        db_conn.commit()
                        self.send_json(200, {"workflow_id": wf_id, "stage": wf["current_stage"] + 1})
                        return

        # Step 3: Final Commit / Approve Workflow
        if path == "/api/workflow/commit":
            user = self.get_auth_user()
            if not user:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            wf_id = body.get("workflow_id")
            with DB_LOCK:
                cursor = db_conn.cursor()
                cursor.execute("SELECT * FROM workflows WHERE id = ?", (wf_id,))
                wf = cursor.fetchone()
                
                if not wf:
                    self.send_json(404, {"error": "Workflow not found"})
                    return
                
                if MODE == "vulnerable":
                    # Vulnerable: If lock was cleared, anyone can claim and commit as their own tenant target!
                    if wf["tenant_context_lock"] is None:
                        # Cross-tenant hijack happens: committed under the original tenant's high authority!
                        cursor.execute(
                            "UPDATE workflows SET status = 'APPROVED_AND_EXECUTED', tenant_context_lock = ? WHERE id = ?",
                            (user.get("tenant_id"), wf_id)
                        )
                        db_conn.commit()
                        self.send_json(200, {
                            "message": "WORKFLOW_APPROVED_UNDER_TENANT_AUTHORITY",
                            "workflow_id": wf_id,
                            "original_tenant": wf["tenant_id"],
                            "executing_actor": user.get("sub"),
                            "status": "APPROVED_AND_EXECUTED"
                        })
                        return
                    else:
                        if user.get("tenant_id") != wf["tenant_id"]:
                            self.send_json(403, {"error": "Forbidden: Tenant mismatch"})
                            return
                        cursor.execute("UPDATE workflows SET status = 'APPROVED_AND_EXECUTED' WHERE id = ?", (wf_id,))
                        db_conn.commit()
                        self.send_json(200, {"message": "Workflow approved", "workflow_id": wf_id, "status": "APPROVED_AND_EXECUTED"})
                        return
                else:
                    # Fixed: Strict ownership and tenant enforcement
                    if user.get("tenant_id") != wf["tenant_id"]:
                        self.send_json(403, {"error": "Forbidden: Tenant mismatch"})
                        return
                    cursor.execute("UPDATE workflows SET status = 'APPROVED_AND_EXECUTED' WHERE id = ?", (wf_id,))
                    db_conn.commit()
                    self.send_json(200, {"message": "Workflow approved", "workflow_id": wf_id, "status": "APPROVED_AND_EXECUTED"})
                    return

        self.send_json(404, {"error": "Not Found"})

    def log_message(self, format, *args):
        # Quiet logger for clean test outputs
        return

def run_server():
    init_db()
    server = HTTPServer(("127.0.0.1", PORT), LabHandler)
    print(f"LAB_SERVER_STARTED port={PORT} mode={MODE}")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith("--mode="):
                MODE = arg.split("=")[1]
            elif arg.startswith("--port="):
                PORT = int(arg.split("=")[1])
    run_server()
