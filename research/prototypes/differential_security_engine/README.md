# Differential Security Engine Prototype

## R18 Pre-Prototype Reality Check
- **Context**: Standard scanners fail on dynamic single-page apps because nonces, CSRF tokens, and timestamps cause naive diffing to report false positive changes on every request.
- **Engineered Solution**: Automatic volatile token masking via Shannon entropy thresholding combined with AST structural Jaccard matching and Welch's t-test statistical timing separation.

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: Statistical timing tests cannot reliably distinguish real blind database delays (5000ms) from internet network latency jitter with $p < 0.001$ without requiring $>50$ requests.
- **Falsification Criterion**: Execute Welch's t-test with $N=10$ interleaved samples under $\pm 200\text{ms}$ Gaussian network jitter. If $p < 10^{-4}$ is achieved in 100% of trials, $H_0$ is rejected.

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/prototypes/differential_security_engine/tests/test_differential.py -v
```

### Running Benchmark Harness
```powershell
python research/prototypes/differential_security_engine/benchmarks/run_benchmark.py
```
