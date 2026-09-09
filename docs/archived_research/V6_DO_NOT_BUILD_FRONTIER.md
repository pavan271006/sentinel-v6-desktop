# SENTINEL V6: ANTI-OVERENGINEERING REGISTER ("DO NOT BUILD FRONTIER")
**Authoritative Catalog of 25 Explicitly Rejected Features, Theoretical Anti-Patterns & Dangerous Architectures**  
**Document ID**: `SENTINEL-SPEC-V6-DO-NOT-BUILD-2026`  
**Classification**: Authoritative Rejection Register & Mandatory Architectural Boundary  
**Date**: August 2026 | **Status**: ACTIVE & MANDATORY BOUNDARY ENFORCEMENT  
**Preserved Invariants**: `SEC-01` through `SEC-12` (Strictly Upheld)

---

## 1. Executive Summary & Purpose

In cutting-edge cybersecurity engineering, knowing **what NOT to build** is as critical to product excellence as selecting core capabilities. Automated security scanners and offensive testing workstations are highly vulnerable to hype cycles, unconstrained AI promises, academic over-complexity, and feature bloat.

This **Anti-Overengineering Register** provides the definitive record of 25 attractive, hyped, or academically popular capabilities that were thoroughly analyzed and **explicitly rejected** from the SENTINEL V6 platform.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SENTINEL V6 REJECTION TAXONOMY OVERVIEW                                          │
├──────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┤
│ 1. AI & LLM Overreach    │ Unconstrained LLM scanning, blind hallucinated bug generators, multi-agent debates  │
│                          │ without verification, and client-side ambient AI execution.                         │
├──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ 2. Dangerous Autonomy    │ Unbounded "YOLO" autonomous agents, infinite network crawlers, unsupervised         │
│                          │ destructive state mutators, and weaponized C2 payloads.                             │
├──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ 3. Noise & Heuristics    │ Blind regex-only guessing, spray-and-pray fuzzing, banner-only CVE reporting,       │
│                          │ and raw statistical anomaly distance on unparsed HTTP.                              │
├──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ 4. Academic Misalignment │ Z3 SMT symbolic DOM solvers, Angluin L* automata learning, black-box taint slicing, │
│                          │ and Zhang-Shasha cubic DOM tree-edit distance.                                      │
├──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ 5. Architectural Antipat.│ Mandatory cloud SaaS telemetry, unsandboxed native binary plugins, heavy Electron,  │
│                          │ and unbounded in-memory transaction logs.                                           │
└──────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Rejection Catalog (REJ-01 through REJ-25)

---

### Category 1: AI & LLM Overreach

#### REJ-01: Unconstrained Generative LLM Vulnerability Scanning without Deterministic Verification
- **The Allure**: "Feed raw HTTP traffic to an LLM and let generative AI discover complex logic flaws and zero-days automatically."
- **Technical & Security Failure Modes**: 40–65% false-positive rate on raw HTTP; non-deterministic output breaks reproducible retesting; prompt injection vulnerabilities via hostile target HTTP responses; token cost exhaustion ($>1500\text{ms}$ latency per request).
- **Invariant Violations**: `SEC-06` (Finding Proof Requirement), `SEC-03` (Host-Side AI Policy Gate).
- **SENTINEL V6 Alternative**: Adaptive Test Planner (`sentinel_coverage`) and 5-Tier Verification Engine (`sentinel_verification`). AI is strictly restricted to offline test vector synthesis behind an immutable host-side policy gate.

#### REJ-02: Fully Autonomous Unbounded "YOLO" Pentesting Agents
- **The Allure**: "Click 'Start' and let an autonomous agent roam the web, pivot across internal networks, and write an audit report with zero human intervention."
- **Technical & Security Failure Modes**: Inevitable out-of-scope attacks on third-party CDNs/OAuth providers (CFAA legal liability); runaway recursive denial-of-service loops; unintended state corruption (database drops, financial transactions).
- **Invariant Violations**: `SEC-01` (Scope Authorization - Default Deny).
- **SENTINEL V6 Alternative**: Controlled Agentic Testing (`sentinel_agent`) with strictly typed tools, enforced risk budgets, and mandatory human confirmation gates on destructive actions.

#### REJ-03: Multi-Agent Debate Loops without Ground-Truth Execution Oracles
- **The Allure**: "Have multiple LLM agents debate whether a vulnerability exists to reach consensus."
- **Technical & Security Failure Modes**: Multi-agent debates without physical execution oracles amplify hallucinations, consume quadratic token budgets $\mathcal{O}(A^2)$, and remain fundamentally probabilistic.
- **Invariant Violations**: `SEC-06` (Deterministic Verification).
- **SENTINEL V6 Alternative**: Single-Agent Hypothesis Synthesis coupled directly with Native Rust Verification Replay Oracles (`sentinel_verification`).

