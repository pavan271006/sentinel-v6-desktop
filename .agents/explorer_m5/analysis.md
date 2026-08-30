# SENTINEL V6: Milestone M5 — Current Vulnerability Intelligence & Emerging Threat Ingestion
## Deep Architectural Analysis, Formal Specifications & Worker Implementation Roadmap

**Author**: SENTINEL M5 Explorer Agent  
**Date**: 2026-08-19  
**Milestone**: M5 (Current Vulnerability Intelligence & Emerging Threat Ingestion — Section 52)  
**Workspace**: `c:\Users\Legion 5 pro\Desktop\cyber sec`  

---

## 1. Executive Summary & Core Architectural Vision

### 1.1 The Vulnerability Intelligence Dilemma in Modern Security Testing
Traditional vulnerability scanners and dynamic application security testing (DAST) tools suffer from a fundamental architectural flaw: **blind banner matching and unverified heuristic reporting**. Standard tools scrape HTTP `Server` headers, software banners, or client-side JavaScript versions and directly generate critical vulnerability alerts solely because a version string falls within a published National Vulnerability Database (NVD) range. This approach creates catastrophic consequences for security teams:
1. **Rampant False Positive Rates (60%–85%)**: Linux enterprise distributions (Ubuntu, Debian, RHEL, Alpine) consistently backport security patches into older upstream versions without incrementing the primary version identifier (e.g. `Apache/2.4.41-4ubuntu3.14` contains backported patches for vulnerabilities in vanilla `2.4.50`). Banner matching blindly flags patched systems as vulnerable.
2. **Alert Fatigue & Operational Paralysis**: Pentesters and security operations engineers waste critical engagement hours manually attempting to reproduce non-existent vulnerabilities.
3. **Destructive & Reckless Exploitation**: Naive automated tools frequently deploy weaponized, public exploit payloads that crash production daemons, corrupt database tables, or overwrite critical files.

### 1.2 The SENTINEL V6 Verification-First Paradigm
SENTINEL V6 resolves this crisis through the **Verification-First Vulnerability Testing Paradigm**. Vulnerability intelligence ingestion is decoupled from finding generation:
- An advisory match against an asset **never** creates a finding.
- An advisory match creates only an internal **Candidate Hypothesis** in the Security Context Graph.
- The engine calculates a **Bayesian Target Technology Confidence Score**; if prerequisites are unmet, testing is skipped.
- The engine executes a **Safe, Strictly Non-Destructive Probe** tailored to the specific vulnerability mechanism.
- A finding is minted **if and only if** deterministic cryptographic proof is captured in Content-Addressed Storage (CAS) with a SHA-256 descriptor.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SENTINEL V6 VULNERABILITY INTELLIGENCE PIPELINE                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
   [ NVD 2.0 API ]       [ CISA KEV ]       [ GHSA GraphQL ]       [ OSV JSON ]       [ Vendor Advisories ]
          │                    │                   │                     │                     │
          └────────────────────┼───────────────────┼─────────────────────┼─────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FEED INGESTION & CACHING SUBSYSTEM                                         │
│  - Scheduled & On-Demand Polling (Rate Limit Aware, Exponential Backoff + Jitter)                                │
│  - Normalization to Canonical Vulnerability Advisory Structure (CVAS)                                            │
│  - High-Performance SQLite Cache + Tantivy Inverted Indexing                                                     │
│  - Air-Gapped Offline Intelligence Pack Export / Import (.sentinel-intel-pack)                                   │
└──────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TECHNOLOGY & VERSION CORRELATION ENGINE                                        │
│  - CPE 2.3 Parser & Canonical Matching Engine                                                                    │
│  - Semantic Version Range Comparator with Distro Backport Patch Resolution                                        │
│  - Multi-Modal Bayesian Confidence Calculation (Headers 0.30, DOM 0.50, Hashes 0.85, Behavioral 0.95)             │
│  - Target Applicability Gate & Fail-Closed Scope Filter (SEC-01) -> Skip Impossible Targets                      │
└──────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VERIFICATION-FIRST CVE TESTING ENGINE                                         │
│                                                                                                                  │
│    [ 1. Advisory Match ]                                                                                         │
│              │                                                                                                   │
│              ▼                                                                                                   │
│    [ 2. Candidate Generated ] (Status: Hypothesized, 0% Finding Pollution)                                       │
│              │                                                                                                   │
│              ▼                                                                                                   │
│    [ 3. Precondition Safety Check ] (Scope OK, Port Active, Tech Confidence >= Threshold)                         │
│              │                                                                                                   │
│              ▼                                                                                                   │
│    [ 4. Safe Non-Destructive Probe ] (Read-only Traversal, Benign Canary, OAST Token, Header Delta)              │
│              │                                                                                                   │
│              ▼                                                                                                   │
│    [ 5. Deterministic Verification ] (HTTP_STATUS_AND_BODY, OAST_CALLBACK, DIFFERENTIAL, TIMING)                 │
│              │                                                                                                   │
│              ▼                                                                                                   │
│    [ 6. CAS Proof Capture & Finding Promotion ] (SHA-256 Descriptor -> FindingLifecycle::Verified)               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Upstream Feed Ingestion & Caching Architecture

