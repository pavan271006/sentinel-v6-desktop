# 🛡️ Sentinel V6 — Sovereign Web Security & Pentesting Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8D8.svg?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Backend-Rust%202021-DEA584.svg?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg?logo=react)](https://react.dev/)

**Sentinel V6** is an enterprise-grade, high-performance web application security assessment and offensive engineering desktop platform. Built with **Rust (Tauri v2)** and **React 18 / TypeScript**, it pairs the flexibility of a modern GUI with the raw socket performance of compiled systems code.

---

## ⚡ Key Modules & Capabilities

### 1. 🚀 Turbo Intruder & High-Throughput Fuzzer
- **Native Concurrency Scaling**: Configurable up to **1,000 parallel workers** with zero-allocation indexed buffer insertion.
- **30 FPS Micro-Batch UI Engine**: Decouples the network socket execution from the React virtual DOM, eliminating UI freezing even at 30,000+ RPS.
- **Socket Reuse**: Automatic HTTP Keep-Alive connection pooling across test permutations.
- **Attack Modes**: Full support for Sniper, Battering Ram, Pitchfork, and Cluster Bomb attacks.

### 2. 🔍 Sovereign Multi-Oracle SQL Injection Scanner
- **8-Stage Autonomous Pipeline**: End-to-end profiling, AST boundary inference, differential discovery, schema mapping, and vectorized extraction.
- **L4/L7 Cryptographic Evasion**: Chrome 130 and Firefox 132 JA4 TLS profile emulation (	13d1715h2_...) and browser-compliant HTTP/2 pseudo-header ordering (:method, :path, :authority, :scheme).
- **Markov Human Navigation Engine**: Simulates realistic browsing transitions and fetches background assets to prevent behavioral rate-limit flags.
- **Anti-Ban Architecture**: Auto-failover proxy pool with adaptive 30s cooldown (429) and 60s quarantine (403) recovery.
- **24-Header Leakage Stripping**: Proactively strips internal scanner and reverse-proxy headers (cf-connecting-ip, x-forwarded-for, x-sentinel-*).

### 3. 🛰️ Intercepting Proxy & Traffic Studio
- Real-time HTTP/1.1 and HTTP/2 proxying on 127.0.0.1:8085.
- Full request/response modification, live intercept controls, and match-and-replace rules.
- Streaming WebSocket inspector with binary/text frame decoding.

### 4. 🔁 Modular Repeater Studio
- Tabbed request crafting with environment variable interpolation ({{token}}, {{host}}).
- Real-time side-by-side response visual diffing.
- 1-click cURL export and replay.

### 5. 🧮 Burp-Style Decoder & Transform Utility
- Multi-layer encoding/decoding: URL, HTML Entity, Base64, Hex, Binary, and Gzip/Deflate.
- Cryptographic hashing: MD5, SHA-1, SHA-256, SHA-512, HMAC, Keccak, and CRC32.
- Smart auto-decode chain detection.

### 6. 🌐 Out-of-Band (OAST) / Collaborator Integration
- Integrated asynchronous OAST tracker supporting Interactsh DNS/HTTP callback monitoring.

---

## 🏗️ Architecture & Tech Stack

- **Desktop Framework**: Tauri v2
- **Backend Core**: Rust (Tokio async runtime, hyper, rustls, SQLite WAL storage)
- **Frontend Stack**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Zustand State Management
- **Persistence**: Content-Addressable Storage (CAS) with SQLite metadata indexing

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (Node v20 or v22 recommended)
- **Rust**: 1.78+ (ustc and cargo)
- **Visual Studio C++ Build Tools** (on Windows)

### Installation & Development

1. **Clone the repository:**
   \\\ash
   git clone https://github.com/pavan271006/sentinel-v6-desktop.git
   cd sentinel-v6-desktop
   \\\

2. **Install frontend dependencies:**
   \\\ash
   npm install
   \\\

3. **Run in development mode:**
   \\\ash
   npm run dev:desktop
   \\\

4. **Build release binary:**
   \\\ash
   npm run build:release
   \\\

---

## ⚖️ Legal & Disclaimer

> [!WARNING]
> This software is developed for **authorized penetration testing, bug bounty assessments, and security research purposes only**. Users are strictly responsible for complying with all applicable local, state, national, and international laws. Do not test systems without prior explicit written authorization.

---

## 📄 License

Licensed under the [MIT License](LICENSE).
