# Algorithms: Adaptive Test Planner

## 1. 6-Factor Utility Calculation
- **Time Complexity**: $O(1)$ per candidate probe.
- **Normalized Entropy**: $O(|S|)$ where $|S|$ is parameter/payload string length ($|S| < 256$).
- **Explanation Generation**: Formatted directly during scoring with zero string duplication.

## 2. Priority Scheduling (Binary Min-Heap over Inverted Utilities)
- **Time Complexity**: $O(\log N)$ insertion, $O(\log N)$ extraction.
- **Space Complexity**: $O(N)$ candidate pointers.

## 3. Dynamic Feedback Loop & Posterior Re-ranking
- **Time Complexity**: $O(K \log N)$ where $K$ is the number of candidates belonging to the updated target endpoint.
- **Trigger**: When an anomaly or confirmation is recorded, immediately promotes correlated vulnerability tests on the same endpoint without waiting for full scan exhaustion.
