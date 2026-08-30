# UCMA-X Next Engineering Plan

This engineering roadmap defines the systematic priorities to strengthen the hybrid architecture following successful empirical validation.

---

### Priority 1: Remove Duplicated Security Logic
- **Current Limitation**: Regex error signatures and dialect syntax queries are defined in both TypeScript (`ErrorTester.ts`, `DatabaseAdapters.ts`) and Rust (`ucma-oracles`, `ucma-dialect`).
- **Plan**: Generate shared JSON dialect and error catalogs at compile time so both TypeScript and Rust read from a single authoritative source of truth.
- **Measurement**: 0 divergence between Rust and TypeScript pattern matchers.
- **Regression Risk**: Syntax mismatch during schema parsing; mitigated by automated cross-engine unit tests.

---

### Priority 2: Strengthen Rust/TypeScript IPC Interfaces
- **Current Limitation**: Only two UCMA commands (`cmd_ucmax_analyze_boolean`, `cmd_ucmax_plan_next_step`) are exposed over Tauri IPC.
- **Plan**: Expose `cmd_ucmax_analyze_timing_sprt`, `cmd_ucmax_evaluate_metamorphic_tlp`, and `cmd_ucmax_extract_ast_context` through typed Tauri invoke bindings.
- **Measurement**: Benchmark execution time and IPC message serialization overhead.

---

### Priority 3: Activate Currently-Unused UCMA Components
- **Current Limitation**: `ucma-sql-ir` and `ucma-ast` AST mutations are verified in test harnesses but the TypeScript orchestrator uses template replacement for standard probes.
- **Plan**: Route advanced syntax mutation generation through the Rust AST engine for complex nested subqueries.
- **Measurement**: Increased evasion rate against strict SQL grammar parsers and WAFs.

---

### Priority 4: Complete Missing Protocol Adapters
- **Current Limitation**: GraphQL and gRPC serialization crates (`ucma-graphql`, `ucma-grpc`) are scaffolded.
- **Plan**: Implement wire-level JSON/protobuf mutators for GraphQL query variables and gRPC frames.
- **Measurement**: 100% detection on GraphQL injection test suites.

---

### Priority 5: Improve Database Explorer Completeness
- **Current Limitation**: Relationship graphs (foreign keys) are inferred rather than explicitly queried.
- **Plan**: Add dialect queries for `information_schema.table_constraints` and `pg_constraint` to populate foreign key arrows in the Database Explorer UI.
- **Measurement**: Accurate relational ER diagrams rendered in GUI.

---

### Priority 6: Improve Evidence Provenance
- **Current Limitation**: CAS hashes are stored locally in the session.
- **Plan**: Export signed SARIF / BLAKE3 cryptographic attestation bundles directly from the UI.
- **Measurement**: Third-party verification of evidence chain without running the scanner.

---

### Priority 7: Harden Security Boundaries
- **Current Limitation**: Rate limit throttling is managed in TypeScript memory.
- **Plan**: Move token-bucket rate limiting into `ucma-http` in Rust for microsecond-precise request pacing.
- **Measurement**: Zero dropped packets and 100% compliance with target request rate limits.