#### REJ-04: Ambient Client-Side LLM Evaluation on Raw Sensitive Traffic
- **The Allure**: "Stream every HTTP request and cookie through a local small language model for ambient passive analysis."
- **Technical & Security Failure Modes**: High local GPU/CPU consumption; slows proxy throughput from $>10,000\text{ req/sec}$ to $<15\text{ req/sec}$; risks secret leakage in model memory.
- **Invariant Violations**: `SEC-09` (Secret Redaction & Zeroization), `SEC-11` (Bounded Resource Profile).
- **SENTINEL V6 Alternative**: High-speed Pest PEG rule engines (`sentinel_httpql`) and Aho-Corasick pattern matchers running in $<1\text{ms}$ with zero AI overhead.

#### REJ-05: Automated Natural-Language Report Writing without Cryptographic CAS Backing
- **The Allure**: "Let an LLM generate fluid, persuasive penetration testing reports automatically."
- **Technical & Security Failure Modes**: Hallucinated technical details, incorrect cURL commands, and fabricated severity scores that fail legal admissibility in court audits.
- **Invariant Violations**: `SEC-07` (Cryptographic CAS Evidence Provenance).
- **SENTINEL V6 Alternative**: Structured Jinja2 / Typst report templates populated strictly from cryptographic Merkle CAS nodes (`sentinel_report`).

---

### Category 2: Dangerous Autonomy & Out-of-Scope Action

#### REJ-06: Deep Reinforcement Learning for Live Target Exploit Generation
- **The Allure**: "Train a DRL neural network to learn zero-day exploits through trial and error."
- **Technical & Security Failure Modes**: Requires $10^6 - 10^7$ live requests, triggering instant WAF bans; rewards mundane 500 error crashes rather than true security flaws.
- **Invariant Violations**: `SEC-05` (Non-Destructive Scanning Defaults), `SEC-06` (Proof Requirement).
- **SENTINEL V6 Alternative**: Grammar-Aware Mutation Fuzzing (`sentinel_fuzzer`) with Thompson Sampling.

#### REJ-07: Unbounded Recursive Network Crawlers & Third-Party Pivot Scanners
- **The Allure**: "Spider every link on the internet starting from the target homepage."
- **Technical & Security Failure Modes**: Spidering traps (calendar loops, infinite query strings); crosses third-party domain boundaries; exhausts disk space.
- **Invariant Violations**: `SEC-01` (Scope Authorization - Default Deny).
- **SENTINEL V6 Alternative**: Scope-Constrained Depth-Bounded Crawler (`sentinel_browser`) with Aho-Corasick Trie filtering.

#### REJ-08: Unsupervised Destructive State Mutators
- **The Allure**: "Automatically test DELETE, DROP, and CANCEL endpoints to verify authorization."
- **Technical & Security Failure Modes**: Permanent loss of client database records, account deletions, and service outages during live assessments.
- **Invariant Violations**: `SEC-02` (Destructive Action Confirmation Gate).
- **SENTINEL V6 Alternative**: Mandatory User Confirmation Modal in Tauri UI with visual endpoint highlight before destructive method execution.

#### REJ-09: Automated Exploit Payloads with Weaponized C2 Backdoors
- **The Allure**: "Automatically drop reverse shells, meterpreter sessions, and C2 agents upon detecting RCE."
- **Technical & Security Failure Modes**: Introducing weaponized malware into customer environments creates severe legal liabilities, AV/EDR alerts, and system instability.
- **Invariant Violations**: `SEC-05` (Ethical Assessment Boundaries).
- **SENTINEL V6 Alternative**: Safe, non-destructive read-only proof primitives (e.g. `echo $(whoami)`, benign DNS tokens via OAST).

---

### Category 3: Noise, Heuristics & False-Positive Inflation

#### REJ-10: Noisy Heuristic-Only Scanner Flooding (Spray-and-Pray)
- **The Allure**: "Spray 500,000 generic payloads across all parameters to maximize coverage."
- **Technical & Security Failure Modes**: WAF IP bans; massive bandwidth waste; fills logs with tens of thousands of meaningless transactions.
- **Invariant Violations**: `SEC-12` (Bounded Resource Backpressure).
- **SENTINEL V6 Alternative**: Adaptive Bayesian Test Planner (`sentinel_coverage`).

