// Unconditionally suppress console / CMD window (Pure GUI mode like Burp Suite)
#![windows_subsystem = "windows"]

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

mod state;
mod commands;

use state::AppState;
use commands::*;
use tauri::{Emitter, Manager};
use sentinel_common::EventBus;
use std::fs::OpenOptions;
use std::io::Write;

fn log_debug(msg: &str) {
    let now = chrono::Local::now().to_rfc3339();
    let line = format!("[{}] {}\n", now, msg);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open("sentinel_desktop_debug.log") {
        let _ = f.write_all(line.as_bytes());
    }
    let temp_log = std::env::temp_dir().join("sentinel_desktop_debug.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(temp_log) {
        let _ = f.write_all(line.as_bytes());
    }
}

#[cfg(target_os = "windows")]
mod win_guard {
    use std::ffi::c_void;
    use crate::log_debug;

    type HANDLE = *mut c_void;
    type HWND = *mut c_void;
    type BOOL = i32;
    type DWORD = u32;
    type LPCWSTR = *const u16;

    const ERROR_ALREADY_EXISTS: DWORD = 183;
    const SW_RESTORE: i32 = 9;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateMutexW(lpMutexAttributes: *mut c_void, bInitialOwner: BOOL, lpName: LPCWSTR) -> HANDLE;
        fn GetLastError() -> DWORD;
    }

    #[link(name = "user32")]
    extern "system" {
        fn FindWindowW(lpClassName: LPCWSTR, lpWindowName: LPCWSTR) -> HWND;
        fn IsWindow(hWnd: HWND) -> BOOL;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
        fn SetForegroundWindow(hWnd: HWND) -> BOOL;
        fn BringWindowToTop(hWnd: HWND) -> BOOL;
    }

    static mut APP_MUTEX: HANDLE = std::ptr::null_mut();

    pub fn ensure_single_instance_or_heal() {
        unsafe {
            let my_pid = std::process::id();
            let mutex_name: Vec<u16> = "Local\\SentinelV6DesktopSingleInstanceMutex\0".encode_utf16().collect();
            let h_mutex = CreateMutexW(std::ptr::null_mut(), 1, mutex_name.as_ptr());
            let err = GetLastError();
            APP_MUTEX = h_mutex;

            log_debug(&format!("Single-instance guard: PID={}, MutexHandle={:?}, LastError={}", my_pid, h_mutex, err));

            if err == ERROR_ALREADY_EXISTS {
                log_debug("Another instance detected holding single-instance mutex. Checking for active window...");
                let titles = [
                    "Sentinel V6 — Pentester Desktop\0",
                    "Sentinel V6\0",
                    "NEXUS — Pentester Desktop\0",
                ];
                let mut found_active_window = false;
                for t in titles {
                    let w_title: Vec<u16> = t.encode_utf16().collect();
                    let hwnd = FindWindowW(std::ptr::null(), w_title.as_ptr());
                    if !hwnd.is_null() && IsWindow(hwnd) != 0 {
                        log_debug(&format!("Found active window ('{}'). Restoring and bringing to front.", t.trim_matches('\0')));
                        ShowWindow(hwnd, SW_RESTORE);
                        SetForegroundWindow(hwnd);
                        BringWindowToTop(hwnd);
                        found_active_window = true;
                        break;
                    }
                }

                if found_active_window {
                    log_debug("Existing window brought to focus. Exiting launcher process.");
                    std::process::exit(0);
                }

                log_debug("Mutex held but no active window found (stale lock). Proceeding with launch.");
            }
        }
    }
}

