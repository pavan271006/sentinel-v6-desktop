"""
Ground-Truth Vulnerability Lab Application Factory (FastAPI).
Implements authentic, functional, deliberately vulnerable test fixtures across
8 vulnerability classes (SQLi, XSS, BOLA, BFLA, TOCTOU, JWT bypass, SSRF, and CAND-001).
Every fixture is labeled with `KNOWN_LAB_VULNERABILITY: <fixture_id>`.
"""

import asyncio
import sqlite3
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse

from .database import GroundTruthDatabase
from .auth import (
    create_access_token, create_unsigned_none_token,
    verify_password, get_current_user_vulnerable
)


# Pydantic Request Models
class LoginRequest(BaseModel):
    username: str
    password: str


class NoteCreateRequest(BaseModel):
    invoice_id: int
    note: str


class PromoteUserRequest(BaseModel):
    username: str
    new_role: str


class TransferFundsRequest(BaseModel):
    recipient: str
    amount: float


class WebhookTestRequestBody(BaseModel):
    target_url: str


class WorkflowInitiateBody(BaseModel):
    workflow_id: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class WorkflowStageBody(BaseModel):
    workflow_id: str
    action: str  # "advance" or "rollback"


class WorkflowCommitBody(BaseModel):
    workflow_id: str
    transition: str = "staged_to_approved"


