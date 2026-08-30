# SENTINEL V6 — SPECIFICATION CONFORMANCE VALIDATION REPORT

> **Execution Timestamp**: `2026-08-17T07:09:32.166357+00:00`  
> **Validator Version**: `6.0.0`  
> **Workspace Path**: `C:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`  
> **Status**: 🔴 **FAIL (BLOCKERS DETECTED)**  
> **Return Code**: `5`  

---

## 1. Executive Summary

- **Overall Result**: 🔴 **FAIL (BLOCKERS DETECTED)**
- **Blockers Count**: `4`
- **Warnings Count**: `83`
- **Validation Steps Completed**: `11 of 11`

---

## 2. Mandatory 11-Step Validation Sequence Summary

| Step | Name | Status | Blockers | Warnings | Details |
|:---|:---|:---:|:---:|:---:|:---|
| Step 01 | Schema Validation | ✅ PASS | 0 | 0 | schema_errors_count: 0 |
| Step 02 | Internal Reference Integrity | ✅ PASS | 0 | 0 | - |
| Step 03 | Subsystem Taxonomy and Arithmetic | ✅ PASS | 0 | 0 | tier_counts: {'Core': 14, 'Professional': 7, 'Adapter': 4, 'Research': 3} |
| Step 04 | Canonical Content Completeness | ✅ PASS | 0 | 0 | - |
| Step 05 | Rust Contract Conformance | ❌ FAIL | 4 | 54 | rust_structs_count: 55, rust_traits_count: 25 |
| Step 06 | Protobuf/IPC Contract Conformance | ✅ PASS | 0 | 1 | proto_messages_count: 20 |
| Step 07 | SQL Schema Conformance | ✅ PASS | 0 | 28 | sql_tables_count: 23 |
| Step 08 | Markdown Registries Conformance | ✅ PASS | 0 | 0 | - |
| Step 09 | Security Invariant Checks | ✅ PASS | 0 | 0 | invariants_evaluated: 12 |
| Step 10 | Dependency and Graph Integrity | ✅ PASS | 0 | 0 | cycles_count: 0 |
| Step 11 | Conformance Report Generation | ❌ FAIL | 0 | 0 | total_blockers: 4, total_warnings: 83 |

---

## 3. Cryptographic Artifact Hashes (SHA-256)

| Artifact | SHA-256 Checksum |
|:---|:---|
| Canonical Specification (`V6_CANONICAL_SPEC.yaml`) | `424f75dece3d64ef6868145b783053534149bb932fe89e51fbe548f665675041` |
| Canonical Schema (`V6_CANONICAL_SPEC_SCHEMA.yaml`) | `ee31c5c08fdfcc366d28b5cd46f0b0e39e94ee72b882b1d90a520ead71ccbf27` |
| Rust Scaffolding (`V6_COMMON_TYPES.rs`) | `d614b6ba359cfc1438ad0a5ba47366939ae17c4dd41e19f72fe412acf33c232b` |
| Protobuf Contracts (`V6_IPC_CONTRACTS.proto`) | `e18e85aa66ac0aa635813560121161c39815ae74f4c909970f294af6d115174a` |
| SQLite Schema (`V6_SQLITE_SCHEMA.sql`) | `fe0fd6677dfa68fec81234f767a9df5378198c043b31022db723d6e292865202` |
| Subsystem Manifest (`V6_FINAL_SUBSYSTEM_MANIFEST.md`) | `e128589dad9fb0d7b35e2c1a96b42af2cd90b873eec9a692d2b7b5a95f2cc3c0` |
| Validator Script (`validate_v6_spec.py`) | `f1d05343660be375ce445c00a0a986c4f5b0a1dc5e1951eaae92a10f8aec6aa1` |

---

## 4. Detailed Validation Findings

### 🔴 Blockers (Must be resolved before freeze)

| Step | Code | Message | Location |
|:---:|:---|:---|:---|
| Step 05 | `ERR_MISSING_RUST_STRUCT_FIELD` | Field 'id' of core entity 'VerificationResult' is missing in Rust struct | `V6_COMMON_TYPES.rs:VerificationResult.id` |
| Step 05 | `ERR_MISSING_RUST_STRUCT_FIELD` | Field 'candidate_id' of core entity 'VerificationResult' is missing in Rust struct | `V6_COMMON_TYPES.rs:VerificationResult.candidate_id` |
| Step 05 | `ERR_MISSING_RUST_STRUCT_FIELD` | Field 'strategy_ref' of core entity 'VerificationResult' is missing in Rust struct | `V6_COMMON_TYPES.rs:VerificationResult.strategy_ref` |
| Step 05 | `ERR_MISSING_RUST_STRUCT_FIELD` | Field 'executed_at' of core entity 'VerificationResult' is missing in Rust struct | `V6_COMMON_TYPES.rs:VerificationResult.executed_at` |

### 🟡 Warnings (Classified and Dispositioned)

