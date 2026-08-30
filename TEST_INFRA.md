# TEST_INFRA.md: UCMA-X End-to-End Testing Infrastructure & Verification Architecture

## 1. Executive Summary & Testing Philosophy
The **Unified Causal-Metamorphic Adaptive SQL Security Validation Engine (UCMA-X)** requires a research-grade, multi-tiered End-to-End (E2E) testing framework. Because UCMA-X is designed for mission-critical authorized database security assessments, its operational and security invariants must be verified with mathematical rigor and absolute determinism.

### Core Testing Principles
1. **Opaque-Box Independence**: E2E test suites validate system behavior through external observable interfaces without relying on internal mock hacks or facade state.
2. **Fail-Closed Invariant Verification**: Any scope violation, malformed token, SSRF attempt, or unverified redirect must fail immediately with zero outbound network traffic.
3. **Cryptographic Provability**: All evidence artifacts, response snapshots, and finding provenance records must produce bit-for-bit verifiable BLAKE3 hashes and Merkle CAS proof trees.
4. **Statistical Rigor**: Sequential testing (Wald SPRT), causal interventions (Judea Pearl do-calculus), and metamorphic invariants (PQS/TLP/NoREC) are verified against empirical ground-truth distributions.
5. **Zero False Positive Guarantee**: High-entropy dynamic web applications, reflected parameters, randomized tokens, and benign syntax perturbation must result in 0 false positive detections across the Hard-Negative benchmark corpus.

---

## 2. Four-Tier Testing Methodology (+ Tier 5 Adversarial Hardening)

`
+-----------------------------------------------------------------------+
|  Tier 5: Adversarial Hardening, Chaos & Fuzzing (Crash/DoS/Bypass)   |
+-----------------------------------------------------------------------+
|  Tier 4: Complex Real-World E2E Scenarios (Multi-Stage / Blind / OAST)|
+-----------------------------------------------------------------------+
|  Tier 3: Pairwise Combinatorial Subsystem Integration                 |
+-----------------------------------------------------------------------+
|  Tier 2: Boundary, Edge Cases, Defensive Error Handling (>=5/feature)  |
+-----------------------------------------------------------------------+
|  Tier 1: Feature Coverage & Happy-Path Functional Verification (>=5)  |
+-----------------------------------------------------------------------+
`

- **Tier 1: Feature Coverage**: >= 5 explicit functional tests per feature across all 35 features in the Feature Inventory (Total >= 175 Tier 1 test cases).
- **Tier 2: Boundary & Corner Conditions**: >= 5 boundary/stress/edge-case tests per feature covering extreme inputs, zero-lengths, malformed encodings, timeouts, and resource limits (Total >= 175 Tier 2 test cases).
- **Tier 3: Pairwise Subsystem Integration**: Systematic interaction testing across adjacent and cross-cutting crates.
- **Tier 4: Real-World Scenarios**: Full-lifecycle simulations of complex enterprise web targets, multi-hop redirect chains, dynamic reflection disambiguation, blind time-based SPRT under network jitter, and read-only schema discovery.
- **Tier 5: Adversarial Hardening**: Grammar fuzzing, Unicode normalization attacks, DNS rebinding race conditions, Merkle tree tampering, and unbounded payload stress.

---

## 3. Comprehensive 35-Feature Test Specification Matrix

### Feature 1: Safe Foundation Models (ucma-core)
- **Description**: Target, Request, Endpoint, Parameter domain models & BLAKE3 IDs
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F01_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Safe Foundation Models (ucma-core).
  2. T1_F01_02_ContractFidelity: Verify interface contract types and schema fidelity for Safe Foundation Models.
  3. T1_F01_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Safe Foundation Models.
  4. T1_F01_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Safe Foundation Models.
  5. T1_F01_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Safe Foundation Models.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F01_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Safe Foundation Models; verify defensive rejection.
  2. T2_F01_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Safe Foundation Models.
  3. T2_F01_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Safe Foundation Models; verify clean error propagation.
  4. T2_F01_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Safe Foundation Models.
  5. T2_F01_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Safe Foundation Models.

---

### Feature 2: Fail-Closed Scope Policy (ucma-scope)
- **Description**: Centralized default-deny scope enforcement, IP/CIDR/Regex matching
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F02_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Fail-Closed Scope Policy (ucma-scope).
  2. T1_F02_02_ContractFidelity: Verify interface contract types and schema fidelity for Fail-Closed Scope Policy.
  3. T1_F02_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Fail-Closed Scope Policy.
  4. T1_F02_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Fail-Closed Scope Policy.
  5. T1_F02_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Fail-Closed Scope Policy.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F02_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Fail-Closed Scope Policy; verify defensive rejection.
  2. T2_F02_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Fail-Closed Scope Policy.
  3. T2_F02_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Fail-Closed Scope Policy; verify clean error propagation.
  4. T2_F02_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Fail-Closed Scope Policy.
  5. T2_F02_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Fail-Closed Scope Policy.

---

