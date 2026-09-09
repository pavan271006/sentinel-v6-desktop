# SENTINEL V6 — FINAL TOOL ECOSYSTEM & CONSOLIDATED WORKSPACE BLUEPRINT
**Document ID**: `SENTINEL-SPEC-M2-ECO-001`  
**Version**: 6.0.0-PROD  
**Classification**: Authoritative Engineering Specification & Production Blueprint  
**Publication Date**: August 2026  
**Status**: FROZEN / PRODUCTION-READY  

---

## 1. Executive Summary & Architectural Vision

### 1.1 The High-Density Offensive Workstation
SENTINEL V6 unifies the fragmented toolscape of modern application security testing into a single, high-performance, keyboard-driven native workstation (Tauri + React + TypeScript + Rust). Rather than forcing penetration testers to manage 28 disparate windows, standalone scripts, and disconnected utility tabs, SENTINEL organizes all offensive capabilities into:

1. **7 High-Density Primary Workspaces** (`Alt+S`, `Alt+1` through `Alt+6`): Dedicated full-screen environments aligned with core analytical tasks.
2. **3 Universal Contextual Tools** (`Ctrl+E`, `Ctrl+D`, Sequencer Modal): Instant inline transform, diff, and randomness tools that appear directly within the tester's active context without displacing state.
3. **1 Universal Bottom Console Drawer** (`Ctrl+J`): Collapsible multi-tab telemetry engine housing real-time OAST callbacks, event logs, background task queues, and IPC diagnostics.
4. **1 Seamless 8-Stage Offensive Pentesting Pipeline**: Enforcing contiguous progression from raw traffic capture to cryptographic proof and executive compliance delivery.

```
+========================================================================================================+
|  HEADER BAR: Project: Acclaim-Fintech | Scope: 6 In, 0 Out (Fail-Closed) | Intercept: [ON] | Ctrl+K Omni  |
+--------------------------------------------------------------------------------------------------------+
| ACT | PRIMARY WORKSPACE CANVAS (1 of 7 Selected)                               | CONTEXTUAL INSPECTOR  |
| BAR |                                                                          | (Right Sidebar)       |
|     |  WS-1: SCOPE & TARGETS             [Alt+S]                               | --------------------- |
| [S] |  WS-2: TRAFFIC HUB                 [Alt+1]                               | Headers / Query Params|
| [1] |  WS-3: MANUAL TESTING LAB          [Alt+2]                               | Raw Bytes / Hex View  |
| [2] |  WS-4: TARGET INTELLIGENCE         [Alt+3]                               | Transform / Decoder   |
| [3] |  WS-5: SECURITY ENGINES            [Alt+4]                               | Response Diff (LCS)   |
| [4] |  WS-6: FINDINGS CENTER             [Alt+5]                               | JWT Inspector / Claims|
| [5] |  WS-7: REPORTS & RETEST            [Alt+6]                               | Cryptographic CAS Proof|
| [6] |  SETTINGS & DIAGNOSTICS            [Ctrl+,]                              | Tech Stack Details    |
+--------------------------------------------------------------------------------------------------------+
| BOTTOM DRAWER [Ctrl+J]: [OAST Callback Listener] | [Event Bus Log] | [Task Queue & RPS] | [IPC Terminal]|
+========================================================================================================+
| STATUS: Proxy: 127.0.0.1:8080 | RPS: 480 | Memory: 86MB | CAS Blobs: 14,209 | SQLite WAL: 12MB (Clean)|
+========================================================================================================+
```

---

## 2. Master Consolidated Workspace Layout

### 2.1 The 7 Primary Workspaces

#### WS-1: Scope & Targets (`Alt+S`)
- **Underlying Backend Crates**: `sentinel_scope` (SUB-04), `sentinel_storage` (SUB-02).
- **Subsumed Capabilities**: Project lifecycle, Target Site Map, Pre-socket fail-closed gate (`SEC-01`), SSRF loopback protections, Visual DENY log.
- **Canvas Layout**:
  - *Left Pane*: Target Hierarchy Tree (Root Domain -> Wildcards -> Subdomains -> IP Netblocks).
  - *Center Canvas*: Scope Rule Editor (In-Scope Inclusion Rules, Strict Exclusion Rules, Regex Path Rules, Protocol Whitelists).
  - *Right / Bottom Pane*: Live Pre-Socket Violation Stream (Real-time tabular audit log showing timestamp, destination IP/host, rule triggered, and `DROPPED` status with zero socket emission).
- **Key Pentester Controls**: 1-click "Add Host to Scope", "Import CIDR List", "Toggle Fail-Closed Strict Mode", "Export Scope Policy (JSON)".

