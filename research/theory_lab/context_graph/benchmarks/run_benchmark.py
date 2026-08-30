"""
Automated Performance & Latency Benchmark Harness for Context Graph
Module: research.theory_lab.context_graph.benchmarks.run_benchmark
"""

import time
import random
import statistics
import sqlite3
import json
from typing import Dict, Any, List

from ..models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    Severity,
)
from ..engine import ContextGraphEngine


def run_benchmark(scale_nodes: int = 5000, scale_edges: int = 15000) -> Dict[str, Any]:
    print(f"[+] Benchmarking ContextGraphEngine at scale: {scale_nodes} nodes, {scale_edges} edges...")
    engine = ContextGraphEngine()

    # 1. Node Insertion Benchmark
    t0 = time.perf_counter()
    nodes = []
    types = list(NodeType)
    for i in range(scale_nodes):
        n = GraphNode(
            id=f"node_{i}",
            node_type=types[i % len(types)],
            label=f"Asset_Entity_{i}",
            severity=Severity.HIGH if i % 10 == 0 else None,
            properties={"index": i, "cluster": i % 20}
        )
        engine.add_node(n)
        nodes.append(n)
    t_nodes = time.perf_counter() - t0
    node_insertion_rate = scale_nodes / t_nodes if t_nodes > 0 else 0.0

    # 2. Edge Insertion Benchmark
    t0 = time.perf_counter()
    edge_types = list(EdgeType)
    edge_count = 0
    for i in range(scale_edges):
        src = f"node_{i % scale_nodes}"
        dst = f"node_{(i + random.randint(1, 50)) % scale_nodes}"
        if src != dst:
            engine.connect(
                from_node=src,
                to_node=dst,
                edge_type=edge_types[i % len(edge_types)],
                weight=random.uniform(0.5, 3.0)
            )
            edge_count += 1
    t_edges = time.perf_counter() - t0
    edge_insertion_rate = edge_count / t_edges if t_edges > 0 else 0.0

    # 3. BFS Reachability Latency
    reach_latencies = []
    sample_nodes = random.sample(nodes, min(200, scale_nodes))
    for sn in sample_nodes:
        t0 = time.perf_counter()
        _ = engine.query_reachability(sn.id, max_depth=5)
        reach_latencies.append((time.perf_counter() - t0) * 1000)

    # 4. Dijkstra Shortest Attack Path Latency
    dijkstra_latencies = []
    for _ in range(100):
        src = random.choice(sample_nodes).id
        dst = random.choice(sample_nodes).id
        if src != dst:
            t0 = time.perf_counter()
            _ = engine.shortest_attack_path(src, dst)
            dijkstra_latencies.append((time.perf_counter() - t0) * 1000)

    # 5. Tarjan Strongly Connected Components Latency
    t0 = time.perf_counter()
    sccs = engine.strongly_connected_components()
    t_scc = (time.perf_counter() - t0) * 1000

    # 6. SQLite CTE Export & Query Latency
    db_conn = sqlite3.connect(":memory:")
    t0 = time.perf_counter()
    engine.export_to_sqlite(db_conn)
    t_sqlite_export = (time.perf_counter() - t0) * 1000

    cte_latencies = []
    for sn in sample_nodes[:50]:
        t0 = time.perf_counter()
        _ = engine.query_recursive_cte_attack_paths(db_conn, sn.id, max_depth=5)
        cte_latencies.append((time.perf_counter() - t0) * 1000)
    db_conn.close()

    metrics = engine.compute_metrics()

    results = {
        "scale_nodes": scale_nodes,
        "scale_edges": edge_count,
        "node_insertion_rate_per_sec": round(node_insertion_rate, 2),
        "edge_insertion_rate_per_sec": round(edge_insertion_rate, 2),
        "reachability_latency_ms": {
            "p50": round(statistics.median(reach_latencies), 4),
            "p95": round(statistics.quantiles(reach_latencies, n=20)[18], 4) if len(reach_latencies) >= 20 else 0.0,
            "p99": round(statistics.quantiles(reach_latencies, n=100)[98], 4) if len(reach_latencies) >= 100 else 0.0,
        },
        "dijkstra_latency_ms": {
            "p50": round(statistics.median(dijkstra_latencies), 4) if dijkstra_latencies else 0.0,
            "p95": round(statistics.quantiles(dijkstra_latencies, n=20)[18], 4) if len(dijkstra_latencies) >= 20 else 0.0,
        },
        "scc_latency_ms": round(t_scc, 4),
        "sqlite_export_latency_ms": round(t_sqlite_export, 4),
        "sqlite_cte_query_latency_ms": {
            "p50": round(statistics.median(cte_latencies), 4) if cte_latencies else 0.0,
            "p95": round(statistics.quantiles(cte_latencies, n=20)[18], 4) if len(cte_latencies) >= 20 else 0.0,
        },
        "density": metrics.density,
        "scc_count": metrics.strongly_connected_components_count,
        "has_cycles": metrics.has_cycles,
    }

    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    run_benchmark(scale_nodes=5000, scale_edges=15000)
