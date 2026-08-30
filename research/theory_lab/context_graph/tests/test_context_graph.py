"""
Comprehensive Unit & Integration Test Suite for Context Graph Engine
Module: research.theory_lab.context_graph.tests.test_context_graph
"""

import unittest
import sqlite3
import time

from ..models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    Severity,
)
from ..engine import ContextGraphEngine
from ..fixtures.fixture_environments import (
    build_vulnerable_ecommerce_graph,
    build_fixed_remediated_graph,
    build_benign_complex_graph,
    build_noisy_graph_with_cycles,
)


class TestContextGraphEngine(unittest.TestCase):
    """Unit and integration test cases for ContextGraphEngine."""

    def setUp(self):
        self.engine = ContextGraphEngine()

    def test_node_and_edge_mutation_and_indexing(self):
        n1 = GraphNode(id="n1", node_type=NodeType.ASSET, label="api.example.com")
        n2 = GraphNode(id="n2", node_type=NodeType.ENDPOINT, label="/v1/users")
        self.engine.add_node(n1)
        self.engine.add_node(n2)

        edge = self.engine.connect("n1", "n2", EdgeType.CONTAINS, weight=1.5)

        self.assertIn("n1", self.engine.nodes)
        self.assertIn("n2", self.engine.nodes)
        self.assertIn(edge.id, self.engine.edges)

        # Type indexing
        assets = self.engine.get_nodes_by_type(NodeType.ASSET)
        self.assertEqual(len(assets), 1)
        self.assertEqual(assets[0].id, "n1")

        endpoints = self.engine.get_nodes_by_type(NodeType.ENDPOINT)
        self.assertEqual(len(endpoints), 1)
        self.assertEqual(endpoints[0].id, "n2")

        # Neighbor queries
        out_neighbors = self.engine.get_neighbors_out("n1")
        self.assertEqual(len(out_neighbors), 1)
        self.assertEqual(out_neighbors[0].id, "n2")

        in_neighbors = self.engine.get_neighbors_in("n2")
        self.assertEqual(len(in_neighbors), 1)
        self.assertEqual(in_neighbors[0].id, "n1")

    def test_scope_enforcement_sec_01(self):
        """Verify SEC-01 fail-closed scope enforcement."""
        in_scope_node = GraphNode(id="in_scope", node_type=NodeType.ASSET, label="in.scope.com", scope_in_bounds=True)
        out_scope_node = GraphNode(id="out_scope", node_type=NodeType.ASSET, label="thirdparty.cdn.com", scope_in_bounds=False)

        self.engine.add_node(in_scope_node)
        self.engine.add_node(out_scope_node)

        self.assertIn("in_scope", self.engine.nodes)
        self.assertNotIn("out_scope", self.engine.nodes)

    def test_node_and_edge_removal(self):
        n1 = GraphNode(id="n1", node_type=NodeType.SERVICE, label="svc1")
        n2 = GraphNode(id="n2", node_type=NodeType.ENDPOINT, label="ep1")
        self.engine.add_node(n1)
        self.engine.add_node(n2)
        e = self.engine.connect("n1", "n2", EdgeType.CONTAINS)

        self.assertTrue(self.engine.remove_edge(e.id))
        self.assertEqual(len(self.engine.edges), 0)
        self.assertEqual(len(self.engine.get_neighbors_out("n1")), 0)

        self.engine.connect("n1", "n2", EdgeType.CONTAINS)
        self.assertTrue(self.engine.remove_node("n1"))
        self.assertNotIn("n1", self.engine.nodes)
        self.assertEqual(len(self.engine.edges), 0)

    def test_reachability_and_shortest_attack_path(self):
        vulnerable_graph = build_vulnerable_ecommerce_graph()
        
        # Test reachability from asset_root
        reachable = vulnerable_graph.query_reachability("asset_root", max_depth=10)
        reachable_ids = {nid for nid, _ in reachable}
        self.assertIn("find_sqli", reachable_ids)
        self.assertIn("find_priv_esc", reachable_ids)
        self.assertIn("find_exfil", reachable_ids)

        # Test shortest path from asset_root to find_exfil
        path_res = vulnerable_graph.shortest_attack_path("asset_root", "find_exfil")
        self.assertIsNotNone(path_res)
        self.assertEqual(path_res.source_node_id, "asset_root")
        self.assertEqual(path_res.target_node_id, "find_exfil")
        self.assertEqual(path_res.hop_count, 7)
        self.assertIn("find_sqli", path_res.critical_findings)
        self.assertIn("find_priv_esc", path_res.critical_findings)
        self.assertIn("find_exfil", path_res.critical_findings)

    def test_fixed_remediated_attack_path_breakage(self):
        fixed_graph = build_fixed_remediated_graph()
        
        # In the fixed graph, find_exfil or find_sqli are not reachable
        path_res = fixed_graph.shortest_attack_path("asset_root", "srv_db")
        self.assertIsNone(path_res)

    def test_bottleneck_articulation_analysis(self):
        graph = build_vulnerable_ecommerce_graph()
        bottlenecks = graph.analyze_bottlenecks(
            entry_nodes=["asset_root"],
            crown_jewel_targets=["find_exfil"]
        )
        self.assertGreater(len(bottlenecks), 0)
        # All paths must pass through param_order_id, find_sqli, find_priv_esc
        top_bottleneck_ids = {b.bottleneck_node_id for b in bottlenecks if b.criticality_ratio == 1.0}
        self.assertIn("param_order_id", top_bottleneck_ids)
        self.assertIn("find_sqli", top_bottleneck_ids)

    def test_tarjan_scc_and_cycle_detection(self):
        acyclic_graph = build_vulnerable_ecommerce_graph()
        self.assertFalse(acyclic_graph.detect_cycles())

        cyclic_graph = build_noisy_graph_with_cycles()
        self.assertTrue(cyclic_graph.detect_cycles())
        sccs = cyclic_graph.strongly_connected_components()
        # The 10-node cycle forms an SCC of size 10
        max_scc = max(len(scc) for scc in sccs)
        self.assertEqual(max_scc, 10)

    def test_graph_metrics(self):
        benign_graph = build_benign_complex_graph(endpoint_count=20)
        metrics = benign_graph.compute_metrics()
        self.assertGreater(metrics.node_count, 20)
        self.assertGreater(metrics.edge_count, 20)
        self.assertFalse(metrics.has_cycles)
        self.assertIn("ENDPOINT", metrics.nodes_by_type)

    def test_sqlite_cte_export_and_recursive_query(self):
        graph = build_vulnerable_ecommerce_graph()
        conn = sqlite3.connect(":memory:")
        graph.export_to_sqlite(conn)

        # Query recursive CTE
        paths = graph.query_recursive_cte_attack_paths(conn, "asset_root", max_depth=8)
        self.assertGreater(len(paths), 0)
        
        # Verify that the exfiltration node is discovered via SQL CTE
        exfil_paths = [p for p in paths if p["id"] == "find_exfil"]
        self.assertEqual(len(exfil_paths), 1)
        self.assertEqual(exfil_paths[0]["depth"], 7)
        conn.close()

    def test_adversarial_malformed_and_extreme_inputs(self):
        """Adversarial stress test with null bytes, SQL payloads, and disconnected graphs."""
        # 1. Null byte and Unicode fuzzing
        fuzz_node = GraphNode(
            id="fuzz_1",
            node_type=NodeType.PARAMETER,
            label="\x00\xff' OR '1'='1' -- \r\n\x08",
            properties={"nested": {"injection": "<script>alert(1)</script>"}}
        )
        self.engine.add_node(fuzz_node)
        self.assertIn("fuzz_1", self.engine.nodes)
        
        # SQLite export with hostile unicode and quotes
        conn = sqlite3.connect(":memory:")
        self.engine.export_to_sqlite(conn)
        cursor = conn.cursor()
        cursor.execute("SELECT label FROM graph_nodes WHERE id = 'fuzz_1'")
        res = cursor.fetchone()
        self.assertEqual(res[0], "\x00\xff' OR '1'='1' -- \r\n\x08")
        conn.close()

        # 2. Disconnected node queries
        n_iso1 = GraphNode(id="iso1", node_type=NodeType.ASSET, label="island_1")
        n_iso2 = GraphNode(id="iso2", node_type=NodeType.ASSET, label="island_2")
        self.engine.add_node(n_iso1)
        self.engine.add_node(n_iso2)
        
        self.assertIsNone(self.engine.shortest_attack_path("iso1", "iso2"))
        self.assertEqual(self.engine.query_reachability("iso1"), [])


if __name__ == "__main__":
    unittest.main()
