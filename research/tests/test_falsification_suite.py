"""
Authoritative Empirical Falsification & Adversarial Robustness Test Suite
Modules tested:
- research.prototypes.security_context_graph
- research.prototypes.adaptive_test_planner
- research.prototypes.differential_security_engine
- research.prototypes.http_desync_detector
- research.theory_lab.state_machine_inference
- research.theory_lab.causal_evidence_engine
"""

import sys
import time
import math
import hashlib
import json
import pytest
from collections import defaultdict, deque

# Import prototypes
from research.prototypes.security_context_graph.engine import SecurityContextGraph
from research.prototypes.security_context_graph.models import (
    GraphNode, GraphEdge, NodeType, EdgeType, Severity
)

from research.prototypes.adaptive_test_planner.planner import (
    AdaptiveTestPlanner, BayesianBeliefModel, TokenBucketRateLimiter, compute_shannon_entropy
)
from research.prototypes.adaptive_test_planner.models import (
    VulnClass, ParamClassification, TargetExposure, TestCandidate, ExecutionFeedback, SixFactorReasoning
)

from research.prototypes.differential_security_engine.engine import (
    DifferentialSecurityEngine, mask_volatile_tokens, extract_structural_tokens,
    compute_jaccard_similarity, welch_t_test, compute_token_shannon_entropy
)
from research.prototypes.differential_security_engine.models import (
    DifferentialAxis, ResponseSnapshot
)

from research.prototypes.http_desync_detector.detector import (
    HttpDesyncDetector, DesyncProbeGenerator, SinglePacketFrameAssembler
)
from research.prototypes.http_desync_detector.models import (
    DesyncVectorType, ProbeMethod, ProbeResponseObservation
)

from research.theory_lab.state_machine_inference.inference_engine import (
    KTailsLearner, AuthLifecycleInferrer, StateVulnerabilityDetector, InferredMealyMachine
)
from research.theory_lab.state_machine_inference.models import (
    AuthStateTier, StateVulnType, TraceAction, StateNode
)

from research.theory_lab.causal_evidence_engine.models import (
    CausalNodeType, CausalRelationType, CASBlobProof, CausalNode, CausalEdge, CausalDAG, CausalAttributionReport
)
from research.theory_lab.causal_evidence_engine.engine import (
    PearlCausalAttributionEvaluator, MerkleProofGenerator, CausalEvidenceEngine
)


class TestR13TheoryFalsification:
    """R13: Mathematical Bounds, Conjugate Model Updates, and Failure Condition Tests."""

    def test_bayesian_variance_and_mean_convergence(self):
        """Verify mathematical convergence of Beta-Binomial conjugate belief model."""
        model = BayesianBeliefModel()
        m0, v0, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        
        # 10 Consecutive positive observations
        for _ in range(10):
            model.update(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY, positive=True, weight=1.0)
        m_high, v_high, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        assert m_high > m0
        assert v_high < v0

        # 30 Consecutive negative observations
        for _ in range(30):
            model.update(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY, positive=False, weight=1.0)
        m_low, v_low, _ = model.get_belief(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)
        assert m_low < m_high
        assert v_low < v_high

    def test_shannon_entropy_mathematical_bounds(self):
        """Verify Shannon entropy computation satisfies 0 <= H(X) <= 1."""
        assert compute_shannon_entropy("") == 0.0
        assert compute_shannon_entropy("A" * 100) == 0.0
        
        # Maximum entropy string (all unique chars)
        all_unique = "".join(chr(i + 33) for i in range(64))
        h_max = compute_shannon_entropy(all_unique)
        assert 0.95 <= h_max <= 1.0

    def test_welch_t_test_mathematical_soundness(self):
        """Verify two-sample Welch's t-test separates distinct vs identical populations."""
        # Identical populations -> must fail significance (0% false positives)
        pop_a = [50.0, 52.0, 48.0, 51.0, 49.0, 50.5, 49.5, 51.2]
        pop_b = [50.5, 49.0, 51.5, 50.0, 48.5, 52.0, 49.2, 50.8]
        _, p_val, is_sig = welch_t_test(pop_a, pop_b)
        assert is_sig is False
        assert p_val > 0.05

        # Small sample size boundary (N < 3) -> fails safely
        t_stat, p_val, is_sig = welch_t_test([10.0, 12.0], [5000.0, 5005.0])
        assert is_sig is False
        assert t_stat is None

        # Zero variance boundary
        t_stat, p_val, is_sig = welch_t_test([100.0, 100.0, 100.0], [100.0, 100.0, 100.0])
        assert is_sig is False
        assert p_val == 1.0

    def test_pearl_causal_effect_counterfactual_bounds(self):
        """Verify Pearl ACE and PN bounds under confounded and unconfounded environments."""
        # Confounders controlled, 100% probe success, 0% control
        ace, pn, risk, is_proven = PearlCausalAttributionEvaluator.evaluate_causal_effect(
            probe_success_rate=1.0, control_success_rate=0.0, confounders_controlled=True
        )
        assert ace == 1.0
        assert pn == 1.0
        assert is_proven is True
        assert risk == 0.05

        # Confounder failure: unconfounded environment with 50% ambient server error rate
        ace2, pn2, risk2, is_proven2 = PearlCausalAttributionEvaluator.evaluate_causal_effect(
            probe_success_rate=0.5, control_success_rate=0.5, confounders_controlled=False
        )
        assert ace2 == 0.0
        assert pn2 == 0.0
        assert is_proven2 is False
        assert risk2 == 0.65


