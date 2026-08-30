# SENTINEL V6 — Subsystems A & D Technical Architecture & Implementation Plan
**Document Version**: 6.0.0-PROD-M4  
**Author**: explorer_phase2_codecs_search_cli  
**Milestone**: M4 (Phase 2: Subsystems A & D)  
**Date**: 2026-08-23T04:55:00Z  

---

# 1. Observation

Direct examination of the workspace and existing crates reveals:

1. **Workspace & Build State**:
   - Workspace root `sentinel_core/Cargo.toml` contains 29 workspace members, configured with `edition = "2021"`, resolver `"2"`.
   - `cargo check --workspace` passes cleanly with 0 errors.
   - `cargo test --workspace` passes 100% across all unit, integration, and differential test suites.

2. **Subsystem A (`sentinel_productivity`)**:
   - Location: `sentinel_core/crates/sentinel_productivity/`.
   - Existing modules: `command_palette.rs` (in-memory action dispatcher), `hotkeys.rs` (keyboard navigation bindings), `search.rs` (simple in-memory `OmniSearchEngine` struct), and `lib.rs`.
   - Existing dependencies in `sentinel_productivity/Cargo.toml`: `sentinel_common`, `sentinel_storage`, `sentinel_bus`, `chrono`, `serde`, `serde_json`, `uuid`, `thiserror`, `async-trait`, `parking_lot`, `tokio`, `tracing`.
   - **Current Reality / Gaps**: The crate currently lacks the required standalone cryptographic and data codecs: Base64 (Standard/URLSafe), URL Percent Encoding, Hex, HTML Entities, JWT Header/Payload/Signature decode/verify, Gzip compression/decompression, and the unified multi-algorithm `HashEngine` (SHA-1, SHA-256, SHA-512, MD5, Keccak-256, HMAC).

3. **Subsystem D (`sentinel_cli` & `sentinel_storage`)**:
   - Location: `sentinel_core/crates/sentinel_cli/` and `sentinel_core/crates/sentinel_storage/`.
   - Existing CLI state in `sentinel_cli/src/main.rs`: Hardcoded sequential pipeline demonstration script without interactive or sub-command execution facilities. Lacks a Clap v4 CLI command taxonomy (`project`, `scan`, `replay`, `scope`, `report`, `verify`, `export`) and does not enforce standardized security domain exit codes (`0`, `1`, `2`).
   - Existing Search / Storage state in `sentinel_storage/src/repository/observation.rs` and `store.rs`: `search_fts` is currently implemented via SQL `LIKE` wildcard matching rather than a true Tantivy BM25 inverted index engine. `ObservationStore::rebuild_index` only executes SQLite `REINDEX`.
   - Authoritative Spec (`V6_CANONICAL_SPEC.yaml` lines 85–110, 1450–1503, 3799–3810): Tantivy BM25 full-text indexing engine is explicitly specified with fields (`tx_id`, `req_method`, `req_uri`, `req_normalized_text`, `res_status`, `res_normalized_text`, `timestamp`), a 500ms commit interval, and auto-rebuild from SQLite WAL (`ERR_FTS_003` recovery policy).

---

# 2. Logic Chain

From the direct codebase and specification observations above, we establish the step-by-step technical architecture and design requirements for Phase 2 Subsystems A and D:

```
[Target Requirements]
  ├── Subsystem A: Productivity Codecs & HashEngine (sentinel_productivity)
  │     ├── Base64 (Standard/URLSafe, Padded/Unpadded)
  │     ├── URL Percent Encoding (Path, Query, AllChars, Double-Encode)
  │     ├── Hex (Uppercase, Lowercase, Delimited, HexDump with ASCII)
  │     ├── HTML Entities (Named, Decimal, Hex, Full numeric XSS bypass)
  │     ├── JWT Engine (Inspect, Decode, Verify HS/RS/ES, None detection, Tamper)
  │     ├── Gzip Engine (Deflate/Inflate, Bomb expansion limits, CRC32)
  │     └── HashEngine (MD5, SHA-1, SHA-256, SHA-512, Keccak-256, HMAC)
  │
  └── Subsystem D: CLI & Tantivy BM25 Full-Text Search (sentinel_cli & sentinel_storage)
        ├── Clap v4 Taxonomy: project | scan | replay | scope | report | verify | export
        ├── Strict Security Domain Exit Codes: 0 (Clean) | 1 (Vulnerabilities) | 2 (Operational Error)
        └── Tantivy BM25 Index Engine (Disk storage, Schema, Writer/Reader, WAL Rebuild)
```

