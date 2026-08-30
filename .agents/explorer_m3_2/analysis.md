# SENTINEL V6: Milestone M3 Security Testing Engines Assessment
**Domains 5 through 8: HTTP/Protocol, Discovery, Fuzzing/Races, Crawling/Recon**

- **Date**: 2026-08-19
- **Author**: Explorer M3-2 (`explorer_m3_2`)
- **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_2`
- **Scope**: Security Engine Domains 5, 6, 7, 8 (Backend Crates in `sentinel_core/crates/*`, Tests in `sentinel_core/tests/`, Frontend in `src/`)

---

## Executive Summary

This report delivers a systematic architectural audit and gap analysis across **Domains 5 to 8** of the SENTINEL V6 security engine suite:
1. **Domain 5: HTTP / Protocol Security Engine** (Request Smuggling, Desync, Parser Differentials, Web Cache Poisoning & Deception)
2. **Domain 6: Parameter & Surface Discovery Engine** (Param Miner Logarithmic Bisection, Header Discovery, Cookie Security, Type Inference, Route Extraction)
3. **Domain 7: Advanced Fuzzing & Race Conditions Engine** (Mutation Fuzzing, Grammar/AST Fuzzing, Type-Aware Fuzzing, Single-Packet HTTP/2 & Last-Byte Sync Races)
4. **Domain 8: Crawling & Reconnaissance Engine** (Scope-Bound Katana Headless Crawler, JS Route Extraction, JARM/Favicon Tech Fingerprinting, Port/Asset Probing)

The audit confirms strong foundations in passive parser anomaly detection, basic mutators, barrier-based thread concurrency, and single-page browser DOM extraction. However, significant engineering gaps exist in **active multi-stage verification harnesses**, **logarithmic bisection search**, **network-level packet synchronization**, and **autonomous recursive crawling pipelines**.

---

## 1. Domain 5: HTTP / Protocol Security Engine

### 1.1 Architecture & Existing Implementation
The HTTP/Protocol security engine is primarily housed in `sentinel_core/crates/sentinel_parser` and integrated with `sentinel_core/crates/sentinel_proxy` and `sentinel_core/crates/sentinel_scanner`.

#### Key Existing Files & Structs
- `sentinel_core/crates/sentinel_parser/src/smuggling.rs`:
  - `SmugglingIndicator` enum: Defines 12 protocol anomaly types (`DualFramingClTe`, `DualFramingTeCl`, `DuplicateContentLength`, `DuplicateTransferEncoding`, `ObfuscatedTransferEncoding`, `SpaceBeforeColon`, `ObsoleteLineFolding`, `InvalidChunkHex`, `PrematureEndOfStream`, `H2NewlineInHeader`, `H2DuplicatePseudoHeader`, `H2UppercaseHeader`).
  - `analyze_headers(headers: &[RawHeader], obs_fold_detected: bool, body_len: usize) -> Vec<ParseWarning>`: Evaluates Content-Length vs Transfer-Encoding ordering, duplicate CL/TE headers, comma-separated CL values, obfuscated TE (`xchunked`), header whitespace, and obsolete line folding.
  - `analyze_h2_headers(headers: &[(Vec<u8>, Vec<u8>)]) -> Vec<ParseWarning>`: Detects uppercase header names (RFC 7540 §8.1.2), CRLF injection in H2 header values, and duplicate pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`).
- `sentinel_core/crates/sentinel_parser/src/chunked.rs`:
  - `ChunkedDecoder`: Decodes HTTP/1.1 chunked streams, verifies hex chunk sizes, handles chunk extensions, and flags invalid chunk formatting.
- `sentinel_core/crates/sentinel_parser/src/h2.rs`:
  - `H2FrameHeader`, `H2Frame`, `HpackDecoder`: Full binary framing and HPACK compression decoder for HTTP/2 frames.
- `sentinel_core/crates/sentinel_repeater/src/executor.rs`:
  - `RepeaterExecutor::execute_raw`: Executes arbitrary raw bytes over plain TCP or TLS streams, preserving malformed bytes without automatic normalization.
- `sentinel_core/crates/sentinel_parser/tests/smuggling_tests.rs` & `h2_tests.rs`:
  - 10 unit tests verifying passive detection of CL.TE, TE.CL, duplicate headers, space before colons, obs-fold, and HPACK roundtripping.

### 1.2 Capability Matrix & Gap Analysis

| Capability | Current Status | Code Location | Gap Description |
|---|---|---|---|
| Passive Smuggling Detection | **IMPLEMENTED** | `sentinel_parser::smuggling` | Analyzes parsed requests for 12 smuggling indicators. |
| Active Two-Stage HRS Probing (CL.TE / TE.CL) | **GAP** | Missing in `sentinel_scanner` | Lacks automated probe generator sending differential timing probes (>5s timeout) followed by benign canary pipeline reflection (`GET /sentinel_canary_404`). |
| HTTP/2 Downgrading Desync (H2.CL / H2.TE) | **GAP** | Missing in `sentinel_scanner` | Lacks generator for H2 requests with conflicting `content-length` or `transfer-encoding` to test frontend reverse proxy downgrading. |
| Pause-Based Desync Testing | **GAP** | Missing in `sentinel_repeater`/`scanner` | No socket engine that sends partial headers and pauses mid-stream to trigger backend read timeouts leaving unparsed bytes on keep-alive pipelines. |
| Parser Differential Matrix | **PARTIAL** | `sentinel_parser` | Flags anomalies, but lacks differential test suite comparing behavior between frontend proxy, cache, and backend server. |
| Web Cache Poisoning Engine | **GAP** | Missing in `sentinel_scanner` | No automated probing of unkeyed headers (`X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Original-URL`, `X-Rewrite-URL`, `X-Host`), parameter cloaking (`?a=1&a=2`, `?a=1;a=2`), or Fat GET requests, followed by secondary clean request verifying cache reflection (`X-Cache: HIT`). |
| Web Cache Deception Engine | **GAP** | Missing in `sentinel_scanner` | No automated probing of path delimiters (`/profile/nonexistent.css`, `;`, `%3b`, `%23`) asserting unauthenticated retrieval of cached private content. |

---

## 2. Domain 6: Parameter & Surface Discovery Engine

### 2.1 Architecture & Existing Implementation
Surface discovery components reside in `sentinel_core/crates/sentinel_context`, `sentinel_core/crates/sentinel_coverage`, `sentinel_core/crates/sentinel_knowledge`, and `src/workspaces/ParamMinerWorkspaceView.tsx`.

#### Key Existing Files & Structs
- `sentinel_core/crates/sentinel_context/src/classifier.rs`:
  - `ParameterClassifier::classify(name: &str, value: &str) -> ParameterClass`: Classifies parameters into 11 semantic categories (`Boolean`, `Search`, `ObjectId`, `Token`, `Email`, `Url`, `FilePath`, `Json`, `Xml`, `Html`, `Numeric`, `Enumeration`, `FreeText`, `Unknown`).
  - Identifies tokens (UUID, JWT, API tokens), path extensions, MongoDB ObjectIds, and boolean flags.
- `sentinel_core/crates/sentinel_context/src/fingerprint.rs`:
  - `TechDetector::detect_from_transaction(tx: &Transaction) -> Vec<TechFingerprint>`: Inspects headers (`Server`, `X-Powered-By`, `Set-Cookie`, `cf-ray`, `x-amz-cf-id`) and body signatures (WordPress, Drupal, Next.js, React, Angular).
- `sentinel_core/crates/sentinel_coverage/src/engine.rs`:
  - `DefaultCoverageEngine`: Implements `CoverageEngine` trait, tracking registered `Endpoint` records and testing coverage stats.
- `sentinel_core/crates/sentinel_knowledge/src/graph.rs` & `src/engine.rs`:
  - `GraphIndex`: In-memory graph of `GraphNode` and `GraphEdge` with BFS pathfinding up to 32 depth.
- `src/workspaces/ParamMinerWorkspaceView.tsx` & `DiscoverWorkspaceView.tsx`:
  - UI mock workspaces for hidden parameter mining and content discovery.

### 2.2 Capability Matrix & Gap Analysis

| Capability | Current Status | Code Location | Gap Description |
|---|---|---|---|
| Semantic Parameter Classification | **IMPLEMENTED** | `sentinel_context::classifier` | Classifies parameter names and values into 11 types. |
| Logarithmic Bisection Parameter Mining | **GAP** | Mocked in UI; missing in Rust backend | No $O(\log N)$ batched parameter mining engine ($N=10,000$, batch size $B=50$, binary bisection on anomalies). |
| Unlinked Header Discovery | **GAP** | Missing in `sentinel_scanner` | Lacks dictionary-based unlinked header probing (`X-Forwarded-*`, `X-Original-URL`, `X-Custom-IP-Authorization`, `X-Real-IP`, debug headers). |
| Cookie Attribute & Prefix Security Audit | **PARTIAL** | `sentinel_scanner::checks` | Only checks for missing `HttpOnly` and `Secure`. Lacks `SameSite` audit (`None`, `Lax`, `Strict`), `__Host-` / `__Secure-` prefix compliance, domain looseness, and unlinked cookie probing. |
| API Parameter Type Inference & Route Extraction | **PARTIAL** | `sentinel_context` | Lacks automated client-side router extraction (React/Vue/Angular route patterns in JS) and OpenAPI/JSON schema type inference. |

---

## 3. Domain 7: Advanced Fuzzing & Race Conditions Engine

### 3.1 Architecture & Existing Implementation
Fuzzing and concurrency testing reside in `sentinel_core/crates/sentinel_fuzzer`, `sentinel_core/crates/sentinel_logic`, and `src/workspaces/FuzzerWorkspaceView.tsx` / `TurboIntruderWorkspaceView.tsx`.

#### Key Existing Files & Structs
- `sentinel_core/crates/sentinel_fuzzer/src/mutators.rs`:
  - `FuzzMutator::mutate(input: &[u8], mutator_type: MutatorType) -> Vec<Vec<u8>>`: Generates payloads across `Boundary` (integer limits, float overflows, NaN, null), `FormatString` (`%s`, `%n`, `${7*7}`, `{{7*7}}`), `UnicodeNormalization` (overlong UTF-8, RTL, null byte), `BitFlip`, `ByteReplace`, `Truncation`, `Wordlist`, and basic `Grammar`.
- `sentinel_core/crates/sentinel_fuzzer/src/minimizer.rs`:
  - `PayloadMinimizer::minimize(payload: &[u8], test_fn: F) -> Vec<u8>`: Delta Debugging (`ddmin`) algorithm for minimal reproduction of crash payloads.
- `sentinel_core/crates/sentinel_logic/src/race.rs`:
  - `RaceConditionProber::execute_race_test<F, Fut, T>(concurrency: usize, action: F) -> Result<Vec<T>, SentinelError>`: Coordinates concurrent tasks using `tokio::sync::Barrier`.
- `sentinel_core/crates/sentinel_logic/src/state_machine.rs`:
  - `StateMachineEngine`: Graph of valid state transitions with validation.
- `src/workspaces/FuzzerWorkspaceView.tsx`:
  - Burp Intruder style workspace with Sniper, Battering Ram, Pitchfork, Cluster Bomb, resource pools, and auto-pause settings.

### 3.2 Capability Matrix & Gap Analysis

| Capability | Current Status | Code Location | Gap Description |
|---|---|---|---|
| Mutation Fuzzing (Bit/Byte/Boundary/Format) | **IMPLEMENTED** | `sentinel_fuzzer::mutators` | Robust mutation generators across 9 mutator types. |
| Payload Minimization (`ddmin`) | **IMPLEMENTED** | `sentinel_fuzzer::minimizer` | Fast binary delta debugging minimization. |
| Single-Packet HTTP/2 Synchronized Race Harness | **GAP** | Missing in `sentinel_logic`/`proxy` | Current `RaceConditionProber` only uses in-process Tokio barriers; lacks raw HTTP/2 multiplexing packing 20-50 HEADERS/DATA frames into a single TCP packet. |
| HTTP/1.1 Last-Byte Synchronization | **GAP** | Missing in `sentinel_logic`/`repeater` | No TCP socket harness that sends all bytes except the final byte across $N$ connections and flushes the final byte simultaneously via `TCP_NODELAY`. |
| Grammar-Based AST Fuzzing | **PARTIAL** | `sentinel_fuzzer::mutators` | Current grammar mutator only wraps in generic JSON brackets; lacks Context-Free Grammar (CFG) AST generators for SQL, XML, JSON, and GraphQL. |
| Type-Aware Schema-Guided Fuzzing | **GAP** | Missing in `sentinel_fuzzer` | Lacks structure-preserving fuzzer that parses JSON/form bodies into typed trees and mutates leaf nodes according to their inferred schema types. |

---

## 4. Domain 8: Crawling & Reconnaissance Engine

### 4.1 Architecture & Existing Implementation
Reconnaissance and crawling components reside in `sentinel_core/crates/sentinel_browser`, `sentinel_core/crates/sentinel_adapters`, `sentinel_core/crates/sentinel_context`, and `src/workspaces/BrowserWorkspaceView.tsx`.

#### Key Existing Files & Structs
- `sentinel_core/crates/sentinel_browser/src/dom.rs`:
  - `DomExtractor::extract(html: &str) -> DomSnapshot`: Parses title, `<a href="...">`, `<script>`, and `<form>` elements.
- `sentinel_core/crates/sentinel_browser/src/service.rs`:
  - `DefaultBrowserService`: Implements `BrowserService` trait (`navigate`, `execute_script`, `capture_dom`, `take_screenshot`, `close`), with `ScopeEngine` validation and CAS screenshot persistence.
- `sentinel_core/crates/sentinel_adapters/src/`:
  - `SubfinderAdapter`, `NucleiAdapter`, `NmapAdapter`, `SqlmapAdapter`: Normalized external tool execution wrappers.
- `sentinel_core/crates/sentinel_context/src/fingerprint.rs`:
  - `TechDetector`: Passive header and HTML signature fingerprinting.
- `src/workspaces/BrowserWorkspaceView.tsx`:
  - Headless browser daemon console, DOM tree viewer, script execution, and CAS screenshot evidence linking.

### 4.2 Capability Matrix & Gap Analysis

| Capability | Current Status | Code Location | Gap Description |
|---|---|---|---|
| DOM Extraction & Snapshotting | **IMPLEMENTED** | `sentinel_browser::dom` | Extracts links, scripts, and form elements. |
| Headless Browser Lifecycle & CAS Screenshots | **IMPLEMENTED** | `sentinel_browser::service` | Browser service with scope gating and CAS screenshot storage. |
| Scope-Bound Katana-Style Autonomous Crawler | **GAP** | Missing in `sentinel_browser`/`coverage` | No recursive crawler engine managing visited sets, link queues, crawl depth limits, rate budgets, form auto-fill, dynamic DOM event dispatch (clicking, hovering). |
| JavaScript Route & Endpoint Extractor | **GAP** | Missing in `sentinel_browser` | Lacks regex/AST parser that extracts API endpoints, routes, and hidden parameters from crawled `.js` files and inline scripts. |
| Advanced Technology Fingerprinting (JARM/Favicon) | **PARTIAL** | `sentinel_context::fingerprint` | Has basic header/body regexes, but lacks MurmurHash3 favicon hashing, JARM 10-probe TLS fingerprinting, TLS SAN extraction, and expanded 100+ stack Wappalyzer rules. |
| External Tool Adapters | **IMPLEMENTED** | `sentinel_adapters` | Normalized JSON adapters for Subfinder, Nuclei, Nmap, Sqlmap. |

---

## 5. Summary of Key Implementation Tasks for Worker

To achieve full production readiness for Milestone M3 across Domains 5–8, Worker agents should execute the following focused implementation packages:

### Package 1: HTTP/Protocol Security Engine Upgrades (`sentinel_scanner`, `sentinel_parser`, `sentinel_repeater`)
1. Implement `HttpSmugglingEngine`:
   - Two-stage active probe generator: `CL.TE` probe (`Content-Length: 4` + immediate chunk end `0\r\n\r\n`) and `TE.CL` probe (`Transfer-Encoding: chunked` + oversized body).
   - Benign canary pipeline reflection: inject `GET /sentinel_canary_404 HTTP/1.1` prefix and assert subsequent response returns 404.
   - H2 downgrading desync prober (conflicting CL/TE in H2 headers).
2. Implement `CacheSecurityEngine`:
   - Web Cache Poisoning prober: inject unkeyed headers (`X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Original-URL`, `X-Rewrite-URL`, `X-Host`), parameter cloaking (`?cb=1&cb=2`), and fat GET requests; follow up with clean request and verify `X-Cache: HIT` reflection.
   - Web Cache Deception prober: probe path delimiters (`/profile.php/nonexistent.css`, `;`, `%3b`, `%23`) and verify unauthenticated retrieval of cached sensitive response bodies.

### Package 2: Parameter & Surface Discovery Engine Upgrades (`sentinel_context`, `sentinel_scanner`)
1. Implement `ParamMinerEngine`:
   - Logarithmic bisection algorithm: partition wordlist of $N$ parameters into batches of $B=50$, send batched requests, detect anomaly (status code, reflection, length variance > 3-sigma), and recursively bisect ($2 \times \lceil\log_2 B\rceil$) to isolate the exact hidden parameter.
   - Vector support for Query params, Unlinked Headers, and Unlinked Cookies.
2. Implement `CookieAuditEngine`:
   - Audit `SameSite` flags (`None`, `Lax`, `Strict`), `__Host-` and `__Secure-` prefix compliance, path/domain scoping, and cookie parameter discovery.
3. Implement `RouteExtractionEngine`:
   - Extract API endpoints and client-side routes from JavaScript bundles using AST/regex patterns.

### Package 3: Advanced Fuzzing & Race Condition Engine Upgrades (`sentinel_logic`, `sentinel_fuzzer`)
1. Implement `SinglePacketRaceHarness`:
   - HTTP/2 Single-Packet Attack: pack 20–50 HTTP/2 request frames into a single TCP packet payload over a single multiplexed TLS connection.
   - HTTP/1.1 Last-Byte Sync: open $N$ TCP connections, write all request bytes except the final byte, enable `TCP_NODELAY`, and concurrently flush the final byte across all sockets within <1ms window.
2. Implement `TypeAwareFuzzer`:
   - JSON and form AST parser that mutates values while preserving syntactic structure (e.g. integer boundaries on numeric keys, string polyglots on text keys, boolean inversion on flags).

### Package 4: Crawling & Reconnaissance Engine Upgrades (`sentinel_browser`, `sentinel_coverage`, `sentinel_context`)
1. Implement `AutonomousCrawlerEngine` (Katana-style):
   - Scope-gated recursive crawler with depth limit, concurrency budget, visited URL set, form auto-fill, and DOM event triggering (button clicks, form submits).
2. Implement `AdvancedFingerprintEngine`:
   - Favicon MurmurHash3 calculation prober.
   - JARM TLS fingerprint generator (10 Client Hello probes -> 62-char hash).
   - Expanded tech rule registry.

---

## 6. Verification Strategy

The following verification suite will independently confirm all implementations:

1. **Unit & Integration Tests**:
   - `cargo test -p sentinel_parser --test smuggling_tests`
   - `cargo test -p sentinel_parser --test h2_tests`
   - `cargo test -p sentinel_fuzzer --test fuzzer_tests`
   - `cargo test -p sentinel_logic --test logic_tests`
   - `cargo test -p sentinel_context --test context_tests`
   - `cargo test -p sentinel_coverage --test coverage_tests`
   - `cargo test -p sentinel_browser --test browser_tests`
   - `cargo test --workspace --locked` (100% pass across all 28 crates)
2. **Frontend Conformance**:
   - `npm test` (all 60+ Vitest test suites passing)
3. **Spec Validator**:
   - `python architecture/v6/validate_v6_spec.py` (0 blockers, 0 warnings)
4. **Security Invariant Verification**:
   - Verify SEC-01 fail-closed scope gating on all active crawling, parameter mining, and race condition probes.