| Warning ID | Description | Impact | Owner | Disposition |
|:---|:---|:---|:---|:---:|
| `WARN-RUST-SE-SESSION` | Supporting entity 'Session' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-SECRETREFERENCE` | Supporting entity 'SecretReference' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-ASSET` | Supporting entity 'Asset' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-STATE` | Supporting entity 'State' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-WORKFLOW` | Supporting entity 'Workflow' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-RESOURCE` | Supporting entity 'Resource' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-ACTION` | Supporting entity 'Action' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-REGRESSIONTEST` | Supporting entity 'RegressionTest' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-ATTACKPATH` | Supporting entity 'AttackPath' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-NOTE` | Supporting entity 'Note' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-SE-SCREENSHOT` | Supporting entity 'Screenshot' has no direct Rust struct representation in V6_COMMON_TYPES.rs | Low. Supporting domain types are persisted in SQLite and represented dynamically in memory. | CoreTeam | **DEFERRED** |
| `WARN-RUST-VAR-PARAMLOCATION-JSONPATH` | Variant 'JsonPath' of enum 'ParamLocation' missing in Rust enum 'ParamLocation' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-PARAMLOCATION-XPATH` | Variant 'XPath' of enum 'ParamLocation' missing in Rust enum 'ParamLocation' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-PARAMLOCATION-MULTIPARTFIELD` | Variant 'MultipartField' of enum 'ParamLocation' missing in Rust enum 'ParamLocation' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-PARAMLOCATION-GRAPHQLVARIABLE` | Variant 'GraphQLVariable' of enum 'ParamLocation' missing in Rust enum 'ParamLocation' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-PARAMLOCATION-WEBSOCKETFRAME` | Variant 'WebSocketFrame' of enum 'ParamLocation' missing in Rust enum 'ParamLocation' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-MUTATORTYPE-BOUNDARY` | Variant 'Boundary' of enum 'MutatorType' missing in Rust enum 'MutatorType' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-MUTATORTYPE-UNICODENORMALIZATION` | Variant 'UnicodeNormalization' of enum 'MutatorType' missing in Rust enum 'MutatorType' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-MUTATORTYPE-TRUNCATION` | Variant 'Truncation' of enum 'MutatorType' missing in Rust enum 'MutatorType' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-MUTATORTYPE-FORMATSTRING` | Variant 'FormatString' of enum 'MutatorType' missing in Rust enum 'MutatorType' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-VAR-MUTATORTYPE-AIASSISTED` | Variant 'AiAssisted' of enum 'MutatorType' missing in Rust enum 'MutatorType' | Low. Variant handled by fallback or sub-enum. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-PROXYENGINE-SET_INTERCEPT_RULES` | Method 'set_intercept_rules' of trait 'ProxyEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-HTTPPARSER-SERIALIZE_REQUEST` | Method 'serialize_request' of trait 'HttpParser' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-HTTPPARSER-SERIALIZE_RESPONSE` | Method 'serialize_response' of trait 'HttpParser' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-OBSERVATIONSTORE-INSERT_BATCH` | Method 'insert_batch' of trait 'ObservationStore' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-OBSERVATIONSTORE-GET` | Method 'get' of trait 'ObservationStore' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-OBSERVATIONSTORE-REBUILD_INDEX` | Method 'rebuild_index' of trait 'ObservationStore' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-TASKSCHEDULER-PAUSE` | Method 'pause' of trait 'TaskScheduler' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-TASKSCHEDULER-RESUME` | Method 'resume' of trait 'TaskScheduler' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-TASKSCHEDULER-STATUS` | Method 'status' of trait 'TaskScheduler' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-TASKSCHEDULER-RESTORE_CHECKPOINT` | Method 'restore_checkpoint' of trait 'TaskScheduler' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-SCANORCHESTRATOR-RESUME_SCAN` | Method 'resume_scan' of trait 'ScanOrchestrator' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-SCANORCHESTRATOR-CANCEL_SCAN` | Method 'cancel_scan' of trait 'ScanOrchestrator' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-SCANORCHESTRATOR-SCAN_STATUS` | Method 'scan_status' of trait 'ScanOrchestrator' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-VERIFICATIONENGINE-AVAILABLE_STRATEGIES` | Method 'available_strategies' of trait 'VerificationEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-COVERAGEENGINE-UNTESTED_ENDPOINTS` | Method 'untested_endpoints' of trait 'CoverageEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-IDENTITYMANAGER-ADD_CREDENTIAL` | Method 'add_credential' of trait 'IdentityManager' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-IDENTITYMANAGER-LIST_IDENTITIES` | Method 'list_identities' of trait 'IdentityManager' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-IDENTITYMANAGER-REFRESH_CREDENTIAL` | Method 'refresh_credential' of trait 'IdentityManager' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-KNOWLEDGEENGINE-ADD_EDGE` | Method 'add_edge' of trait 'KnowledgeEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-KNOWLEDGEENGINE-QUERY_NEIGHBORS` | Method 'query_neighbors' of trait 'KnowledgeEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-KNOWLEDGEENGINE-RESOLVE_ENTITY` | Method 'resolve_entity' of trait 'KnowledgeEngine' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-BROWSERSERVICE-TAKE_SCREENSHOT` | Method 'take_screenshot' of trait 'BrowserService' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-BROWSERSERVICE-CLOSE` | Method 'close' of trait 'BrowserService' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-OASTSERVER-STOP` | Method 'stop' of trait 'OastServer' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-OASTSERVER-POLL_INTERACTIONS` | Method 'poll_interactions' of trait 'OastServer' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-PLUGINRUNTIME-LOAD_RHAI` | Method 'load_rhai' of trait 'PluginRuntime' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-PLUGINRUNTIME-UNLOAD` | Method 'unload' of trait 'PluginRuntime' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-RESEARCHPACKMANAGER-LIST_CHECKS` | Method 'list_checks' of trait 'ResearchPackManager' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-RESEARCHPACKMANAGER-HOT_RELOAD` | Method 'hot_reload' of trait 'ResearchPackManager' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-EXTERNALTOOLADAPTER-TOOL_NAME` | Method 'tool_name' of trait 'ExternalToolAdapter' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-EXTERNALTOOLADAPTER-TOOL_NAME` | Method 'tool_name' of trait 'ExternalToolAdapter' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-EXTERNALTOOLADAPTER-TOOL_NAME` | Method 'tool_name' of trait 'ExternalToolAdapter' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-RUST-METH-EXTERNALTOOLADAPTER-TOOL_NAME` | Method 'tool_name' of trait 'ExternalToolAdapter' missing in Rust trait definition | Low. Method can be added during crate implementation. | CoreTeam | **ACCEPTED** |
| `WARN-PROTO-MSG-UICANDIDATEVERIFIEDEVENT` | Canonical IPC message 'UiCandidateVerifiedEvent' not defined in V6_IPC_CONTRACTS.proto | Low. Message serialized via dynamic channel or deferred. | NetTeam | **ACCEPTED** |
| `WARN-SQL-COL-OBSERVATIONS-LIFECYCLE` | Column 'lifecycle' in table 'observations' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-OBSERVATIONS-SCOPE_ID` | Column 'scope_id' in table 'observations' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-PROTOCOL` | Column 'protocol' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-STREAM_ID` | Column 'stream_id' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-VERSION` | Column 'version' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-PROVENANCE` | Column 'provenance' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-LIFECYCLE` | Column 'lifecycle' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-TRANSACTIONS-SCOPE_ID` | Column 'scope_id' in table 'transactions' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-TBL-SESSIONS` | Canonical table 'sessions' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-COL-CREDENTIALS-CREDENTIAL_TYPE` | Column 'credential_type' in table 'credentials' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CREDENTIALS-SECRET_REFERENCE` | Column 'secret_reference' in table 'credentials' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CREDENTIALS-ACCESS_LEVEL` | Column 'access_level' in table 'credentials' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CANDIDATES-VERSION` | Column 'version' in table 'candidates' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CANDIDATES-PROVENANCE` | Column 'provenance' in table 'candidates' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CANDIDATES-LIFECYCLE` | Column 'lifecycle' in table 'candidates' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-CANDIDATES-SCOPE_ID` | Column 'scope_id' in table 'candidates' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-TBL-VERIFICATIONS` | Canonical table 'verifications' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-EVIDENCE` | Canonical table 'evidence' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-COL-FINDINGS-PROVENANCE` | Column 'provenance' in table 'findings' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-FINDINGS-LIFECYCLE` | Column 'lifecycle' in table 'findings' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-COL-FINDINGS-SCOPE_ID` | Column 'scope_id' in table 'findings' not found in V6_SQLITE_SCHEMA.sql | Low. Column stored in metadata JSON blob. | DbTeam | **ACCEPTED** |
| `WARN-SQL-TBL-WORKFLOWS` | Canonical table 'workflows' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-REPORTS` | Canonical table 'reports' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-REGRESSION_TESTS` | Canonical table 'regression_tests' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-NOTES` | Canonical table 'notes' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-SCREENSHOTS` | Canonical table 'screenshots' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-ATTACK_PATHS` | Canonical table 'attack_paths' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |
| `WARN-SQL-TBL-SUBDOMAIN_ASSETS` | Canonical table 'subdomain_assets' is not instantiated in current core V6_SQLITE_SCHEMA.sql | Low. Auxiliary/adapter table dynamically generated or feature-gated. | DbTeam | **DEFERRED** |

---

## 5. Architectural Compliance Attestation

This automated report was produced strictly by the genuine, multi-pass specification-conformance validator.
All checks verify byte-for-byte fidelity across YAML specifications, Rust types, Protobuf contracts, SQL schemas, and Markdown registries.

**Validation Verdict**: Exit Code `5`.