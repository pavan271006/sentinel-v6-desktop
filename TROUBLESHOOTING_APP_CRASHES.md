# Sentinel V6 — Desktop Application Lifecycle & Crash Troubleshooting Guide

This document records the exact causes and permanent fixes for startup crashes, instant closures, and lifecycle issues in the Sentinel V6 Desktop Application.

---

## 1. Issue: Application Closes or Crashes Immediately on Startup

### Symptoms:
- Clicking the Desktop Shortcut or running `sentinel-desktop.exe` opens a window for a fraction of a second, then immediately disappears.
- No window appears at all, or the process terminates with exit code `1` or `0`.

### Root Causes & Diagnostic Tree:

#### Root Cause A: Zombie Background Processes & Port 8085 Lock
- **Mechanism**: A previous instance of `sentinel-desktop.exe` was left running in the background (or spawned by an automated tool/agent), holding a lock on the MITM proxy listener port `127.0.0.1:8085`.
- **Behavior**: When a new instance launches, `SentinelProxyEngine` attempts to bind to `127.0.0.1:8085` via `tokio::net::TcpListener`. When the bind fails due to address already in use, or single-instance conflict occurs, the second process exits.
- **Verification**:
  ```powershell
  netstat -ano | findstr 8085
  tasklist /FI "IMAGENAME eq sentinel-desktop.exe"
  ```
- **Permanent Fix**:
  - Cleanly terminate all existing background processes before launching:
    ```powershell
    taskkill /IM sentinel-desktop.exe /F
    ```
  - The launcher `Launch-Sentinel.bat` now automatically performs this cleanup prior to spawning the new UI process.

---

#### Root Cause B: Headless Subprocess vs Interactive Session Collision
- **Mechanism**: When background processes are spawned from a non-interactive shell (such as an automated agent runner), Windows places them in a non-interactive session without desktop window station permissions.
- **Behavior**: Attempting to launch a GUI window from a headless tool causes the window to have `MainWindowHandle: 0` and collide with the user's interactive desktop (`Session 1`).
- **Permanent Fix**:
  - The desktop application must be launched within the user's interactive desktop session using `Launch-Sentinel.bat` or the Desktop Shortcut (`Sentinel V6.lnk`).

---

#### Root Cause C: Windows Batch Redirect Failure (`timeout` command)
- **Mechanism**: Standard Windows batch files that execute `timeout /t 1 /nobreak >nul` fail abruptly with:
  `ERROR: Input redirection is not supported, exiting the process immediately.`
- **Behavior**: The script crashes before reaching the `start` command that launches `sentinel-desktop.exe`.
- **Permanent Fix**:
  - Replace `timeout` with the redirection-safe Windows delay:
    ```bat
    ping 127.0.0.1 -n 2 >nul
    ```

---

#### Root Cause D: Unhandled React Render Error / Missing Error Boundary
- **Mechanism**: If any frontend React component threw an uncaught exception during mount (such as corrupt `localStorage` state or undefined symbol), React unmounted the entire component tree, resulting in an instant blank screen.
- **Permanent Fix**:
  - Wrapped `<AppShell />` inside `<ErrorBoundary>` in `src/App.tsx`.
  - The Error Boundary captures any render exception, prevents the app from crashing, logs the error details, and presents an interactive "Reload Interface" button.

---

## 2. Issue: Raw Garbled Compressed Bytes in Response Viewer (`Wmo6_q5...`)

### Symptoms:
- When testing targets (such as PortSwigger Web Security Academy) that return `Content-Encoding: gzip`, Sentinel displayed raw compressed binary characters rather than decoded HTML/JSON.

### Root Cause:
- The HTTP proxy stream was reading raw wire bytes directly into lossy strings without running gzip decompression.

### Permanent Fix:
- Added automatic `gzip`, `deflate`, and magic-byte (`0x1f 0x8b`) decompression:
  1. `sentinel_proxy/src/handler.rs`: `decode_and_decompress_proxy_body`
  2. `sentinel_repeater/src/executor.rs`: `read_http_response` with chunked transfer and stream termination
  3. `src-tauri/src/commands.rs`: `decompress_http_body` and Burp-style header normalization (updating `Content-Length` and removing `Content-Encoding: gzip` for UI presentation).

---

## 3. Clean Launch Runbook

If any startup issue ever occurs:

```powershell
# 1. Kill any existing instances
taskkill /IM sentinel-desktop.exe /F

# 2. Launch cleanly via src-tauri
cd "C:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri"
cargo run --release
```

Or double-click **`Launch-Sentinel.bat`** in the project root.