#### WS-2: Traffic Hub (`Alt+1`)
- **Underlying Backend Crates**: `sentinel_proxy` (SUB-06), `sentinel_parser` (SUB-05), `sentinel_httpql` (SUB-07), `sentinel_storage` (SUB-02), `sentinel_bus` (SUB-03).
- **Subsumed Capabilities**: Real-time HTTP/1.1, HTTP/2, and WebSocket proxy traffic stream; multi-tool aggregation (`Logger`); HTTPQL query bar; live interceptor; quick filters.
- **Canvas Layout**:
  - *Top Controls*: Intercept Toggle (`[ON / OFF]`), Forward Step (`Space`), Drop (`Delete`), Filter Presets (`[All]`, `[In-Scope]`, `[Errors 4xx/5xx]`, `[API JSON]`, `[WebSockets]`, `[Starred]`), Origin Filter Chips (`[Proxy]`, `[Repeater]`, `[Fuzzer]`, `[Scanner]`).
  - *Center Canvas*: Ultra-dense virtualized data grid capable of rendering 1,000,000 transactions at 60 FPS with columns: `#`, `Method`, `Host`, `Path`, `Status`, `Mime`, `Length`, `Latency (ms)`, `Origin`, `TLS`, `CAS Hash`.
  - *Context Pane (Split / Bottom / Right)*: Multi-mode Request/Response Inspector (Raw Bytes, Structured Headers, Form Data, Hex Dump, Rendered HTML Preview, Response Diff).
- **Key Pentester Controls**: `Ctrl+R` (Send to Testing Lab), `Ctrl+F` (Send to Fuzzer), `Ctrl+M` (Send to Auth Matrix), `Ctrl+D` (Diff Selected), `F5` (Scroll to Top).

#### WS-3: Manual Testing Lab (`Alt+2`)
- **Underlying Backend Crates**: `sentinel_repeater` (SUB-08), `sentinel_fuzzer` (SUB-14), `sentinel_logic` (SUB-20), `sentinel_productivity` (SUB-22).
- **Subsumed Capabilities**: Repeater multi-tab request editor; Intruder mutation fuzzer; Turbo Intruder async socket pipeline; Single-Packet HTTP/2 race condition prober; dynamic variable interpolator; Hackvertor tag processor.
- **Canvas Layout**:
  - *Top Tab Bar*: Multi-tab request workspace with color-coded tags, duplicate tab (`Ctrl+T`), close tab (`Ctrl+W`), and **Mode Selector Tabs**:
    1. **Replay Mode**: Standard manual request crafting with raw/pretty editors, auto Content-Length recalculation, dynamic `{{token}}` variables, and live streaming response.
    2. **Fuzz / Mutate Mode**: Payload marker positions (`§param§`), multi-payload matrix (Sniper, Battering Ram, Pitchfork, Cluster Bomb), wordlist manager, and Delta Debugging (`ddmin`) payload minimizer.
    3. **Turbo Async Mode**: High-throughput multiplexed async engine pushing 5,000+ RPS with pipeline queuing and real-time scatterplot latency graph.
    4. **Single-Packet Race Mode**: HTTP/2 barrier synchronization holding last frame byte across 20–50 streams and releasing simultaneously in a single TCP segment for race condition exploitation.
  - *Center Canvas*: Split-pane Request (Left) and Response (Right) editors with synchronized scrolling, inline Diff toggle (`Ctrl+D`), and live byte/token counters.
- **Key Pentester Controls**: `Ctrl+Enter` (Send / Launch), `Ctrl+E` (Transform Selection), `Ctrl+D` (Toggle Split Diff), `Ctrl+Alt+O` (Insert OAST Token).

#### WS-4: Target Intelligence (`Alt+3`)
- **Underlying Backend Crates**: `sentinel_knowledge` (SUB-10), `sentinel_coverage` (SUB-11), `sentinel_context` (SUB-09), `sentinel_scanner` (SUB-13).
- **Subsumed Capabilities**: Target Knowledge Graph; recursive SQLite CTE attack surface visualization; technology stack fingerprinting; Content & Directory Discovery (crawler/wordlists); Unlinked Parameter Mining (Param Miner); Surface Coverage Heatmap; Adaptive Next-Best-Test Planner.
- **Canvas Layout**:
  - *Left Pane*: Endpoint Navigation Tree (Host -> API Version -> Path -> Parameter -> Method).
  - *Center Canvas (Split View)*:
    - **Knowledge Graph Tab**: Interactive SVG/Canvas node graph linking `Asset -> Endpoint -> Parameter -> Finding` with choke-point analysis and cluster filtering.
    - **Discovery & Crawl Tab**: Real-time content discovery engine (directory/file brute-forcing) and unlinked query/header parameter miner.
    - **Coverage Heatmap Tab**: Visual matrix of tested vs discovered endpoints with risk-weighted coverage percentages.
  - *Right Pane*: **Adaptive Next-Best-Test Queue**. Prioritized list of recommended tests with deterministic, explainable "WHY" reasoning (e.g., *"Endpoint `/api/v2/transfer` accepts numeric `account_id` without anti-CSRF token -> High BOLA risk -> Recommended Action: Run AuthZ Differential Matrix"*).
