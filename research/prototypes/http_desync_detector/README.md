# HTTP Desync & Request Smuggling Detector Prototype

## R18 Pre-Prototype Reality Check
- **Context**: Request smuggling vulnerabilities are among the most destructive web flaws (enabling session hijacking and cache poisoning), but aggressive scanners often use destructive secondary payloads that corrupt innocent client sessions.
- **Engineered Solution**: High-precision, non-destructive timeout probes combined with single-packet synchronization and canary prefix detection across HTTP/1.1 and HTTP/2.

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: A non-destructive timeout probe cannot reliably detect CL.TE / TE.CL desync without actively corrupting secondary pipelined socket requests.
- **Falsification Criterion**: Under simulated backend desynchronization, the detector must achieve $\ge 95\%$ confidence detection based solely on frontend/backend timing differentials ($T \ge 3500\text{ms}$ vs $T_{\text{base}} \le 100\text{ms}$) with zero socket residue.

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/prototypes/http_desync_detector/tests/test_desync.py -v
```

### Running Benchmark Harness
```powershell
python research/prototypes/http_desync_detector/benchmarks/run_benchmark.py
```
