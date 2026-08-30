# Phase 2 Technical Exploration Report: `sentinel_parser` Engine Architecture & Design

**Author**: Parser Explorer (`phase2_explorer_parser`)  
**Milestone**: Phase 2 — Traffic, Proxy & Protocol Engine  
**Subsystem**: `SUB-02 HTTPParser` (`sentinel_parser`)  
**Target Path**: `crates/sentinel_parser`  
**Date**: 2026-08-17  

---

## 1. Observation

### 1.1 Specification Citations & Authoritative Constraints
1. **Canonical YAML Specification** (`architecture/v6/V6_CANONICAL_SPEC.yaml` lines 67-85, 1416-1449):
   - Subsystem ID: `SUB-02`, Tier: `Core`, Name: `HTTPParser`, Crate: `sentinel-parser`.
   - Responsibilities:
     - Byte-safe, fault-tolerant parsing of HTTP/1.1 and HTTP/2 requests and responses.
     - Preserve raw delimiter whitespace and byte-exact fidelity without normalization loss.
     - Detect and emit structured `ParseWarning` items for request smuggling analysis.
     - Serialize structured request and response objects back to byte streams.
   - Security Boundary: "Forked httparse parser; differential parser protection; zero-panic guarantees on malformed input; 10MB memory allocation bound per transaction."
   - Trait Definition:
     ```yaml
     - name: "HttpParser"
       subsystem: "SUB-02"
       is_async: false
       methods:
         - name: "parse_request"
           args: [{name: "raw", type: "&[u8]"}]
           return_type: "Result<ParsedRequest, SentinelError>"
         - name: "parse_response"
           args: [{name: "raw", type: "&[u8]"}]
           return_type: "Result<ParsedResponse, SentinelError>"
         - name: "serialize_request"
           args: [{name: "request", type: "&ParsedRequest"}]
           return_type: "Result<Vec<u8>, SentinelError>"
         - name: "serialize_response"
           args: [{name: "response", type: "&ParsedResponse"}]
           return_type: "Result<Vec<u8>, SentinelError>"
     ```

2. **Existing Trait and Domain Structs in `sentinel_common`**:
   - `crates/sentinel_common/src/traits.rs` (lines 38-46):
     ```rust
     #[async_trait]
     pub trait HttpParser: Send + Sync {
         fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;
         fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError>;
         fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError>;
         fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError>;
     }
     ```
   - `crates/sentinel_common/src/operational.rs` (lines 148-163):
     ```rust
     #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
     pub struct ParsedRequest {
         pub method: HttpMethod,
         pub uri: String,
         pub version: String,
         pub headers: Vec<(Vec<u8>, Vec<u8>)>,
         pub body: Vec<u8>,
     }

     #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
     pub struct ParsedResponse {
         pub version: String,
         pub status_code: u16,
         pub reason: String,
         pub headers: Vec<(Vec<u8>, Vec<u8>)>,
         pub body: Vec<u8>,
     }
     ```
   - `crates/sentinel_common/src/domain/meta.rs` (lines 48-70):
     ```rust
     pub struct HttpParsedParts {
         pub method: HttpMethod,
         pub uri: String,
         pub version: String,
         pub headers: Vec<(Vec<u8>, Vec<u8>)>,
     }
     pub struct MessageRepresentation {
         pub raw_blob_id: Uuid,
         pub parsed: HttpParsedParts,
         pub normalized_text: String,
     }
     ```
   - `crates/sentinel_common/src/operational.rs` (lines 60-68):
     ```rust
     pub struct ParseWarning {
         pub code: String,
         pub severity: Severity,
         pub offset: usize,
         pub component: String,
         pub message: String,
     }
     ```
   - `crates/sentinel_common/src/enums.rs` (lines 8-48):
     `HttpMethod` enum: `GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE, CONNECT, GRAPHQL`.

3. **Security Invariant SEC-10 ("Triple Representation Invariant")** (`architecture/v6/V6_FINAL_SECURITY_INVARIANTS.md` lines 74-78):
   - Statement: "All network traffic retains raw bytes, parsed structure, and normalized text. Raw bytes are never discarded or irreversibly normalized."
   - Verification Test: "Round-trip parser test asserting raw byte slice is identical before and after parsing and storage: `serialize(parse(raw)) == raw`."

4. **Architecture Decisions & Risk Strategy** (`architecture/v6/V6_FINAL_ARCHITECTURE.md` lines 179-212):
   - Design: Fault-tolerant HTTP parser preserving raw bytes for security testing.
   - Core mechanism: Custom fault-tolerant byte scanner + SIMD `httparse` acceleration/differential comparison.
   - Concurrency & Safety: Stateless, thread-safe (`Send + Sync`), zero-panic guarantee on arbitrary byte inputs, 10MB memory allocation bound per request.