### Feature 3: Anti-SSRF & DNS Validation (ucma-scope)
- **Description**: Loopback, private, link-local IP resolution blocking & pinning
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F03_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Anti-SSRF & DNS Validation (ucma-scope).
  2. T1_F03_02_ContractFidelity: Verify interface contract types and schema fidelity for Anti-SSRF & DNS Validation.
  3. T1_F03_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Anti-SSRF & DNS Validation.
  4. T1_F03_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Anti-SSRF & DNS Validation.
  5. T1_F03_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Anti-SSRF & DNS Validation.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F03_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Anti-SSRF & DNS Validation; verify defensive rejection.
  2. T2_F03_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Anti-SSRF & DNS Validation.
  3. T2_F03_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Anti-SSRF & DNS Validation; verify clean error propagation.
  4. T2_F03_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Anti-SSRF & DNS Validation.
  5. T2_F03_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Anti-SSRF & DNS Validation.

---

### Feature 4: Hop-by-Hop Redirect Validation (ucma-http)
- **Description**: Re-evaluating scope policy on every HTTP redirect hop
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F04_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Hop-by-Hop Redirect Validation (ucma-http).
  2. T1_F04_02_ContractFidelity: Verify interface contract types and schema fidelity for Hop-by-Hop Redirect Validation.
  3. T1_F04_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Hop-by-Hop Redirect Validation.
  4. T1_F04_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Hop-by-Hop Redirect Validation.
  5. T1_F04_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Hop-by-Hop Redirect Validation.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F04_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Hop-by-Hop Redirect Validation; verify defensive rejection.
  2. T2_F04_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Hop-by-Hop Redirect Validation.
  3. T2_F04_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Hop-by-Hop Redirect Validation; verify clean error propagation.
  4. T2_F04_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Hop-by-Hop Redirect Validation.
  5. T2_F04_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Hop-by-Hop Redirect Validation.

---

### Feature 5: Capability-Gated HTTP Client (ucma-http)
- **Description**: AuthorizedRequest token required for all network dispatch
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F05_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Capability-Gated HTTP Client (ucma-http).
  2. T1_F05_02_ContractFidelity: Verify interface contract types and schema fidelity for Capability-Gated HTTP Client.
  3. T1_F05_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Capability-Gated HTTP Client.
  4. T1_F05_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Capability-Gated HTTP Client.
  5. T1_F05_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Capability-Gated HTTP Client.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F05_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Capability-Gated HTTP Client; verify defensive rejection.
  2. T2_F05_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Capability-Gated HTTP Client.
  3. T2_F05_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Capability-Gated HTTP Client; verify clean error propagation.
  4. T2_F05_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Capability-Gated HTTP Client.
  5. T2_F05_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Capability-Gated HTTP Client.

---

### Feature 6: Response Snapshots & In-Memory Store (ucma-core, ucma-http)
- **Description**: BLAKE3 raw wire capture, status, headers, body snapshotting
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F06_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Response Snapshots & In-Memory Store (ucma-core, ucma-http).
  2. T1_F06_02_ContractFidelity: Verify interface contract types and schema fidelity for Response Snapshots & In-Memory Store.
  3. T1_F06_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Response Snapshots & In-Memory Store.
  4. T1_F06_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Response Snapshots & In-Memory Store.
  5. T1_F06_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Response Snapshots & In-Memory Store.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F06_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Response Snapshots & In-Memory Store; verify defensive rejection.
  2. T2_F06_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Response Snapshots & In-Memory Store.
  3. T2_F06_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Response Snapshots & In-Memory Store; verify clean error propagation.
  4. T2_F06_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Response Snapshots & In-Memory Store.
  5. T2_F06_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Response Snapshots & In-Memory Store.

---

### Feature 7: Benchmark Harness (ucma-bench)
- **Description**: Benchmark testbed harness with synthetic fixtures
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F07_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Benchmark Harness (ucma-bench).
  2. T1_F07_02_ContractFidelity: Verify interface contract types and schema fidelity for Benchmark Harness.
  3. T1_F07_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Benchmark Harness.
  4. T1_F07_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Benchmark Harness.
  5. T1_F07_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Benchmark Harness.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F07_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Benchmark Harness; verify defensive rejection.
  2. T2_F07_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Benchmark Harness.
  3. T2_F07_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Benchmark Harness; verify clean error propagation.
  4. T2_F07_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Benchmark Harness.
  5. T2_F07_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Benchmark Harness.

---

### Feature 8: Multi-Format Parameter Extraction (ucma-parameter)
- **Description**: Query, form, JSON, XML, multipart, header, cookie parsing
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F08_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Multi-Format Parameter Extraction (ucma-parameter).
  2. T1_F08_02_ContractFidelity: Verify interface contract types and schema fidelity for Multi-Format Parameter Extraction.
  3. T1_F08_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Multi-Format Parameter Extraction.
  4. T1_F08_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Multi-Format Parameter Extraction.
  5. T1_F08_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Multi-Format Parameter Extraction.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F08_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Multi-Format Parameter Extraction; verify defensive rejection.
  2. T2_F08_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Multi-Format Parameter Extraction.
  3. T2_F08_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Multi-Format Parameter Extraction; verify clean error propagation.
  4. T2_F08_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Multi-Format Parameter Extraction.
  5. T2_F08_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Multi-Format Parameter Extraction.

---

