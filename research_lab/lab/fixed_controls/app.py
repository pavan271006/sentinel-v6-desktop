"""
Fixed Negative Controls Laboratory Application Factory (FastAPI).
Implements remediated, hardened counterparts for all 8 vulnerability classes
(SQLi, XSS, BOLA, BFLA, TOCTOU, JWT bypass, SSRF, and CAND-001).
Every fixture is labeled with `FIXED_NEGATIVE_CONTROL: <fixture_id>`.
"""

import html
import socket
import ipaddress
import urllib.parse
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse

from .database import FixedControlsDatabase
from .auth import (
    create_access_token, verify_password,
    get_current_user_strict, require_roles
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


def is_ip_blocked(ip_str: str) -> bool:
    """Validates whether an IP address is private, loopback, link-local, or cloud metadata."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
            or str(ip) == "169.254.169.254"
        )
    except ValueError:
        return False


def create_fixed_controls_app(db_path: str = ":memory:") -> FastAPI:
    """
    Application factory for the Fixed Negative Controls Laboratory.
    """
    app = FastAPI(
        title="Fixed Negative Controls Security Laboratory",
        description="Remediated reference implementation for negative control benchmarking (0% false positives)",
        version="2.0.0"
    )

    db = FixedControlsDatabase(db_path=db_path)
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
    # Fixture 1: CWE-89 (SQL Injection Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-SQLI-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/search", tags=["Injection"])
    async def search_invoices_fixed(
        q: str = Query(..., description="Search keyword"),
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-SQLI-001 (CWE-89 Remediated).
        Remediation: Parameterized query binding ensures search input `q` is treated as a literal
        string, preventing SQL manipulation and enforcing tenant scoping.
        """
        user_tenant = user.get("tenant_id", "org_alpha")
        # Parameterized query with bound parameters
        sql_query = "SELECT id, tenant_id, created_by, title, amount, secret_notes, status FROM invoices WHERE tenant_id = ? AND title LIKE ?"
        
        with db.get_cursor() as cursor:
            cursor.execute(sql_query, (user_tenant, f"%{q}%"))
            rows = cursor.fetchall()
            results = [dict(row) for row in rows]
            return {"query": q, "count": len(results), "invoices": results}

    # -------------------------------------------------------------------------
    # Fixture 2: CWE-79 (Cross-Site Scripting Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-XSS-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/preview", tags=["Cross-Site Scripting"])
    async def preview_template_fixed(
        template: str = Query(..., description="Template HTML"),
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-XSS-001 (CWE-79 Remediated).
        Remediation: Context-aware HTML entity escaping and strict Content-Security-Policy headers.
        """
        escaped_content = html.escape(template, quote=True)
        safe_html = f"<!DOCTYPE html><html><body><div id='preview-container'>{escaped_content}</div></body></html>"
        return HTMLResponse(
            content=safe_html,
            status_code=200,
            headers={
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none'",
                "X-Content-Type-Options": "nosniff"
            }
        )

    @app.post("/api/v1/invoices/notes", tags=["Cross-Site Scripting"])
    async def add_invoice_note_fixed(
        body: NoteCreateRequest,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-XSS-001 (CWE-79 Stored Remediated).
        Remediation: HTML entity escaping and safe rendering.
        """
        escaped_note = html.escape(body.note, quote=True)
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT INTO invoice_notes (invoice_id, author, note) VALUES (?, ?, ?)",
                (body.invoice_id, user["username"], escaped_note)
            )
        return HTMLResponse(
            content=f"<div class='note-item'><span class='author'>{user['username']}</span>: {escaped_note}</div>",
            status_code=200,
            headers={"Content-Security-Policy": "default-src 'self'"}
        )

    # -------------------------------------------------------------------------
    # Fixture 3: CWE-639 (BOLA / IDOR Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-BOLA-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/invoices/{invoice_id}", tags=["Authorization"])
    async def get_invoice_by_id_fixed(
        invoice_id: int,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-BOLA-001 (CWE-639 Remediated).
        Remediation: Enforces strict tenant isolation in SQL WHERE clause (`WHERE id = ? AND tenant_id = ?`).
        Cross-tenant requests return HTTP 404 Not Found.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, created_by, title, amount, secret_notes, status FROM invoices WHERE id = ? AND tenant_id = ?",
                (invoice_id, user["tenant_id"])
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Invoice not found or access denied")
            return dict(row)

    # -------------------------------------------------------------------------
    # Fixture 4: CWE-862 (BFLA Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-BFLA-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/admin/promote", tags=["Authorization"])
    async def promote_user_role_fixed(
        body: PromoteUserRequest,
        user: Dict[str, Any] = Depends(require_roles(["admin", "owner"]))
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-BFLA-001 (CWE-862 Remediated).
        Remediation: Requires role in ['admin', 'owner']. Non-admin requests receive HTTP 403 Forbidden.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "UPDATE users SET role = ? WHERE username = ? AND tenant_id = ?",
                (body.new_role, body.username, user["tenant_id"])
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Target user not found in current organization")
            return {
                "status": "success",
                "message": f"User {body.username} elevated to {body.new_role}",
                "executed_by": user["username"],
                "caller_role": user["role"]
            }

    # -------------------------------------------------------------------------
    # Fixture 5: CWE-367 (TOCTOU Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-TOCTOU-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/transfer", tags=["Concurrency"])
    async def transfer_funds_fixed(
        body: TransferFundsRequest,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-TOCTOU-001 (CWE-367 Remediated).
        Remediation: Atomic conditional SQL updates inside database transaction prevent double spending.
        """
        sender = user["username"]
        if body.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid transfer amount")

        with db.get_cursor() as cursor:
            # Atomic conditional deduction
            cursor.execute(
                "UPDATE accounts SET balance = balance - ? WHERE username = ? AND balance >= ?",
                (body.amount, sender, body.amount)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=400, detail="Insufficient funds")

            cursor.execute(
                "UPDATE accounts SET balance = balance + ? WHERE username = ?",
                (body.amount, body.recipient)
            )

            cursor.execute("SELECT balance FROM accounts WHERE username = ?", (sender,))
            remaining = cursor.fetchone()["balance"]

        return {
            "status": "success",
            "sender": sender,
            "recipient": body.recipient,
            "transferred": body.amount,
            "remaining_balance": remaining
        }

    # -------------------------------------------------------------------------
    # Fixture 6: CWE-347 (JWT Verification Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-JWT-001
    # -------------------------------------------------------------------------
    @app.get("/api/v1/secure-vault", tags=["Authentication"])
    async def access_secure_vault_fixed(
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-JWT-001 (CWE-347 Remediated).
        Remediation: Mandatory cryptographic HS256 signature verification. Unsigned tokens or `alg: none` receive 401.
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
    # Fixture 7: CWE-918 (SSRF Remediated)
    # FIXED_NEGATIVE_CONTROL: LAB-SSRF-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/webhooks/test", tags=["SSRF"])
    async def test_webhook_endpoint_fixed(
        body: WebhookTestRequestBody,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: LAB-SSRF-001 (CWE-918 Remediated).
        Remediation: Pre-socket DNS resolution and IP address validation rejecting private, loopback,
        link-local, multicast, and cloud metadata (169.254.169.254) addresses with HTTP 403.
        """
        target = body.target_url
        if not target.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid URL protocol")

        parsed = urllib.parse.urlparse(target)
        hostname = parsed.hostname or ""

        # Decimal IP or literal IP resolution check
        if hostname.isdigit():
            # e.g. 2130706433 -> 127.0.0.1
            try:
                ip_int = int(hostname)
                ip_str = str(ipaddress.IPv4Address(ip_int))
                hostname = ip_str
            except ValueError:
                pass

        try:
            # Check direct IP
            if is_ip_blocked(hostname):
                raise HTTPException(status_code=403, detail="Access to private or local network rejected")

            # Resolve DNS
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_candidate = item[4][0]
                if is_ip_blocked(ip_candidate):
                    raise HTTPException(status_code=403, detail="Access to private or local network rejected")
        except socket.gaierror:
            # External non-resolvable domain in mock environment
            pass

        return {
            "status": "delivered",
            "target_url": target,
            "response_code": 200,
            "response_body": "External webhook validated and dispatched safely"
        }

    # -------------------------------------------------------------------------
    # Fixture 8: CAND-001 / H-006 (Temporal State Desync Remediated)
    # FIXED_NEGATIVE_CONTROL: CAND-001
    # -------------------------------------------------------------------------
    @app.post("/api/v1/workflow/initiate", tags=["State Machine"])
    async def initiate_workflow_fixed(
        body: WorkflowInitiateBody,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT INTO workflows (id, tenant_id, initiator, current_stage, status, payload, tenant_context_lock, version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    body.workflow_id,
                    user["tenant_id"],
                    user["username"],
                    "INITIATED",
                    "DRAFT",
                    str(body.payload),
                    user["tenant_id"],
                    1
                )
            )
            return {"status": "initiated", "workflow_id": body.workflow_id, "tenant_id": user["tenant_id"]}

    @app.post("/api/v1/workflow/stage", tags=["State Machine"])
    async def stage_workflow_fixed(
        body: WorkflowStageBody,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        Remediation: Rollback preserves immutable `tenant_context_lock` pinned to owner tenant.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, status, tenant_context_lock, version_id FROM workflows WHERE id = ? AND tenant_id = ?",
                (body.workflow_id, user["tenant_id"])
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Workflow not found or access denied")

            if body.action == "rollback":
                # Retains immutable tenant_context_lock pinned to owner tenant!
                cursor.execute(
                    "UPDATE workflows SET status = 'STAGED_AWAITING_RETRY', current_stage = 'ROLLED_BACK', version_id = version_id + 1 WHERE id = ?",
                    (body.workflow_id,)
                )
                return {"status": "STAGED_AWAITING_RETRY", "workflow_id": body.workflow_id, "lock": user["tenant_id"]}
            else:
                cursor.execute(
                    "UPDATE workflows SET status = 'STAGED', current_stage = 'ADVANCED', version_id = version_id + 1 WHERE id = ?",
                    (body.workflow_id,)
                )
                return {"status": "STAGED", "workflow_id": body.workflow_id}

    @app.post("/api/v1/workflow/commit", tags=["State Machine"])
    async def commit_workflow_fixed(
        body: WorkflowCommitBody,
        user: Dict[str, Any] = Depends(get_current_user_strict)
    ):
        """
        FIXED_NEGATIVE_CONTROL: CAND-001 / H-006 Remediated.
        Remediation: Immutable tenant ownership validation and lock checking. Rejects cross-tenant commit with HTTP 403.
        """
        with db.get_cursor() as cursor:
            cursor.execute(
                "SELECT id, tenant_id, status, tenant_context_lock, version_id FROM workflows WHERE id = ?",
                (body.workflow_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Workflow not found")

            owner_tenant = row["tenant_id"]
            tenant_lock = row["tenant_context_lock"]

            # Strict tenant boundary assertion
            if user["tenant_id"] != owner_tenant or user["tenant_id"] != tenant_lock:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-tenant workflow mutation prohibited: tenant mismatch"
                )

            cursor.execute(
                "UPDATE workflows SET status = 'APPROVED_AND_EXECUTED', current_stage = 'COMMITTED', version_id = version_id + 1 WHERE id = ? AND tenant_id = ?",
                (body.workflow_id, user["tenant_id"])
            )
            return {
                "status": "APPROVED_AND_EXECUTED",
                "workflow_id": body.workflow_id,
                "committed_by_user": user["username"],
                "committed_by_tenant": user["tenant_id"],
                "owner_tenant": owner_tenant,
                "hijacked": False
            }

    return app
