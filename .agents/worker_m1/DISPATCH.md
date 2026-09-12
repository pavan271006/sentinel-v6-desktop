## 2026-09-11T08:04:07Z
You are a Worker subagent for Milestone 1 (M1: Wire Forensics & Network Throughput Hardening) in the Sentinel Desktop Hardening and Architecture Audit project.

Your Identity & Working Directory:
- Working Directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m1
- Workspace Root: c:\Users\Legion 5 pro\Desktop\cyber sec
- Parent Conversation ID: 94d601fe-cc12-4b39-babd-492e9642f362
- Archetype: teamwork_preview_worker

MANDATORY INPUT:
You MUST read the authoritative user request at:
c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md
Specifically read the section under ## 2026-09-11T07:48:59Z.

You MUST also read:
- Project Plan & Contracts: c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md
- Survey Explorer 1 Report: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_1\report.md
- Survey Explorer 1 Handoff: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_1\handoff.md

WRITE OWNERSHIP:
You have exclusive write ownership of the following files:
1. `src-tauri/src/commands.rs` (lines around 1665, 2062-2098)
2. `sentinel_core/crates/sentinel_repeater/src/executor.rs`
3. `sentinel_core/crates/sentinel_dispatch/src/client.rs`
4. `src/workspaces/FuzzerWorkspaceView.tsx`

DO NOT modify files outside your assigned ownership scope without permission.

YOUR ASSIGNED TASKS (Milestone M1):
1. Keep-Alive Stripping Removal:
   In `src-tauri/src/commands.rs:1665-1671`, stop replacing `Connection: keep-alive` with `Connection: close`. Preserve keep-alive so TCP connections can be reused without socket churn.
2. `TCP_NODELAY` Synchronization:
   In `sentinel_core/crates/sentinel_repeater/src/executor.rs`:
   Add `stream.set_nodelay(true)` on connected `TcpStream` in `send_plain_primed_race` (line 563) and `send_tls_primed_race` (line 638) to eliminate Nagle's algorithm delay on 1-byte barrier release.
   In `sentinel_core/crates/sentinel_dispatch/src/client.rs`:
   Add `stream.set_nodelay(true)` in `send_plain` (line 301) and `send_tls` (line 350).
3. Wireshark (4.6.8) & Npcap (1.88) Dynamic Telemetry & Launch Commands:
   In `src-tauri/src/commands.rs:2084-2098` (`cmd_check_packet_capture_status`):
   - Replace hardcoded version strings with dynamic detection.
   - For Wireshark, check `C:\Program Files\Wireshark\Wireshark.exe`, `tshark.exe`, and check `%PATH%`. Query `tshark -v` to get real version dynamically (e.g. 4.6.8).
   - For Npcap, check `C:\Windows\System32\drivers\npcap.sys` and `C:\Windows\System32\Npcap\wpcap.dll`. Dynamically query or inspect file version (1.88).
   - Return valid telemetry with camelCase keys matching UI contracts (`wireshark`, `tshark`, `npcap`, `wiresharkVersion`, `npcapVersion`, `defaultFilter`).
   In `src-tauri/src/commands.rs:2062-2081` (`cmd_launch_wireshark`):
   - Find Wireshark binary by checking `C:\Program Files\Wireshark\Wireshark.exe` AND searching `%PATH%`.
   - Support live capture flags (`-k`, and interface `-i` if specified) in addition to display filter (`-Y`).
4. Intruder Heap Virtualization:
   In `src/workspaces/FuzzerWorkspaceView.tsx:937`:
   - Avoid keeping full `rawRequest` and `rawResponse` strings in memory for 100k attack results in `resultsBuffer`. Store metadata/status/length and truncate or page heavy response bodies.
5. Verification (MANDATORY):
   You MUST execute the build and test verification commands:
   - `cargo check --manifest-path src-tauri/Cargo.toml`
   - `cargo nextest run --manifest-path sentinel_core/Cargo.toml`
   - `npm run build`
   Ensure all pass with zero errors.

## 2026-09-11T08:11:03Z
**Context**: Milestone M1 (Wire Forensics & Network Throughput Hardening)
**Content**: Heartbeat check. Please report your current execution status on Tasks 1-5 (Keep-alive in commands.rs, TCP_NODELAY in repeater/dispatch, Wireshark/Npcap telemetry, Intruder heap virtualization, and cargo/npm build verification).
**Action**: Provide current progress and status.
