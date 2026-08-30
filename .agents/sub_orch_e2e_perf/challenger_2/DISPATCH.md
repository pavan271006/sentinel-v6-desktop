## 2026-08-18T12:19:20Z
<USER_REQUEST>
You are Challenger 2 for the E2E Performance Testing Framework of Sentinel V6.
Working Directory: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf\challenger_2`
Files to read:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf\SCOPE.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\TEST_INFRA.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\tests\e2e\`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\scripts\`

Your task:
1. Adversarially challenge the workflow validation suites and memory soak harness.
2. Run the 17-step, 24-step, and 34-step pentester validation sequences with deliberate out-of-order calls, invalid scope URLs, out-of-scope requests, malformed CAS blobs, and corrupted session tokens to ensure fail-closed enforcement (SEC-01, SEC-06, SEC-07, SEC-09, SEC-12).
3. Verify that memory measurements in `run_memory_soak.py` accurately detect leaks and do not mask memory growth.
4. Provide your explicit verdict (`APPROVE` or `REQUEST_CHANGES`) with empirical test results in `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf\challenger_2\handoff.md`.
5. Send a message to the caller with your verdict.
</USER_REQUEST>
