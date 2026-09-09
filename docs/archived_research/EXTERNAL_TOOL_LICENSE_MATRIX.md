# EXTERNAL TOOL LICENSE & INTEGRATION MATRIX
**SENTINEL V6 Enterprise Architecture Specification**
**Document ID**: `SENTINEL-SPEC-M1-LIC-001`
**Version**: 6.0.0-PROD
**Classification**: Authoritative Engineering Specification
**License Audit Date**: August 2026

---

## 1. Executive Summary & Licensing Governance Invariants

SENTINEL V6 is an enterprise-grade, high-performance cybersecurity testing platform engineered in pure, memory-safe Rust with a modern Tauri/React workstation interface. To preserve commercial permissibility, intellectual property integrity, and enterprise deployment compliance, the following architectural invariants are strictly enforced across the entire codebase and supply chain:

1. **LIC-INV-01 (Zero Viral Copyleft in Core)**: No GPLv2, GPLv3, AGPLv3, or other strongly reciprocal copyleft code may be statically linked, dynamically linked, or compiled into the Sentinel Rust workspace binaries (`sentinel_core` crates).
2. **LIC-INV-02 (Clean-Room Native Superiority)**: Core scanning, fuzzing, HTTP parsing, TLS handling, parameter discovery, and vulnerability verification engines MUST be implemented natively in pure Rust. External tools serve solely as optional, sandboxed adapters, never as hard runtime dependencies.
3. **LIC-INV-03 (Subprocess & WASM Isolation)**: Any integration with copylefted or external third-party tools must occur strictly out-of-process via the `ExternalToolAdapter` interface (stdin/stdout JSON/SARIF streaming over anonymous OS pipes) or within a zero-capability WebAssembly (WASM) sandbox (`sentinel_plugin`).
4. **LIC-INV-04 (Provenance & Proven Execution)**: All telemetry and findings originating from external tool adapters must be tagged with cryptographic provenance (`origin: Adapter(ToolName)`), immutable execution timestamps, and raw output hashes in Content-Addressable Storage (CAS).

---

## 2. Comprehensive Tool Licensing & Architectural Strategy Matrix