### Feature 9: Dynamic Response Normalization (ucma-response)
- **Description**: Structural tokenization, dynamic content masking, AST diffing
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F09_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Dynamic Response Normalization (ucma-response).
  2. T1_F09_02_ContractFidelity: Verify interface contract types and schema fidelity for Dynamic Response Normalization.
  3. T1_F09_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Dynamic Response Normalization.
  4. T1_F09_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Dynamic Response Normalization.
  5. T1_F09_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Dynamic Response Normalization.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F09_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Dynamic Response Normalization; verify defensive rejection.
  2. T2_F09_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Dynamic Response Normalization.
  3. T2_F09_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Dynamic Response Normalization; verify clean error propagation.
  4. T2_F09_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Dynamic Response Normalization.
  5. T2_F09_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Dynamic Response Normalization.

---

### Feature 10: SQL Semantic IR (ucma-sql-ir)
- **Description**: Dialect-neutral SQL Semantic Intermediate Representation
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F10_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for SQL Semantic IR (ucma-sql-ir).
  2. T1_F10_02_ContractFidelity: Verify interface contract types and schema fidelity for SQL Semantic IR.
  3. T1_F10_03_DeterministicExecution: Verify deterministic execution and state reproducibility for SQL Semantic IR.
  4. T1_F10_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for SQL Semantic IR.
  5. T1_F10_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for SQL Semantic IR.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F10_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against SQL Semantic IR; verify defensive rejection.
  2. T2_F10_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against SQL Semantic IR.
  3. T2_F10_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against SQL Semantic IR; verify clean error propagation.
  4. T2_F10_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against SQL Semantic IR.
  5. T2_F10_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for SQL Semantic IR.

---

### Feature 11: Dialect Syntax & Lexer Rules (ucma-dialect)
- **Description**: PG, MySQL, SQLite, MSSQL, Oracle keyword & quoting rules
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F11_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Dialect Syntax & Lexer Rules (ucma-dialect).
  2. T1_F11_02_ContractFidelity: Verify interface contract types and schema fidelity for Dialect Syntax & Lexer Rules.
  3. T1_F11_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Dialect Syntax & Lexer Rules.
  4. T1_F11_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Dialect Syntax & Lexer Rules.
  5. T1_F11_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Dialect Syntax & Lexer Rules.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F11_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Dialect Syntax & Lexer Rules; verify defensive rejection.
  2. T2_F11_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Dialect Syntax & Lexer Rules.
  3. T2_F11_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Dialect Syntax & Lexer Rules; verify clean error propagation.
  4. T2_F11_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Dialect Syntax & Lexer Rules.
  5. T2_F11_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Dialect Syntax & Lexer Rules.

---

### Feature 12: SQL AST Manipulation Engine (ucma-ast)
- **Description**: Safe AST mutation, boundary injection, serialization
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F12_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for SQL AST Manipulation Engine (ucma-ast).
  2. T1_F12_02_ContractFidelity: Verify interface contract types and schema fidelity for SQL AST Manipulation Engine.
  3. T1_F12_03_DeterministicExecution: Verify deterministic execution and state reproducibility for SQL AST Manipulation Engine.
  4. T1_F12_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for SQL AST Manipulation Engine.
  5. T1_F12_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for SQL AST Manipulation Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F12_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against SQL AST Manipulation Engine; verify defensive rejection.
  2. T2_F12_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against SQL AST Manipulation Engine.
  3. T2_F12_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against SQL AST Manipulation Engine; verify clean error propagation.
  4. T2_F12_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against SQL AST Manipulation Engine.
  5. T2_F12_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for SQL AST Manipulation Engine.

---

### Feature 13: Multi-Protocol Adapters (ucma-graphql, ucma-grpc, ucma-websocket)
- **Description**: GraphQL, gRPC Protobuf, WebSocket parameter extractors
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F13_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Multi-Protocol Adapters (ucma-graphql, ucma-grpc, ucma-websocket).
  2. T1_F13_02_ContractFidelity: Verify interface contract types and schema fidelity for Multi-Protocol Adapters.
  3. T1_F13_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Multi-Protocol Adapters.
  4. T1_F13_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Multi-Protocol Adapters.
  5. T1_F13_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Multi-Protocol Adapters.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F13_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Multi-Protocol Adapters; verify defensive rejection.
  2. T2_F13_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Multi-Protocol Adapters.
  3. T2_F13_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Multi-Protocol Adapters; verify clean error propagation.
  4. T2_F13_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Multi-Protocol Adapters.
  5. T2_F13_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Multi-Protocol Adapters.

---

### Feature 14: Statistical Anomaly Engine (ucma-statistics)
- **Description**: Welch t-test, Mann-Whitney U, CUSUM drift detection
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F14_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Statistical Anomaly Engine (ucma-statistics).
  2. T1_F14_02_ContractFidelity: Verify interface contract types and schema fidelity for Statistical Anomaly Engine.
  3. T1_F14_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Statistical Anomaly Engine.
  4. T1_F14_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Statistical Anomaly Engine.
  5. T1_F14_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Statistical Anomaly Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F14_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Statistical Anomaly Engine; verify defensive rejection.
  2. T2_F14_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Statistical Anomaly Engine.
  3. T2_F14_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Statistical Anomaly Engine; verify clean error propagation.
  4. T2_F14_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Statistical Anomaly Engine.
  5. T2_F14_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Statistical Anomaly Engine.

---

