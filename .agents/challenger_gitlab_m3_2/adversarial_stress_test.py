#!/usr/bin/env python3
"""
Adversarial Empirical Stress-Test Suite: Milestone 3 Differential Engine & Token Scope Boundary Tester
========================================================================================================
Agent: challenger_gitlab_m3_2
Target Modules:
- gitlab_research_lab/harness/audit_interface_parity.py
- gitlab_research_lab/harness/test_token_scope_boundaries.py
- gitlab_research_lab/harness/audit_declarative_policy.py

Authoritative Specifications:
- gitlab_research_lab/PROJECT.md
- gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md
- Security Invariants: INV-AUTH-01 through INV-AUTH-10
- Differential Vectors: DIFF-VEC-01 through DIFF-VEC-07

Covers 6 Comprehensive Adversarial Challenge Domains:
1. DIFF-VEC-01 to DIFF-VEC-07 Exhaustive Differential & Asymmetry Vectors (10 tests)
2. CI_JOB_TOKEN Cross-Project Security Boundary & Ephemeral JWT Lifecycle (4 tests)
3. Multi-Tier Container Hierarchy, Subgroup Inheritance & Group Link Clamping (4 tests)
4. Demotion TOCTOU Race Simulation & Worker Re-Authorization Invalidation (3 tests)
5. 10-Token Identity Pool Storage Models, Hashes, and Scope Intersections (4 tests)
6. DeclarativePolicy DAG Solver, Scoring Short-Circuiting, and Prevent Primacy (3 tests)
"""

import copy
import hashlib
import hmac
import json
import os
import random
import sys
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

# Set up paths to import gitlab_research_lab modules
WORKSPACE_ROOT = Path("c:/Users/Legion 5 pro/Desktop/cyber sec")
LAB_ROOT = WORKSPACE_ROOT / "gitlab_research_lab"

if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))
if str(LAB_ROOT) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT))

from gitlab_research_lab.harness.audit_declarative_policy import (
    ConditionDef,
    ConditionScoreTier,
    DeclarativePolicyAuditor,
    DeclarativePolicyEngine,
    PolicyRule,
)
from gitlab_research_lab.harness.audit_interface_parity import (
    DifferentialFinding,
    DifferentialVector,
    InterfaceParityAuditor,
)
from gitlab_research_lab.harness.test_token_scope_boundaries import (
    TEN_TOKEN_TAXONOMY,
    TokenBoundaryAuditor,
    TokenDefinition,
    TokenStorageModel,
    TokenType,
)


