"""
Unit and Integration Tests for Adaptive Test Planner Prototype
"""

import unittest
from research.prototypes.adaptive_test_planner.models import (
    VulnClass,
    ParamClassification,
    TargetExposure,
    SixFactorReasoning,
    TestCandidate,
    ExecutionFeedback,
)
from research.prototypes.adaptive_test_planner.planner import (
    BayesianBeliefModel,
    AdaptiveTestPlanner,
    TokenBucketRateLimiter,
    compute_shannon_entropy,
)


class TestAdaptiveTestPlanner(unittest.TestCase):

    def test_bayesian_belief_updates(self):
        model = BayesianBeliefModel()
        initial_mean, _, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        self.assertGreater(initial_mean, 0.20)

        # Update with confirmed positive finding
        model.update(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY, positive=True, weight=5.0)
        updated_mean, _, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        self.assertGreater(updated_mean, initial_mean)

        # Update with multiple negative findings
        for _ in range(10):
            model.update(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY, positive=False, weight=1.0)
        final_mean, _, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        self.assertLess(final_mean, updated_mean)

    def test_shannon_entropy(self):
        low_entropy = compute_shannon_entropy("1111111111")
        self.assertEqual(low_entropy, 0.0)

        high_entropy = compute_shannon_entropy("7f8a9b2c-e1f4-4d82-938b-fa394a108c90")
        self.assertGreater(high_entropy, 0.5)

    def test_six_factor_explainability_log(self):
        planner = AdaptiveTestPlanner(max_request_budget=100)
        cand = TestCandidate(
            endpoint="/api/v1/users/search",
            method="GET",
            parameter_name="query",
            param_type=ParamClassification.SEARCH_QUERY,
            vuln_class=VulnClass.SQL_INJECTION,
            exposure=TargetExposure.PUBLIC_DMZ,
            estimated_latency_ms=50.0,
        )
        planner.add_candidate(cand)

        # Assert 6-factor model fields are populated
        self.assertGreater(cand.calculated_utility, 0.0)
        self.assertIn("Bayesian Prior", cand.why_explanation)
        self.assertIn("Criticality", cand.why_explanation)
        self.assertIn("Anomaly Signal", cand.why_explanation)
        self.assertIn("Coverage Debt", cand.why_explanation)
        self.assertIn("Estimated Latency Cost", cand.why_explanation)
        self.assertIn("Composite Utility", cand.why_explanation)

    def test_priority_scheduling_order(self):
        planner = AdaptiveTestPlanner(max_request_budget=10)

        # Candidate 1: High risk command injection on admin endpoint
        c_high = TestCandidate(
            endpoint="/api/v1/admin/diagnostics",
            method="POST",
            parameter_name="cmd",
            param_type=ParamClassification.SYSTEM_COMMAND,
            vuln_class=VulnClass.COMMAND_INJECTION,
            exposure=TargetExposure.ADMIN_PRIVILEGED,
            estimated_latency_ms=40.0,
        )
        
        # Candidate 2: Low risk generic string on internal microservice
        c_low = TestCandidate(
            endpoint="/internal/health",
            method="GET",
            parameter_name="check",
            param_type=ParamClassification.GENERIC_STRING,
            vuln_class=VulnClass.CROSS_SITE_SCRIPTING,
            exposure=TargetExposure.INTERNAL_MICROSERVICE,
            estimated_latency_ms=200.0,
        )

        planner.add_candidate(c_low)
        planner.add_candidate(c_high)

        scheduled = planner.schedule_next_batch(batch_size=2)
        self.assertEqual(len(scheduled), 2)
        # High-risk candidate should be scheduled first
        self.assertEqual(scheduled[0].id, c_high.id)
        self.assertEqual(scheduled[1].id, c_low.id)

    def test_budget_constraints(self):
        planner = AdaptiveTestPlanner(max_request_budget=3)
        for i in range(10):
            planner.add_candidate(TestCandidate(endpoint=f"/test/{i}"))

        scheduled = planner.schedule_next_batch(batch_size=10)
        self.assertEqual(len(scheduled), 3)
        self.assertEqual(planner.remaining_budget, 0)
        self.assertEqual(planner.requests_dispatched, 3)

        # Further scheduling should yield nothing
        more = planner.schedule_next_batch(batch_size=5)
        self.assertEqual(len(more), 0)

    def test_dynamic_replanning_on_feedback(self):
        planner = AdaptiveTestPlanner(max_request_budget=50)

        c1 = TestCandidate(endpoint="/api/orders", parameter_name="id", vuln_class=VulnClass.IDOR_BOLA)
        c2 = TestCandidate(endpoint="/api/orders", parameter_name="filter", vuln_class=VulnClass.SQL_INJECTION)
        planner.add_candidate(c1)
        planner.add_candidate(c2)

        # Dispatch c1 and report an anomaly/500 error
        feedback = ExecutionFeedback(
            test_id=c1.id,
            vuln_class=VulnClass.IDOR_BOLA,
            endpoint="/api/orders",
            parameter_name="id",
            status_code=500,
            latency_ms=120.0,
            anomaly_detected=True,
            finding_confirmed=True
        )
        planner.record_feedback(feedback)

        # C2 should now have an elevated anomaly signal score
        updated_c2 = planner._candidate_pool[c2.id]
        self.assertGreater(updated_c2.reasoning.anomaly_signal_score, 0.0)


if __name__ == "__main__":
    unittest.main()
