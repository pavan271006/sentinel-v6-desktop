# State Machine Inference Module

## R18 Pre-Prototype Reality Check
- **Context**: Classical active automata learning (e.g. Angluin $L^*$) requires tens of thousands of expensive reset queries ($25,000+$ HTTP requests) and fails completely when encountering non-deterministic web banners or transient network jitter.
- **Engineered Solution**: Passive k-Tails state merging from recorded proxy history and passive crawler traces ($k=2$), generating an accurate Mealy state model in $<15\text{ms}$ with zero network query overhead.

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: Passive k-tails inference ($k=2$) cannot construct a valid state machine representation of a multi-step e-commerce checkout without over-generalizing and producing false transitions.
- **Falsification Criterion**: Ingest 2,000 multi-step traces and verify that inferred states preserve prerequisite ordering (`CART` $\to$ `CHECKOUT` $\to$ `PAYMENT` $\to$ `SUCCESS`) without creating illegal shortcuts in the base model.

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/theory_lab/state_machine_inference/tests/test_state_machine.py -v
```

### Running Benchmark Harness
```powershell
python research/theory_lab/state_machine_inference/benchmarks/run_benchmark.py
```