- **Key Pentester Controls**: `Space` (Inspect Node), `Ctrl+Enter` (Dispatch Planned Test), `Ctrl+Shift+F` (Launch Parameter Miner).

#### WS-5: Security Engines (`Alt+4`)
- **Underlying Backend Crates**: `sentinel_scanner` (SUB-13), `sentinel_auth` (SUB-12), `sentinel_authz` (SUB-16), `sentinel_api` (SUB-17), `sentinel_verification` (SUB-15).
- **Subsumed Capabilities**: Active and Passive Automated Scanner; Concurrency & Rate Limit Governor (`SEC-10`); Identity & Session Vault (`SEC-09`); JWT Manipulation Workbench; Access Control & Authorization Matrix (BOLA/IDOR/BFLA differential tester); API Security Suite (OpenAPI 3.x, InQL GraphQL AST, WebSockets).
- **Canvas Layout**:
  - *Sub-Navigation Bar*:
    1. **Active/Passive Scanner**: Check suite selector (OWASP WSTG, API Top 10, PortSwigger vectors), scan scheduler, concurrency limits, real-time probe progress, and candidate vulnerability stream.
    2. **Identity Vault & JWT Workbench**: Memory-zeroized credential keychain (`SEC-09`), active session state monitors, 1-click JWT decoder, claim tamperer, and signature bypasses (`alg: none`, HMAC/RSA key confusion).
    3. **Access Control (AuthZ Matrix)**: Multi-principal authorization grid testing endpoints across configured roles (e.g. Admin, Tenant A User, Tenant B User, Unauthenticated) to automatically detect BOLA and BFLA.
    4. **API Security (REST / GraphQL / WS)**: OpenAPI 3.x schema visualizer, GraphQL InQL AST introspection explorer and query batching prober, and WebSocket continuous frame stream fuzzing.
- **Key Pentester Controls**: `Ctrl+Shift+S` (Start Scan), `Ctrl+M` (Run Matrix Replay), `Ctrl+Alt+J` (Tamper JWT).

#### WS-6: Findings Center (`Alt+5`)
- **Underlying Backend Crates**: `sentinel_verification` (SUB-15), `sentinel_report` (SUB-21), `sentinel_storage` (SUB-02).
- **Subsumed Capabilities**: Centralized vulnerability triage workbench; 5-tier verification proof inspector; cryptographic CAS proof viewer (`SEC-06/07`); CVSS v3.1 / v4.0 calculator; finding lifecycle state machine (`Candidate` -> `Verified` -> `Accepted Risk` -> `Remediated` -> `Retested`); Starred Triage Queue (Organizer).
- **Canvas Layout**:
  - *Left Pane*: Findings Triage Table grouped by Severity (Critical, High, Medium, Low, Info) or CWE/WSTG category with proof status badges (`VERIFIED_PROOF`, `TIMING_CONFIRMED`, `OAST_CORRELATED`, `CANDIDATE`).
  - *Center Pane*: Finding Detail Canvas containing Markdown vulnerability description, technical impact, CVSS score calculator, CWE mapping, and remediation code snippets.
  - *Right / Split Pane*: **Cryptographic CAS Evidence Viewer**. Verbatim SHA-256 raw request/response pairs, side-by-side differential diff, DOM execution traces, and high-resolution CAS screenshot proofs.
- **Key Pentester Controls**: `J` / `K` (Navigate Findings), `E` (Edit Remediation/CVSS), `Ctrl+P` (Promote Candidate to Confirmed), `Ctrl+E` (Inspect CAS Hash Tree).

#### WS-7: Reports & Retest (`Alt+6`)
- **Underlying Backend Crates**: `sentinel_report` (SUB-21), `sentinel_verification` (SUB-15), `sentinel_knowledge` (SUB-10), `sentinel_storage` (SUB-02).
- **Subsumed Capabilities**: Multi-format report builder (Executive PDF, Technical Markdown, HTML, SARIF 2.1, JSON); Automated Security Regression Retest Engine (`VULNERABLE` -> `FIXED` -> `REGRESSED`); Global Pentester Notebook & Engagement Memory.
- **Canvas Layout**:
  - *Sub-Navigation Bar*:
    1. **Report Generator**: Engagement metadata editor, executive summary builder, severity distribution charts, compliance framework mapping (OWASP WSTG, PCI-DSS, NIST SP 800-115), and 1-click export.
    2. **Automated Regression Retest Engine**: List of confirmed findings with 1-click "Retest All" or "Retest Selected". Replays exact CAS attack vector request and verifies if vulnerability persists or is remediated.
    3. **Engagement Memory & Notebook**: Structured markdown scratchpad with tags, auto-linked CAS hashes, request snippets, and timestamped engagement log.
- **Key Pentester Controls**: `Ctrl+Shift+E` (Export Report), `Ctrl+Shift+R` (Run Batch Retest), `Alt+N` (Focus Notebook).

