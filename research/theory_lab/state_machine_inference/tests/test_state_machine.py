"""
Unit and Integration Tests for State Machine Inference Module
"""

import unittest
from research.theory_lab.state_machine_inference.models import (
    AuthStateTier,
    StateVulnType,
    TraceAction,
    StateNode,
    StateTransition,
    StateVulnerability,
)
from research.theory_lab.state_machine_inference.inference_engine import (
    InferredMealyMachine,
    KTailsLearner,
    AuthLifecycleInferrer,
    StateVulnerabilityDetector,
)
from research.theory_lab.state_machine_inference.fixtures.fixture_environments import (
    get_standard_checkout_traces,
    get_vulnerable_skip_trace,
)


class TestStateMachineInference(unittest.TestCase):

    def test_ktails_trace_merging(self):
        traces = get_standard_checkout_traces()
        learner = KTailsLearner(k=2)
        fsm = learner.infer_from_traces(traces)

        self.assertIsNotNone(fsm.initial_state_id)
        # Should have states and transitions
        self.assertGreater(len(fsm.states), 1)
        self.assertGreater(sum(len(t) for t in fsm.transitions.values()), 3)

    def test_auth_lifecycle_tier_inference(self):
        act_login = TraceAction(method="POST", endpoint="/auth/login")
        tier_login = AuthLifecycleInferrer.infer_action_tier(act_login)
        self.assertEqual(tier_login, AuthStateTier.PRE_AUTH_CHALLENGE)

        act_admin = TraceAction(method="GET", endpoint="/admin/mfa/elevate")
        tier_admin = AuthLifecycleInferrer.infer_action_tier(act_admin)
        self.assertEqual(tier_admin, AuthStateTier.ELEVATED_PRIVILEGE)

        act_logout = TraceAction(method="POST", endpoint="/auth/logout")
        tier_logout = AuthLifecycleInferrer.infer_action_tier(act_logout)
        self.assertEqual(tier_logout, AuthStateTier.SESSION_EXPIRED_REVOKED)

    def test_out_of_order_bypass_vulnerable(self):
        fsm = InferredMealyMachine()
        detector = StateVulnerabilityDetector(fsm)

        required, terminal, obs_status = get_vulnerable_skip_trace()
        vuln = detector.check_out_of_order_bypass(required, terminal, obs_status)

        self.assertIsNotNone(vuln)
        self.assertEqual(vuln.vuln_type, StateVulnType.OUT_OF_ORDER_BYPASS)
        self.assertEqual(vuln.severity, "HIGH")
        self.assertIn("GET /order/success", vuln.title)

    def test_out_of_order_bypass_fixed(self):
        fsm = InferredMealyMachine()
        detector = StateVulnerabilityDetector(fsm)

        # Target rejects skipping with 403 Forbidden
        vuln = detector.check_out_of_order_bypass(["POST /checkout/pay"], "GET /order/success", 403)
        self.assertIsNone(vuln)

    def test_broken_session_lifecycle_detection(self):
        fsm = InferredMealyMachine()
        detector = StateVulnerabilityDetector(fsm)

        # Action succeeds after logout
        vuln = detector.check_broken_session_lifecycle("GET /api/user/profile", 200)
        self.assertIsNotNone(vuln)
        self.assertEqual(vuln.vuln_type, StateVulnType.BROKEN_SESSION_LIFECYCLE)
        self.assertEqual(vuln.severity, "CRITICAL")


if __name__ == "__main__":
    unittest.main()
