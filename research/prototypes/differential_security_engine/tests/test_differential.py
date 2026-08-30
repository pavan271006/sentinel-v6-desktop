"""
Unit and Integration Tests for Differential Security Engine Prototype
"""

import unittest
from research.prototypes.differential_security_engine.models import (
    DifferentialAxis,
    ResponseSnapshot,
    DivergenceResult,
)
from research.prototypes.differential_security_engine.engine import (
    DifferentialSecurityEngine,
    compute_token_shannon_entropy,
    mask_volatile_tokens,
    extract_structural_tokens,
    compute_jaccard_similarity,
    welch_t_test,
)
from research.prototypes.differential_security_engine.fixtures.fixture_environments import (
    get_bola_vulnerable_pair,
    get_bola_fixed_pair,
    get_time_sqli_distributions,
)


class TestDifferentialSecurityEngine(unittest.TestCase):

    def setUp(self):
        self.engine = DifferentialSecurityEngine()

    def test_token_shannon_entropy(self):
        e_low = compute_token_shannon_entropy("aaaaaaa")
        self.assertEqual(e_low, 0.0)

        e_high = compute_token_shannon_entropy("k9#mP!z8$wL2@qX0")
        self.assertGreater(e_high, 3.5)

    def test_volatile_token_masking(self):
        raw = '{"uuid": "12345678-1234-5678-1234-567812345678", "time": "2026-08-22T14:30:00Z", "nonce": "d98f7a6b5c4e3f2a1b"}'
        masked, count = mask_volatile_tokens(raw)
        self.assertNotIn("12345678-1234-5678-1234-567812345678", masked)
        self.assertNotIn("2026-08-22T14:30:00Z", masked)
        self.assertIn("[UUID_MASKED]", masked)
        self.assertIn("[TIMESTAMP_MASKED]", masked)
        self.assertGreater(count, 0)

    def test_structural_jaccard_similarity(self):
        json_a = '{"user": {"id": 1, "name": "Alice"}, "status": "active"}'
        json_b = '{"user": {"id": 2, "name": "Bob"}, "status": "active"}'
        tokens_a = extract_structural_tokens(json_a)
        tokens_b = extract_structural_tokens(json_b)
        sim = compute_jaccard_similarity(tokens_a, tokens_b)
        # Structural keys and types match 100%
        self.assertEqual(sim, 1.0)

        json_c = '{"error": "Not Found", "code": 404}'
        tokens_c = extract_structural_tokens(json_c)
        sim_ac = compute_jaccard_similarity(tokens_a, tokens_c)
        self.assertLess(sim_ac, 0.5)

    def test_welch_t_test_significance(self):
        base, injected = get_time_sqli_distributions()
        t_stat, p_val, is_sig = welch_t_test(base, injected)

        self.assertIsNotNone(t_stat)
        self.assertGreater(abs(t_stat), 100.0) # Massive separation
        self.assertTrue(is_sig)
        self.assertLess(p_val, 0.0001)

        # Negative control: same distribution
        pop1 = [10.0, 10.2, 9.8, 10.1, 10.0]
        pop2 = [10.1, 9.9, 10.0, 10.2, 9.8]
        t_stat2, p_val2, is_sig2 = welch_t_test(pop1, pop2)
        self.assertFalse(is_sig2)
        self.assertGreater(p_val2, 0.05)

    def test_bola_idor_detection_vulnerable(self):
        resp_a, resp_b = get_bola_vulnerable_pair()
        result = self.engine.analyze_divergence(resp_a, resp_b, DifferentialAxis.ROLE_A_VS_ROLE_B)

        self.assertEqual(result.finding_verdict, "CONFIRMED_VULNERABILITY")
        self.assertEqual(result.details["vuln_type"], "IDOR_BOLA_HORIZONTAL_BYPASS")
        self.assertGreaterEqual(result.ast_jaccard_similarity, 0.80)

    def test_bola_idor_detection_fixed(self):
        resp_a, resp_b = get_bola_fixed_pair()
        result = self.engine.analyze_divergence(resp_a, resp_b, DifferentialAxis.ROLE_A_VS_ROLE_B)

        self.assertEqual(result.finding_verdict, "BENIGN")
        self.assertTrue(result.status_code_diverged)
        self.assertEqual(result.details["candidate_status"], 403)

    def test_bfla_unauthenticated_access_detection(self):
        # Admin gets 200 with sensitive panel; Anonymous also gets 200 with sensitive panel -> BFLA
        admin_resp = ResponseSnapshot(status_code=200, body='{"admin_users": ["root", "admin"], "config": "prod"}')
        anon_resp = ResponseSnapshot(status_code=200, body='{"admin_users": ["root", "admin"], "config": "prod"}')

        result = self.engine.analyze_divergence(admin_resp, anon_resp, DifferentialAxis.AUTHENTICATED_VS_ANONYMOUS)
        self.assertEqual(result.finding_verdict, "CONFIRMED_VULNERABILITY")
        self.assertEqual(result.details["vuln_type"], "BFLA_UNAUTHENTICATED_ACCESS")

    def test_time_based_injection_detection(self):
        base_resp = ResponseSnapshot(status_code=200, body="OK", latency_ms=30.0)
        cand_resp = ResponseSnapshot(status_code=200, body="OK", latency_ms=5030.0)
        base_lats, cand_lats = get_time_sqli_distributions()

        result = self.engine.analyze_divergence(
            base_resp,
            cand_resp,
            DifferentialAxis.BASELINE_VS_MUTATED,
            baseline_latencies=base_lats,
            candidate_latencies=cand_lats
        )
        self.assertEqual(result.finding_verdict, "CONFIRMED_VULNERABILITY")
        self.assertEqual(result.details["vuln_type"], "TIME_BASED_INJECTION")
        self.assertTrue(result.is_statistically_significant)


if __name__ == "__main__":
    unittest.main()