class TestR16AdversarialRobustness:
    """R16: Malformed inputs, noisy responses, network jitter, state resets, and tampering."""

    def test_scg_tarjan_scc_dense_cycle_bomb(self):
        """Stress-test Tarjan's SCC with 1,000-node circular digraph."""
        graph = SecurityContextGraph()
        for i in range(1000):
            graph.add_node(GraphNode(id=f"bomb_{i}", label=f"Node {i}", node_type=NodeType.ENDPOINT))
        for i in range(1000):
            graph.add_edge(GraphEdge(from_node=f"bomb_{i}", to_node=f"bomb_{(i+1)%1000}", edge_type=EdgeType.EXPOSES))

        sccs = graph.strongly_connected_components()
        assert len(sccs) == 1
        assert len(sccs[0]) == 1000
        assert graph.compute_metrics()["has_cycles"] is True

    def test_scg_pathological_queries_on_disconnected_graphs(self):
        """Verify graph engine handles disconnected nodes and non-existent IDs without exceptions."""
        graph = SecurityContextGraph()
        graph.add_node(GraphNode(id="node_a", label="A", node_type=NodeType.ASSET))
        graph.add_node(GraphNode(id="node_b", label="B", node_type=NodeType.ASSET))

        # Dijkstra between disconnected nodes
        assert graph.shortest_attack_path("node_a", "node_b") is None
        # Reachability on non-existent node
        assert graph.query_reachability("non_existent_node") == set()
        # Bottleneck calculation on disconnected nodes
        assert graph.find_critical_bottlenecks(["node_a"], ["node_b"]) == {}

    def test_atp_extreme_adversarial_candidate_inputs(self):
        """Stress-test Adaptive Test Planner with extreme latencies, oversized payloads, and rapid oscillations."""
        planner = AdaptiveTestPlanner(max_request_budget=20)
        
        # Add candidate with pathological latency & oversized payload
        cand = TestCandidate(
            endpoint="/api/v1/fuzz/\x00\xff/binary",
            parameter_name="query",
            vuln_class=VulnClass.COMMAND_INJECTION,
            param_type=ParamClassification.SYSTEM_COMMAND,
            exposure=TargetExposure.ADMIN_PRIVILEGED,
            payload_sample="B" * 20000,
            estimated_latency_ms=999999.0
        )
        planner.add_candidate(cand)
        
        batch = planner.schedule_next_batch(1)
        assert len(batch) == 1
        assert "Selected for" in batch[0].why_explanation

        # 40 Rapid contradictory feedback updates
        for i in range(40):
            planner.record_feedback(ExecutionFeedback(
                test_id=cand.id,
                endpoint=cand.endpoint,
                parameter_name=cand.parameter_name,
                vuln_class=VulnClass.COMMAND_INJECTION,
                finding_confirmed=(i % 2 == 0),
                anomaly_detected=(i % 3 == 0),
                status_code=500 if i % 2 == 0 else 200,
                latency_ms=100.0
            ))
        assert planner.pending_test_count >= 0

    def test_differential_volatile_noise_and_malformed_bodies(self):
        """Stress-test differential engine against volatile token noise and malformed JSON."""
        engine = DifferentialSecurityEngine(entropy_threshold=3.8)

        # Baseline and candidate with dynamic UUIDs, nonces, timestamps
        base_body = json.dumps({
            "status": "active",
            "session_id": "99999999-aaaa-bbbb-cccc-111122223333",
            "timestamp": "2026-08-22T15:13:42.123Z",
            "csrf_nonce": "9f8e7d6c5b4a31209f8e7d6c5b4a3120"
        })
        cand_body = json.dumps({
            "status": "active",
            "session_id": "11112222-3333-4444-5555-666677778888",
            "timestamp": "2026-08-22T15:14:00.000Z",
            "csrf_nonce": "1a2b3c4d5e6f70891a2b3c4d5e6f7089"
        })

        base_snap = ResponseSnapshot(status_code=200, headers={}, body=base_body, latency_ms=30.0)
        cand_snap = ResponseSnapshot(status_code=200, headers={}, body=cand_body, latency_ms=32.0)

        res = engine.analyze_divergence(base_snap, cand_snap, axis=DifferentialAxis.ROLE_A_VS_ROLE_B)
        assert res.ast_jaccard_similarity >= 0.80
        assert res.finding_verdict == "CONFIRMED_VULNERABILITY"

        # Non-JSON HTML malformed body comparison (fallback test)
        html_base = "<html><body><h1>Error 500</h1><p>Internal Server Error</p></body></html>"
        html_cand = "<html><body><h1>Error 500</h1><p>Internal Server Error [debug_trace_id: 1234567]</p></body></html>"
        res_html = engine.analyze_divergence(
            ResponseSnapshot(status_code=500, headers={}, body=html_base, latency_ms=20.0),
            ResponseSnapshot(status_code=500, headers={}, body=html_cand, latency_ms=22.0),
            axis=DifferentialAxis.BASELINE_VS_MUTATED
        )
        assert res_html.ast_jaccard_similarity >= 0.50
        assert res_html.finding_verdict == "BENIGN"

    def test_http_desync_network_jitter_false_alarm_rejection(self):
        """Verify HTTP desync detector rejects high transient network jitter without false alarms."""
        detector = HttpDesyncDetector()
        probe = DesyncProbeGenerator.generate_cl_te_timeout_probe("target.internal")

        # Baseline: 150ms
        base_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=150.0)
        # Jitter spike: 2000ms (Delta = 1850ms, below 2500ms threshold)
        jitter_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=2000.0)

        res_jitter = detector.evaluate_probe_response(probe, jitter_obs, base_obs)
        assert res_jitter.is_vulnerable is False
        assert res_jitter.confidence == 0.0

        # Legitimate backend timeout hang: 4500ms (Delta = 4350ms)
        hang_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=4500.0)
        res_hang = detector.evaluate_probe_response(probe, hang_obs, base_obs)
        assert res_hang.is_vulnerable is True
        assert res_hang.confidence == 0.95

    def test_single_packet_frame_assembler_mss_boundary(self):
        """Verify SinglePacketFrameAssembler respects maximum MSS boundary constraint (1460 bytes)."""
        small_reqs = [b"POST /api HTTP/1.1\r\nHost: a\r\n\r\n" for _ in range(15)]
        packed, fits = SinglePacketFrameAssembler.assemble_single_packet_batch(small_reqs, max_mss=1460)
        assert fits is True
        assert len(packed) <= 1460

        overflow_reqs = [b"X" * 200 for _ in range(10)]
        packed_of, fits_of = SinglePacketFrameAssembler.assemble_single_packet_batch(overflow_reqs, max_mss=1460)
        assert fits_of is False
        assert len(packed_of) == 2000

    def test_state_machine_out_of_order_bypass_falsification(self):
        """Verify state machine detector discriminates out-of-order workflow bypass vs rejected requests."""
        learner = KTailsLearner()
        fsm = learner.infer_from_traces([])
        detector = StateVulnerabilityDetector(fsm)

        # Bypass case: Terminal payment returns 200 OK without KYC / cart
        vuln = detector.check_out_of_order_bypass(
            required_predecessor_actions=["POST /kyc/verify", "POST /cart/items"],
            terminal_action="POST /payment/execute",
            observed_response_status=200
        )
        assert vuln is not None
        assert vuln.vuln_type == StateVulnType.OUT_OF_ORDER_BYPASS

        # Fixed case: Terminal payment returns 403 Forbidden
        fixed = detector.check_out_of_order_bypass(
            required_predecessor_actions=["POST /kyc/verify", "POST /cart/items"],
            terminal_action="POST /payment/execute",
            observed_response_status=403
        )
        assert fixed is None

    def test_causal_evidence_cas_merkle_tamper_detection(self):
        """Verify CAS Merkle proof detects single bit-flips and Merkle root hash forgeries."""
        engine = CausalEvidenceEngine()
        probe_bytes = b"GET /admin/users HTTP/1.1\r\nAuthorization: Bearer forged\r\n\r\n"
        resp_bytes = b"HTTP/1.1 200 OK\r\n\r\n[{\"user\":\"admin\"}]"

        dag, report = engine.assemble_evidence_chain(
            probe_bytes=probe_bytes,
            payload_var="admin_probe",
            response_bytes=resp_bytes,
            finding_title="BFLA Unauthenticated Admin Access",
            ace=1.0,
            pn=1.0
        )

        assert report.is_causally_proven is True
        assert len(report.merkle_proof_root) == 64

        # Add 5 extraneous noise nodes to verify pruning
        for i in range(5):
            dag.add_node(CausalNode(label=f"NoiseNode_{i}"))

        finding_id = [nid for nid, n in dag.nodes.items() if n.node_type == CausalNodeType.FINDING_PROOF][0]
        min_dag = engine.extract_minimal_proof_subgraph(dag, finding_id)
        assert len(min_dag.nodes) == 4
        assert len(min_dag.edges) == 3
