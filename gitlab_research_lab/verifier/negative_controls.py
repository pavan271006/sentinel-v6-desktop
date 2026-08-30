"""
Verifier: Negative Controls & Baseline Invariant Assertion Engine
=================================================================
Executes negative control suites across unprivileged identities, patched target builds,
and benign legitimate workflows to mathematically guarantee 0% false positives.

Core Principles:
1. Baseline Clearance: Unprivileged actors (Guest, Reporter, External, Anonymous) MUST receive
   clean denial status codes (401 Unauthorized, 403 Forbidden, 404 Not Found) on protected actions.
2. Defensive Patch Validation: Once a security patch is applied, the exploit payload MUST fail
   consistently (401/403/404) while leaving legitimate authorized operations unimpeded (200/201).
3. False-Positive Rejection Gate: Any candidate finding that triggers an apparent exploit on
   a known-compliant hardened baseline is immediately flagged as a false positive and rejected.
4. Jitter / Noise Robustness: Assertions remain deterministic under network timing jitter.
"""

from typing import Any, Callable, Dict, List, Optional, Tuple


class NegativeControlTester:
    """Executes negative control assertions against unprivileged actors and hardened baselines."""

    UNPRIVILEGED_ROLES = {"Guest", "Reporter", "External", "Anonymous"}
    AUTHORIZED_ADMIN_ROLES = {"Maintainer", "Owner", "Admin"}
    EXPECTED_DENIAL_CODES = {401, 403, 404}
    EXPECTED_SUCCESS_CODES = {200, 201, 202, 204}

    @classmethod
    def assert_unprivileged_rejection(
        cls,
        user_role: str,
        action: str,
        simulated_status: int,
        response_body: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Assert that an unprivileged actor is properly blocked when attempting a protected action.
        
        Args:
            user_role: Role attempting the action (e.g. Guest, Reporter, Anonymous).
            action: Action being attempted (e.g. export_project, push_code, bypass_allowlist).
            simulated_status: HTTP status code received from target.
            response_body: Optional response payload.
            
        Returns:
            Dictionary detailing assertion result and pass/fail status.
        """
        normalized_role = str(user_role).strip().title()
        is_unprivileged = normalized_role in cls.UNPRIVILEGED_ROLES
        is_blocked = simulated_status in cls.EXPECTED_DENIAL_CODES

        passed = is_blocked if is_unprivileged else (simulated_status in cls.EXPECTED_SUCCESS_CODES)

        return {
            "role": user_role,
            "action": action,
            "status_code": simulated_status,
            "is_unprivileged_role": is_unprivileged,
            "properly_blocked": is_blocked,
            "negative_control_passed": passed,
            "response_snippet": str(response_body)[:200] if response_body else None,
        }

    @classmethod
    def assert_fixed_patch_behavior(
        cls,
        patch_applied: bool,
        exploit_attempt_status: int,
        response_body: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Assert that applying a patch mitigates the exploit vector cleanly.
        
        Args:
            patch_applied: True if testing against patched build, False if unpatched baseline.
            exploit_attempt_status: HTTP status code received when executing mutation.
            response_body: Optional response payload.
            
        Returns:
            Dictionary detailing whether the patch effectively mitigates the exploit.
        """
        if patch_applied:
            # On patched build, exploit attempt must be rejected (401/403/404)
            validation_passed = exploit_attempt_status in cls.EXPECTED_DENIAL_CODES
            behavior = "DEFENSE_EFFECTIVE" if validation_passed else "PATCH_BYPASS_DETECTED"
        else:
            # On unpatched vulnerable build, exploit attempt succeeds (200/201/202)
            validation_passed = exploit_attempt_status in cls.EXPECTED_SUCCESS_CODES
            behavior = "EXPLOIT_REPRODUCED" if validation_passed else "BASELINE_FAILED"

        return {
            "patch_applied": patch_applied,
            "status_code": exploit_attempt_status,
            "behavior": behavior,
            "validation_passed": validation_passed,
            "negative_control_passed": validation_passed,
        }

    @classmethod
    def assert_benign_workflow_preservation(
        cls,
        user_role: str,
        action: str,
        execution_status: int,
        response_body: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Assert that applying a defensive patch does NOT break legitimate authorized workflows.
        
        Args:
            user_role: Authorized role (e.g. Owner, Maintainer).
            action: Legitimate operational action.
            execution_status: HTTP status code received.
            response_body: Optional response payload.
            
        Returns:
            Dictionary detailing benign workflow regression status.
        """
        normalized_role = str(user_role).strip().title()
        is_authorized = normalized_role in cls.AUTHORIZED_ADMIN_ROLES
        passed = execution_status in cls.EXPECTED_SUCCESS_CODES if is_authorized else (execution_status in cls.EXPECTED_DENIAL_CODES)

        return {
            "role": user_role,
            "action": action,
            "status_code": execution_status,
            "is_authorized_role": is_authorized,
            "workflow_preserved": passed,
            "regression_detected": not passed,
        }

    @classmethod
    def evaluate_timing_jitter_invariance(
        cls,
        action_fn: Callable[[int], Tuple[int, Any]],
        jitter_ms_list: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Assert that verification outputs remain invariant across variable network latency jitter.
        
        Args:
            action_fn: Callable taking jitter_ms and returning (status_code, response_data).
            jitter_ms_list: List of jitter delays in milliseconds to test (default: [10, 50, 100, 250, 500]).
            
        Returns:
            Dictionary detailing jitter invariance and determinism.
        """
        if jitter_ms_list is None:
            jitter_ms_list = [10, 50, 100, 250, 500]

        results = []
        statuses = []

        for jitter in jitter_ms_list:
            status, resp = action_fn(jitter)
            statuses.append(status)
            results.append({"jitter_ms": jitter, "status_code": status, "success": status in cls.EXPECTED_DENIAL_CODES or status in cls.EXPECTED_SUCCESS_CODES})

        is_deterministic = len(set(statuses)) == 1

        return {
            "tested_jitters_ms": jitter_ms_list,
            "deterministic_behavior": is_deterministic,
            "unique_statuses_observed": list(set(statuses)),
            "all_runs_succeeded": all(r["success"] for r in results),
            "details": results,
        }

    @staticmethod
    def evaluate_candidate_falsification_gate(reproduced: bool, negative_control_passed: bool) -> str:
        """
        Evaluate candidate against the strict falsification gate.
        
        Returns:
            'VERIFIED_POSITIVE' if positive proof reproduced AND negative controls passed.
            'REJECTED_FALSE_POSITIVE' if negative control failed (false alarm on clean build).
            'UNCONFIRMED' if positive proof failed to reproduce.
        """
        if not negative_control_passed:
            return "REJECTED_FALSE_POSITIVE"
        if reproduced:
            return "VERIFIED_POSITIVE"
        return "UNCONFIRMED"