#### Platform Settings & System Health (`Ctrl+,`)
- **Underlying Backend Crates**: `sentinel_enterprise` (SUB-27), `sentinel_plugin` (SUB-23), `sentinel_storage` (SUB-02).
- **Subsumed Capabilities**: Proxy listening interface/port; Dynamic Root CA generation and download; SQLite WAL database compaction (VACUUM); CAS storage metrics; Memory scrubber; WASM Plugin & Signed Research Pack manager (`SEC-04`).
- **Access**: Global gear icon in header or shortcut `Ctrl+,`.

---

## 3. Universal Contextual Tools & Overlays

To guarantee that the pentester never leaves their active investigation context to perform ancillary tasks, SENTINEL provides three universal floating tools:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               UNIVERSAL CONTEXTUAL TOOL WORKBENCHES                              │
├──────────────────────────────┬──────────────────────────────┬────────────────────────────────────┤
│ 1. Contextual Transform      │ 2. Universal Split Diff      │ 3. Sequencer Entropy Modal         │
│    Shortcut: [Ctrl+E]        │    Shortcut: [Ctrl+D]        │    Shortcut: [Right-Click Menu]    │
│                              │                              │                                    │
│ • URL / Base64 / Hex / HTML  │ • Side-by-Side & Inline LCS  │ • 20,000 Token Async Sampler       │
│ • MD5 / SHA-256 / Murmur3    │ • Dynamic Token Masking      │ • NIST SP 800-22 & FIPS 140-2 Suite│
│ • Nested Hackvertor Tags     │ • Word / Char / Byte Modes   │ • Monobit, Poker, Runs Tests       │
│ • Smart Regex Auto-Detection │ • Immediate Cancellation     │ • Shannon Entropy Bit Score        │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────────┘
```

### 3.1 Contextual Transform & Hackvertor Workbench (`Ctrl+E`)
- **Invocation**: Shortcut `Ctrl+E`, right-click context menu (*"Transform Selection..."*), or dedicated tab in the Right Contextual Inspector.
- **Features**:
  - **Multi-Stage Encoders / Decoders**: URL (Standard / Component), Base64 (Standard / URL-safe), Hex / ASCII, HTML Entities, Unicode escapes (`\uXXXX`), Gzip / Deflate, JWT payload decoding.
  - **Cryptographic Hashes**: MD5, SHA-1, SHA-256, SHA-384, SHA-512, MurmurHash3, NTLM.
  - **Dynamic Tag Processor (Hackvertor Engine)**: Evaluates inline recursive transformation tags inside the request editor before dispatching over the socket:
    ```http
    POST /api/v1/auth HTTP/1.1
    Host: target.com
    Authorization: Bearer <@base64_encode>{"user":"admin","role":"<@hex_encode>superadmin<@/hex_encode>"}<@/base64_encode>
    ```
  - **Smart Type Detection**: Automatically highlights detected encoding types (e.g. detecting Base64-encoded JSON or URL-encoded UTF-8 strings).

### 3.2 Universal Split Diff & Response Comparer (`Ctrl+D`)
- **Invocation**: Shortcut `Ctrl+D`, selecting two rows in Traffic Hub (*"Compare Selected"*), or clicking *"Diff Baseline"* in the Manual Testing Lab.
- **Features**:
  - **Chunked LCS Algorithm**: Sub-millisecond differential computation executing on background Web Workers without blocking the main React thread.
  - **Visual Modes**: Side-by-Side split canvas, Unified Inline diff, and Raw Byte/Hex comparison.
  - **Dynamic Masking Engine**: Automatically identifies and ignores non-deterministic response tokens (e.g., dynamic server timestamps, session nonces, anti-CSRF tokens, rotating request IDs) to isolate true vulnerability signals.

### 3.3 Sequencer Token Entropy Modal
- **Invocation**: Right-click any cookie, session header, or CSRF token in Traffic Hub or Manual Testing Lab -> *"Analyze Randomness in Sequencer"*.
- **Features**:
  - **Asynchronous Token Harvester**: Automatically dispatches up to 20,000 sample requests in the background with configurable concurrency and rate limiting.
  - **Statistical Test Suite**: Evaluates samples against NIST SP 800-22 and FIPS 140-2 randomness standards:
    - *Frequency (Monobit) Test*: Validates balance of 0s and 1s.
    - *Poker Test*: Validates distribution of 4-bit nibbles.
    - *Runs Test*: Validates frequency of uninterrupted bit sequences.
    - *Spectral DFT Test*: Detects periodic patterns in token generation algorithms.
  - **Effective Entropy Verdict**: Computes Shannon entropy bits per character and renders clear confidence badges (*EXCELLENT RANDOMNESS*, *POOR ENTROPY / PREDICTABLE*).

---

## 4. Universal Bottom Console Drawer (`Ctrl+J`)

Accessible globally across all primary workspaces via `Ctrl+J` or status bar tabs, the Bottom Drawer provides real-time system visibility:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BOTTOM CONSOLE DRAWER [Ctrl+J]                                                 [Minimize] [Close]│
├───────────────────┬───────────────────┬───────────────────┬───────────────────┬──────────────────┤
│ 1. OAST Listener  │ 2. Event Bus Log  │ 3. Task Scheduler │ 4. API Terminal   │ 5. Memory Health │
├───────────────────┴───────────────────┴───────────────────┴───────────────────┴──────────────────┤
│ [18:42:01] DNS Callback: token `a7f9b2` resolved from 198.51.100.42 (AWS-US-EAST)               │
│ [18:42:03] HTTP Callback: GET /callback/a7f9b2 HTTP/1.1 | User-Agent: internal-bot/1.0           │
│ [18:42:03] PROMOTED: Blind SSRF on /api/v1/webhook matched OAST Token a7f9b2 -> Finding #14      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **OAST Callback Listener & Token Dispenser**:
   - Live stream of asynchronous DNS, HTTP, HTTPS, and SMTP callbacks received by the SENTINEL OAST server.
   - 1-click button: *"Copy New OAST Token"* or *"Insert Token into Active Request"* (`Ctrl+Alt+O`).
   - Automatic correlation engine linking incoming callbacks to the originating test ID, parameter, and endpoint.
2. **Event Bus Telemetry**:
   - Dual-channel stream display showing high-frequency telemetry events and critical security audit events.
   - Real-time RPS counter, packet drop indicators, and bus health metrics.
3. **Background Task Scheduler**:
   - Active scan jobs, fuzzer attack progress, directory crawler queues, and rate limiter backpressure status.
   - Pause, resume, and abort controls for every active background worker.
4. **API Terminal & Diagnostics**:
   - Embedded interactive IPC terminal for executing low-level CLI commands, querying the SQLite database directly, or inspecting WASM plugin states.

---

## 5. The Canonical 8-Stage Offensive Pentesting Pipeline

The SENTINEL V6 workspace is engineered to guide operators through the complete offensive security lifecycle with zero state loss and zero manual copy-pasting:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               8-STAGE OFFENSIVE PENTESTING PIPELINE                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
[STAGE 1: Traffic (Ingest & Intercept)]
   │ • ScopeEngine validates target host/port against fail-closed rules (SEC-01)
   │ • Raw request/response bytes hashed (SHA-256) and committed to CAS blob store (SEC-07)
   │ • Transaction rendered in virtualized Traffic Table; HTTPQL filter evaluates in <10ms
   │
   ▼
[STAGE 2: Understand (Context & Surface Mapping)]
   │ • Passive analyzer builds SQLite Knowledge Graph (Asset -> Endpoint -> Parameter)
   │ • ContextEngine fingerprints tech stack; Param Miner discovers unkeyed headers/params
   │ • Adaptive Test Planner generates ranked Next-Best-Test recommendations with explainable "WHY"
   │
   ▼
[STAGE 3: Test (Manual & Automated Probing)]
   │ • Operator sends transaction to Manual Testing Lab (Ctrl+R)
   │ • Crafts attack in Replay, Mutation Fuzz, Turbo Async, or Single-Packet Race mode
   │ • Contextual Transform (Ctrl+E) and Inline Split Diff (Ctrl+D) accelerate probe validation
   │
   ▼
[STAGE 4: Verify (5-Tier Proof Engine)]
   │ • Candidate evaluated against 5-Tier Proof Hierarchy (Deterministic Inversion, 3-Sigma Timing,
   │   OAST Correlation, DOM Sink Hook Trace, Multi-Principal Matrix Differential)
   │ • Zero unverified candidates promoted to findings; eliminating false positives
   │
   ▼
[STAGE 5: Evidence (Cryptographic CAS Proof Assembly)]
   │ • SHA-256 CAS raw request/response blobs cryptographically bound to Finding entity (SEC-06/07)
   │ • Playwright DOM execution traces and high-res visual PNG screenshots attached
   │
   ▼
[STAGE 6: Finding (Lifecycle Triage & Rating)]
   │ • Finding registered in Findings Center with CVSS v3.1/v4.0 rating, CWE, and remediation blueprints
   │ • Finding state transitions to `CONFIRMED_FINDING` with attached proof badge
   │
   ▼
[STAGE 7: Retest (Automated Regression State Machine)]
   │ • Post-remediation verification runner replays exact CAS attack vector request
   │ • State machine updates Security Regression Graph (VULNERABLE -> FIXED -> REGRESSED)
   │
   ▼
[STAGE 8: Report (Multi-Format Compliance Delivery)]
   │ • Executive PDF, Technical Markdown, HTML, SARIF 2.1, and SQLite WAL archive generated in <2s
   │ • Complete engagement memory and methodology narrative compiled
```

