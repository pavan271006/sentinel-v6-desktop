"""
Central Structured Vulnerability Registry Index.
Provides authoritative metadata, CWE mappings, preconditions, exploit vectors,
assertion triggers, and programmatic query interfaces for the Ground-Truth Lab,
Negative Controls, Research Engine, and Independent Verifier.
"""

import json
import yaml
from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict


class VulnerabilityCategory(str, Enum):
    INJECTION = "Injection"
    XSS = "Cross-Site Scripting"
    AUTHORIZATION = "Authorization"
    CONCURRENCY = "Concurrency"
    AUTHENTICATION = "Authentication"
    SSRF = "Server-Side Request Forgery"
    STATE_MACHINE = "State Machine / Temporal Authorization"


class NoveltyClassification(str, Enum):
    KNOWN_TEST_FIXTURE = "KNOWN_TEST_FIXTURE"
    VARIANT = "VARIANT"
    NOVEL_CANDIDATE = "NOVEL_CANDIDATE"
    CONFIRMED_NOVEL = "CONFIRMED_NOVEL"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class PreconditionStep:
    action: str
    role: str
    target_endpoint: str
    description: str


@dataclass
class ExploitVector:
    method: str
    endpoint: str
    headers: Dict[str, str] = field(default_factory=dict)
    query_params: Dict[str, Any] = field(default_factory=dict)
    body: Dict[str, Any] = field(default_factory=dict)
    payload_description: str = ""


@dataclass
class AssertionTrigger:
    vulnerable_status_codes: List[int]
    vulnerable_indicator: str
    fixed_status_codes: List[int]
    fixed_indicator: str
    benign_status_codes: List[int]
    benign_indicator: str


@dataclass
class FixtureEntry:
    id: str
    name: str
    category: VulnerabilityCategory
    classification: NoveltyClassification
    cwe: str
    cwe_title: str
    severity: Severity
    endpoint: str
    method: str
    parameter: Optional[str]
    vulnerable_behavior: str
    fixed_behavior: str
    detection_criteria: str
    remediation_guidance: str
    preconditions: List[PreconditionStep] = field(default_factory=list)
    exploit_vectors: List[ExploitVector] = field(default_factory=list)
    assertion_triggers: Optional[AssertionTrigger] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["category"] = self.category.value
        data["classification"] = self.classification.value
        data["severity"] = self.severity.value
        return data