### 2.1 Ingestion Source Specifications

| Source | Provider | Ingestion Protocol / Format | Query / Polling Cadence | Rate Limiting & Auth | Primary Focus |
|---|---|---|---|---|---|
| **NVD 2.0** | NIST | REST JSON (`cves/2.0`) | Every 2 Hours (Incremental) | 50 req/30s (API Key), 5 req/30s (No Key). Exp backoff. | Official CVE catalog, CVSS v3.1/v4.0 vectors, CPE 2.3 configurations, CWE mapping |
| **CISA KEV** | US CISA | Static HTTPS JSON | Hourly Polling | Unlimited (Static CDN). Honors ETag / If-Modified-Since. | Mandated actively exploited vulnerabilities in the wild; 100% priority multiplier |
| **GHSA** | GitHub | REST & GraphQL | Hourly Polling | 5,000 req/hour (`Authorization: Bearer <TOKEN>`) | Open-source ecosystem dependencies (npm, PyPI, Go, Maven, Cargo, NuGet, RubyGems) |
| **OSV** | OpenSSF / Google | REST Batch API & GCS Sync | Daily Batch / Realtime Query | Unlimited batch endpoint (`/v1/querybatch`) | Precise commit-level Git hash ranges and semantic package version boundaries |
| **Vendor Advisories** | RedHat, Ubuntu, Debian, Apache, WPScan | CSAF 2.0 / CVRF 1.2 / OVAL JSON | Every 4 Hours | Distribution-specific rate limits | Backported patch resolutions, distribution package versions, workarounds |

### 2.2 Canonical Vulnerability Advisory Schema (CVAS)

All external formats are normalized into a unified, strongly-typed internal representation:

```rust
// In crates/sentinel_common/src/domain/vulnerability.rs (or sentinel_knowledge)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::enums::Severity;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalVulnerabilityAdvisory {
    pub id: String,                         // e.g. "CVE-2024-3094", "GHSA-79g4-hv74-325g"
    pub source: AdvisorySource,             // Nvd, CisaKev, Ghsa, Osv, Vendor
    pub title: String,
    pub description: String,
    pub published_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub severity: Severity,
    pub cvss_v3: Option<CvssV3Data>,
    pub cvss_v4: Option<CvssV4Data>,
    pub epss: Option<EpssData>,
    pub is_cisa_kev: bool,
    pub kev_due_date: Option<String>,
    pub cpe_matches: Vec<CpeMatchCriteria>,
    pub affected_packages: Vec<AffectedPackage>,
    pub cwe_ids: Vec<String>,
    pub references: Vec<String>,
    pub rule_registry_ref: Option<String>,   // References RULE-CVE-XXXX in VULNERABILITY_RULE_REGISTRY.yaml
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AdvisorySource {
    Nvd,
    CisaKev,
    Ghsa,
    Osv,
    Vendor,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CvssV3Data {
    pub base_score: f32,
    pub vector_string: String,
    pub attack_vector: String,
    pub attack_complexity: String,
    pub privileges_required: String,
    pub user_interaction: String,
    pub scope: String,
    pub confidentiality_impact: String,
    pub integrity_impact: String,
    pub availability_impact: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CvssV4Data {
    pub base_score: f32,
    pub vector_string: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EpssData {
    pub score: f32,                         // 0.00000 to 1.00000
    pub percentile: f32,                    // 0.00000 to 1.00000
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CpeMatchCriteria {
    pub criteria: String,                   // CPE 2.3 URI string
    pub vulnerable: bool,
    pub version_start_including: Option<String>,
    pub version_start_excluding: Option<String>,
    pub version_end_including: Option<String>,
    pub version_end_excluding: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AffectedPackage {
    pub ecosystem: String,                  // "npm", "PyPI", "crates.io", "Go", "Maven", "Debian"
    pub name: String,
    pub vulnerable_ranges: Vec<String>,     // SemVer ranges, e.g. ">= 1.0.0, < 1.4.2"
    pub fixed_version: Option<String>,
    pub commit_ranges: Vec<CommitRange>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommitRange {
    pub introduced: Option<String>,
    pub fixed: Option<String>,
}
```

