# Algorithms: Differential Security Engine

## 1. Dynamic Shannon Entropy Volatile Masking
- **Time Complexity**: $O(|S|)$ single pass over response characters.
- **Entropy Threshold**: Tokens with length $\ge 12$ and $H(T) \ge 3.8$ are classified as volatile noise and masked before semantic comparison.

## 2. AST Key & Type Path Extraction
- **Time Complexity**: $O(|JSON|)$ parsing time.
- **Comparison**: Evaluates schema structure rather than volatile value strings.

## 3. Welch's t-Statistic & Normal Tail Approximation
- **Time Complexity**: $O(N_1 + N_2)$ where $N_1, N_2 \le 30$.
- **Tail Approximation**: Abramowitz & Stegun error function approximation yielding $< 10^{-7}$ relative error for p-value estimation.