def create_ground_truth_app(db_path: str = ":memory:") -> FastAPI:
    """
    Application factory for the Ground-Truth Vulnerable Laboratory.
    """
    app = FastAPI(
        title="Ground-Truth Security Research Laboratory",
        description="Deliberately vulnerable testbed with genuine vulnerability mechanics",
        version="2.0.0"
    )

    db = GroundTruthDatabase(db_path=db_path)
    app.state.db = db

    # -------------------------------------------------------------------------
    # Authentication Helper
    # -------------------------------------------------------------------------
    @app.post("/api/v1/auth/login", tags=["Authentication"])
    async def login(req: LoginRequest):
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, username, password_hash, role FROM users WHERE username = ?",
                (req.username,)
            )
            row = cursor.fetchone()
            if not row or not verify_password(req.password, row["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid credentials")

            token = create_access_token(
                user_id=row["id"],
                username=row["username"],
                tenant_id=row["tenant_id"],
                role=row["role"]
            )
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": row["id"],
                    "username": row["username"],
                    "tenant_id": row["tenant_id"],
                    "role": row["role"]
                }
            }

    # -------------------------------------------------------------------------
    # Fixture 1: CWE-89 (SQL Injection)
    # KNOWN_LAB_VULNERABILITY: LAB-SQLI-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/search", tags=["Injection"])
    async def search_invoices(
        q: str = Query(..., description="Search keyword"),
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-SQLI-001 (CWE-89).
        Vulnerable mechanics: Dynamic raw string formatting concatenates untrusted search keyword `q`
        directly into the SQL query without parameterization, allowing syntax breaking and cross-tenant leakage.
        """
        user_tenant = user.get("tenant_id", "org_alpha")
        # Raw unparameterized SQL concatenation
        sql_query = f"SELECT id, tenant_id, created_by, title, amount, secret_notes, status FROM invoices WHERE tenant_id = '{user_tenant}' AND title LIKE '%{q}%'"
        
        with db.get_cursor() as cursor:
            try:
                cursor.execute(sql_query)
                rows = cursor.fetchall()
                results = [dict(row) for row in rows]
                return {"query": q, "count": len(results), "invoices": results}
            except sqlite3.OperationalError as e:
                # Reflect database syntax error on malicious SQL syntax breakdown
                return JSONResponse(
                    status_code=500,
                    content={"error": "Database query error", "sql_error": str(e), "executed_sql": sql_query}
                )

    # -------------------------------------------------------------------------
    # Fixture 2: CWE-79 (Cross-Site Scripting - Reflected & Stored)
    # KNOWN_LAB_VULNERABILITY: LAB-XSS-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/preview", tags=["Cross-Site Scripting"])
    async def preview_template(
        template: str = Query(..., description="Template HTML"),
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-XSS-001 (CWE-79 Reflected).
        Vulnerable mechanics: Unescaped template string is reflected directly into a text/html response
        without HTML entity escaping or Content-Security-Policy headers.
        """
        raw_html = f"<!DOCTYPE html><html><body><div id='preview-container'>{template}</div></body></html>"
        return HTMLResponse(content=raw_html, status_code=200)

    @app.post("/api/v1/invoices/notes", tags=["Cross-Site Scripting"])
    async def add_invoice_note(
        body: NoteCreateRequest,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-XSS-001 (CWE-79 Stored).
        Vulnerable mechanics: Stores unescaped HTML/JS payload in database and renders unescaped HTML representation.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT INTO invoice_notes (invoice_id, author, note) VALUES (?, ?, ?)",
                (body.invoice_id, user["username"], body.note)
            )
        return HTMLResponse(
            content=f"<div class='note-item'><span class='author'>{user['username']}</span>: {body.note}</div>",
            status_code=200
        )

    # -------------------------------------------------------------------------
    # Fixture 3: CWE-639 (BOLA / IDOR)
    # KNOWN_LAB_VULNERABILITY: LAB-BOLA-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/invoices/{invoice_id}", tags=["Authorization"])
    async def get_invoice_by_id(
        invoice_id: int,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-BOLA-001 (CWE-639).
        Vulnerable mechanics: Queries invoice solely by `id` without verifying that `invoices.tenant_id == user.tenant_id`.
        Allows Tenant B users to read confidential Tenant A invoice records.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, created_by, title, amount, secret_notes, status FROM invoices WHERE id = ?",
                (invoice_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Invoice not found")
            return dict(row)

    # -------------------------------------------------------------------------
    # Fixture 4: CWE-862 (BFLA - Broken Function Level Authorization)
    # KNOWN_LAB_VULNERABILITY: LAB-BFLA-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/admin/promote", tags=["Authorization"])
    async def promote_user_role(
        body: PromoteUserRequest,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-BFLA-001 (CWE-862).
        Vulnerable mechanics: Validates that the request has an authentication token, but fails to check
        whether `user['role'] == 'admin'`, allowing standard members to promote themselves or others.
        """
        # Missing role check: unprivileged members can execute admin promotion!
        with db.get_cursor() as cursor:
            cursor.execute(
                "UPDATE users SET role = ? WHERE username = ?",
                (body.new_role, body.username)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Target user not found")
            return {
                "status": "success",
                "message": f"User {body.username} elevated to {body.new_role}",
                "executed_by": user["username"],
                "caller_role": user.get("role", "member")
            }

    # -------------------------------------------------------------------------
    # Fixture 5: CWE-367 (TOCTOU Concurrency Balance Double-Spend Race)
    # KNOWN_LAB_VULNERABILITY: LAB-TOCTOU-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/transfer", tags=["Concurrency"])
    async def transfer_funds(
        body: TransferFundsRequest,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-TOCTOU-001 (CWE-367).
        Vulnerable mechanics: Non-atomic balance check and debit with an async sleep window.
        Concurrent requests read sufficient balance before any deduction completes, allowing double spending.
        """
        sender = user["username"]
        if body.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid transfer amount")

        with db.get_cursor() as cursor:
            # 1. Time-of-check (TOC)
            cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Sender account not found")
            current_balance = row["balance"]

        if current_balance < body.amount:
            raise HTTPException(status_code=400, detail="Insufficient funds")

        # Artificial async delay simulating processing window
        await asyncio.sleep(0.05)

        # 2. Time-of-use (TOU) - Non-atomic debit based on stale read!
        with db.get_cursor() as cursor:
            cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
            bal_now = cursor.fetchone()["balance"]
            new_balance = bal_now - body.amount
            cursor.execute("UPDATE accounts SET balance = ? WHERE username = ?", (new_balance, sender))
            cursor.execute("UPDATE accounts SET balance = balance + ? WHERE username = ?", (body.amount, body.recipient))

        return {
            "status": "success",
            "sender": sender,
            "recipient": body.recipient,
            "transferred": body.amount,
            "remaining_balance": new_balance
        }

    # -------------------------------------------------------------------------
    # Fixture 6: CWE-347 (JWT Alg None / Signature Bypass)
    # KNOWN_LAB_VULNERABILITY: LAB-JWT-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/secure-vault", tags=["Authentication"])
    async def access_secure_vault(
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-JWT-001 (CWE-347).
        Vulnerable mechanics: The endpoint relies on `decode_vulnerable_jwt` which accepts tokens
        with `alg: none` or missing signatures, granting access to confidential vault secrets.
        """
        return {
            "status": "authorized",
            "vault_secret": "ALPHA_VAULT_TOP_SECRET_MASTER_TOKEN_998877",
            "classification": "TOP_SECRET_CLASSIFIED",
            "accessed_by": user.get("username"),
            "tenant_id": user.get("tenant_id"),
            "role": user.get("role")
        }

    # -------------------------------------------------------------------------
    # Fixture 7: CWE-918 (Server-Side Request Forgery - SSRF)
    # KNOWN_LAB_VULNERABILITY: LAB-SSRF-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/webhooks/test", tags=["SSRF"])
    async def test_webhook_endpoint(
        body: WebhookTestRequestBody,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: LAB-SSRF-001 (CWE-918).
        Vulnerable mechanics: Dispatches HTTP request directly to user-supplied `target_url`
        without pre-socket IP filtering, enabling access to internal loopback, private networks, and cloud metadata.
        """
        target = body.target_url
        if not target.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid URL protocol")

        # Mock simulation for hermetic offline test environments
        parsed = urllib.parse.urlparse(target)
        hostname = parsed.hostname or ""

        if "169.254.169.254" in hostname:
            # Simulated cloud metadata service
            return {
                "status": "delivered",
                "target_url": target,
                "response_code": 200,
                "response_body": "{\"iam_role\": \"admin-role\", \"access_key\": \"AKIAIOSFODNN7EXAMPLE\", \"secret_key\": \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\"}"
            }
        elif hostname in ("127.0.0.1", "localhost", "0.0.0.0", "::1", "2130706433"):
            # Simulated internal daemon
            return {
                "status": "delivered",
                "target_url": target,
                "response_code": 200,
                "response_body": "{\"internal_daemon_status\": \"active\", \"admin_console\": \"http://127.0.0.1:8888/internal/debug\"}"
            }
        else:
            return {
                "status": "delivered",
                "target_url": target,
                "response_code": 200,
                "response_body": "External webhook received payload successfully"
            }

    # -------------------------------------------------------------------------
    # Fixture 8: CAND-001 / H-006 (Temporal State Desynchronization)
    # KNOWN_LAB_VULNERABILITY: CAND-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/workflow/initiate", tags=["State Machine"])
    async def initiate_workflow(
        body: WorkflowInitiateBody,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT INTO workflows (id, tenant_id, initiator, current_stage, status, payload, tenant_context_lock) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    body.workflow_id,
                    user["tenant_id"],
                    user["username"],
                    "INITIATED",
                    "DRAFT",
                    str(body.payload),
                    user["tenant_id"]
                )
            )
            return {"status": "initiated", "workflow_id": body.workflow_id, "tenant_id": user["tenant_id"]}

    @app.post("/api/v1/workflow/stage", tags=["State Machine"])
    async def stage_workflow(
        body: WorkflowStageBody,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        Simulates workflow rollback or stage alteration.
        Vulnerable behavior: When rolled back, clears `tenant_context_lock = NULL` to allow retries.
        """
        with db.get_cursor() as cursor:
            cursor.execute("SELECT id, tenant_id, status FROM workflows WHERE id = ?", (body.workflow_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Workflow not found")

            if body.action == "rollback":
                # Dissociates tenant lock upon rollback!
                cursor.execute(
                    "UPDATE workflows SET status = 'STAGED_AWAITING_RETRY', current_stage = 'ROLLED_BACK', tenant_context_lock = NULL WHERE id = ?",
                    (body.workflow_id,)
                )
                return {"status": "STAGED_AWAITING_RETRY", "workflow_id": body.workflow_id, "lock": "unlocked"}
            else:
                cursor.execute(
                    "UPDATE workflows SET status = 'STAGED', current_stage = 'ADVANCED' WHERE id = ?",
                    (body.workflow_id,)
                )
                return {"status": "STAGED", "workflow_id": body.workflow_id}

    @app.post("/api/v1/workflow/commit", tags=["State Machine"])
    async def commit_workflow(
        body: WorkflowCommitBody,
        user: Dict[str, Any] = Depends(get_current_user_vulnerable)
    ):
        """
        KNOWN_LAB_VULNERABILITY: CAND-001 / H-006 (Temporal State Desync).
        Vulnerable mechanics: If `tenant_context_lock` is NULL (due to rollback), commit handler
        skips tenant ownership verification, allowing cross-tenant user (Tenant B) to commit Tenant A's workflow.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, status, tenant_context_lock FROM workflows WHERE id = ?",
                (body.workflow_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Workflow not found")

            tenant_lock = row["tenant_context_lock"]
            owner_tenant = row["tenant_id"]

            # Vulnerable flaw: If lock is None, accepts commit from any authenticated caller!
            if tenant_lock is None or tenant_lock == user["tenant_id"]:
                cursor.execute(
                    "UPDATE workflows SET status = 'APPROVED_AND_EXECUTED', current_stage = 'COMMITTED', tenant_context_lock = ? WHERE id = ?",
                    (user["tenant_id"], body.workflow_id)
                )
                return {
                    "status": "APPROVED_AND_EXECUTED",
                    "workflow_id": body.workflow_id,
                    "committed_by_user": user["username"],
                    "committed_by_tenant": user["tenant_id"],
                    "owner_tenant": owner_tenant,
                    "hijacked": (user["tenant_id"] != owner_tenant)
                }
            else:
                raise HTTPException(status_code=403, detail="Workflow tenant lock mismatch")

    return app
