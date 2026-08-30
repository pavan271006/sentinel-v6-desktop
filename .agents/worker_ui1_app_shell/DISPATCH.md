## 2026-08-17T13:46:30Z
You are the UI-1 App Shell & Design System Lead for the Sentinel V6 Desktop Application build.

Working Directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui1_app_shell\
Project Root: c:\Users\Legion 5 pro\Desktop\cyber sec
Authoritative Request: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md
Architecture & Spec: c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6
Core Codebase: c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core
Capability Matrix: c:\Users\Legion 5 pro\Desktop\cyber sec\UI_BACKEND_CAPABILITY_MATRIX.md
Feature Manifest: c:\Users\Legion 5 pro\Desktop\cyber sec\SENTINEL_V6_UI_FEATURE_MANIFEST.md
Project Plan: c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

BACKEND TRUTH RULE:
Every UI control must map to backend implementation state. If a backend capability is BACKEND_DEFERRED or BACKEND_UNAVAILABLE, render it as disabled with explicit tooltip explanation.

TASKS FOR PHASE UI-1:
1. Initialize the complete Tauri + React + TypeScript + Tailwind CSS desktop frontend structure:
   - Create root/frontend `package.json` with all necessary dependencies: React 18, Lucide React, Tailwind CSS, @tanstack/react-virtual, Monaco/Prism, Zustand, clsx, tailwind-merge, etc.
   - Setup `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`.
   - Setup Tauri configuration (`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, IPC command registration) linking to `sentinel_core` crates.
2. Implement the Unified Design System (`src/design-system/` or `src/styles/`):
   - Design tokens: Colors (Pentester Dark high-contrast #0a0e14, #121820, #00f0ff accent cyan, #00ff88 success green, #ff0055 critical pink, #ffaa00 warning orange; Light theme variables), Spacing (dense 4px/8px rhythm), Typography (JetBrains Mono / Inter / Fira Code monospace), Borders, Shadows.
   - Core reusable components: Button, Input, Select, Badge, Tooltip, Modal, Tabs, Dropdown, Kbd, Toast notification provider, SplitPane (resizable panels with memory).
   - High-performance Virtualized Table base component (`VirtualizedTable.tsx`) capable of handling 100K+ rows with sorting, column resizing, and row selection.
   - Diff Viewer component (`DiffViewer.tsx`) supporting side-by-side and unified inline diff modes with line numbers and syntax highlighting.
   - Byte/Structured Inspector base (`RawByteInspector.tsx`, `StructuredInspector.tsx`) with Hex view, raw text, and formatted JSON/Header trees.
3. Implement the Complete Pentester App Shell (`src/components/shell/`):
   - Header bar: Project title, active target scope indicator, quick search input, backend health / proxy status badge, theme toggle, settings icon.
   - Activity Bar: Vertical navigation icons for all workspaces (Traffic, Repeater, Scanner, Fuzzer, Identity, API Security, Browser, OAST, Findings, Notebook, Graph, Reports, Settings).
   - Workspace Sidebar: Sub-navigation / filters / trees for active workspace.
   - Main Content Canvas: Active workspace view renderer.
   - Bottom Drawer / Timeline: Collapsible log / event stream drawer (`SentinelUiStream` listener), IPC queue monitor.
   - Status Bar: SQLite DB size, IPC latency, active proxy port, scope status (FAIL-CLOSED indicator), memory usage.
4. Implement Command Palette (Ctrl+K / Cmd+K):
   - Global hotkey listener, fuzzy search for all actions, views, settings, and commands.
   - Quick workspace jumping, proxy toggle, scope editor shortcut, export report shortcut.
5. Implement IPC Transport Bridge (`src/ipc/`):
   - Tauri IPC invoke wrappers for all commands matching `V6_IPC_CONTRACTS.proto`.
   - Streaming event dispatcher for Protobuf / Tauri events with typed listeners.
6. Verification:
   - Install dependencies (or create mock/stub-free tests for components and IPC).
   - Run tests (`npm test` / `vitest` / `cargo check` for src-tauri) to verify clean compilation, 0 syntax/type errors, and passing unit tests.
7. Write detailed handoff report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui1_app_shell\handoff.md` and message the parent orchestrator when complete.
