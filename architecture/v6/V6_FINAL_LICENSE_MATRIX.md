# SENTINEL V6 — FINAL LICENSE MATRIX

> **DATE**: 2026-08-17
> **STATUS**: AUTHORITATIVE

SENTINEL V6 is designed as a commercial product. The supply chain must be strictly audited to prevent viral copyleft licensing from polluting the core IP.

| Component / Dependency | License | Commercial Usage | Viral Risk | Mitigation |
|------------------------|---------|------------------|------------|------------|
| `tokio` (Rust Core) | MIT | Permitted | None | N/A |
| `sqlite` (libsqlite3) | Public | Permitted | None | N/A |
| `tantivy` (Search) | MIT | Permitted | None | N/A |
| `httparse` (Forked) | MIT/Apache| Permitted | None | Fork is internal |
| **Playwright** (Browser)| Apache 2.0| Permitted | None | Out-of-process IPC |
| **Semgrep** (Adapter) | LGPL / Commons | High Risk | Viral if linked | Strict sub-process adapter execution. NO static/dynamic linking. |
| **Subfinder** (Adapter)| MIT | Permitted | None | Sub-process |
| **CloudFox** (Adapter) | MIT | Permitted | None | Sub-process |

**Rule**: NO GPLv2 or GPLv3 code may be linked, imported, or compiled into the Sentinel Rust binaries. All tools with restrictive or non-commercial licenses must execute completely out-of-process via the `ExternalToolAdapter` interface, passing JSON over STDIN/STDOUT.
