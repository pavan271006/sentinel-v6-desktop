# Security Policy

## Reporting Security Vulnerabilities

The Sentinel engineering team takes the security and integrity of our codebase, proxy pipeline, and distributed binaries seriously. As an application security assessment framework and intercepting proxy, Sentinel is engineered with strict internal security invariants (SEC-01 through SEC-12) to ensure research activities remain bounded, deterministic, and safe.

If you believe you have discovered a vulnerability in Sentinel V6 Desktop (including our Rust core, IPC protocol bridge, or React UI), please follow the coordinated disclosure process outlined below.

---

## Supported Versions

Only the latest release and the current active development branch (`master`) receive active security patches.

| Version | Supported          | Security Maintenance Status |
| ------- | ------------------ | ---------------------------- |
| 6.0.x   | :white_check_mark: | Current Active Stable Release |
| < 6.0.0 | :x:                | End of Life (Deprecated)     |

---

## Coordinated Disclosure Process

To report a vulnerability responsibly:

1. **Do NOT open a public issue or discussion** regarding an unpatched security flaw.
2. **Submit a Private Vulnerability Report via GitHub:**
   - Navigate to the [Security Advisories](https://github.com/pavan271006/sentinel-v6-desktop/security/advisories) tab of this repository.
   - Click **"Report a vulnerability"** to open a confidential advisory draft.
3. **Include Technical Details:**
   - A clear description of the vulnerability (e.g., IPC command injection, proxy scope boundary bypass, memory corruption in TLS termination).
   - Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
   - Affected platforms (Windows 11, Ubuntu 22.04+, macOS Sonoma).
   - Impact assessment (CVSS v3.1 vector if applicable).

### Our Response Commitment
- **Initial Acknowledgment:** Within **24 to 48 hours**.
- **Triage & Reproducibility Assessment:** Within **3 business days**.
- **Remediation & Patch Delivery:** We strive to release a critical patch within **7 business days** before publishing a public CVE advisory.

---

## Architectural Security Invariants (SEC-01 – SEC-12)

When auditing or contributing to Sentinel, all code changes must strictly adhere to our core security invariants:

1. **SEC-01: Scope Enforcement Gate**: Any network request initiated by automated scanners, repeaters, or crawlers MUST pass through the scope filter (`sentinel_scope`). Out-of-scope targets are strictly blocked at the socket dispatcher level.
2. **SEC-02: Local IPC Binding**: The Tauri IPC listener and proxy listeners must bind exclusively to loopback addresses (`127.0.0.1` / `::1`) unless explicit multi-interface bridging is authorized.
3. **SEC-03: Content-Addressable Storage (CAS) Immutability**: Captured traffic entries stored in SQLite WAL cannot be overwritten once signed with a hash identifier.
4. **SEC-04: Nonce & Signature Hygiene**: Single-use tokens and CSRF nonces mined during automated crawling must never leak across tenant contexts.
5. **SEC-05: Sandboxed Plugin Execution**: WASM and Rhai plugin engines must be fuel-metered to prevent CPU starvation and arbitrary host system calls.
6. **SEC-06: Reverse-Proxy Perimeter Sanitization**: Strip internal tracking headers (`X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`) before upstream socket egress.
7. **SEC-07: Safe Deserialization**: All untrusted external inputs (HAR imports, OpenAPI specs, raw HTTP responses) must pass strict schema validation with zero dynamic eval.
8. **SEC-08: Zero-Leak Log Redaction**: Authentication credentials, Authorization headers, and session tokens are masked by default in diagnostic logs.
9. **SEC-09: No Embedded Secrets**: API keys, signing certificates, and test credentials must never be committed to source control.
10. **SEC-10: Sub-Process Isolation**: Browser automation sessions run with sandboxed user profiles and sanitized temporary directories.
11. **SEC-11: Rate-Limiting & Anti-Ban Backoff**: Automated fuzzers must respect 429/503 retry-after constraints to prevent unintended DoS conditions on targets.
12. **SEC-12: Memory Safety**: All Rust core crates must compile with zero undefined behavior (`#![deny(unsafe_code)]` across proxy handlers).

---

## Attribution & Hall of Fame

We believe in crediting security researchers who help protect the open-source AppSec community. Confirmed, responsibly disclosed vulnerabilities will be acknowledged in our GitHub Release Notes and Project Hall of Fame.
