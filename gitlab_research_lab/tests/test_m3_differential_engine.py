"""
E2E Test Suite - Milestone 3: Declarative Policy & Multi-Interface Differential Research
========================================================================================
Covers Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases),
Tier 3 (Pairwise Combinations), and Tier 4 (Real-World Scenarios).

Authoritative Sources:
- gitlab_research_lab/PROJECT.md
- gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md
- gitlab_research_lab/harness/audit_declarative_policy.py
- gitlab_research_lab/harness/audit_interface_parity.py
- gitlab_research_lab/harness/test_token_scope_boundaries.py
"""

import json
import os
import sys
import unittest
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

LAB_ROOT = Path(__file__).resolve().parent.parent
if str(LAB_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT.parent))
if str(LAB_ROOT) not in sys.path:
    sys.path.insert(0, str(LAB_ROOT))

from gitlab_research_lab.harness.audit_declarative_policy import (
    DeclarativePolicyAuditor,
    DeclarativePolicyEngine,
    ConditionDef,
    PolicyRule,
)
from gitlab_research_lab.harness.audit_interface_parity import (
    InterfaceParityAuditor,
    DifferentialVector,
    DifferentialFinding,
)
from gitlab_research_lab.harness.test_token_scope_boundaries import (
    TokenBoundaryAuditor,
    TokenType,
    TokenStorageModel,
    TEN_TOKEN_TAXONOMY,
)


class MockDifferentialEngine:
    """Differential engine simulator comparing multi-interface authorization decisions."""

    def __init__(self):
        self.disparities = []

    def execute_rest(self, user_role: str, endpoint: str, params: dict) -> dict:
        """Simulate REST API endpoint evaluation."""
        if endpoint == "/api/v4/projects/:id/export":
            if user_role in ["Owner", "Maintainer", "Admin"]:
                return {"status": 202, "body": {"message": "202 Accepted"}}
            return {"status": 403, "body": {"message": "403 Forbidden"}}
        elif endpoint == "/api/v4/projects/:id/issues":
            if user_role in ["Guest", "Reporter", "Developer", "Maintainer", "Owner", "Admin"]:
                return {"status": 200, "body": [{"id": 1, "title": "Public Issue"}]}
            return {"status": 401, "body": {"message": "401 Unauthorized"}}
        elif endpoint == "/api/v4/projects/:id/protected_branches":
            if user_role in ["Maintainer", "Owner", "Admin"]:
                return {"status": 200, "body": [{"name": "main"}]}
            return {"status": 403, "body": {"message": "403 Forbidden"}}
        return {"status": 404, "body": {"message": "404 Not Found"}}

    def execute_graphql(self, user_role: str, query_type: str, fields: list) -> dict:
        """Simulate GraphQL API query/mutation evaluation."""
        if query_type == "projectExport":
            if user_role in ["Owner", "Maintainer", "Admin"]:
                return {"data": {"projectExport": {"status": "SCHEDULED"}}, "errors": None}
            return {"data": None, "errors": [{"message": "Unauthorized"}]}
        elif query_type == "projectIssues":
            if user_role in ["Guest", "Reporter", "Developer", "Maintainer", "Owner", "Admin"]:
                return {"data": {"project": {"issues": [{"id": 1, "title": "Public Issue"}]}}, "errors": None}
            return {"data": None, "errors": [{"message": "Resource not found"}]}
        elif query_type == "protectedBranches":
            if user_role in ["Maintainer", "Owner", "Admin"]:
                return {"data": {"project": {"protectedBranches": [{"name": "main"}]}}, "errors": None}
            # GraphQL Redaction: returns null or empty list rather than top-level crash
            return {"data": {"project": {"protectedBranches": []}}, "errors": None}
        return {"data": None, "errors": [{"message": "Unknown query"}]}

    def compare_parity(self, user_role: str, action_name: str, rest_resp: dict, gql_resp: dict) -> Optional[dict]:
        """Detect disparity between REST and GraphQL interfaces."""
        rest_allowed = rest_resp.get("status", 500) in [200, 201, 202]
        gql_allowed = gql_resp.get("data") is not None and not gql_resp.get("errors")

        if rest_allowed != gql_allowed:
            disparity = {
                "user_role": user_role,
                "action": action_name,
                "rest_allowed": rest_allowed,
                "gql_allowed": gql_allowed,
                "disparity_type": "INTERFACE_PARITY_BREACH",
            }
            self.disparities.append(disparity)
            return disparity
        return None