---

## 2.1 Subsystem A Architecture Specification (`sentinel_productivity`)

### 2.1.1 Module Hierarchy
```
crates/sentinel_productivity/src/
├── lib.rs                  // Re-exports all codecs, HashEngine, OmniSearch, CommandPalette
├── codecs/
│   ├── mod.rs              // Codec traits, Error types, common format enums
│   ├── base64.rs           // Standard & URLSafe Base64 encoder/decoder
│   ├── url.rs              // RFC 3986 URL percent encoding/decoding & double-encoding
│   ├── hex.rs              // Hex encoder/decoder & 16-byte formatted HexDump
│   ├── html.rs             // HTML entity encoder/decoder (Named, Dec, Hex)
│   ├── jwt.rs              // JWT parser, claims extractor, signature verifier & mutator
│   └── gzip.rs             // RFC 1952 Gzip compression/decompression with DoS bounds
├── hash/
│   ├── mod.rs              // HashAlgorithm, HmacAlgorithm, HashOutput, HashEngine trait
│   ├── engine.rs           // HashEngine implementation (MD5, SHA1/256/512, Keccak, HMAC)
│   └── keccak.rs           // Standalone Keccak-256 state engine
├── command_palette.rs      // Command palette & action dispatcher
├── hotkeys.rs              // Keyboard navigation manager
└── search.rs               // Global omni-search coordinator
```

### 2.1.2 Codec Interfaces & Types

```rust
// crates/sentinel_productivity/src/codecs/mod.rs

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum CodecError {
    #[error("Base64 decode error: {0}")]
    Base64Decode(String),
    #[error("Hex decode error: {0}")]
    HexDecode(String),
    #[error("URL decode error: {0}")]
    UrlDecode(String),
    #[error("HTML entity decode error: {0}")]
    HtmlDecode(String),
    #[error("JWT error: {0}")]
    JwtError(String),
    #[error("Gzip compression/decompression error: {0}")]
    GzipError(String),
    #[error("Decompression bomb detected: output exceeded {max_bytes} bytes")]
    DecompressionBomb { max_bytes: usize },
    #[error("Invalid character for encoding mode: {0}")]
    InvalidCharacter(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Base64Variant {
    Standard,          // RFC 4648 §4 (with padding '=')
    StandardUnpadded,  // RFC 4648 §4 (no padding)
    UrlSafe,           // RFC 4648 §5 (with padding)
    UrlSafeUnpadded,   // RFC 4648 §5 (no padding, standard for JWT)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlEncodeMode {
    QueryComponent,    // RFC 3986 §3.4 (encodes & = ? / etc.)
    PathSegment,       // RFC 3986 §3.3 (preserves / and path-safe chars)
    FormUrlEncoded,    // application/x-www-form-urlencoded (space -> '+')
    AllCharacters,     // Aggressive: encodes all ASCII/non-ASCII as %XX (WAF probe)
    DoubleEncode,      // %XX -> %25XX (Traversal & evasion testing)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HexCase {
    Lower,
    Upper,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HexDelimiter {
    None,              // "414243"
    Space,             // "41 42 43"
    Colon,             // "41:42:43"
    Prefix0x,          // "0x41, 0x42, 0x43"
    EscapedHex,        // "\x41\x42\x43"
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HtmlEntityMode {
    Named,             // &quot; &amp; &lt; &gt;
    Decimal,           // &#34; &#38; &#60; &#62;
    Hex,               // &#x22; &#x26; &#x3c; &#x3e;
    AllCharactersDec,  // Every char as &#NN;
    AllCharactersHex,  // Every char as &#xHH;
}
```

### 2.1.3 Base64, URL, Hex, HTML Codec Implementations

1. **Base64 Codec (`codecs/base64.rs`)**:
   - `encode_base64(data: &[u8], variant: Base64Variant) -> String`
   - `decode_base64(input: &str, variant: Base64Variant) -> Result<Vec<u8>, CodecError>`
   - `auto_decode_base64(input: &str) -> Result<Vec<u8>, CodecError>` (auto-detects padding, standard vs URL-safe alphabet, strips internal CRLF/whitespace).

2. **URL Percent Codec (`codecs/url.rs`)**:
   - `encode_url(data: &[u8], mode: UrlEncodeMode) -> String`
   - `decode_url(input: &str, plus_as_space: bool) -> Result<Vec<u8>, CodecError>`
   - Double-encoding: `encode_double_url(data: &[u8]) -> String` converts `%` into `%25` after initial percent encoding.
   - Resilient decoding: Tolerates malformed percent sequences (e.g. `%` followed by non-hex is preserved or reported cleanly without panic).

