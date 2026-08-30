# Milestone M3: Advanced Testing Engines — Comprehensive Architectural Analysis & Gap Assessment
**Domains 1–4: Authentication, Session Security, Configuration & Exposure, Deep Input Validation**

**Author**: Explorer M3.1  
**Target Milestone**: M3 (Advanced Testing Engines)  
**Target Workspace**: `sentinel_core` (`sentinel_auth`, `sentinel_scanner`, `sentinel_fuzzer`, `sentinel_verification`, `sentinel_browser`, `sentinel_proxy`, `sentinel_common`)  
**Date**: August 2026  
**Status**: Completed Assessment & Engineering Roadmap  

---

## Executive Summary

Milestone M3 establishes the active vulnerability discovery, deep injection, authentication/session auditing, and exposure detection engine suite for the SENTINEL V6 platform. This assessment investigates the existing codebase across 28 workspace crates in `sentinel_core` and the frontend workspace in `src/`, evaluating the current capabilities against the authoritative specifications in `ORIGINAL_REQUEST.md (§Follow-up R3)`, `SENTINEL_SECURITY_COVERAGE_MATRIX.md`, and `architecture/v6`.

The existing implementation possesses robust foundational scaffolding (Phase 1–22 traits, SEC-01 fail-closed scope, SEC-07 cryptographic SHA-256 CAS, SEC-09 zero-plaintext secret vault, SQLite WAL observation store, and Tokio/Protobuf event buses). However, the specific vulnerability testing and analysis logic within Domains 1 through 4 is currently limited to high-level scaffolding and baseline heuristics. 

This document provides:
1. A complete inventory of existing structs, traits, functions, and tests across Domains 1–4.
2. An exhaustive gap analysis comparing existing capabilities against the required security engine standards.
3. Detailed architectural designs, data models, algorithms, and technical contracts for the Worker to implement.
4. An empirical verification and test strategy ensuring zero false positives, negative control calibration, and adherence to SEC-01 through SEC-17 invariants.

---

## 1. Existing Codebase Inventory & Current Capabilities

### 1.1 Domain 1: Authentication & Identity Engine
- **Primary Crate**: `sentinel_core/crates/sentinel_auth`
- **Supporting Crates**: `sentinel_common` (traits, domains), `sentinel_storage` (SQLite observation repository)
- **Current File Inventory**:
  - `src/lib.rs`: Exports `DefaultIdentityManager`, `SecureVault`, `JwtUtility`, `ParsedJwt`.
  - `src/vault.rs`: `SecureVault` provides zeroized heap storage (`Zeroizing<String>`) keyed by UUID `SecretReference` to prevent memory scraping (SEC-09 invariant).
  - `src/manager.rs`: `DefaultIdentityManager` implements `IdentityManager` trait:
    - `add_identity(identity: Identity) -> Result<Uuid, SentinelError>`
    - `add_credential(credential: Credential) -> Result<Uuid, SentinelError>`
    - `list_identities() -> Result<Vec<Identity>, SentinelError>`
    - `inject_auth(identity_id: Uuid, request: &mut ParsedRequest) -> Result<(), SentinelError>` (supports Bearer, Basic, Header, and Cookie auth injection).
    - `refresh_credential(credential_id: Uuid) -> Result<(), SentinelError>`
  - `src/jwt.rs`: `JwtUtility` parses header/payload/signature via base64url, validates expiration timestamp, and provides `create_none_algorithm_attack(jwt_str) -> Option<String>`.
  - `src/injector.rs`: `AuthInjector` provides static utility methods `inject_header` and `inject_bearer_token`.
  - `tests/auth_tests.rs`: Tests identity creation, SEC-09 credential vault injection, JWT tampering (`alg: none`), and SQLite persistence.

### 1.2 Domain 2: Session Security Engine
- **Primary Crates**: `sentinel_core/crates/sentinel_scanner`, `sentinel_core/crates/sentinel_auth`
- **Current File Inventory**:
  - `sentinel_scanner/src/checks.rs`: `SecurityCheckEngine::run_passive_checks(tx: &Transaction) -> Vec<Candidate>`:
    - Checks for `Set-Cookie` headers missing case-insensitive `"httponly"` substring.
    - Checks for `Set-Cookie` headers missing case-insensitive `"secure"` substring.
  - `sentinel_scanner/tests/scanner_tests.rs`: `test_passive_security_checks` verifies passive detection of missing `HttpOnly` and `Secure`.