### 5.1 Deep Per-Stage Specification

| Stage # | Stage Name | Primary Workspace | Subsystems Engaged | Inputs & Preconditions | Core Execution & Transformations | Outputs & State Mutations | Invariants Enforced |
|---|---|---|---|---|---|---|---|
| **1** | **Traffic** | Traffic Hub (`Alt+1`) | `sentinel_proxy`, `sentinel_parser`, `sentinel_scope`, `sentinel_storage` | Target browser/client configured with proxy `127.0.0.1:8080`. | MITM proxy streams RFC 9112 HTTP/1.1 & HTTP/2 frames; parser extracts rich AST; raw bytes saved to CAS. | Transaction stored in SQLite `transactions`; raw blobs in CAS; transaction row pushed to UI event bus. | `SEC-01` (Fail-Closed Scope Gate), `SEC-07` (SHA-256 CAS Immutability), `SEC-17` (WAL Persistence). |
| **2** | **Understand** | Target Intelligence (`Alt+3`) | `sentinel_context`, `sentinel_knowledge`, `sentinel_coverage`, `sentinel_scanner` | Live transactions in SQLite database. | ContextEngine analyzes headers for tech fingerprints; Param Miner probes unkeyed parameters; KnowledgeEngine builds recursive CTE graph. | `graph_nodes` & `graph_edges` updated; Coverage heatmap updated; Adaptive Test Planner generates ranked test queue. | `SEC-08` (Physical Project Isolation), `COV-INV-03` (Negative Control Calibration). |
| **3** | **Test** | Manual Testing Lab (`Alt+2`) / Security Engines (`Alt+4`) | `sentinel_repeater`, `sentinel_fuzzer`, `sentinel_logic`, `sentinel_authz` | Transaction selected from Traffic or Intelligence. | Tester modifies parameters, injects Hackvertor tags, launches mutation fuzzer or single-packet race prober, evaluates AuthZ matrix. | Outgoing attack requests emitted; candidate anomalies (differential status, error reflection, timing delta) flagged. | `SEC-01` (Pre-Socket Scope Check), `SEC-09` (Secret Zeroization), `SEC-10` (Concurrency Budget). |
| **4** | **Verify** | Security Engines (`Alt+4`) / Findings Center (`Alt+5`) | `sentinel_verification`, `sentinel_oast`, `sentinel_browser` | Candidate anomaly detected during testing. | 5-strategy verification engine executes 3-round Boolean inversion, 3-sigma statistical timing proof, or OAST token correlation. | Candidate classified as `VERIFIED_PROOF` or rejected as false positive / transient anomaly. | `COV-INV-01` (Proof Over Pattern), `SEC-06` (Finding Lifecycle Proof Requirement). |
| **5** | **Evidence** | Findings Center (`Alt+5`) | `sentinel_storage`, `sentinel_common`, `sentinel_browser` | Verified vulnerability candidate. | Immutable evidence package assembled: request SHA-256, response SHA-256, round-trip timing, DOM callstack, CAS screenshot. | Evidence record stored in `evidence` table; cryptographic digest bound to finding. | `SEC-07` (Cryptographic CAS SHA-256 Storage), `COV-INV-02` (Deterministic Evidence Linking). |
| **6** | **Finding** | Findings Center (`Alt+5`) | `sentinel_report`, `sentinel_verification` | Cryptographic evidence package. | Finding promoted to `CONFIRMED_FINDING`; CVSS v3.1/v4.0 score calculated; CWE and OWASP WSTG categories assigned; remediation guidelines generated. | Finding persisted in SQLite `findings` table; UI badge updated in activity bar and status bar. | `SEC-11` (Immutable Audit Records), `SEC-12` (Critical Delivery Queue). |
| **7** | **Retest** | Reports & Retest (`Alt+6`) | `sentinel_verification`, `sentinel_repeater`, `sentinel_knowledge` | Confirmed finding record with linked CAS proof. | Retest Engine replays verbatim attack request against live target; verifies response against proof oracle. | Finding state transitions: `VULNERABLE` -> `FIXED` (if remediated) or `REGRESSED` (if reopened). Retest evidence appended. | `COV-INV-01` (Verification Proof on Retest), `SEC-07` (Immutable Retest Evidence). |
| **8** | **Report** | Reports & Retest (`Alt+6`) | `sentinel_report`, `sentinel_storage`, `sentinel_enterprise` | Triage-complete findings, notebook notes, engagement metadata. | ReportGenerator compiles findings, CAS proof transcripts, risk charts, and compliance matrices into deliverable formats. | Generated PDF, Markdown, HTML, SARIF 2.1 JSON, and standalone SQLite WAL engagement archive. | `SEC-05` (Enterprise Multi-Tenant Separation), `LIC-INV-01` (Open-Source Licensing Purity). |

