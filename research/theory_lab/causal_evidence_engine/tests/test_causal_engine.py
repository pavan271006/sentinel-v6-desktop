"""
Unit and Integration Tests for Causal Evidence Engine Module
"""

import unittest
from research.theory_lab.causal_evidence_engine.models import (
    CausalNodeType,
    CausalRelationType,
    CASBlobProof,
    CausalNode,
    CausalEdge,
    CausalDAG,
    CausalAttributionReport,
)
from research.theory_lab.causal_evidence_engine.engine import (
    PearlCausalAttributionEvaluator,
    MerkleProofGenerator,
    CausalEvidenceEngine,
)
from research.theory_lab.causal_evidence_engine.fixtures.fixture_environments import (
    get_vulnerable_sqli_evidence_data,
    get_fixed_sqli_evidence_data,
)


class TestCausalEvidenceEngine(unittest.TestCase):

    def setUp(self):
        self.engine = CausalEvidenceEngine()

    def test_cas_blob_proof_creation(self):
        data = b"GET /api/secret HTTP/1.1\r\nHost: target.com\r\n\r\n"
        proof = CASBlobProof.create_from_bytes(data)

        self.assertTrue(proof.cas_key.startswith("cas://sha256/"))
        self.assertEqual(len(proof.raw_payload_bytes), len(data))
        self.assertGreater(len(proof.merkle_root), 0)

    def test_merkle_root_generation(self):
        leaf1 = "cas://sha256/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        leaf2 = "cas://sha256/ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
        root = MerkleProofGenerator.compute_merkle_root([leaf1, leaf2])

        self.assertIsInstance(root, str)
        self.assertEqual(len(root), 64)

        # Deterministic: same leaves produce identical root
        root2 = MerkleProofGenerator.compute_merkle_root([leaf1, leaf2])
        self.assertEqual(root, root2)

    def test_pearl_causal_effect_evaluation(self):
        # 100% success on probe, 0% on control, confounders strictly controlled
        ace, pn, risk, is_proven = PearlCausalAttributionEvaluator.evaluate_causal_effect(
            probe_success_rate=1.0,
            control_success_rate=0.0,
            confounders_controlled=True
        )
        self.assertEqual(ace, 1.0)
        self.assertEqual(pn, 1.0)
        self.assertTrue(is_proven)
        self.assertEqual(risk, 0.05)

        # Negative control: equal success rate (ambient server failure)
        ace2, pn2, _, is_proven2 = PearlCausalAttributionEvaluator.evaluate_causal_effect(
            probe_success_rate=0.5,
            control_success_rate=0.5,
            confounders_controlled=True
        )
        self.assertEqual(ace2, 0.0)
        self.assertEqual(pn2, 0.0)
        self.assertFalse(is_proven2)

    def test_causal_dag_assembly(self):
        probe, p_var, resp, title = get_vulnerable_sqli_evidence_data()
        dag, report = self.engine.assemble_evidence_chain(probe, p_var, resp, title, ace=1.0, pn=1.0)

        self.assertEqual(len(dag.nodes), 4)
        self.assertEqual(len(dag.edges), 3)
        self.assertTrue(report.is_causally_proven)
        self.assertEqual(report.verdict, "CONFIRMED_VULNERABILITY")
        self.assertEqual(len(report.merkle_proof_root), 64)

    def test_minimal_proof_subgraph_extraction(self):
        probe, p_var, resp, title = get_vulnerable_sqli_evidence_data()
        dag, report = self.engine.assemble_evidence_chain(probe, p_var, resp, title)

        # Add 5 extraneous background noise nodes to the DAG
        for i in range(5):
            noise_node = CausalNode(label=f"NoiseNode_{i}")
            dag.add_node(noise_node)

        self.assertEqual(len(dag.nodes), 9)

        # Finding node ID is the terminal node
        finding_id = [nid for nid, n in dag.nodes.items() if n.node_type == CausalNodeType.FINDING_PROOF][0]
        min_dag = self.engine.extract_minimal_proof_subgraph(dag, finding_id)

        # Extraneous noise nodes should be pruned, retaining only the 4 causal nodes
        self.assertEqual(len(min_dag.nodes), 4)
        self.assertEqual(len(min_dag.edges), 3)


if __name__ == "__main__":
    unittest.main()