class TestMilestone3DifferentialEngine(unittest.TestCase):
    """Milestone 3 Test Suite: Differential Harness, Policy Auditing, and Multi-Interface Parity."""

    def setUp(self):
        self.engine = MockDifferentialEngine()
        self.policy_auditor = DeclarativePolicyAuditor()
        self.parity_auditor = InterfaceParityAuditor()
        self.token_auditor = TokenBoundaryAuditor()

    # =========================================================================
    # TIER 1: FEATURE COVERAGE TESTS (6 TESTS)
    # =========================================================================

    def test_t1_declarative_policy_auditor_syntax_validation(self):
        """[Tier 1] Verify policy auditor identifies condition definitions and score assignments."""
        sample_policy_ast = {
            "policy_name": "ProjectPolicy",
            "conditions": [
                {"name": "is_public", "score": 0},
                {"name": "is_member", "score": 2},
                {"name": "has_confidential_access", "score": 5},
            ],
            "rules": [
                {"action": "enable", "conditions": ["is_public"], "ability": "read_project"},
                {"action": "enable", "conditions": ["is_member"], "ability": "push_code"},
                {"action": "prevent", "conditions": ["~is_member"], "ability": "read_confidential_issues"},
            ],
        }
        self.assertEqual(len(sample_policy_ast["conditions"]), 3)
        self.assertEqual(len(sample_policy_ast["rules"]), 3)
        self.assertTrue(any(r["action"] == "prevent" for r in sample_policy_ast["rules"]))

        # Execute harness policy auditor
        report = self.policy_auditor.audit_policy_graph(
            sample_policy_ast["policy_name"],
            sample_policy_ast["conditions"],
            sample_policy_ast["rules"],
        )
        self.assertEqual(report["policy"], "ProjectPolicy")
        self.assertTrue(report["has_prevent_rules"])
        self.assertTrue(report["short_circuit_optimal"])

    def test_t1_interface_parity_auditor_rest_vs_graphql(self):
        """[Tier 1] Verify parity auditor checks consistency between REST and GraphQL responses."""
        # For Maintainer on export: both REST and GraphQL should permit
        rest_res = self.engine.execute_rest("Maintainer", "/api/v4/projects/:id/export", {})
        gql_res = self.engine.execute_graphql("Maintainer", "projectExport", ["status"])
        disparity = self.engine.compare_parity("Maintainer", "export", rest_res, gql_res)
        self.assertIsNone(disparity, "Maintainer should have consistent access across REST and GraphQL")

        # Harness parity auditor assertion
        parity_res = self.parity_auditor.compare_endpoints(
            operation_name="projectExport",
            rest_status=rest_res["status"],
            graphql_data=gql_res["data"],
            graphql_errors=gql_res["errors"],
            allowed_roles=["Maintainer", "Owner", "Admin"],
            tested_role="Maintainer",
        )
        self.assertFalse(parity_res["discrepancy_detected"])
        self.assertTrue(parity_res["rest_allowed"])
        self.assertTrue(parity_res["graphql_allowed"])

    def test_t1_token_scope_boundary_auditor(self):
        """[Tier 1] Verify token scope auditor checks permitted HTTP verbs and routes."""
        def is_token_scope_sufficient(token_scopes: List[str], required_scope: str, is_write: bool) -> bool:
            if "api" in token_scopes:
                return True
            if not is_write and "read_api" in token_scopes and required_scope.startswith("read_"):
                return True
            return required_scope in token_scopes

        self.assertTrue(is_token_scope_sufficient(["api"], "write_repository", True))
        self.assertTrue(is_token_scope_sufficient(["read_repository"], "read_repository", False))
        self.assertFalse(is_token_scope_sufficient(["read_repository"], "write_repository", True))

        # Test harness TokenBoundaryAuditor
        self.assertTrue(self.token_auditor.is_scope_sufficient(["api"], "write_repository", True))
        self.assertTrue(self.token_auditor.is_scope_sufficient(["read_repository"], "read_repository", False))
        self.assertFalse(self.token_auditor.is_scope_sufficient(["read_repository"], "write_repository", True))

    def test_t1_multi_interface_client_request_construction(self):
        """[Tier 1] Verify client headers and format across REST, GraphQL, and Workhorse."""
        def build_client_headers(auth_type: str, token: str, is_workhorse: bool = False) -> dict:
            headers = {"Content-Type": "application/json"}
            if auth_type == "PAT":
                headers["PRIVATE-TOKEN"] = token
            elif auth_type == "BEARER":
                headers["Authorization"] = f"Bearer {token}"
            if is_workhorse:
                headers["Gitlab-Workhorse-Api-Request"] = "true"
            return headers

        rest_hdr = build_client_headers("PAT", "glpat-test-123")
        self.assertEqual(rest_hdr["PRIVATE-TOKEN"], "glpat-test-123")

        wh_hdr = build_client_headers("BEARER", "jwt-token-456", is_workhorse=True)
        self.assertEqual(wh_hdr["Gitlab-Workhorse-Api-Request"], "true")

    def test_t1_differential_disparity_detection_engine(self):
        """[Tier 1] Verify detection of differential disparity when one interface leaks access."""
        # Simulated vulnerability: REST denies Guest, but buggy GraphQL resolver allows
        mock_rest = {"status": 403, "body": {"message": "Forbidden"}}
        mock_gql = {"data": {"sensitiveData": "secret"}, "errors": None}

        disparity = self.engine.compare_parity("Guest", "view_secret", mock_rest, mock_gql)
        self.assertIsNotNone(disparity, "Differential engine must flag interface parity breach")
        self.assertEqual(disparity["disparity_type"], "INTERFACE_PARITY_BREACH")

        # Harness parity auditor detects vector finding
        finding = self.parity_auditor.audit_rest_vs_graphql_redaction(
            resource_path="/api/v4/secret",
            graphql_query="query { sensitiveData }",
            actor_role="Guest",
            rest_response=mock_rest,
            graphql_response=mock_gql,
            expected_allowed=False,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding.vector, DifferentialVector.DIFF_VEC_01_REST_VS_GRAPHQL_REDACTION)
        self.assertEqual(finding.severity, "HIGH")

    def test_t1_sidekiq_worker_context_audit(self):
        """[Tier 1] Verify worker background execution context model."""
        worker_job_payload = {
            "class": "ProjectExportWorker",
            "args": [101, "user_developer_1"],
            "retry": 3,
            "queue": "export",
        }
        self.assertEqual(worker_job_payload["class"], "ProjectExportWorker")
        self.assertEqual(len(worker_job_payload["args"]), 2)

    # =========================================================================
    # TIER 2: BOUNDARY & CORNER CASES TESTS (6 TESTS)
    # =========================================================================

    def test_t2_graphql_field_redaction_vs_rest_status_codes(self):
        """[Tier 2] Boundary: GraphQL returns empty array for redacted collection instead of 403."""
        rest_res = self.engine.execute_rest("Guest", "/api/v4/projects/:id/protected_branches", {})
        gql_res = self.engine.execute_graphql("Guest", "protectedBranches", ["name"])

        # REST returns 403 Forbidden
        self.assertEqual(rest_res["status"], 403)
        # GraphQL returns data: { project: { protectedBranches: [] } } with empty nodes
        self.assertEqual(gql_res["data"]["project"]["protectedBranches"], [])
        self.assertIsNone(gql_res["errors"])

    def test_t2_toctou_worker_role_demotion_simulation(self):
        """[Tier 2] Corner Case: TOCTOU race simulation where user demoted before worker executes."""
        class TOCTOUSimulator:
            def __init__(self):
                self.user_roles = {"user_1": 40}  # Starts as Maintainer

            def enqueue_export_job(self, user_id: str, project_id: int) -> dict:
                # Precondition check at enqueue time
                if self.user_roles[user_id] >= 40:
                    return {"job_id": "job_123", "user_id": user_id, "project_id": project_id}
                raise PermissionError("Enqueue denied")

            def execute_worker(self, job: dict, re_verify_policy: bool) -> str:
                user_id = job["user_id"]
                if re_verify_policy:
                    # Secure Worker: re-evaluates current role in database
                    current_role = self.user_roles.get(user_id, 0)
                    if current_role < 40:
                        return "EXECUTION_ABORTED_PERMISSION_REVOKED"
                return "EXPORT_EXECUTED_SUCCESSFULLY"

        sim = TOCTOUSimulator()
        job = sim.enqueue_export_job("user_1", 101)

        # Demote user before worker runs
        sim.user_roles["user_1"] = 10  # Demoted to Guest

        # Insecure worker executes without re-checking (vulnerability)
        insecure_res = sim.execute_worker(job, re_verify_policy=False)
        self.assertEqual(insecure_res, "EXPORT_EXECUTED_SUCCESSFULLY")

        # Hardened/Patched worker aborts execution (secure)
        secure_res = sim.execute_worker(job, re_verify_policy=True)
        self.assertEqual(secure_res, "EXECUTION_ABORTED_PERMISSION_REVOKED")

        # Test with Harness TOCTOU auditor
        vuln_finding = self.parity_auditor.audit_toctou_worker_reauthorization(
            worker_class="ProjectExportWorker",
            initial_user_role=40,
            demoted_user_role=10,
            worker_reverifies_policy=False,
            job_payload=job,
        )
        self.assertIsNotNone(vuln_finding)
        self.assertEqual(vuln_finding.vector, DifferentialVector.DIFF_VEC_02_UI_VS_WORKER_TOCTOU)

    def test_t2_ci_job_token_scope_allowlist_bypass_probe(self):
        """[Tier 2] Boundary: CI_JOB_TOKEN from unauthorized project blocked on REST & GraphQL."""
        def validate_job_token_request(source_project_id: int, target_project_id: int, allowlist: list) -> Tuple[int, str]:
            if source_project_id != target_project_id and source_project_id not in allowlist:
                return (403, "CI_JOB_TOKEN_UNAUTHORIZED_CROSS_PROJECT")
            return (200, "AUTHORIZED")

        # Target allows project 50
        status, msg = validate_job_token_request(source_project_id=99, target_project_id=100, allowlist=[50])
        self.assertEqual(status, 403)
        self.assertEqual(msg, "CI_JOB_TOKEN_UNAUTHORIZED_CROSS_PROJECT")

        # Test with Harness TokenBoundaryAuditor
        iso_res = self.token_auditor.test_ci_job_token_isolation(
            source_project_id=99,
            target_project_id=100,
            inbound_allowlist=[50],
            simulated_response_status=403,
            job_status="running",
        )
        self.assertFalse(iso_res["is_authorized"])
        self.assertFalse(iso_res["leak_occurred"])
        self.assertEqual(iso_res["verdict"], "ISOLATION_ENFORCED")

    def test_t2_feature_disabled_cross_interface_consistency(self):
        """[Tier 2] Boundary: When project feature is DISABLED, all interfaces reject access."""
        def check_feature_access(interface: str, feature_state: str, user_role: int) -> bool:
            if feature_state == "DISABLED":
                return False
            return user_role >= 20

        for iface in ["REST", "GraphQL", "UI_CONTROLLER", "SIDEKIQ_WORKER"]:
            self.assertFalse(
                check_feature_access(iface, "DISABLED", user_role=50),
                f"Interface {iface} must deny access when feature is DISABLED even for Owner",
            )

        # Test with Harness Feature Isolation Auditor
        feature_finding = self.parity_auditor.audit_feature_isolation_leakage(
            feature_name="wiki",
            feature_state="DISABLED",
            actor_role=50,
            rest_accessible=False,
            graphql_accessible=False,
            ui_accessible=False,
            worker_accessible=False,
        )
        self.assertIsNone(feature_finding, "Hardened system should not leak disabled feature")

    def test_t2_group_sharing_clamping_differential_probe(self):
        """[Tier 2] Boundary: Group link clamped to Reporter prevents push across all interfaces."""
        shared_role = 30     # Developer in parent group
        max_clamped = 20     # Clamped to Reporter
        effective = min(shared_role, max_clamped)

        can_push = effective >= 30
        self.assertFalse(can_push, "Clamped role of 20 (Reporter) cannot push code")

        # Test with Harness Group Link Clamping Auditor
        finding = self.parity_auditor.audit_group_link_clamping(
            source_group_role=30,
            project_link_max_access=20,
            actual_granted_access=20,
        )
        self.assertIsNone(finding, "No finding when access is correctly clamped")

        # Flag when clamping is bypassed
        vuln_finding = self.parity_auditor.audit_group_link_clamping(
            source_group_role=30,
            project_link_max_access=20,
            actual_granted_access=30,
        )
        self.assertIsNotNone(vuln_finding)
        self.assertEqual(vuln_finding.vector, DifferentialVector.DIFF_VEC_05_GROUP_LINK_CLAMPING_BYPASS)

    def test_t2_external_user_cross_namespace_leak_detection(self):
        """[Tier 2] Corner Case: External user cannot query internal projects via GraphQL search."""
        def search_projects(user_is_external: bool, project_visibility: str, is_member: bool) -> bool:
            if project_visibility == "internal" and user_is_external:
                return is_member
            return True

        self.assertFalse(search_projects(user_is_external=True, project_visibility="internal", is_member=False))
        self.assertTrue(search_projects(user_is_external=True, project_visibility="internal", is_member=True))

        # Test with Harness External User Auditor
        finding = self.parity_auditor.audit_external_user_isolation(
            user_is_external=True,
            project_visibility="internal",
            is_direct_member=False,
            interface_results={"REST": False, "GraphQL": False, "UI": False},
        )
        self.assertIsNone(finding)

    # =========================================================================
    # TIER 3: PAIRWISE COMBINATIONS TESTS (2 TESTS)
    # =========================================================================

    def test_t3_pairwise_interface_vs_role_parity_matrix(self):
        """[Tier 3] Pairwise validation across interfaces and role permissions for issues."""
        roles = ["Guest", "Reporter", "Developer", "Maintainer", "Owner"]
        for role in roles:
            rest_res = self.engine.execute_rest(role, "/api/v4/projects/:id/issues", {})
            gql_res = self.engine.execute_graphql(role, "projectIssues", ["id", "title"])
            disparity = self.engine.compare_parity(role, "read_issues", rest_res, gql_res)
            self.assertIsNone(disparity, f"Role {role} should have parity between REST and GraphQL on issues")

    def test_t3_pairwise_token_scope_vs_api_endpoint_matrix(self):
        """[Tier 3] Pairwise validation of token scopes against API endpoints."""
        matrix = [
            (["api"], "read", True),
            (["api"], "write", True),
            (["read_api"], "read", True),
            (["read_api"], "write", False),
            (["read_repository"], "read", True),
            (["read_repository"], "write", False),
        ]
        for scopes, action_type, expected_allow in matrix:
            allowed = "api" in scopes or ("read_api" in scopes and action_type == "read") or ("read_repository" in scopes and action_type == "read")
            self.assertEqual(allowed, expected_allow)

            # Assert harness TokenBoundaryAuditor behavior matches
            req_scope = "read_repository" if action_type == "read" else "write_repository"
            is_write = (action_type == "write")
            harness_allowed = self.token_auditor.is_scope_sufficient(scopes, req_scope, is_write=is_write)
            self.assertEqual(harness_allowed, expected_allow)

    # =========================================================================
    # TIER 4: REAL-WORLD SCENARIOS TESTS (1 TEST)
    # =========================================================================

    def test_t4_e2e_multi_interface_differential_audit_execution(self):
        """[Tier 4] Execute comprehensive simulated differential audit scan over 10 actions."""
        test_actions = [
            ("Guest", "/api/v4/projects/:id/export", "projectExport"),
            ("Reporter", "/api/v4/projects/:id/export", "projectExport"),
            ("Developer", "/api/v4/projects/:id/export", "projectExport"),
            ("Maintainer", "/api/v4/projects/:id/export", "projectExport"),
            ("Owner", "/api/v4/projects/:id/export", "projectExport"),
            ("Guest", "/api/v4/projects/:id/issues", "projectIssues"),
            ("Reporter", "/api/v4/projects/:id/issues", "projectIssues"),
            ("Developer", "/api/v4/projects/:id/issues", "projectIssues"),
            ("Maintainer", "/api/v4/projects/:id/issues", "projectIssues"),
            ("Owner", "/api/v4/projects/:id/issues", "projectIssues"),
        ]

        scanned = 0
        disparities_found = 0
        for role, rest_path, gql_query in test_actions:
            rest_out = self.engine.execute_rest(role, rest_path, {})
            gql_out = self.engine.execute_graphql(role, gql_query, [])
            disp = self.engine.compare_parity(role, f"{rest_path}:{gql_query}", rest_out, gql_out)
            scanned += 1
            if disp:
                disparities_found += 1

        self.assertEqual(scanned, 10)
        self.assertEqual(disparities_found, 0, "No disparities should exist on standard hardened baseline")

        # Also verify 10-token taxonomy completeness
        taxonomy = self.token_auditor.get_taxonomy()
        self.assertEqual(len(taxonomy), 10, "Taxonomy must define all 10 GitLab token types")


if __name__ == "__main__":
    unittest.main()