5. **Existing Workspace Configuration** (`sentinel_core/Cargo.toml` lines 1-33):
   - Workspace root currently contains members: `crates/sentinel_common`, `crates/sentinel_storage`, `crates/sentinel_bus`, `crates/sentinel_scope`.
   - `crates/sentinel_parser` must be added to workspace members and configured with matching dependencies.

---

## 2. Logic Chain

From these direct observations, we derive the following architectural requirements and design decisions:

### Step 1: Solving the Core Dilemma — Standard Parsers vs. Security Inspection
- Standard production HTTP parsers (e.g., standard `httparse`, `hyper`, `nom-http`) are *normative* and *strict*. They reject invalid characters, normalize headers (lowercasing header keys, trimming whitespace around colons, coalescing duplicate headers, rejecting obsolete line folding), and abort on framing ambiguities.
- In security testing and proxy operations (Burp Suite / Sentinel), rejecting or normalizing malformed traffic destroys the exact signals necessary for vulnerability detection (such as HTTP Request Smuggling, CRLF injection, and desync attacks).
- *Deduction*: `sentinel_parser` MUST be **fault-tolerant and descriptive**, not prescriptive. It must preserve exact header key/value bytes (including spaces before colons, duplicate headers, obs-fold continuations, and raw transfer encodings) while structuring the stream into inspectable components.

### Step 2: Hybrid Zero-Copy Scanner Architecture
- A pure `httparse` wrapper fails because `httparse::parse_headers` returns `httparse::Error::HeaderName` whenever a space precedes a colon (e.g., `Content-Length : 100`) or when non-standard characters appear in header names.
- A purely custom parser risks performance bottlenecks if not optimized.
- *Deduction*: Implement a **hybrid architecture**:
  1. **Primary Fault-Tolerant Zero-Copy Scanner (`request.rs`, `response.rs`, `headers.rs`)**:
     - Operates directly over byte slices (`&[u8]`) without allocating intermediate strings during token extraction.
     - Scans request line / status line by identifying space (`0x20`) or tab (`0x09`) delimiters and CRLF (`\r\n`) / bare LF (`\n`) boundaries.
     - Header parsing: Scans line-by-line. Locates the first `:` byte. Everything before `:` is captured as raw name bytes (preserving trailing whitespace like `b"Transfer-Encoding "`); everything after `:` is captured as raw value bytes.
     - Detects obsolete line folding (obs-fold: lines beginning with SP `0x20` or HTAB `0x09`) and appends or links them to the prior header.
     - Body extraction: Evaluates `Content-Length` (CL) and `Transfer-Encoding: chunked` (TE) via robust chunked stream decoders, handling chunk extensions, multi-chunk sequences, and trailer blocks.
  2. **Secondary SIMD Pre-Validator (`httparse` Integration)**:
     - Leverages `httparse` for high-throughput conformance checking and differential fuzzing.
  3. **Differential Analyzer (`smuggling.rs`)**:
     - Compares the fault-tolerant parsed representation against strict RFC interpretation to detect protocol desynchronization points.

### Step 3: Request Smuggling & Protocol Anomaly Engine (`parser::smuggling`)
- Request smuggling arises when a frontend proxy and a backend server interpret HTTP message boundaries differently.
- *Deduction*: The parser must identify all 12 canonical smuggling indicators and return them as structured `ParseWarning` / `SmugglingIndicator` items:
  1. `CL_TE_DualFraming`: Both `Content-Length` and `Transfer-Encoding` headers present in the same request.
  2. `TE_CL_DualFraming`: `Transfer-Encoding` followed by `Content-Length` (or vice versa) with differing backend precedence.
  3. `DuplicateContentLength`: Multiple `Content-Length` headers (e.g., `Content-Length: 10\r\nContent-Length: 20` or `Content-Length: 10, 10`).
  4. `DuplicateTransferEncoding`: Multiple `Transfer-Encoding` headers (e.g., `Transfer-Encoding: chunked\r\nTransfer-Encoding: identity`).
  5. `ObfuscatedTransferEncoding`: Obfuscated TE headers designed to bypass frontend WAFs (e.g., `Transfer-Encoding: xchunked`, `Transfer-Encoding : chunked`, `Transfer-Encoding: [tab]chunked`, `Transfer-Encoding: cow\r\nTransfer-Encoding: chunked`).
  6. `HeaderWhitespaceBeforeColon`: Space or tab preceding the colon in a header name (e.g., `Content-Length : 42`).
  7. `ObsFoldPresent`: RFC 7230 deprecated obsolete line folding present in header block.
  8. `InvalidChunkHex`: Non-hexadecimal characters in chunk size header or invalid chunk extension characters.
  9. `ChunkExtensionAnomaly`: Chunk extensions containing null bytes or unexpected control characters.
  10. `PrematureEndOfStream`: Body length shorter than declared `Content-Length` or chunk stream terminates without zero-size chunk (`0\r\n\r\n`).
  11. `H2NewlineInjection`: HTTP/2 header value containing `\r` or `\n` (CRLF injection in H2).
  12. `H2DuplicatePseudoHeader`: Duplicate `:method`, `:path`, or `:scheme` pseudo-headers in a single HTTP/2 HEADERS frame.

