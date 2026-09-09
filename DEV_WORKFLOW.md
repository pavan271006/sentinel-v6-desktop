# Sentinel V6 — Fast Development & Launch Runbook

This runbook provides the 3 streamlined workflows to make changes and launch the app quickly with zero bugs or crashes.

---

## 1. Fast Development Workflows

### Mode A: Live Development with Hot Reload (Fastest for UI Changes)
> **Best for**: Editing React components, styles, views, tabs, or inspector panels.
> **Speed**: **Instant (< 100ms)** updates upon saving files without restarting the app or compiling Rust.

* Double-click **`Dev-Sentinel.bat`** in the project root, or run:
  ```bash
  npm run dev:desktop
  ```
* **What it does**:
  1. Starts Vite on `http://localhost:1420` with Hot Module Replacement (HMR).
  2. Runs Tauri in debug mode (10x faster compile time than release).
  3. Automatically updates the live window whenever you save `.tsx`, `.ts`, or `.css` files.

---

### Mode B: Instant Production Launch (Fastest for Testing)
> **Best for**: Opening the compiled production app immediately.
> **Speed**: **< 1 second** launch.

* Double-click **`Sentinel V6`** on your Desktop, or run:
  ```bat
  Launch-Sentinel.bat
  ```
* **What it does**:
  1. Purges any stale background instances.
  2. Spawns `src-tauri\target\release\sentinel-desktop.exe` centered on your primary monitor.

---

### Mode C: 1-Click Clean Rebuild & Launch
> **Best for**: After making backend Rust changes (`src-tauri`, `sentinel_core`, `ucma-x`) or producing a new release build.
> **Speed**: Fully automated, single command.

* Double-click **`Rebuild-Sentinel.bat`**, or run:
  ```bash
  npm run rebuild:launch
  ```
* **What it does**:
  1. Kills any running instances.
  2. Compiles the React frontend (`npm run build`).
  3. Compiles the Rust backend in release mode (`cargo build --release`).
  4. Launches the new binary automatically.

---

## 2. Crash-Proof Guarantees Built Into the Backend

1. **Self-Healing Process Cleanup**: `sentinel-desktop.exe` kills any previous instances at startup. Port `8085` and WebView2 profile folders are guaranteed free before launch.
2. **Clean Lifecycle Shutdown**: Closing the window with the **X** button calls `std::process::exit(0)`, terminating all Tokio worker threads immediately.
3. **Enforced Dimensions**: The window always opens unminimized, sized to `1400x900`, and centered on your screen.
