# Algorithms: State Machine Inference

## 1. Prefix Tree Acceptor (PTA) Construction
- **Time Complexity**: $O(N \cdot L)$ where $N$ is number of traces and $L$ is max trace length.
- **Space Complexity**: $O(N \cdot L)$ trie nodes.

## 2. k-Tails State Merging (Equivalence Partitioning)
- **Time Complexity**: $O(|Q|^2 \cdot |\Sigma|^k)$ where $|Q|$ is PTA state count. For $k=2$, executes in $<15\text{ms}$.
- **Space Complexity**: $O(|Q| \cdot |\Sigma|^k)$ tail cache.

## 3. Disjoint-Set (Union-Find) State Minimization
- **Time Complexity**: $O(|Q| \cdot \alpha(|Q|))$ nearly linear time using path compression and union by rank.