### Feature 15: Wald SPRT Micro-Timing Engine (ucma-timing)
- **Description**: Sequential probability ratio test on micro-delays (200-400ms)
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F15_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Wald SPRT Micro-Timing Engine (ucma-timing).
  2. T1_F15_02_ContractFidelity: Verify interface contract types and schema fidelity for Wald SPRT Micro-Timing Engine.
  3. T1_F15_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Wald SPRT Micro-Timing Engine.
  4. T1_F15_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Wald SPRT Micro-Timing Engine.
  5. T1_F15_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Wald SPRT Micro-Timing Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F15_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Wald SPRT Micro-Timing Engine; verify defensive rejection.
  2. T2_F15_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Wald SPRT Micro-Timing Engine.
  3. T2_F15_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Wald SPRT Micro-Timing Engine; verify clean error propagation.
  4. T2_F15_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Wald SPRT Micro-Timing Engine.
  5. T2_F15_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Wald SPRT Micro-Timing Engine.

---

### Feature 16: Relational Metamorphic Engine (ucma-metamorphic)
- **Description**: SQLancer PQS, TLP, NoREC equivalence verification
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F16_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Relational Metamorphic Engine (ucma-metamorphic).
  2. T1_F16_02_ContractFidelity: Verify interface contract types and schema fidelity for Relational Metamorphic Engine.
  3. T1_F16_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Relational Metamorphic Engine.
  4. T1_F16_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Relational Metamorphic Engine.
  5. T1_F16_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Relational Metamorphic Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F16_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Relational Metamorphic Engine; verify defensive rejection.
  2. T2_F16_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Relational Metamorphic Engine.
  3. T2_F16_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Relational Metamorphic Engine; verify clean error propagation.
  4. T2_F16_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Relational Metamorphic Engine.
  5. T2_F16_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Relational Metamorphic Engine.

---

### Feature 17: Causal SCM Intervention Engine (ucma-causal)
- **Description**: Pearl do-calculus for reflection disentanglement
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F17_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Causal SCM Intervention Engine (ucma-causal).
  2. T1_F17_02_ContractFidelity: Verify interface contract types and schema fidelity for Causal SCM Intervention Engine.
  3. T1_F17_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Causal SCM Intervention Engine.
  4. T1_F17_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Causal SCM Intervention Engine.
  5. T1_F17_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Causal SCM Intervention Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F17_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Causal SCM Intervention Engine; verify defensive rejection.
  2. T2_F17_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Causal SCM Intervention Engine.
  3. T2_F17_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Causal SCM Intervention Engine; verify clean error propagation.
  4. T2_F17_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Causal SCM Intervention Engine.
  5. T2_F17_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Causal SCM Intervention Engine.

---

### Feature 18: Decoupled 5-Oracle Array (ucma-oracles)
- **Description**: Error, Differential, Metamorphic, Causal, Timing consensus
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F18_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Decoupled 5-Oracle Array (ucma-oracles).
  2. T1_F18_02_ContractFidelity: Verify interface contract types and schema fidelity for Decoupled 5-Oracle Array.
  3. T1_F18_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Decoupled 5-Oracle Array.
  4. T1_F18_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Decoupled 5-Oracle Array.
  5. T1_F18_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Decoupled 5-Oracle Array.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F18_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Decoupled 5-Oracle Array; verify defensive rejection.
  2. T2_F18_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Decoupled 5-Oracle Array.
  3. T2_F18_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Decoupled 5-Oracle Array; verify clean error propagation.
  4. T2_F18_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Decoupled 5-Oracle Array.
  5. T2_F18_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Decoupled 5-Oracle Array.

---

### Feature 19: Bounded Z3 SMT Solver (ucma-smt)
- **Description**: SMT constraint solver for boundary escape (<=50ms timeout)
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F19_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Bounded Z3 SMT Solver (ucma-smt).
  2. T1_F19_02_ContractFidelity: Verify interface contract types and schema fidelity for Bounded Z3 SMT Solver.
  3. T1_F19_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Bounded Z3 SMT Solver.
  4. T1_F19_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Bounded Z3 SMT Solver.
  5. T1_F19_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Bounded Z3 SMT Solver.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F19_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Bounded Z3 SMT Solver; verify defensive rejection.
  2. T2_F19_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Bounded Z3 SMT Solver.
  3. T2_F19_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Bounded Z3 SMT Solver; verify clean error propagation.
  4. T2_F19_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Bounded Z3 SMT Solver.
  5. T2_F19_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Bounded Z3 SMT Solver.

---

### Feature 20: Grammar Synthesis & Trie Fallback (ucma-grammar)
- **Description**: Context-free SQL production generator & robust Trie fallback
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F20_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Grammar Synthesis & Trie Fallback (ucma-grammar).
  2. T1_F20_02_ContractFidelity: Verify interface contract types and schema fidelity for Grammar Synthesis & Trie Fallback.
  3. T1_F20_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Grammar Synthesis & Trie Fallback.
  4. T1_F20_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Grammar Synthesis & Trie Fallback.
  5. T1_F20_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Grammar Synthesis & Trie Fallback.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F20_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Grammar Synthesis & Trie Fallback; verify defensive rejection.
  2. T2_F20_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Grammar Synthesis & Trie Fallback.
  3. T2_F20_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Grammar Synthesis & Trie Fallback; verify clean error propagation.
  4. T2_F20_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Grammar Synthesis & Trie Fallback.
  5. T2_F20_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Grammar Synthesis & Trie Fallback.

