# Causal Evidence Engine Module

## R18 Pre-Prototype Reality Check
- **Context**: Security scanners frequently report false positive findings when a backend server crashes due to an unrelated ambient timeout or database lock contention during a probe.
- **Engineered Solution**: DAG-based causal evidence assembly enforcing Pearl's SCM counterfactual verification ($ACE \ge 0.80, PN \ge 0.80$) linked to cryptographic Merkle CAS proofs (SEC-06 / SEC-07).

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: Causal counterfactual testing ($do(\text{payload})$ vs $do(\text{benign})$) cannot eliminate false attributions caused by ambient background server crashes without requiring manual human analyst review.
- **Falsification Criterion**: Under a simulated flaky server environment with 20% random ambient 500 errors, the causal evidence engine must reject 100% of coincidental server failures while confirming genuine injection flaws ($ACE=1.0$).

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/theory_lab/causal_evidence_engine/tests/test_causal_engine.py -v
```

### Running Benchmark Harness
```powershell
python research/theory_lab/causal_evidence_engine/benchmarks/run_benchmark.py
```
