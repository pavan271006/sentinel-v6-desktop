# SENTINEL V6 - FINAL RISK REGISTER

This document outlines the final risk register for the SENTINEL V6 project.

### RISK-001: Custom HTTP Parser Vulnerabilities

| Field | Content |
|-------|------|
| **ID** | RISK-001 |
| **Title** | Custom HTTP Parser Vulnerabilities |
| **Category** | Security |
| **Likelihood** | High |
| **Impact** | Critical |
| **Risk Level** | Critical |
| **Description** | Building a custom HTTP parser introduces risk of parser differential vulnerabilities. SENTINEL itself could become vulnerable to request smuggling if its parser disagrees with target servers. This is the highest technical risk in the project. |
| **Mitigation** | Mandatory continuous fuzzing (cargo-fuzz), property-based testing (proptest), comparison testing against httparse/hyper for conforming traffic, manual security audit. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-002: SQLite Write Bottleneck

| Field | Content |
|-------|------|
| **ID** | RISK-002 |
| **Title** | SQLite Write Bottleneck |
| **Category** | Performance |
| **Likelihood** | High |
| **Impact** | Medium |
| **Risk Level** | High |
| **Description** | ProxyEngine targets 10k req/sec but ObservationStore handles 5k writes/sec. Under maximum load, the database WILL bottleneck the proxy. SQLite single-writer constraint means no horizontal write scaling. |
| **Mitigation** | Batch inserts, async write queue, drop non-essential observations under load, enterprise tier uses ClickHouse. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-003: Apex Horizon Scope Creep

| Field | Content |
|-------|------|
| **ID** | RISK-003 |
| **Title** | Apex Horizon Scope Creep |
| **Category** | Engineering |
| **Likelihood** | Very High |
| **Impact** | High |
| **Risk Level** | Critical |
| **Description** | SmtSolverEngine, RlStateEngine, CryptoAnalysisEngine are research-grade. Attempting to implement them alongside core features will delay delivery and dilute engineering focus. |
| **Mitigation** | Move to feature flags. Defer to post-V1. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-004: Browser Resource Consumption

| Field | Content |
|-------|------|
| **ID** | RISK-004 |
| **Title** | Browser Resource Consumption |
| **Category** | Performance |
| **Likelihood** | High |
| **Impact** | Medium |
| **Risk Level** | High |
| **Description** | Each Playwright browser context consumes 150-300MB RAM. Verification-first architecture means every XSS/DOM candidate triggers browser verification. On a 16GB laptop, concurrent scanning + browser verification will exhaust memory. |
| **Mitigation** | Browser context pool (max 3-5 concurrent), queue-based verification, aggressive context recycling. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-005: Plugin Ecosystem Cold Start

| Field | Content |
|-------|------|
| **ID** | RISK-005 |
| **Title** | Plugin Ecosystem Cold Start |
| **Category** | Adoption |
| **Likelihood** | Very High |
| **Impact** | High |
| **Risk Level** | Critical |
| **Description** | Rhai + WASM plugins have zero compatibility with Burp's Java BApp ecosystem. Pentesters rely on specific Burp extensions. Migration friction will prevent adoption. |
| **Mitigation** | Prioritize built-in equivalents for top 20 Burp extensions. Provide migration guides. Invest in developer documentation. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-006: OAST Server Public Exposure

| Field | Content |
|-------|------|
| **ID** | RISK-006 |
| **Title** | OAST Server Public Exposure |
| **Category** | Security |
| **Likelihood** | Medium |
| **Impact** | High |
| **Risk Level** | High |
| **Description** | OAST server requires public internet reachability (DNS on :53, HTTP on :80/:443). This creates a significant attack surface. NAT traversal, firewall configuration, TLS certificate management add operational complexity. |
| **Mitigation** | Hosted OAST option, VPS deployment guides, automatic Let's Encrypt certificates, IP allowlisting. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-007: AI Prompt Injection

| Field | Content |
|-------|------|
| **ID** | RISK-007 |
| **Title** | AI Prompt Injection |
| **Category** | Security |
| **Likelihood** | High |
| **Impact** | High |
| **Risk Level** | Critical |
| **Description** | Target application responses fed to AIEngine could contain prompt injection attacks. The AIPolicyEngine's regex-based defenses are acknowledged as insufficient in the architecture documents themselves. |
| **Mitigation** | Defense-in-depth (5 layers), scope enforcement on AI outputs, human approval for destructive actions, output schema validation. Remove 99% block rate claim. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-008: CloudFoxAdapter Cloud Account Damage

| Field | Content |
|-------|------|
| **ID** | RISK-008 |
| **Title** | CloudFoxAdapter Cloud Account Damage |
| **Category** | Security |
| **Likelihood** | Medium |
| **Impact** | Critical |
| **Risk Level** | Critical |
| **Description** | CloudFoxAdapter interacts with live AWS/GCP. Incorrect or aggressive enumeration could trigger billing, modify resources, or violate customer trust. |
| **Mitigation** | Default read-only mode. Attack mode requires explicit per-action confirmation. Audit logging. Undo capability where possible. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-009: Zero False Positive Claims

