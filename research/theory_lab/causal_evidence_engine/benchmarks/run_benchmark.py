"""
Benchmark Runner for Causal Evidence Engine Module
Module: research.theory_lab.causal_evidence_engine.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.theory_lab.causal_evidence_engine.models import CASBlobProof
from research.theory_lab.causal_evidence_engine.engine import (
    MerkleProofGenerator,
    CausalEvidenceEngine,
)


def run_benchmark(scale_chains: int = 5000):
    print(f"=== Running Causal Evidence Engine Benchmark (Scale: {scale_chains} evidence chains) ===")
    engine = CausalEvidenceEngine()

    # 1. CAS Hash & Proof Benchmark
    sample_payload = b"POST /api/v1/auth HTTP/1.1\r\nHost: target.com\r\n\r\nusername=admin' OR '1'='1"
    t0 = time.perf_counter()
    for _ in range(scale_chains):
        _ = CASBlobProof.create_from_bytes(sample_payload)
    t_cas = time.perf_counter() - t0
    cas_rate = scale_chains / t_cas if t_cas > 0 else 0
    total_bytes_mb = (len(sample_payload) * scale_chains) / (1024 * 1024)
    mb_rate = total_bytes_mb / t_cas if t_cas > 0 else 0

    print(f"[*] Generated {scale_chains} CAS proofs in {t_cas*1000:.2f}ms ({cas_rate:.0f} proofs/sec, {mb_rate:.2f} MB/sec)")

    # 2. Merkle Root Generation Benchmark (100 leaves per tree)
    sample_leaves = [f"cas://sha256/{i:064x}" for i in range(100)]
    t0 = time.perf_counter()
    for _ in range(1000):
        _ = MerkleProofGenerator.compute_merkle_root(sample_leaves)
    t_merkle = time.perf_counter() - t0
    tree_rate = 1000 / t_merkle if t_merkle > 0 else 0
    print(f"[*] Computed 1000 100-leaf Merkle roots in {t_merkle*1000:.2f}ms ({tree_rate:.0f} trees/sec)")

    # 3. Full Causal DAG Assembly & Minimal Extraction Benchmark
    t0 = time.perf_counter()
    latencies = []
    sample_resp = b"HTTP/1.1 200 OK\r\n\r\n{\"auth\":\"token_secret\"}"

    for i in range(scale_chains):
        t_start = time.perf_counter()
        dag, report = engine.assemble_evidence_chain(
            sample_payload,
            "username_param",
            sample_resp,
            f"Vulnerability Finding {i}"
        )
        finding_id = report.minimal_subgraph_nodes[-1]
        _ = engine.extract_minimal_proof_subgraph(dag, finding_id)
        latencies.append((time.perf_counter() - t_start) * 1000)

    t_dag = time.perf_counter() - t0
    dag_rate = scale_chains / t_dag if t_dag > 0 else 0

    p50 = statistics.median(latencies)
    p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)

    print(f"[*] Assembled & Extracted {scale_chains} Causal Proof DAGs in {t_dag*1000:.2f}ms ({dag_rate:.0f} DAGs/sec)")
    print(f"[*] Latency: P50={p50:.4f}ms, P95={p95:.4f}ms")

    result = {
        "scale_chains": scale_chains,
        "cas_proof_throughput_per_sec": round(cas_rate, 2),
        "cas_throughput_mb_per_sec": round(mb_rate, 2),
        "merkle_roots_per_sec": round(tree_rate, 2),
        "dag_assembly_rate_per_sec": round(dag_rate, 2),
        "assembly_latency_ms": {
            "p50": round(p50, 5),
            "p95": round(p95, 5),
        }
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_chains=5000)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
