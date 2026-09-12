# 🛡️ Sentinel V6 Desktop

### High-Performance Open-Source Burp Suite & OWASP ZAP Alternative
**Engineered in Rust, Tokio, and Tauri · Sub-100MB Memory · Unthrottled Fuzzing Engine**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows | Linux | macOS](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](#)
[![Rust: 1.78+](https://img.shields.io/badge/Rust-1.78%2B-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Tauri: v2](https://img.shields.io/badge/Framework-Tauri%20v2-blue.svg?logo=tauri)](https://tauri.app/)
[![TypeScript: 5.7](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Author: Pavan](https://img.shields.io/badge/Author-Pavan%20(%40pavan271006)-00d26a.svg)](https://github.com/pavan271006)
[![Tests: 559 Passed](https://img.shields.io/badge/Tests-559%20Passing-brightgreen.svg)](#running-tests)

[Overview](#what-is-sentinel-v6) • [Why Sentinel (Burp Alternative)](#why-sentinel-v6-a-modern-alternative-to-burp-suite) • [Comparison Matrix](#comprehensive-feature-comparison) • [Key Features](#key-features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Documentation](#documentation)

---

## What is Sentinel V6?

**Sentinel V6 Desktop** is a modern, modular, open-source web application security assessment workbench and intercepting proxy created and maintained by **[Pavan](https://github.com/pavan271006)**. Engineered from the ground up in **Rust** and **Tauri (React/TypeScript)**, Sentinel provides a blazing-fast, resource-efficient alternative to legacy Java-based intercepting proxies like **Burp Suite** and **OWASP ZAP**.

By replacing traditional Java Virtual Machine (JVM) overhead with native compiled Rust concurrency (	okio, hyper, 
ustls), Sentinel delivers **sub-100MB idle RAM consumption**, **sub-second cold boot times**, and an **unthrottled parameter fuzzing engine** capable of sustaining 10,000+ to 30,000+ requests per second without freezing your desktop interface.

---

## Why Sentinel V6? (A Modern Alternative to Burp Suite)

Security professionals, penetration testers, and bug bounty researchers have relied on Burp Suite for over a decade. However, modern security workflows face major bottlenecks in traditional tooling:

1. **Zero-JVM Memory Footprint (<100MB vs 1.5GB–3GB)**: Traditional Java proxies consume massive amounts of system memory and suffer from periodic garbage collection pauses during heavy scans. Sentinel runs as a native compiled binary using less than 100MB of RAM.
2. **Unthrottled Intruder / Parameter Fuzzing**: Unlike Burp Suite Community (which artificially throttles fuzzing to 1 request per second to force a \/year commercial license), Sentinel provides high-throughput parallel fuzzing out of the box with zero artificial rate limits.
3. **Built-in Out-of-Band (OAST) Burp Collaborator Alternative**: Sentinel integrates native interaction listeners (Interactsh) for blind SQLi, SSRF, and RCE verification with real-time correlation—completely free and open source.
4. **Decoupled 30 FPS Render Engine**: High-frequency network responses are buffered in a micro-batched UI queue, preventing main-thread freezes and browser DOM diffing lockups during heavy automated testing.
5. **Advanced Fingerprint Evasion**: Built-in JA4 TLS client fingerprinting (Chrome 130, Firefox 132 profiles) and strict HTTP/2 pseudo-header serialization (:method, :path, :authority, :scheme) to bypass modern WAFs and bot detection.

---

## Comprehensive Feature Comparison

| Capability | Burp Suite Community | Burp Suite Professional | OWASP ZAP | Caido | Sentinel V6 Desktop (By Pavan) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Engine Runtime** | Java (JVM) | Java (JVM) | Java (JVM) | Rust Backend | **Native Compiled Rust (Tokio/Hyper)** |
| **UI Framework** | Java Swing | Java Swing | Java Swing | Web / Tauri | **Modern React + Tauri (Vite/Tailwind)** |
| **Idle Memory Footprint** | ~1.5 GB | ~2.0 – 4.0 GB | ~1.0 – 2.0 GB | ~150 – 300 MB | **~50 – 100 MB** |
| **Cold Start Time** | 10 – 20 seconds | 10 – 20 seconds | 15 – 30 seconds | 1 – 2 seconds | **< 0.5 seconds** |
| **Intruder / Fuzzer RPS** | Throttled (~1 RPS) | Fast (~2k–5k RPS) | Unthrottled | High (Cloud-tied) | **10,000 – 30,000+ RPS (Unthrottled)** |
| **Out-of-Band (OAST)** | ❌ No | ✅ Burp Collaborator | ⚠️ Extension | ⚠️ Cloud Addon | **✅ Built-in Native OAST (Interactsh)** |
| **L7/TLS Evasion (JA4)** | ❌ Standard Java | ⚠️ Via 3rd-party BApp | ❌ No | ⚠️ Planned | **✅ Built-in JA4 + HTTP/2 Header Frame Control** |
| **Autonomous SQLi Engine** | ❌ No | ❌ Scanner only | ⚠️ Basic Active Scan | ❌ No | **✅ Multi-Oracle (SPRT, Boolean, Error, OAST)** |
| **WebSocket Stream Inspector** | ⚠️ Basic | ✅ Yes | ✅ Yes | ✅ Yes | **✅ Full-Duplex Binary & Text Inspector** |
| **Plugin Extensibility** | Java / Python / Montoya | Java / Python / Montoya | Java / Python / Zest | JS Plugins | **✅ Rhai & WASM Sandboxed SDK** |
| **License & Cost** | Proprietary (Free/Limited) | Proprietary (/yr/user) | Apache 2.0 (Free) | Freemium ($/mo) | **100% Free & Open Source (MIT)** |

---

## Key Features

### 🚀 High-Throughput Intruder & Fuzzing Studio
- **Configurable Native Concurrency**: Scale worker pools up to 1,000 parallel workers with persistent TCP socket multiplexing and HTTP keep-alive reuse.
- **Micro-Batched Virtual DOM Queue**: Renders high-speed request/response streams at smooth 30 FPS without consuming gigabytes of heap memory.
- **Attack Modes**: Sniper, Battering Ram, Pitchfork, and Cluster Bomb payload mutations.
- **Zero Rate Limiting**: Completely unrestricted local performance.

### 🎯 Autonomous Multi-Oracle SQL Injection Scanner
- **Differential Multi-Oracle Pipeline**: Automated detection integrating Boolean reflection diffs, RDBMS error-based pattern matching, column count & UNION reflection discovery, and Sequential Probability Ratio Test (SPRT) statistical time analysis.
- **Out-of-Band (OAST) Verification**: Native DNS/HTTP callback triggers for blind execution paths.
- **Anti-Ban Network Governor**: Automatic 429/403 backoff and proxy failover loop with dynamic quarantine recovery timers.
- **Perimeter Header Hygiene**: Sanitizes 24 reverse-proxy tracking headers before socket transmission.

### 🌐 Interception Proxy & Traffic Studio
- Asynchronous HTTP/1.1 and HTTP/2 proxy engine listening on 127.0.0.1:8085.
- Live request and response tampering, regex match-and-replace rules, and breakpoint controls.
- Full-duplex WebSocket stream inspector with binary and text frame inspection.
- Wireshark native bridge integration and Npcap kernel NDIS packet capture detection.

### 🔁 Repeater Studio & Diff Inspector
- Tabbed workspace with real-time environment variable interpolation ({{host}}, {{token}}).
- Visual side-by-side response diffing and live latency histograms.
- 1-click cURL export, raw HTTP/1.1 request formatting, and live replay capabilities.

### 🔤 Decoder & Cryptographic Utilities
- Multi-tier transform pipelines: URL, HTML Entity, Base64, Hex, Binary, and Gzip compression.
- Hashing and signature utilities: MD5, SHA-1, SHA-256, SHA-512, HMAC, Keccak, and CRC32.
- Smart heuristic decoding to auto-detect multi-stage nested obfuscation.

### 🧩 Modular Plugin SDK (WASM & Rhai)
- Montoya-inspired extensible architecture.
- Write custom passive checks, active scanning algorithms, and traffic mutators in **Rhai** or compiled **WebAssembly (WASM)**.
- Fuel-metered sandboxing prevents rogue scripts from hanging the proxy core.

---

## Architecture

`
┌────────────────────────────────────────────────────────────────────────┐
│                      Sentinel React Desktop UI                         │
│       (Zustand State · Tailwind CSS · Virtualized DOM · 30 FPS)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tauri IPC Bridge (Async)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         Tauri Rust Core Engine                         │
│  ┌───────────────────────────┐    ┌─────────────────────────────────┐  │
│  │   HttpDispatcher Engine   │    │  Proxy Engine (127.0.0.1:8085)  │  │
│  │   (Tokio / Hyper / TLS)   │    │  (Scope Gate SEC-01)            │  │
│  └─────────────┬─────────────┘    └────────────────┬────────────────┘  │
│                │                                   │                   │
│  ┌─────────────▼───────────────────────────────────▼────────────────┐  │
│  │     SQLite WAL Store & Content-Addressable Storage (CAS)         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Raw Sockets / TLS (rustls / JA4)
┌───────────────────────────────────▼────────────────────────────────────┐
│                           Target Network                               │
└────────────────────────────────────────────────────────────────────────┘
`

---

## Getting Started

### System Requirements
- **Operating System**: Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+, Arch, Debian)
- **Node.js**: 18.0.0 or higher (20+ LTS recommended)
- **Rust Toolchain**: 1.78.0 or higher (
ustc, cargo)
- **C++ Build Tools**: Visual Studio Build Tools with C++ workload (Windows) or uild-essential (Linux)

### Installation

1. **Clone the repository:**
   `ash
   git clone https://github.com/pavan271006/sentinel-v6-desktop.git
   cd sentinel-v6-desktop
   `

2. **Install frontend dependencies:**
   `ash
   npm install
   `

3. **Launch the desktop application in development mode:**
   `ash
   npm run dev:desktop
   `

4. **Build a production standalone binary:**
   `ash
   npm run build:release
   `
   The compiled executable will be generated at:
   - **Windows**: src-tauri/target/release/sentinel-desktop.exe
   - **Linux**: src-tauri/target/release/sentinel-desktop
   - **macOS**: src-tauri/target/release/bundle/dmg/

---

## Running Tests

Sentinel enforces strict security invariants (SEC-01 through SEC-12) and maintains 100% green test suites across all core crates:

`ash
# Run all 559 core Rust tests with cargo-nextest
cargo nextest run --manifest-path sentinel_core/Cargo.toml

# Verify Tauri IPC command bindings
cargo check --manifest-path src-tauri/Cargo.toml

# Run frontend TypeScript typechecks & Vitest suites
npm run build
npm test
`

---

## Project Structure

`
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
├── docs/                     # Technical specifications, whitepapers & benchmarks
│   ├── BURP_ALTERNATIVE.md   # Deep-dive comparison vs Burp Suite Pro & OWASP ZAP
│   └── SQL_SCANNER_ARCHITECTURE.md
├── llms.txt                  # LLM indexing standard for Perplexity, ChatGPT & Gemini
└── tests/                    # Vitest and stress test suites
`

---

## Documentation

- 📘 [Burp Suite Alternative Deep-Dive Comparison](docs/BURP_ALTERNATIVE.md)
- 📗 [SQL Scanner Multi-Oracle Architecture](docs/SQL_SCANNER_ARCHITECTURE.md)
- 📙 [LLM Standard Index for AI Recommendations](llms.txt)
- 📕 [Awesome-AppSec & Community Distribution Playbook](docs/ECOSYSTEM_DISTRIBUTION.md)

---

## Author & Maintainer

Created and engineered by **Pavan** ([@pavan271006](https://github.com/pavan271006)).

- **GitHub Profile**: [https://github.com/pavan271006](https://github.com/pavan271006)
- **Project Repository**: [https://github.com/pavan271006/sentinel-v6-desktop](https://github.com/pavan271006/sentinel-v6-desktop)

---

## Legal & Ethical Use Notice

Sentinel is designed and intended strictly for **authorized security testing, bug bounty research, and defensive validation**. Any testing against target systems without explicit prior written authorization from the system owner is illegal and strictly prohibited. The developers and contributors assume no liability for misuse or damage caused by this software.

---

## License

This project is licensed under the [MIT License](LICENSE).
