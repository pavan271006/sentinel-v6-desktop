"""
Benchmark Runner for Security Context Graph Prototype
Module: research.prototypes.security_context_graph.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.prototypes.security_context_graph.models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    create_asset_node,
    create_service_node,
    create_endpoint_node,
    create_finding_node,
)
from research.prototypes.security_context_graph.engine import SecurityContextGraph


def run_benchmark(scale_nodes: int = 10000, edge_multiplier: int = 3):
    print(f"=== Running Security Context Graph Benchmark (Scale: {scale_nodes} nodes, ~{scale_nodes * edge_multiplier} edges) ===")
    graph = SecurityContextGraph()

    # 1. Insertion Benchmark
    t0 = time.perf_counter()
    node_ids = []
    
    # Generate structured nodes
    for i in range(scale_nodes):
        mod = i % 4
        if mod == 0:
            node = create_asset_node(f"host-{i}.target.corp", f"10.0.{i//256}.{i%256}")
        elif mod == 1:
            node = create_service_node(node_ids[-1] if node_ids else "root", 8080, "http")
        elif mod == 2:
            node = create_endpoint_node(node_ids[-1] if node_ids else "root", "GET", f"/api/v1/resource/{i}")
        else:
            node = create_finding_node("cand-1", f"Vulnerability {i}", "HIGH", "CWE-89", 8.5)
        
        graph.add_node(node)
        node_ids.append(node.id)

    t_nodes = time.perf_counter() - t0
    node_rate = scale_nodes / t_nodes if t_nodes > 0 else 0

    # Insert edges
    t0 = time.perf_counter()
    edge_count = 0
    # Sequential backbone + random branch edges
    for i in range(len(node_ids) - 1):
        graph.connect(node_ids[i], node_ids[i+1], EdgeType.ROUTES_TO, weight=1.0)
        edge_count += 1

    for _ in range(scale_nodes * (edge_multiplier - 1)):
        src = random.choice(node_ids)
        dst = random.choice(node_ids)
        if src != dst:
            graph.connect(src, dst, EdgeType.ROUTES_TO, weight=random.uniform(0.5, 5.0))
            edge_count += 1

    t_edges = time.perf_counter() - t0
    edge_rate = edge_count / t_edges if t_edges > 0 else 0

    print(f"[*] Inserted {scale_nodes} nodes in {t_nodes*1000:.2f}ms ({node_rate:.0f} nodes/sec)")
    print(f"[*] Inserted {edge_count} edges in {t_edges*1000:.2f}ms ({edge_rate:.0f} edges/sec)")

    # 2. Reachability Query Latency (100 sample queries)
    reach_latencies = []
    sample_sources = random.sample(node_ids, min(100, len(node_ids)))
    for src in sample_sources:
        t_start = time.perf_counter()
        reached = graph.query_reachability(src, max_depth=6)
        reach_latencies.append((time.perf_counter() - t_start) * 1000)

    p50_reach = statistics.median(reach_latencies)
    p95_reach = statistics.quantiles(reach_latencies, n=20)[18] if len(reach_latencies) >= 20 else max(reach_latencies)
    p99_reach = statistics.quantiles(reach_latencies, n=100)[98] if len(reach_latencies) >= 100 else max(reach_latencies)

    print(f"[*] Reachability Query (Depth=6, N={len(sample_sources)}): P50={p50_reach:.3f}ms, P95={p95_reach:.3f}ms, P99={p99_reach:.3f}ms")

    # 3. Shortest Attack Path Latency (Dijkstra)
    dijkstra_latencies = []
    for _ in range(min(50, len(node_ids))):
        src = random.choice(node_ids)
        dst = random.choice(node_ids)
        t_start = time.perf_counter()
        res = graph.shortest_attack_path(src, dst)
        dijkstra_latencies.append((time.perf_counter() - t_start) * 1000)

    p50_dijkstra = statistics.median(dijkstra_latencies)
    p95_dijkstra = statistics.quantiles(dijkstra_latencies, n=20)[18] if len(dijkstra_latencies) >= 20 else max(dijkstra_latencies)

    print(f"[*] Dijkstra Shortest Path (N=50): P50={p50_dijkstra:.3f}ms, P95={p95_dijkstra:.3f}ms")

    # 4. Cycle & SCC Detection Latency
    t_start = time.perf_counter()
    sccs = graph.strongly_connected_components()
    t_scc = (time.perf_counter() - t_start) * 1000
    print(f"[*] Tarjan's SCC Calculation: {t_scc:.2f}ms (Found {len(sccs)} SCCs)")

    # 5. Graph Metrics
    metrics = graph.compute_metrics()
    print(f"[*] Graph Metrics: Density={metrics['density']}, SCC Count={metrics['scc_count']}, Has Cycles={metrics['has_cycles']}")

    result = {
        "scale_nodes": scale_nodes,
        "scale_edges": edge_count,
        "node_insertion_rate": round(node_rate, 2),
        "edge_insertion_rate": round(edge_rate, 2),
        "reachability_latency_ms": {
            "p50": round(p50_reach, 4),
            "p95": round(p95_reach, 4),
            "p99": round(p99_reach, 4),
        },
        "dijkstra_latency_ms": {
            "p50": round(p50_dijkstra, 4),
            "p95": round(p95_dijkstra, 4),
        },
        "scc_latency_ms": round(t_scc, 3),
        "density": metrics["density"],
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_nodes=5000, edge_multiplier=3)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
