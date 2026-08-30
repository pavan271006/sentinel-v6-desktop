# Adaptive Test Planner Prototype

## R18 Pre-Prototype Reality Check
- **Context**: Linear brute-force vulnerability scanning sprays exhaustive dictionary payloads across every discovered parameter. This wastes 70-80% of network requests testing impossible vulnerability classes (e.g. testing SQL injection on client-side JS hashes or testing XSS on binary endpoints).
- **Engineered Solution**: Bayesian active learning engine that evaluates expected risk vs execution cost, dynamically prioritizing the most promising probes with explicit 6-factor explainable logs.

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: A Bayesian-driven adaptive test scheduler does not discover critical vulnerabilities faster (in fewer requests) than uniform random or linear round-robin scheduling.
- **Falsification Criterion**: Under a fixed budget of 200 requests on a target with 1,000 candidate test vectors and 5 true vulnerabilities, if the adaptive planner identifies 100% of vulnerabilities in $\le 60$ requests while linear scanning requires $>180$ requests, $H_0$ is rejected.

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/prototypes/adaptive_test_planner/tests/test_planner.py -v
```

### Running Benchmark Harness
```powershell
python research/prototypes/adaptive_test_planner/benchmarks/run_benchmark.py
```