---

## 6. Unified Keyboard Shortcut Map

SENTINEL V6 enforces a 100% keyboard-navigable workflow:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SENTINEL KEYBOARD SHORTCUT MATRIX                                │
├──────────────────────────┬───────────────────────┬───────────────────────────────────────────────┤
│ Keyboard Shortcut        │ Scope / Context       │ Action Performed                              │
├──────────────────────────┼───────────────────────┼───────────────────────────────────────────────┤
│ Alt+S                    │ Global                │ Switch to Scope & Targets Workspace           │
│ Alt+1                    │ Global                │ Switch to Traffic Hub Workspace               │
│ Alt+2                    │ Global                │ Switch to Manual Testing Lab Workspace        │
│ Alt+3                    │ Global                │ Switch to Target Intelligence Workspace       │
│ Alt+4                    │ Global                │ Switch to Security Engines Workspace          │
│ Alt+5                    │ Global                │ Switch to Findings Center Workspace           │
│ Alt+6                    │ Global                │ Switch to Reports & Retest Workspace          │
│ Ctrl+,                   │ Global                │ Open Platform Settings & Health Modal         │
│ Ctrl+K / Ctrl+P          │ Global                │ Open Command Palette & Omni-Search Bar        │
│ Ctrl+J                   │ Global                │ Toggle Bottom Console Drawer (OAST/Logs/Tasks)│
│ Ctrl+B                   │ Global                │ Toggle Left Workspace Sidebar                 │
│ Ctrl+I                   │ Global                │ Toggle Right Contextual Inspector             │
│ Alt+N                    │ Global                │ Open / Focus Pentester Notebook Scratchpad    │
│ Ctrl+E                   │ Selection / Editor    │ Open Contextual Transform (Decoder/Hackvertor)│
│ Ctrl+D                   │ Selection / Editor    │ Open Universal Split Diff & Response Comparer │
│ Ctrl+R                   │ Traffic / Selection   │ Send Selected Request to Manual Testing Lab   │
│ Ctrl+F                   │ Traffic / Selection   │ Send Selected Request to Mutation Fuzzer      │
│ Ctrl+Shift+S             │ Traffic / Selection   │ Send Selected Target to Active Scanner        │
│ Ctrl+M                   │ Traffic / Selection   │ Send Selected Endpoint to AuthZ Matrix        │
│ Ctrl+Enter               │ Editor / Fuzzer       │ Execute / Dispatch Active Request             │
│ Ctrl+Alt+O               │ Editor                │ Generate & Insert OAST Token Payload          │
│ Ctrl+T                   │ Testing Lab           │ Open New Request Replay Tab                   │
│ Ctrl+W                   │ Testing Lab           │ Close Active Request Tab                      │
│ Ctrl+Tab / Ctrl+Shift+Tab│ Testing Lab           │ Cycle Next / Previous Replay Tab              │
│ Space                    │ Proxy Intercept       │ Step / Forward Active Intercepted Transaction │
│ Delete / Backspace       │ Proxy Intercept       │ Drop Active Intercepted Transaction           │
│ J / K or Down / Up       │ Table Navigation      │ Move Selection Down / Up                      │
│ Enter                    │ Table Navigation      │ Open / Inspect Selected Row Details           │
│ F5                       │ Traffic Hub           │ Scroll to Top & Follow Real-Time Stream       │
│ Esc                      │ Modals / Drawers      │ Close Modal / Clear Active Focus / Cancel Job │
└──────────────────────────┴───────────────────────┴───────────────────────────────────────────────┘
```

---

## 7. State Transition Contracts & Data Flow Rules

To prevent state desynchronization and enforce platform security invariants, SENTINEL specifies 5 immutable state transition contracts:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   VULNERABILITY FINDING STATE MACHINE                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                 ┌─────────────────────────┐
                                 │   CANDIDATE ANOMALY     │
                                 │ (Differential / Timing) │
                                 └────────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │ [Verification Engine Passes 5-Tier Proof]     │ [Proof Fails / Baseline Match]
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │    CONFIRMED FINDING    │                     │   REJECTED / TRANSIENT  │
         │  (CAS Digest Attached)  │                     │   (Suppressed In Log)   │
         └────────────┬────────────┘                     └─────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ [Remediation Deployed]    │ [Accepted Risk]
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│ VERIFIED_FIX  │           │ ACCEPTED_RISK │
└───────┬───────┘           └───────────────┘
        │
        │ [Retest Re-Exploits Vulnerability]
        ▼
┌───────────────┐
│   REGRESSED   │
└───────────────┘
```