| Field | Content |
|-------|------|
| **ID** | RISK-009 |
| **Title** | Zero False Positive Claims |
| **Category** | Engineering |
| **Likelihood** | Very High |
| **Impact** | Medium |
| **Risk Level** | High |
| **Description** | VerificationEngine and AuthorizationEngine claim "0 false positives." This is mathematically impossible for all vulnerability types across all applications. Setting this expectation will cause trust issues when FPs inevitably occur. |
| **Mitigation** | Replace with measurable targets: "<1% false positive rate for verified findings" or "All findings include verification evidence for manual review." |
| **Owner** | TBD |
| **Status** | Open |

### RISK-010: Phantom Architecture Documents

| Field | Content |
|-------|------|
| **ID** | RISK-010 |
| **Title** | Phantom Architecture Documents |
| **Category** | Engineering |
| **Likelihood** | Very High |
| **Impact** | High |
| **Risk Level** | Critical |
| **Description** | 49 of 58 referenced subsystem documents do not exist. Implementation team will have no detailed specifications for Scanner, Verification, Browser, OAST, Auth, AuthZ, or any other major subsystem beyond the 1-line implementation contract. |
| **Mitigation** | Generate stub specifications for all critical subsystems before implementation begins. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-011: Tauri Cross-Platform Rendering Inconsistency

| Field | Content |
|-------|------|
| **ID** | RISK-011 |
| **Title** | Tauri Cross-Platform Rendering Inconsistency |
| **Category** | Engineering |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Description** | Tauri uses OS-native WebViews (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux). CSS/JS behavior may differ across platforms. |
| **Mitigation** | Test on all 3 platforms in CI. Use standard CSS. Avoid platform-specific WebView APIs. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-012: Tantivy-SQLite Synchronization

| Field | Content |
|-------|------|
| **ID** | RISK-012 |
| **Title** | Tantivy-SQLite Synchronization |
| **Category** | Engineering |
| **Likelihood** | Medium |
| **Impact** | High |
| **Risk Level** | High |
| **Description** | Dual-write to SQLite and Tantivy means they can become desynchronized on crash. A transaction written to SQLite but not indexed in Tantivy will be invisible to full-text search. |
| **Mitigation** | Index integrity check on startup. Rebuild Tantivy index from SQLite if corruption detected. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-013: Single-Packet Race Timing

| Field | Content |
|-------|------|
| **ID** | RISK-013 |
| **Title** | Single-Packet Race Timing |
| **Category** | Engineering |
| **Likelihood** | Medium |
| **Impact** | Low |
| **Risk Level** | Medium |
| **Description** | HTTP/2 single-packet race attack (sending final bytes of N streams in one TCP packet) depends on OS kernel networking behavior. Cannot be guaranteed from user-space Rust. |
| **Mitigation** | Best-effort implementation. Document limitations. Provide manual timing controls. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-014: HTTPQL Learning Curve

| Field | Content |
|-------|------|
| **ID** | RISK-014 |
| **Title** | HTTPQL Learning Curve |
| **Category** | Adoption |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Description** | Custom query language requires learning new syntax. Power users may resist. |
| **Mitigation** | Visual query builder that generates HTTPQL. Autocomplete. Documentation with examples. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-015: Supply Chain Security

| Field | Content |
|-------|------|
| **ID** | RISK-015 |
| **Title** | Supply Chain Security |
| **Category** | Security |
| **Likelihood** | Medium |
| **Impact** | Critical |
| **Risk Level** | High |
| **Description** | Research packs, WASM plugins, and external tool integrations are all supply chain attack vectors. A compromised research pack could inject malicious payloads. |
| **Mitigation** | Cryptographic signing for research packs. WASM capability sandbox. SBOM generation. Dependency auditing. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-016: Business Logic Testing Automation Limits

| Field | Content |
|-------|------|
| **ID** | RISK-016 |
| **Title** | Business Logic Testing Automation Limits |
| **Category** | Engineering |
| **Likelihood** | Very High |
| **Impact** | Medium |
| **Risk Level** | High |
| **Description** | BusinessLogicEngine claims to track application state sequences and find logic flaws. This is fundamentally limited — inferring correct business workflows without human input is not possible in the general case. |
| **Mitigation** | Position as human-assisted tool. Provide workflow recording (macro) + anomaly detection. Don't claim automated business logic vulnerability discovery. |
| **Owner** | TBD |
| **Status** | Open |

### RISK-017: Legal/License Compliance

| Field | Content |
|-------|------|
| **ID** | RISK-017 |
| **Title** | Legal/License Compliance |
| **Category** | Legal |
| **Likelihood** | Medium |
| **Impact** | High |
| **Risk Level** | High |
| **Description** | License matrix document does not exist. Dependencies like Z3 (MIT), Semgrep (LGPL for OSS rules), CloudFox (MIT) need audit for commercial redistribution. |
| **Mitigation** | Create dependency license audit. Consult legal counsel for LGPL implications. |
| **Owner** | TBD |
| **Status** | Open |
