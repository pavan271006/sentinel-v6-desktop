# Limitations: Security Context Graph

## Known Boundaries & Computational Constraints
1. **Dynamic Volatile Edges**: Ephemeral WebSocket messages or fast-rotating CSRF tokens should not be stored indefinitely as persistent graph nodes to avoid unbounded memory growth.
2. **Ultra-Large Graphs (>1,000,000 Nodes)**: Full Exact Betweenness Centrality ($O(V \cdot E)$) requires randomized sampling mode rather than exact calculation for graphs exceeding 50,000 nodes.
3. **Disjoint Subgraph Cross-Referencing**: Graph queries across completely disconnected component clusters require global index lookups.
