"""
Independent Reviewer / Challenger Deep Test Suite - Milestone 3
===============================================================
Exhaustively stress-tests DeclarativePolicy DAG engine, condition cost ordering,
short-circuiting, prevent rule primacy, token scope boundaries, and differential vectors.
"""

import copy
import sys
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parent.parent
if str(LAB_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT.parent))
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


class TestDeclarativePolicyDAGAndDifferentialDeep(unittest.TestCase):
    """Deep adversarial test suite for Milestone 3."""

    def setUp(self):
        self.engine = DeclarativePolicyEngine("ProjectPolicy")
        self.auditor = DeclarativePolicyAuditor()
        self.parity_auditor = InterfaceParityAuditor()
        self.token_auditor = TokenBoundaryAuditor()

    # --- DeclarativePolicy Engine Tests ---

    def test_condition_cost_scoring_and_short_circuiting(self):
        """Stress-test condition sorting by cost score: cheap checks must prevent expensive ones."""
        call_log = []

        def cheap_false(u, s):
            call_log.append("score_0_cheap")
            return False

        def mid_query(u, s):
            call_log.append("score_2_db")
            return True

        def expensive_rpc(u, s):
            call_log.append("score_10_rpc")
            return True

        self.engine.register_condition("expensive_cond", score=10, evaluator=expensive_rpc)
        self.engine.register_condition("mid_cond", score=2, evaluator=mid_query)
        self.engine.register_condition("cheap_cond", score=0, evaluator=cheap_false)

        # Deliberately register rule with conditions out of order [10, 2, 0]
        self.engine.enable_rule(["expensive_cond", "mid_cond", "cheap_cond"], "admin_project")

        user = {"id": 1}
        subj = {"id": 100}

        allowed = self.engine.evaluate_ability(user, subj, "admin_project")
        self.assertFalse(allowed)
        # Because cheap_cond (score 0) is False, neither mid_cond (2) nor expensive_cond (10) should execute
        self.assertEqual(call_log, ["score_0_cheap"])

    def test_unconditional_prevent_primacy_invariant(self):
        """Verify mathematical invariant: Allowed(u,s,a) = (Enables >= 1) AND (Prevents == 0)."""
        self.engine.register_condition("always_true", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("prevent_flag", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("always_true", "push_code")
        self.engine.prevent_rule("prevent_flag", "push_code")

        user = {"id": 1}
        subj = {"id": 100}
        self.assertFalse(self.engine.evaluate_ability(user, subj, "push_code"))

    def test_prevent_all_with_except_abilities_filter(self):
        """Verify prevent_all blocks all abilities except explicitly whitelisted exceptions."""
        self.engine.register_condition("is_archived", score=0, evaluator=lambda u, s: s.get("archived", False))
        self.engine.register_condition("is_developer", score=1, evaluator=lambda u, s: True)

        self.engine.enable_rule("is_developer", "read_project")
        self.engine.enable_rule("is_developer", "download_code")
        self.engine.enable_rule("is_developer", "push_code")
        self.engine.enable_rule("is_developer", "create_issue")

        # Project is archived: block everything except read_project and download_code
        self.engine.prevent_all_rule("is_archived", except_abilities=["read_project", "download_code"])

        user = {"id": 1}
        archived_subj = {"id": 100, "archived": True}
        active_subj = {"id": 101, "archived": False}

        # On active project, all enabled abilities work
        self.assertTrue(self.engine.evaluate_ability(user, active_subj, "push_code"))
        self.assertTrue(self.engine.evaluate_ability(user, active_subj, "create_issue"))

        # On archived project, only excepted abilities work
        self.assertTrue(self.engine.evaluate_ability(user, archived_subj, "read_project"))
        self.assertTrue(self.engine.evaluate_ability(user, archived_subj, "download_code"))
        self.assertFalse(self.engine.evaluate_ability(user, archived_subj, "push_code"))
        self.assertFalse(self.engine.evaluate_ability(user, archived_subj, "create_issue"))

    def test_predicate_scoped_caching_and_cache_clearing(self):
        """Verify request-scoped caching across :user, :subject, :global, and composite scopes."""
        eval_counts = {"user": 0, "subj": 0, "glob": 0, "comp": 0}

        def eval_user(u, s):
            eval_counts["user"] += 1
            return True

        def eval_subj(u, s):
            eval_counts["subj"] += 1
            return True

        def eval_glob(u, s):
            eval_counts["glob"] += 1
            return True

        def eval_comp(u, s):
            eval_counts["comp"] += 1
            return True

        self.engine.register_condition("cond_u", score=1, scope=":user", evaluator=eval_user)
        self.engine.register_condition("cond_s", score=1, scope=":subject", evaluator=eval_subj)
        self.engine.register_condition("cond_g", score=1, scope=":global", evaluator=eval_glob)
        self.engine.register_condition("cond_c", score=1, scope=None, evaluator=eval_comp)

        self.engine.enable_rule("cond_u", "op_u1")
        self.engine.enable_rule("cond_u", "op_u2")
        self.engine.enable_rule("cond_s", "op_s1")
        self.engine.enable_rule("cond_s", "op_s2")
        self.engine.enable_rule("cond_g", "op_g1")
        self.engine.enable_rule("cond_g", "op_g2")
        self.engine.enable_rule("cond_c", "op_c1")
        self.engine.enable_rule("cond_c", "op_c2")

        user = {"id": 42}
        subj = {"id": 84}

        # First round of evaluations
        self.engine.evaluate_ability(user, subj, "op_u1")
        self.engine.evaluate_ability(user, subj, "op_s1")
        self.engine.evaluate_ability(user, subj, "op_g1")
        self.engine.evaluate_ability(user, subj, "op_c1")

        # Second round: should all hit cache
        self.engine.evaluate_ability(user, subj, "op_u2")
        self.engine.evaluate_ability(user, subj, "op_s2")
        self.engine.evaluate_ability(user, subj, "op_g2")
        self.engine.evaluate_ability(user, subj, "op_c2")

        self.assertEqual(eval_counts["user"], 1)
        self.assertEqual(eval_counts["subj"], 1)
        self.assertEqual(eval_counts["glob"], 1)
        self.assertEqual(eval_counts["comp"], 1)

        # Clear cache and evaluate again
        self.engine.clear_cache()
        self.engine.evaluate_ability(user, subj, "op_u1")
        self.assertEqual(eval_counts["user"], 2)

    def test_policy_inheritance_and_delegation_chain(self):
        """Verify child policy inherits rules and condition definitions from parent policy."""
        parent_policy = DeclarativePolicyEngine("BasePolicy")
        parent_policy.register_condition("is_admin", score=0, scope=":user", evaluator=lambda u, s: u.get("admin", False))
        parent_policy.enable_rule("is_admin", "admin_everything")

        child_policy = DeclarativePolicyEngine("ProjectPolicy", parent_policy=parent_policy)
        child_policy.register_condition("is_owner", score=1, scope=":subject", evaluator=lambda u, s: s.get("owner_id") == u.get("id"))
        child_policy.enable_rule("is_owner", "delete_project")

        admin_user = {"id": 1, "admin": True}
        owner_user = {"id": 2, "admin": False}
        proj = {"id": 10, "owner_id": 2}

        self.assertTrue(child_policy.evaluate_ability(admin_user, proj, "admin_everything"))
        self.assertTrue(child_policy.evaluate_ability(owner_user, proj, "delete_project"))
        self.assertFalse(child_policy.evaluate_ability(owner_user, proj, "admin_everything"))

    def test_negated_conditions_evaluation(self):
        """Verify negated condition expression `~condition_name`."""
        self.engine.register_condition("is_blocked", score=0, evaluator=lambda u, s: u.get("blocked", False))
        self.engine.enable_rule("~is_blocked", "view_site")

        user_blocked = {"id": 1, "blocked": True}
        user_ok = {"id": 2, "blocked": False}
        subj = {"id": 100}

        self.assertFalse(self.engine.evaluate_ability(user_blocked, subj, "view_site"))
        self.assertTrue(self.engine.evaluate_ability(user_ok, subj, "view_site"))

    # --- Policy Auditor Tests ---

    def test_policy_auditor_reports_and_efficiency(self):
        """Verify DeclarativePolicyAuditor flags unprotected dangerous abilities and measures query savings."""
        conditions = [
            {"name": "is_public", "score": 0},
            {"name": "is_member", "score": 2},
            {"name": "ldap_sync", "score": 10},
        ]
        # Unprotected dangerous ability
        rules = [
            {"action": "enable", "conditions": ["is_public"], "ability": "destroy_project"},
            {"action": "enable", "conditions": ["ldap_sync", "is_public"], "ability": "sync"},
        ]
        report = self.auditor.audit_policy_graph("VulnerablePolicy", conditions, rules)
        self.assertIn("destroy_project", report["unprotected_dangerous_abilities"])
        self.assertFalse(report["has_prevent_rules"])
        self.assertEqual(report["status"], "WARNING_NO_PREVENT_OVERRIDE")
        self.assertFalse(report["short_circuit_optimal"])

        # Short-circuit simulation
        self.engine.register_condition("fail_cheap", score=0, evaluator=lambda u, s: False)
        self.engine.register_condition("heavy_cte", score=5, evaluator=lambda u, s: True)
        self.engine.register_condition("heavy_rpc", score=10, evaluator=lambda u, s: True)
        self.engine.enable_rule(["heavy_rpc", "heavy_cte", "fail_cheap"], "expensive_ability")

        sim_res = self.auditor.simulate_short_circuit_efficiency(
            self.engine, {"id": 1}, {"id": 10}, "expensive_ability"
        )
        self.assertFalse(sim_res["allowed"])
        self.assertEqual(sim_res["execution_counts"]["fail_cheap"], 1)
        self.assertEqual(sim_res["execution_counts"]["heavy_cte"], 0)
        self.assertEqual(sim_res["execution_counts"]["heavy_rpc"], 0)
        self.assertEqual(sim_res["expensive_queries_skipped"], 2)

    # --- Interface Parity Auditor Tests ---

    def test_interface_parity_vectors_01_through_07(self):
        """Verify all 7 differential vector audit methods."""
        # DIFF-VEC-01
        f1 = self.parity_auditor.audit_rest_vs_graphql_redaction(
            "/api/v4/secret", "query { secret }", "Guest",
            {"status": 403, "body": {}},
            {"data": {"secret": "leaked_token"}},
            expected_allowed=False,
        )
        self.assertIsNotNone(f1)
        self.assertEqual(f1.vector, DifferentialVector.DIFF_VEC_01_REST_VS_GRAPHQL_REDACTION)

        # DIFF-VEC-02
        f2 = self.parity_auditor.audit_toctou_worker_reauthorization(
            "ProjectExportWorker", 40, 10, False, {"job_id": 1}
        )
        self.assertIsNotNone(f2)
        self.assertEqual(f2.vector, DifferentialVector.DIFF_VEC_02_UI_VS_WORKER_TOCTOU)

        # DIFF-VEC-04
        f4 = self.parity_auditor.audit_feature_isolation_leakage(
            "snippets", "DISABLED", 50,
            rest_accessible=False, graphql_accessible=True, ui_accessible=False, worker_accessible=False
        )
        self.assertIsNotNone(f4)
        self.assertEqual(f4.vector, DifferentialVector.DIFF_VEC_04_FEATURE_ISOLATION_LEAKAGE)
        self.assertEqual(f4.severity, "CRITICAL")

        # DIFF-VEC-05
        f5 = self.parity_auditor.audit_group_link_clamping(40, 20, 30)
        self.assertIsNotNone(f5)
        self.assertEqual(f5.vector, DifferentialVector.DIFF_VEC_05_GROUP_LINK_CLAMPING_BYPASS)

        # DIFF-VEC-06
        f6 = self.parity_auditor.audit_external_user_isolation(
            True, "internal", False, {"REST": False, "GraphQL": True}
        )
        self.assertIsNotNone(f6)
        self.assertEqual(f6.vector, DifferentialVector.DIFF_VEC_06_EXTERNAL_USER_LEAKAGE)

    # --- Token Scope Boundary Tests ---

    def test_ten_token_taxonomy_properties(self):
        """Verify all 10 token types are registered with correct storage models and security boundaries."""
        taxonomy = TokenBoundaryAuditor.get_taxonomy()
        self.assertEqual(len(taxonomy), 10)

        # PAT uses SHA-256 digest
        self.assertEqual(taxonomy[TokenType.PAT].storage_model, TokenStorageModel.SHA256_DIGEST)
        # Trigger token uses Encrypted DB
        self.assertEqual(taxonomy[TokenType.TRIGGER_TOKEN].storage_model, TokenStorageModel.ENCRYPTED_DB)
        # CI_JOB_TOKEN uses Ephemeral JWT
        self.assertEqual(taxonomy[TokenType.CI_JOB_TOKEN].storage_model, TokenStorageModel.EPHEMERAL_JWT)
        # Deploy Key uses SSH Public Key
        self.assertEqual(taxonomy[TokenType.DEPLOY_KEY].storage_model, TokenStorageModel.SSH_PUBLIC_KEY)
        # Deploy Token uses Cleartext Hash
        self.assertEqual(taxonomy[TokenType.DEPLOY_TOKEN].storage_model, TokenStorageModel.CLEARTEXT_HASH)

    def test_token_scope_effective_permissions_intersection(self):
        """Verify INV-AUTH-08: EffectivePerms = UserPerms ∩ GrantedScopes."""
        user_abilities = {"read_repo", "write_repo", "read_confidential", "delete_repo"}
        ability_scope_map = {
            "read_repo": ("read_repository", False),
            "write_repo": ("write_repository", True),
            "read_confidential": ("read_api", False),
            "delete_repo": ("api", True),
        }

        # Case 1: Read-only token
        eff_ro = TokenBoundaryAuditor.compute_effective_permissions(
            user_abilities, ["read_repository"], ability_scope_map
        )
        self.assertEqual(eff_ro, {"read_repo"})

        # Case 2: Full API token
        eff_full = TokenBoundaryAuditor.compute_effective_permissions(
            user_abilities, ["api"], ability_scope_map
        )
        self.assertEqual(eff_full, user_abilities)

        # Case 3: Read API token (grants read_confidential and read_repo)
        eff_read_api = TokenBoundaryAuditor.compute_effective_permissions(
            user_abilities, ["read_api"], ability_scope_map
        )
        self.assertEqual(eff_read_api, {"read_repo", "read_confidential"})


if __name__ == "__main__":
    unittest.main()
