"""
Benchmark Runner for Adaptive Test Planner Prototype
Module: research.prototypes.adaptive_test_planner.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.prototypes.adaptive_test_planner.models import (
    VulnClass,
    ParamClassification,
    TargetExposure,
    TestCandidate,
    ExecutionFeedback,
)
from research.prototypes.adaptive_test_planner.planner import AdaptiveTestPlanner


def run_benchmark(scale_candidates: int = 5000):
    print(f"=== Running Adaptive Test Planner Benchmark (Scale: {scale_candidates} candidates) ===")
    planner = AdaptiveTestPlanner(max_request_budget=scale_candidates, requests_per_sec=10000.0)

    vuln_classes = list(VulnClass)
    param_types = list(ParamClassification)
    exposures = list(TargetExposure)

    # 1. Candidate Ingestion & 6-Factor Calculation Benchmark
    t0 = time.perf_counter()
    candidates = []
    for i in range(scale_candidates):
        cand = TestCandidate(
            endpoint=f"/api/v1/resource_{i % 50}",
            method="POST" if i % 2 == 0 else "GET",
            parameter_name=f"param_{i % 20}",
            param_type=random.choice(param_types),
            vuln_class=random.choice(vuln_classes),
            exposure=random.choice(exposures),
            estimated_latency_ms=random.uniform(20.0, 150.0),
            payload_sample=f"' OR 1={i}--"
        )
        planner.add_candidate(cand)
        candidates.append(cand)

    t_ingest = time.perf_counter() - t0
    ingest_rate = scale_candidates / t_ingest if t_ingest > 0 else 0

    print(f"[*] Ingested & Evaluated {scale_candidates} candidates in {t_ingest*1000:.2f}ms ({ingest_rate:.0f} candidates/sec)")

    # 2. Priority Scheduling Benchmark
    t0 = time.perf_counter()
    batch_size = 100
    total_scheduled = 0
    while planner.pending_test_count > 0 and total_scheduled < 1000:
        batch = planner.schedule_next_batch(batch_size=batch_size)
        if not batch:
            break
        total_scheduled += len(batch)

    t_schedule = time.perf_counter() - t0
    schedule_rate = total_scheduled / t_schedule if t_schedule > 0 else 0
    print(f"[*] Scheduled {total_scheduled} tests in {t_schedule*1000:.2f}ms ({schedule_rate:.0f} tests/sec)")

    # 3. Dynamic Replanning Latency (100 feedback loops)
    feedback_latencies = []
    for i in range(100):
        fb = ExecutionFeedback(
            test_id=f"test-{i}",
            vuln_class=random.choice(vuln_classes),
            endpoint=f"/api/v1/resource_{i % 50}",
            parameter_name=f"param_{i % 20}",
            status_code=500 if i % 5 == 0 else 200,
            latency_ms=random.uniform(30.0, 200.0),
            anomaly_detected=(i % 5 == 0),
            finding_confirmed=(i % 10 == 0),
        )
        t_start = time.perf_counter()
        planner.record_feedback(fb)
        feedback_latencies.append((time.perf_counter() - t_start) * 1000)

    p50_fb = statistics.median(feedback_latencies)
    p95_fb = statistics.quantiles(feedback_latencies, n=20)[18] if len(feedback_latencies) >= 20 else max(feedback_latencies)
    print(f"[*] Feedback & Dynamic Re-scoring Latency (N=100): P50={p50_fb:.3f}ms, P95={p95_fb:.3f}ms")

    result = {
        "scale_candidates": scale_candidates,
        "ingestion_rate_cand_per_sec": round(ingest_rate, 2),
        "scheduling_rate_tests_per_sec": round(schedule_rate, 2),
        "feedback_latency_ms": {
            "p50": round(p50_fb, 4),
            "p95": round(p95_fb, 4),
        }
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_candidates=5000)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
