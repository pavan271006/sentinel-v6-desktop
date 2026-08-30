"""
Unit and Integration Tests for Security Context Graph Prototype
"""

import unittest
import uuid
import time
from research.prototypes.security_context_graph.models import (
    NodeType,
    EdgeType,
    ParamLocation,
    Severity,
    GraphNode,
    GraphEdge,
    create_asset_node,
    create_service_node,
    create_endpoint_node,
    create_parameter_node,
    create_identity_node,
    create_finding_node,
    create_evidence_node,
)
from research.prototypes.security_context_graph.engine import SecurityContextGraph


class TestSecurityContextGraph(unittest.TestCase):

    def setUp(self):
        self.graph = SecurityContextGraph()

    def test_node_addition_and_retrieval(self):
        asset = create_asset_node("api.corp.internal", "10.0.1.5", tags=["internal", "prod"])
        self.graph.add_node(asset)

        retrieved = self.graph.get_node(asset.id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.label, "api.corp.internal")
        self.assertEqual(retrieved.node_type, NodeType.ASSET)
        self.assertEqual(retrieved.properties["ip"], "10.0.1.5")
        self.assertEqual(self.graph.node_count, 1)

    def test_edge_addition_and_indexing(self):
        asset = create_asset_node("target.com", "192.168.1.1")
        service = create_service_node(asset.id, 443, "https", True)
        self.graph.add_node(asset)
        self.graph.add_node(service)

        edge = self.graph.connect(asset.id, service.id, EdgeType.EXPOSES, weight=1.0)
        self.assertEqual(self.graph.edge_count, 1)

        successors = self.graph.get_successors(asset.id)
        self.assertEqual(len(successors), 1)
        self.assertEqual(successors[0][0].id, service.id)

        predecessors = self.graph.get_predecessors(service.id)
        self.assertEqual(len(predecessors), 1)
        self.assertEqual(predecessors[0][0].id, asset.id)

    def test_full_security_context_hierarchy(self):
        # Asset -> Service -> Endpoint -> Parameter -> Request -> Response -> Candidate -> Finding -> Evidence
        asset = create_asset_node("auth.example.com", "10.20.30.40")
        service = create_service_node(asset.id, 443, "https")
        endpoint = create_endpoint_node(service.id, "POST", "/api/v1/login", auth_required=False)
        param_user = create_parameter_node(endpoint.id, "username", ParamLocation.BODY)
        param_pass = create_parameter_node(endpoint.id, "password", ParamLocation.BODY)
        
        req = GraphNode(node_type=NodeType.REQUEST, label="REQ-1001", properties={"method": "POST", "path": "/api/v1/login"})
        resp = GraphNode(node_type=NodeType.RESPONSE, label="RESP-1001", properties={"status": 500, "latency_ms": 1420})
        cand = GraphNode(node_type=NodeType.CANDIDATE, label="CAND-SQLI", properties={"vuln_class": "SQL_INJECTION", "confidence": 0.95})
        finding = create_finding_node(cand.id, "SQL Injection in Authentication", Severity.CRITICAL, "CWE-89", 9.8)
        evidence = create_evidence_node(finding.id, "cas://sha256/7f9a8b...", "merkle_root_abc", "digest_xyz")

        nodes = [asset, service, endpoint, param_user, param_pass, req, resp, cand, finding, evidence]
        for n in nodes:
            self.graph.add_node(n)

        self.graph.connect(asset.id, service.id, EdgeType.EXPOSES)
        self.graph.connect(service.id, endpoint.id, EdgeType.ROUTES_TO)
        self.graph.connect(endpoint.id, param_user.id, EdgeType.ACCEPTS_PARAM)
        self.graph.connect(endpoint.id, param_pass.id, EdgeType.ACCEPTS_PARAM)
        self.graph.connect(endpoint.id, req.id, EdgeType.EMITS_REQUEST)
        self.graph.connect(req.id, resp.id, EdgeType.YIELDS_RESPONSE)
        self.graph.connect(resp.id, cand.id, EdgeType.PRODUCES_CANDIDATE)
        self.graph.connect(cand.id, finding.id, EdgeType.PROMOTES_TO_FINDING)
        self.graph.connect(finding.id, evidence.id, EdgeType.BOUND_TO_EVIDENCE)

        self.assertEqual(self.graph.node_count, 10)
        self.assertEqual(self.graph.edge_count, 9)

        # Reachability query from Asset to Evidence
        reach = self.graph.query_reachability(asset.id, max_depth=10)
        self.assertIn(evidence.id, reach)
        self.assertIn(finding.id, reach)
        self.assertIn(param_user.id, reach)

        # Attack path from Asset to Finding
        paths = self.graph.find_all_attack_paths(asset.id, finding.id, max_depth=10)
        self.assertEqual(len(paths), 1)
        expected_chain = [asset.id, service.id, endpoint.id, req.id, resp.id, cand.id, finding.id]
        self.assertEqual(paths[0], expected_chain)

    def test_reachability_and_shortest_attack_path(self):
        # Create a multi-path graph with different costs
        # Node A -> Node B (cost 5) -> Target (cost 5) = 10
        # Node A -> Node C (cost 2) -> Node D (cost 2) -> Target (cost 2) = 6
        n_a = GraphNode(label="Entry")
        n_b = GraphNode(label="HardPath")
        n_c = GraphNode(label="EasyPivot1")
        n_d = GraphNode(label="EasyPivot2")
        n_tgt = GraphNode(label="CrownJewel")

        for n in [n_a, n_b, n_c, n_d, n_tgt]:
            self.graph.add_node(n)

        self.graph.connect(n_a.id, n_b.id, EdgeType.ROUTES_TO, weight=5.0)
        self.graph.connect(n_b.id, n_tgt.id, EdgeType.ROUTES_TO, weight=5.0)

        self.graph.connect(n_a.id, n_c.id, EdgeType.ROUTES_TO, weight=2.0)
        self.graph.connect(n_c.id, n_d.id, EdgeType.ROUTES_TO, weight=2.0)
        self.graph.connect(n_d.id, n_tgt.id, EdgeType.ROUTES_TO, weight=2.0)

        path, total_weight = self.graph.shortest_attack_path(n_a.id, n_tgt.id)
        self.assertEqual(total_weight, 6.0)
        self.assertEqual(path, [n_a.id, n_c.id, n_d.id, n_tgt.id])

        all_paths = self.graph.find_all_attack_paths(n_a.id, n_tgt.id)
        self.assertEqual(len(all_paths), 2)

    def test_cycle_detection_and_scc(self):
        # A -> B -> C -> A (Cycle)
        # C -> D (Acyclic branch)
        nA = GraphNode(label="A")
        nB = GraphNode(label="B")
        nC = GraphNode(label="C")
        nD = GraphNode(label="D")

        for n in [nA, nB, nC, nD]:
            self.graph.add_node(n)

        self.graph.connect(nA.id, nB.id, EdgeType.ROUTES_TO)
        self.graph.connect(nB.id, nC.id, EdgeType.ROUTES_TO)
        self.graph.connect(nC.id, nA.id, EdgeType.ROUTES_TO)
        self.graph.connect(nC.id, nD.id, EdgeType.ROUTES_TO)

        cycles = self.graph.detect_cycles()
        self.assertGreater(len(cycles), 0)

        sccs = self.graph.strongly_connected_components()
        # Should have one SCC with 3 nodes {A, B, C} and one with {D}
        large_sccs = [scc for scc in sccs if len(scc) > 1]
        self.assertEqual(len(large_sccs), 1)
        self.assertEqual(set(large_sccs[0]), {nA.id, nB.id, nC.id})

    def test_critical_bottleneck_identification(self):
        # Entry1 -> Gate -> Jewel1
        # Entry2 -> Gate -> Jewel2
        # Gate is the 100% bottleneck
        e1 = GraphNode(label="Entry1")
        e2 = GraphNode(label="Entry2")
        gate = GraphNode(label="BottleneckGate")
        j1 = GraphNode(label="Jewel1")
        j2 = GraphNode(label="Jewel2")

        for n in [e1, e2, gate, j1, j2]:
            self.graph.add_node(n)

        self.graph.connect(e1.id, gate.id, EdgeType.ROUTES_TO)
        self.graph.connect(e2.id, gate.id, EdgeType.ROUTES_TO)
        self.graph.connect(gate.id, j1.id, EdgeType.ROUTES_TO)
        self.graph.connect(gate.id, j2.id, EdgeType.ROUTES_TO)

        bottlenecks = self.graph.find_critical_bottlenecks([e1.id, e2.id], [j1.id, j2.id])
        self.assertIn(gate.id, bottlenecks)
        self.assertEqual(bottlenecks[gate.id], 1.0)

    def test_graph_metrics_and_centrality(self):
        n1 = GraphNode(label="Hub")
        n2 = GraphNode(label="Leaf1")
        n3 = GraphNode(label="Leaf2")
        n4 = GraphNode(label="Leaf3")

        for n in [n1, n2, n3, n4]:
            self.graph.add_node(n)

        self.graph.connect(n1.id, n2.id, EdgeType.ROUTES_TO)
        self.graph.connect(n1.id, n3.id, EdgeType.ROUTES_TO)
        self.graph.connect(n1.id, n4.id, EdgeType.ROUTES_TO)

        metrics = self.graph.compute_metrics()
        self.assertEqual(metrics["node_count"], 4)
        self.assertEqual(metrics["edge_count"], 3)
        self.assertFalse(metrics["has_cycles"])

        deg_cent = self.graph.compute_degree_centrality()
        # Hub has out-degree 3, in-degree 0 -> total 3 / 3 = 1.0
        self.assertEqual(deg_cent[n1.id], 1.0)

        bet_cent = self.graph.compute_betweenness_centrality()
        self.assertIsInstance(bet_cent, dict)

    def test_node_and_edge_removal(self):
        n1 = GraphNode(label="N1")
        n2 = GraphNode(label="N2")
        self.graph.add_node(n1)
        self.graph.add_node(n2)
        edge = self.graph.connect(n1.id, n2.id, EdgeType.ROUTES_TO)

        self.assertEqual(self.graph.node_count, 2)
        self.assertEqual(self.graph.edge_count, 1)

        self.graph.remove_node(n1.id)
        self.assertEqual(self.graph.node_count, 1)
        self.assertEqual(self.graph.edge_count, 0)
        self.assertEqual(len(self.graph.get_predecessors(n2.id)), 0)


if __name__ == "__main__":
    unittest.main()
