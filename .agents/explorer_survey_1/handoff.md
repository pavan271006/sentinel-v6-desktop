# Handoff Report: Survey R1 — Wire Forensics & Network Throughput Hardening

**Investigator**: Explorer Subagent (`teamwork_preview_explorer`)  
**Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_1`  
**Parent Conversation ID**: `94d601fe-cc12-4b39-babd-492e9642f362`  
**Date**: 2026-09-11  

---

## 1. Observation

1. **Keep-Alive Stripping & Connection Pool Absence**:
   - `src-tauri/src/commands.rs:1665–1671`:
     ```rust
     let normalized_req = if crlf_normalized.contains("Connection: keep-alive") {
         crlf_normalized.replace("Connection: keep-alive", "Connection: close")
     } else if crlf_normalized.contains("connection: keep-alive") {
         crlf_normalized.replace("connection: keep-alive", "connection: close")
     } else {
         crlf_normalized
     };
     ```
     Observed that all frontend requests passing through `cmd_repeater_send_request` have `Connection: keep-alive` stripped and replaced with `Connection: close`.
   - `sentinel_core/crates/sentinel_repeater/src/executor.rs:265, 285`:
     Calls `TcpStream::connect(addr).await` on every request. Sockets are read until EOF and dropped. Zero connection pooling exists.
   - `sentinel_core/crates/sentinel_dispatch/src/client.rs:301, 350`:
     Calls `TcpStream::connect(addr)` on every request. Sockets are read and dropped. Zero connection pooling exists.

2. **`TCP_NODELAY` Omissions**:
   - `sentinel_core/crates/sentinel_repeater/src/executor.rs:563, 638`:
     In `send_plain_primed_race` and `send_tls_primed_race`, `TcpStream::connect` connects to the target, writes the `head`, waits on `barrier.wait().await`, and then writes `last` (1 byte). Neither function invokes `stream.set_nodelay(true)`.
   - `sentinel_core/crates/sentinel_dispatch/src/client.rs:301–396`:
     Neither `send_plain` nor `send_tls` invokes `stream.set_nodelay(true)`.

3. **Wireshark and Npcap Forensics Commands**:
   - `src-tauri/src/commands.rs:2084–2098` (`cmd_check_packet_capture_status`):
     ```rust
     let wireshark_installed = std::path::Path::new(r"C:\Program Files\Wireshark\Wireshark.exe").exists();
     let tshark_installed = std::path::Path::new(r"C:\Program Files\Wireshark\tshark.exe").exists();
     let npcap_driver = std::path::Path::new(r"C:\Program Files\Npcap\npcap.sys").exists()
         || std::path::Path::new(r"C:\Windows\System32\Npcap\wpcap.dll").exists();

     Ok(serde_json::json!({
         "wireshark": wireshark_installed,
         "tshark": tshark_installed,
         "npcap": npcap_driver,
         "wireshark_version": "4.6.8",
         "npcap_version": "1.88",
         "default_filter": "tcp.port == 8085 or tcp.port == 8080",
     }))
     ```
     Observed that `"4.6.8"` and `"1.88"` are static hardcoded strings. Observed driver check queries `C:\Program Files\Npcap\npcap.sys`, whereas on Windows the kernel driver installs into `C:\Windows\System32\drivers\npcap.sys`.
   - `src-tauri/src/commands.rs:2062–2081` (`cmd_launch_wireshark`):
     Candidate search uses `Path::new("wireshark.exe").exists()` which fails to check `%PATH%`. Command is executed with `-Y <filter>` (display filter only) without live capture `-k` or interface selection `-i`.
   - Verified host environment: Wireshark 4.6.8 and Npcap 1.88 are installed and active:
     - `tshark.exe -v`: `TShark (Wireshark) 4.6.8 (v4.6.8-0-ge677bf052328)`
     - `C:\Windows\System32\drivers\npcap.sys`: FileVersion 1.88, service `npcap` is running.
     - `C:\Windows\System32\Npcap\wpcap.dll`: FileVersion 1.10.6.

4. **100-Worker Concurrency & Memory Accumulation**:
   - `src/workspaces/FuzzerWorkspaceView.tsx:937–1020`:
     `resultsBuffer: AttackResultItem[] = new Array(totalPermutations);` retains full `rawRequest` and `rawResponse` strings in memory across all attack permutations, causing unbounded heap growth (hundreds of MBs) in the webview process for large permutation sets.
   - `src-tauri/src/commands.rs:1657–1661`:
     `let obs_guard = state.active_observation_store.lock().await;` is locked exclusively on every single request across all 100 concurrent workers.

5. **Toolchain Compilation Baselines**:
   - `cargo check --manifest-path sentinel_core/Cargo.toml` passed with exit code 0.
   - `cargo check --manifest-path src-tauri/Cargo.toml` passed with exit code 0.
   - `npm run build` (`tsc && vite build`) passed with exit code 0 in 12.19s.

---

## 2. Logic Chain

1. **From Observation 1**: Because `cmd_repeater_send_request` mutates `Connection: keep-alive` to `Connection: close`, the remote target closes the TCP stream after every request, and the client tears down the local socket.
2. **From Observation 1 & Windows TCP Architecture**: Sockets closed by the client remain in `TIME_WAIT` for 2MSL (120 seconds). With 16,384 ephemeral ports available (49152–65535), 100 concurrent workers operating at 1,000 requests/sec exhaust the port range in ~16.4 seconds. Once exhausted, `TcpStream::connect` fails with `WSAEADDRINUSE (10048)` or `WSAENOBUFS (10055)`. Therefore, connection pooling and persistent connections are strictly required to sustain 100-worker concurrency.
3. **From Observation 2**: In `send_plain_primed_race` and `send_tls_primed_race`, all connection priming occurs before the barrier. When the barrier trips, each worker sends a single byte (`last`). Without `TCP_NODELAY`, Nagle's algorithm halts the transmission of this 1-byte segment until ACK of the prior segment or delayed-ACK timer expiration (40–200ms). This destroys synchronization across the race workers, causing true TOCTOU / race condition vulnerabilities to be missed.
4. **From Observation 3**: `cmd_check_packet_capture_status` returns hardcoded version strings regardless of reality, and checks an invalid driver path (`C:\Program Files\Npcap\npcap.sys`). If an analyst is on a system without Wireshark, the UI still claims version 4.6.8 is active. `cmd_launch_wireshark` only sets a display filter `-Y`, failing to start live capturing immediately (`-k`), which degrades pentester workflow ergonomics.
5. **From Observation 4**: In the frontend Intruder, retaining full raw request/response text for 50,000–100,000 requests in `resultsBuffer` results in $>500\text{MB}$ JavaScript heap consumption and repeated 30 FPS state cloning, causing main-thread stutter and potential V8 out-of-memory crashes.

---

## 3. Caveats

1. **Live Network Saturation Testing**: As an Explorer subagent operating in read-only survey mode, live 10,000-request floods were not blasted against production targets during this turn. Conclusions regarding port exhaustion are derived directly from code analysis and Windows Winsock TCP/IP stack specifications.
2. **Platform Specifics**: Ephemeral port exhaustion behavior is specific to the Windows `TIME_WAIT` TCP lifecycle; on Linux with `tcp_tw_reuse`, port recycling is faster, but Sentinel Desktop's target environment is Windows 11.
3. **Packet Capture Kernel Rights**: Npcap live capture requires administrator or `Npcap` driver access rights on Windows.

---

## 4. Conclusion

1. The Sentinel platform currently lacks TCP connection pooling in both `sentinel_repeater` and `sentinel_dispatch`. Furthermore, `cmd_repeater_send_request` actively sabotages connection reuse by stripping `Connection: keep-alive`.
2. `TCP_NODELAY` is dangerously omitted from the race synchronization methods (`send_plain_primed_race` and `send_tls_primed_race`), undermining the sub-millisecond race condition prober.
3. Wireshark and Npcap are present and active on the host machine (4.6.8 and 1.88), but the detection IPC command relies on hardcoded strings and incorrect driver paths, and the launch command does not initiate immediate capture (`-k`).
4. Sustaining 100-worker concurrency reliably requires:
   - Preserving `Connection: keep-alive` and implementing an async TCP connection pool.
   - Setting `TCP_NODELAY` on primed race sockets and dispatcher sockets.
   - Replacing the exclusive observation store mutex with read-optimized locking.
   - Truncating or paging `rawResponse` strings in the frontend `resultsBuffer`.

---

## 5. Verification Method

1. **Verify Code Locations**:
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\commands.rs:1665` (`Connection: close` replacement)
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_repeater\src\executor.rs:563, 638` (omitted `set_nodelay`)
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\commands.rs:2084` (hardcoded versions & driver path)
2. **Verify Host Tools**:
   ```powershell
   & "C:\Program Files\Wireshark\tshark.exe" -v
   (Get-Item "C:\Windows\System32\drivers\npcap.sys").VersionInfo.FileVersion
   Get-Service npcap
   ```
3. **Verify Build Integrity**:
   ```bash
   cargo check --manifest-path sentinel_core/Cargo.toml
   cargo check --manifest-path src-tauri/Cargo.toml
   npm run build
   ```
