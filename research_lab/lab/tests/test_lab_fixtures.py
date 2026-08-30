"""
Automated Dual-Oracle Verification Test Suite for Laboratory Fixtures.
Proves 100% true positive reproduction across all 8 ground-truth vulnerable fixtures
and 0% false positives across matching fixed negative controls.
"""

import time
import concurrent.futures
import pytest
from fastapi.testclient import TestClient

from lab.ground_truth.app import create_ground_truth_app
from lab.ground_truth.auth import create_unsigned_none_token
from lab.fixed_controls.app import create_fixed_controls_app
from lab.registry import get_registry, get_all_fixtures, get_fixture_by_id, VulnerabilityCategory, Severity


@pytest.fixture
def gt_client():
    """Creates a fresh in-memory Ground-Truth Vulnerable Application client."""
    app = create_ground_truth_app(db_path=":memory:")
    return TestClient(app)


@pytest.fixture
def fc_client():
    """Creates a fresh in-memory Fixed Negative Controls Application client."""
    app = create_fixed_controls_app(db_path=":memory:")
    return TestClient(app)


def get_token(client: TestClient, username: str = "alice", password: str = "password123") -> str:
    """Helper to authenticate and retrieve access token."""
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# =============================================================================
# 1. CWE-89: SQL Injection Dual-Oracle Test (LAB-SQLI-001)
# =============================================================================