---

### Feature 21: Bayesian UCB Active Planner (ucma-planner)
- **Description**: Information-gain test scheduling (budget <=18 requests/param)
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F21_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Bayesian UCB Active Planner (ucma-planner).
  2. T1_F21_02_ContractFidelity: Verify interface contract types and schema fidelity for Bayesian UCB Active Planner.
  3. T1_F21_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Bayesian UCB Active Planner.
  4. T1_F21_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Bayesian UCB Active Planner.
  5. T1_F21_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Bayesian UCB Active Planner.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F21_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Bayesian UCB Active Planner; verify defensive rejection.
  2. T2_F21_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Bayesian UCB Active Planner.
  3. T2_F21_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Bayesian UCB Active Planner; verify clean error propagation.
  4. T2_F21_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Bayesian UCB Active Planner.
  5. T2_F21_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Bayesian UCB Active Planner.

---

### Feature 22: Finding Lifecycle State Machine (ucma-detection)
- **Description**: 10-state formal lifecycle from Observation to Promotion
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F22_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Finding Lifecycle State Machine (ucma-detection).
  2. T1_F22_02_ContractFidelity: Verify interface contract types and schema fidelity for Finding Lifecycle State Machine.
  3. T1_F22_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Finding Lifecycle State Machine.
  4. T1_F22_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Finding Lifecycle State Machine.
  5. T1_F22_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Finding Lifecycle State Machine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F22_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Finding Lifecycle State Machine; verify defensive rejection.
  2. T2_F22_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Finding Lifecycle State Machine.
  3. T2_F22_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Finding Lifecycle State Machine; verify clean error propagation.
  4. T2_F22_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Finding Lifecycle State Machine.
  5. T2_F22_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Finding Lifecycle State Machine.

---

### Feature 23: ML/RL Mutator Weighting (ucma-ml, ucma-rl)
- **Description**: Feedback-guided mutator selection and anomaly scoring
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F23_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for ML/RL Mutator Weighting (ucma-ml, ucma-rl).
  2. T1_F23_02_ContractFidelity: Verify interface contract types and schema fidelity for ML/RL Mutator Weighting.
  3. T1_F23_03_DeterministicExecution: Verify deterministic execution and state reproducibility for ML/RL Mutator Weighting.
  4. T1_F23_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for ML/RL Mutator Weighting.
  5. T1_F23_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for ML/RL Mutator Weighting.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F23_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against ML/RL Mutator Weighting; verify defensive rejection.
  2. T2_F23_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against ML/RL Mutator Weighting.
  3. T2_F23_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against ML/RL Mutator Weighting; verify clean error propagation.
  4. T2_F23_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against ML/RL Mutator Weighting.
  5. T2_F23_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for ML/RL Mutator Weighting.

---

### Feature 24: Stateful Multi-Step Engine (ucma-state)
- **Description**: State transition tracking for multi-step workflows
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F24_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Stateful Multi-Step Engine (ucma-state).
  2. T1_F24_02_ContractFidelity: Verify interface contract types and schema fidelity for Stateful Multi-Step Engine.
  3. T1_F24_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Stateful Multi-Step Engine.
  4. T1_F24_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Stateful Multi-Step Engine.
  5. T1_F24_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Stateful Multi-Step Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F24_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Stateful Multi-Step Engine; verify defensive rejection.
  2. T2_F24_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Stateful Multi-Step Engine.
  3. T2_F24_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Stateful Multi-Step Engine; verify clean error propagation.
  4. T2_F24_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Stateful Multi-Step Engine.
  5. T2_F24_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Stateful Multi-Step Engine.

---

### Feature 25: Second-Order Injection Engine (ucma-second-order)
- **Description**: Asynchronous source-to-sink correlation and tracking
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F25_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Second-Order Injection Engine (ucma-second-order).
  2. T1_F25_02_ContractFidelity: Verify interface contract types and schema fidelity for Second-Order Injection Engine.
  3. T1_F25_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Second-Order Injection Engine.
  4. T1_F25_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Second-Order Injection Engine.
  5. T1_F25_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Second-Order Injection Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F25_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Second-Order Injection Engine; verify defensive rejection.
  2. T2_F25_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Second-Order Injection Engine.
  3. T2_F25_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Second-Order Injection Engine; verify clean error propagation.
  4. T2_F25_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Second-Order Injection Engine.
  5. T2_F25_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Second-Order Injection Engine.

---

### Feature 26: Out-of-Band (OAST) Integration (ucma-oast)
- **Description**: Stateless AES-256 token generation & DNS/HTTP callback listener
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F26_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Out-of-Band (OAST) Integration (ucma-oast).
  2. T1_F26_02_ContractFidelity: Verify interface contract types and schema fidelity for Out-of-Band (OAST) Integration.
  3. T1_F26_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Out-of-Band (OAST) Integration.
  4. T1_F26_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Out-of-Band (OAST) Integration.
  5. T1_F26_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Out-of-Band (OAST) Integration.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F26_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Out-of-Band (OAST) Integration; verify defensive rejection.
  2. T2_F26_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Out-of-Band (OAST) Integration.
  3. T2_F26_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Out-of-Band (OAST) Integration; verify clean error propagation.
  4. T2_F26_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Out-of-Band (OAST) Integration.
  5. T2_F26_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Out-of-Band (OAST) Integration.