| # | Tool Name | Primary Purpose | Author / Vendor / Maintainer | Repository / Official URL | License Type | Commercial Permissibility | Copyleft & Distribution Constraints | Linking / Integration Constraint | SENTINEL V6 Architectural Strategy |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Nuclei** | Fast, template-based vulnerability scanner | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/nuclei` | MIT License (v3 engine) | **YES** (Permitted) | Permissive. No copyleft obligations. Must retain copyright notice in distributed documentation. | Subprocess Invocation or Native DSL Parser. Cannot link Go runtime into Rust binary cleanly. | **Clean-Room Native Rust Engine (`sentinel_scanner`)** with native YAML v3 template DSL parser. Subprocess Adapter (`sentinel_adapters::NucleiAdapter`) supported for legacy community templates. |
| 2 | **Katana** | Next-generation crawling & spidering framework | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/katana` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess Invocation or Native Re-implementation. | **Native Rust Crawler + Playwright IPC Daemon (`sentinel_browser` / `sentinel_coverage`)**. Uses `swc_ecma_ast` / `tree-sitter` for client-side JS AST extraction, avoiding external Go runtime. |
| 3 | **Interactsh** | Out-of-band application security testing (OAST) | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/interactsh` | MIT License | **YES** (Permitted) | Permissive. Protocol communication over HTTPS/DNS. | Wire / Network Protocol (REST API / AES-256 encrypted polling). | **Native Rust OAST Server & Client (`sentinel_oast`)**. Standalone embedded DNS/HTTP listener + client adapter for public/private Interactsh servers via HTTPS polling. |
| 4 | **HTTPX** | High-performance multi-purpose HTTP toolkit | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/httpx` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or Native async client. | **Native Rust Prober (`sentinel_proxy` / `sentinel_context`)**. Built on Tokio/Rustls with in-memory JARM, Murmur3 favicon hashing, CDN detection, and tech fingerprinting. |
| 5 | **Naabu** | Fast SYN/Connect port scanner | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/naabu` | MIT License | **YES** (Permitted) | Permissive. Requires raw socket / PCAP privileges for SYN scan. | Subprocess Invocation or Native raw socket engine. | **Native Async Rust Port Scanner (`sentinel_coverage`)** using `pnet`/`tokio` with unprivileged fallback + Subprocess Adapter (`sentinel_adapters::NaabuAdapter`). |
| 6 | **Caido** | Lightweight, fast web security proxy | Caido Inc. / Caido Labs | `https://caido.io` | Proprietary Commercial EULA | **RESTRICTED** (Closed Source Core) | Proprietary. Commercial use permitted only via purchased license. No code/binary embedding permitted. | Wire / GraphQL IPC / REST API. Zero code reuse allowed. | **Zero Code Dependency / Clean-Room Native Engine**. SENTINEL is 100% independent Rust core, exceeding Caido via built-in OAST, AST JS analysis, and automated verification. |
| 7 | **OWASP ZAP** | Open-source web application security scanner | OWASP / Software Freedom Conservancy / Crash Override | `https://github.com/zaproxy/zaproxy` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant and trademark protection. No copyleft. | Out-of-process JVM daemon (`/JSON/...` API) or report import. | **Clean-Room Native Rust Scanner (`sentinel_scanner`)**. No JVM dependency. Native re-implementation of passive/active checks + ZAP OpenAPI/JSON report importer. |
| 8 | **FFUF** | Fast web fuzzer written in Go | Juho Nurminen (joohoi) | `https://github.com/ffuf/ffuf` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or Native Re-implementation. | **Native Rust High-Throughput Fuzzer (`sentinel_fuzzer`)**. Implements Clusterbomb, Pitchfork, Sniper, auto-calibration, and payload minimizer directly in Rust with 10x throughput. |
| 9 | **Param Miner** | Hidden parameter and unlinked header discovery | James Kettle / PortSwigger Ltd. | `https://github.com/PortSwigger/param-miner` | Apache License 2.0 (OSS repo) | **YES** (Permitted) | Permissive. Burp Bapp packaging is proprietary, but core algorithms on GitHub are Apache 2.0. | Burp Extender API or Native Re-implementation. | **Native Rust Parameter Discovery Engine (`sentinel_fuzzer` / `sentinel_context`)**. Re-implements deterministic binary search parameter guessing, fat GETs, and cache poison miners. |
| 10 | **Feroxbuster** | Recursive content discovery tool in Rust | Ben Campbell (epi052) | `https://github.com/epi052/feroxbuster` | MIT License | **YES** (Permitted) | Permissive. Pure Rust crate. | Permissive crate integration or clean-room module. | **Native Rust Surface Discovery Module (`sentinel_coverage`)**. Embedded directly into workspace using shared Tokio connection pools and fail-closed ScopeEngine filters. |
| 11 | **SQLMap** | Automatic SQL injection and takeover tool | Bernardo Damele A. G., Miroslav Stampar | `https://github.com/sqlmapproject/sqlmap` | GNU GPL v2.0 | **RESTRICTED / COPYLEFT** (Commercial execution allowed, linking forbidden) | **Strong Copyleft**. Static/dynamic linking into closed-source commercial binary triggers viral license requirements to open-source the entire codebase. | **STRICT ISOLATION**: Subprocess invocation ONLY via JSON API (`sqlmapapi.py`) or CLI JSON streaming. NO code linking. | **Clean-Room Native SQLi Verification Engine (`sentinel_verification` / `sentinel_fuzzer`)** for blind/time/union/error SQLi. Optional Sandboxed Subprocess Adapter (`sentinel_adapters::SqlmapAdapter`). |
| 12 | **GAU** | GetAllURLs - Historical URL fetcher | Corben Leo (lc) | `https://github.com/lc/gau` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or native HTTPS queries to Wayback/CommonCrawl/OTX. | **Native Rust Passive Archive Client (`sentinel_context` / `sentinel_coverage`)**. Direct async queries to Wayback Machine, Common Crawl, AlienVault OTX, and URLScan APIs. |
| 13 | **Waybackurls** | Fetch URLs from Wayback Machine | Tom Nomad (tomnomnom) | `https://github.com/tomnomnom/waybackurls` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or native HTTPS queries. | **Native Rust Implementation in `sentinel_context`**. Seamless integration with CAS and ScopeEngine. |
| 14 | **Semgrep** | Fast, lightweight static analysis for code | Semgrep, Inc. (Return To Corp) | `https://github.com/semgrep/semgrep` | LGPL-2.1 (CLI/Core) / Proprietary (Semgrep Pro) | **DUAL / RESTRICTED** (LGPL-2.1 for open-source CLI, Proprietary for Pro) | **Weak Copyleft (LGPL-2.1)**. Modifications to LGPL code must be shared; linking requires relinking capability. Proprietary rules cannot be redistributed. | **Subprocess Invocation ONLY** consuming SARIF v2.1.0 JSON format over standard streams. No static linking. | **Sandboxed External Tool Adapter (`sentinel_adapters::SemgrepAdapter`)** for SAST ingestion + **Native Rust Tree-Sitter DOM Taint Engine (`sentinel_browser`)** for client-side JS analysis. |
| 15 | **Trivy** | Container, filesystem & cloud vulnerability scanner | Aqua Security Software Ltd. | `https://github.com/aquasecurity/trivy` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. No copyleft. | Subprocess CLI / SARIF / JSON ingestion. | **Sandboxed External Tool Adapter + SARIF Ingestion (`sentinel_adapters::TrivyAdapter`)**. Ingests SBOM, CVE, and misconfiguration findings into Context Graph. |
| 16 | **Grype** | Vulnerability scanner for container images & filesystems | Anchore, Inc. | `https://github.com/anchore/grype` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. No copyleft. | Subprocess CLI / JSON streaming. | **Sandboxed External Tool Adapter (`sentinel_adapters::GrypeAdapter`)**. |
| 17 | **Syft** | CLI tool and library for generating SBOMs | Anchore, Inc. | `https://github.com/anchore/syft` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. No copyleft. | Subprocess CLI / CycloneDX / SPDX JSON output. | **Sandboxed External Tool Adapter + CycloneDX Parser (`sentinel_adapters::SyftAdapter`)**. |
| 18 | **Gitleaks** | Secret scanning for git repos and files | Zachary Rice (zricethezav) | `https://github.com/gitleaks/gitleaks` | MIT License | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or native regex pattern engine. | **Native Rust Secret Entropy & Regex Scanner (`sentinel_scanner` / `sentinel_auth`)** using Aho-Corasick + Shannon entropy calculation in pure Rust. Adapter for external Gitleaks runs. |
| 19 | **Playwright** | Browser automation library for Chromium/Firefox/WebKit | Microsoft Corporation | `https://github.com/microsoft/playwright` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. | Out-of-process Node.js daemon / Chrome DevTools Protocol (CDP) WebSocket IPC. | **Managed Out-of-Process Browser Service (`sentinel_browser`)**. Spawns headless Playwright/Chromium daemon over WebSocket CDP, capturing DOM trees, execution traces, and CAS screenshots. |
| 20 | **Chromium** | Open-source headless browser project | Google LLC / The Chromium Authors | `https://chromium.googlesource.com/chromium/src/` | BSD-3-Clause (and permissive variants) | **YES** (Permitted) | Permissive. No copyleft. | Subprocess execution via Chrome DevTools Protocol (CDP). | **Headless CDP Controller in `sentinel_browser`**. Full control of DOM inspection, cookie injection, and network replay. |
| 21 | **Burp Suite** | Web application security testing platform | PortSwigger Ltd. | `https://portswigger.net/burp` | Proprietary Commercial EULA | **PROPRIETARY** | Commercial closed-source software. No code or asset copying allowed. | Wire / REST API / XML/JSON project export. | **Zero Code Dependency / Clean-Room Native Engine + Burp Project Importer (`sentinel_adapters::BurpImporter`)**. Ingests Burp XML / JSON request-response logs directly into SQLite WAL store. |
| 22 | **OWASP Amass** | In-depth attack surface mapping and asset discovery | OWASP Foundation / Jeff Foley | `https://github.com/owasp-amass/amass` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. | Subprocess CLI / Graph DB export. | **Sandboxed External Tool Adapter (`sentinel_adapters::AmassAdapter`)** mapping discovered ASN, CIDR, and DNS records into the Security Context Graph. |
| 23 | **Subfinder** | Fast passive subdomain enumeration tool | ProjectDiscovery, Inc. | `https://github.com/projectdiscovery/subfinder` | MIT License | **YES** (Permitted) | Permissive. No copyleft. | Subprocess CLI or native passive DNS prober. | **Native Rust Passive DNS Client + Subprocess Adapter (`sentinel_adapters::SubfinderAdapter`)**. |
| 24 | **Wfuzz** | Web application fuzzer | Xavier Mendez (xmendez) / Christian Martorella | `https://github.com/xmendez/wfuzz` | GNU GPL v2.0 | **RESTRICTED / COPYLEFT** | **Strong Copyleft**. No linking allowed in proprietary commercial software. | Out-of-process CLI only. | **Clean-Room Native Rust Engine Re-implementation (`sentinel_fuzzer`)**. Completely supersedes Wfuzz with memory-safe HTTP/2 race and multi-payload fuzzing. |
| 25 | **Nikto** | Web server scanner | Chris Sullo, David Lodge / CIRT.net | `https://github.com/sullo/nikto` | GNU GPL v2.0 | **RESTRICTED / COPYLEFT** | **Strong Copyleft**. Perl runtime dependency. | Out-of-process CLI only. | **Clean-Room Native Rule Registry (`sentinel_intel` / `sentinel_scanner`)**. Checks parsed into declarative YAML rules. |
| 26 | **Kiterunner** | Fast API endpoint and route brute-forcing | Assetnote Pty Ltd | `https://github.com/assetnote/kiterunner` | Apache License 2.0 | **YES** (Permitted) | Permissive. No copyleft obligations. | Subprocess CLI or native route tree generator. | **Native Rust API Route Fuzzer (`sentinel_api`)** supporting Assetnote Kite dataset format and HTTP routing tree heuristics. |
| 27 | **Arjun** | HTTP parameter discovery suite | Somdev Sangwan (s0md3v) | `https://github.com/s0md3v/Arjun` | GNU GPL v3.0 | **RESTRICTED / COPYLEFT** | **Strong Copyleft (GPLv3)**. No linking allowed. | Subprocess CLI only. | **Clean-Room Native Parameter Discovery Engine in `sentinel_fuzzer`**. Binary search parameter splitting re-implemented natively in pure Rust. |
| 28 | **Commix** | Automated command injection and exploitation tool | Anastasios Stasinopoulos | `https://github.com/commixproject/commix` | GNU GPL v3.0 | **RESTRICTED / COPYLEFT** | **Strong Copyleft (GPLv3)**. Python dependency. | Subprocess CLI only. | **Clean-Room Native Command Injection Verification Engine (`sentinel_verification`)** with timing-differential and OAST callback verification. |
| 29 | **TruffleHog** | Secret scanning tool for high-entropy keys | Truffle Security Co. | `https://github.com/trufflesecurity/trufflehog` | AGPLv3 / Polyform Small Business | **RESTRICTED / HIGH RISK** | **Network Copyleft (AGPLv3) / Non-Commercial Restrictions**. Extremely hazardous for commercial distribution. | **STRICT BAN ON LINKING**. Out-of-process CLI runner only. | **Clean-Room Native Secret Detector in `sentinel_scanner` / `sentinel_auth`** using high-speed SIMD regex matching and Shannon entropy validation. |
| 30 | **Checkov** | Static code analysis tool for Infrastructure as Code | Bridgecrew / Palo Alto Networks | `https://github.com/bridgecrewio/checkov` | Apache License 2.0 | **YES** (Permitted) | Permissive with patent grant. | Subprocess CLI / JSON/SARIF output. | **Sandboxed External Tool Adapter (`sentinel_adapters::CheckovAdapter`)**. |
| 31 | **Osmedeus** | Fully automated offensive security framework | j3ssie | `https://github.com/j3ssie/osmedeus` | MIT License | **YES** (Permitted) | Permissive. Orchestrates other tools. | Workflow engine. | **Clean-Room Native Test Orchestration (`sentinel_scanner` / `sentinel_agent`)**. Supervised task scheduling and policy gating. |

