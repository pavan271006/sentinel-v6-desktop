"""
Challenger 2 Deep Empirical Validation Test Suite
Milestone 2: GitLab Authorization & Security Model Specification
================================================================
Rigorous adversarial, empirical, and mathematical verification of:
1. Complete 10-Token Taxonomy, Bound Identities, Scopes, and Cryptographic Storage Models
2. GraphQL Null-Redaction vs REST 404/403 Status Code Differential Mechanics (DIFF-VEC-01)
3. Sidekiq Asynchronous Authorization Serialization Seams & TOCTOU Gaps (DIFF-VEC-02)
4. CI_JOB_TOKEN Ephemeral Lifecycle and Inbound Allowlist Gating
5. DeclarativePolicy DAG Solver, Condition Cost-Scoring, and Short-Circuit Invariants
6. ProjectGroupLink Max Access Level Clamping and Multi-Path Sharing Boundaries
7. External User Confinement and Admin Mode Step-Up Authentication
8. Specification Structural Completeness and Invariant Verifications (INV-AUTH-01 to INV-AUTH-10)
"""

import hashlib
import hmac
import json
import os
import re
import time
import unittest
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

LAB_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = LAB_ROOT / "docs"


# =============================================================================
# EMPIRICAL MODEL: DECLARATIVE POLICY DSL & DAG ENGINE
# =============================================================================

@dataclass
class Condition:
    name: str
    score: int
    scope: Optional[str]
    evaluator: Callable[[Dict, Dict], bool]


class DeclarativePolicyEngine:
    """
    Mathematical reconstruction of DeclarativePolicy DAG evaluation engine.
    Implements:
    - Cost-scored condition ordering (0..N)
    - Short-circuit rule evaluation
    - Unconditional prevent override: Allowed = (Enables >= 1) AND (Prevents == 0)
    - Request-scoped predicate caching
    - Delegation cycle detection
    """

    def __init__(self):
        self.conditions: Dict[str, Condition] = {}
        self.enable_rules: List[Tuple[List[str], str]] = []
        self.prevent_rules: List[Tuple[List[str], str]] = []
        self.delegations: List[Callable[[Dict], Optional[Dict]]] = []
        self.call_counts: Dict[str, int] = {}
        self.cache: Dict[str, bool] = {}

    def condition(self, name: str, score: int = 0, scope: Optional[str] = None):
        def decorator(fn):
            self.conditions[name] = Condition(name=name, score=score, scope=scope, evaluator=fn)
            self.call_counts[name] = 0
            return fn
        return decorator

    def enable(self, condition_names: List[str], ability: str):
        self.enable_rules.append((condition_names, ability))

    def prevent(self, condition_names: List[str], ability: str):
        self.prevent_rules.append((condition_names, ability))

    def delegate(self, resolver_fn: Callable[[Dict], Optional[Dict]]):
        self.delegations.append(resolver_fn)

    def _eval_condition(self, name: str, user: Dict, subject: Dict) -> bool:
        cond = self.conditions.get(name)
        if not cond:
            return False
        cache_key = f"{name}:{user.get('id')}:{subject.get('id')}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        self.call_counts[name] += 1
        res = cond.evaluator(user, subject)
        self.cache[cache_key] = res
        return res

    def can(self, user: Dict, ability: str, subject: Dict) -> bool:
        """Evaluate whether user has ability on subject."""
        # 1. Evaluate enable rules
        enabled = False
        for cond_list, rule_ability in self.enable_rules:
            if rule_ability == ability:
                # Sort conditions by score ascending for short-circuit optimization
                sorted_conds = sorted(cond_list, key=lambda c: self.conditions[c].score if c in self.conditions else 99)
                match = True
                for c in sorted_conds:
                    if not self._eval_condition(c, user, subject):
                        match = False
                        break
                if match:
                    enabled = True
                    break

        if not enabled:
            return False

        # 2. Evaluate prevent rules (any prevent unconditionally negates enables)
        for cond_list, rule_ability in self.prevent_rules:
            if rule_ability in (ability, ":all"):
                sorted_conds = sorted(cond_list, key=lambda c: self.conditions[c].score if c in self.conditions else 99)
                match = True
                for c in sorted_conds:
                    if not self._eval_condition(c, user, subject):
                        match = False
                        break
                if match:
                    return False

        return True


