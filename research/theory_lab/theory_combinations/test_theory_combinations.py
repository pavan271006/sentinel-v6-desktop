"""
Unified Master Theory Combination Experiments
Combines multiple prototypes and theory lab modules to evaluate cross-engine synergy.
"""

import unittest
import time

# Module 1: Security Context Graph
from research.prototypes.security_context_graph.models import (
    create_asset_node,
    create_service_node,
    create_endpoint_node,
    create_finding_node,
    create_evidence_node,
    EdgeType,
    NodeType,
    Severity,
)
from research.prototypes.security_context_graph.engine import SecurityContextGraph

# Module 2: Adaptive Test Planner
from research.prototypes.adaptive_test_planner.models import (
    TestCandidate,
    VulnClass,
    ParamClassification,
    TargetExposure,
    ExecutionFeedback,
)
from research.prototypes.adaptive_test_planner.planner import AdaptiveTestPlanner

# Module 3: Differential Security Engine
from research.prototypes.differential_security_engine.models import (
    DifferentialAxis,
    ResponseSnapshot,
)
from research.prototypes.differential_security_engine.engine import DifferentialSecurityEngine

# Module 4: HTTP Desync Detector
from research.prototypes.http_desync_detector.detector import (
    DesyncProbeGenerator,
    HttpDesyncDetector,
    SinglePacketFrameAssembler,
)
from research.prototypes.http_desync_detector.models import ProbeResponseObservation

# Module 5: State Machine Inference
from research.theory_lab.state_machine_inference.models import TraceAction, StateVulnType
from research.theory_lab.state_machine_inference.inference_engine import (
    KTailsLearner,
    StateVulnerabilityDetector,
)

# Module 6: Causal Evidence Engine
from research.theory_lab.causal_evidence_engine.engine import (
    CausalEvidenceEngine,
    PearlCausalAttributionEvaluator,
)


