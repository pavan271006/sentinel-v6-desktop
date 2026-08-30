# Security Context Graph Prototype

## R18 Pre-Prototype Reality Check
- **Context**: Modeling complex multi-tiered enterprise application attack surfaces as raw relational tables results in expensive multi-table JOINs and slow traversal queries.
- **Reality Check Evaluation**: Traditional graph databases (e.g. Neo4j) introduce massive JVM memory overhead (500MB - 2GB) and separate network socket dependencies unacceptable for a desktop workstation.
- **Engineered Solution**: In-memory typed directed multigraph with bidirectional adjacency lists and SQLite CTE compatibility, providing sub-millisecond graph queries (<2ms P95 across 10,000 nodes) with zero external dependencies.

## R13 Falsification Hypothesis
- **Hypothesis $H_0$**: In-memory adjacency representations cannot scale beyond 10,000 nodes without exceeding desktop memory footprints or suffering $O(V \cdot E)$ latency degradation during recursive cycle detection.
- **Falsification Criterion**: Execute Tarjan SCC and BFS reachability benchmarks on a 25,000-node, 75,000-edge dense graph. If latency remains $<50\text{ms}$ and memory remains $<35\text{MB}$, $H_0$ is rejected.

## Quick Start & Verification

### Running Unit & Integration Tests
```powershell
python -m unittest research/prototypes/security_context_graph/tests/test_graph.py -v
```

### Running Benchmark Harness
```powershell
python research/prototypes/security_context_graph/benchmarks/run_benchmark.py
```
