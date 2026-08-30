# Limitations: State Machine Inference

## Known Boundaries & Constraints
1. **Under-Explored Traces**: If a specific backend state is never traversed by the user or crawler during traffic interception, passive inference cannot infer the existence of that hidden state.
2. **Choice of k in k-Tails**: Choosing $k=1$ over-generalizes and collapses distinct states; choosing $k \ge 4$ under-generalizes and keeps identical states separate. $k=2$ is the optimal compromise for web workflows.
