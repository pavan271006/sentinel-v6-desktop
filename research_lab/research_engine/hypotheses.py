"""
Formal Hypothesis Generators H1–H10 for Black-Box Security Research Engine.
"""

from typing import Dict, Any, List
from dataclasses import dataclass, field

@dataclass
class FormalHypothesis:
    id: str
    name: str
    category: str
    premise: str
    test_strategy: str
    target_tags: List[str]
    confidence_prior: float = 0.5

class HypothesisCatalog:
    """Generates structured formal research hypotheses H1–H10."""

    @staticmethod
    def get_all_hypotheses() -> List[FormalHypothesis]:
        return [
            FormalHypothesis(
                id="H-001",
                name="Temporal State Desynchronization in Compensation Rollbacks",
                category="State Machine",
                premise="Rollback transitions unpin tenant context locks, enabling cross-tenant state promotion during out-of-order execution.",
                test_strategy="Initiate under Tenant A, trigger rollback, attempt commit under Tenant B.",
                target_tags=["State Machine", "Workflows"],
                confidence_prior=0.9
            ),
            FormalHypothesis(
                id="H-002",
                name="Authorization Asymmetry in REST Entity Hierarchies (BOLA)",
                category="Authorization",
                premise="Direct resource IDs in URL paths lack tenant ownership predicate checks in database WHERE clauses.",
                test_strategy="Retrieve object IDs created by Tenant A using Tenant B session token.",
                target_tags=["Authorization", "Invoices"],
                confidence_prior=0.85
            ),
            FormalHypothesis(
                id="H-003",
                name="Role Escalation Gate Omission in Administrative Endpoints (BFLA)",
                category="Authorization",
                premise="Privileged endpoints check authentication presence but fail to assert role == 'admin'.",
                test_strategy="Execute administrative mutation endpoints using unprivileged member session.",
                target_tags=["Authorization", "Admin"],
                confidence_prior=0.85
            ),
            FormalHypothesis(
                id="H-004",
                name="Non-Atomic Concurrency Window in Multi-Step Balance Transfer (TOCTOU)",
                category="Concurrency",
                premise="Balance check and balance debit execute in separate non-atomic steps without row-level locking.",
                test_strategy="Dispatch burst of concurrent transfer requests exceeding current balance.",
                target_tags=["Concurrency", "Accounts"],
                confidence_prior=0.8
            ),
            FormalHypothesis(
                id="H-005",
                name="Cryptographic Signature Downgrade via Unsigned Alg: None Tokens",
                category="Authentication",
                premise="Token decoder accepts header-declared alg: none without server-side algorithm whitelisting.",
                test_strategy="Craft unsigned JWT with alg: none and admin claims.",
                target_tags=["Authentication", "Vault"],
                confidence_prior=0.8
            ),
            FormalHypothesis(
                id="H-006",
                name="Loopback Protocol & Private Network SSRF via Webhook Handlers",
                category="SSRF",
                premise="Server dispatches outbound webhooks without pre-socket private IP address filtering.",
                test_strategy="Submit loopback (127.0.0.1) and metadata (169.254.169.254) target URLs.",
                target_tags=["SSRF", "Webhooks"],
                confidence_prior=0.75
            ),
            FormalHypothesis(
                id="H-007",
                name="Unescaped HTML Entity Reflection in Dynamic View Renderers (XSS)",
                category="Injection",
                premise="Template preview endpoints reflect raw query parameters in text/html without encoding.",
                test_strategy="Inject script and image onerror payloads into preview endpoints.",
                target_tags=["Cross-Site Scripting", "Preview"],
                confidence_prior=0.8
            ),
            FormalHypothesis(
                id="H-008",
                name="Dynamic String Interpolation in Query Search Parsers (SQLi)",
                category="Injection",
                premise="Search endpoints format user inputs directly into SQL strings without parameter binding.",
                test_strategy="Inject boolean and UNION-based SQL breaking sequences.",
                target_tags=["Injection", "Search"],
                confidence_prior=0.85
            ),
            FormalHypothesis(
                id="H-009",
                name="Multi-Stage Business Logic State Mutation Bypass",
                category="Business Logic",
                premise="State machines allow jumping directly to terminal states by omitting intermediate transition requirements.",
                test_strategy="Call commit endpoints with uninitiated or invalid stage IDs.",
                target_tags=["State Machine", "Workflows"],
                confidence_prior=0.6
            ),
            FormalHypothesis(
                id="H-010",
                name="Session & Cryptographic Invariant Integrity Degradation",
                category="Authentication",
                premise="Session tokens persist across privilege modifications or accept corrupted token segments.",
                test_strategy="Replay expired or modified token payloads against protected views.",
                target_tags=["Authentication"],
                confidence_prior=0.65
            )
        ]