---

### Feature 27: Headless Browser Integration (ucma-browser)
- **Description**: DOM telemetry capture and client-rendered sink observation
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F27_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Headless Browser Integration (ucma-browser).
  2. T1_F27_02_ContractFidelity: Verify interface contract types and schema fidelity for Headless Browser Integration.
  3. T1_F27_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Headless Browser Integration.
  4. T1_F27_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Headless Browser Integration.
  5. T1_F27_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Headless Browser Integration.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F27_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Headless Browser Integration; verify defensive rejection.
  2. T2_F27_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Headless Browser Integration.
  3. T2_F27_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Headless Browser Integration; verify clean error propagation.
  4. T2_F27_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Headless Browser Integration.
  5. T2_F27_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Headless Browser Integration.

---

### Feature 28: Read-Only Database Explorer (ucma-explorer, ucma-db)
- **Description**: Non-destructive schema discovery (information_schema)
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F28_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Read-Only Database Explorer (ucma-explorer, ucma-db).
  2. T1_F28_02_ContractFidelity: Verify interface contract types and schema fidelity for Read-Only Database Explorer.
  3. T1_F28_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Read-Only Database Explorer.
  4. T1_F28_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Read-Only Database Explorer.
  5. T1_F28_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Read-Only Database Explorer.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F28_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Read-Only Database Explorer; verify defensive rejection.
  2. T2_F28_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Read-Only Database Explorer.
  3. T2_F28_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Read-Only Database Explorer; verify clean error propagation.
  4. T2_F28_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Read-Only Database Explorer.
  5. T2_F28_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Read-Only Database Explorer.

---

### Feature 29: BLAKE3 CAS Merkle Proof Trees (ucma-evidence)
- **Description**: Cryptographic tamper-evident .cas-proof evidence packaging
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F29_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for BLAKE3 CAS Merkle Proof Trees (ucma-evidence).
  2. T1_F29_02_ContractFidelity: Verify interface contract types and schema fidelity for BLAKE3 CAS Merkle Proof Trees.
  3. T1_F29_03_DeterministicExecution: Verify deterministic execution and state reproducibility for BLAKE3 CAS Merkle Proof Trees.
  4. T1_F29_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for BLAKE3 CAS Merkle Proof Trees.
  5. T1_F29_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for BLAKE3 CAS Merkle Proof Trees.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F29_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against BLAKE3 CAS Merkle Proof Trees; verify defensive rejection.
  2. T2_F29_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against BLAKE3 CAS Merkle Proof Trees.
  3. T2_F29_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against BLAKE3 CAS Merkle Proof Trees; verify clean error propagation.
  4. T2_F29_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against BLAKE3 CAS Merkle Proof Trees.
  5. T2_F29_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for BLAKE3 CAS Merkle Proof Trees.

---

### Feature 30: Provenance Attestation Engine (ucma-provenance)
- **Description**: Cryptographic audit trail linking request to finding
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F30_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Provenance Attestation Engine (ucma-provenance).
  2. T1_F30_02_ContractFidelity: Verify interface contract types and schema fidelity for Provenance Attestation Engine.
  3. T1_F30_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Provenance Attestation Engine.
  4. T1_F30_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Provenance Attestation Engine.
  5. T1_F30_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Provenance Attestation Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F30_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Provenance Attestation Engine; verify defensive rejection.
  2. T2_F30_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Provenance Attestation Engine.
  3. T2_F30_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Provenance Attestation Engine; verify clean error propagation.
  4. T2_F30_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Provenance Attestation Engine.
  5. T2_F30_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Provenance Attestation Engine.

---

### Feature 31: Multi-Format Reporting (ucma-report)
- **Description**: JSON, Markdown, SARIF, and CAS Merkle proof exporter
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F31_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Multi-Format Reporting (ucma-report).
  2. T1_F31_02_ContractFidelity: Verify interface contract types and schema fidelity for Multi-Format Reporting.
  3. T1_F31_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Multi-Format Reporting.
  4. T1_F31_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Multi-Format Reporting.
  5. T1_F31_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Multi-Format Reporting.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F31_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Multi-Format Reporting; verify defensive rejection.
  2. T2_F31_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Multi-Format Reporting.
  3. T2_F31_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Multi-Format Reporting; verify clean error propagation.
  4. T2_F31_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Multi-Format Reporting.
  5. T2_F31_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Multi-Format Reporting.

---

### Feature 32: Adversarial Fuzzing Engine (ucma-fuzz)
- **Description**: Mutator engine for differential crash and edge-case testing
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F32_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for Adversarial Fuzzing Engine (ucma-fuzz).
  2. T1_F32_02_ContractFidelity: Verify interface contract types and schema fidelity for Adversarial Fuzzing Engine.
  3. T1_F32_03_DeterministicExecution: Verify deterministic execution and state reproducibility for Adversarial Fuzzing Engine.
  4. T1_F32_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for Adversarial Fuzzing Engine.
  5. T1_F32_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for Adversarial Fuzzing Engine.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F32_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against Adversarial Fuzzing Engine; verify defensive rejection.
  2. T2_F32_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against Adversarial Fuzzing Engine.
  3. T2_F32_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against Adversarial Fuzzing Engine; verify clean error propagation.
  4. T2_F32_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against Adversarial Fuzzing Engine.
  5. T2_F32_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for Adversarial Fuzzing Engine.

