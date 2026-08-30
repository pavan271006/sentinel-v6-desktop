"""
Challenger 3 Deep Adversarial Validation Test Suite
Milestone 3: GitLab DeclarativePolicy DAG Solver & Condition Score Evaluator
=============================================================================
Rigorous adversarial, empirical, and mathematical stress-testing of:
1. Prevent Primacy and Multiple Overlapping Prevents (SEC-INV-01)
2. Condition Score Sorting and Short-Circuit Optimization (PERF-INV-01)
3. Multi-Level Policy Inheritance and Hierarchical DAG Propagation (DAG-INV-01)
4. Request-Scoped Cache Mechanics, Invalidation, and Negation Consistency (CACHE-INV-01)
5. Cyclic Delegations, Self-Referencing, and Circular Conditions (STAB-INV-01)
6. DeclarativePolicy Auditor Static Analysis and Short-Circuit Simulation (AUDIT-INV-01)
7. Adversarial Edge Cases, Boundary Dictionaries, and Scale Benchmarking (SCALE-INV-01)

Authoritative References:
- gitlab_research_lab/harness/audit_declarative_policy.py
- gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md (Section 1)
"""

import copy
import gc
import os
import sys
import time
import tracemalloc
import unittest
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

# Ensure gitlab_research_lab is on sys.path
LAB_ROOT = Path(__file__).resolve().parent.parent
if str(LAB_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT.parent))

from gitlab_research_lab.harness.audit_declarative_policy import (
    ConditionDef,
    ConditionScoreTier,
    DeclarativePolicyAuditor,
    DeclarativePolicyEngine,
    PolicyRule,
)