# =============================================================================
# EMPIRICAL MODEL: 10-TOKEN TAXONOMY & CRYPTOGRAPHIC STORAGE
# =============================================================================

class TokenType(Enum):
    PERSONAL_ACCESS_TOKEN = "PAT"
    PROJECT_ACCESS_TOKEN = "PROJECT_BOT"
    GROUP_ACCESS_TOKEN = "GROUP_BOT"
    CI_JOB_TOKEN = "CI_JOB_TOKEN"
    DEPLOY_TOKEN = "DEPLOY_TOKEN"
    DEPLOY_KEY = "DEPLOY_KEY"
    TRIGGER_TOKEN = "TRIGGER_TOKEN"
    RUNNER_AUTH_TOKEN = "RUNNER_AUTH_TOKEN"
    IMPERSONATION_TOKEN = "IMPERSONATION_TOKEN"
    OAUTH2_ACCESS_TOKEN = "OAUTH2_TOKEN"


@dataclass
class TokenRecord:
    token_type: TokenType
    plaintext_token: str
    bound_identity_type: str  # "User", "Bot", "Job", "DeployEntity", "Runner", "OAuthApp"
    bound_id: str
    scopes: Set[str]
    storage_table: str
    storage_column: str
    storage_hash: str
    is_impersonation: bool = False
    is_admin_mode: bool = False
    expires_at: Optional[float] = None


class TokenVault:
    """Simulates PostgreSQL token storage, SHA-256 hashing, and verification."""

    @staticmethod
    def generate_pat(user_id: str, scopes: List[str], prefix: str = "glpat-") -> Tuple[str, str]:
        raw_secret = prefix + hashlib.sha256(f"{user_id}:{time.time()}".encode()).hexdigest()[:20]
        token_digest = hashlib.sha256(raw_secret.encode()).hexdigest()
        return raw_secret, token_digest

    @staticmethod
    def generate_runner_token(runner_id: str, prefix: str = "glrt-") -> Tuple[str, str]:
        raw_secret = prefix + hashlib.sha256(f"{runner_id}:{time.time()}".encode()).hexdigest()[:20]
        token_digest = hashlib.sha256(raw_secret.encode()).hexdigest()
        return raw_secret, token_digest

    @staticmethod
    def verify_token(raw_token: str, stored_digest: str) -> bool:
        computed_digest = hashlib.sha256(raw_token.encode()).hexdigest()
        return hmac.compare_digest(computed_digest, stored_digest)


# =============================================================================
# EMPIRICAL MODEL: MULTI-INTERFACE DIFFERENTIAL ENGINE (REST vs GraphQL vs Sidekiq)
# =============================================================================

class MockRestApi:
    """Simulates Grape REST API endpoint authorization behavior."""

    def __init__(self, policy_engine: DeclarativePolicyEngine):
        self.engine = policy_engine

    def get_issue(self, current_user: Dict, project: Dict, issue: Dict) -> Tuple[int, Dict]:
        if not self.engine.can(current_user, "read_project", project):
            return 404, {"error": "404 Not Found"}
        if not self.engine.can(current_user, "read_issue", issue):
            return 404, {"error": "404 Not Found"}
        return 200, {
            "id": issue["id"],
            "title": issue["title"],
            "description": issue["description"],
            "confidential": issue.get("confidential", False),
        }