class TestSQLInjectionDualOracle:
    """Dual-oracle evaluation of SQL Injection in search query."""

    @pytest.mark.parametrize("payload", [
        "' OR 1=1 --",
        "' OR '1'='1' --",
        "' UNION SELECT 999, 'org_beta', 'hacked', 'Injected Cross-Tenant Title', 99999.0, 'leaked_notes', 'LEAKED' --"
    ])
    def test_ground_truth_vulnerable_sqli_reproduction(self, gt_client, payload):
        """Proves SQL injection succeeds and leaks cross-tenant records on ground truth."""
        token = get_token(gt_client, "alice")  # alice is in org_alpha
        resp = gt_client.get(
            f"/api/v1/search?q={payload}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        invoices = resp.json().get("invoices", [])
        # Ground truth leaks all invoices (including org_beta) or injected records
        tenant_ids = {inv.get("tenant_id") for inv in invoices}
        assert len(invoices) > 2 or "org_beta" in tenant_ids, (
            f"Vulnerability failed to trigger: {invoices}"
        )

    def test_ground_truth_sqli_syntax_error_reflection(self, gt_client):
        """Proves malformed SQL query causes syntax error reflection on ground truth."""
        token = get_token(gt_client, "alice")
        resp = gt_client.get(
            "/api/v1/search?q=' AND (SELECT * FROM non_existent_table) --",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 500
        assert "Database query error" in resp.json().get("error", "")

    @pytest.mark.parametrize("payload", [
        "' OR 1=1 --",
        "' OR '1'='1' --",
        "' UNION SELECT 999, 'org_beta', 'hacked', 'Injected Title', 99999.0, 'leaked', 'LEAKED' --",
        "'; DROP TABLE invoices; --"
    ])
    def test_fixed_control_sqli_neutralized(self, fc_client, payload):
        """Proves SQL injection payload is treated as a literal search string on fixed control (0% FP)."""
        token = get_token(fc_client, "alice")
        resp = fc_client.get(
            f"/api/v1/search?q={payload}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        invoices = resp.json().get("invoices", [])
        # Parameterized query treats input literally; 0 invoices match unless literal string exists
        assert len(invoices) == 0
        for inv in invoices:
            assert inv["tenant_id"] == "org_alpha"

    def test_benign_search_query_execution(self, gt_client, fc_client):
        """Proves legitimate searches work properly on both implementations."""
        for client in (gt_client, fc_client):
            token = get_token(client, "alice")
            resp = client.get(
                "/api/v1/search?q=Office",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == 200
            invoices = resp.json().get("invoices", [])
            assert len(invoices) >= 1
            assert invoices[0]["title"] == "Alpha Office Supplies"


# =============================================================================
# 2. CWE-79: Cross-Site Scripting Dual-Oracle Test (LAB-XSS-001)
# =============================================================================

class TestCrossSiteScriptingDualOracle:
    """Dual-oracle evaluation of Reflected and Stored XSS."""

    def test_ground_truth_vulnerable_xss_reflected(self, gt_client):
        """Proves unescaped HTML/JS payload is reflected directly in text/html on ground truth."""
        token = get_token(gt_client, "alice")
        xss_payload = "<script>alert('VULNERABLE_XSS')</script>"
        resp = gt_client.get(
            f"/api/v1/preview?template={xss_payload}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")
        # Verifies raw unescaped script tag is present
        assert "<script>alert('VULNERABLE_XSS')</script>" in resp.text
        assert "Content-Security-Policy" not in resp.headers

    def test_ground_truth_vulnerable_xss_stored(self, gt_client):
        """Proves stored note renders raw unescaped HTML on ground truth."""
        token = get_token(gt_client, "bob")
        xss_img = "<img src=x onerror=alert('STORED_XSS')>"
        resp = gt_client.post(
            "/api/v1/invoices/notes",
            json={"invoice_id": 2, "note": xss_img},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert "<img src=x onerror=alert('STORED_XSS')>" in resp.text

    def test_fixed_control_xss_escaped_and_csp(self, fc_client):
        """Proves HTML entity escaping and CSP enforcement on fixed controls."""
        token = get_token(fc_client, "alice")
        xss_payload = "<script>alert('ATTACK')</script>"
        resp = fc_client.get(
            f"/api/v1/preview?template={xss_payload}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        # Assert raw script tag is escaped
        assert "<script>" not in resp.text
        assert "&lt;script&gt;alert(&#x27;ATTACK&#x27;)&lt;/script&gt;" in resp.text
        assert "Content-Security-Policy" in resp.headers

    def test_benign_text_rendering(self, gt_client, fc_client):
        """Proves standard text and formatting operate smoothly."""
        for client in (gt_client, fc_client):
            token = get_token(client, "alice")
            resp = client.get(
                "/api/v1/preview?template=Hello World Invoice Preview",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == 200
            assert "Hello World Invoice Preview" in resp.text


# =============================================================================
# 3. CWE-639: Broken Object Level Authorization Dual-Oracle Test (LAB-BOLA-001)
# =============================================================================

class TestBOLADualOracle:
    """Dual-oracle evaluation of BOLA / IDOR cross-tenant access."""

    def test_ground_truth_vulnerable_bola_cross_tenant_access(self, gt_client):
        """Proves Tenant B user (charlie) can fetch Tenant A invoice #1 on ground truth."""
        beta_token = get_token(gt_client, "charlie")  # charlie is in org_beta
        resp = gt_client.get(
            "/api/v1/invoices/1",  # Invoice 1 belongs to org_alpha
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == 1
        assert data["tenant_id"] == "org_alpha"
        assert data["title"] == "Alpha Secret Q1 Budget"
        assert "Alpha confidential financial plan" in data["secret_notes"]

    def test_fixed_control_bola_access_rejected(self, fc_client):
        """Proves Tenant B user (charlie) receives 404 on Tenant A invoice #1 on fixed controls (0% FP)."""
        beta_token = get_token(fc_client, "charlie")
        resp = fc_client.get(
            "/api/v1/invoices/1",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        assert resp.status_code == 404
        assert "not found" in resp.json().get("detail", "").lower()

    def test_benign_authorized_invoice_access(self, fc_client):
        """Proves authorized users can retrieve their own tenant invoices on fixed controls."""
        alpha_token = get_token(fc_client, "alice")
        resp = fc_client.get(
            "/api/v1/invoices/1",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["tenant_id"] == "org_alpha"

        beta_token = get_token(fc_client, "charlie")
        resp_beta = fc_client.get(
            "/api/v1/invoices/3",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        assert resp_beta.status_code == 200
        assert resp_beta.json()["tenant_id"] == "org_beta"


# =============================================================================
# 4. CWE-862: Broken Function Level Authorization Dual-Oracle Test (LAB-BFLA-001)
# =============================================================================

class TestBFLADualOracle:
    """Dual-oracle evaluation of BFLA unprivileged role elevation."""

    def test_ground_truth_vulnerable_bfla_privilege_escalation(self, gt_client):
        """Proves standard member (bob) can elevate role to admin on ground truth."""
        member_token = get_token(gt_client, "bob")
        resp = gt_client.post(
            "/api/v1/admin/promote",
            json={"username": "bob", "new_role": "admin"},
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["executed_by"] == "bob"

    def test_fixed_control_bfla_rejected_with_403(self, fc_client):
        """Proves standard member (bob) is rejected with 403 Forbidden on fixed controls."""
        member_token = get_token(fc_client, "bob")
        resp = fc_client.post(
            "/api/v1/admin/promote",
            json={"username": "bob", "new_role": "admin"},
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert resp.status_code == 403
        assert "Forbidden" in resp.json().get("detail", "")

    def test_benign_authorized_admin_promotion(self, fc_client):
        """Proves legitimate administrator (alice) can successfully promote users on fixed controls."""
        admin_token = get_token(fc_client, "alice")
        resp = fc_client.post(
            "/api/v1/admin/promote",
            json={"username": "recipient_user", "new_role": "admin"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"


# =============================================================================
# 5. CWE-367: Concurrency TOCTOU Balance Double-Spend Race (LAB-TOCTOU-001)
# =============================================================================

class TestTOCTOUConcurrencyDualOracle:
    """Dual-oracle evaluation of concurrency double-spend race condition."""

    def test_ground_truth_vulnerable_toctou_double_spend(self, gt_client):
        """
        Proves sending 5 concurrent transfer requests of $100 against an initial balance of $100
        results in multiple successful transfers and negative balance on ground truth.
        """
        sender_token = get_token(gt_client, "bob")  # bob starts with $100

        def send_transfer():
            return gt_client.post(
                "/api/v1/transfer",
                json={"recipient": "recipient_user", "amount": 100.0},
                headers={"Authorization": f"Bearer {sender_token}"}
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(send_transfer) for _ in range(5)]
            results = [f.result() for f in futures]

        success_count = sum(1 for r in results if r.status_code == 200)
        # On vulnerable ground truth, multiple concurrent transfers succeed
        assert success_count >= 2, f"Expected race condition double-spend, got {success_count} successes"

    def test_fixed_control_toctou_race_prevented(self, fc_client):
        """
        Proves sending 5 concurrent transfer requests of $100 against an initial balance of $100
        on fixed controls results in exactly 1 success and 4 rejections, with non-negative balance (0% FP).
        """
        sender_token = get_token(fc_client, "bob")  # bob starts with $100

        def send_transfer():
            return fc_client.post(
                "/api/v1/transfer",
                json={"recipient": "recipient_user", "amount": 100.0},
                headers={"Authorization": f"Bearer {sender_token}"}
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(send_transfer) for _ in range(5)]
            results = [f.result() for f in futures]

        success_count = sum(1 for r in results if r.status_code == 200)
        insufficient_count = sum(1 for r in results if r.status_code == 400 and "Insufficient funds" in r.text)

        assert success_count == 1, f"Expected exactly 1 transfer to succeed, got {success_count}"
        assert insufficient_count == 4, f"Expected 4 insufficient funds errors, got {insufficient_count}"

    def test_benign_sequential_transfers(self, fc_client):
        """Proves sequential valid transfers work correctly within balance limit."""
        token = get_token(fc_client, "alice")  # alice starts with $5000
        resp1 = fc_client.post(
            "/api/v1/transfer",
            json={"recipient": "bob", "amount": 50.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp1.status_code == 200
        assert resp1.json()["remaining_balance"] == 4950.0


# =============================================================================
# 6. CWE-347: JWT Signature Bypass / Alg None (LAB-JWT-001)
# =============================================================================

class TestJWTBypassDualOracle:
    """Dual-oracle evaluation of JWT alg: none / signature verification bypass."""

    def test_ground_truth_vulnerable_jwt_none_accepted(self, gt_client):
        """Proves unsigned token with alg: none is accepted on ground truth."""
        none_token = create_unsigned_none_token(
            user_id="attacker_1",
            username="attacker",
            tenant_id="org_alpha",
            role="admin"
        )
        resp = gt_client.get(
            "/api/v1/secure-vault",
            headers={"Authorization": f"Bearer {none_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "authorized"
        assert data["vault_secret"] == "ALPHA_VAULT_TOP_SECRET_MASTER_TOKEN_998877"
        assert data["accessed_by"] == "attacker"

    def test_fixed_control_jwt_none_rejected(self, fc_client):
        """Proves unsigned token with alg: none is rejected with 401 Unauthorized on fixed controls."""
        none_token = create_unsigned_none_token(
            user_id="attacker_1",
            username="attacker",
            tenant_id="org_alpha",
            role="admin"
        )
        resp = fc_client.get(
            "/api/v1/secure-vault",
            headers={"Authorization": f"Bearer {none_token}"}
        )
        assert resp.status_code == 401
        assert "Invalid token" in resp.json().get("detail", "")

    def test_benign_valid_signed_jwt_access(self, fc_client):
        """Proves properly signed valid JWT accesses secure vault normally on fixed controls."""
        valid_token = get_token(fc_client, "alice")
        resp = fc_client.get(
            "/api/v1/secure-vault",
            headers={"Authorization": f"Bearer {valid_token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "authorized"
        assert resp.json()["accessed_by"] == "alice"


# =============================================================================
# 7. CWE-918: Server-Side Request Forgery Dual-Oracle Test (LAB-SSRF-001)
# =============================================================================

class TestSSRFDualOracle:
    """Dual-oracle evaluation of SSRF pre-socket IP filtering."""

    @pytest.mark.parametrize("internal_target", [
        "http://127.0.0.1:8888/internal/status",
        "http://localhost:8080/debug",
        "http://169.254.169.254/latest/meta-data/"
    ])
    def test_ground_truth_vulnerable_ssrf_dispatched(self, gt_client, internal_target):
        """Proves internal endpoints are reached without restriction on ground truth."""
        token = get_token(gt_client, "alice")
        resp = gt_client.post(
            "/api/v1/webhooks/test",
            json={"target_url": internal_target},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "delivered"
        assert data["response_code"] == 200

    @pytest.mark.parametrize("blocked_target", [
        "http://127.0.0.1:8888/internal/status",
        "http://localhost:8080/debug",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/config",
        "http://172.16.0.1/status",
        "http://2130706433/"  # Decimal 127.0.0.1
    ])
    def test_fixed_control_ssrf_blocked_with_403(self, fc_client, blocked_target):
        """Proves internal/private/loopback IPs are blocked with 403 on fixed controls."""
        token = get_token(fc_client, "alice")
        resp = fc_client.post(
            "/api/v1/webhooks/test",
            json={"target_url": blocked_target},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 403
        assert "rejected" in resp.json().get("detail", "").lower()

    def test_benign_external_webhook_permitted(self, fc_client):
        """Proves valid external webhook endpoints are accepted on fixed controls."""
        token = get_token(fc_client, "alice")
        resp = fc_client.post(
            "/api/v1/webhooks/test",
            json={"target_url": "https://example.com/webhook/incoming"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "delivered"


# =============================================================================
# 8. CAND-001 / H-006: Temporal State Desynchronization Dual-Oracle Test
# =============================================================================

class TestTemporalStateDesyncDualOracle:
    """Dual-oracle evaluation of Temporal State Desynchronization in Workflow Rollback."""

    def test_ground_truth_vulnerable_temporal_state_desync(self, gt_client):
        """
        Proves Tenant A initiates workflow, triggers rollback (clearing lock),
        and Tenant B successfully commits and hijacks the workflow on ground truth.
        """
        token_a = get_token(gt_client, "alice")  # org_alpha
        token_b = get_token(gt_client, "charlie")  # org_beta

        # 1. Tenant A initiates workflow
        wf_id = "wf_temporal_test_101"
        gt_client.post(
            "/api/v1/workflow/initiate",
            json={"workflow_id": wf_id, "payload": {"amount": 50000}},
            headers={"Authorization": f"Bearer {token_a}"}
        )

        # 2. Tenant A executes rollback (dissociates tenant context lock)
        stage_resp = gt_client.post(
            "/api/v1/workflow/stage",
            json={"workflow_id": wf_id, "action": "rollback"},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert stage_resp.status_code == 200
        assert stage_resp.json()["status"] == "STAGED_AWAITING_RETRY"

        # 3. Tenant B (cross-tenant) commits the workflow!
        commit_resp = gt_client.post(
            "/api/v1/workflow/commit",
            json={"workflow_id": wf_id, "transition": "staged_to_approved"},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert commit_resp.status_code == 200
        data = commit_resp.json()
        assert data["status"] == "APPROVED_AND_EXECUTED"
        assert data["committed_by_tenant"] == "org_beta"
        assert data["owner_tenant"] == "org_alpha"
        assert data["hijacked"] is True

    def test_fixed_control_temporal_state_desync_prevented(self, fc_client):
        """
        Proves rollback preserves immutable tenant lock and Tenant B commit attempt
        is rejected with 403 Forbidden on fixed controls.
        """
        token_a = get_token(fc_client, "alice")  # org_alpha
        token_b = get_token(fc_client, "charlie")  # org_beta

        # 1. Tenant A initiates workflow
        wf_id = "wf_temporal_test_102"
        fc_client.post(
            "/api/v1/workflow/initiate",
            json={"workflow_id": wf_id, "payload": {"amount": 50000}},
            headers={"Authorization": f"Bearer {token_a}"}
        )

        # 2. Tenant A executes rollback
        fc_client.post(
            "/api/v1/workflow/stage",
            json={"workflow_id": wf_id, "action": "rollback"},
            headers={"Authorization": f"Bearer {token_a}"}
        )

        # 3. Tenant B attempts cross-tenant hijack commit -> MUST FAIL with 403
        commit_resp = fc_client.post(
            "/api/v1/workflow/commit",
            json={"workflow_id": wf_id, "transition": "staged_to_approved"},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert commit_resp.status_code == 403
        assert "Cross-tenant workflow mutation prohibited" in commit_resp.json()["detail"]

    def test_benign_authorized_workflow_lifecycle(self, fc_client):
        """Proves legitimate sequential workflow lifecycle succeeds on fixed controls."""
        token_a = get_token(fc_client, "alice")
        wf_id = "wf_temporal_test_103"

        # Initiate
        fc_client.post(
            "/api/v1/workflow/initiate",
            json={"workflow_id": wf_id, "payload": {"item": "Hardware"}},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        # Advance
        fc_client.post(
            "/api/v1/workflow/stage",
            json={"workflow_id": wf_id, "action": "advance"},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        # Commit
        resp = fc_client.post(
            "/api/v1/workflow/commit",
            json={"workflow_id": wf_id, "transition": "staged_to_approved"},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "APPROVED_AND_EXECUTED"
        assert resp.json()["hijacked"] is False


# =============================================================================
# 9. Vulnerability Registry Programmatic Interface Tests
# =============================================================================

class TestVulnerabilityRegistryProgrammaticAPI:
    """Verifies that the central registry API functions accurately and completely."""

    def test_registry_catalog_completeness(self):
        registry = get_registry()
        fixtures = registry.list_fixtures()
        assert len(fixtures) == 8

        fixture_ids = {f.id for f in fixtures}
        expected_ids = {
            "LAB-SQLI-001", "LAB-XSS-001", "LAB-BOLA-001", "LAB-BFLA-001",
            "LAB-TOCTOU-001", "LAB-JWT-001", "LAB-SSRF-001", "CAND-001"
        }
        assert fixture_ids == expected_ids

    def test_registry_lookup_by_cwe(self):
        registry = get_registry()
        sqli_fixtures = registry.get_by_cwe("CWE-89")
        assert len(sqli_fixtures) == 1
        assert sqli_fixtures[0].id == "LAB-SQLI-001"

        ssrf_fixtures = registry.get_by_cwe("CWE-918")
        assert len(ssrf_fixtures) == 1
        assert ssrf_fixtures[0].id == "LAB-SSRF-001"

    def test_registry_serialization(self):
        registry = get_registry()
        d = registry.to_dict()
        assert d["fixture_count"] == 8
        assert len(d["fixtures"]) == 8

        yaml_str = registry.to_yaml()
        assert "LAB-SQLI-001" in yaml_str
        assert "CAND-001" in yaml_str

        json_str = registry.to_json()
        assert "LAB-JWT-001" in json_str
