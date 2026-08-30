# Algorithms: Security Context Graph

## 1. Transitive Reachability (Depth-Bounded BFS)
- **Time Complexity**: $O(|V| + |E|)$ bounded by $D_{max}$ depth.
- **Space Complexity**: $O(|V|)$ memory queue and visited hash set.
- **Description**: Explores outgoing successors layer-by-layer up to $D_{max}$, preventing infinite exploration in cyclic enterprise graphs.

## 2. Shortest Attack Path (Dijkstra's Min-Heap Algorithm)
- **Time Complexity**: $O((|V| + |E|) \log |V|)$
- **Space Complexity**: $O(|V|)$ for distance map and priority queue.
- **Edge Weight Function**: Traversal difficulty / exploit cost $\omega(e) \ge 0$.

## 3. Strongly Connected Components (Tarjan's Algorithm)
- **Time Complexity**: $O(|V| + |E|)$ single-pass DFS.
- **Space Complexity**: $O(|V|)$ recursion stack and lowlink arrays.
- **Cycle Assertion**: Detects recursive loops and multi-entity trust cycles.

## 4. Betweenness Centrality (Brandes' Algorithm)
- **Time Complexity**: $O(|V| \cdot |E|)$ for unweighted graphs, $O(|V| \cdot |E| + |V|^2 \log |V|)$ for weighted graphs.
- **Space Complexity**: $O(|V| + |E|)$
- **Sampling Mode**: For graphs with $|V| > 10,000$, uses randomized source sampling ($k=100$) to achieve $O(k \cdot |E|)$ sub-millisecond execution.