### 2.3 High-Performance Caching & Inverted Indexing
The Ingestion Subsystem writes normalized records into SQLite with WAL mode and maintains a Tantivy inverted index:

```sql
-- SQLite Caching Schema
CREATE TABLE IF NOT EXISTS vuln_advisories (
    id TEXT PRIMARY KEY,                   -- "CVE-2024-3094"
    source TEXT NOT NULL,                  -- "NVD", "CISA_KEV", "GHSA", "OSV"
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    published_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    severity TEXT NOT NULL,
    cvss_v3_score REAL,
    cvss_v3_vector TEXT,
    epss_score REAL,
    is_cisa_kev INTEGER NOT NULL DEFAULT 0,
    kev_due_date TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vuln_advisories_kev ON vuln_advisories(is_cisa_kev);
CREATE INDEX IF NOT EXISTS idx_vuln_advisories_severity ON vuln_advisories(severity);
CREATE INDEX IF NOT EXISTS idx_vuln_advisories_updated ON vuln_advisories(updated_at);

CREATE TABLE IF NOT EXISTS vuln_cpe_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advisory_id TEXT NOT NULL,
    cpe_uri TEXT NOT NULL,
    part TEXT NOT NULL,
    vendor TEXT NOT NULL,
    product TEXT NOT NULL,
    version_start TEXT,
    version_end TEXT,
    FOREIGN KEY(advisory_id) REFERENCES vuln_advisories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vuln_cpe_vendor_product ON vuln_cpe_index(vendor, product);

CREATE TABLE IF NOT EXISTS vuln_feed_sync_meta (
    feed_source TEXT PRIMARY KEY,
    last_sync_time TEXT NOT NULL,
    etag TEXT,
    last_modified TEXT,
    records_synced INTEGER NOT NULL,
    sync_status TEXT NOT NULL
);
```

---

## 3. Technology & Version Confidence Correlation Engine