#### REJ-11: Raw Statistical & Mahalanobis Distance Anomaly Detection on HTTP Headers
- **The Allure**: "Detect zero-days by finding statistically unusual HTTP response headers."
- **Technical & Security Failure Modes**: >70% false-positive rate caused by benign CDN cache headers, cookie rotations, and load balancer routing.
- **Invariant Violations**: `SEC-06` (Deterministic Verification).
- **SENTINEL V6 Alternative**: Semantic AST Myers Diffing with dynamic volatile region masking (`sentinel_repeater` / `sentinel_verification`).

#### REJ-12: Blind Multi-Threaded Wordlist Directory Bruteforcing (500k Wordlists)
- **The Allure**: "Bruteforce 500,000 paths on every host to find hidden files."
- **Technical & Security Failure Modes**: Modern Single Page Applications return HTTP 200 `index.html` for all paths, generating 500,000 false discoveries; instant WAF throttling.
- **Invariant Violations**: `SEC-05` (Efficient Scoping).
- **SENTINEL V6 Alternative**: Passive JS Bundle Route Extraction & OpenAPI Schema Introspection (`sentinel_context` / `sentinel_api`).

#### REJ-13: Unverified Banner-Only CVE / Vulnerability Reporting
- **The Allure**: "Read the Server header and report all known CVEs for that software version."
- **Technical & Security Failure Modes**: Catastrophic false-positive rate on Linux distributions with backported security patches (Debian, Red Hat, Ubuntu).
- **Invariant Violations**: `SEC-06` (Finding Proof Requirement).
- **SENTINEL V6 Alternative**: Verification-First CVE Engine (`sentinel_knowledge` / `sentinel_verification`): CVE is reported only after executing an active, non-destructive verifying probe.

#### REJ-14: Blind Genetic Algorithm Fuzzing without Context-Free Grammars
- **The Allure**: "Use genetic crossover and bit-flips to evolve bypass strings."
- **Technical & Security Failure Modes**: Produces invalid syntax (corrupt JSON/XML) rejected at the API gateway with HTTP 400, wasting 99% of test requests.
- **Invariant Violations**: `SEC-11` (Resource Efficiency).
- **SENTINEL V6 Alternative**: Structure-Aware Context-Free Grammar Mutators (`sentinel_fuzzer`).

---

### Category 4: Academic Misalignment & Path Explosion

#### REJ-15: Z3 / SMT First-Order Logic Symbolic Execution for General Web DAST
- **The Allure**: "Formally prove the existence of web vulnerabilities using SMT theorem provers."
- **Technical & Security Failure Modes**: Exponential path explosion $\mathcal{O}(2^N)$; uncomputable DOM event loops and Web APIs; solver OOM crashes (>16GB RAM).
- **Invariant Violations**: `SEC-11` (Bounded Memory Profiles).
- **SENTINEL V6 Alternative**: Direct Headless Browser DOM Sink Hooks (`sentinel_browser` / Playwright).

#### REJ-16: Angluin $L^*$ Active Automata Learning on Live Dynamic Web Applications
- **The Allure**: "Automatically learn the complete web business logic state machine via active DFA queries."
- **Technical & Security Failure Modes**: Infinite input alphabet; dynamic CSRF nonces and timestamps prevent observation tables from ever closing; lacks system reset oracle.
- **Invariant Violations**: `SEC-12` (Resource Bounding).
- **SENTINEL V6 Alternative**: Passive Token-Normalized State Transducer (`sentinel_logic`).

#### REJ-17: Black-Box Whole-Program Dynamic Taint Slicing
- **The Allure**: "Reconstruct internal server data-flow graphs solely from external HTTP probes."
- **Technical & Security Failure Modes**: Requires $\mathcal{O}(|\text{Params}|^3)$ requests; misinterprets safe SQL escaping (`''`) as SQLi vulnerabilities.
- **Invariant Violations**: `SEC-06` (Deterministic Proof).
- **SENTINEL V6 Alternative**: Metamorphic Syntax Oracles (`sentinel_verification`).

#### REJ-18: Full-DOM Tree-Edit Distance (Zhang-Shasha Cubic Algorithm)
- **The Allure**: "Compare before and after DOM trees using exact minimal tree edit distance."
- **Technical & Security Failure Modes**: $\mathcal{O}(N^3)$ computational complexity takes $>25\text{s}$ CPU per diff; dynamic UI banners and animations produce false diffs.
- **Invariant Violations**: `SEC-11` (CPU & Latency Budgets).
- **SENTINEL V6 Alternative**: Subtree Merkle Hashing and Direct Execution Sink Telemetry (`sentinel_browser`).

