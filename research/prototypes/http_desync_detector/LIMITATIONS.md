# Limitations: HTTP Desync Detector

## Known Boundaries & Constraints
1. **Aggressive Middlebox TCP Normalization**: If an intermediate corporate SSL-inspecting middlebox re-encodes all HTTP streams strictly into standard RFC 9112 without preserving raw bytes, desync probes may be sanitized before reaching the front-end reverse proxy.
2. **Hard Socket Teardown**: Target servers configured to close TCP connections immediately after each response (`Connection: close`) prevent pipelined desynchronization.
