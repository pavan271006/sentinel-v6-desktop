## 2026-08-23T04:56:19Z

Implement Phase 2 (Milestone 4): Real Subsystem Capabilities across Subsystems A, B, C, D:
1. Subsystem A (Productivity Codecs & HashEngine in `sentinel_productivity`):
   - Native encoders/decoders: Base64 (Standard/URLSafe/Unpadded), URL Percent Encoding (Query/Path/All/Double-Encode), Hex (Upper/Lower/Delimited/HexDump), HTML Entities (Named/Dec/Hex), JWT Engine (inspect, verify HS/RS/ES/None, tamper), Gzip (compression/decompression with decompression bomb protection).
   - `HashEngine` supporting SHA-1, SHA-256, SHA-512, MD5, Keccak-256, and constant-time HMAC verification.
   - Comprehensive unit test suite in `crates/sentinel_productivity/tests/codec_tests.rs`.
2. Subsystem B (Protocols & APIs in `sentinel_api`, `sentinel_parser`, `sentinel_proxy`):
   - `sentinel_api::openapi`: OpenAPI 3.1 & JSON Schema 2020-12 `$ref` pointer resolution (`JsonPointerResolver` with recursion/cycle guards), route/parameter template extraction, and spec-driven vulnerability fuzz generator.
   - `sentinel_api::grpc`: gRPC reflection v1 stream decoder, `prost-reflect` `DescriptorPool` resolution, `DynamicMessage` JSON <-> Protobuf transcoding, 5-byte wire framing, and varint 64-bit overflow fuzzing.
   - `sentinel_api::graphql`: AST-based parser, recursive complexity scoring with list multipliers, schema cycle detection, and array/alias DoS batching generator.
   - `sentinel_parser::h3`: RFC 9114 HTTP/3 frames, RFC 9000 QUIC Varint codecs (1, 2, 4, 8 bytes), and QPACK decompression.
   - Add unit tests in `crates/sentinel_api/tests/api_tests.rs` and `crates/sentinel_parser/tests/h3_tests.rs`.
3. Subsystem C (AuthZ & Plugins in `sentinel_authz` and `sentinel_plugin`):
   - `sentinel_authz`: Multi-role IRA+ authorization matrix (Admin, User, Attacker, Guest), AST-based IDOR parameter substitution (Path, Query, JSON body, Header), Shannon entropy volatile token masking ($H(X) >= 3.8$), and BFLA privilege divergence oracles.
   - `sentinel_plugin`: Wasmtime WIT zero-capability runtime (SEC-04), fuel metering ($10^8$ instructions), physical memory bounding (<50MB per instance), and Ed25519 KRL signature verification.
   - Add unit tests in `crates/sentinel_authz/tests/authz_tests.rs` and `crates/sentinel_plugin/tests/plugin_tests.rs`.
4. Subsystem D (Search & CLI in `sentinel_cli` and `sentinel_storage`):
   - `sentinel_cli`: Clap v4 CLI command taxonomy (`project`, `scan`, `replay`, `scope`, `report`, `verify`, `export`) and enforce strict security domain exit codes (0 = Clean, 1 = VulnerabilitiesFound, 2 = OperationalError).
   - `sentinel_storage::search`: Tantivy BM25 full-text indexing engine with schema (`tx_id`, `req_method`, `req_uri`, `req_body`, `res_status`, `res_body`), inverted index search, and auto-rebuild from SQLite WAL.
   - Add unit tests in `crates/sentinel_cli/tests/cli_tests.rs` and `crates/sentinel_storage/tests/search_tests.rs`.
5. Continuous Regression Check:
   - Verify `cargo test --workspace --locked` passes 100%.
   - Verify `cargo check --manifest-path src-tauri/Cargo.toml` passes cleanly.
   - Verify `python architecture/v6/validate_v6_spec.py` passes 11/11 checks (0 blockers).
