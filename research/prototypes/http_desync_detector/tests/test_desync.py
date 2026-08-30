"""
Unit and Integration Tests for HTTP Desync Detector Prototype
"""

import unittest
from research.prototypes.http_desync_detector.models import (
    DesyncVectorType,
    ProbeMethod,
    DesyncProbe,
    ProbeResponseObservation,
    SmugglingDetectionResult,
)
from research.prototypes.http_desync_detector.detector import (
    DesyncProbeGenerator,
    SinglePacketFrameAssembler,
    HttpDesyncDetector,
)
from research.prototypes.http_desync_detector.fixtures.fixture_environments import (
    get_vulnerable_cl_te_observation,
    get_vulnerable_h2_cl_observation,
    get_fixed_cl_te_observation,
)


class TestHttpDesyncDetector(unittest.TestCase):

    def setUp(self):
        self.detector = HttpDesyncDetector()

    def test_cl_te_probe_payload_formatting(self):
        probe = DesyncProbeGenerator.generate_cl_te_timeout_probe("example.com", "/test")
        self.assertEqual(probe.vector_type, DesyncVectorType.CL_TE)
        self.assertEqual(probe.probe_method, ProbeMethod.TIMEOUT_HANG)
        self.assertIn(b"Content-Length: 4\r\n", probe.raw_payload)
        self.assertIn(b"Transfer-Encoding: chunked\r\n", probe.raw_payload)
        self.assertTrue(probe.raw_payload.endswith(b"\r\n1\r\nZ\r\nQ"))

    def test_te_cl_probe_payload_formatting(self):
        probe = DesyncProbeGenerator.generate_te_cl_timeout_probe("example.com", "/test")
        self.assertEqual(probe.vector_type, DesyncVectorType.TE_CL)
        self.assertIn(b"Content-Length: 6\r\n", probe.raw_payload)
        self.assertIn(b"Transfer-Encoding: chunked\r\n", probe.raw_payload)
        self.assertTrue(probe.raw_payload.endswith(b"\r\n0\r\n\r\nX"))

    def test_te_te_obfuscation_probes(self):
        probes = DesyncProbeGenerator.generate_te_te_obfuscated_probes("example.com")
        self.assertGreaterEqual(len(probes), 5)
        for p in probes:
            self.assertEqual(p.vector_type, DesyncVectorType.TE_TE_OBFUSCATED)

    def test_h2_cl_probe_generation(self):
        probe = DesyncProbeGenerator.generate_h2_cl_probe("example.com", "/api", canary="test_canary_123")
        self.assertEqual(probe.vector_type, DesyncVectorType.H2_CL)
        self.assertEqual(probe.prefix_canary, "test_canary_123")
        self.assertIn(b"content-length: 0", probe.raw_payload)

    def test_single_packet_frame_assembler(self):
        req1 = b"POST / HTTP/1.1\r\nHost: a.com\r\n\r\n"
        req2 = b"POST / HTTP/1.1\r\nHost: a.com\r\n\r\n"
        packed, fits = SinglePacketFrameAssembler.assemble_single_packet_batch([req1, req2], max_mss=1460)
        self.assertEqual(packed, req1 + req2)
        self.assertTrue(fits)

        # Test exceeding MSS
        huge_reqs = [b"X" * 800, b"Y" * 800]
        _, huge_fits = SinglePacketFrameAssembler.assemble_single_packet_batch(huge_reqs, max_mss=1460)
        self.assertFalse(huge_fits)

    def test_cl_te_timeout_detection_vulnerable(self):
        probe, obs, base_obs = get_vulnerable_cl_te_observation()
        result = self.detector.evaluate_probe_response(probe, obs, base_obs)

        self.assertTrue(result.is_vulnerable)
        self.assertEqual(result.evidence_type, "TIMEOUT_INDUCED")
        self.assertGreater(result.confidence, 0.90)
        self.assertIn("Enforce HTTP/2", result.remediation_recommendation)

    def test_h2_cl_prefix_leak_vulnerable(self):
        probe, obs, base_obs = get_vulnerable_h2_cl_observation()
        result = self.detector.evaluate_probe_response(probe, obs, base_obs)

        self.assertTrue(result.is_vulnerable)
        self.assertIn(result.evidence_type, ["PREFIX_LEAK", "STATUS_ANOMALY"])
        self.assertGreater(result.confidence, 0.85)

    def test_cl_te_fixed_remediation_negative_control(self):
        probe, obs, base_obs = get_fixed_cl_te_observation()
        result = self.detector.evaluate_probe_response(probe, obs, base_obs)

        self.assertFalse(result.is_vulnerable)
        self.assertEqual(result.evidence_type, "NONE")
        self.assertEqual(result.confidence, 0.0)


if __name__ == "__main__":
    unittest.main()
