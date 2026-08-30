#!/usr/bin/env python3
"""
Challenger 2 Empirical Verification: Memory Soak Harness Leak Detection Test.
Tests whether scripts/run_memory_soak.py accurately detects a real memory leak or masks it.
"""

import os
import sys
import gc
import time

# Add root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.run_memory_soak import MemorySoakRunner, get_process_memory_mb

def test_leak_masking_vulnerability():
    print("=" * 80)
    print("CHALLENGER 2: Testing Memory Soak Harness for Leak Masking Vulnerability")
    print("=" * 80)

    runner = MemorySoakRunner(mode="instant")
    
    # 1. Baseline run without leak
    results_baseline = runner.run_leak_regression(iterations=5)
    print("\nBaseline results (No injected leak):")
    for r in results_baseline:
        print(f"  Run {r.iteration}: Init={r.initial_mb:.2f}MB, Peak={r.workload_peak_mb:.2f}MB, Post={r.post_cleanup_mb:.2f}MB, Retained={r.retained_delta_mb:.2f}MB")

    # 2. Now inject an intentional, massive real memory leak of 50MB per iteration
    leaked_memory_pool = []
    
    print("\nInjecting REAL 50MB memory leak per iteration into process...")
    for run in range(1, 6):
        # Leak ~50MB of raw bytes
        leaked_memory_pool.append(bytearray(50 * 1024 * 1024))
        actual_process_rss = get_process_memory_mb()
        print(f"  [Injected Leak Step {run}] Actual Process RSS is now: {actual_process_rss:.2f} MB")

    # Now execute the runner's leak regression again while the process has 250MB leaked
    results_with_leak = runner.run_leak_regression(iterations=5)
    print("\nResults from MemorySoakRunner.run_leak_regression while 250MB leaked:")
    leak_masked = True
    for r in results_with_leak:
        print(f"  Run {r.iteration}: Init={r.initial_mb:.2f}MB, Peak={r.workload_peak_mb:.2f}MB, Post={r.post_cleanup_mb:.2f}MB, Retained={r.retained_delta_mb:.2f}MB")
        if r.retained_delta_mb > 5.0:
            leak_masked = False

    print("\n" + "=" * 80)
    if leak_masked:
        print("CRITICAL FINDING CONFIRMED: run_memory_soak.py MASKS REAL MEMORY GROWTH!")
        print("Reason: post_cleanup_mb is computed via synthetic formula 'init_mb + (0.15 * (run % 3))'")
        print("instead of measuring actual process memory after workload cleanup (get_process_memory_mb()).")
        print("Retained delta is ALWAYS reported as <= +0.30MB regardless of true memory retention!")
    else:
        print("Memory soak harness correctly detected the leak.")
    print("=" * 80)

if __name__ == "__main__":
    test_leak_masking_vulnerability()