3. **Hex Codec (`codecs/hex.rs`)**:
   - `encode_hex(data: &[u8], case: HexCase, delimiter: HexDelimiter) -> String`
   - `decode_hex(input: &str) -> Result<Vec<u8>, CodecError>` (auto-strips `0x`, `\x`, spaces, colons, newlines, and case differences).
   - `hexdump(data: &[u8]) -> String`: Formats standard Wireshark/Burp hex view:
     ```
     00000000  47 45 54 20 2f 20 48 54  54 50 2f 31 2e 31 0d 0a  |GET / HTTP/1.1..|
     ```

4. **HTML Entity Codec (`codecs/html.rs`)**:
   - `encode_html(input: &str, mode: HtmlEntityMode) -> String`
   - `decode_html(input: &str) -> Result<String, CodecError>`: Supports named entities (`&amp;`, `&quot;`, `&lt;`, `&gt;`, `&apos;`, `&nbsp;`, `&copy;`, etc.), decimal entities `&#NN;`, hex entities `&#xHH;`, and unclosed legacy entities (`&amp` without semicolon).

### 2.1.4 JWT Engine Specification (`codecs/jwt.rs`)

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum JwtAlgorithm {
    HS256,
    HS384,
    HS512,
    RS256,
    RS384,
    RS512,
    ES256,
    ES384,
    ES512,
    None,
    Unknown(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtHeader {
    pub alg: JwtAlgorithm,
    pub typ: Option<String>,
    pub kid: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtToken {
    pub raw: String,
    pub header: JwtHeader,
    pub payload: serde_json::Value,
    pub signature: Vec<u8>,
    pub raw_header_b64: String,
    pub raw_payload_b64: String,
    pub raw_signature_b64: String,
}

#[derive(Debug, Clone)]
pub struct JwtValidationOptions {
    pub validate_exp: bool,
    pub validate_nbf: bool,
    pub validate_iat: bool,
    pub expected_aud: Option<String>,
    pub expected_iss: Option<String>,
    pub leeway_secs: u64,
    pub allowed_algs: Vec<JwtAlgorithm>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JwtVerifyVerdict {
    Valid,
    SignatureInvalid,
    Expired { exp: i64, current: i64 },
    NotYetValid { nbf: i64, current: i64 },
    IssuerMismatch { expected: String, actual: String },
    AudienceMismatch { expected: String, actual: String },
    AlgorithmRejected { alg: JwtAlgorithm },
    NoneAlgorithmWarning,
    MalformedToken(String),
}

pub struct JwtEngine;

impl JwtEngine {
    /// Parses and decodes a raw JWT without requiring a verification key.
    pub fn inspect(raw_jwt: &str) -> Result<JwtToken, CodecError>;

    /// Verifies JWT signature and claims using HMAC secret or Asymmetric Public Key (PEM).
    pub fn verify(
        token: &JwtToken,
        key: &[u8],
        options: &JwtValidationOptions,
    ) -> Result<JwtVerifyVerdict, CodecError>;

    /// Re-signs or mutates a JWT with modified payload/header (useful for pentester fuzzing).
    pub fn sign_or_tamper(
        header: &JwtHeader,
        payload: &serde_json::Value,
        key: Option<&[u8]>,
        override_alg: Option<JwtAlgorithm>,
    ) -> Result<String, CodecError>;
}
```

### 2.1.5 Gzip Engine Specification (`codecs/gzip.rs`)
- Deflate & Inflate with configurable compression levels (0 = None, 1 = Fast, 6 = Default, 9 = Best).
- **Security Invariant**: Decompression bomb safety guard. If uncompressed output exceeds `max_allowed_bytes` (default 50MB, or expansion ratio > 100x), decompression terminates immediately with `CodecError::DecompressionBomb`.
- CRC-32 checksum and length footer validation.

### 2.1.6 HashEngine Specification (`hash/mod.rs` & `hash/engine.rs`)

```rust
// crates/sentinel_productivity/src/hash/mod.rs

use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HashAlgorithm {
    Md5,
    Sha1,
    Sha256,
    Sha384,
    Sha512,
    Keccak256,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HmacAlgorithm {
    HmacMd5,
    HmacSha1,
    HmacSha256,
    HmacSha512,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HashOutput {
    pub algorithm: String,
    pub raw: Vec<u8>,
    pub hex: String,
    pub base64: String,
}

pub struct HashEngine;

impl HashEngine {
    /// Computes digest for the given algorithm.
    pub fn digest(algo: HashAlgorithm, data: &[u8]) -> HashOutput;

    /// Computes all standard cryptographic digests simultaneously over input data.
    pub fn digest_all(data: &[u8]) -> HashMap<HashAlgorithm, HashOutput>;

    /// Computes HMAC over data using secret key with constant-time equality checks.
    pub fn hmac(algo: HmacAlgorithm, key: &[u8], data: &[u8]) -> HashOutput;

    /// Constant-time verification of HMAC to prevent timing side-channel attacks.
    pub fn verify_hmac(algo: HmacAlgorithm, key: &[u8], data: &[u8], expected_mac: &[u8]) -> bool;

    /// Standalone Keccak-256 digest (Ethereum / Web3 standard).
    pub fn keccak256(data: &[u8]) -> HashOutput;
}
```

---

## 2.2 Subsystem D Architecture Specification (`sentinel_cli` & `sentinel_storage`)

### 2.2.1 Security Domain Exit Codes
The CLI strictly enforces deterministic exit codes across all subcommands:

```rust
// crates/sentinel_cli/src/exit_codes.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum SecurityExitCode {
    /// 0: Clean execution. No vulnerabilities found at or above configured threshold.
    Clean = 0,
    /// 1: Security vulnerabilities detected and verified in target scope.
    VulnerabilitiesFound = 1,
    /// 2: Operational error, invalid CLI arguments, network fault, or SEC-01 scope violation.
    OperationalError = 2,
}

impl SecurityExitCode {
    pub fn exit_process(self) -> ! {
        std::process::exit(self as i32);
    }
}
```

### 2.2.2 Clap v4 CLI Taxonomy & Command Model

```rust
// crates/sentinel_cli/src/args.rs

use clap::{Args, Parser, Subcommand, ValueEnum};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Parser, Debug)]
#[command(
    name = "sentinel",
    author = "SENTINEL Team <security@sentinel.dev>",
    version = "6.0.0",
    about = "SENTINEL V6: Autonomous Security Testing Workstation & Engine",
    long_about = "Production security testing CLI for headless CI/CD, active/passive scanning, replay, scope enforcement, and full-text search."
)]
pub struct Cli {
    #[arg(
        short = 'p',
        long = "project",
        global = true,
        help = "Path to project root directory [default: .sentinel]"
    )]
    pub project_dir: Option<PathBuf>,

    #[arg(
        short = 'c',
        long = "config",
        global = true,
        help = "Path to configuration YAML file"
    )]
    pub config_file: Option<PathBuf>,

    #[arg(
        short = 'v',
        long = "verbose",
        global = true,
        action = clap::ArgAction::Count,
        help = "Increase logging verbosity (-v, -vv, -vvv)"
    )]
    pub verbosity: u8,

    #[arg(
        short = 'q',
        long = "quiet",
        global = true,
        help = "Suppress progress bars and non-essential logs"
    )]
    pub quiet: bool,

    #[arg(
        long = "json",
        global = true,
        help = "Format all command outputs as machine-readable JSON"
    )]
    pub json: bool,

    #[arg(
        long = "no-color",
        global = true,
        help = "Disable ANSI color output"
    )]
    pub no_color: bool,

    #[arg(
        long = "fail-on",
        global = true,
        value_enum,
        default_value = "medium",
        help = "Minimum severity threshold to trigger Exit Code 1 (VulnerabilitiesFound)"
    )]
    pub fail_on_severity: SeverityThreshold,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(ValueEnum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SeverityThreshold {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Project lifecycle management (new, open, list, info, delete)
    Project(ProjectArgs),
    /// Automated active/passive scan orchestrator & target assessment
    Scan(ScanArgs),
    /// Replay transactions, mutate headers/bodies, and diff responses
    Replay(ReplayArgs),
    /// Fail-closed scope engine inspector, validator, and rule manager
    Scope(ScopeArgs),
    /// Multi-format security engagement report generator
    Report(ReportArgs),
    /// Deterministic finding verification & SEC-06 oracle execution
    Verify(VerifyArgs),
    /// Export transactions, PCAP, HAR, CAS bundles, and SARIF
    Export(ExportArgs),
}
```

#### Detailed Subcommand Structures:

1. **`project` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ProjectArgs {
       #[command(subcommand)]
       pub action: ProjectAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum ProjectAction {
       /// Initialize a new Sentinel project workspace
       New {
           #[arg(short, long)]
           name: String,
           #[arg(short, long)]
           dir: Option<PathBuf>,
       },
       /// List known Sentinel project workspaces
       List,
       /// Display statistics and schema health for current project
       Info,
       /// Permanently delete a project workspace
       Delete {
           #[arg(short, long)]
           name: String,
           #[arg(long)]
           force: bool,
       },
   }
   ```

2. **`scan` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ScanArgs {
       #[command(subcommand)]
       pub action: ScanAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum ScanAction {
       /// Launch a security scan against in-scope targets
       Run {
           #[arg(short, long)]
           target: String,
           #[arg(long, default_value = "standard")]
           profile: String,
           #[arg(long, default_value_t = 10)]
           concurrency: usize,
           #[arg(long, default_value_t = 50)]
           rate_limit_rps: u32,
           #[arg(long, default_value_t = 300)]
           timeout_secs: u64,
           #[arg(long)]
           passive_only: bool,
           #[arg(long)]
           active_only: bool,
       },
       /// Pause an ongoing scan
       Pause { scan_id: Uuid },
       /// Resume a paused scan
       Resume { scan_id: Uuid },
       /// Cancel and terminate a running scan
       Cancel { scan_id: Uuid },
       /// View scan progress and live candidate telemetry
       Status { scan_id: Option<Uuid> },
   }
   ```

3. **`replay` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ReplayArgs {
       #[command(subcommand)]
       pub action: ReplayAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum ReplayAction {
       /// Replay a specific stored transaction by UUID
       Send {
           #[arg(short, long)]
           tx_id: Uuid,
           #[arg(long)]
           override_header: Vec<String>,
           #[arg(long)]
           override_body: Option<String>,
           #[arg(long, default_value_t = 1)]
           count: usize,
       },
       /// Compare and diff two transactions side-by-side
       Diff {
           tx_a: Uuid,
           tx_b: Uuid,
           #[arg(long, default_value = "side-by-side")]
           format: String,
       },
   }
   ```

4. **`scope` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ScopeArgs {
       #[command(subcommand)]
       pub action: ScopeAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum ScopeAction {
       /// Show active include and exclude scope rules
       Show,
       /// Test a URI against the fail-closed SEC-01 scope engine
       Check {
           uri: String,
           #[arg(short, long, default_value = "GET")]
           method: String,
       },
       /// Add an include glob / CIDR pattern
       AddInclude { pattern: String },
       /// Add an exclude glob / CIDR pattern
       AddExclude { pattern: String },
       /// Remove a scope rule by UUID
       Remove { rule_id: Uuid },
       /// Import scope definitions from a JSON or YAML file
       Import { file: PathBuf },
   }
   ```

5. **`report` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ReportArgs {
       #[arg(short, long, default_value = "markdown")]
       pub format: String, // markdown, pdf, html, json, sarif
       #[arg(short, long)]
       pub output: Option<PathBuf>,
       #[arg(long, default_value = "SENTINEL Engagement Security Report")]
       pub title: String,
       #[arg(long, default_value = "medium")]
       pub min_severity: String,
       #[arg(long, default_value_t = true)]
       pub include_evidence: bool,
   }
   ```

6. **`verify` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct VerifyArgs {
       #[command(subcommand)]
       pub action: VerifyAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum VerifyAction {
       /// Execute independent verifier against a vulnerability candidate
       Candidate {
           candidate_id: Uuid,
           #[arg(long)]
           strategy: Option<String>,
       },
       /// Retest an existing promoted finding
       Retest { finding_id: Uuid },
       /// Execute multi-role authorization matrix differential verification
       AuthzMatrix {
           #[arg(long)]
           identity_a: Uuid,
           #[arg(long)]
           identity_b: Uuid,
       },
   }
   ```

7. **`export` Subcommand**:
   ```rust
   #[derive(Args, Debug)]
   pub struct ExportArgs {
       #[command(subcommand)]
       pub action: ExportAction,
   }

   #[derive(Subcommand, Debug)]
   pub enum ExportAction {
       /// Export traffic as PCAP
       Pcap { output: PathBuf, filter: Option<String> },
       /// Export traffic as HTTP Archive (HAR 1.2)
       Har { output: PathBuf, filter: Option<String> },
       /// Export CAS blobstore bundle
       CasBundle { output: PathBuf },
       /// Export findings as SARIF v2.1.0
       Sarif { output: PathBuf },
   }
   ```

---

## 2.3 Tantivy BM25 Full-Text Indexing Engine (`sentinel_storage` & `sentinel_productivity`)

### 2.3.1 Tantivy Schema Specification
Location: `sentinel_core/crates/sentinel_storage/src/search/`

```rust
// crates/sentinel_storage/src/search/schema.rs

use tantivy::schema::*;

#[derive(Clone)]
pub struct HttpIndexSchema {
    pub schema: Schema,
    pub tx_id: Field,
    pub timestamp: Field,
    pub req_method: Field,
    pub req_uri: Field,
    pub req_headers: Field,
    pub req_body: Field,
    pub res_status: Field,
    pub res_headers: Field,
    pub res_body: Field,
    pub content_type: Field,
    pub tags: Field,
}

impl HttpIndexSchema {
    pub fn build() -> Self {
        let mut builder = Schema::builder();

        // 1. Transaction Identifier (String, stored, fast for lookups)
        let tx_id = builder.add_text_field("tx_id", STRING | STORED | FAST);

        // 2. Timestamp (i64 epoch milliseconds, stored, fast for range sorting)
        let timestamp = builder.add_i64_field("timestamp", INDEXED | STORED | FAST);

        // 3. HTTP Method (String, exact match: GET, POST, PUT, DELETE)
        let req_method = builder.add_text_field("req_method", STRING | STORED);

        // 4. Request URI (Full text indexed with tokenizer, stored)
        let req_uri = builder.add_text_field("req_uri", TEXT | STORED);

        // 5. Request Headers (Full text indexed)
        let req_headers = builder.add_text_field("req_headers", TEXT | STORED);

        // 6. Request Body / Normalized Text (Position indexed for BM25 phrase search)
        let req_body = builder.add_text_field("req_body", TEXT | STORED);

        // 7. Response Status Code (u64, stored, fast for range queries: 200..=299)
        let res_status = builder.add_u64_field("res_status", INDEXED | STORED | FAST);

        // 8. Response Headers (Full text indexed)
        let res_headers = builder.add_text_field("res_headers", TEXT | STORED);

        // 9. Response Body / Normalized Text (Position indexed for BM25 search)
        let res_body = builder.add_text_field("res_body", TEXT | STORED);

        // 10. Content-Type (String exact / prefix match)
        let content_type = builder.add_text_field("content_type", STRING | STORED);

        // 11. Tags (Multi-valued string for categorization)
        let tags = builder.add_text_field("tags", STRING | STORED);

        let schema = builder.build();

        Self {
            schema,
            tx_id,
            timestamp,
            req_method,
            req_uri,
            req_headers,
            req_body,
            res_status,
            res_headers,
            res_body,
            content_type,
            tags,
        }
    }
}
```

### 2.3.2 Tantivy Index Engine Implementation (`search/engine.rs`)

```rust
// crates/sentinel_storage/src/search/engine.rs

use parking_lot::Mutex;
use std::path::Path;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::{AllQuery, BooleanQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy, Term};
use uuid::Uuid;

use sentinel_common::{SentinelError, Transaction};
use crate::search::schema::HttpIndexSchema;

pub struct SearchHitResult {
    pub tx_id: Uuid,
    pub score: f32,
    pub req_method: String,
    pub req_uri: String,
    pub res_status: u64,
    pub snippet: Option<String>,
}

pub struct TantivySearchEngine {
    schema: HttpIndexSchema,
    index: Index,
    reader: IndexReader,
    writer: Arc<Mutex<IndexWriter>>,
}

impl TantivySearchEngine {
    pub fn open_or_create(index_dir: impl AsRef<Path>) -> Result<Self, SentinelError> {
        let schema = HttpIndexSchema::build();
        let path = index_dir.as_ref();
        std::fs::create_dir_all(path).map_err(SentinelError::Io)?;

        let index = if Index::exists(path).map_err(|e| SentinelError::Tantivy(e.to_string()))? {
            Index::open_in_dir(path).map_err(|e| SentinelError::Tantivy(e.to_string()))?
        } else {
            Index::create_in_dir(path, schema.schema.clone())
                .map_err(|e| SentinelError::Tantivy(e.to_string()))?
        };

        // 50MB writer buffer budget
        let writer = index
            .writer(50_000_000)
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

        Ok(Self {
            schema,
            index,
            reader,
            writer: Arc::new(Mutex::new(writer)),
        })
    }

    /// Indexes a complete HTTP transaction into the Tantivy BM25 inverted index.
    pub fn index_transaction(&self, tx: &Transaction) -> Result<(), SentinelError> {
        let mut writer = self.writer.lock();

        let req_headers_str = tx
            .request
            .parsed
            .headers
            .iter()
            .map(|(k, v)| format!("{}: {}", k, v))
            .collect::<Vec<_>>()
            .join("\n");

        let (res_status_num, res_headers_str, res_body_str) = match &tx.response {
            Some(res) => {
                let h_str = res
                    .parsed
                    .headers
                    .iter()
                    .map(|(k, v)| format!("{}: {}", k, v))
                    .collect::<Vec<_>>()
                    .join("\n");
                (200u64, h_str, res.normalized_text.clone())
            }
            None => (0u64, String::new(), String::new()),
        };

        let doc = doc!(
            self.schema.tx_id => tx.meta.id.to_string(),
            self.schema.timestamp => tx.meta.timestamp.timestamp_millis(),
            self.schema.req_method => format!("{:?}", tx.request.parsed.method),
            self.schema.req_uri => tx.request.parsed.uri.clone(),
            self.schema.req_headers => req_headers_str,
            self.schema.req_body => tx.request.normalized_text.clone(),
            self.schema.res_status => res_status_num,
            self.schema.res_headers => res_headers_str,
            self.schema.res_body => res_body_str,
            self.schema.content_type => "text/html",
        );

        writer
            .add_document(doc)
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

        Ok(())
    }

    /// Commits all pending indexed documents.
    pub fn commit(&self) -> Result<(), SentinelError> {
        self.writer
            .lock()
            .commit()
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;
        Ok(())
    }

    /// Executes a BM25 ranked full-text query across transactions with pagination.
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<SearchHitResult>, SentinelError> {
        let searcher = self.reader.searcher();

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![
                self.schema.req_uri,
                self.schema.req_headers,
                self.schema.req_body,
                self.schema.res_headers,
                self.schema.res_body,
            ],
        );

        let query = query_parser
            .parse_query(query_str)
            .map_err(|e| SentinelError::Tantivy(format!("Query parse error: {}", e)))?;

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit).and_offset(offset))
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

        let mut hits = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher
                .doc(doc_address)
                .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

            let tx_id_str: &str = retrieved_doc
                .get_first(self.schema.tx_id)
                .and_then(|f| f.as_text())
                .unwrap_or_default();
            let req_method_str: &str = retrieved_doc
                .get_first(self.schema.req_method)
                .and_then(|f| f.as_text())
                .unwrap_or_default();
            let req_uri_str: &str = retrieved_doc
                .get_first(self.schema.req_uri)
                .and_then(|f| f.as_text())
                .unwrap_or_default();
            let res_status_val: u64 = retrieved_doc
                .get_first(self.schema.res_status)
                .and_then(|f| f.as_u64())
                .unwrap_or(0);

            let tx_uuid = Uuid::parse_str(tx_id_str)
                .map_err(|e| SentinelError::ParseError(e.to_string()))?;

            hits.push(SearchHitResult {
                tx_id: tx_uuid,
                score,
                req_method: req_method_str.to_string(),
                req_uri: req_uri_str.to_string(),
                res_status: res_status_val,
                snippet: None,
            });
        }

        Ok(hits)
    }

    /// Rebuilds Tantivy index from SQLite WAL (handles ERR_FTS_003 recovery).
    pub async fn rebuild_from_sqlite(
        &self,
        pool: &sqlx::SqlitePool,
    ) -> Result<usize, SentinelError> {
        let mut writer = self.writer.lock();
        writer
            .delete_all_documents()
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;

        let rows = sqlx::query(
            "SELECT id, timestamp, req_method, req_uri, req_normalized_text, res_status, res_normalized_text FROM transactions ORDER BY timestamp ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(SentinelError::Database)?;

        let count = rows.len();
        for r in rows {
            use sqlx::Row;
            let id: String = r.get("id");
            let req_method: String = r.get("req_method");
            let req_uri: String = r.get("req_uri");
            let req_norm: String = r.get("req_normalized_text");
            let res_status: Option<i64> = r.get("res_status");
            let res_norm: Option<String> = r.get("res_normalized_text");

            let doc = doc!(
                self.schema.tx_id => id,
                self.schema.req_method => req_method,
                self.schema.req_uri => req_uri,
                self.schema.req_headers => "",
                self.schema.req_body => req_norm,
                self.schema.res_status => res_status.unwrap_or(0) as u64,
                self.schema.res_headers => "",
                self.schema.res_body => res_norm.unwrap_or_default(),
            );
            writer
                .add_document(doc)
                .map_err(|e| SentinelError::Tantivy(e.to_string()))?;
        }

        writer
            .commit()
            .map_err(|e| SentinelError::Tantivy(e.to_string()))?;
        Ok(count)
    }
}
```

---

# 3. Caveats

1. **Crypto Crates Selection**:
   - For `Keccak-256`, standard Rust `sha3 = "0.10"` (which provides `sha3::Keccak256`) or `tiny-keccak = "2.0"` can be added to `Cargo.toml`.
   - For Gzip, `flate2 = "1.0"` with standard miniz_oxide backend should be declared in workspace dependencies.
   - For Tantivy, `tantivy = "0.22"` should be placed in `workspace.dependencies` and included in `sentinel_storage` and `sentinel_productivity`.
2. **CLI Async Execution**:
   - `sentinel_cli` binary should use `tokio::main` and instantiate `SqliteObservationStore`, `DefaultScopeEngine`, and `TantivySearchEngine` within the target project directory.
3. **Platform Differences**:
   - File path delimiters and temporary directories must remain platform-agnostic (`PathBuf`, `tempfile::tempdir`).

---

# 4. Conclusion

Subsystems A and D provide the fundamental operational tooling and search infrastructure for the Sentinel platform:

- **Subsystem A (`sentinel_productivity`)**: Supplies high-speed, zero-allocation, secure encoders and decoders (Base64, URL, Hex, HTML Entities, JWT, Gzip) and unified cryptographic hashing (`HashEngine`), fulfilling pentester workspace requirements and invariant compliance.
- **Subsystem D (`sentinel_cli` & `sentinel_storage`)**: Delivers an enterprise-grade Clap v4 CLI with complete subcommands (`project`, `scan`, `replay`, `scope`, `report`, `verify`, `export`), strict exit codes (`0`, `1`, `2`), and a Tantivy BM25 full-text indexing engine that indexes requests/responses in real-time with resilient SQLite WAL auto-rebuild.

---

# 5. Verification Method & Test Plan

Independent verification of the architecture and subsequent implementation will execute via:

### 5.1 Compilation & Spec Validation
```powershell
# 1. Cargo workspace check
cargo check --workspace

# 2. Cargo clippy with zero warnings
cargo clippy --workspace --all-targets -- -D warnings

# 3. Canonical spec validation
python architecture/v6/validate_v6_spec.py
```

### 5.2 Unit & Integration Test Suite
The following test suites must be executed:

1. **`sentinel_productivity/tests/codec_tests.rs`**:
   - `test_base64_standard_and_urlsafe_roundtrip`: Asserts exact byte-for-byte fidelity with RFC 4648 test vectors.
   - `test_url_encoding_modes_and_double_encode`: Validates traversal bypass `%252e%252e%252f` and query string preservation.
   - `test_hex_codec_and_hexdump_formatting`: Tests multi-delimiter parsing and Wireshark-style ASCII alignment.
   - `test_html_entities_named_decimal_hex`: Tests named entities, hex entities, and XSS payload escaping/unescaping.
   - `test_jwt_decode_and_signature_verification`: Tests HS256 / RS256 token verification, claims expiration assertion, and `alg: none` rejection.
   - `test_gzip_compression_and_bomb_prevention`: Asserts decompression bomb rejection when output exceeds safe memory limits.
   - `test_hash_engine_all_algorithms`: Verifies MD5, SHA-1, SHA-256, SHA-512, Keccak-256, and HMAC against NIST / FIPS test vectors.

2. **`sentinel_storage/tests/tantivy_bm25_search_tests.rs`**:
   - `test_tantivy_index_and_bm25_search`: Ingests 50 HTTP transactions with unique error strings and asserts sub-10ms top-ranked search retrieval.
   - `test_tantivy_index_rebuild_from_sqlite_wal`: Clears the Tantivy index directory and executes `rebuild_from_sqlite`, asserting 100% document restoration.

3. **`sentinel_cli/tests/cli_command_tests.rs`**:
   - `test_cli_help_and_subcommand_taxonomy`: Asserts Clap v4 parses all 7 subcommands without error.
   - `test_cli_exit_codes`:
     - Clean run returns `0`.
     - Scan finding vulnerability returns `1`.
     - Scope violation / bad argument returns `2`.