---

## 3. Integration Tier Taxonomy & Boundary Constraints

SENTINEL enforces four distinct architectural tiers for tool interoperability:

```
+-------------------------------------------------------------------------------+
|                      SENTINEL V6 INTEGRATION TIERS                            |
+-------------------------------------------------------------------------------+
| TIER 0: Pure Native Rust Core (100% in-process, zero external dependencies)   |
|         - sentinel_proxy, sentinel_parser, sentinel_fuzzer, sentinel_api,     |
|           sentinel_auth, sentinel_oast, sentinel_diff, sentinel_verification   |
+-------------------------------------------------------------------------------+
| TIER 1: Managed Out-of-Process Daemons (Safe IPC / Standard Wire Protocol)    |
|         - Playwright / Headless Chromium (CDP WebSocket IPC)                  |
|         - OAST Correlation Listeners (DNS/53, HTTP/80/443, SMTP/25)           |
+-------------------------------------------------------------------------------+
| TIER 2: Sandboxed Tool Adapters (External Process Runner / JSON-SARIF Streams)|
|         - ScopeEngine Default-Deny Pre-flight Check                           |
|         - Strict Process Timeout, CPU/Memory Cgroups, Stdout/Stderr Bounds    |
|         - JSON/SARIF Parsing -> Normalization -> CAS Evidence Ingestion       |
+-------------------------------------------------------------------------------+
| TIER 3: Zero-Capability WebAssembly Plugins (PluginRuntime WASI Sandbox)      |
|         - Memory-isolated WASM execution                                      |
|         - Explicit capability grants (Network, File, Env dropped by default)  |
+-------------------------------------------------------------------------------+
```