---

### Feature 33: 50+ Hard-Positive Benchmark Corpus (ucma-bench)
- **Description**: Seeded real-world vulnerable fixtures across all dialects
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F33_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for 50+ Hard-Positive Benchmark Corpus (ucma-bench).
  2. T1_F33_02_ContractFidelity: Verify interface contract types and schema fidelity for 50+ Hard-Positive Benchmark Corpus.
  3. T1_F33_03_DeterministicExecution: Verify deterministic execution and state reproducibility for 50+ Hard-Positive Benchmark Corpus.
  4. T1_F33_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for 50+ Hard-Positive Benchmark Corpus.
  5. T1_F33_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for 50+ Hard-Positive Benchmark Corpus.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F33_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against 50+ Hard-Positive Benchmark Corpus; verify defensive rejection.
  2. T2_F33_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against 50+ Hard-Positive Benchmark Corpus.
  3. T2_F33_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against 50+ Hard-Positive Benchmark Corpus; verify clean error propagation.
  4. T2_F33_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against 50+ Hard-Positive Benchmark Corpus.
  5. T2_F33_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for 50+ Hard-Positive Benchmark Corpus.

---

### Feature 34: 50+ Hard-Negative Benchmark Corpus (ucma-bench)
- **Description**: High-entropy dynamic web fixtures yielding 0 false positives
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F34_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for 50+ Hard-Negative Benchmark Corpus (ucma-bench).
  2. T1_F34_02_ContractFidelity: Verify interface contract types and schema fidelity for 50+ Hard-Negative Benchmark Corpus.
  3. T1_F34_03_DeterministicExecution: Verify deterministic execution and state reproducibility for 50+ Hard-Negative Benchmark Corpus.
  4. T1_F34_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for 50+ Hard-Negative Benchmark Corpus.
  5. T1_F34_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for 50+ Hard-Negative Benchmark Corpus.
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F34_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against 50+ Hard-Negative Benchmark Corpus; verify defensive rejection.
  2. T2_F34_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against 50+ Hard-Negative Benchmark Corpus.
  3. T2_F34_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against 50+ Hard-Negative Benchmark Corpus; verify clean error propagation.
  4. T2_F34_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against 50+ Hard-Negative Benchmark Corpus.
  5. T2_F34_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for 50+ Hard-Negative Benchmark Corpus.

---

### Feature 35: E2E Test Suite (100% Pass) (tests/e2e)
- **Description**: 100% test pass across Tiers 1-4 and Tier 5 adversarial hardening
- **Tier 1 Test Cases (Functional Coverage)**:
  1. T1_F35_01_PrimaryHappyPath: Verify standard operational baseline and core workflow for E2E Test Suite (100% Pass) (tests/e2e).
  2. T1_F35_02_ContractFidelity: Verify interface contract types and schema fidelity for E2E Test Suite (100% Pass).
  3. T1_F35_03_DeterministicExecution: Verify deterministic execution and state reproducibility for E2E Test Suite (100% Pass).
  4. T1_F35_04_LifecycleTransition: Verify state transitions, lifecycle hooks, and resource initialization for E2E Test Suite (100% Pass).
  5. T1_F35_05_OutputIntegrity: Verify structured output validation, serialization roundtrips, and hash integrity for E2E Test Suite (100% Pass).
- **Tier 2 Boundary/Corner Test Cases (Defensive Edge Cases)**:
  1. T2_F35_01_ZeroAndEmptyBoundary: Test empty, zero-length, or missing inputs against E2E Test Suite (100% Pass); verify defensive rejection.
  2. T2_F35_02_ExtremeSizeAndOverflowStress: Test extreme payload/buffer sizes (e.g. 10MB+) and resource limits against E2E Test Suite (100% Pass).
  3. T2_F35_03_MalformedEncodingRecovery: Test invalid UTF-8, malformed syntax, and corrupted tokens against E2E Test Suite (100% Pass); verify clean error propagation.
  4. T2_F35_04_TimeoutAndCancellationDefensiveness: Test latency timeouts, abrupt terminations, and cancellation tokens against E2E Test Suite (100% Pass).
  5. T2_F35_05_ConcurrencyAndRaceSafety: Test multi-threaded concurrent access (32+ workers) and thread-safety invariants for E2E Test Suite (100% Pass).

---

## 4. Tier 3: Pairwise Subsystem Integration Matrix

