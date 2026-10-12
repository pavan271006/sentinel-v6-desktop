# Contributing to Sentinel V6 Desktop

First off, thank you for considering contributing to **Sentinel V6 Desktop**! 🚀

Sentinel is an open-source, high-performance web application security assessment workbench engineered from the ground up in **Rust**, **Tokio**, and **Tauri (React/TypeScript)**. Whether you are reporting a bug, improving documentation, optimizing high-throughput proxy routines, or writing new AST fuzzing mutations, your contributions help make modern AppSec tooling faster, more accessible, and truly unthrottled.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture Overview](#architecture-overview)
- [Prerequisites & Development Environment](#prerequisites--development-environment)
- [Quick Start Guide](#quick-start-guide)
- [Development Workflows](#development-workflows)
  - [Frontend Development (Vite + React)](#frontend-development-vite--react)
  - [Full Desktop Development (Tauri v2)](#full-desktop-development-tauri-v2)
  - [Core Rust Engine (Cargo Workspace)](#core-rust-engine-cargo-workspace)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Coding Conventions & Style](#coding-conventions--style)
- [Git Commit Guidelines](#git-commit-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)

---

## Code of Conduct

We are committed to providing a welcoming, collaborative, and inclusive environment for all contributors. Respectful communication, constructive code reviews, and ethical security practices are required of all participants.

---

## Architecture Overview

Sentinel is split cleanly into high-performance systems-level components and a responsive desktop UI:

```
sentinel-v6-desktop/
├── sentinel_core/            # Systems Core: 30+ modular Rust crates
│   ├── crates/sentinel_proxy/   # Transparent HTTP/1.1 & HTTP/2 MITM proxy
│   ├── crates/sentinel_dispatch/# High-throughput async socket engine
│   ├── crates/sentinel_fuzzer/  # Grammar mutation & parameter fuzzing
│   ├── crates/sentinel_scope/   # Scope enforcement gate (SEC-01)
│   └── crates/sentinel_storage/ # SQLite WAL transaction & CAS storage
├── src-tauri/                # Tauri v2 Desktop bridge & OS integration
├── src/                      # Frontend UI: React 18, Zustand, Tailwind CSS
│   ├── components/           # Reusable widgets (Inspector, Repeater, Hex diff)
│   ├── services/             # Specialized engines (SQLi scanner, recon, crawlers)
│   ├── stores/               # Zero-lag Zustand state managers
│   └── workspaces/           # Main functional workspaces (Traffic, Intruder, etc.)
└── tests/                    # End-to-end integration & Vitest test suites
```

---

## Prerequisites & Development Environment

Ensure your development machine has the following tools installed:

### 1. Node.js & Package Manager
- **Node.js**: `v20.0.0` or higher (LTS recommended)
- **npm**: `v10.0.0` or higher

### 2. Rust Toolchain
- **Rust Stable**: `1.78.0` or higher
  ```bash
  rustup update stable
  rustup default stable
  ```
- **Cargo Nextest** (recommended for blazing-fast parallel test execution):
  ```bash
  cargo install cargo-nextest --locked
  ```

### 3. OS System Libraries (Linux Only)
On Ubuntu/Debian, install the required GTK and WebKit dependencies:
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

On Windows, ensure **Visual Studio C++ Build Tools** and **WebView2** (preinstalled on Windows 10/11) are available.

---

## Quick Start Guide

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/sentinel-v6-desktop.git
   cd sentinel-v6-desktop
   ```

2. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/pavan271006/sentinel-v6-desktop.git
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Verify your local build:**
   ```bash
   npm run build
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

---

## Development Workflows

### Frontend Development (Vite + React)
For fast iteration on UI components, styling, and inspector panels:
```bash
npm run dev
```
Navigate to `http://localhost:1420`. The Vite development server provides instant Hot Module Replacement (HMR).

### Full Desktop Development (Tauri v2)
To run the full native desktop shell with the live Rust backend:
```bash
npm run dev:desktop
```

### Core Rust Engine (Cargo Workspace)
When modifying proxy algorithms, fuzzing mutations, or SQLite WAL storage:
```bash
cd sentinel_core
cargo check --workspace
cargo test --workspace
```

---

## Testing & Quality Assurance

Sentinel maintains stringent quality benchmarks. All CI checks must pass before pull requests can be merged:

```bash
# 1. Run all frontend Vitest suites
npm test

# 2. Run TypeScript static type verification & Vite production build
npm run build

# 3. Run Rust core workspace tests with cargo-nextest
cargo nextest run --manifest-path sentinel_core/Cargo.toml

# 4. Verify Tauri IPC desktop bindings
cargo check --manifest-path src-tauri/Cargo.toml
```

---

## Coding Conventions & Style

### Rust Code
- Format all code with `cargo fmt`.
- Address all clippy warnings: `cargo clippy --workspace --all-targets -- -D warnings`.
- Prefer explicit error handling via `thiserror` and `anyhow` over `unwrap()` or `expect()`.
- Uphold `#![deny(unsafe_code)]` across all network-facing crates.

### TypeScript / React Code
- Use TypeScript strict mode—avoid `any` where explicit interfaces exist.
- Keep components modular and leverage Zustand stores for state that spans across panels.
- Optimize high-frequency UI updates: use micro-batched queues or virtualization for datasets exceeding 1,000 items.

---

## Git Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body describing technical rationale]
```

### Supported Types:
- `feat`: A new user-facing feature or capability.
- `fix`: A bug fix or patch.
- `perf`: A code change that improves CPU, memory, or network throughput.
- `docs`: Documentation updates, architecture guides, or API specs.
- `refactor`: Code reorganization that neither adds a feature nor fixes a bug.
- `test`: Adding new tests or fixing existing test suites.
- `ci`: Changes to CI/CD workflows, build scripts, or release automation.

*Example:* `feat(fuzzer): implement pitchfork payload mutation matrix with keep-alive pooling`

---

## Submitting a Pull Request

1. Create a descriptive feature branch from `master`:
   ```bash
   git checkout -b feat/graphql-query-miner
   ```
2. Commit your changes following Conventional Commit conventions.
3. Rebase onto latest upstream master before pushing:
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```
4. Push your branch to your fork:
   ```bash
   git push origin feat/graphql-query-miner
   ```
5. Open a Pull Request against `pavan271006/sentinel-v6-desktop` on GitHub.
6. Complete the PR template checklist to verify that all unit tests, typechecks, and security invariants pass.
