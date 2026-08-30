"""
Research Engine: Multi-Session Differential Engine
Detects asymmetric authorization elevation, state leakage, and security invariant violations.
"""

from typing import Dict, Any, List, Optional

class DifferentialSecurityEngine:
    """Evaluates differential responses across identities, roles, and temporal states."""

    @staticmethod
    def evaluate_authorization_divergence(
        status_a: int,
        status_b: int,
        response_body_b: Dict[str, Any],
        expected_leak_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Checks if Identity B unauthorizedly accessed Identity A's scope."""
        is_violation = (status_a in [200, 201] and status_b in [200, 201])
        leak_detected = False
        if is_violation and expected_leak_key:
            leak_detected = expected_leak_key in str(response_body_b)

        return {
            "violation": is_violation,
            "leak_confirmed": leak_detected,
            "status_a": status_a,
            "status_b": status_b
        }

    @staticmethod
    def evaluate_temporal_state_desync(
        pre_rollback_status: int,
        rollback_status: int,
        post_rollback_status: int,
        commit_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Detects cross-tenant state promotion caused by unpinned context locks."""
        is_desync = (
            pre_rollback_status in [401, 403, 404] and
            rollback_status in [200, 201] and
            post_rollback_status in [200, 201] and
            commit_payload.get("status") == "APPROVED_AND_EXECUTED"
        )
        return {
            "desync_confirmed": is_desync,
            "pre_code": pre_rollback_status,
            "rollback_code": rollback_status,
            "post_code": post_rollback_status,
            "confidence": 0.95 if is_desync else 0.0
        }