| Subsystem Pair | Interface Contract Under Test | Test Scenario | Expected Outcome |
|---|---|---|---|
| **Scope <-> HTTP** | ScopePolicy::evaluate -> AuthorizedRequest -> SafeHttpClient::send | Mint valid AuthorizedRequest; dispatch via SafeHttpClient | Successful dispatch with verified socket IP pinning |
| **Scope <-> HTTP (Denial)** | ScopePolicy::evaluate returns ScopeViolation | Attempt dispatch without AuthorizedRequest | Type system compilation block or runtime fail-closed denial |
| **HTTP <-> Core** | SafeHttpClient -> ResponseSnapshot -> InMemoryEvidenceStore | Dispatch request, capture raw bytes, compute BLAKE3 hash, store in evidence store | Snapshot retrievable by BLAKE3 ContentId |
| **Parameter <-> SQL IR** | ParameterExtractor -> ParameterValue -> SqlSemanticIr | Extract JSON string param; convert into SQL IR node | Correct dialect-neutral IR expression representation |
| **SQL IR <-> Dialect / AST** | SqlSemanticIr::to_ast(Dialect) -> SqlAst::render(Dialect) | Convert IR to PostgreSQL vs MySQL AST; render SQL string | Correct dialect-specific keywords, quoting, and syntax |
| **AST <-> Grammar Synthesis** | SqlAst::inject_boundary() -> GrammarGenerator | Inject boundary into AST; generate mutator productions | Syntactically valid mutated SQL query string |
| **Oracles <-> Causal SCM** | DifferentialOracle + CausalScm::intervene | Observe response change; verify causal model disentangles reflection | Discard reflection-only changes; confirm true SQL syntax changes |
| **Oracles <-> Wald SPRT** | TimingOracle + WaldSprtEngine::evaluate | Feed sequential micro-delay observations (tau=300ms) | SPRT converges to H1 with likelihood ratio crossing boundary |
| **Planner <-> Oracles** | BayesianPlanner::next_probe -> Oracle::evaluate | Planner selects next-best-test; oracle evaluates; belief state updates | Optimal information gain within 18 request budget |
| **Evidence <-> Provenance** | EvidenceVault::seal -> MerkleCasProofTree -> ProvenanceChain | Seal findings into Merkle CAS proof tree; generate signed provenance chain | MerkleCasProofTree::verify() == true and valid provenance |
| **Provenance <-> Reporting** | ProvenanceChain -> ReportExporter::export_sarif | Export finding with provenance to SARIF and JSON | SARIF document passes schema validator with valid Merkle hash |

## 5. Tier 4: Real-World Complex E2E Scenarios

### Scenario 1: Multi-Stage Authenticated SQL Injection Audit
1. **Setup**: Target web application requires login, session cookie tracking, and CSRF token handling.
2. **Execution**:
   - ucma-session logs in and stores session cookies and CSRF tokens.
   - ucma-scope validates target domain and pins resolved IP.
   - ucma-parameter extracts parameter from authenticated order search endpoint.
   - ucma-planner executes Bayesian probe sequence.
   - ucma-oracles fuse Differential and Causal evidence.
   - ucma-evidence generates BLAKE3 Merkle CAS proof tree.
   - ucma-report generates final SARIF and Markdown reports.
3. **Verification**: Finding promoted to Promoted with 100% verified Merkle proof; zero leakage of session secrets in report.

### Scenario 2: Blind Micro-Timing Injection Under High Network Jitter
1. **Setup**: Target executes pg_sleep(0.3) on boolean true, but network has Gaussian jitter (mean=80ms, std=35ms).
2. **Execution**:
   - ucma-timing runs Wald SPRT sequential hypothesis testing.
   - Dynamically tracks baseline drift.
   - Accepts H1 in 7 samples with confidence > 99%.
3. **Verification**: 0 false negatives, 0 false alarms on control tests.

### Scenario 3: Asynchronous Out-of-Band (OAST) Blind Injection
1. **Setup**: Target processes SQL query in background worker thread 5 seconds after HTTP response.
2. **Execution**:
   - ucma-oast mints stateless AES-256 token and injects DNS exfiltration payload.
   - Background worker executes query and triggers DNS query to listener.
   - Listener decrypts token and attributes callback to original request ID.
3. **Verification**: Finding promoted with paired HTTP request snapshot and DNS callback evidence.

## 6. Tier 5: Adversarial Hardening, Chaos & Fuzzing

1. **DNS Rebinding TOCTOU Attack**: DNS server returns public IP on pre-flight and private IP on wire connect; verified socket pinning prevents bypass.
2. **Unicode Normalization Collision**: Target normalizes %EF%BC%8F (Fullwidth Solidus) to /; verified scope engine canonicalizes before matching.
3. **Hostile Large Response Bomb**: Target returns 1GB stream of repeating zeroes; verified body size limiter truncates at 10MB without OOM.
4. **Slowloris Timeout Interruption**: Target holds HTTP socket open indefinitely; verified read timeout aborts connection in 2000ms.
5. **Merkle Proof Bit Tampering**: 1 bit in 64KB evidence snapshot flipped; verified Merkle proof verification fails deterministically.

## 7. Test Execution Commands & Verification Protocol

### Running the Complete Test Suite
`powershell
# Run all workspace unit and integration tests
cargo test --workspace --locked

# Run specific E2E test harness suites
cargo test --test e2e_foundation -- --nocapture
cargo test --test e2e_scope_ssrf -- --nocapture
cargo test --test e2e_token_enforcement -- --nocapture
cargo test --test e2e_redirect_validation -- --nocapture
cargo test --test e2e_blake3_evidence -- --nocapture

# Run clippy quality gate
cargo clippy --workspace --all-targets -- -D warnings

# Run formatting check
cargo fmt --check
`