class TestTheoryCombinations(unittest.TestCase):

    def test_combination_1_state_machine_plus_differential(self):
        """
        Combination 1: State Machine + Differential Engine
        Uses inferred state machine to guide multi-step workflow replay,
        then evaluates differential divergence between Role A (victim) and Role B (attacker)
        at each workflow step to catch state-dependent BOLA/IDOR.
        """
        # Step 1: Infer State Machine from baseline traces
        traces = [
            [
                TraceAction(method="POST", endpoint="/cart/add"),
                TraceAction(method="POST", endpoint="/checkout/address"),
                TraceAction(method="POST", endpoint="/checkout/pay"),
            ]
        ]
        learner = KTailsLearner(k=2)
        fsm = learner.infer_from_traces(traces)
        self.assertGreater(len(fsm.states), 1)

        # Step 2: At the final payment/order state, evaluate differential response
        diff_engine = DifferentialSecurityEngine()
        resp_role_a = ResponseSnapshot(
            status_code=200,
            body='{"order_id": 9001, "customer": "Alice", "amount": 150.00, "status": "PAID"}',
            latency_ms=40.0
        )
        resp_role_b = ResponseSnapshot(
            status_code=200,
            body='{"order_id": 9001, "customer": "Alice", "amount": 150.00, "status": "PAID"}',
            latency_ms=42.0
        )
        
        diff_res = diff_engine.analyze_divergence(resp_role_a, resp_role_b, DifferentialAxis.ROLE_A_VS_ROLE_B)
        self.assertEqual(diff_res.finding_verdict, "CONFIRMED_VULNERABILITY")
        self.assertEqual(diff_res.details["vuln_type"], "IDOR_BOLA_HORIZONTAL_BYPASS")

    def test_combination_2_bayesian_planner_plus_context_graph_plus_causal_proof(self):
        """
        Combination 2: Bayesian Planner + Security Context Graph + Causal Evidence Engine
        1. Context Graph identifies reachable attack surface endpoint.
        2. Bayesian Planner ranks and dispatches optimal test candidate with 6-factor log.
        3. Causal Evidence Engine executes counterfactual test, verifies Pearl SCM causality,
           generates SHA-256 CAS Merkle root, and binds finding to Context Graph.
        """
        # 1. Graph
        graph = SecurityContextGraph()
        asset = create_asset_node("portal.target.com", "10.0.0.1")
        svc = create_service_node(asset.id, 443, "https")
        ep = create_endpoint_node(svc.id, "POST", "/api/v1/auth/login")
        graph.add_node(asset)
        graph.add_node(svc)
        graph.add_node(ep)
        graph.connect(asset.id, svc.id, EdgeType.EXPOSES)
        graph.connect(svc.id, ep.id, EdgeType.ROUTES_TO)

        # 2. Planner
        planner = AdaptiveTestPlanner(max_request_budget=50)
        cand = TestCandidate(
            endpoint=ep.properties["path"],
            method="POST",
            parameter_name="username",
            param_type=ParamClassification.SEARCH_QUERY,
            vuln_class=VulnClass.SQL_INJECTION,
            exposure=TargetExposure.PUBLIC_DMZ,
        )
        planner.add_candidate(cand)
        scheduled = planner.schedule_next_batch(batch_size=1)
        self.assertEqual(len(scheduled), 1)
        self.assertIn("Bayesian Prior", scheduled[0].why_explanation)

        # 3. Causal Evidence Engine & Verification
        causal_engine = CausalEvidenceEngine()
        probe_bytes = b"POST /api/v1/auth/login HTTP/1.1\r\n\r\nusername=' OR '1'='1"
        resp_bytes = b"HTTP/1.1 200 OK\r\n\r\n{\"token\":\"admin_jwt\"}"
        
        causal_dag, report = causal_engine.assemble_evidence_chain(
            probe_bytes,
            "username",
            resp_bytes,
            "SQL Injection Authentication Bypass",
            ace=1.0,
            pn=1.0
        )
        self.assertTrue(report.is_causally_proven)

        # 4. Bind finding back to Context Graph
        finding = create_finding_node("cand-1", "SQL Injection Authentication Bypass", Severity.CRITICAL, "CWE-89", 9.8)
        evidence = create_evidence_node(finding.id, "cas://sha256/auth_token", report.merkle_proof_root, "digest")
        graph.add_node(finding)
        graph.add_node(evidence)
        graph.connect(ep.id, finding.id, EdgeType.PROMOTES_TO_FINDING)
        graph.connect(finding.id, evidence.id, EdgeType.BOUND_TO_EVIDENCE)

        # Reachability verify
        reach = graph.query_reachability(asset.id)
        self.assertIn(finding.id, reach)
        self.assertIn(evidence.id, reach)

    def test_combination_3_http_desync_plus_single_packet_plus_cas_proof(self):
        """
        Combination 3: HTTP Desync + Single Packet Frame Assembly + CAS Merkle Proof
        Generates CL.TE probe, packs into single packet batch, evaluates timeout hang,
        and secures raw transcript in CAS Merkle root.
        """
        probe = DesyncProbeGenerator.generate_cl_te_timeout_probe("victim-lb.corp.com")
        packed, fits = SinglePacketFrameAssembler.assemble_single_packet_batch([probe.raw_payload])
        self.assertTrue(fits)

        detector = HttpDesyncDetector()
        obs = ProbeResponseObservation(status_code=None, elapsed_time_ms=4500.0, socket_timeout_triggered=True)
        base_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=40.0)

        result = detector.evaluate_probe_response(probe, obs, base_obs)
        self.assertTrue(result.is_vulnerable)

        # CAS Proof
        causal_engine = CausalEvidenceEngine()
        causal_dag, report = causal_engine.assemble_evidence_chain(
            probe.raw_payload,
            "Transfer-Encoding: chunked",
            b"TIMEOUT",
            "HTTP Request Smuggling CL.TE",
            ace=1.0,
            pn=1.0
        )
        self.assertTrue(report.is_causally_proven)
        self.assertGreater(len(report.merkle_proof_root), 0)


if __name__ == "__main__":
    unittest.main()