### 1.3 Domain 3: Configuration & Exposure Engine
- **Primary Crates**: `sentinel_core/crates/sentinel_scanner`, `sentinel_core/crates/sentinel_proxy`, `sentinel_core/crates/sentinel_scope`
- **Current File Inventory**:
  - `sentinel_scanner/src/checks.rs`:
    - Checks for missing `Strict-Transport-Security` header.
    - Checks for missing `Content-Security-Policy` header.
    - Checks for server version disclosure in `Server` or `X-Powered-By` headers containing `/` or digits.
    - Checks for sensitive query parameters (`password=`, `token=`, `secret=`, `api_key=`).
  - `sentinel_scope/src/matchers/ssrf.rs`: `SsrfValidator` blocks RFC 1918 private IPs, AWS/GCP cloud metadata (`169.254.169.254`, `metadata.google.internal`), and loopback IPs.

### 1.4 Domain 4: Deep Input Validation Engines
- **Primary Crates**: `sentinel_core/crates/sentinel_fuzzer`, `sentinel_core/crates/sentinel_verification`, `sentinel_core/crates/sentinel_scanner`
- **Current File Inventory**:
  - `sentinel_fuzzer/src/mutators.rs`: `FuzzMutator::mutate(input: &[u8], mutator_type: MutatorType) -> Vec<Vec<u8>>`:
    - `MutatorType::Boundary`: Generates integers, floats, `NaN`, `null`, `undefined`.
    - `MutatorType::FormatString`: Generates `%s`, `%x`, `%n`, `%p`, `{{7*7}}`, `${7*7}`, `#{7*7}`, `<%= 7*7 %>`.
    - `MutatorType::UnicodeNormalization`: Generates overlong UTF-8 (`\xC0\xAE\xC0\xAE\xC0\xAF`), fullwidth solidus, null byte, RTL override, BOM.
    - `MutatorType::Wordlist`: Contains static strings (`' OR '1'='1`, `1; DROP TABLE users--`, `<script>alert(1)</script>`, `../../../../etc/passwd`, `| id`, `; id`).
    - `MutatorType::BitFlip`, `ByteReplace`, `Truncation`, `Grammar`, `Radamsa`.
  - `sentinel_verification/src/strategies.rs`: `StrategyEvaluator`:
    - `evaluate_content(verification_id, body, pattern)`: Simple substring search.
    - `evaluate_differential(verification_id, baseline_status, baseline_len, probe_status, probe_len)`: Byte length and HTTP status comparison.
    - `evaluate_timing(verification_id, expected, actual)`: Simple threshold check (`actual >= 0.8 * expected`).
    - `evaluate_sql_error(verification_id, body)`: Contains 7 hardcoded SQL error strings (MySQL, Oracle, Postgres, SQLite, MSSQL).
  - `sentinel_browser/src/dom.rs`: `DomExtractor` extracts `<title>`, `<a href="...">`, `<script>`, and `<form>`.

---

## 2. Comprehensive Capability Gap Analysis