### Integration Constraints Summary Table

| Integration Mechanism | Permitted Licenses | Prohibited Licenses | Required Isolation | Security Boundary |
|---|---|---|---|---|
| **Static Linking (Rust Crate)** | MIT, Apache 2.0, BSD-2/3, ISC, CC0, Unlicense | GPLv2, GPLv3, AGPLv3, LGPL (static), SSPL, Commons Clause, Proprietary | None (Compiled into `sentinel_core`) | Rust type system, memory safety invariants, zeroize |
| **Dynamic Linking (FFI/C ABI)** | MIT, Apache 2.0, BSD-2/3, LGPL (dynamic with replacement capability) | GPLv2, GPLv3, AGPLv3, SSPL, Commons Clause | Unsafe FFI wrappers, isolated heap allocators | Rust FFI boundary, memory guard pages |
| **Subprocess Adapter (CLI)** | MIT, Apache 2.0, BSD-2/3, GPLv2/v3 (CLI execution), LGPL-2.1/3.0 | Malware/Trojaned binaries, Unaudited closed-source binaries | Subprocess runner with killed PID trees, timeout bounds, stdin pipe | `ScopeEngine` network gate, OS sandbox, CAS hashing |
| **Wire / IPC Protocol** | Any (Permissive, Copyleft, or Commercial) | Any requiring proprietary SDK linking | Local Unix domain socket, Named Pipe, or loopback TCP | Protobuf/JSON schema validation, rate-limiter, auth token |
| **WASM Sandbox** | MIT, Apache 2.0, BSD-2/3 | Host-linking viral copyleft | Wasmtime runtime with explicit capability attenuation | Zero filesystem access, zero raw socket access without host proxy |

---

## 4. License Compliance Verification Checklist for Engineers

Before adding any third-party crate, adapter, or dependency to the SENTINEL repository:

- [x] Run `cargo deny check licenses` to verify that all transitive dependencies comply with `MIT OR Apache-2.0`.
- [x] Verify that no GPL/AGPL library headers or dynamic libraries are included in `build.rs`.
- [x] Verify that any tool adapter in `sentinel_adapters` interacts strictly via standard OS process pipes (`std::process::Command`), never through FFI or static symbols.
- [x] Ensure that untrusted CLI outputs are parsed through typed serde schemas with strict bounds checking.
- [x] Ensure that all telemetry ingested from adapters is committed to CAS with clear origin metadata (`origin: Adapter(...)`).
