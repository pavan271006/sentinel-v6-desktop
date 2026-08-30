"""
Harness: Multi-Interface Authorization Parity Auditor & Differential Engine
============================================================================
Performs differential assertions across REST API (Grape), GraphQL (GraphQL-Ruby),
UI Controllers (ActionPack), and Sidekiq Background Workers.

Authoritative Reference:
- gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md (Section 5)
- Differential Vectors: DIFF-VEC-01 through DIFF-VEC-07
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class DifferentialVector(Enum):
    DIFF_VEC_01_REST_VS_GRAPHQL_REDACTION = "DIFF-VEC-01: REST vs GraphQL Redaction Discrepancy"
    DIFF_VEC_02_UI_VS_WORKER_TOCTOU = "DIFF-VEC-02: UI Controller vs Background Worker TOCTOU Omission"
    DIFF_VEC_03_TOKEN_SCOPE_ASYMMETRY = "DIFF-VEC-03: Token Scope Enforcement Asymmetry"
    DIFF_VEC_04_FEATURE_ISOLATION_LEAKAGE = "DIFF-VEC-04: Project Feature Isolation Leakage"
    DIFF_VEC_05_GROUP_LINK_CLAMPING_BYPASS = "DIFF-VEC-05: Group Sharing Max Access Level Clamping Bypass"
    DIFF_VEC_06_EXTERNAL_USER_LEAKAGE = "DIFF-VEC-06: External User Internal Namespace Exposure"
    DIFF_VEC_07_ADMIN_MODE_GATING_ASYMMETRY = "DIFF-VEC-07: Admin Mode Gating Asymmetry"


@dataclass
class DifferentialFinding:
    vector: DifferentialVector
    action_or_resource: str
    actor_identity: str
    interfaces_tested: List[str]
    disparity_summary: str
    severity: str
    evidence: Dict[str, Any]


class InterfaceParityAuditor:
    """
    Automated differential tester comparing multi-interface authorization decisions
    across REST, GraphQL, UI Controllers, and Sidekiq Workers.
    """

    def __init__(self):
        self.findings: List[DifferentialFinding] = []

    @staticmethod
    def compare_endpoints(
        operation_name: str,
        rest_status: int,
        graphql_data: Optional[Dict[str, Any]],
        graphql_errors: Optional[List[Dict[str, Any]]],
        allowed_roles: List[str],
        tested_role: str,
    ) -> Dict[str, Any]:
        """
        Original parity comparison helper.
        Maintains backward compatibility while providing rich diagnosis.
        """
        rest_allowed = rest_status in [200, 201, 202]
        graphql_allowed = graphql_data is not None and not graphql_errors
        should_allow = tested_role in allowed_roles

        discrepancy = (rest_allowed != graphql_allowed) or (rest_allowed != should_allow) or (graphql_allowed != should_allow)

        severity = "LOW"
        if discrepancy:
            if (rest_allowed or graphql_allowed) and not should_allow:
                severity = "HIGH"
            elif rest_allowed != graphql_allowed:
                severity = "MEDIUM"

        return {
            "operation": operation_name,
            "tested_role": tested_role,
            "rest_allowed": rest_allowed,
            "graphql_allowed": graphql_allowed,
            "expected_allowed": should_allow,
            "discrepancy_detected": discrepancy,
            "severity": severity,
        }

    def audit_rest_vs_graphql_redaction(
        self,
        resource_path: str,
        graphql_query: str,
        actor_role: str,
        rest_response: Dict[str, Any],
        graphql_response: Dict[str, Any],
        expected_allowed: bool,
    ) -> Optional[DifferentialFinding]:
        """
        DIFF-VEC-01: Audits for GraphQL field-level leakage when REST endpoint returns 403/404.
        """
        rest_status = rest_response.get("status", 500)
        rest_allowed = rest_status in [200, 201, 202]

        gql_data = graphql_response.get("data")
        gql_errors = graphql_response.get("errors")
        
        # Check if GraphQL returned partial data for sensitive field despite top-level denial
        gql_leaked_data = False
        if not expected_allowed and gql_data:
            # If data is populated with non-empty lists/objects
            for k, v in gql_data.items():
                if v not in [None, [], {}]:
                    gql_leaked_data = True
                    break

        if (not rest_allowed and gql_leaked_data) or (rest_allowed != (gql_data is not None and not gql_errors)):
            finding = DifferentialFinding(
                vector=DifferentialVector.DIFF_VEC_01_REST_VS_GRAPHQL_REDACTION,
                action_or_resource=resource_path,
                actor_identity=actor_role,
                interfaces_tested=["REST", "GraphQL"],
                disparity_summary=f"REST returned {rest_status}, but GraphQL exposed data: {gql_data}",
                severity="HIGH" if gql_leaked_data and not expected_allowed else "MEDIUM",
                evidence={"rest": rest_response, "graphql": graphql_response},
            )
            self.findings.append(finding)
            return finding
        return None

    def audit_toctou_worker_reauthorization(
        self,
        worker_class: str,
        initial_user_role: int,
        demoted_user_role: int,
        worker_reverifies_policy: bool,
        job_payload: Dict[str, Any],
    ) -> Optional[DifferentialFinding]:
        """
        DIFF-VEC-02: Audits background worker for TOCTOU authorization omission upon user demotion.
        """
        # If user was Maintainer (40) at enqueue time, but demoted to Guest (10) before execution
        if initial_user_role >= 40 and demoted_user_role < 40:
            if not worker_reverifies_policy:
                finding = DifferentialFinding(
                    vector=DifferentialVector.DIFF_VEC_02_UI_VS_WORKER_TOCTOU,
                    action_or_resource=worker_class,
                    actor_identity=f"Role demoted: {initial_user_role} -> {demoted_user_role}",
                    interfaces_tested=["UI_CONTROLLER", "SIDEKIQ_WORKER"],
                    disparity_summary="Sidekiq worker executed privileged job without re-evaluating DeclarativePolicy after role demotion.",
                    severity="HIGH",
                    evidence={"worker": worker_class, "job_payload": job_payload, "demoted_role": demoted_user_role},
                )
                self.findings.append(finding)
                return finding
        return None

    def audit_feature_isolation_leakage(
        self,
        feature_name: str,
        feature_state: str,  # "DISABLED", "PRIVATE", "ENABLED"
        actor_role: int,
        rest_accessible: bool,
        graphql_accessible: bool,
        ui_accessible: bool,
        worker_accessible: bool,
    ) -> Optional[DifferentialFinding]:
        """
        DIFF-VEC-04: Project Feature Isolation Leakage across all 4 interfaces.
        If feature is DISABLED, ALL interfaces must unconditionally deny access.
        """
        if feature_state == "DISABLED":
            leaking_ifaces = []
            if rest_accessible:
                leaking_ifaces.append("REST")
            if graphql_accessible:
                leaking_ifaces.append("GraphQL")
            if ui_accessible:
                leaking_ifaces.append("UI")
            if worker_accessible:
                leaking_ifaces.append("Worker")

            if leaking_ifaces:
                finding = DifferentialFinding(
                    vector=DifferentialVector.DIFF_VEC_04_FEATURE_ISOLATION_LEAKAGE,
                    action_or_resource=f"Feature:{feature_name}",
                    actor_identity=f"Role:{actor_role}",
                    interfaces_tested=["REST", "GraphQL", "UI", "Worker"],
                    disparity_summary=f"Feature {feature_name} is DISABLED but accessible via {', '.join(leaking_ifaces)}.",
                    severity="CRITICAL",
                    evidence={"feature": feature_name, "state": feature_state, "leaking": leaking_ifaces},
                )
                self.findings.append(finding)
                return finding
        return None

    def audit_group_link_clamping(
        self,
        source_group_role: int,
        project_link_max_access: int,
        actual_granted_access: int,
    ) -> Optional[DifferentialFinding]:
        """
        DIFF-VEC-05: Group Sharing Max Access Level Clamping Bypass.
        Effective access MUST be min(source_group_role, project_link_max_access).
        """
        expected_access = min(source_group_role, project_link_max_access)
        if actual_granted_access > expected_access:
            finding = DifferentialFinding(
                vector=DifferentialVector.DIFF_VEC_05_GROUP_LINK_CLAMPING_BYPASS,
                action_or_resource="ProjectGroupLink",
                actor_identity=f"SourceRole:{source_group_role}",
                interfaces_tested=["REST", "GraphQL"],
                disparity_summary=f"Access granted was {actual_granted_access}, exceeding clamped limit {expected_access}.",
                severity="HIGH",
                evidence={"source_role": source_group_role, "clamped_max": project_link_max_access, "granted": actual_granted_access},
            )
            self.findings.append(finding)
            return finding
        return None

    def audit_external_user_isolation(
        self,
        user_is_external: bool,
        project_visibility: str,
        is_direct_member: bool,
        interface_results: Dict[str, bool],
    ) -> Optional[DifferentialFinding]:
        """
        DIFF-VEC-06: External User Internal Namespace Exposure.
        External users MUST NOT access internal projects unless direct members.
        """
        if user_is_external and project_visibility == "internal" and not is_direct_member:
            leaks = [iface for iface, allowed in interface_results.items() if allowed]
            if leaks:
                finding = DifferentialFinding(
                    vector=DifferentialVector.DIFF_VEC_06_EXTERNAL_USER_LEAKAGE,
                    action_or_resource=f"InternalProject (vis:{project_visibility})",
                    actor_identity="External User (non-member)",
                    interfaces_tested=list(interface_results.keys()),
                    disparity_summary=f"External user was granted access to internal project via {', '.join(leaks)}.",
                    severity="HIGH",
                    evidence={"interface_results": interface_results},
                )
                self.findings.append(finding)
                return finding
        return None


if __name__ == "__main__":
    auditor = InterfaceParityAuditor()
    res = auditor.compare_endpoints(
        "read_issues",
        rest_status=200,
        graphql_data={"project": {"issues": []}},
        graphql_errors=None,
        allowed_roles=["Guest", "Reporter", "Developer", "Maintainer", "Owner", "Admin"],
        tested_role="Reporter",
    )
    print(res)
