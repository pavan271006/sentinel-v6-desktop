"""
Benchmark Runner for Differential Security Engine Prototype
Module: research.prototypes.differential_security_engine.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.prototypes.differential_security_engine.models import (
    DifferentialAxis,
    ResponseSnapshot,
)
from research.prototypes.differential_security_engine.engine import (
    DifferentialSecurityEngine,
    mask_volatile_tokens,
    welch_t_test,
)


def run_benchmark(scale_pairs: int = 5000):
    print(f"=== Running Differential Security Engine Benchmark (Scale: {scale_pairs} differential pairs) ===")
    engine = DifferentialSecurityEngine()

    # 1. Generate sample JSON responses with volatile tokens
    pairs = []
    for i in range(scale_pairs):
        base_body = json.dumps({
            "status": "success",
            "transaction_id": f"tx_{i}_" + "a" * 16,
            "session_uuid": f"12345678-1234-5678-1234-{i:012d}",
            "created_at": "2026-08-22T10:00:00.000Z",
            "items": [{"id": i, "price": 49.99, "name": f"Product {i}"}],
            "user": {"role": "customer", "account_num": 100000 + i}
        })
        
        # 5% anomalous/divergent, 95% benign variants
        if i % 20 == 0:
            cand_body = json.dumps({"error": "Unauthorized", "code": 403})
            cand_status = 403
        else:
            cand_body = json.dumps({
                "status": "success",
                "transaction_id": f"tx_{i+1}_" + "b" * 16,
                "session_uuid": f"98765432-1234-5678-1234-{i:012d}",
                "created_at": "2026-08-22T10:00:02.120Z",
                "items": [{"id": i, "price": 49.99, "name": f"Product {i}"}],
                "user": {"role": "customer", "account_num": 100000 + i}
            })
            cand_status = 200

        resp_base = ResponseSnapshot(status_code=200, body=base_body, latency_ms=random.uniform(25.0, 45.0))
        resp_cand = ResponseSnapshot(status_code=cand_status, body=cand_body, latency_ms=random.uniform(25.0, 45.0))
        pairs.append((resp_base, resp_cand))

    # 2. Token Masking Throughput
    t0 = time.perf_counter()
    total_bytes = 0
    for resp_base, _ in pairs:
        masked, _ = mask_volatile_tokens(resp_base.body)
        total_bytes += len(resp_base.body.encode("utf-8"))
    t_mask = time.perf_counter() - t0
    mask_rate_mb = (total_bytes / (1024 * 1024)) / t_mask if t_mask > 0 else 0

    print(f"[*] Masked volatile tokens across {scale_pairs} bodies in {t_mask*1000:.2f}ms ({mask_rate_mb:.2f} MB/sec)")

    # 3. End-to-End Divergence Analysis Throughput & Latencies
    t0 = time.perf_counter()
    latencies = []
    for resp_base, resp_cand in pairs:
        t_start = time.perf_counter()
        result = engine.analyze_divergence(resp_base, resp_cand, DifferentialAxis.ROLE_A_VS_ROLE_B)
        latencies.append((time.perf_counter() - t_start) * 1000)

    t_total = time.perf_counter() - t0
    pair_rate = scale_pairs / t_total if t_total > 0 else 0

    p50 = statistics.median(latencies)
    p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)
    p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else max(latencies)

    print(f"[*] Evaluated {scale_pairs} differential pairs in {t_total*1000:.2f}ms ({pair_rate:.0f} pairs/sec)")
    print(f"[*] Latency: P50={p50:.3f}ms, P95={p95:.3f}ms, P99={p99:.3f}ms")

    # 4. Welch's t-test Calculation Latency
    pop_base = [random.gauss(30.0, 5.0) for _ in range(20)]
    pop_cand = [random.gauss(5030.0, 5.0) for _ in range(20)]
    t_start = time.perf_counter()
    for _ in range(1000):
        _ = welch_t_test(pop_base, pop_cand)
    t_ttest = (time.perf_counter() - t_start) / 1000.0 * 1000.0
    print(f"[*] Welch's t-test Latency per 20-sample comparison: {t_ttest:.4f}ms")

    result = {
        "scale_pairs": scale_pairs,
        "token_masking_throughput_mb_per_sec": round(mask_rate_mb, 2),
        "divergence_throughput_pairs_per_sec": round(pair_rate, 2),
        "divergence_latency_ms": {
            "p50": round(p50, 4),
            "p95": round(p95, 4),
            "p99": round(p99, 4),
        },
        "welch_ttest_latency_ms": round(t_ttest, 5)
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_pairs=5000)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
