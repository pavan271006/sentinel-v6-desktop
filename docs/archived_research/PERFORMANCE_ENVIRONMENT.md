# SENTINEL V6 — PERFORMANCE & EXECUTION ENVIRONMENT SPECIFICATION

> **Document Authority**: Milestone 1 Deliverable (`PERFORMANCE_ENVIRONMENT.md`)  
> **Classification**: Frozen Baseline Hardware & Runtime Specification (38D)  
> **Generation Date**: 2026-08-18  
> **Compliance Reference**: Sentinel V6 Canonical Specification (§38A–§38M)

---

## 1. Host Hardware Specifications

All benchmark and empirical profiling measurements recorded in `PERFORMANCE_BASELINE_REPORT.md` were executed directly on the following verified physical hardware host:

| Hardware Component | Specification | Details & Verification Source |
|:---|:---|:---|
| **System Model** | Lenovo Legion 5 Pro (16ARX8) | Windows CIM / SMBIOS System Information |
| **CPU Architecture** | AMD Zen 4 (Dragon Range / Raphael Mobile) | `x86_64` architecture, TSMC 5nm FinFET |
| **Processor (CPU)** | **AMD Ryzen 7 7745HX with Radeon Graphics** | 8 Physical Cores, 16 Logical Threads |
| **CPU Clock Frequencies** | Base: **3.60 GHz**, Max Boost: **5.10 GHz** | MaxClockSpeed: 3601 MHz, L3 Cache: 32 MB |
| **Physical Memory (RAM)** | **16.0 GB DDR5 (2 x 8GB SODIMM)** | Micron Technology `MTC4C10163S1SC56BG1`, Speed: **5600 MT/s** |
| **Primary Storage (SSD)** | **1.0 TB NVMe PCIe Gen 4.0 x4 SSD** | Samsung `MZVL21T0HCLR-00BL2` (PM9A1 OEM), SCSI/NVMe interface |
| **Discrete GPU (dGPU)** | **NVIDIA GeForce RTX 4060 Laptop GPU** | 8 GB GDDR6 VRAM, Driver: `31.0.15.5186` |
| **Integrated GPU (iGPU)** | **AMD Radeon 610M Graphics** | 2 CUs RDNA2, Driver: `31.0.24033.1003` |
| **Virtual Displays** | Parsec Virtual Display Adapter | Secondary virtual capture interface |

---

## 2. Operating System & Kernel Environment

| Parameter | Configuration |
|:---|:---|
| **Operating System** | Microsoft Windows 11 Home Single Language (64-bit) |
| **OS Version / Build** | Version `10.0.26200`, Build `26200` |
| **Kernel Type** | Windows NT 10.0 (x86_64) |
| **Pagefile / Virtual Memory** | Dynamically managed by Windows NT kernel on high-speed NVMe PCIe 4.0 |
| **Filesystem** | NTFS with Windows Defender scan exclusions on project repository |
| **Power Plan / Thermal Profile** | Performance Mode (AC Mains Connected, Maximum Processor State 100%) |

---

## 3. Toolchains, Compilers & Runtime Versions

| Toolchain / Runtime | Version String | Target / Host Platform |
|:---|:---|:---|
| **Rust Compiler (`rustc`)** | `1.97.1 (8bab26f4f 2026-07-14)` | `x86_64-pc-windows-msvc` (LLVM 22.1.6) |
| **Rust Cargo (`cargo`)** | `1.97.1 (c980f4866 2026-06-30)` | `x86_64-pc-windows-msvc` |
| **Node.js Runtime** | `v22.14.0` | `x64-win32` |
| **Node Package Manager (`npm`)** | `10.9.2` | Hermetic local node_modules |
| **Frontend Test Engine (`vitest`)** | `v3.2.7` / `v3.0.5` | Multi-threaded jsdom environment |
| **Python Specification Validator** | `Python 3.11.9` | CPython 64-bit |
| **Tauri Framework** | Tauri Core `v2.0.0`, `@tauri-apps/api: ^2.0.0` | Desktop Webview2 Shell |
| **Native Embedded Webview** | Microsoft Edge WebView2 (Chromium Evergreen) | Hardware accelerated DirectComposition |

---

## 4. Build Configuration & Compiler Flags

### 4.1 Rust Release Profile Configuration (`sentinel_core` & `src-tauri`)
```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
overflow-checks = false
```

### 4.2 SQLite Transactional Engine Configuration
- **Journal Mode**: `WAL` (Write-Ahead Logging via `PRAGMA journal_mode = WAL;`)
- **Synchronous**: `NORMAL` (Zero fsync stall on write paths via `PRAGMA synchronous = NORMAL;`)
- **Foreign Keys**: `ON` (`PRAGMA foreign_keys = ON;`)
- **Cache Size**: `-64000` (64 MB in-memory page cache via `PRAGMA cache_size = -64000;`)
- **Memory Temp Store**: `MEMORY` (`PRAGMA temp_store = MEMORY;`)
- **WAL Auto-Checkpoint**: `1000` frames (`PRAGMA wal_autocheckpoint = 1000;`)

### 4.3 Frontend Bundle & Optimization Configuration (Vite & React 18)
- **Bundler**: Vite 5 with Rollup code-splitting
- **React Mode**: React 18 Concurrent Rendering with `useMemo`, `useCallback`, and Zustand selector subscription isolation
- **Diff Engine**: Web Worker chunked line diff calculation with cooperative cancellation
- **Table Virtualization**: Bounded viewport rendering (`VirtualizedTable`) maintaining strictly $O(1)$ active DOM nodes (<500 elements) regardless of row count (100K, 500K, 1M).

---

## 5. Environmental Baseline Attestation

This specification file documents the authoritative host environment on which all performance baselines, memory leak regression tests, and IPC throughput measurements were empirically captured.
Zero metrics were simulated, estimated, or fabricated.