1. **Scope Gating Contract (`SEC-01`)**:
   - `pre_socket_validate(request)` must evaluate to `ScopeDecision::Allow` prior to opening any TCP or TLS socket.
   - If `ScopeDecision::Deny(rule_id)`, socket emission is blocked, and an immutable `ScopeViolationEvent` is dispatched to the audit log.
2. **CAS Immutability Contract (`SEC-07`)**:
   - Raw transaction bytes stored in `BlobStorage` are keyed exclusively by $\text{SHA-256}(bytes)$.
   - Blobs are strictly read-only and deduplicated. Replaying or mutating a request in the Manual Testing Lab instantiates a new logical transaction with its own distinct CAS hash upon execution.
3. **Finding Proof Contract (`SEC-06`)**:
   - The UI shall disable the "Promote to Finding" action unless an attached `EvidenceDescriptor` satisfies at least one of:
     - Tier 1: Dual CAS SHA-256 hashes ($H_{req}, H_{res}$) with verified regex/syntax signature.
     - Tier 2: 3-Sigma calibrated timing proof ($\Delta t > \mu + 3\sigma$).
     - Tier 3: Correlated AES-256 OAST token callback record.
     - Tier 4: Playwright DOM sink invocation trace with CAS screenshot.
     - Tier 5: Multi-principal authorization matrix differential ($200\text{ OK} \land \text{Data}_{UserA} \in \text{Resp}_{UserB}$).