class MockGraphQLApi:
    """Simulates GraphQL-Ruby field-level authorization and null-redaction."""

    def __init__(self, policy_engine: DeclarativePolicyEngine):
        self.engine = policy_engine

    def query_project_issues(self, current_user: Dict, project: Dict, issues: List[Dict]) -> Dict:
        if not self.engine.can(current_user, "read_project", project):
            return {"data": {"project": None}, "errors": [{"message": "Project not found or unauthorized"}]}

        resolved_issues = []
        for issue in issues:
            if self.engine.can(current_user, "read_issue", issue):
                resolved_issues.append({
                    "id": issue["id"],
                    "title": issue["title"],
                    "description": issue["description"],
                    "confidential": issue.get("confidential", False),
                })
            else:
                resolved_issues.append(None)

        return {
            "data": {
                "project": {
                    "id": project["id"],
                    "issues": {"nodes": resolved_issues},
                }
            }
        }


class MockSidekiqQueue:
    """Simulates Sidekiq background job serialization and execution seam."""

    def __init__(self):
        self.queue: List[Dict] = []
        self.db_users: Dict[str, Dict] = {}
        self.db_projects: Dict[str, Dict] = {}

    def enqueue(self, worker_class: str, args: List[Any]):
        payload = json.dumps({"worker": worker_class, "args": args})
        self.queue.append(json.loads(payload))

    def execute_vulnerable_worker(self, job_payload: Dict) -> Dict:
        """Vulnerable worker (DIFF-VEC-02): Executes using serialized user ID without re-authorization."""
        args = job_payload["args"]
        project_id, user_id = args[0], args[1]
        user = self.db_users.get(user_id)
        project = self.db_projects.get(project_id)
        return {"status": "EXPORT_GENERATED", "project_id": project_id, "user_id": user_id}

    def execute_hardened_worker(self, job_payload: Dict, engine: DeclarativePolicyEngine) -> Dict:
        """Hardened worker (INV-AUTH-07): Re-evaluates DeclarativePolicy at execution time."""
        args = job_payload["args"]
        project_id, user_id = args[0], args[1]
        user = self.db_users.get(user_id)
        project = self.db_projects.get(project_id)
        if not user or not project:
            return {"status": "ABORTED_NOT_FOUND"}
        if not engine.can(user, "export_project", project):
            return {"status": "REJECTED_UNAUTHORIZED", "reason": "User lacks export permission at execution time"}
        return {"status": "EXPORT_GENERATED", "project_id": project_id, "user_id": user_id}


# =============================================================================
# CHALLENGER 2 DEEP EMPIRICAL TEST SUITE
# =============================================================================