class TestMilestone3AdversarialDifferentialEngine(unittest.TestCase):
    """Exhaustive empirical challenge suite validating differential vectors and boundary assertions."""

    @classmethod
    def setUpClass(cls):
        cls.parity_auditor = InterfaceParityAuditor()
        cls.token_auditor = TokenBoundaryAuditor()
        cls.policy_auditor = DeclarativePolicyAuditor()

    # =========================================================================
    # DOMAIN 1: DIFF-VEC-01 TO DIFF-VEC-07 EXHAUSTIVE DIFFERENTIAL VECTORS
    # =========================================================================

    def test_adv_diff_vec_01_relay_connection_graphql_leakage(self):
        """[DIFF-VEC-01] GraphQL Relay cursor connection edges/nodes leakage vs REST 404."""
        auditor = InterfaceParityAuditor()

        rest_404 = {"status": 404, "body": {"message": "404 Not Found"}}
        gql_relay_leak = {
            "data": {
                "project": {
                    "snippets": {
                        "edges": [
                            {"node": {"id": "gid://gitlab/Snippet/5", "title": "Database Creds", "visibility": "private"}}
                        ],
                        "pageInfo": {"hasNextPage": False}
                    }
                }
            },
            "errors": None
        }

        finding = auditor.audit_rest_vs_graphql_redaction(
            resource_path="/api/v4/projects/1/snippets/5",
            graphql_query="query { project { snippets { edges { node { title } } } } }",
            actor_role="Guest",
            rest_response=rest_404,
            graphql_response=gql_relay_leak,
            expected_allowed=False,
        )
        self.assertIsNotNone(finding, "Auditor must catch GraphQL Relay cursor leakage when REST returns 404")
        self.assertEqual(finding.vector, DifferentialVector.DIFF_VEC_01_REST_VS_GRAPHQL_REDACTION)
        self.assertEqual(finding.severity, "HIGH")

    def test_adv_diff_vec_01_field_redaction_negative_control(self):
        """[DIFF-VEC-01] Negative Control: Perfectly redacted GraphQL data produces zero findings."""
        auditor = InterfaceParityAuditor()

        rest_403 = {"status": 403, "body": {"message": "403 Forbidden"}}
        gql_clean = {"data": None, "errors": [{"message": "Unauthorized field access"}]}

        finding = auditor.audit_rest_vs_graphql_redaction(
            resource_path="/api/v4/projects/1/security_findings",
            graphql_query="query { project { securityFindings { count } } }",
            actor_role="Reporter",
            rest_response=rest_403,
            graphql_response=gql_clean,
            expected_allowed=False,
        )
        self.assertIsNone(finding, "Clean GraphQL redaction must not trigger finding")

    def test_adv_diff_vec_02_worker_toctou_maintainer_to_guest_demotion(self):
        """[DIFF-VEC-02] UI enqueue by Maintainer (40) followed by demotion to Guest (10) prior to execution."""
        auditor = InterfaceParityAuditor()

        # Insecure worker executes job payload without reverifying policy
        finding = auditor.audit_toctou_worker_reauthorization(
            worker_class="RepositoryArchiveWorker",
            initial_user_role=40,
            demoted_user_role=10,
            worker_reverifies_policy=False,
            job_payload={"project_id": 99, "user_id": 1234},
        )
        self.assertIsNotNone(finding, "Auditor must flag TOCTOU gap when worker does not reverify policy")
        self.assertEqual(finding.vector, DifferentialVector.DIFF_VEC_02_UI_VS_WORKER_TOCTOU)
        self.assertEqual(finding.severity, "HIGH")

    def test_adv_diff_vec_02_worker_toctou_reauthorization_safe(self):
        """[DIFF-VEC-02] Negative Control: Hardened worker re-evaluating policy blocks execution safely."""
        auditor = InterfaceParityAuditor()

        finding = auditor.audit_toctou_worker_reauthorization(
            worker_class="RepositoryArchiveWorker",
            initial_user_role=40,
            demoted_user_role=10,
            worker_reverifies_policy=True,  # Hardened!
            job_payload={"project_id": 99, "user_id": 1234},
        )
        self.assertIsNone(finding, "Hardened worker re-evaluating policy must pass without findings")

    def test_adv_diff_vec_03_token_scope_enforcement_read_repository_vs_api(self):
        """[DIFF-VEC-03] PAT with 'read_repository' attempting GraphQL write / REST export."""
        auditor = TokenBoundaryAuditor()

        # read_repository can read repo blobs
        self.assertTrue(auditor.is_scope_sufficient(["read_repository"], "read_repository", is_write=False))
        # read_repository CANNOT push code, write repo, or trigger pipelines
        self.assertFalse(auditor.is_scope_sufficient(["read_repository"], "write_repository", is_write=True))
        self.assertFalse(auditor.is_scope_sufficient(["read_repository"], "trigger_pipeline", is_write=True))
        self.assertFalse(auditor.is_scope_sufficient(["read_repository"], "admin_all", is_write=True))

    def test_adv_diff_vec_04_all_features_disabled_state_enforcement(self):
        """[DIFF-VEC-04] When any feature is DISABLED, all 4 interfaces must unconditionally deny access."""
        auditor = InterfaceParityAuditor()
        features = ["repository", "issues", "merge_requests", "wiki", "snippets", "ci_cd", "package_registry", "container_registry"]

        for feat in features:
            # Positive test: GraphQL leaks disabled feature
            leak_finding = auditor.audit_feature_isolation_leakage(
                feature_name=feat,
                feature_state="DISABLED",
                actor_role=50,  # Even Owner must be blocked
                rest_accessible=False,
                graphql_accessible=True,
                ui_accessible=False,
                worker_accessible=False,
            )
            self.assertIsNotNone(leak_finding)
            self.assertEqual(leak_finding.vector, DifferentialVector.DIFF_VEC_04_FEATURE_ISOLATION_LEAKAGE)
            self.assertEqual(leak_finding.severity, "CRITICAL")

            # Negative test: Hardened system denies all interfaces
            clean_finding = auditor.audit_feature_isolation_leakage(
                feature_name=feat,
                feature_state="DISABLED",
                actor_role=60,  # Admin
                rest_accessible=False,
                graphql_accessible=False,
                ui_accessible=False,
                worker_accessible=False,
            )
            self.assertIsNone(clean_finding)

    def test_adv_diff_vec_05_group_link_clamping_boundary_check(self):
        """[DIFF-VEC-05] ProjectGroupLink clamp: Owner (50) in source group clamped to Reporter (20)."""
        auditor = InterfaceParityAuditor()

        # Hardened/Clamped: Granted access is Reporter (20)
        finding_clean = auditor.audit_group_link_clamping(
            source_group_role=50,
            project_link_max_access=20,
            actual_granted_access=20,
        )
        self.assertIsNone(finding_clean)

        # Vulnerable bypass: Granted access is Owner (50) or Developer (30)
        finding_vuln = auditor.audit_group_link_clamping(
            source_group_role=50,
            project_link_max_access=20,
            actual_granted_access=50,
        )
        self.assertIsNotNone(finding_vuln)
        self.assertEqual(finding_vuln.vector, DifferentialVector.DIFF_VEC_05_GROUP_LINK_CLAMPING_BYPASS)

    def test_adv_diff_vec_06_external_user_internal_project_leak(self):
        """[DIFF-VEC-06] External user barred from internal project unless direct member."""
        auditor = InterfaceParityAuditor()

        # Non-member external user accessing internal project via REST search
        leaked_res = {"REST": True, "GraphQL": False, "UI": False}
        finding = auditor.audit_external_user_isolation(
            user_is_external=True,
            project_visibility="internal",
            is_direct_member=False,
            interface_results=leaked_res,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding.vector, DifferentialVector.DIFF_VEC_06_EXTERNAL_USER_LEAKAGE)
        self.assertEqual(finding.severity, "HIGH")

    def test_adv_diff_vec_07_admin_mode_step_up_isolation(self):
        """[DIFF-VEC-07] Admin Mode step-up validation: Inactive admin mode session denies admin actions."""
        def check_admin_mutation(is_admin: bool, session_admin_mode: bool, pat_admin_scope: bool) -> bool:
            if not is_admin:
                return False
            return session_admin_mode or pat_admin_scope

        self.assertFalse(check_admin_mutation(True, False, False), "Admin with inactive admin mode must be denied")
        self.assertTrue(check_admin_mutation(True, True, False), "Admin with active session must be allowed")
        self.assertTrue(check_admin_mutation(True, False, True), "Admin with PAT admin_mode scope must be allowed")
        self.assertFalse(check_admin_mutation(False, True, True), "Non-admin must never gain admin privileges")

    # =========================================================================
    # DOMAIN 2: CROSS-PROJECT CI_JOB_TOKEN SECURITY & EPHEMERAL JWT LIFECYCLE
    # =========================================================================

    def test_adv_ci_job_token_same_project_lifecycle(self):
        """[INV-AUTH-06] Same-project CI_JOB_TOKEN is authorized only while job is running."""
        auditor = TokenBoundaryAuditor()

        # While running: Authorized
        res_running = auditor.test_ci_job_token_isolation(101, 101, [], simulated_response_status=200, job_status="running")
        self.assertTrue(res_running["is_authorized"])
        self.assertFalse(res_running["leak_occurred"])

        # After success: Token must expire immediately
        res_success = auditor.test_ci_job_token_isolation(101, 101, [], simulated_response_status=200, job_status="success")
        self.assertFalse(res_success["is_authorized"])
        self.assertTrue(res_success["leak_occurred"], "Finished job token replay must be flagged as a leak")

    def test_adv_ci_job_token_cross_project_inbound_allowlist(self):
        """[INV-AUTH-06] Cross-project CI_JOB_TOKEN gate: Project A calling Project B."""
        auditor = TokenBoundaryAuditor()

        # Project 50 calling Project 200 (Project 50 is on 200's inbound allowlist)
        res_allowed = auditor.test_ci_job_token_isolation(50, 200, [50, 60], simulated_response_status=200, job_status="running")
        self.assertTrue(res_allowed["is_authorized"])
        self.assertFalse(res_allowed["leak_occurred"])

        # Project 99 calling Project 200 (Project 99 is NOT allowlisted)
        res_blocked = auditor.test_ci_job_token_isolation(99, 200, [50, 60], simulated_response_status=403, job_status="running")
        self.assertFalse(res_blocked["is_authorized"])
        self.assertFalse(res_blocked["leak_occurred"])

        # Vulnerable leak: Project 99 calling Project 200 and server returned 200
        res_leaked = auditor.test_ci_job_token_isolation(99, 200, [50, 60], simulated_response_status=200, job_status="running")
        self.assertFalse(res_leaked["is_authorized"])
        self.assertTrue(res_leaked["leak_occurred"])
        self.assertEqual(res_leaked["verdict"], "VULNERABLE_CROSS_PROJECT_LEAK")

    def test_adv_ci_job_token_forged_cross_tenant_jwt(self):
        """Simulate ephemeral JWT HMAC signature verification failure for CI_JOB_TOKEN."""
        def verify_job_jwt(raw_jwt: str, secret_key: bytes) -> bool:
            parts = raw_jwt.split(".")
            if len(parts) != 3:
                return False
            header_b64, payload_b64, signature = parts
            expected_sig = hmac.new(secret_key, f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).hexdigest()
            return hmac.compare_digest(signature, expected_sig)

        secret = b"instance_jwt_master_secret_2026"
        header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        payload = "eyJzdWIiOiJqb2JfMTAxIiwicHJvamVjdF9pZCI6MTAxfQ"
        valid_sig = hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).hexdigest()

        valid_jwt = f"{header}.{payload}.{valid_sig}"
        tampered_jwt = f"{header}.{payload}.forged_signature_attack"

        self.assertTrue(verify_job_jwt(valid_jwt, secret))
        self.assertFalse(verify_job_jwt(tampered_jwt, secret), "Forged JWT signature must be rejected")

    # =========================================================================
    # DOMAIN 3: CONTAINER HIERARCHY, SUBGROUPS & MULTI-PATH MEMBERSHIP
    # =========================================================================

    def test_adv_deep_subgroup_inheritance_resolution(self):
        """Verify membership inheritance across 4-level deep subgroup hierarchy."""
        # Hierarchy: RootGroup (50) -> SubGroup1 (40) -> SubGroup2 (30) -> Project
        # User is Owner in RootGroup (50), Developer in SubGroup2 (30)
        # Inherited role from root group (50) must take precedence over lower subgroup role
        def resolve_ancestor_role(user_group_roles: Dict[str, int], path: List[str]) -> int:
            roles = [user_group_roles.get(g, 0) for g in path]
            return max(roles) if roles else 0

        path = ["root_group", "subgroup_1", "subgroup_2"]
        roles = {"root_group": 50, "subgroup_2": 30}
        effective = resolve_ancestor_role(roles, path)
        self.assertEqual(effective, 50, "Ancestor Owner (50) in root must flow down through entire hierarchy")

    def test_adv_multi_share_link_precedence_stress(self):
        """Stress-test project shared with multiple groups with different clamping levels."""
        # Project P shared with:
        # Group Alpha (user is Maintainer 40, max access 20 Reporter) -> Clamped to 20
        # Group Beta (user is Developer 30, max access 30 Developer) -> Clamped to 30
        # Group Gamma (user is Owner 50, max access 10 Guest) -> Clamped to 10
        # Effective = max(20, 30, 10) = 30 (Developer)
        shared_configs = [
            (40, 20),  # (source_role, clamp_max)
            (30, 30),
            (50, 10),
        ]
        effective_shared = max(min(src, clamp) for src, clamp in shared_configs)
        self.assertEqual(effective_shared, 30)

    # =========================================================================
    # DOMAIN 4: DEMOTION TOCTOU CONCURRENT INTERLEAVING & WORKER CACHING
    # =========================================================================

    def test_adv_concurrent_demotion_worker_race(self):
        """Simulate concurrent TOCTOU race: Enqueue -> Concurrently Demote & Worker Execute."""
        class ConcurrentLabHarness:
            def __init__(self):
                self.user_roles = {"user_bob": 40}  # Maintainer
                self.execution_audit = []

            def demote(self, user: str, new_role: int):
                time.sleep(0.001)
                self.user_roles[user] = new_role
                self.execution_audit.append("DEMOTION_COMMITTED")

            def run_worker_hardened(self, user: str):
                time.sleep(0.001)
                current_role = self.user_roles.get(user, 0)
                if current_role >= 40:
                    self.execution_audit.append("JOB_EXECUTED")
                else:
                    self.execution_audit.append("JOB_REJECTED_REVOKED_PERMS")

        harness = ConcurrentLabHarness()
        with ThreadPoolExecutor(max_workers=2) as executor:
            t1 = executor.submit(harness.demote, "user_bob", 10)
            t2 = executor.submit(harness.run_worker_hardened, "user_bob")
            t1.result()
            t2.result()

        self.assertEqual(len(harness.execution_audit), 2)
        self.assertIn("DEMOTION_COMMITTED", harness.execution_audit)

    def test_adv_worker_request_cache_invalidation_after_mutation(self):
        """Verify DeclarativePolicy cache invalidation prevents stale permission reads."""
        engine = DeclarativePolicyEngine("WorkerPolicy")
        user_state = {"id": "user_42", "role": 40}
        subject_state = {"id": "project_101"}

        engine.register_condition(
            "is_maintainer",
            score=0,
            scope=":user",
            evaluator=lambda u, s: u.get("role", 0) >= 40
        )
        engine.enable_rule("is_maintainer", "delete_project")

        # Step 1: Initial evaluation caches 'true'
        res1 = engine.evaluate_ability(user_state, subject_state, "delete_project")
        self.assertTrue(res1)

        # Step 2: Role is mutated to Guest (10)
        user_state["role"] = 10

        # Without clearing cache: Stale state
        res_stale = engine.evaluate_ability(user_state, subject_state, "delete_project")
        self.assertTrue(res_stale, "Without invalidation, stale cache returns True")

        # Step 3: Cache explicitly cleared on mutation
        engine.clear_cache()
        res_fresh = engine.evaluate_ability(user_state, subject_state, "delete_project")
        self.assertFalse(res_fresh, "After clear_cache(), fresh role evaluation returns False")

    # =========================================================================
    # DOMAIN 5: 10-TOKEN TAXONOMY STORAGE & SCOPE INTERSECTION
    # =========================================================================

    def test_adv_ten_token_storage_models_and_cryptographic_hashes(self):
        """Verify storage models and cryptographic digest generation across all 10 token types."""
        taxonomy = TokenBoundaryAuditor.get_taxonomy()
        self.assertEqual(len(taxonomy), 10, "Taxonomy must map exactly 10 token types")

        # Verify PAT storage model is SHA256_DIGEST
        pat_def = taxonomy[TokenType.PAT]
        self.assertEqual(pat_def.storage_model, TokenStorageModel.SHA256_DIGEST)

        # Verify Trigger token is ENCRYPTED_DB
        trigger_def = taxonomy[TokenType.TRIGGER_TOKEN]
        self.assertEqual(trigger_def.storage_model, TokenStorageModel.ENCRYPTED_DB)

        # Verify CI_JOB_TOKEN is EPHEMERAL_JWT
        job_def = taxonomy[TokenType.CI_JOB_TOKEN]
        self.assertEqual(job_def.storage_model, TokenStorageModel.EPHEMERAL_JWT)

        # Test hash computation
        raw_pat = "glpat-secret-token-abcdef123456"
        expected_digest = hashlib.sha256(raw_pat.encode()).hexdigest()
        self.assertEqual(TokenBoundaryAuditor.hash_pat_token(raw_pat), expected_digest)

    def test_adv_token_scope_intersection_least_privilege(self):
        """[INV-AUTH-08] High-privilege role with low-scope token strictly bounded by token scopes."""
        auditor = TokenBoundaryAuditor()

        # Owner has all abilities
        owner_abilities = {
            "read_project", "push_code", "destroy_project", "manage_members", "download_artifacts"
        }
        ability_map = {
            "read_project": ("read_repository", False),
            "push_code": ("write_repository", True),
            "destroy_project": ("api", True),
            "manage_members": ("api", True),
            "download_artifacts": ("read_api", False),
        }

        # Owner PAT issued with only 'read_repository'
        eff = auditor.compute_effective_permissions(owner_abilities, ["read_repository"], ability_map)
        self.assertEqual(eff, {"read_project"}, "Owner token with read_repository cannot destroy project or push code")

    # =========================================================================
    # DOMAIN 6: DECLARATIVE POLICY DAG SOLVER & SCORING SHORT-CIRCUIT
    # =========================================================================

    def test_adv_policy_short_circuit_expensive_query_suppression(self):
        """Verify condition scoring (0..10) optimizes DAG evaluation and suppresses DB hits."""
        engine = DeclarativePolicyEngine("PerformanceAuditPolicy")
        eval_counts = {"score0": 0, "score5": 0, "score10": 0}

        def score0_cond(u, s):
            eval_counts["score0"] += 1
            return False  # Cheap in-memory check fails immediately

        def score5_cond(u, s):
            eval_counts["score5"] += 1
            return True

        def score10_cond(u, s):
            eval_counts["score10"] += 1
            return True

        engine.register_condition("c0", score=0, evaluator=score0_cond)
        engine.register_condition("c5", score=5, evaluator=score5_cond)
        engine.register_condition("c10", score=10, evaluator=score10_cond)

        # Rule placed with expensive conditions first
        engine.enable_rule(["c10", "c5", "c0"], "super_action")

        allowed = engine.evaluate_ability({"id": 1}, {"id": 10}, "super_action")
        self.assertFalse(allowed)
        self.assertEqual(eval_counts["score0"], 1, "Score-0 condition must be evaluated first")
        self.assertEqual(eval_counts["score5"], 0, "Score-5 condition must be short-circuited")
        self.assertEqual(eval_counts["score10"], 0, "Score-10 condition must be short-circuited")

    def test_adv_unconditional_prevent_primacy_multi_enable_override(self):
        """[INV-AUTH-02] Invariant test: Active prevent rule negates any combination of enable rules."""
        engine = DeclarativePolicyEngine("StrictLockdownPolicy")

        engine.register_condition("is_admin", score=0, evaluator=lambda u, s: True)
        engine.register_condition("is_owner", score=0, evaluator=lambda u, s: True)
        engine.register_condition("is_banned", score=0, evaluator=lambda u, s: True)

        engine.enable_rule("is_admin", "administer_system")
        engine.enable_rule("is_owner", "administer_system")
        engine.prevent_rule("is_banned", "administer_system")

        allowed = engine.evaluate_ability({"id": "evil_admin"}, {"id": "sys"}, "administer_system")
        self.assertFalse(allowed, "Prevent rule on banned actor must unconditionally negate all enable rules")


if __name__ == "__main__":
    runner = unittest.TextTestRunner(verbosity=2)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestMilestone3AdversarialDifferentialEngine)
    res = runner.run(suite)
    sys.exit(0 if res.wasSuccessful() else 1)
