"""
Benchmark Runner for State Machine Inference Module
Module: research.theory_lab.state_machine_inference.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.theory_lab.state_machine_inference.models import TraceAction
from research.theory_lab.state_machine_inference.inference_engine import (
    KTailsLearner,
    InferredMealyMachine,
    StateVulnerabilityDetector,
)


def run_benchmark(scale_traces: int = 2000):
    print(f"=== Running State Machine Inference Benchmark (Scale: {scale_traces} traces) ===")

    # 1. Generate Synthetic Multi-Step Traces
    endpoints = ["/cart/add", "/checkout/address", "/checkout/coupon", "/checkout/shipping", "/checkout/pay", "/order/success"]
    traces = []
    for _ in range(scale_traces):
        trace_len = random.randint(3, len(endpoints))
        trace = [TraceAction(method="POST", endpoint=endpoints[i], status_code=200) for i in range(trace_len)]
        traces.append(trace)

    # 2. PTA Construction & k-Tails Inference Benchmark
    learner = KTailsLearner(k=2)
    t0 = time.perf_counter()
    fsm = learner.infer_from_traces(traces)
    t_infer = time.perf_counter() - t0

    trace_rate = scale_traces / t_infer if t_infer > 0 else 0
    print(f"[*] Inferred Mealy machine from {scale_traces} traces in {t_infer*1000:.2f}ms ({trace_rate:.0f} traces/sec)")
    print(f"[*] Inferred Graph: {len(fsm.states)} states, {sum(len(t) for t in fsm.transitions.values())} transitions")

    # 3. State Vulnerability Detection Benchmark
    detector = StateVulnerabilityDetector(fsm)
    t0 = time.perf_counter()
    eval_latencies = []
    for i in range(scale_traces):
        t_start = time.perf_counter()
        _ = detector.check_out_of_order_bypass(["POST /checkout/pay"], "GET /order/success", 200 if i % 10 == 0 else 403)
        eval_latencies.append((time.perf_counter() - t_start) * 1000)

    t_eval = time.perf_counter() - t0
    eval_rate = scale_traces / t_eval if t_eval > 0 else 0

    p50 = statistics.median(eval_latencies)
    p95 = statistics.quantiles(eval_latencies, n=20)[18] if len(eval_latencies) >= 20 else max(eval_latencies)

    print(f"[*] Evaluated {scale_traces} state checks in {t_eval*1000:.2f}ms ({eval_rate:.0f} checks/sec)")
    print(f"[*] Latency: P50={p50:.4f}ms, P95={p95:.4f}ms")

    result = {
        "scale_traces": scale_traces,
        "inference_throughput_traces_per_sec": round(trace_rate, 2),
        "inferred_state_count": len(fsm.states),
        "inferred_transition_count": sum(len(t) for t in fsm.transitions.values()),
        "vulnerability_check_rate_per_sec": round(eval_rate, 2),
        "check_latency_ms": {
            "p50": round(p50, 5),
            "p95": round(p95, 5),
        }
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_traces=2000)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