class TestPreventPrimacyAndOverlap(unittest.TestCase):
    """
    Validates the Unconditional Override Precedence Invariant:
    Allowed(u, s, a) = (Enables >= 1) AND (Prevents == 0)
    """

    def setUp(self):
        self.engine = DeclarativePolicyEngine("ProjectPolicy")

    def test_01_single_enable_single_prevent(self):
        """Single enable true, single prevent true -> decision MUST be False."""
        self.engine.register_condition("is_member", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_banned", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("is_member", "push_code")
        self.engine.prevent_rule("is_banned", "push_code")

        user = {"id": 1, "username": "alice"}
        subject = {"id": 101, "name": "gitlab-ce"}

        allowed = self.engine.evaluate_ability(user, subject, "push_code")
        self.assertFalse(allowed, "Prevent rule MUST override enable rule.")

    def test_02_multiple_enables_single_prevent(self):
        """Five enable rules all evaluating to True, 1 prevent rule evaluating to True -> False."""
        for i in range(5):
            c_name = f"enable_cond_{i}"
            self.engine.register_condition(c_name, score=0, evaluator=lambda u, s: True)
            self.engine.enable_rule(c_name, "delete_branch")

        self.engine.register_condition("is_protected_branch", score=0, evaluator=lambda u, s: True)
        self.engine.prevent_rule("is_protected_branch", "delete_branch")

        user = {"id": 1, "username": "admin"}
        subject = {"id": 101, "name": "repo"}

        allowed = self.engine.evaluate_ability(user, subject, "delete_branch")
        self.assertFalse(allowed, "A single prevent rule MUST override all 5 active enable rules.")

    def test_03_multiple_overlapping_prevents(self):
        """Three distinct overlapping prevent rules all matching ability -> all must evaluate."""
        self.engine.register_condition("is_author", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_locked", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_archived", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_read_only", score=0, evaluator=lambda u, s: False)

        self.engine.enable_rule("is_author", "edit_issue")
        self.engine.prevent_rule("is_locked", "edit_issue")
        self.engine.prevent_rule("is_archived", "edit_issue")
        self.engine.prevent_rule("is_read_only", "edit_issue")

        user = {"id": 2, "username": "bob"}
        subject = {"id": 201, "name": "issue_1"}

        allowed = self.engine.evaluate_ability(user, subject, "edit_issue")
        self.assertFalse(allowed, "Overlapping prevents MUST result in denial if any prevent is active.")

    def test_04_prevent_all_unconditional(self):
        """prevent_all with no exceptions blocks all abilities even with :all enable."""
        self.engine.register_condition("is_admin", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_blocked_user", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("is_admin", ":all")
        self.engine.prevent_all_rule("is_blocked_user")

        user = {"id": 99, "username": "blocked_admin"}
        subject = {"id": 101, "name": "any_resource"}

        for ability in ["read_project", "push_code", "admin_all", "custom_action"]:
            allowed = self.engine.evaluate_ability(user, subject, ability)
            self.assertFalse(allowed, f"prevent_all MUST block ability '{ability}'.")

    def test_05_prevent_all_with_whitelist_exceptions(self):
        """prevent_all with whitelisted except_abilities allows whitelisted abilities if enabled."""
        self.engine.register_condition("is_member", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_suspended", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("is_member", "read_project")
        self.engine.enable_rule("is_member", "push_code")
        self.engine.enable_rule("is_member", "view_suspension_notice")

        # Suspended user cannot do anything except view suspension notice
        self.engine.prevent_all_rule("is_suspended", except_abilities=["view_suspension_notice"])

        user = {"id": 5, "username": "suspended_user"}
        subject = {"id": 101, "name": "project_x"}

        self.assertFalse(self.engine.evaluate_ability(user, subject, "read_project"))
        self.assertFalse(self.engine.evaluate_ability(user, subject, "push_code"))
        self.assertTrue(
            self.engine.evaluate_ability(user, subject, "view_suspension_notice"),
            "Whitelisted ability in prevent_all MUST remain permitted if enabled.",
        )

    def test_06_multiple_prevent_all_with_disjoint_exceptions(self):
        """
        Two active prevent_all rules with disjoint exception sets:
        Rule 1 allows only [:read_public], Rule 2 allows only [:audit_log].
        When both fire, both abilities MUST be denied because Rule 1 prevents :audit_log and Rule 2 prevents :read_public.
        """
        self.engine.register_condition("cond_active_1", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("cond_active_2", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("cond_active_1", "read_public")
        self.engine.enable_rule("cond_active_1", "audit_log")

        self.engine.prevent_all_rule("cond_active_1", except_abilities=["read_public"])
        self.engine.prevent_all_rule("cond_active_2", except_abilities=["audit_log"])

        user = {"id": 10, "username": "charlie"}
        subject = {"id": 500, "name": "locked_down"}

        self.assertFalse(self.engine.evaluate_ability(user, subject, "read_public"))
        self.assertFalse(self.engine.evaluate_ability(user, subject, "audit_log"))

    def test_07_prevent_with_negated_condition(self):
        """Prevent rule with ~is_public condition correctly triggers when is_public is False."""
        self.engine.register_condition("is_authenticated", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_public", score=0, evaluator=lambda u, s: False)

        self.engine.enable_rule("is_authenticated", "download_artifact")
        self.engine.prevent_rule("~is_public", "download_artifact")

        user = {"id": 15, "username": "external"}
        subject = {"id": 999, "name": "private_project"}

        allowed = self.engine.evaluate_ability(user, subject, "download_artifact")
        self.assertFalse(allowed, "Negated prevent condition (~is_public) must evaluate to True and prevent.")

    def test_08_declaration_order_independence(self):
        """Declaration order of rules must NOT affect authorization verdict."""
        # Engine A: Enable declared first, Prevent declared second
        engine_a = DeclarativePolicyEngine("PolicyA")
        engine_a.register_condition("cond_true", score=0, evaluator=lambda u, s: True)
        engine_a.enable_rule("cond_true", "action_x")
        engine_a.prevent_rule("cond_true", "action_x")

        # Engine B: Prevent declared first, Enable declared second
        engine_b = DeclarativePolicyEngine("PolicyB")
        engine_b.register_condition("cond_true", score=0, evaluator=lambda u, s: True)
        engine_b.prevent_rule("cond_true", "action_x")
        engine_b.enable_rule("cond_true", "action_x")

        user = {"id": 1}
        subject = {"id": 1}

        self.assertEqual(
            engine_a.evaluate_ability(user, subject, "action_x"),
            engine_b.evaluate_ability(user, subject, "action_x"),
            "Rule declaration order must be mathematically invariant.",
        )
        self.assertFalse(engine_a.evaluate_ability(user, subject, "action_x"))


class TestConditionScoreAndShortCircuit(unittest.TestCase):
    """
    Validates condition cost-score ordering and short-circuit execution:
    Low-score failures MUST completely bypass expensive database and RPC evaluations.
    """

    def setUp(self):
        self.engine = DeclarativePolicyEngine("CostOptimizedPolicy")
        self.eval_log: List[Tuple[str, int]] = []

    def _make_evaluator(self, name: str, score: int, return_val: bool):
        def _fn(u: Dict, s: Dict) -> bool:
            self.eval_log.append((name, score))
            return return_val
        return _fn

    def test_09_short_circuit_cost_0_blocks_cost_10(self):
        """Score 0 failure completely prevents Score 10 RPC evaluator from executing."""
        self.engine.register_condition(
            "cheap_in_memory", score=0, evaluator=self._make_evaluator("cheap_in_memory", 0, False)
        )
        self.engine.register_condition(
            "expensive_gitaly_rpc", score=10, evaluator=self._make_evaluator("expensive_gitaly_rpc", 10, True)
        )

        self.engine.enable_rule(["cheap_in_memory", "expensive_gitaly_rpc"], "read_blob")

        user = {"id": 1}
        subject = {"id": 100}

        allowed = self.engine.evaluate_ability(user, subject, "read_blob")
        self.assertFalse(allowed)
        self.assertEqual(len(self.eval_log), 1)
        self.assertEqual(self.eval_log[0][0], "cheap_in_memory")
        self.assertEqual(self.engine.execution_counts["expensive_gitaly_rpc"], 0)

    def test_10_reverse_declaration_order_sorting(self):
        """Rule declared with [expensive, cheap] condition order must be reordered by engine to [cheap, expensive]."""
        self.engine.register_condition(
            "heavy_cte", score=5, evaluator=self._make_evaluator("heavy_cte", 5, True)
        )
        self.engine.register_condition(
            "cheap_check", score=0, evaluator=self._make_evaluator("cheap_check", 0, False)
        )

        # Deliberately put heavy_cte first in the rule definition
        self.engine.enable_rule(["heavy_cte", "cheap_check"], "admin_project")

        user = {"id": 2}
        subject = {"id": 200}

        allowed = self.engine.evaluate_ability(user, subject, "admin_project")
        self.assertFalse(allowed)
        self.assertEqual(self.eval_log, [("cheap_check", 0)], "Engine MUST evaluate score 0 first despite rule order.")
        self.assertEqual(self.engine.execution_counts["heavy_cte"], 0)

    def test_11_multi_tier_scoring_hierarchy(self):
        """5 tiers (0, 1, 2, 5, 10). Tiers 0 and 1 return True, tier 2 returns False. Tiers 5 and 10 must NOT run."""
        self.engine.register_condition("tier_0", score=ConditionScoreTier.IN_MEMORY.value, evaluator=self._make_evaluator("t0", 0, True))
        self.engine.register_condition("tier_1", score=ConditionScoreTier.PRELOADED.value, evaluator=self._make_evaluator("t1", 1, True))
        self.engine.register_condition("tier_2", score=ConditionScoreTier.INDEXED_QUERY.value, evaluator=self._make_evaluator("t2", 2, False))
        self.engine.register_condition("tier_5", score=ConditionScoreTier.MULTI_ROW_CTE.value, evaluator=self._make_evaluator("t5", 5, True))
        self.engine.register_condition("tier_10", score=ConditionScoreTier.EXPENSIVE_RPC.value, evaluator=self._make_evaluator("t10", 10, True))

        # Unsorted rule definition
        self.engine.enable_rule(["tier_10", "tier_2", "tier_0", "tier_5", "tier_1"], "perform_complex_op")

        user = {"id": 3}
        subject = {"id": 300}

        allowed = self.engine.evaluate_ability(user, subject, "perform_complex_op")
        self.assertFalse(allowed)

        expected_order = [("t0", 0), ("t1", 1), ("t2", 2)]
        self.assertEqual(self.eval_log, expected_order)
        self.assertEqual(self.engine.execution_counts["tier_5"], 0)
        self.assertEqual(self.engine.execution_counts["tier_10"], 0)

    def test_12_negated_condition_score_resolution(self):
        """Negated condition ~cheap_cond (score 0) must sort before score 5 condition."""
        self.engine.register_condition("heavy_op", score=5, evaluator=self._make_evaluator("heavy_op", 5, True))
        self.engine.register_condition("is_blocked", score=0, evaluator=self._make_evaluator("is_blocked", 0, True))

        # ~is_blocked will evaluate to not True = False
        self.engine.enable_rule(["heavy_op", "~is_blocked"], "export_project")

        user = {"id": 4}
        subject = {"id": 400}

        allowed = self.engine.evaluate_ability(user, subject, "export_project")
        self.assertFalse(allowed)
        self.assertEqual(self.eval_log, [("is_blocked", 0)])
        self.assertEqual(self.engine.execution_counts["heavy_op"], 0)

    def test_13_unregistered_fallback_score_assignment(self):
        """Unregistered condition in subject/user defaults to score 0 and executes before score 5."""
        self.engine.register_condition("heavy_db", score=5, evaluator=self._make_evaluator("heavy_db", 5, True))
        self.engine.enable_rule(["heavy_db", "direct_subject_flag"], "custom_flag_action")

        user = {"id": 5}
        subject = {"id": 500, "direct_subject_flag": False}

        allowed = self.engine.evaluate_ability(user, subject, "custom_flag_action")
        self.assertFalse(allowed)
        self.assertEqual(self.eval_log, [], "Fallback score 0 condition evaluated directly on subject, heavy_db skipped.")
        self.assertEqual(self.engine.execution_counts["heavy_db"], 0)

    def test_14_all_true_conditions_execute_in_strict_score_order(self):
        """When all conditions pass, execution log MUST be strictly monotonic in score."""
        self.engine.register_condition("c_rpc", score=10, evaluator=self._make_evaluator("c_rpc", 10, True))
        self.engine.register_condition("c_cte", score=5, evaluator=self._make_evaluator("c_cte", 5, True))
        self.engine.register_condition("c_idx", score=2, evaluator=self._make_evaluator("c_idx", 2, True))
        self.engine.register_condition("c_pre", score=1, evaluator=self._make_evaluator("c_pre", 1, True))
        self.engine.register_condition("c_mem", score=0, evaluator=self._make_evaluator("c_mem", 0, True))

        self.engine.enable_rule(["c_rpc", "c_cte", "c_mem", "c_idx", "c_pre"], "ultimate_action")

        user = {"id": 6}
        subject = {"id": 600}

        allowed = self.engine.evaluate_ability(user, subject, "ultimate_action")
        self.assertTrue(allowed)

        scores_executed = [s for _, s in self.eval_log]
        self.assertEqual(scores_executed, sorted(scores_executed))
        self.assertEqual(scores_executed, [0, 1, 2, 5, 10])


class TestPolicyInheritanceAndGraphDAG(unittest.TestCase):
    """
    Validates policy inheritance hierarchies:
    BasePolicy -> GroupPolicy -> ProjectPolicy -> IssuePolicy
    """

    def setUp(self):
        self.base_policy = DeclarativePolicyEngine("BasePolicy")
        self.group_policy = DeclarativePolicyEngine("GroupPolicy", parent_policy=self.base_policy)
        self.project_policy = DeclarativePolicyEngine("ProjectPolicy", parent_policy=self.group_policy)
        self.issue_policy = DeclarativePolicyEngine("IssuePolicy", parent_policy=self.project_policy)

    def test_15_four_level_inheritance_propagation(self):
        """Ability enabled at BasePolicy is resolvable when querying leaf IssuePolicy."""
        self.base_policy.register_condition("is_active_user", score=0, evaluator=lambda u, s: bool(u.get("active", False)))
        self.base_policy.enable_rule("is_active_user", "read_cross_project")

        user = {"id": 1, "active": True}
        subject = {"id": 100, "type": "issue"}

        allowed = self.issue_policy.evaluate_ability(user, subject, "read_cross_project")
        self.assertTrue(allowed, "Leaf IssuePolicy must inherit enable rules from BasePolicy.")

    def test_16_child_policy_overrides_parent_enable_with_prevent(self):
        """BasePolicy enables read_resource, but IssuePolicy prevents if issue is confidential."""
        self.base_policy.register_condition("is_authenticated", score=0, evaluator=lambda u, s: bool(u.get("id")))
        self.base_policy.enable_rule("is_authenticated", "read_issue")

        self.issue_policy.register_condition(
            "is_confidential_and_not_author",
            score=0,
            evaluator=lambda u, s: s.get("confidential", False) and u.get("id") != s.get("author_id"),
        )
        self.issue_policy.prevent_rule("is_confidential_and_not_author", "read_issue")

        user = {"id": 2, "username": "regular_user"}
        confidential_issue = {"id": 201, "confidential": True, "author_id": 99}

        allowed = self.issue_policy.evaluate_ability(user, confidential_issue, "read_issue")
        self.assertFalse(allowed, "Child policy prevent rule MUST override parent policy enable rule.")

    def test_17_parent_prevent_irreversible_by_child_enable(self):
        """Parent BasePolicy has unconditional prevent rule; Child IssuePolicy cannot override it."""
        self.base_policy.register_condition("is_banned_global", score=0, evaluator=lambda u, s: bool(u.get("banned", False)))
        self.base_policy.prevent_rule("is_banned_global", ":all")

        self.issue_policy.register_condition("is_admin", score=0, evaluator=lambda u, s: True)
        self.issue_policy.enable_rule("is_admin", ":all")

        banned_user = {"id": 3, "banned": True}
        issue = {"id": 301}

        allowed = self.issue_policy.evaluate_ability(banned_user, issue, "any_action")
        self.assertFalse(allowed, "Parent prevent rule MUST irrevocably override child enable rule.")

    def test_18_inherited_condition_lookup(self):
        """Child policy rule references condition registered on ancestor BasePolicy."""
        self.base_policy.register_condition("is_system_admin", score=0, evaluator=lambda u, s: u.get("admin", False))
        # ProjectPolicy references condition registered on BasePolicy
        self.project_policy.enable_rule("is_system_admin", "override_project_locks")

        admin_user = {"id": 1, "admin": True}
        non_admin = {"id": 2, "admin": False}
        project = {"id": 401}

        self.assertTrue(self.project_policy.evaluate_ability(admin_user, project, "override_project_locks"))
        self.assertFalse(self.project_policy.evaluate_ability(non_admin, project, "override_project_locks"))

    def test_19_sibling_policy_isolation(self):
        """Sibling policies inheriting from same BasePolicy do not cross-contaminate rules or conditions."""
        snippet_policy = DeclarativePolicyEngine("SnippetPolicy", parent_policy=self.base_policy)

        self.project_policy.register_condition("project_cond", score=0, evaluator=lambda u, s: True)
        self.project_policy.enable_rule("project_cond", "project_only_ability")

        snippet_policy.register_condition("snippet_cond", score=0, evaluator=lambda u, s: True)
        snippet_policy.enable_rule("snippet_cond", "snippet_only_ability")

        user = {"id": 1}
        subject = {"id": 1}

        self.assertFalse(snippet_policy.evaluate_ability(user, subject, "project_only_ability"))
        self.assertFalse(self.project_policy.evaluate_ability(user, subject, "snippet_only_ability"))

    def test_20_deep_multilevel_prevent_propagation(self):
        """Prevent rule declared at top GroupPolicy cascades down to Project and Issue policies."""
        self.group_policy.register_condition("group_compliance_lock", score=0, evaluator=lambda u, s: True)
        self.group_policy.prevent_rule("group_compliance_lock", "delete_records")

        self.issue_policy.register_condition("is_owner", score=0, evaluator=lambda u, s: True)
        self.issue_policy.enable_rule("is_owner", "delete_records")

        user = {"id": 10}
        issue = {"id": 500}

        allowed = self.issue_policy.evaluate_ability(user, issue, "delete_records")
        self.assertFalse(allowed, "Group-level prevent MUST cascade down to issue level.")


class TestScopeCachingAndStateInvalidation(unittest.TestCase):
    """
    Validates request-scoped condition caching, scope bindings, and cache invalidation.
    """

    def setUp(self):
        self.engine = DeclarativePolicyEngine("CachingPolicy")
        self.call_counts: Dict[str, int] = {"user_cond": 0, "subj_cond": 0, "glob_cond": 0, "default_cond": 0}

    def test_21_user_scope_caching_across_subjects(self):
        """Condition with scope=':user' evaluated once per user across distinct subjects."""
        def eval_user(u: Dict, s: Dict) -> bool:
            self.call_counts["user_cond"] += 1
            return u.get("is_auditor", False)

        self.engine.register_condition("is_auditor", scope=":user", evaluator=eval_user)
        self.engine.enable_rule("is_auditor", "audit_read")

        user_1 = {"id": "u1", "is_auditor": True}
        subject_1 = {"id": "s1"}
        subject_2 = {"id": "s2"}
        subject_3 = {"id": "s3"}

        self.assertTrue(self.engine.evaluate_ability(user_1, subject_1, "audit_read"))
        self.assertTrue(self.engine.evaluate_ability(user_1, subject_2, "audit_read"))
        self.assertTrue(self.engine.evaluate_ability(user_1, subject_3, "audit_read"))

        self.assertEqual(
            self.call_counts["user_cond"], 1, "User-scoped condition should be evaluated exactly once across 3 subjects."
        )

    def test_22_subject_scope_caching_across_users(self):
        """Condition with scope=':subject' evaluated once per subject across distinct users."""
        def eval_subj(u: Dict, s: Dict) -> bool:
            self.call_counts["subj_cond"] += 1
            return s.get("public", False)

        self.engine.register_condition("is_public", scope=":subject", evaluator=eval_subj)
        self.engine.enable_rule("is_public", "read_public_data")

        user_1 = {"id": "u1"}
        user_2 = {"id": "u2"}
        user_3 = {"id": "u3"}
        subject_1 = {"id": "s100", "public": True}

        self.assertTrue(self.engine.evaluate_ability(user_1, subject_1, "read_public_data"))
        self.assertTrue(self.engine.evaluate_ability(user_2, subject_1, "read_public_data"))
        self.assertTrue(self.engine.evaluate_ability(user_3, subject_1, "read_public_data"))

        self.assertEqual(
            self.call_counts["subj_cond"], 1, "Subject-scoped condition should be evaluated exactly once across 3 users."
        )

    def test_23_global_scope_caching(self):
        """Condition with scope=':global' evaluated once across all users and subjects."""
        def eval_global(u: Dict, s: Dict) -> bool:
            self.call_counts["glob_cond"] += 1
            return True

        self.engine.register_condition("system_maintenance_off", scope=":global", evaluator=eval_global)
        self.engine.enable_rule("system_maintenance_off", "any_op")

        for u_id in ["u1", "u2"]:
            for s_id in ["s1", "s2"]:
                self.assertTrue(self.engine.evaluate_ability({"id": u_id}, {"id": s_id}, "any_op"))

        self.assertEqual(
            self.call_counts["glob_cond"], 1, "Global-scoped condition should be evaluated exactly once across all tuples."
        )

    def test_24_default_scoped_cache_key_isolation(self):
        """Default scope (None) caches per (user_id, subject_id) tuple."""
        def eval_default(u: Dict, s: Dict) -> bool:
            self.call_counts["default_cond"] += 1
            return True

        self.engine.register_condition("user_member_of_subject", scope=None, evaluator=eval_default)
        self.engine.enable_rule("user_member_of_subject", "view_details")

        user_1 = {"id": "u1"}
        user_2 = {"id": "u2"}
        subject_1 = {"id": "s1"}
        subject_2 = {"id": "s2"}

        # 4 distinct tuples: (u1, s1), (u1, s2), (u2, s1), (u2, s2)
        self.engine.evaluate_ability(user_1, subject_1, "view_details")
        self.engine.evaluate_ability(user_1, subject_2, "view_details")
        self.engine.evaluate_ability(user_2, subject_1, "view_details")
        self.engine.evaluate_ability(user_2, subject_2, "view_details")

        # Repeat one tuple to test hit
        self.engine.evaluate_ability(user_1, subject_1, "view_details")

        self.assertEqual(
            self.call_counts["default_cond"], 4, "Default scope should evaluate once per unique (user, subject) pair."
        )

    def test_25_cache_clear_invalidation(self):
        """clear_cache() forces re-evaluation when subject or user state mutates."""
        state = {"user_active": False}

        def eval_active(u: Dict, s: Dict) -> bool:
            return state["user_active"]

        self.engine.register_condition("is_active", evaluator=eval_active)
        self.engine.enable_rule("is_active", "create_branch")

        user = {"id": "u1"}
        subject = {"id": "s1"}

        self.assertFalse(self.engine.evaluate_ability(user, subject, "create_branch"))

        # Mutate state without cache clear -> still cached False
        state["user_active"] = True
        self.assertFalse(self.engine.evaluate_ability(user, subject, "create_branch"))

        # Explicit invalidation
        self.engine.clear_cache()
        self.assertTrue(self.engine.evaluate_ability(user, subject, "create_branch"))

    def test_26_cached_positive_evaluated_with_negation(self):
        """Cached boolean value is correctly inverted when subsequent rule queries ~condition."""
        calls = [0]

        def eval_admin(u: Dict, s: Dict) -> bool:
            calls[0] += 1
            return True

        self.engine.register_condition("is_admin", evaluator=eval_admin)
        self.engine.enable_rule("is_admin", "admin_op")
        self.engine.prevent_rule("~is_admin", "regular_op")
        self.engine.enable_rule("is_admin", "regular_op")

        user = {"id": "u1"}
        subject = {"id": "s1"}

        # First evaluation executes evaluator and caches is_admin:u:u1:s:s1 = True
        allowed_admin = self.engine.evaluate_ability(user, subject, "admin_op")
        self.assertTrue(allowed_admin)
        self.assertEqual(calls[0], 1)

        # Second evaluation for regular_op evaluates enable(is_admin) [hit] and prevent(~is_admin) [hit, inverted]
        allowed_regular = self.engine.evaluate_ability(user, subject, "regular_op")
        self.assertTrue(allowed_regular)
        self.assertEqual(calls[0], 1, "Negated condition query MUST use cache without re-invoking evaluator.")


class TestCyclicDelegationsAndCircularConditions(unittest.TestCase):
    """
    Validates engine stability against circular condition queries, delegation cycles, and null subjects.
    """

    def setUp(self):
        self.engine = DeclarativePolicyEngine("ResiliencePolicy")

    def test_27_self_referential_delegation(self):
        """Policy delegating to its own subject does not hang or raise."""
        self.engine.add_delegation(lambda s: s)
        self.engine.register_condition("is_public", score=0, evaluator=lambda u, s: False)
        self.engine.enable_rule("is_public", "read_item")

        user = {"id": 1}
        subject = {"id": 100}

        # Should safely terminate with False
        allowed = self.engine.evaluate_ability(user, subject, "read_item")
        self.assertFalse(allowed)

    def test_28_cyclic_delegation_loop(self):
        """Mutual delegation (Subject A -> Subject B -> Subject A) handles safely without crash."""
        subj_a = {"id": "A", "partner": "B"}
        subj_b = {"id": "B", "partner": "A"}

        def delegate_partner(s: Dict) -> Optional[Dict]:
            if s.get("id") == "A":
                return subj_b
            return subj_a

        self.engine.add_delegation(delegate_partner)
        self.engine.register_condition("cond_false", score=0, evaluator=lambda u, s: False)
        self.engine.enable_rule("cond_false", "action_x")

        user = {"id": 1}
        allowed = self.engine.evaluate_ability(user, subj_a, "action_x")
        self.assertFalse(allowed)

    def test_29_null_and_empty_subject_delegation(self):
        """Delegation returning None gracefully handles without unhandled exception."""
        self.engine.add_delegation(lambda s: None)
        self.engine.register_condition("c1", score=0, evaluator=lambda u, s: True)
        self.engine.enable_rule("c1", "op1")

        user = {"id": 1}
        subject = {"id": 2}

        # Even with None delegation, direct enable rule succeeds
        self.assertTrue(self.engine.evaluate_ability(user, subject, "op1"))

    def test_30_circular_condition_depth_guard(self):
        """Guards against infinite recursion in condition evaluators that invoke ability checks."""
        call_depth = [0]
        max_depth = 5

        def recursive_evaluator(u: Dict, s: Dict) -> bool:
            call_depth[0] += 1
            if call_depth[0] > max_depth:
                return False  # Break cycle
            # Simulates recursive permission check
            return self.engine.evaluate_ability(u, s, "nested_ability")

        self.engine.register_condition("recursive_cond", score=0, evaluator=recursive_evaluator)
        self.engine.enable_rule("recursive_cond", "nested_ability")

        user = {"id": 1}
        subject = {"id": 1}

        # Must terminate within reasonable recursion depth
        allowed = self.engine.evaluate_ability(user, subject, "nested_ability")
        self.assertFalse(allowed)
        self.assertLessEqual(call_depth[0], max_depth + 1)


class TestAuditorStaticAnalysisAndSimulation(unittest.TestCase):
    """
    Validates DeclarativePolicyAuditor static analysis and performance simulation.
    """

    def setUp(self):
        self.auditor = DeclarativePolicyAuditor()

    def test_31_auditor_flags_unprotected_dangerous_abilities(self):
        """Auditor flags policies enabling dangerous abilities without corresponding prevent rules."""
        conditions = [{"name": "is_admin", "score": 0}]
        rules = [
            {"action": "enable", "ability": "destroy_project", "conditions": ["is_admin"]},
            {"action": "enable", "ability": "force_push_code", "conditions": ["is_admin"]},
        ]

        report = self.auditor.audit_policy_graph("DangerousPolicy", conditions, rules)
        self.assertEqual(report["status"], "WARNING_NO_PREVENT_OVERRIDE")
        self.assertIn("destroy_project", report["unprotected_dangerous_abilities"])
        self.assertIn("force_push_code", report["unprotected_dangerous_abilities"])

    def test_32_auditor_flags_unsorted_rule_conditions(self):
        """Auditor identifies condition lists that are not pre-sorted by score."""
        conditions = [
            {"name": "cheap_mem", "score": 0},
            {"name": "heavy_rpc", "score": 10},
        ]
        rules = [
            {"action": "enable", "ability": "read_data", "conditions": ["heavy_rpc", "cheap_mem"]},
            {"action": "prevent", "ability": "delete_data", "conditions": ["cheap_mem"]},
        ]

        report = self.auditor.audit_policy_graph("UnsortedPolicy", conditions, rules)
        self.assertFalse(report["short_circuit_optimal"])
        self.assertEqual(len(report["rule_ordering_issues"]), 1)
        self.assertEqual(report["rule_ordering_issues"][0]["scores"], [10, 0])

    def test_33_auditor_approves_fully_prevented_policy(self):
        """Auditor returns SECURE for policies with prevent rules on all dangerous abilities and sorted scores."""
        conditions = [
            {"name": "is_owner", "score": 0},
            {"name": "is_archived", "score": 0},
        ]
        rules = [
            {"action": "enable", "ability": "destroy_project", "conditions": ["is_owner"]},
            {"action": "prevent", "ability": "destroy_project", "conditions": ["is_archived"]},
        ]

        report = self.auditor.audit_policy_graph("SecuredPolicy", conditions, rules)
        self.assertEqual(report["status"], "SECURE")
        self.assertEqual(len(report["unprotected_dangerous_abilities"]), 0)
        self.assertTrue(report["short_circuit_optimal"])

    def test_34_auditor_simulation_measures_skipped_queries(self):
        """simulate_short_circuit_efficiency accurately measures bypassed expensive queries."""
        engine = DeclarativePolicyEngine("SimPolicy")
        engine.register_condition("cheap_cond", score=0, evaluator=lambda u, s: False)
        engine.register_condition("expensive_cond", score=10, evaluator=lambda u, s: True)
        engine.enable_rule(["cheap_cond", "expensive_cond"], "heavy_op")

        user = {"id": 1}
        subject = {"id": 1}

        sim_res = self.auditor.simulate_short_circuit_efficiency(engine, user, subject, "heavy_op")
        self.assertFalse(sim_res["allowed"])
        self.assertEqual(sim_res["expensive_queries_skipped"], 1)
        self.assertTrue(sim_res["short_circuit_active"])


class TestAdversarialEdgeCasesAndExtremeInputs(unittest.TestCase):
    """
    Validates engine behavior under edge cases: empty dictionaries, wildcards, and scale stress.
    """

    def setUp(self):
        self.engine = DeclarativePolicyEngine("EdgeCasePolicy")

    def test_35_empty_user_and_subject_dicts(self):
        """Empty dictionary inputs {} do not raise KeyErrors."""
        self.engine.register_condition("safe_cond", score=0, evaluator=lambda u, s: "id" in u and "id" in s)
        self.engine.enable_rule("safe_cond", "test_op")

        allowed = self.engine.evaluate_ability({}, {}, "test_op")
        self.assertFalse(allowed)

    def test_36_empty_conditions_rule(self):
        """Rule with empty condition list [] evaluates to True (vacuous truth)."""
        self.engine.enable_rule([], "unconditional_ability")

        allowed = self.engine.evaluate_ability({"id": 1}, {"id": 1}, "unconditional_ability")
        self.assertTrue(allowed, "Rule with empty condition list must evaluate to True.")

    def test_37_unknown_ability_query(self):
        """Querying an unregistered ability returns False without error."""
        self.engine.register_condition("c1", score=0, evaluator=lambda u, s: True)
        self.engine.enable_rule("c1", "registered_ability")

        allowed = self.engine.evaluate_ability({"id": 1}, {"id": 1}, "non_existent_ability_xyz")
        self.assertFalse(allowed)

    def test_38_wildcard_all_enable_and_prevent(self):
        """Wildcard ':all' properly matches any arbitrary ability string."""
        self.engine.register_condition("is_super_admin", score=0, evaluator=lambda u, s: True)
        self.engine.register_condition("is_system_frozen", score=0, evaluator=lambda u, s: True)

        self.engine.enable_rule("is_super_admin", ":all")
        self.engine.prevent_rule("is_system_frozen", ":all")

        user = {"id": 1}
        subject = {"id": 100}

        # Prevent(:all) beats Enable(:all)
        self.assertFalse(self.engine.evaluate_ability(user, subject, "any_random_action_123"))

    def test_39_extreme_rule_scaling(self):
        """Scales to 500 rules and 100 conditions without degradation or errors."""
        scale_engine = DeclarativePolicyEngine("LargePolicy")

        # Register 100 conditions
        for c_idx in range(100):
            score = c_idx % 11
            scale_engine.register_condition(
                f"cond_{c_idx}",
                score=score,
                evaluator=lambda u, s, idx=c_idx: (idx % 2 == 0),
            )

        # Register 500 rules
        for r_idx in range(500):
            c_a = f"cond_{(r_idx * 3) % 100}"
            c_b = f"cond_{(r_idx * 7) % 100}"
            action = "prevent" if (r_idx % 10 == 0) else "enable"
            if action == "enable":
                scale_engine.enable_rule([c_a, c_b], f"ability_{r_idx % 50}")
            else:
                scale_engine.prevent_rule([c_a, c_b], f"ability_{r_idx % 50}")

        user = {"id": "bench_user"}
        subject = {"id": "bench_subject"}

        for a_idx in range(50):
            res = scale_engine.evaluate_ability(user, subject, f"ability_{a_idx}")
            self.assertIsInstance(res, bool)

    def test_40_throughput_and_latency_budget(self):
        """10,000 evaluations of complex rules execute within 250ms latency budget with bounded heap memory."""
        bench_engine = DeclarativePolicyEngine("BenchmarkPolicy")
        bench_engine.register_condition("cheap_cond_1", score=0, scope=":user", evaluator=lambda u, s: True)
        bench_engine.register_condition("cheap_cond_2", score=0, scope=":subject", evaluator=lambda u, s: True)
        bench_engine.register_condition("indexed_cond", score=2, scope=None, evaluator=lambda u, s: True)
        bench_engine.register_condition("prevent_cond", score=0, scope=":subject", evaluator=lambda u, s: False)

        bench_engine.enable_rule(["cheap_cond_1", "cheap_cond_2", "indexed_cond"], "fast_read")
        bench_engine.prevent_rule("prevent_cond", "fast_read")

        user = {"id": 42}
        subject = {"id": 1001}

        # Warmup
        bench_engine.evaluate_ability(user, subject, "fast_read")

        # Measure pure latency without tracemalloc instrumentation skew
        start_time = time.perf_counter()
        iterations = 10000
        for _ in range(iterations):
            allowed = bench_engine.evaluate_ability(user, subject, "fast_read")
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Measure peak memory on 10k iterations
        tracemalloc.start()
        for _ in range(iterations):
            _ = bench_engine.evaluate_ability(user, subject, "fast_read")
        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        self.assertTrue(allowed)
        self.assertLess(
            elapsed_ms, 250.0, f"10,000 evaluations took {elapsed_ms:.2f}ms (exceeds 250ms threshold)."
        )
        self.assertLess(
            peak_mem, 10 * 1024 * 1024, f"Peak memory {peak_mem / 1024:.2f}KB exceeded 10MB bound."
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