fn main() {
    log_debug("=== Sentinel Desktop Starting ===");

    #[cfg(target_os = "windows")]
    win_guard::ensure_single_instance_or_heal();

    std::panic::set_hook(Box::new(|info| {
        log_debug(&format!("FATAL PANIC: {:?}", info));
    }));

    log_debug("Step 1: Creating AppState...");
    let state = AppState::new();
    log_debug("Step 2: AppState created. Launching Tauri...");

    log_debug("Step 3: Configuring tauri::Builder...");
    let builder = tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            log_debug("setup() hook running");
            if let Some(window) = app.get_webview_window("main") {
                log_debug("Window 'main' found, applying unminimize(), set_size(), center(), show(), set_focus()...");
                let _ = window.unminimize();
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 1400, height: 900 }));
                let _ = window.center();
                let _ = window.show();
                let _ = window.set_focus();
                log_debug("Window 'main' show() executed");
            } else {
                log_debug("WARNING: Window 'main' NOT FOUND in setup");
            }

            // Spawn background event streamer task from SentinelEventBus
            let app_handle = app.handle().clone();
            let app_state = app.state::<AppState>();
            let mut telemetry_rx = app_state.event_bus.subscribe_telemetry();
            
            tauri::async_runtime::spawn(async move {
                while let Ok(event) = telemetry_rx.recv().await {
                    match event {
                        sentinel_common::events::SentinelEvent::Traffic(traffic) => {
                            let _ = app_handle.emit("ui_traffic_event", serde_json::json!({
                                "type": "traffic",
                                "id": traffic.id,
                                "method": traffic.method,
                                "url": traffic.url,
                                "status": traffic.status,
                                "duration_ms": traffic.duration_ms,
                                "in_scope": traffic.in_scope,
                                "req_headers": traffic.req_headers,
                                "req_body": traffic.req_body,
                                "res_headers": traffic.res_headers,
                                "res_body": traffic.res_body,
                                "timestamp": chrono::Utc::now().to_rfc3339(),
                            }));
                        }
                        other => {
                            let _ = app_handle.emit("sentinel://stream-event", serde_json::json!({
                                "type": "telemetry",
                                "event": format!("{:?}", other),
                                "timestamp": chrono::Utc::now().to_rfc3339(),
                            }));
                        }
                    }
                }
            });

            // Auto-initialize default workspace storage and proxy engine asynchronously without blocking setup hook
            let obs_store_arc = app_state.active_observation_store.clone();
            let proj_store_arc = app_state.active_project_storage.clone();
            let bus = app_state.event_bus.clone();
            let proxy_engine_arc = app_state.proxy_engine.clone();
            let status_arc = app_state.status.clone();

            tauri::async_runtime::spawn(async move {
                let default_dir = std::env::temp_dir().join("sentinel_workspace");
                let _ = std::fs::create_dir_all(&default_dir);

                let obs_store_opt = sentinel_storage::SqliteObservationStore::open(&default_dir).await.ok();
                if let Some(ref store) = obs_store_opt {
                    log_debug(&format!("Default observation store initialized at {:?}", default_dir));
                    let mut obs_lock = obs_store_arc.lock().await;
                    *obs_lock = Some(store.clone());
                }

                let proj_store_opt = sentinel_storage::ProjectStorage::open(&default_dir).await.ok();
                if let Some(store) = proj_store_opt {
                    let mut proj_lock = proj_store_arc.lock().await;
                    *proj_lock = Some(store);
                }

                // Start native ProxyEngine listener on port 8085 with storage and scope engine
                let default_scope = sentinel_common::Scope {
                    id: uuid::Uuid::new_v4(),
                    version: 1,
                    timestamp: chrono::Utc::now(),
                    includes: vec!["*".to_string()],
                    excludes: vec!["127.0.0.1/32".to_string()],
                };
                let scope_engine: std::sync::Arc<parking_lot::RwLock<dyn sentinel_common::ScopeEngine>> =
                    std::sync::Arc::new(parking_lot::RwLock::new(sentinel_scope::DefaultScopeEngine::new(default_scope)));
                let mut engine = sentinel_proxy::SentinelProxyEngine::new()
                    .with_event_bus(bus)
                    .with_scope_engine(scope_engine);

                if let Some(store) = obs_store_opt {
                    engine = engine.with_storage(store);
                }

                let proxy_engine = std::sync::Arc::new(engine);
                {
                    let mut p_lock = proxy_engine_arc.lock().await;
                    *p_lock = Some(proxy_engine.clone());
                }

                let cert_temp = std::env::temp_dir().join("sentinel_ca.crt").to_string_lossy().to_string();
                let proxy_cfg = sentinel_common::config::ProxyConfig {
                    bind_address: "127.0.0.1".to_string(),
                    port: 8085,
                    upstream_proxy: None,
                    tls_cert_path: cert_temp,
                };

                use sentinel_common::traits::ProxyEngine;
                let mut attempts = 0;
                while attempts < 3 {
                    attempts += 1;
                    log_debug(&format!("Starting native SentinelProxyEngine on 127.0.0.1:8085 (attempt {}/3)...", attempts));
                    match proxy_engine.start(proxy_cfg.clone()).await {
                        Ok(_) => {
                            log_debug("SentinelProxyEngine started successfully on 127.0.0.1:8085");
                            let mut st = status_arc.lock().await;
                            st.proxy_running = true;
                            st.proxy_port = 8085;
                            break;
                        }
                        Err(e) => {
                            log_debug(&format!("SentinelProxyEngine error on attempt {}: {:?}", attempts, e));
                            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            log_debug(&format!("Window event on '{}': {:?}", window.label(), event));
            match event {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    log_debug("Window close/destroy detected. Cleanly terminating process immediately.");
                    std::process::exit(0);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            cmd_get_platform_info,
            cmd_get_status,
            cmd_toggle_proxy,
            cmd_project_new,
            cmd_project_open,
            cmd_project_close,
            cmd_project_get_current,
            cmd_project_list_recent,
            cmd_project_export,
            cmd_project_import,
            cmd_project_wal_checkpoint,
            cmd_scope_get,
            cmd_scope_update,
            cmd_test_scope_uri,
            cmd_productivity_search,
            cmd_traffic_get_page,
            cmd_traffic_get_details,
            cmd_traffic_get_raw_blob,
            cmd_traffic_clear,
            cmd_httpql_validate,
            cmd_traffic_diff,
            cmd_repeater_create_tab,
            cmd_repeater_send_request,
            cmd_repeater_diff,
            cmd_repeater_export_curl,
            cmd_repeater_extract_variable,
            cmd_launch_system_browser,
            cmd_open_html_in_browser,
            cmd_ucmax_analyze_boolean,
            cmd_ucmax_plan_next_step,
            cmd_launch_wireshark,
            cmd_check_packet_capture_status,
            cmd_rotate_system_vpn,
            cmd_toggle_system_vpn,
        ]);

    log_debug("Step 3.1: Calling builder.build()...");
    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => {
            log_debug("Step 3.2: builder.build() SUCCEEDED");
            app
        }
        Err(e) => {
            log_debug(&format!("FATAL TAURI BUILD ERROR: {:?}", e));
            std::process::exit(1);
        }
    };

    log_debug("Step 3.3: Calling app.run()...");
    app.run(|_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { code, .. } => {
                log_debug(&format!("Tauri RunEvent::ExitRequested with code: {:?}", code));
            }
            tauri::RunEvent::WindowEvent { label, event, .. } => {
                log_debug(&format!("RunEvent::WindowEvent '{}': {:?}", label, event));
            }
            _ => {}
        }
    });

    log_debug("Tauri run() loop terminated");
}