### 3.1 CPE 2.3 Parser & Formatter
The engine implements strict NIST IR 7695 (Common Platform Enumeration: Naming Specification Version 2.3) parsing:
- **Format**: `cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>`
- **Components**:
  - `part`: `a` (Application), `o` (Operating System), `h` (Hardware Device).
  - Special values: `*` (Any / Wildcard), `-` (Not Applicable / Unspecified).
  - Quoted characters (`\:`, `\/`, `\~`) unescaped correctly.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cpe23Uri {
    pub part: CpePart,
    pub vendor: String,
    pub product: String,
    pub version: String,
    pub update: String,
    pub edition: String,
    pub language: String,
    pub sw_edition: String,
    pub target_sw: String,
    pub target_hw: String,
    pub other: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CpePart {
    Application,     // "a"
    OperatingSystem, // "o"
    Hardware,        // "h"
    Any,             // "*"
}

impl Cpe23Uri {
    pub fn parse(uri: &str) -> Result<Self, SentinelError> {
        let parts: Vec<&str> = uri.split(':').collect();
        if parts.len() < 5 || parts[0] != "cpe" || parts[1] != "2.3" {
            return Err(SentinelError::Validation(format!("Invalid CPE 2.3 format: {}", uri)));
        }
        
        let part = match parts.get(2).copied().unwrap_or("*") {
            "a" => CpePart::Application,
            "o" => CpePart::OperatingSystem,
            "h" => CpePart::Hardware,
            _ => CpePart::Any,
        };

        Ok(Self {
            part,
            vendor: parts.get(3).unwrap_or(&"*").to_string(),
            product: parts.get(4).unwrap_or(&"*").to_string(),
            version: parts.get(5).unwrap_or(&"*").to_string(),
            update: parts.get(6).unwrap_or(&"*").to_string(),
            edition: parts.get(7).unwrap_or(&"*").to_string(),
            language: parts.get(8).unwrap_or(&"*").to_string(),
            sw_edition: parts.get(9).unwrap_or(&"*").to_string(),
            target_sw: parts.get(10).unwrap_or(&"*").to_string(),
            target_hw: parts.get(11).unwrap_or(&"*").to_string(),
            other: parts.get(12).unwrap_or(&"*").to_string(),
        })
    }

    pub fn matches_target(&self, detected_vendor: &str, detected_product: &str) -> bool {
        let vendor_match = self.vendor == "*" || self.vendor.eq_ignore_ascii_case(detected_vendor);
        let product_match = self.product == "*" || self.product.eq_ignore_ascii_case(detected_product);
        vendor_match && product_match
    }
}
```

### 3.2 Semantic Version Range Comparator & Distro Backport Resolution
The version matching engine supports full SemVer 2.0 comparison and custom distribution patch string parsing:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemVersion {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    pub distro_build: Option<String>,   // e.g. "4ubuntu3.14"
}

impl SemVersion {
    pub fn parse(v: &str) -> Option<Self> {
        let clean = v.trim_start_matches(|c: char| c == 'v' || c == 'V' || c == '=');
        let parts: Vec<&str> = clean.split(|c| c == '.' || c == '-').collect();
        if parts.is_empty() { return None; }
        
        let major = parts[0].parse().ok()?;
        let minor = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
        let patch = parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);
        let distro_build = if parts.len() > 3 {
            Some(parts[3..].join("-"))
        } else {
            None
        };

        Some(Self { major, minor, patch, distro_build })
    }

    pub fn satisfies_range(&self, start_inc: Option<&str>, end_inc: Option<&str>, end_exc: Option<&str>) -> bool {
        if let Some(start) = start_inc.and_then(SemVersion::parse) {
            if self < &start { return false; }
        }
        if let Some(end) = end_inc.and_then(SemVersion::parse) {
            if self > &end { return false; }
        }
        if let Some(end) = end_exc.and_then(SemVersion::parse) {
            if self >= &end { return false; }
        }
        true
    }
}

impl PartialOrd for SemVersion {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SemVersion {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.major.cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
    }
}
```

### 3.3 Bayesian Target Technology Confidence Scoring Algorithm
To prevent running tests against unrelated software, SENTINEL computes a **Bayesian Target Technology Confidence Score** $P(\text{Tech} \mid E_1, \dots, E_n)$:

$$\text{Confidence}(T) = 1.0 - \prod_{i=1}^k \Big(1.0 - w_i \cdot c_i\Big)$$

Where:
- $w_i$ is the source reliability weight:
  - **Passive Response Headers ($w = 0.30$)**: `Server: Apache/2.4.49`, `X-Powered-By: PHP/8.1`, `X-AspNet-Version`.
  - **Body & DOM Signatures ($w = 0.50$)**: `<meta name="generator" content="WordPress">`, script bundle paths, component markup.
  - **Static Asset Cryptographic Hashes ($w = 0.85$)**: Favicon MurmurHash3, known jQuery/React bundle SHA-256 hashes.
  - **Active / Behavioral Probes ($w = 0.95$)**: Framework-specific 404 error page layouts (Spring Whitelabel, Django debug, Tomcat stack trace), HTTP/2 pseudo-header handling.
- $c_i \in [0.0, 1.0]$ is the match quality confidence of evidence item $E_i$.

**Target Filtering Decision**:
$$\text{Action} = \begin{cases} 
\text{Proceed to Candidate Precondition Check} & \text{if } \text{Confidence}(T) \ge T_{\text{threshold}} \text{ and Target is in Scope (SEC-01)} \\
\text{Skip Target (Record Audit Event)} & \text{otherwise}
\end{cases}$$

---

## 4. Verification-First CVE Testing Methodology

### 4.1 The 6-Stage Vulnerability Lifecycle

```
[1. Advisory Match] ──> [2. Candidate Generated] ──> [3. Precondition Check] ──> [4. Safe Non-Destructive Probe] ──> [5. Deterministic Verification] ──> [6. CAS Proof Capture & Finding Promotion]
```

1. **Advisory Match**: The engine correlates target technology and version with the advisory database or `VULNERABILITY_RULE_REGISTRY.yaml`.
2. **Candidate Generation**: A `Candidate` domain entity is created with state `Hypothesized`. **Zero confirmed findings are created.**
3. **Precondition Safety Check**: The engine verifies:
   - Target URL / IP passes `SEC-01` Fail-Closed Scope Gate.
   - Target service / port is reachable.
   - Required authentication context / session is valid (if authenticated check).
   - Rate limit / active scan budget allows outbound probe.
4. **Safe Non-Destructive Probe**: Executes a minimally invasive request:
   - Safe path traversal probe (e.g. requesting `/%2e%2e/%2e%2e/etc/hosts` or benign public asset).
   - Benign math expression canary in template engine (e.g. `{{7*777}}` -> `5439`).
   - Harmless OAST token injection in request headers (`${jndi:ldap://token.oast.internal/a}`).
   - Syntax canary probe that triggers a benign parser differential without modifying server state.
   - **Destructive Payload Ban**: Absolutely zero `DROP TABLE`, `rm -rf`, file uploads, memory exhaustion, or state-modifying requests.
5. **Deterministic Verification**: Response evaluated using rule-defined verification strategy:
   - `HTTP_STATUS_AND_BODY`: Exact status code match (e.g. 200) AND body regex / exact pattern match.
   - `HTTP_DIFFERENTIAL_RESPONSE`: Divergence between normal baseline and mutated request.
   - `OAST_CALLBACK`: Interaction record received on the OAST server matching generated cryptographic token.
   - `TIMING_STATISTICAL`: Welch's t-test showing statistically significant delay on sleep canary vs baseline.
   - `DYNAMIC_SYMBOL_VERIFICATION`: Non-destructive inspection of dynamic symbol or banner traits.
6. **Cryptographic CAS Proof & Finding Promotion**: Raw probe request and response bytes are hashed (SHA-256) and saved in the Content-Addressed Blob Storage (`BlobStorage`). The `Candidate` is promoted to a verified `Finding` with state `FindingLifecycle::Verified` and linked to the CAS descriptor. If verification fails, the candidate is discarded as `NotVulnerable` with zero false alarms.

---

## 5. Deliverable Artifacts Specifications

### 5.1 Artifact 1: `CURRENT_VULNERABILITY_INTELLIGENCE.md`
- **Scope**: Comprehensive platform document defining the vulnerability intelligence subsystem architecture, feed ingestion workflows, Bayesian technology correlation math, backported patch resolution algorithms, and Verification-First testing lifecycle.
- **Key Sections**:
  1. Executive Summary & Core Objectives
  2. Upstream Intelligence Sources & Ingestion Protocols (NVD 2.0, CISA KEV, GHSA, OSV, Vendor feeds)
  3. Technology & Version Confidence Correlation Algorithm (Bayesian belief model, evidence weighting, CPE matching)
  4. Verification-First CVE Testing Methodology (Candidate generation, precondition checks, safe probes, CAS proof capture)
  5. Security & Safety Invariants (SEC-01 scope gate, SEC-07 CAS proof, SEC-09 secret protection, destructive payload prohibitions)

### 5.2 Artifact 2: `CURRENT_VULNERABILITY_SOURCE_MATRIX.md`
- **Scope**: Canonical matrix of all upstream vulnerability feeds, ingestion endpoints, transport protocols, rate limit specifications, data schemas, and parser implementations.
- **Key Sections**:
  1. Master Intelligence Source Mapping Table
  2. Detailed Ingestion Endpoints & Transport Specifications (NVD 2.0, CISA KEV, GHSA, OSV, RedHat, Ubuntu, Debian, Apache, WPScan)
  3. Data Schemas & Normalization Contracts (`CanonicalVulnerabilityAdvisory`, CVSS v3.1/v4.0, EPSS, CPE 2.3)
  4. Feed Parser Implementations (TypeScript and Rust parser routines)
  5. Automated Synchronization Schedule, Caching Strategy & Air-Gapped Operation

### 5.3 Artifact 3: `VULNERABILITY_RULE_REGISTRY.yaml`
- **Scope**: Definitive catalog of real-world CVE detection signatures, target technology prerequisites, non-destructive probe configurations, verification evaluators, and remediation guidance.
- **Real CVE Signatures Included**:
  1. `RULE-CVE-2024-3094`: XZ Utils / liblzma Backdoor (OpenSSH / liblzma dynamic symbol check)
  2. `RULE-CVE-2021-44228`: Apache Log4j2 JNDI RCE (Log4Shell OAST DNS/LDAP callback)
  3. `RULE-CVE-2024-27198`: JetBrains TeamCity Auth Bypass (`/hsqldb%2Fapp%2Frest%2Fserver` status and body check)
  4. `RULE-CVE-2023-38606`: Apple Kernel MMIO Operation Triangulation
  5. `RULE-CVE-2023-4863`: libwebp Heap Buffer Overflow
  6. `RULE-CVE-2022-22965`: Spring Framework RCE (Spring4Shell DataBinder differential check)
  7. `RULE-CVE-2021-41773`: Apache HTTP Server 2.4.49 Path Traversal (`/icons/.%%32%65/etc/hosts`)
  8. `RULE-CVE-2023-34362`: Progress MOVEit Transfer SQLi (`/moveitisapi/moveitisapi.dll`)
  9. `RULE-CVE-2024-38856`: Apache OFBiz View-Handler Unauthenticated RCE
  10. `RULE-CVE-2023-22527`: Atlassian Confluence Data Center SSTI (`label={{7*777}}` -> `5439`)
  11. `RULE-CVE-2024-4577`: PHP-CGI Windows Argument Injection
  12. `RULE-CVE-2023-46604`: Apache ActiveMQ OpenWire Deserialization RCE
  13. `RULE-CVE-2024-21626`: runc Container Escape via Leaked File Descriptor
  14. `RULE-CVE-2023-29357`: Microsoft SharePoint Server Authentication Bypass

### 5.4 Artifact 4: `CURRENT_VULNERABILITY_UI_SPEC.md`
- **Scope**: Complete UI/UX specification for the interactive Vulnerability Intelligence Workspace in the SENTINEL V6 Desktop Application.
- **Key Sections**:
  1. Workspace Layout & Component Hierarchy (Advisory Browser, Target Intelligence Panel, Verification Timeline)
  2. UI Component Specifications & Badges (Technology Correlation Badges, CISA KEV Active Badge, Exploit Public Badge, Verification Status Indicators)
  3. Zustand State Store Design (`useVulnIntelStore`)
  4. IPC Commands & Event Subscriptions (`vuln_intel:sync_feeds`, `vuln_intel:search_advisories`, `vuln_intel:run_verification_probe`, `vuln_intel:stream_verification_progress`)
  5. Keyboard Shortcuts, Virtualized Advisory Table, and Accessibility Standards

---

## 6. Rust Data Structures, Traits & Algorithms

### 6.1 Proposed Rust Traits (`sentinel_knowledge` / `sentinel_verification`)

```rust
// Proposed trait for Vulnerability Intelligence Feed Ingestion
#[async_trait]
pub trait VulnerabilityFeedIngester: Send + Sync {
    async fn sync_feed(&self, source: AdvisorySource) -> Result<FeedSyncReport, SentinelError>;
    async fn query_advisories(&self, query: &AdvisoryQuery) -> Result<Vec<CanonicalVulnerabilityAdvisory>, SentinelError>;
    async fn match_cpe(&self, cpe: &Cpe23Uri) -> Result<Vec<CanonicalVulnerabilityAdvisory>, SentinelError>;
}

// Proposed trait for Verification-First Rule Evaluation
#[async_trait]
pub trait VulnerabilityRuleEngine: Send + Sync {
    async fn load_rule_registry(&mut self, yaml_content: &str) -> Result<usize, SentinelError>;
    async fn evaluate_candidate(&self, candidate: &Candidate, target_url: &str) -> Result<VerificationResult, SentinelError>;
    fn list_active_rules(&self) -> Vec<VulnerabilityRule>;
}
```

### 6.2 The Verification-First Rule Structs

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityRule {
    pub id: String,
    pub cve_id: String,
    pub title: String,
    pub category: String,
    pub severity: Severity,
    pub cvss_v3_score: f32,
    pub is_cisa_kev: bool,
    pub cpe_matches: Vec<String>,
    pub technology_prerequisites: Vec<TechPrerequisite>,
    pub safe_probe: SafeProbeConfig,
    pub verification: RuleVerificationConfig,
    pub remediation: RemediationAdvice,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechPrerequisite {
    pub name: String,
    pub confidence_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeProbeConfig {
    pub method: String,                     // "GET", "POST", "HEAD"
    pub path: Option<String>,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub non_destructive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleVerificationConfig {
    pub verification_type: RuleVerificationType,
    pub expected_status: Option<u16>,
    pub body_regex: Option<String>,
    pub exact_pattern: Option<String>,
    pub oast_protocol: Option<String>,
    pub cas_proof_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RuleVerificationType {
    HttpStatusAndBody,
    HttpDifferentialResponse,
    OastCallback,
    TimingStatistical,
    DynamicSymbolVerification,
    StaticVersionCheck,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAdvice {
    pub guidance: String,
    pub fixed_version: Option<String>,
}
```

---

## 7. Step-by-Step Worker Implementation Plan

To complete Milestone M5, the Worker agent will execute the following step-by-step implementation:

### Step 1: Core Deliverable Documentation & Specifications
1. Verify and enhance `CURRENT_VULNERABILITY_INTELLIGENCE.md` in workspace root.
2. Verify and enhance `CURRENT_VULNERABILITY_SOURCE_MATRIX.md` in workspace root.
3. Verify and enhance `VULNERABILITY_RULE_REGISTRY.yaml` with all 14+ canonical real-world CVE signatures.
4. Verify and enhance `CURRENT_VULNERABILITY_UI_SPEC.md` in workspace root.

### Step 2: Rust Backend Modules & Tests
1. **Domain & Data Structures**:
   - Ensure `CanonicalVulnerabilityAdvisory`, `Cpe23Uri`, `SemVersion`, `VulnerabilityRule` are declared and tested.
2. **CPE 2.3 Parsing & Matching Tests**:
   - Add unit tests verifying parsing of valid and malformed CPE 2.3 URIs, wildcard resolution, and target matching.
3. **Semantic Version & Backport Range Matching Tests**:
   - Add unit tests verifying SemVer comparisons, bounded ranges (`>= 2.4.0, < 2.4.50`), and Ubuntu/Debian backport package parsing.
4. **Bayesian Technology Confidence Scoring Tests**:
   - Add unit tests validating multi-source evidence combination, weight clamping in $[0.0, 1.0]$, and threshold-based target skipping.
5. **Verification-First Rule Execution Tests**:
   - Add unit tests verifying the 6-stage lifecycle: Advisory Match -> Candidate -> Precondition Check -> Safe Probe -> Deterministic Verification -> CAS Evidence Capture -> Verified Finding.
   - Verify negative control tests: when probe returns non-vulnerable baseline, Candidate is discarded with zero unverified findings created.

### Step 3: Frontend UI Components, Stores & Vitest Suites
1. **Types & Models**:
   - Update `src/types/models.ts` or add `src/types/vulnIntel.ts` with `CanonicalVulnerabilityAdvisory`, `TechnologyConfidenceBadge`, and `VerificationTimelineStage`.
2. **Zustand Store**:
   - Create or update `src/stores/vulnIntelStore.ts` managing advisory feeds, active filters, selected CVE, and live verification probe execution.
3. **UI Workspace & Views**:
   - Create or enhance `src/workspaces/VulnIntelWorkspaceView.tsx` (or integrate directly into `src/workspaces/ScannerWorkspaceView.tsx` and `src/workspaces/FindingsWorkspaceView.tsx`).
4. **Vitest Unit & Component Tests**:
   - Add `tests/unit/cpeParser.test.ts` or `tests/stores/vulnIntelStore.test.ts` validating feed search, KEV filter toggle, technology confidence calculation, and CAS evidence linking.

### Step 4: Full Quality Gate Verification
1. Run `cargo test --workspace --locked` to ensure 100% pass across all Rust workspace crates.
2. Run `npm test` to ensure 100% pass across all Vitest suites.
3. Run `python architecture/v6/validate_v6_spec.py` to ensure 11/11 checks pass with 0 blockers and 0 warnings.
4. Produce `FINAL_VULNERABILITY_INTELLIGENCE_REPORT.md` confirming completion.

---

## 8. Summary of Findings & Conclusion

Milestone M5 addresses one of the most critical challenges in automated offensive security testing: **eradicating false positive banner alerts while maintaining rapid ingestion and safe verification of emerging zero-days and KEVs**. By formalizing the **Verification-First Paradigm**, implementing **Bayesian technology confidence gating**, and enforcing **cryptographic CAS evidence capture**, SENTINEL V6 achieves unparalleled accuracy and safety in vulnerability intelligence operations.