### Step 4: Deterministic Byte-Exact Roundtrip Serialization (`serialize.rs`)
- To satisfy Invariant SEC-10 (`serialize(parse(raw)) == raw`):
  - Request Serialization:
    - Writes `{METHOD} {URI} {VERSION}\r\n`
    - For each header `(name_bytes, val_bytes)`:
      - If `name_bytes` ends with `:` or already includes delimiters, writes name + value + `\r\n`.
      - Otherwise, writes `name_bytes` + `b": "` + `val_bytes` + `\r\n`.
    - Writes header terminator `\r\n`.
    - Appends `body` bytes unmodified.
  - Response Serialization:
    - Writes `{VERSION} {STATUS_CODE} {REASON}\r\n` (or `{VERSION} {STATUS_CODE}\r\n` if reason is empty).
    - Writes headers formatted with `b": "` and `\r\n`.
    - Writes header terminator `\r\n`.
    - Appends `body` bytes unmodified.
  - Result: Perfect roundtrip byte equality for all compliant and well-formed requests/responses, with exact byte reconstruction for anomaly payloads.

### Step 5: HTTP/2 Frame & Stream Support (`h2.rs`)
- HTTP/2 operates over binary frames rather than text streams.
- `sentinel_parser` must support:
  1. Low-level 9-byte frame header parsing (`Length`, `Type`, `Flags`, `Stream ID`).
  2. Frame payload parsing: `DATA`, `HEADERS`, `PRIORITY`, `RST_STREAM`, `SETTINGS`, `PUSH_PROMISE`, `PING`, `GOAWAY`, `WINDOW_UPDATE`, `CONTINUATION`.
  3. HPACK decoder to unpack `:method`, `:path`, `:scheme`, `:authority`, `:status`, and regular headers into `Vec<(Vec<u8>, Vec<u8>)>`.
  4. Bidirectional conversion: HTTP/2 HEADERS + DATA frames ↔ `ParsedRequest` / `ParsedResponse`.
  5. H2 request smuggling checks (CRLF injection in pseudo-headers, forbidden uppercase headers, conflicting `content-length` vs frame sizes).

---

## 3. Caveats

1. **Large Streaming Bodies (>10MB Allocation Limit)**:
   - Invariant bounds request allocation to 10MB. If an incoming message stream has a `Content-Length` exceeding 10MB or is an infinite chunked stream, the parser should enforce the limit gracefully by returning `SentinelError::ParseError` or truncating with a high-severity `ParseWarning` rather than panicking or exhausting host RAM.
2. **HTTP/2 Statefulness & Dynamic HPACK Tables**:
   - HTTP/2 frame parsing within a single TCP connection is stateful due to the HPACK dynamic table and CONTINUATION frame sequences. The parser should provide both a stateless single-frame parser (for individual frame inspection) and a stateful stream decoder `H2StreamParser` (for tracking dynamic table state and assembling complete HTTP/2 requests across frames).
3. **HTTP/0.9 and Non-Standard Method Fallbacks**:
   - In HTTP/0.9 (e.g. `GET /path\r\n` with no version and no headers), the parser must recognize the simple request format and default version to `"HTTP/0.9"`. For unrecognized methods not present in `sentinel_common::enums::HttpMethod` (such as `PROPFIND` or custom fuzz strings), the canonical `HttpParser::parse_request` must return `SentinelError::ParseError`, while the extended `RichParsedRequest` struct preserves `raw_method: Vec<u8>`.
4. **WebSocket Upgrade Framing**:
   - After a `101 Switching Protocols` handshake response, the underlying TCP connection switches to WebSocket framing. The HTTP parser is responsible for parsing the initial upgrade request and response; subsequent frames are handed over to the proxy engine / WebSocket parser.

