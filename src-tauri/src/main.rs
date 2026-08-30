// Unconditionally suppress console / CMD window (Pure GUI mode like Burp Suite)
#![windows_subsystem = "windows"]

mod state;
mod commands;

use state::AppState;
use commands::*;
use tauri::{Emitter, Manager};
use sentinel_common::EventBus;
use std::fs::OpenOptions;
use std::io::Write;

fn log_debug(msg: &str) {
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open("sentinel_desktop_debug.log") {
        let _ = writeln!(f, "[{}] {}", chrono::Local::now().to_rfc3339(), msg);
    }
}

fn main() {
    log_debug("=== Sentinel Desktop Starting ===");
    std::panic::set_hook(Box::new(|info| {
        log_debug(&format!("FATAL PANIC: {:?}", info));
    }));

    log_debug("Step 1: Creating AppState...");
    let state = AppState::new();
    log_debug("Step 2: AppState created. Launching Tauri...");

    log_debug("Step 3: Calling tauri::Builder::default().run()...");
        let res = tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            log_debug("setup() hook running");
            if let Some(window) = app.get_webview_window("main") {
                log_debug("Window 'main' found, calling show(), set_focus()...");
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
                let cert_temp = std::env::temp_dir().join("sentinel_ca.crt").to_string_lossy().to_string();
                let proxy_cfg = sentinel_common::config::ProxyConfig {
                    bind_address: "127.0.0.1".to_string(),
                    port: 8085,
                    upstream_proxy: None,
                    tls_cert_path: cert_temp,
                };

                use sentinel_common::traits::ProxyEngine;
                log_debug("Starting native SentinelProxyEngine on 127.0.0.1:8085 with storage & CAS...");
                if let Err(e) = proxy_engine.start(proxy_cfg).await {
                    log_debug(&format!("SentinelProxyEngine error: {:?}", e));
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            log_debug(&format!("Window event on '{}': {:?}", window.label(), event));
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
        ])
        .run(tauri::generate_context!());

    match res {
        Ok(_) => log_debug("Tauri run() completed normally"),
        Err(e) => log_debug(&format!("FATAL TAURI RUN ERROR: {:?}", e)),
    }
}
