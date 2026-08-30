"""
Benchmark Runner for HTTP Desync Detector Prototype
Module: research.prototypes.http_desync_detector.benchmarks.run_benchmark
"""

import time
import random
import statistics
import json
import sys
import os

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from research.prototypes.http_desync_detector.models import (
    DesyncVectorType,
    ProbeMethod,
    DesyncProbe,
    ProbeResponseObservation,
)
from research.prototypes.http_desync_detector.detector import (
    DesyncProbeGenerator,
    SinglePacketFrameAssembler,
    HttpDesyncDetector,
)


def run_benchmark(scale_iterations: int = 10000):
    print(f"=== Running HTTP Desync Detector Benchmark (Scale: {scale_iterations} iterations) ===")
    detector = HttpDesyncDetector()

    # 1. Probe Generation Benchmark
    t0 = time.perf_counter()
    probes = []
    for i in range(scale_iterations):
        if i % 3 == 0:
            p = DesyncProbeGenerator.generate_cl_te_timeout_probe(f"host-{i}.target.corp", f"/path/{i}")
        elif i % 3 == 1:
            p = DesyncProbeGenerator.generate_te_cl_timeout_probe(f"host-{i}.target.corp", f"/path/{i}")
        else:
            p = DesyncProbeGenerator.generate_h2_cl_probe(f"host-{i}.target.corp", f"/path/{i}")
        probes.append(p)

    t_gen = time.perf_counter() - t0
    gen_rate = scale_iterations / t_gen if t_gen > 0 else 0
    print(f"[*] Generated {scale_iterations} desync probes in {t_gen*1000:.2f}ms ({gen_rate:.0f} probes/sec)")

    # 2. Single-Packet Frame Packaging Benchmark
    t0 = time.perf_counter()
    batch_count = scale_iterations // 5
    for i in range(batch_count):
        raw_list = [probes[i * 5 + j].raw_payload for j in range(5)]
        SinglePacketFrameAssembler.assemble_single_packet_batch(raw_list, max_mss=1460)
    t_pack = time.perf_counter() - t0
    pack_rate = batch_count / t_pack if t_pack > 0 else 0
    print(f"[*] Assembled {batch_count} single-packet multi-frame batches in {t_pack*1000:.2f}ms ({pack_rate:.0f} batches/sec)")

    # 3. Diagnostic Response Evaluation Benchmark
    t0 = time.perf_counter()
    eval_latencies = []
    base_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=45.0)

    for i, probe in enumerate(probes):
        # 10% simulated vulnerable hangs
        if i % 10 == 0:
            obs = ProbeResponseObservation(status_code=None, elapsed_time_ms=4100.0, socket_timeout_triggered=True)
        else:
            obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=48.0)

        t_start = time.perf_counter()
        _ = detector.evaluate_probe_response(probe, obs, base_obs)
        eval_latencies.append((time.perf_counter() - t_start) * 1000)

    t_eval_total = time.perf_counter() - t0
    eval_rate = scale_iterations / t_eval_total if t_eval_total > 0 else 0

    p50 = statistics.median(eval_latencies)
    p95 = statistics.quantiles(eval_latencies, n=20)[18] if len(eval_latencies) >= 20 else max(eval_latencies)

    print(f"[*] Evaluated {scale_iterations} response observations in {t_eval_total*1000:.2f}ms ({eval_rate:.0f} evals/sec)")
    print(f"[*] Evaluation Latency: P50={p50:.4f}ms, P95={p95:.4f}ms")

    result = {
        "scale_iterations": scale_iterations,
        "probe_generation_rate_per_sec": round(gen_rate, 2),
        "frame_assembly_rate_batches_per_sec": round(pack_rate, 2),
        "evaluation_rate_evals_per_sec": round(eval_rate, 2),
        "evaluation_latency_ms": {
            "p50": round(p50, 5),
            "p95": round(p95, 5),
        }
    }
    return result


if __name__ == "__main__":
    res = run_benchmark(scale_iterations=10000)
    print("\nBenchmark Result Summary:")
    print(json.dumps(res, indent=2))