# Canonical catalog of all 8 fixtures
CANONICAL_FIXTURES: List[FixtureEntry] = [
    FixtureEntry(
        id="LAB-SQLI-001",
        name="SQL Injection in Invoice Search Parameter",
        category=VulnerabilityCategory.INJECTION,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-89",
        cwe_title="Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
        severity=Severity.HIGH,
        endpoint="/api/v1/search",
        method="GET",
        parameter="q",
        vulnerable_behavior="Constructs dynamic SQL via raw string formatting, allowing SQL manipulation and leaking cross-tenant invoices or triggering syntax reflection.",
        fixed_behavior="Utilizes parameterized SQLite queries with bound parameters, safely treating all search input as a literal string.",
        detection_criteria="SQL syntax error reflection or unauthorized cross-tenant records returned in JSON response.",
        remediation_guidance="Replace raw string formatting with parameterized prepared statements: cursor.execute('SELECT ... WHERE tenant_id = ? AND title LIKE ?', (tenant, f'%{q}%')).",
        preconditions=[
            PreconditionStep(action="authenticate", role="member", target_endpoint="/api/v1/auth/login", description="Login as Tenant A member to obtain session token")
        ],
        exploit_vectors=[
            ExploitVector(
                method="GET",
                endpoint="/api/v1/search",
                query_params={"q": "' OR '1'='1"},
                payload_description="Classic boolean-based SQL injection breaking out of string literal delimiter"
            ),
            ExploitVector(
                method="GET",
                endpoint="/api/v1/search",
                query_params={"q": "' UNION SELECT id, username, balance FROM accounts --"},
                payload_description="UNION-based SQL injection exfiltrating accounts table data"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200, 500],
            vulnerable_indicator="cross_tenant_leak_or_sql_error",
            fixed_status_codes=[200],
            fixed_indicator="only_authorized_tenant_matches",
            benign_status_codes=[200],
            benign_indicator="valid_matching_invoices"
        )
    ),
    FixtureEntry(
        id="LAB-XSS-001",
        name="Cross-Site Scripting (Reflected & Stored) in Templates and Notes",
        category=VulnerabilityCategory.XSS,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-79",
        cwe_title="Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
        severity=Severity.MEDIUM,
        endpoint="/api/v1/preview",
        method="GET",
        parameter="template",
        vulnerable_behavior="Returns user-supplied HTML/JS unencoded in text/html response context without sanitization or Content-Security-Policy headers.",
        fixed_behavior="Applies HTML entity escaping (html.escape), renders in safe JSON serialization or escaped HTML, and enforces strict CSP headers.",
        detection_criteria="Unescaped executable script tags or event handlers (<script>, <img> onerror, <svg> onload) reflected in HTML response.",
        remediation_guidance="Enforce context-aware HTML entity encoding on all user reflection points and configure Content-Security-Policy: default-src 'self'.",
        preconditions=[
            PreconditionStep(action="authenticate", role="member", target_endpoint="/api/v1/auth/login", description="Authenticate to access preview or note submission")
        ],
        exploit_vectors=[
            ExploitVector(
                method="GET",
                endpoint="/api/v1/preview",
                query_params={"template": "<script>alert('XSS')</script>"},
                payload_description="Reflected script execution via template parameter"
            ),
            ExploitVector(
                method="POST",
                endpoint="/api/v1/invoices/notes",
                body={"invoice_id": 1, "note": "<img src=x onerror=alert('STORED_XSS')>"},
                payload_description="Stored XSS payload injected into persistent invoice notes"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="unescaped_script_tags_in_html",
            fixed_status_codes=[200],
            fixed_indicator="escaped_html_entities_and_csp",
            benign_status_codes=[200],
            benign_indicator="clean_plain_text_rendered"
        )
    ),
    FixtureEntry(
        id="LAB-BOLA-001",
        name="Broken Object Level Authorization on Invoices (BOLA / IDOR)",
        category=VulnerabilityCategory.AUTHORIZATION,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-639",
        cwe_title="Authorization Bypass Through User-Controlled Key",
        severity=Severity.CRITICAL,
        endpoint="/api/v1/invoices/{invoice_id}",
        method="GET",
        parameter="invoice_id",
        vulnerable_behavior="Fetches invoice record solely by primary key invoice_id without verifying requesting user's tenant_id, allowing cross-tenant data access.",
        fixed_behavior="Enforces strict tenant scoping in the SQL WHERE clause (WHERE id = ? AND tenant_id = ?), returning 404/403 for unauthorized objects.",
        detection_criteria="HTTP 200 returned to Tenant B containing confidential Tenant A invoice records.",
        remediation_guidance="Always bind tenant_id to data access queries: SELECT * FROM invoices WHERE id = :id AND tenant_id = :current_tenant_id.",
        preconditions=[
            PreconditionStep(action="authenticate_tenant_b", role="member", target_endpoint="/api/v1/auth/login", description="Authenticate as user from Tenant B (org_beta)")
        ],
        exploit_vectors=[
            ExploitVector(
                method="GET",
                endpoint="/api/v1/invoices/1",
                headers={"Authorization": "Bearer {tenant_b_token}"},
                payload_description="Tenant B user accesses invoice ID 1 belonging to Tenant A"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="cross_tenant_invoice_data_leaked",
            fixed_status_codes=[403, 404],
            fixed_indicator="cross_tenant_access_denied_or_not_found",
            benign_status_codes=[200],
            benign_indicator="own_tenant_invoice_retrieved"
        )
    ),
    FixtureEntry(
        id="LAB-BFLA-001",
        name="Broken Function Level Authorization on Admin Promotion (BFLA)",
        category=VulnerabilityCategory.AUTHORIZATION,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-862",
        cwe_title="Missing Authorization",
        severity=Severity.HIGH,
        endpoint="/api/v1/admin/promote",
        method="POST",
        parameter=None,
        vulnerable_behavior="Endpoint verifies token validity but does not verify user role, permitting low-privileged members to elevate their role to admin.",
        fixed_behavior="Enforces mandatory role authorization checks (@require_roles(['admin', 'owner'])), rejecting unprivileged requests with HTTP 403.",
        detection_criteria="HTTP 200 with updated role 'admin' returned to a regular member.",
        remediation_guidance="Apply role verification middleware/dependencies to all administrative endpoints before executing business logic.",
        preconditions=[
            PreconditionStep(action="authenticate_member", role="member", target_endpoint="/api/v1/auth/login", description="Authenticate as standard member user")
        ],
        exploit_vectors=[
            ExploitVector(
                method="POST",
                endpoint="/api/v1/admin/promote",
                headers={"Authorization": "Bearer {member_token}"},
                body={"username": "member_user", "new_role": "admin"},
                payload_description="Unprivileged member submits self-promotion request to admin"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="role_promoted_to_admin_by_member",
            fixed_status_codes=[403],
            fixed_indicator="forbidden_admin_role_required",
            benign_status_codes=[200],
            benign_indicator="admin_successfully_promotes_user"
        )
    ),
    FixtureEntry(
        id="LAB-TOCTOU-001",
        name="TOCTOU Concurrency Balance Double-Spend Race Condition",
        category=VulnerabilityCategory.CONCURRENCY,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-367",
        cwe_title="Time-of-check Time-of-use (TOCTOU) Race Condition",
        severity=Severity.HIGH,
        endpoint="/api/v1/transfer",
        method="POST",
        parameter="amount",
        vulnerable_behavior="Checks balance in one query and deducts balance in a subsequent query after an asynchronous delay, allowing concurrent double-spending and overdraft.",
        fixed_behavior="Performs single atomic conditional updates (UPDATE accounts SET balance = balance - :amt WHERE username = :user AND balance >= :amt) inside transactions.",
        detection_criteria="Multiple simultaneous transfer requests succeed from a single-balance account, driving final balance negative.",
        remediation_guidance="Use atomic database transactions and conditional SQL updates that test and modify balance in a single atomic operation.",
        preconditions=[
            PreconditionStep(action="authenticate_sender", role="member", target_endpoint="/api/v1/auth/login", description="Authenticate sender account with initial balance $100")
        ],
        exploit_vectors=[
            ExploitVector(
                method="POST",
                endpoint="/api/v1/transfer",
                headers={"Authorization": "Bearer {sender_token}"},
                body={"recipient": "recipient_user", "amount": 100.0},
                payload_description="10 concurrent transfer requests sent simultaneously each requesting $100 from an account with $100 balance"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="multiple_transfers_succeed_negative_balance",
            fixed_status_codes=[400],
            fixed_indicator="exactly_one_succeeds_rest_fail_400",
            benign_status_codes=[200],
            benign_indicator="valid_sequential_transfers_within_balance"
        )
    ),
    FixtureEntry(
        id="LAB-JWT-001",
        name="JWT Algorithm None / Signature Verification Bypass",
        category=VulnerabilityCategory.AUTHENTICATION,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-347",
        cwe_title="Improper Verification of Cryptographic Signature",
        severity=Severity.CRITICAL,
        endpoint="/api/v1/secure-vault",
        method="GET",
        parameter="Authorization Header",
        vulnerable_behavior="Inspects JWT header algorithm and skips cryptographic signature verification when alg is 'none' or unsigned, accepting forged admin claims.",
        fixed_behavior="Enforces strict cryptographic signature validation using HS256 with secret key, rejecting any unsigned or alg: none tokens.",
        detection_criteria="HTTP 200 granting access to sensitive vault secrets with unsigned token.",
        remediation_guidance="Enforce algorithms=['HS256'] in JWT decoder; never trust unauthenticated header parameters or accept unsigned tokens.",
        preconditions=[
            PreconditionStep(action="forge_token", role="anonymous", target_endpoint="/api/v1/secure-vault", description="Construct token with alg: none and role: admin")
        ],
        exploit_vectors=[
            ExploitVector(
                method="GET",
                endpoint="/api/v1/secure-vault",
                headers={"Authorization": "Bearer eyJhbGciOiAibm9uZSIgLCJ0eXAiOiAiSldUIn0.eyJzdWIiOiAiYXR0YWNrZXIiLCAicm9sZSI6ICJhZG1pbiIsICJ0ZW5hbnRfaWQiOiAib3JnX2FscGhhIiwgImV4cCI6IDk5OTk5OTk5OTl9."},
                payload_description="Forged JWT with header alg: none and admin role payload"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="vault_secrets_accessed_with_unsigned_jwt",
            fixed_status_codes=[401],
            fixed_indicator="unauthorized_invalid_or_unsigned_token",
            benign_status_codes=[200],
            benign_indicator="vault_accessed_with_valid_hs256_signed_token"
        )
    ),
    FixtureEntry(
        id="LAB-SSRF-001",
        name="Server-Side Request Forgery via Unrestricted Webhook Dispatch",
        category=VulnerabilityCategory.SSRF,
        classification=NoveltyClassification.KNOWN_TEST_FIXTURE,
        cwe="CWE-918",
        cwe_title="Server-Side Request Forgery (SSRF)",
        severity=Severity.CRITICAL,
        endpoint="/api/v1/webhooks/test",
        method="POST",
        parameter="target_url",
        vulnerable_behavior="Directly fetches user-supplied URL without destination host/IP resolution validation, allowing connections to loopback, RFC 1918 private networks, and cloud metadata.",
        fixed_behavior="Performs pre-socket DNS resolution and IP address validation, blocking private, loopback, link-local, multicast, and cloud metadata (169.254.169.254) addresses.",
        detection_criteria="Server makes outbound requests to internal addresses (127.0.0.1, 169.254.169.254) and returns response or connection status.",
        remediation_guidance="Resolve hostname to IP before establishing socket connection and reject all private/reserved IPv4 and IPv6 address ranges.",
        preconditions=[
            PreconditionStep(action="authenticate", role="member", target_endpoint="/api/v1/auth/login", description="Authenticate to submit webhook test requests")
        ],
        exploit_vectors=[
            ExploitVector(
                method="POST",
                endpoint="/api/v1/webhooks/test",
                body={"target_url": "http://127.0.0.1:8888/internal/status"},
                payload_description="Targeting local internal loopback service"
            ),
            ExploitVector(
                method="POST",
                endpoint="/api/v1/webhooks/test",
                body={"target_url": "http://169.254.169.254/latest/meta-data/"},
                payload_description="Targeting AWS/cloud instance metadata endpoint"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="internal_endpoint_queried_successfully",
            fixed_status_codes=[400, 403],
            fixed_indicator="forbidden_private_or_local_ip_rejected",
            benign_status_codes=[200, 400],
            benign_indicator="valid_external_domain_permitted"
        )
    ),
    FixtureEntry(
        id="CAND-001",
        name="Temporal State Desynchronization in Multi-Step Workflow Rollback",
        category=VulnerabilityCategory.STATE_MACHINE,
        classification=NoveltyClassification.NOVEL_CANDIDATE,
        cwe="CWE-863 / CWE-362",
        cwe_title="Incorrect Authorization / Concurrent Execution using Shared Resource with Improper Synchronization",
        severity=Severity.CRITICAL,
        endpoint="/api/v1/workflow/commit",
        method="POST",
        parameter="workflow_id",
        vulnerable_behavior="When an asynchronous workflow stage experiences a rollback or retry, the server clears the tenant context lock (tenant_context_lock = None). If commit logic accepts workflows with null lock, a cross-tenant actor (Tenant B) can commit and execute the workflow under Tenant A's authority.",
        fixed_behavior="Enforces immutable tenant context pinning and optimistic version locking across all state transitions and rollbacks, rejecting cross-tenant mutations with HTTP 403.",
        detection_criteria="Tenant B successfully commits and executes a workflow initiated by Tenant A.",
        remediation_guidance="Bind tenant ownership immutably to workflow entities and verify current user tenant_id matches workflow tenant_id at every transition regardless of state.",
        preconditions=[
            PreconditionStep(action="initiate_workflow", role="tenant_a_member", target_endpoint="/api/v1/workflow/initiate", description="Tenant A initiates workflow"),
            PreconditionStep(action="rollback_stage", role="tenant_a_member", target_endpoint="/api/v1/workflow/stage", description="Tenant A triggers rollback dissociating tenant lock")
        ],
        exploit_vectors=[
            ExploitVector(
                method="POST",
                endpoint="/api/v1/workflow/commit",
                headers={"Authorization": "Bearer {tenant_b_token}"},
                body={"workflow_id": "wf_alpha_101", "transition": "staged_to_approved"},
                payload_description="Tenant B issues commit on Tenant A's rolled-back workflow"
            )
        ],
        assertion_triggers=AssertionTrigger(
            vulnerable_status_codes=[200],
            vulnerable_indicator="cross_tenant_workflow_hijack_committed",
            fixed_status_codes=[403],
            fixed_indicator="cross_tenant_workflow_mutation_prohibited",
            benign_status_codes=[200],
            benign_indicator="tenant_a_executes_own_workflow_successfully"
        )
    )
]


class VulnerabilityRegistry:
    """
    Programmatic query and introspection interface for all laboratory fixtures.
    """

    def __init__(self, fixtures: Optional[List[FixtureEntry]] = None):
        self._fixtures: Dict[str, FixtureEntry] = {f.id: f for f in (fixtures or CANONICAL_FIXTURES)}

    def get_fixture(self, fixture_id: str) -> Optional[FixtureEntry]:
        """Retrieves a fixture by its identifier."""
        return self._fixtures.get(fixture_id)

    def list_fixtures(self) -> List[FixtureEntry]:
        """Returns all registered fixtures."""
        return list(self._fixtures.values())

    def get_by_cwe(self, cwe: str) -> List[FixtureEntry]:
        """Filters fixtures by CWE ID (e.g. 'CWE-89')."""
        return [f for f in self._fixtures.values() if cwe.lower() in f.cwe.lower()]

    def get_by_category(self, category: VulnerabilityCategory) -> List[FixtureEntry]:
        """Filters fixtures by vulnerability category."""
        return [f for f in self._fixtures.values() if f.category == category]

    def get_by_classification(self, classification: NoveltyClassification) -> List[FixtureEntry]:
        """Filters fixtures by novelty classification."""
        return [f for f in self._fixtures.values() if f.classification == classification]

    def to_dict(self) -> Dict[str, Any]:
        """Serializes registry to dictionary."""
        return {
            "version": "2.0.0",
            "lab_name": "Security Research Laboratory Ground-Truth Registry",
            "fixture_count": len(self._fixtures),
            "fixtures": [f.to_dict() for f in self._fixtures.values()]
        }

    def to_json(self, indent: int = 2) -> str:
        """Serializes registry to formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def to_yaml(self) -> str:
        """Serializes registry to YAML string."""
        return yaml.dump(self.to_dict(), sort_keys=False)

    def export_yaml(self, file_path: str) -> None:
        """Exports registry to YAML file."""
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(self.to_yaml())


# Global singleton instance and convenience functions
_GLOBAL_REGISTRY = VulnerabilityRegistry()


def get_registry() -> VulnerabilityRegistry:
    """Returns the global vulnerability registry instance."""
    return _GLOBAL_REGISTRY


def get_all_fixtures() -> List[FixtureEntry]:
    """Returns all canonical fixture entries."""
    return _GLOBAL_REGISTRY.list_fixtures()


def get_fixture_by_id(fixture_id: str) -> Optional[FixtureEntry]:
    """Retrieves a fixture entry by ID."""
    return _GLOBAL_REGISTRY.get_fixture(fixture_id)
