"""
Master Benchmark Runner for All SENTINEL V6 Theory Lab & Prototype Engines
Module: research.benchmarks.run_master_benchmark
"""

import time
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from research.prototypes.security_context_graph.benchmarks.run_benchmark import run_benchmark as run_graph_bm
from research.prototypes.adaptive_test_planner.benchmarks.run_benchmark import run_benchmark as run_planner_bm
from research.prototypes.differential_security_engine.benchmarks.run_benchmark import run_benchmark as run_diff_bm
from research.prototypes.http_desync_detector.benchmarks.run_benchmark import run_benchmark as run_desync_bm
from research.theory_lab.state_machine_inference.benchmarks.run_benchmark import run_benchmark as run_state_bm
from research.theory_lab.causal_evidence_engine.benchmarks.run_benchmark import run_benchmark as run_causal_bm


def run_all_benchmarks():
    print("================================================================================")
    print("      SENTINEL V6 MASTER PROTOTYPE & THEORY LAB BENCHMARK SUITE                ")
    print("================================================================================\n")

    t_global_start = time.perf_counter()

    results = {}

    print(">>> 1/6 Benchmarking Security Context Graph...")
    results["security_context_graph"] = run_graph_bm(scale_nodes=5000, edge_multiplier=3)
    print("\n--------------------------------------------------------------------------------\n")

    print(">>> 2/6 Benchmarking Adaptive Test Planner...")
    results["adaptive_test_planner"] = run_planner_bm(scale_candidates=5000)
    print("\n--------------------------------------------------------------------------------\n")

    print(">>> 3/6 Benchmarking Differential Security Engine...")
    results["differential_security_engine"] = run_diff_bm(scale_pairs=5000)
    print("\n--------------------------------------------------------------------------------\n")

    print(">>> 4/6 Benchmarking HTTP Desync Detector...")
    results["http_desync_detector"] = run_desync_bm(scale_iterations=10000)
    print("\n--------------------------------------------------------------------------------\n")

    print(">>> 5/6 Benchmarking State Machine Inference...")
    results["state_machine_inference"] = run_state_bm(scale_traces=2000)
    print("\n--------------------------------------------------------------------------------\n")

    print(">>> 6/6 Benchmarking Causal Evidence Engine...")
    results["causal_evidence_engine"] = run_causal_bm(scale_chains=5000)
    print("\n--------------------------------------------------------------------------------\n")

    t_global_total = time.perf_counter() - t_global_start

    print("================================================================================")
    print(f"      ALL 6 BENCHMARKS COMPLETED IN {t_global_total:.2f}s                       ")
    print("================================================================================\n")

    summary_file = os.path.join(os.path.dirname(__file__), "MASTER_BENCHMARK_RESULTS.json")
    with open(summary_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"[*] Aggregated results saved to: {summary_file}\n")

    return results


if __name__ == "__main__":
    run_all_benchmarks()