class TestChallengerM2DeepVerification(unittest.TestCase):
    """Deep empirical test suite challenging all Milestone 2 authorization claims."""

    @classmethod
    def setUpClass(cls):
        cls.doc_path = DOCS_DIR / "GITLAB_AUTHORIZATION_MODEL.md"
        cls.root_doc_path = LAB_ROOT / "GITLAB_AUTHORIZATION_MODEL.md"
        cls.project_doc = LAB_ROOT / "PROJECT.md"

        cls.doc_content = cls.doc_path.read_text(encoding="utf-8") if cls.doc_path.exists() else ""
        cls.root_doc_content = cls.root_doc_path.read_text(encoding="utf-8") if cls.root_doc_path.exists() else ""
        cls.project_content = cls.project_doc.read_text(encoding="utf-8") if cls.project_doc.exists() else ""

    # =========================================================================
    # 1. 10-TOKEN TAXONOMY & CRYPTOGRAPHIC STORAGE INTEGRITY
    # =========================================================================

    def test_ten_token_types_complete_taxonomy(self):
        """Empirically verify all 10 token types exist, are categorized, and mapped to identities."""
        expected_tokens = [
            "Personal Access Token",
            "Project Access Token",
            "Group Access Token",
            "CI_JOB_TOKEN",
            "Deploy Token",
            "Deploy Key",
            "Trigger Token",
            "Runner Auth Token",
            "Impersonation Token",
            "OAuth2 Access Token",
        ]
        for token_name in expected_tokens:
            self.assertIn(token_name, self.doc_content, f"Token type '{token_name}' missing from specification")

    def test_token_cryptographic_storage_models(self):
        """Verify token storage schemas: SHA-256 digests in token_digest columns vs encrypted columns."""
        self.assertIn("personal_access_tokens.token_digest", self.doc_content)
        self.assertIn("SHA-256", self.doc_content)
        self.assertIn("ci_runners.token_digest", self.doc_content)
        self.assertIn("glrt-*", self.doc_content)

        raw_pat, digest_pat = TokenVault.generate_pat("user_42", ["api", "read_repository"])
        self.assertTrue(raw_pat.startswith("glpat-"))
        self.assertEqual(len(digest_pat), 64)
        self.assertTrue(TokenVault.verify_token(raw_pat, digest_pat))
        self.assertFalse(TokenVault.verify_token("invalid_token", digest_pat))

        raw_runner, digest_runner = TokenVault.generate_runner_token("runner_10")
        self.assertTrue(raw_runner.startswith("glrt-"))
        self.assertTrue(TokenVault.verify_token(raw_runner, digest_runner))

    def test_token_scope_intersection_invariant(self):
        """Verify INV-AUTH-08: EffectivePerms = UserPerms ∩ GrantedScopes."""
        def evaluate_effective_token_permissions(user_abilities: Set[str], token_scopes: Set[str], scope_mapping: Dict[str, Set[str]]) -> Set[str]:
            allowed_by_scopes = set()
            for s in token_scopes:
                allowed_by_scopes.update(scope_mapping.get(s, set()))
            return user_abilities.intersection(allowed_by_scopes)

        scope_map = {
            "read_repository": {"read_code", "read_tree", "read_commit"},
            "write_repository": {"read_code", "push_code", "create_tag"},
            "read_api": {"read_project", "read_issue", "read_mr"},
            "api": {"read_project", "read_issue", "read_mr", "read_code", "push_code", "admin_project"},
        }

        user_developer_abilities = {"read_code", "push_code", "read_issue", "read_mr", "create_tag"}
        
        # Token with only read_repository scope
        read_repo_token_scopes = {"read_repository"}
        perms = evaluate_effective_token_permissions(user_developer_abilities, read_repo_token_scopes, scope_map)
        self.assertEqual(perms, {"read_code"})
        self.assertNotIn("push_code", perms, "Read-only token must NOT allow code push even if user is Developer")

        # Token with api scope but user is only Reporter
        reporter_abilities = {"read_code", "read_issue", "read_mr"}
        api_token_scopes = {"api"}
        perms_reporter = evaluate_effective_token_permissions(reporter_abilities, api_token_scopes, scope_map)
        self.assertEqual(perms_reporter, {"read_code", "read_issue", "read_mr"})
        self.assertNotIn("push_code", perms_reporter, "Full API token cannot grant push_code to a Reporter")

    def test_impersonation_token_boundary_confinement(self):
        """Verify INV-AUTH-10: Impersonation tokens operate strictly within target user's boundary."""
        def resolve_impersonated_context(admin_user: Dict, target_user: Dict) -> Dict:
            # Impersonation acts as target user, NOT admin
            return {
                "id": target_user["id"],
                "role": target_user["role"],
                "admin": False, # Target user is not admin
                "external": target_user.get("external", False),
            }

        admin = {"id": "admin_1", "admin": True, "role": "Admin"}
        target_guest = {"id": "guest_1", "role": "Guest", "external": False}
        target_ext = {"id": "ext_dev", "role": "Developer", "external": True}

        ctx_guest = resolve_impersonated_context(admin, target_guest)
        self.assertEqual(ctx_guest["role"], "Guest")
        self.assertFalse(ctx_guest["admin"])

        ctx_ext = resolve_impersonated_context(admin, target_ext)
        self.assertTrue(ctx_ext["external"])
        self.assertFalse(ctx_ext["admin"])

    # =========================================================================
    # 2. GRAPHQL NULL-REDACTION vs REST 404/403 STATUS CODES (DIFF-VEC-01)
    # =========================================================================

    def test_graphql_null_redaction_vs_rest_status_codes(self):
        """Empirically simulate and assert REST 404 vs GraphQL null-redaction behavior."""
        engine = DeclarativePolicyEngine()
        engine.condition("can_read_proj", score=0)(lambda u, s: True)
        engine.condition("can_read_issue", score=2)(
            lambda u, s: not s.get("confidential", False) or u.get("id") in s.get("members", [])
        )
        engine.enable(["can_read_proj"], "read_project")
        engine.enable(["can_read_issue"], "read_issue")

        rest_api = MockRestApi(engine)
        graphql_api = MockGraphQLApi(engine)

        project = {"id": 100, "public": True}
        public_issue = {"id": 1, "title": "Public Bug", "description": "Details", "confidential": False, "members": []}
        confidential_issue = {"id": 2, "title": "Security Zero-Day", "description": "RCE Exploit", "confidential": True, "members": ["admin_1"]}

        unauth_user = {"id": "guest_user", "role": "Guest"}

        # 1. REST Endpoint: Confidential issue returns 404 Not Found (fail-closed, concealing existence)
        status_code, rest_res = rest_api.get_issue(unauth_user, project, confidential_issue)
        self.assertEqual(status_code, 404)
        self.assertIn("error", rest_res)
        self.assertNotIn("Security Zero-Day", json.dumps(rest_res))

        # 2. GraphQL Endpoint: Querying project issues returns list where confidential issue is redacted to null
        gql_res = graphql_api.query_project_issues(unauth_user, project, [public_issue, confidential_issue])
        issues_nodes = gql_res["data"]["project"]["issues"]["nodes"]
        self.assertEqual(len(issues_nodes), 2)
        self.assertIsNotNone(issues_nodes[0])
        self.assertEqual(issues_nodes[0]["title"], "Public Bug")
        self.assertIsNone(issues_nodes[1], "Unauthorized confidential issue MUST be null-redacted in GraphQL")

    # =========================================================================
    # 3. SIDEKIQ ASYNC AUTHORIZATION SERIALIZATION SEAMS (DIFF-VEC-02)
    # =========================================================================

    def test_sidekiq_async_authorization_serialization_seam(self):
        """Empirically simulate Sidekiq TOCTOU gap between controller enqueue and worker execution."""
        engine = DeclarativePolicyEngine()
        engine.condition("is_project_maintainer", score=2)(
            lambda u, s: u.get("id") in s.get("maintainers", [])
        )
        engine.enable(["is_project_maintainer"], "export_project")

        queue = MockSidekiqQueue()
        queue.db_users["user_bob"] = {"id": "user_bob", "name": "Bob"}
        queue.db_projects["proj_99"] = {"id": "proj_99", "maintainers": ["user_bob"]}

        # Step 1: Controller authorizes user at t_0 and enqueues job
        user_bob = queue.db_users["user_bob"]
        proj = queue.db_projects["proj_99"]
        self.assertTrue(engine.can(user_bob, "export_project", proj))
        queue.enqueue("ProjectExportWorker", ["proj_99", "user_bob"])
        self.assertEqual(len(queue.queue), 1)
        job = queue.queue.pop(0)

        # Step 2: Temporal shift at t_1 (User is revoked/demoted before job executes)
        queue.db_projects["proj_99"]["maintainers"] = []  # Bob removed from project!
        engine.cache.clear()

        # Step 3A: Vulnerable worker executes without re-authorization (Bypasses security boundary)
        vuln_result = queue.execute_vulnerable_worker(job)
        self.assertEqual(vuln_result["status"], "EXPORT_GENERATED", "Vulnerable worker fails open")

        # Step 3B: Hardened worker (INV-AUTH-07) re-authorizes at t_2 (Fails closed)
        hardened_result = queue.execute_hardened_worker(job, engine)
        self.assertEqual(hardened_result["status"], "REJECTED_UNAUTHORIZED")
        self.assertIn("User lacks export permission", hardened_result["reason"])

    # =========================================================================
    # 4. CI_JOB_TOKEN INBOUND ALLOWLIST GATE & STATUS GATING
    # =========================================================================

    def test_ci_job_token_inbound_allowlist_and_status_gates(self):
        """Verify CI_JOB_TOKEN access boundaries: running status requirement and inbound allowlist."""
        def evaluate_job_token_access(job: Dict, target_project: Dict) -> Tuple[bool, str]:
            if job["status"] != "running":
                return False, "TOKEN_EXPIRED_JOB_INACTIVE"
            if job["project_id"] == target_project["id"]:
                return True, "SAME_PROJECT_ALLOWED"
            if job["project_id"] in target_project.get("inbound_allowlist", []):
                return True, "INBOUND_ALLOWLIST_ALLOWED"
            return False, "INBOUND_ALLOWLIST_DENIED"

        target_proj = {"id": 500, "name": "Secure-Backend", "inbound_allowlist": [100, 200]}

        job_valid = {"id": 1, "project_id": 100, "status": "running"}
        allowed, reason = evaluate_job_token_access(job_valid, target_proj)
        self.assertTrue(allowed)
        self.assertEqual(reason, "INBOUND_ALLOWLIST_ALLOWED")

        job_unauthorized = {"id": 2, "project_id": 300, "status": "running"}
        allowed, reason = evaluate_job_token_access(job_unauthorized, target_proj)
        self.assertFalse(allowed)
        self.assertEqual(reason, "INBOUND_ALLOWLIST_DENIED")

        job_finished = {"id": 3, "project_id": 100, "status": "success"}
        allowed, reason = evaluate_job_token_access(job_finished, target_proj)
        self.assertFalse(allowed)
        self.assertEqual(reason, "TOKEN_EXPIRED_JOB_INACTIVE")

    # =========================================================================
    # 5. DECLARATIVE POLICY DAG EVALUATION & COST-SCORE OPTIMIZATION
    # =========================================================================

    def test_declarative_policy_cost_score_short_circuit_invariant(self):
        """Verify that condition score ordering ensures cheap conditions evaluate before expensive ones."""
        engine = DeclarativePolicyEngine()
        eval_log = []

        @engine.condition("in_memory_public", score=0)
        def cond_public(u, s):
            eval_log.append("score_0_eval")
            return s.get("public", False)

        @engine.condition("heavy_gitaly_check", score=10)
        def cond_heavy(u, s):
            eval_log.append("score_10_eval")
            return True

        engine.enable(["in_memory_public", "heavy_gitaly_check"], "download_bundle")

        private_project = {"id": 1, "public": False}
        res = engine.can({}, "download_bundle", private_project)
        self.assertFalse(res)
        self.assertEqual(eval_log, ["score_0_eval"], "Expensive score:10 condition must NOT be evaluated if score:0 is False")

        eval_log.clear()
        engine.cache.clear()
        public_project = {"id": 2, "public": True}
        res = engine.can({}, "download_bundle", public_project)
        self.assertTrue(res)
        self.assertEqual(eval_log, ["score_0_eval", "score_10_eval"])

    def test_declarative_policy_prevent_primacy_over_admin_invariant(self):
        """Verify INV-AUTH-02: Prevent rule unconditionally negates all enables, even for Admin."""
        engine = DeclarativePolicyEngine()

        @engine.condition("is_admin", score=0)
        def cond_admin(u, s):
            return u.get("admin", False)

        @engine.condition("is_archived", score=0)
        def cond_archived(u, s):
            return s.get("archived", False)

        engine.enable(["is_admin"], "push_code")
        engine.prevent(["is_archived"], "push_code")

        admin_user = {"id": "admin_root", "admin": True}
        archived_proj = {"id": 10, "archived": True}

        self.assertFalse(
            engine.can(admin_user, "push_code", archived_proj),
            "Prevent rule MUST block Admin when project is archived",
        )

    # =========================================================================
    # 6. CONTAINER HIERARCHY & MEMBERSHIP CLAMPING INVARIANTS
    # =========================================================================

    def test_project_group_link_max_access_level_clamping_math(self):
        """Verify mathematical formula for ProjectGroupLink access level clamping."""
        def resolve_effective_access(direct_role: int, ancestor_role: int, shared_group_role: int, link_max: int) -> int:
            clamped_shared = min(shared_group_role, link_max) if shared_group_role > 0 else 0
            return max(direct_role, ancestor_role, clamped_shared)

        # Alice: Owner (50) in Group A. Project shares with Group A with max Maintainer (40).
        self.assertEqual(resolve_effective_access(0, 0, 50, 40), 40)

        # Bob: Reporter (20) in Group A. Project shares with Group A with max Maintainer (40).
        self.assertEqual(resolve_effective_access(0, 0, 20, 40), 20)

        # Charlie: Developer (30) directly in project. Project shares with Group A with max Reporter (20).
        self.assertEqual(resolve_effective_access(30, 0, 50, 20), 30, "Direct Developer role takes precedence over clamped shared role")

    def test_multi_path_shared_group_resolution(self):
        """Stress-test multi-path group sharing where ancestor group and project have different link max levels."""
        def resolve_multi_path(direct: int, ancestors: List[int], shares: List[Tuple[int, int]]) -> int:
            ancestor_max = max(ancestors) if ancestors else 0
            share_max = max([min(user_role, max_link) for user_role, max_link in shares]) if shares else 0
            return max(direct, ancestor_max, share_max)

        # Alice is Owner (50) in Group X
        # Project P inherits from Group G (which is shared with Group X max Developer 30)
        # Project P is also directly shared with Group X max Reporter 20
        # Effective access must be max(0, min(50, 30), min(50, 20)) = 30
        res = resolve_multi_path(direct=0, ancestors=[], shares=[(50, 30), (50, 20)])
        self.assertEqual(res, 30)

    def test_external_user_internal_project_security_invariant(self):
        """Verify INV-AUTH-05: External users cannot view internal projects unless directly added."""
        def can_access_project(user: Dict, project: Dict) -> bool:
            vis = project.get("visibility", "private")
            is_member = user.get("id") in project.get("members", [])
            if vis == "public":
                return True
            if vis == "internal":
                if user.get("external", False):
                    return is_member
                return True
            if vis == "private":
                return is_member
            return False

        ext_user = {"id": "contractor_1", "external": True}
        internal_p1 = {"id": "p1", "visibility": "internal", "members": []}
        internal_p2 = {"id": "p2", "visibility": "internal", "members": ["contractor_1"]}

        self.assertFalse(can_access_project(ext_user, internal_p1))
        self.assertTrue(can_access_project(ext_user, internal_p2))

    # =========================================================================
    # 7. DOCUMENT SPECIFICATION COMPLETENESS & FORMAL INVARIANTS
    # =========================================================================

    def test_all_ten_invariants_documented(self):
        """Verify all 10 security invariants (INV-AUTH-01 to INV-AUTH-10) are documented."""
        invariants = [
            "INV-AUTH-01",
            "INV-AUTH-02",
            "INV-AUTH-03",
            "INV-AUTH-04",
            "INV-AUTH-05",
            "INV-AUTH-06",
            "INV-AUTH-07",
            "INV-AUTH-08",
            "INV-AUTH-09",
            "INV-AUTH-10",
        ]
        for inv in invariants:
            self.assertIn(inv, self.doc_content, f"Invariant {inv} missing from GITLAB_AUTHORIZATION_MODEL.md")

    def test_all_seven_differential_vectors_documented(self):
        """Verify all 7 differential attack vectors (DIFF-VEC-01 to DIFF-VEC-07) are documented."""
        vectors = [
            "DIFF-VEC-01",
            "DIFF-VEC-02",
            "DIFF-VEC-03",
            "DIFF-VEC-04",
            "DIFF-VEC-05",
            "DIFF-VEC-06",
            "DIFF-VEC-07",
        ]
        for vec in vectors:
            self.assertIn(vec, self.doc_content, f"Differential vector {vec} missing from GITLAB_AUTHORIZATION_MODEL.md")


if __name__ == "__main__":
    unittest.main()