4. **Zero State Desynchronization Contract**:
   - Discovered endpoints, newly mined parameters, or modified scope rules emit Protobuf events over `sentinel_bus`.
   - All subscribed workspaces (Traffic, Target Intelligence, Scanner, Testing Lab) update their local stores reactively without requiring manual user refresh.

---

## 8. Design System & Ergonomics Integration

SENTINEL V6 leverages an ultra-dense, WCAG AA compliant design system configured in Tailwind CSS (`tailwind.config.js`):

### 8.1 Theme Tokens & Palette

| Token Category | CSS Variable | Hex Value (Dark Mode) | Usage Context |
|---|---|---|---|
| **Background Base** | `--bg-app` | `#0d1117` | Root application background |
| **Panel Surface** | `--bg-panel` | `#161b22` | Primary workspace canvas, sidebars |
| **Elevated Surface** | `--bg-panel-elevated` | `#21262d` | Modals, contextual inspectors, popovers |
| **Input Surface** | `--bg-input` | `#0b0e14` | Text editors, search bars, form inputs |
| **Border Subtle** | `--border-subtle` | `#30363d` | Table cell dividers, pane splitters |
| **Border Focus** | `--border-focus` | `#58a6ff` | Active keyboard focus ring (WCAG AA 3:1) |
| **Text Primary** | `--text-primary` | `#f0f6fc` | Code editors, primary headings, table text |
| **Text Secondary** | `--text-secondary` | `#8b949e` | Metadata, timestamps, HTTP headers |
| **Accent Cyan** | `--accent-cyan` | `#38bdf8` | HTTP GET methods, active tabs, search match |
| **Accent Blue** | `--accent-blue` | `#60a5fa` | Primary action buttons, selection highlights |
| **Accent Purple** | `--accent-purple` | `#c084fc` | OAST callbacks, GraphQL operations |
| **Accent Green** | `--accent-green` | `#4ade80` | HTTP 200 OK, Scope Allow status, Verified Proof |

### 8.2 Severity Status Hierarchy

| Severity Level | Background Token | Text Token | Hex Accent | CVSS v3.1 / v4.0 Range |
|---|---|---|---|---|
| **CRITICAL** | `--severity-critical-bg` (`#7f1d1d`) | `--severity-critical` (`#f87171`) | `#ef4444` | **9.0 – 10.0** |
| **HIGH** | `--severity-high-bg` (`#7c2d12`) | `--severity-high` (`#fb923c`) | `#f97316` | **7.0 – 8.9** |
| **MEDIUM** | `--severity-medium-bg` (`#713f12`) | `--severity-medium` (`#facc15`) | `#eab308` | **4.0 – 6.9** |
| **LOW** | `--severity-low-bg` (`#14532d`) | `--severity-low` (`#4ade80`) | `#22c55e` | **0.1 – 3.9** |
| **INFO** | `--severity-info-bg` (`#1e3a8a`) | `--severity-info` (`#60a5fa`) | `#3b82f6` | **0.0** |

### 8.3 Typography & Readability Invariants
- **Monospace Font**: `"JetBrains Mono"`, `"Fira Code"`, `Consolas`, `monospace` (used for all HTTP requests, responses, hex dumps, CAS hashes, and HTTPQL bars).
- **Proportional Font**: `Inter`, `-apple-system`, `sans-serif` (used for UI labels, buttons, navigation, and executive reports).
- **Row Height Density**: 24px per row in virtualized tables (providing 35+ visible rows on a standard 1080p display).

---

## 9. Verification & Governance

To independently certify that the consolidated workstation satisfies all operational standards:
1. **Spec Validator Execution**:
   ```powershell
   python architecture\v6\validate_v6_spec.py
   ```
   *Expected Result*: `BLOCKERS = 0, WARNINGS = 0`.
2. **Backend Crate Test Suite**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo test --workspace --locked
   ```
   *Expected Result*: 245/245 tests pass cleanly.
3. **Frontend Vitest Test Suite**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   npm test
   ```
   *Expected Result*: 100% test pass rate across all suites.
