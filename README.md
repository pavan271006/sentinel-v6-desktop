# Sentinel Desktop

A modern, high-performance web application security assessment suite built with Rust and React/TypeScript.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![Rust](https://img.shields.io/badge/Rust-1.78%2B-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Framework-Tauri%20v2-blue.svg?logo=tauri)](https://tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)

---

Sentinel is a modular, native security workbench designed as a lightweight, performant alternative to legacy Java-based interception proxies. It combines a Rust-powered network engine (Tokio, Hyper, rustls) with a responsive React/TypeScript user interface, delivering sub-millisecond local latency, raw socket pipelining, and zero UI thread contention during heavy automated fuzzing.

## Key Features

### High-Throughput Intruder & Fuzzer
- **Native Concurrency Scaling**: Configurable worker pool supporting up to 1,000 concurrent workers.
- **Decoupled 30 FPS Render Engine**: Micro-batched UI update queue prevents main-thread lockups and DOM diffing overhead during high-volume attacks (10,000+ RPS).
- **Socket Multiplexing & Keep-Alive**: Persistent connection pooling eliminates repeated TCP handshakes and TLS renegotiation overhead.
- **Attack Modes**: Full support for Sniper, Battering Ram, Pitchfork, and Cluster Bomb parameter mutations.

### Autonomous Multi-Oracle SQL Injection Scanner
- **Differential Multi-Oracle Pipeline**: Multi-phase detection integrating Boolean reflection diffs, error-based pattern matching, column count & UNION reflection discovery, SPRT statistical time analysis, and Out-of-Band (OAST) callbacks.
- **L4/L7 Cryptographic Evasion**: Browser-accurate JA4 TLS profiles (Chrome 130, Firefox 132) and strict HTTP/2 pseudo-header serialization (`:method`, `:path`, `:authority`, `:scheme`).
- **Markov Navigation Topography**: Graph-driven asset pre-fetching and natural Referer chain generation to emulate organic user workflows and evade behavioral heuristic filters.
- **Anti-Ban Network Governor**: Automatic 429/403 backoff and proxy failover loop with dynamic quarantine recovery timers.
- **Strict Perimeter Hygiene**: Strips 24 reverse-proxy tracking and internal scanner headers before socket transmission.

### Interception Proxy & Traffic Studio
- Asynchronous HTTP/1.1 and HTTP/2 interception engine listening on `127.0.0.1:8085`.
- Live request and response modification, regex match-and-replace rules, and breakpoint controls.
- Full-duplex WebSocket stream inspector with binary and text frame inspection.

### Repeater Studio
- Tabbed workspace with real-time environment variable interpolation (`{{host}}`, `{{token}}`).
- Visual side-by-side response diffing.
- 1-click cURL export and live replay capabilities.

### Decoder & Cryptographic Utility
- Multi-tier transform pipelines: URL, HTML Entity, Base64, Hex, Binary, and Gzip compression.
- Hashing and signature utilities: MD5, SHA-1, SHA-256, SHA-512, HMAC, Keccak, and CRC32.
- Smart heuristic decoding to auto-detect multi-stage encoding layers.

### Out-of-Band (OAST) Integration
- Built-in integration with asynchronous interaction listeners (Interactsh) for blind vulnerability verification via DNS and HTTP channels.

---

## Comparison Matrix

| Feature | Burp Suite Community | Burp Suite Pro | Caido | Sentinel Desktop |
| :--- | :---: | :---: | :---: | :---: |
| **Engine Runtime** | Java JVM (Throttled) | Java JVM | Rust Backend | **Native Rust (Tokio/Hyper)** |
| **Intruder Speed** | ~1–2 RPS | ~2,000–5,000 RPS | High | **10,000–30,000+ RPS** |
| **Memory Footprint** | ~1–2 GB | ~2–4 GB | ~150–300 MB | **~50–150 MB** |
| **UI Responsiveness** | Freezes under load | Moderate | Responsive | **30 FPS Micro-batched Queue** |
| **L7 Evasion (JA4 / H2)** | Limited | Extension-based | Planned | **Native JA4 + H2 Ordering** |
| **License** | Proprietary | Commercial | Freemium | **Open Source (MIT)** |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│               Sentinel React Desktop UI                │
│    (Zustand State Store · Tailwind CSS · Virtual DOM)  │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC Bridge (Async)
┌───────────────────────────▼────────────────────────────┐
│                  Tauri Rust Core Engine                │
│  ┌──────────────────┐ ┌──────────────────────────────┐ │
│  │  HttpDispatcher  │ │  Proxy Engine (127.0.0.1)    │ │
│  │  (Tokio / Hyper) │ │  (Scope Gate SEC-01)         │ │
│  └────────┬─────────┘ └──────────────┬───────────────┘ │
│           │                          │                 │
│  ┌────────▼──────────────────────────▼───────────────┐ │
│  │ SQLite WAL Store & Content-Addressable Storage    │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────┬────────────────────────────┘
                            │ Raw Sockets / TLS (rustls)
┌───────────────────────────▼────────────────────────────┐
│                    Target Network                      │
└────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher (`v20+` LTS recommended)
- **Rust Toolchain**: `1.78.0` or higher (`rustc`, `cargo`)
- **C++ Build Tools**: Visual Studio Build Tools with C++ workload (Windows) or `build-essential` (Linux)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pavan271006/sentinel-v6-desktop.git
   cd sentinel-v6-desktop
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

### Running the Application

- **Frontend Development Server (Browser Mode):**
  ```bash
  npm run dev
  ```

- **Full Desktop Application (Tauri Window):**
  ```bash
  npm run dev:desktop
  ```

### Building for Release

Compile the production frontend assets and optimized Rust release binary:
```bash
npm run build:release
```
The compiled executable will be located in:
`src-tauri/target/release/sentinel-desktop.exe` (Windows) or `src-tauri/target/release/sentinel-desktop` (Linux/macOS).

---

## Running Tests

Sentinel maintains a comprehensive suite of unit, integration, and E2E regression tests:

```bash
# Run all unit and component tests
npm test

# Run SQL Scanner multi-oracle verification tests
npx vitest run src/services/sqlScanner/

# Run Intruder performance & state tests
npx vitest run tests/stores/intruderStore.test.ts
```

---

## Repository Structure

```
sentinel-v6-desktop/
├── src/                      # React/TypeScript desktop frontend
│   ├── components/           # Reusable UI widgets and workspace inspectors
│   ├── ipc/                  # Tauri IPC client contracts & bridges
│   ├── services/sqlScanner/  # Multi-oracle SQL injection engine & evasion modules
│   ├── stores/               # Zustand state stores (Proxy, Repeater, Intruder, etc.)
│   └── workspaces/           # Main workspace view controllers
├── src-tauri/                # Tauri v2 native desktop application wrapper
│   ├── src/                  # Tauri command dispatchers and application state
│   └── Cargo.toml            # Desktop wrapper crate manifest
├── sentinel_core/            # Core Rust workspace crates (30+ modular crates)
│   └── crates/
│       ├── sentinel_dispatch/# High-performance async socket dispatcher
│       ├── sentinel_fuzzer/  # Native mutation generators & grammar AST fuzzer
│       ├── sentinel_proxy/   # Transparent HTTP/1.1 & HTTP/2 proxy engine
│       ├── sentinel_repeater/# Request execution and variable interpolation
│       └── sentinel_storage/ # SQLite WAL transaction & observation storage
├── ucma-x/                   # Formal verification & SMT solver crates
└── tests/                    # Vitest and integration test suites
```

---

## Legal & Ethical Use Notice

Sentinel is designed and intended strictly for **authorized security testing, bug bounty research, and defensive validation**. Any testing against target systems without explicit prior written authorization from the system owner is illegal and strictly prohibited. The developers and contributors assume no liability for misuse or damage caused by this software.

---

## License

This project is licensed under the [MIT License](LICENSE).