---

## 4. Conclusion & Actionable Recommendations

### 4.1 Recommended Crate Layout (`crates/sentinel_parser`)

```
crates/sentinel_parser/
├── Cargo.toml
├── src/
│   ├── lib.rs                  // Public exports & SentinelHttpParser struct implementing HttpParser trait
│   ├── error.rs                // Parser-specific error variants and SentinelError mappings
│   ├── request.rs              // Fault-tolerant HTTP/1.1 request parser
│   ├── response.rs             // Fault-tolerant HTTP/1.1 response parser
│   ├── headers.rs              // RawHeaderMap, space-before-colon, duplicate headers, obs-fold
│   ├── chunked.rs              // Chunked transfer encoding decoder/encoder with extensions/trailers
│   ├── h2.rs                   // HTTP/2 frame parser, HPACK decoding, H2->H1 adapter
│   ├── smuggling.rs            // Request smuggling & protocol anomaly detector
│   ├── serialize.rs            // Byte-exact request & response serializers
│   └── types.rs                // Rich parser structures (RichParsedRequest, RichParsedResponse, etc.)
└── tests/
    ├── request_tests.rs        // Unit tests for HTTP/1.1 request parsing
    ├── response_tests.rs       // Unit tests for HTTP/1.1 response parsing
    ├── smuggling_tests.rs      // PortSwigger smuggling test vectors (CL.TE, TE.CL, TE.TE, obs-fold)
    ├── chunked_tests.rs        // Chunked decoding/encoding edge case tests
    ├── h2_tests.rs             // HTTP/2 frame and HPACK decompression tests
    ├── roundtrip_tests.rs      // Byte-exact serialization roundtrip proptests
    └── differential_tests.rs   // Differential tests against httparse
```

### 4.2 Cargo Manifest Configuration (`crates/sentinel_parser/Cargo.toml`)

```toml
[package]
name = "sentinel_parser"
version.workspace = true
edition.workspace = true
license.workspace = true
authors.workspace = true

[dependencies]
sentinel_common = { path = "../sentinel_common" }
chrono.workspace = true
serde.workspace = true
serde_json.workspace = true
uuid.workspace = true
thiserror.workspace = true
async-trait.workspace = true
tokio.workspace = true
tracing.workspace = true
httparse = "1.9.4"
bytes = "1.7.1"
h2 = "0.4.6"
memchr = "2.7.4"

[dev-dependencies]
sentinel_bus = { path = "../sentinel_bus" }
sentinel_storage = { path = "../sentinel_storage" }
tempfile.workspace = true
proptest = "1.5.0"
```

And in `sentinel_core/Cargo.toml`, add `"crates/sentinel_parser"` to `[workspace.members]` and include `httparse`, `bytes`, `h2`, `memchr`, and `proptest` in `[workspace.dependencies]`.

### 4.3 Key Data Structures & Public API Design

#### 1. Public Parser Struct (`src/lib.rs`)
```rust
use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParsedRequest, ParsedResponse, ParseWarning};
use sentinel_common::traits::HttpParser;

pub struct SentinelHttpParser {
    max_body_size: usize,
}

impl Default for SentinelHttpParser {
    fn default() -> Self {
        Self {
            max_body_size: 10 * 1024 * 1024, // 10MB bound
        }
    }
}

impl SentinelHttpParser {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_max_body_size(max_body_size: usize) -> Self {
        Self { max_body_size }
    }

    pub fn parse_request_rich(&self, raw: &[u8]) -> Result<RichParsedRequest, SentinelError> {
        request::parse_request_rich(raw, self.max_body_size)
    }

    pub fn parse_response_rich(&self, raw: &[u8]) -> Result<RichParsedResponse, SentinelError> {
        response::parse_response_rich(raw, self.max_body_size)
    }

    pub fn detect_smuggling(&self, req: &ParsedRequest) -> Vec<ParseWarning> {
        smuggling::analyze_request_smuggling(req)
    }
}

#[async_trait]
impl HttpParser for SentinelHttpParser {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError> {
        request::parse_request_canonical(raw, self.max_body_size)
    }

    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError> {
        response::parse_response_canonical(raw, self.max_body_size)
    }

    fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError> {
        serialize::serialize_request(req)
    }

    fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError> {
        serialize::serialize_response(res)
    }
}
```