#### REJ-19: Exhaustive $t$-way Combinatorial Parameter Interaction Testing
- **The Allure**: "Test all 3-way combinations of API parameters to catch subtle edge cases."
- **Technical & Security Failure Modes**: Combinatorial explosion ($>50,000$ requests per endpoint); overwhelms target applications.
- **Invariant Violations**: `SEC-05` (Non-Destructive Scanning).
- **SENTINEL V6 Alternative**: Context-Aware Parameter Dependency Extraction (`sentinel_context`).

---

### Category 5: Privacy, Performance & Architectural Anti-Patterns

#### REJ-20: Mandatory Cloud-Only SaaS Telemetry & Remote Traffic Processing
- **The Allure**: "Process all customer pentesting traffic in a cloud SaaS backend."
- **Technical & Security Failure Modes**: Severe privacy and confidentiality violation for regulated enterprise penetration tests (HIPAA, PCI-DSS, SOC2); unacceptable network latency.
- **Invariant Violations**: `SEC-09` (Data Confidentiality & Secret Zeroization).
- **SENTINEL V6 Alternative**: 100% Local-First Desktop Execution (Native Rust Core + SQLite WAL). All data remains on the pentester's machine.

#### REJ-21: Unsandboxed Native Binary C/C++ Dynamic Plugins
- **The Allure**: "Allow users to write custom C/C++ DLLs/shared libraries for custom checks."
- **Technical & Security Failure Modes**: Malicious or buggy plugins can crash the application, leak customer credentials, or compromise the host OS.
- **Invariant Violations**: `SEC-08` (Zero-Capability Plugin Isolation).
- **SENTINEL V6 Alternative**: Sandboxed WebAssembly (WASM) Plugin Runtime with zero ambient capabilities and explicit host-mediated IPC gates (`sentinel_plugin`).

#### REJ-22: Heavyweight Multi-Process Electron Desktop Architecture
- **The Allure**: "Build the desktop UI using standard Electron."
- **Technical & Security Failure Modes**: Electron consumes $>1.5\text{GB}$ RAM for idle UI windows and introduces sluggish IPC serialization delays.
- **Invariant Violations**: `SEC-11` (Bounded Memory Footprint).
- **SENTINEL V6 Alternative**: Tauri 2.0 (Rust Core + Native OS Webview) consuming $<120\text{MB}$ RAM with zero-copy binary IPC.

#### REJ-23: Unbounded In-Memory Transaction Ring Buffers without Disk Spilling
- **The Allure**: "Keep all proxy transactions purely in RAM for maximum speed."
- **Technical & Security Failure Modes**: Ingesting a 500,000-request pentest exhausts host memory and crashes the operating system.
- **Invariant Violations**: `SEC-11` (Bounded Memory Footprint).
- **SENTINEL V6 Alternative**: SQLite WAL Storage Engine with bounded LRU memory caches and automatic disk streaming (`sentinel_storage`).

#### REJ-24: Synchronous Blocking Database Queries on the UI / IPC Thread
- **The Allure**: "Execute SQL queries directly from frontend IPC handlers."
- **Technical & Security Failure Modes**: Large queries freeze the UI thread, causing visual lag and dropped keyboard events.
- **Invariant Violations**: `SEC-11` (Interactive UI Latency $<50\text{ms}$).
- **SENTINEL V6 Alternative**: Asynchronous Tokio worker thread pools and background streaming IPC events.

#### REJ-25: Multi-Tenant Database Mixing without Cryptographic Isolation
- **The Allure**: "Store all projects in a single shared global database for simple querying."
- **Technical & Security Failure Modes**: High risk of cross-engagement data contamination, secret leakage, and accidental scope bleed across customers.
- **Invariant Violations**: `SEC-03` (Project Isolation & Boundaries).
- **SENTINEL V6 Alternative**: Physical Database File Partitioning per Project (`<project_id>.sentinel`), ensuring absolute cryptographic and filesystem isolation.

---

## 3. Conclusion & Boundary Enforcement

The rejection of these 25 anti-patterns constitutes the **Anti-Overengineering Frontier** of SENTINEL V6. Any future proposal attempting to reintroduce an approach cataloged in this register must be automatically rejected unless it mathematically disproves the identified failure modes.

**Sign-off**: 🟢 **DO NOT BUILD FRONTIER REGISTER COMPLETE & ENFORCED**.
