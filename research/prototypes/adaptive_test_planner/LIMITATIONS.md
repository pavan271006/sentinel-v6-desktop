# Limitations: Adaptive Test Planner

## Known Boundaries & Constraints
1. **Cold Start on Novel Custom Protocols**: In the absence of standard HTTP parameter names, the planner relies more heavily on entropy and exploratory uniform coverage until first anomalous responses are observed.
2. **Extreme Rate Limiting (< 1 req/sec)**: When target hosts enforce aggressive global rate limits, Bayesian prioritization is strictly throughput-bounded by the physical target response rate.