| Domain | Requirement Area | Existing Code | Required Capability & Gap | Severity |
|---|---|---|---|---|
| **Domain 1** | Username Enumeration | None | Statistical timing analysis ($N \ge 10$, mean/stddev $\mu, \sigma$, Welch's t-test) + response body differential size & AST comparison between valid and invalid usernames. | **HIGH** |
| **Domain 1** | Credential Stuffing & Lockout Protections | None | Automated rate limit / lockout threshold tester (`429`, `Retry-After`, CAPTCHA triggers) + Lockout bypass evaluator (IP header spoofing `X-Forwarded-For`, case mutation, whitespace padding). | **HIGH** |
| **Domain 1** | OAuth 2.0 / OIDC / PKCE Analyzer | Basic `alg: none` in `JwtUtility` | Full flow state machine: `redirect_uri` validation flaws (open redirect, path traversal, parameter pollution), `state` token entropy and omission, PKCE stripping and downgrade (`plain` vs `S256`), algorithm confusion (RS256 $\to$ HS256 with public key), and JWKS injection. | **CRITICAL** |
| **Domain 2** | Cookie Security Attributes | Basic string `.contains()` for `httponly` and `secure` | Structured `Set-Cookie` parser evaluating `Secure`, `HttpOnly`, `SameSite` (Strict/Lax/None), `Domain` scope, `Path`, `Max-Age`/`Expires`, `__Host-` and `__Secure-` prefix compliance, and Shannon entropy analysis. | **HIGH** |
| **Domain 2** | Session Rotation & Fixation | None | Active pre-auth vs post-auth token rotation verifier + Session fixation tester (forcing pre-auth session ID and checking persistence post-login). | **HIGH** |
| **Domain 2** | Session Puzzling & Variable Collision | None | Cross-flow session variable collision / pollution tester across multi-step flows. | **MEDIUM** |
| **Domain 2** | CSRF Defenses | None | Comprehensive anti-CSRF evaluator: token presence, token omission, empty token, tampered token, cross-user replay, HTTP method conversion (`POST` $\to$ `GET`), Origin/Referer bypass, SameSite interactions. | **HIGH** |
| **Domain 3** | Security Headers Deep Analyzer | Missing HSTS/CSP presence check only | Deep CSP AST parser (`script-src`, `unsafe-inline`, `unsafe-eval`, wildcards `*`, missing `base-uri`/`object-src`/`frame-ancestors`), HSTS duration ($\ge 1\text{ yr}$), X-Frame-Options clickjacking, X-Content-Type-Options `nosniff`, Referrer-Policy, Permissions-Policy. | **HIGH** |
| **Domain 3** | CORS Misconfiguration Analyzer | None | Active origin probing: arbitrary origin reflection, `null` origin reflection, wildcard with credentials, regex prefix/suffix bypass (`target.com.evil.com`, `evil-target.com`), protocol downgrade, preflight cache audit. | **HIGH** |
| **Domain 3** | Debug Interface & Sensitive Endpoints | None | Structured prober for Spring Boot Actuator (`/actuator/env`, `/heapdump`), profilers (`/_profiler`), admin consoles, OpenAPI/Swagger docs, GraphQL `__schema`, with Content-Type and AST negative control validation (rejecting soft-404 SPAs). | **HIGH** |
| **Domain 3** | Cloud Metadata & Storage Exposure | SSRF matcher exists in scope | Active probers for AWS IMDSv1/v2, GCP compute metadata, Azure IMDS, exposed S3/GCS/Azure blob storage bucket permission audits. | **HIGH** |
| **Domain 3** | Source Map & Dev Artifact Leaks | None | Automated source map (`.js.map`) detector & unminified source tree extractor, sensitive dev files (`.git/HEAD`, `.env`, `.DS_Store`, `web.config`, `Dockerfile`). | **HIGH** |
| **Domain 4** | SQL Injection (SQLi) | 7 hardcoded error strings, basic string mutators | Complete SQLi engine: 40+ RDBMS error signatures (MySQL, Postgres, Oracle, MSSQL, SQLite, DB2), 3-round boolean oracle inversion ($P_{true} \equiv \text{baseline} \land P_{false} \ne \text{baseline} \land P_{inv} \equiv P_{false}$), jitter-compensated dynamic time delays ($\mu + 3\sigma$, dual 5s/7s trials), UNION column count enumeration, stacked & OAST DNS trigger. | **CRITICAL** |
| **Domain 4** | NoSQL Injection (NoSQLi) | None | MongoDB/document operator injection (`$ne`, `$gt`, `$where`, `$regex`, `$in`) in JSON and URL params + boolean differential evaluation. | **HIGH** |
| **Domain 4** | Command Injection (CMDi) | Basic string mutators | Multi-OS separator matrix (`;`, `\|`, `\|\|`, `&`, `&&`, `\n`, `` ` ``, `$(...)`, `%0a`), timing probes (`sleep`, `timeout`), math canaries, OAST DNS callbacks. | **HIGH** |
| **Domain 4** | Server-Side Template Injection (SSTI) | Static `{{7*7}}` in format mutator | Multi-engine polyglot probe tree (`{{7*7}}`, `${7*7}`, `<%= 7*7 %>`, `#{7*7}`, `*{7*7}`, `{{7*'7'}}`), engine fingerprinting (Jinja2, Twig, ERB, FreeMarker, Velocity, Thymeleaf), negative control math validation ($49 \notin \text{baseline}$). | **HIGH** |
| **Domain 4** | XML External Entity (XXE) | None | Local file disclosure (`/etc/passwd`, `win.ini`), blind OAST XXE, XInclude, parameter entity SSRF, automatic Content-Type mutation to XML. | **HIGH** |
| **Domain 4** | Path Traversal & LFI | Static `../../../../etc/passwd` | Multi-encoding traversal sequences (`../`, `..\`, `....//`, `%2e%2e%2f`, `%252e%252e%252f`, `..%c0%af`, `%00`), target file signature matching (`/etc/passwd`, `win.ini`, `web.xml`, `.env`), path truncation. | **HIGH** |
| **Domain 4** | Cross-Site Scripting (XSS) | Static `<script>alert(1)</script>` | Context-aware HTML tokenizer / AST reflection analyzer (HTML tag body, quoted/unquoted attributes, script context, href context) + DOM XSS taint tracking in browser engine (sources $\to$ sinks) with CAS screenshots. | **CRITICAL** |
| **Domain 4** | Insecure Deserialization | None | Safe non-destructive OAST gadgets (Java URLDNS, Python pickle DNS, PHP stream wrapper, .NET BinaryFormatter) with zero destructive command execution. | **HIGH** |
| **Domain 4** | Prototype Pollution | None | Server-side Node.js/Express JSON/URL mutation with non-destructive canary reflection validation; client-side browser DOM `Object.prototype` taint analysis. | **HIGH** |

---

## 3. Detailed Architectural Design & Specifications

To ensure high cohesion, modularity, zero circular dependencies, and complete integration with the canonical 6-stage vulnerability lifecycle (`Transaction` $\to$ `Observation` $\to$ `Candidate` $\to$ `VerificationResult` $\to$ `Evidence` $\to$ `Finding`), the security testing engines should be organized into dedicated modules under `sentinel_auth`, `sentinel_scanner`, `sentinel_verification`, and a unified `sentinel_engines` or submodules.

```
sentinel_core/crates/
├── sentinel_auth/
│   ├── src/
│   │   ├── enumeration.rs       # Domain 1: Username Enumeration Engine (Timing & Differential)
│   │   ├── stuffing.rs          # Domain 1: Credential Stuffing & Lockout Bypass Analyzer
│   │   ├── oauth.rs             # Domain 1: OAuth 2.0 / OIDC / PKCE Flow Analyzer
│   │   ├── session_rotation.rs  # Domain 2: Session Rotation & Fixation Engine
│   │   ├── session_puzzling.rs  # Domain 2: Session Puzzling / Collision Engine
│   │   ├── csrf.rs              # Domain 2: Anti-CSRF Defense Engine
│   │   ├── jwt.rs               # Domain 1: Enhanced JWT / Alg Confusion / JWKS Engine
│   │   ├── manager.rs           # Identity Manager
│   │   └── vault.rs             # SEC-09 Zero-Plaintext Vault
├── sentinel_scanner/
│   ├── src/
│   │   ├── headers.rs           # Domain 3: Deep Security Headers (CSP AST, HSTS, XFO)
│   │   ├── cors.rs              # Domain 3: CORS Misconfiguration Analyzer
│   │   ├── debug_exposure.rs    # Domain 3: Debug Interface & Framework Discovery
│   │   ├── cloud_exposure.rs    # Domain 3: Cloud Metadata (AWS/GCP/Azure) & Storage
│   │   ├── source_maps.rs       # Domain 3: Source Map & Sensitive Dev File Detector
│   │   ├── cookie_audit.rs      # Domain 2: Comprehensive Cookie Attributes & Entropy
│   │   ├── checks.rs            # Passive & Active Check Orchestration
│   │   └── orchestrator.rs      # Scan Orchestrator
├── sentinel_verification/
│   ├── src/
│   │   ├── sqli.rs              # Domain 4: SQL Injection (Error, Blind Inversion, Time, UNION)
│   │   ├── nosqli.rs            # Domain 4: NoSQL Injection (MongoDB operators, boolean oracle)
│   │   ├── cmdi.rs              # Domain 4: Command Injection (Separators, Time, Canaries, OAST)
│   │   ├── ssti.rs              # Domain 4: Template Injection (Polyglots, Engine Fingerprint)
│   │   ├── xxe.rs               # Domain 4: XML External Entity (File disclosure, Blind OAST)
│   │   ├── traversal.rs         # Domain 4: Path Traversal & LFI (Encodings, OS Signatures)
│   │   ├── xss.rs               # Domain 4: Context-Aware Reflected XSS & DOM Taint Analyzer
│   │   ├── deserialization.rs   # Domain 4: Safe OAST Deserialization Gadgets (URLDNS)
│   │   ├── prototype_pollution.rs # Domain 4: Server & Client Prototype Pollution Analyzer
│   │   ├── strategies.rs        # Strategy Evaluator Dispatcher
│   │   └── engine.rs            # Default Verification Engine
```

### 3.1 Domain 1: Authentication & Identity Engine Architecture

#### 3.1.1 Username Enumeration Timing & Size Engine (`enumeration.rs`)
- **Data Model**:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct TimingSample {
      pub username: String,
      pub duration_ms: f64,
      pub response_status: u16,
      pub response_bytes: usize,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct EnumerationAnalysisResult {
      pub is_vulnerable: bool,
      pub confidence: f32,
      pub timing_divergence_p_value: f64,
      pub timing_difference_ms: f64,
      pub response_diff_identified: bool,
      pub distinguishing_indicator: String,
  }
  ```
- **Algorithm**:
  1. Sends $N=10$ calibrated baseline requests for known valid usernames and $N=10$ requests for randomized non-existent usernames (`sentinel_nonexistent_<uuid>`).
  2. Computes mean $\mu_1, \mu_2$ and sample variance $s_1^2, s_2^2$.
  3. Executes Welch's t-test for unequal variances:
     $$t = \frac{\mu_1 - \mu_2}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}}$$
  4. If $|t| > 3.0$ ($p < 0.005$) and $|\mu_1 - \mu_2| > 20\text{ms}$, or if response status/body diff (e.g. "User not found" vs "Invalid password") reliably differentiates the cohorts, flags `UsernameEnumeration` finding.

#### 3.1.2 Credential Stuffing & Lockout Bypass Analyzer (`stuffing.rs`)
- **Data Model**:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct LockoutBypassVector {
      pub header_name: String,
      pub header_value_generator: String,
      pub description: String,
  }
  ```
- **Algorithm**:
  1. Sends burst of $M=5$ failed login requests to test if lockout / rate limiting engages (`429`, `Retry-After`, error message change).
  2. If lockout engages, generates bypass probes:
     - Header rotation: `X-Forwarded-For: 198.51.100.<rand>`, `Client-IP: 198.51.100.<rand>`, `X-Real-IP`, `X-Originating-IP`, `True-Client-IP`.
     - Username normalization bypass: `admin`, `Admin`, `ADMIN`, `admin%20`, `admin\t`.
  3. If bypass probe successfully receives unthrottled response, flags `AuthenticationLockoutBypass`.

#### 3.1.3 OAuth 2.0 / OIDC / PKCE Analyzer (`oauth.rs`)
- **Evaluates**:
  - `redirect_uri` tampering: Open redirect parameter injection, path traversal (`/callback/../../attacker`), regex prefix/suffix bypass (`target.com.attacker.com`), OAST callback token injection.
  - `state` parameter evaluation: Missing `state`, constant/static `state`, entropy test ($H < 128\text{ bits}$).
  - PKCE enforcement: Stripping `code_challenge` / `code_challenge_method`, downgrading from `S256` to `plain`, omitting `code_verifier` at token exchange endpoint.
  - JWT tampering in OIDC tokens: `alg: none`, HMAC/RSA key confusion (`HS256` signed with public RSA cert), embedded JWK header (`jwk` / `jku`) parameter injection.

---

### 3.2 Domain 2: Session Security Engine Architecture

#### 3.2.1 Comprehensive Cookie Attributes & Entropy Analyzer (`cookie_audit.rs`)
- **Data Model**:
  ```rust
  #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
  pub enum SameSitePolicy {
      Strict,
      Lax,
      None,
      Missing,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ParsedCookie {
      pub name: String,
      pub value: String,
      pub secure: bool,
      pub httponly: bool,
      pub samesite: SameSitePolicy,
      pub domain: Option<String>,
      pub path: Option<String>,
      pub max_age: Option<i64>,
      pub expires: Option<String>,
      pub partitioned: bool,
      pub is_host_prefix: bool,
      pub is_secure_prefix: bool,
      pub shannon_entropy: f64,
  }
  ```
- **Checks**:
  - `MissingSecureFlag`: Cookie set over HTTPS without `Secure`.
  - `MissingHttpOnlyFlag`: Auth/Session cookie readable by JS.
  - `InsecureSameSite`: Missing `SameSite` or `SameSite=None` without `Secure`.
  - `PrefixViolation`: `__Host-` cookie with `Domain` attribute or missing `Secure` / `Path=/`.
  - `WeakEntropy`: Session token with Shannon entropy $< 4.0\text{ bits/byte}$ or total entropy $< 64\text{ bits}$.

#### 3.2.2 Session Rotation & Fixation Engine (`session_rotation.rs`)
- **Algorithm**:
  1. Requests baseline pre-authentication session cookie from `/login`.
  2. Executes valid authentication transaction.
  3. Inspects post-authentication `Set-Cookie` headers:
     - If post-auth cookie equals pre-auth cookie $\to$ flags `SessionNonRotation`.
  4. Fixation test: Sets arbitrary attacker cookie `sessionid=sentinel_fixed_<uuid>`, performs login, and checks if server maintains the fixed session ID for subsequent authenticated requests $\to$ flags `SessionFixation`.

#### 3.2.3 Anti-CSRF Defense Engine (`csrf.rs`)
- **Algorithm**:
  1. Identifies state-changing endpoint (POST/PUT/DELETE) and extracts CSRF token from body/header/cookie.
  2. Performs test suite:
     - `Test 1 (Omission)`: Sends request with CSRF token header/field removed.
     - `Test 2 (Empty)`: Sends request with CSRF token set to `""`.
     - `Test 3 (Tampered)`: Sends request with bit-flipped CSRF token.
     - `Test 4 (Method Conversion)`: Converts `POST` to `GET` with state-changing parameters.
     - `Test 5 (Origin Bypass)`: Sets `Origin: https://evil-attacker.com` and `Referer: https://evil-attacker.com`.
  3. If state-changing action succeeds (returns 200/302 and state mutated), flags `CrossSiteRequestForgery`.

---

### 3.3 Domain 3: Configuration & Exposure Engine Architecture

#### 3.3.1 Deep Security Headers Analyzer (`headers.rs`)
- **Content-Security-Policy (CSP) AST Parser**:
  - Parses directives: `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `object-src`, `base-uri`, `frame-ancestors`, `form-action`.
  - Analyzes keywords: detects `'unsafe-inline'`, `'unsafe-eval'`, `data:`, `*` wildcards.
  - Evaluates clickjacking mitigation: verifies if `frame-ancestors 'none'` or `'self'` is present (mitigates missing X-Frame-Options).
- **HSTS Validator**: Validates `max-age >= 31536000` (1 year), `includeSubDomains`, and `preload`.
- **X-Frame-Options**: Checks for `DENY` or `SAMEORIGIN`.
- **X-Content-Type-Options**: Checks for `nosniff`.
- **Permissions-Policy**: Evaluates disabling unnecessary browser features (`camera=()`, `microphone=()`, `geolocation=()`).

#### 3.3.2 CORS Misconfiguration Analyzer (`cors.rs`)
- **Algorithm**:
  1. Probes endpoint with varied `Origin` headers:
     - `Origin: https://evil-attacker.com` (Arbitrary origin)
     - `Origin: null` (Null origin reflection)
     - `Origin: https://target.com.evil-attacker.com` (Prefix bypass)
     - `Origin: https://evil-target.com` (Suffix bypass)
     - `Origin: http://target.com` (HTTP downgrade)
  2. Inspects response `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`:
     - If `ACAO` reflects attacker origin AND `ACAC: true` $\to$ flags `CORSArbitraryOriginWithCredentials` (**HIGH**).
     - If `ACAO: null` AND `ACAC: true` $\to$ flags `CORSNullOriginWithCredentials` (**HIGH**).
     - If `ACAO: *` AND `ACAC: true` $\to$ flags `CORSWildcardWithCredentials` (**MEDIUM**).

#### 3.3.3 Debug Interface & Cloud Exposure Engine (`debug_exposure.rs`, `cloud_exposure.rs`)
- **Debug & Admin Consoles**:
  - Probes Spring Boot Actuator (`/actuator/env`, `/actuator/heapdump`, `/actuator/health`), Symfony Profiler (`/_profiler/`), Laravel Telescope, Django `/__debug__/`, PHP `phpinfo.php`, Swagger `/v2/api-docs`, GraphQL `__schema`.
  - Negative Control: Verifies response is not an HTML 404 / SPA redirect; verifies `Content-Type: application/json` or structured AST matches expected debug format.
- **Cloud Metadata & Storage**:
  - Tests AWS IMDSv1 (`http://169.254.169.254/latest/meta-data/`), GCP (`http://metadata.google.internal/computeMetadata/v1/` with header), Azure IMDS.
  - Inspects S3 / GCS bucket references and tests unauthenticated listing permissions.

#### 3.3.4 Source Map & Development Artifact Detector (`source_maps.rs`)
- Detects `//# sourceMappingURL=` comments in JavaScript files and probes for `.js.map` files.
- Parses source map JSON, verifies `version: 3` and extracts original TypeScript/React source filenames.
- Probes for exposed `.git/HEAD` (checks for `ref: refs/heads/`), `.git/config`, `.env`, `.DS_Store`, `web.config`.

---

### 3.4 Domain 4: Deep Input Validation Engines Architecture

#### 3.4.1 SQL Injection (SQLi) Engine (`sqli.rs`)
- **Error-Based SQLi**:
  - Comprehensive regex library covering 40+ RDBMS error patterns:
    - MySQL: `You have an error in your SQL syntax`, `Warning: mysql_`, `MySQL server version for the right syntax`.
    - PostgreSQL: `PSQLException`, `syntax error at or near`, `pg_query(): Query failed: ERROR:`.
    - Oracle: `ORA-00933`, `ORA-01756`, `ORA-00942`, `Oracle error`.
    - MSSQL: `Driver][SQL Server]`, `Unclosed quotation mark after the character string`, `Microsoft OLE DB Provider for SQL Server`.
    - SQLite: `SQLite/JDBCDriver`, `sqlite3.OperationalError:`, `unrecognized token:`, `SQLite3::SQLException`.
- **Boolean-Based Blind SQLi**:
  - 3-Round Inversion Pipeline:
    - $P_{\text{true}} = \text{param}' \text{ AND 1=1 --}$
    - $P_{\text{false}} = \text{param}' \text{ AND 1=2 --}$
    - $P_{\text{inv}} = \text{param}' \text{ AND 2=2 --}$
  - Asserts:
    $$\text{Sim}(P_{\text{true}}, \text{Baseline}) > 0.95 \quad \land \quad \text{Sim}(P_{\text{false}}, \text{Baseline}) < 0.85 \quad \land \quad \text{Sim}(P_{\text{inv}}, P_{\text{true}}) > 0.95$$
- **Time-Based Blind SQLi**:
  - Calculates baseline latency $\mu, \sigma$.
  - Injects $T_1 = 5\text{s}$ delay (`SLEEP(5)`, `pg_sleep(5)`, `WAITFOR DELAY '0:0:5'`).
  - Asserts $T_{\text{obs1}} \ge 4.5\text{s} + \mu$.
  - Confirms with secondary $T_2 = 7\text{s}$ trial asserting linear scaling $T_{\text{obs2}} \ge 6.5\text{s} + \mu$.

#### 3.4.2 NoSQL Injection Engine (`nosqli.rs`)
- Operator injection in JSON: `{"$ne": null}`, `{"$gt": ""}`, `{"$regex": ".*"}`.
- Operator injection in query strings: `user[$ne]=1&pass[$ne]=1`.
- Compares response status and JSON structure against baseline; asserts negative control condition ($P_{\text{inv}} = \text{user}[\$eq]=\text{impossible\_random\_string}$).

#### 3.4.3 Command Injection Engine (`cmdi.rs`)
- Separator matrix: `;`, `|`, `||`, `&`, `&&`, `\n`, `` ` ``, `$(...)`, `%0a`.
- Non-destructive probes:
  - Timing: `sleep 5`, `timeout /t 5`.
  - Math Canary: `expr 48123 + 12876` $\to$ checks for `60999` in response.
  - OAST DNS: `nslookup <token>.oast.sentinel.dev` $\to$ correlates callback in `sentinel_oast`.

#### 3.4.4 Server-Side Template Injection (SSTI) Engine (`ssti.rs`)
- Polyglot probe matrix:
  - `{{7*7}}` $\to 49$ (Jinja2, Twig, Nunjucks)
  - `${7*7}` $\to 49$ (FreeMarker, Velocity, Spring EL)
  - `<%= 7*7 %>` $\to 49$ (ERB, EJS)
  - `#{7*7}` $\to 49$ (Ruby Expression Language)
  - `*{7*7}` $\to 49$ (Thymeleaf)
  - `{{7*'7'}}` $\to$ distinguishes Jinja2 (`7777777`) vs Twig (`49`).
- Negative Control: Ensures $49 \notin \text{baseline}$ and secondary arithmetic check (`{{31245*3}} \to 93735`) evaluates correctly.

#### 3.4.5 XML External Entity (XXE) Engine (`xxe.rs`)
- Local file disclosure payloads:
  - `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><foo>&xxe;</foo>`
  - Windows: `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini"> ]><foo>&xxe;</foo>`
- Blind OAST XXE:
  - `<!DOCTYPE foo [ <!ENTITY % xxe SYSTEM "http://<token>.oast.sentinel.dev/eval"> %xxe; ]>`
- Checks for file signatures (`root:x:0:0:`, `[fonts]`) or OAST HTTP/DNS callbacks.

#### 3.4.6 Path Traversal & LFI Engine (`traversal.rs`)
- Encodings: `../`, `..\`, `....//`, `....\\`, `%2e%2e%2f`, `%252e%252e%252f`, `..%c0%af`, `%00`.
- Targets: `/etc/passwd`, `/etc/hosts`, `c:\windows\win.ini`, `web.config`, `.env`.
- Oracle verification: Checks for verbatim signatures (`root:x:0:0:`, `127.0.0.1`, `[fonts]`, `[extensions]`).

#### 3.4.7 Reflected & DOM Cross-Site Scripting (XSS) Engine (`xss.rs`)
- **Context-Aware Reflection Analyzer**:
  - HTML body context: `<sentinel_tag_<uuid>>` $\to$ checks if tag is reflected without HTML entity escaping (`&lt;`).
  - Attribute context: `"><sentinel_tag_<uuid>>` or `" onfocus="alert(1)" autofocus="`.
  - Script context: `';alert(1);//` or `</script><script>alert(1)</script>`.
  - Href context: `javascript:alert(1)`.
- **DOM XSS Taint Engine** (integrated with `sentinel_browser`):
  - Injects unique canary token into sources (`location.search`, `location.hash`).
  - Inspects Playwright execution traces for tainted strings entering execution sinks (`innerHTML`, `document.write`, `eval`, `setTimeout`).
  - Captures CAS proof screenshot.

#### 3.4.8 Insecure Deserialization Engine (`deserialization.rs`)
- Safe non-destructive OAST gadgets:
  - Java: `URLDNS` gadget triggering pure DNS resolution via `java.net.URL` hashcode computation without code execution.
  - Python: `pickle` payload triggering `socket.gethostbyname("<token>.oast.sentinel.dev")`.
  - PHP: Stream wrapper `http://<token>.oast.sentinel.dev`.
  - .NET: `BinaryFormatter` DNS trigger.
- Correlates callback in `DefaultVerificationEngine` with OAST token.

#### 3.4.9 Prototype Pollution Engine (`prototype_pollution.rs`)
- Server-Side (Node.js/Express):
  - Injects `"__proto__": {"sentinel_polluted_prop_<uuid>": "sentinel_value"}` into JSON body / URL param.
  - Verifies reflection on independent unmutated endpoint (`GET /api/status` reflects injected property).
- Client-Side:
  - Injects `?__proto__[sentinel_client_prop_<uuid>]=1` in browser navigation.
  - Verifies `Object.prototype.hasOwnProperty('sentinel_client_prop_<uuid>')` evaluates to `true` in browser DOM context.

---

## 4. Implementation & Verification Strategy for Workers

### 4.1 Recommended Implementation Steps
1. **Module Creation in Crates**:
   - Add new engine modules to `sentinel_auth/src/` (`enumeration.rs`, `stuffing.rs`, `oauth.rs`, `session_rotation.rs`, `session_puzzling.rs`, `csrf.rs`).
   - Add new engine modules to `sentinel_scanner/src/` (`headers.rs`, `cors.rs`, `debug_exposure.rs`, `cloud_exposure.rs`, `source_maps.rs`, `cookie_audit.rs`).
   - Add new engine modules to `sentinel_verification/src/` (`sqli.rs`, `nosqli.rs`, `cmdi.rs`, `ssti.rs`, `xxe.rs`, `traversal.rs`, `xss.rs`, `deserialization.rs`, `prototype_pollution.rs`).
2. **Expose Public Interfaces**:
   - Update `lib.rs` in each crate to re-export the new engine structs, evaluation functions, and error types.
3. **Register Strategies in Verification Engine**:
   - Update `DefaultVerificationEngine::available_strategies` and `verify_candidate` in `sentinel_verification/src/engine.rs` to route candidates to the specialized engine evaluators.
4. **Integration with Passive/Active Checks**:
   - Update `SecurityCheckEngine::run_passive_checks` in `sentinel_scanner/src/checks.rs` to invoke the deep header, cookie, CORS, and exposure analyzers on intercepted transactions.
   - Expand `generate_active_probes` to generate structured candidate probes for SQLi, NoSQLi, CMDi, SSTI, XXE, Traversal, XSS, and Prototype Pollution.

### 4.2 Quality Gating & Testing Strategy
1. **Unit Test Suite**:
   - Write comprehensive unit tests in each crate's `tests/` directory verifying each engine's detection logic, payload generator, and negative control handling.
2. **Negative Control Calibration**:
   - Verify that non-vulnerable baseline responses, sanitized inputs, and remediated headers yield zero candidates and zero false positive findings.
3. **Rust Toolchain Quality Gates**:
   - Verify `cargo check --workspace --locked` passes with 0 errors.
   - Verify `cargo fmt --check` passes cleanly.
   - Verify `cargo clippy --workspace --all-targets --all-features` passes with 0 warnings.
   - Verify `cargo test --workspace --locked` passes 100% across all unit, integration, and security tests.
4. **Spec Validator**:
   - Verify `python architecture\v6\validate_v6_spec.py` passes with `BLOCKERS = 0`.

---

## 5. Summary & Actionable Recommendations

| Area | Current State | Target State | Worker Priority |
|---|---|---|---|
| **Domain 1: Auth & Identity** | Scaffolding for Vault & JWT `alg: none` | Full Enumeration (timing/size), Stuffing/Lockout, OAuth/OIDC/PKCE, JWT Alg Confusion | **P0** |
| **Domain 2: Session Security** | Basic `httponly`/`secure` substring checks | Deep Cookie Audit (SameSite, prefixes, entropy), Session Rotation & Fixation, Anti-CSRF | **P0** |
| **Domain 3: Config & Exposure** | Missing HSTS/CSP check | Deep CSP AST parser, CORS misconfig analyzer, Debug discovery, Cloud metadata, Source maps | **P0** |
| **Domain 4: Deep Input Validation** | Basic static strings & 7 SQL errors | Modular SQLi (Error/Blind/Time/UNION), NoSQLi, CMDi, SSTI, XXE, Traversal, XSS/DOM, Deserialization, Prototype Pollution | **P0** |

This analysis provides the complete architectural baseline and concrete implementation blueprint for Milestone M3 Domains 1–4.