#### 2. Rich Representation & Header Types (`src/types.rs`, `src/headers.rs`)
```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawHeader {
    pub raw_name: Vec<u8>,
    pub raw_value: Vec<u8>,
    pub delimiter: Vec<u8>, // e.g. b": " or b" : "
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RichParsedRequest {
    pub raw: Vec<u8>,
    pub method: HttpMethod,
    pub raw_method: Vec<u8>,
    pub uri: String,
    pub version: String,
    pub headers: Vec<RawHeader>,
    pub body: Vec<u8>,
    pub warnings: Vec<ParseWarning>,
    pub is_chunked: bool,
    pub content_length: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RichParsedResponse {
    pub raw: Vec<u8>,
    pub version: String,
    pub status_code: u16,
    pub reason: String,
    pub headers: Vec<RawHeader>,
    pub body: Vec<u8>,
    pub warnings: Vec<ParseWarning>,
    pub is_chunked: bool,
    pub content_length: Option<usize>,
}
```

#### 3. Smuggling Indicator Taxonomy (`src/smuggling.rs`)
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmugglingIndicatorType {
    DualFramingClTe,
    DualFramingTeCl,
    DuplicateContentLength,
    DuplicateTransferEncoding,
    ObfuscatedTransferEncoding,
    SpaceBeforeColon,
    ObsoleteLineFolding,
    InvalidChunkHex,
    PrematureEndOfStream,
    H2NewlineInHeader,
    H2DuplicatePseudoHeader,
    H2UppercaseHeader,
}

impl SmugglingIndicatorType {
    pub fn to_parse_warning(&self, offset: usize, detail: &str) -> ParseWarning {
        ParseWarning {
            code: format!("SMUG_{:?}", self),
            severity: Severity::High,
            offset,
            component: "HTTPParser".to_string(),
            message: detail.to_string(),
        }
    }
}
```

#### 4. Chunked Stream Decoder (`src/chunked.rs`)
```rust
pub struct ChunkedDecoder;

impl ChunkedDecoder {
    /// Decodes chunked body bytes, extracting unchunked payload, trailers, and extensions.
    pub fn decode(raw: &[u8], max_size: usize) -> Result<(Vec<u8>, Vec<(Vec<u8>, Vec<u8>)>, usize), SentinelError>;
    
    /// Encodes raw payload into standard chunked transfer encoding stream.
    pub fn encode(payload: &[u8], chunk_size: usize) -> Vec<u8>;
}
```

#### 5. HTTP/2 Frame & Pseudo-Header Engine (`src/h2.rs`)
```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct H2FrameHeader {
    pub length: u32,
    pub frame_type: u8,
    pub flags: u8,
    pub stream_id: u32,
}

pub struct H2FrameParser;

impl H2FrameParser {
    pub fn parse_frame_header(bytes: &[u8; 9]) -> H2FrameHeader;
    pub fn decode_hpack_headers(payload: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>, SentinelError>;
    pub fn convert_h2_to_parsed_request(headers: Vec<(Vec<u8>, Vec<u8>)>, body: Vec<u8>) -> Result<ParsedRequest, SentinelError>;
    pub fn convert_h2_to_parsed_response(headers: Vec<(Vec<u8>, Vec<u8>)>, body: Vec<u8>) -> Result<ParsedResponse, SentinelError>;
}
```

---

## 5. Verification Method

To independently verify the `sentinel_parser` crate once implemented, the following verification commands and test suites must be executed:

### 5.1 Compilation & Linting Checks
```powershell
# 1. Verify workspace compilation
cargo check --workspace --locked

# 2. Verify formatting
cargo fmt --check

# 3. Verify zero clippy warnings
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

### 5.2 Unit & Integration Test Suite
```powershell
# Run all unit tests for sentinel_parser
cargo test -p sentinel_parser --all-targets

# Target specific test suites:
cargo test -p sentinel_parser --test request_tests
cargo test -p sentinel_parser --test response_tests
cargo test -p sentinel_parser --test smuggling_tests
cargo test -p sentinel_parser --test chunked_tests
cargo test -p sentinel_parser --test h2_tests
cargo test -p sentinel_parser --test roundtrip_tests
cargo test -p sentinel_parser --test differential_tests
```

### 5.3 Property-Based Roundtrip Invariant Verification
```powershell
# Proptest verification of SEC-10 Triple Representation Invariant
# Asserts: serialize(parse(raw)) == raw across 10,000 generated valid HTTP messages
cargo test -p sentinel_parser --test roundtrip_tests -- --nocapture
```

### 5.4 Spec Conformance Validation
```powershell
# Canonical 11-step spec validator
python architecture/v6/validate_v6_spec.py
```
Expected result: `BLOCKERS = 0`, `WARNINGS = 0`.

---
*Report completed and ready for orchestrator review and Phase 2 worker dispatch.*
