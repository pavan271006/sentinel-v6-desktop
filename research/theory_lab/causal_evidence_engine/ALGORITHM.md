# Algorithms: Causal Evidence Engine

## 1. Merkle Tree Root Computation
- **Time Complexity**: $O(K)$ where $K$ is number of leaf hashes.
- **Pairwise Chaining**: $O(\log K)$ layers hashing pairs until single 256-bit root is produced.

## 2. Minimal Causal Subgraph Extraction (Reverse BFS)
- **Time Complexity**: $O(|V| + |E|)$
- **Pruning**: Discards all disconnected probes, background requests, and unrelated endpoints, extracting strictly the minimal $k$-node sub-DAG proving the finding.
