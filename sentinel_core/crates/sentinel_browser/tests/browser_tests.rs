//! Test Suite for Browser Automation & DOM Subsystem

use std::sync::Arc;
use tempfile::tempdir;

use sentinel_browser::{DefaultBrowserService, DomExtractor};
use sentinel_common::traits::BrowserService;
use sentinel_storage::SqliteObservationStore;

#[test]
fn test_dom_extractor_elements() {
    let html = r#"
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Dashboard</title>
            <script src="/static/app.js"></script>
        </head>
        <body>
            <a href="/profile">Profile</a>
            <a href="https://external.com">External</a>
            <form action="/login" method="POST">
                <input type="text" name="username" />
                <input type="password" name="password" />
            </form>
        </body>
        </html>
    "#;

    let snapshot = DomExtractor::extract(html);
    assert_eq!(snapshot.title, "Admin Dashboard");
    assert_eq!(snapshot.links.len(), 2);
    assert!(snapshot.links.contains(&"/profile".to_string()));
    assert_eq!(snapshot.scripts.len(), 1);
    assert_eq!(snapshot.forms.len(), 1);
}

#[tokio::test]
async fn test_browser_service_lifecycle_and_cas_screenshot() {
    let temp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());

    let browser = DefaultBrowserService::new().with_storage(store.clone());

    // 1. Navigate
    let nav = browser.navigate("https://example.com").await.unwrap();
    assert!(nav.success);

    // 2. DOM & Script
    let dom = browser.capture_dom().await.unwrap();
    assert!(dom.contains("Loaded https://example.com"));

    let script_res = browser.execute_script("1+1").await.unwrap();
    assert_eq!(script_res, "2");

    // 3. Screenshot CAS storage
    let screenshot = browser.take_screenshot(false).await.unwrap();
    assert_eq!(&screenshot[0..4], &[0x89, 0x50, 0x4E, 0x47]);

    // 4. Close
    browser.close().await.unwrap();
    assert!(browser.navigate("https://example.com").await.is_err());
}

#[test]
fn test_autonomous_crawler_engine() {
    use sentinel_browser::{AutonomousCrawlerEngine, CrawlerConfig};

    let seed = "https://target.com/home";
    let config = CrawlerConfig {
        max_depth: 2,
        max_urls: 10,
        allowed_domain: "target.com".to_string(),
    };

    let mock_html = |url: &str| -> Option<String> {
        match url {
            "https://target.com/home" => Some(r#"
                <html><body>
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                    <a href="https://external.com/out">External</a>
                    <form action="/search" method="GET">
                        <input name="q" />
                    </form>
                </body></html>
            "#.to_string()),
            "https://target.com/about" => Some(r#"
                <html><body><a href="/team">Team</a></body></html>
            "#.to_string()),
            _ => Some("<html><body>Page</body></html>".to_string()),
        }
    };

    let items = AutonomousCrawlerEngine::crawl_seeded(seed, &config, mock_html);
    assert!(!items.is_empty());
    assert!(items.iter().any(|i| i.url == "https://target.com/home"));
    assert!(items.iter().any(|i| i.url == "https://target.com/about"));
    // Scope gating: external.com must not be visited
    assert!(!items.iter().any(|i| i.url.contains("external.com")));
}

#[test]
fn test_dom_xss_taint_telemetry() {
    use sentinel_browser::{DomSinkCategory, DomTaintTracker};

    let script = DomTaintTracker::generate_instrumentation_script("sentinel_canary_xss_999");
    assert!(script.contains("window.__sentinel_dom_telemetry"));
    assert!(script.contains("sentinel_canary_xss_999"));

    let event = DomTaintTracker::evaluate_taint_event(
        "element.innerHTML",
        "<img src=x onerror=alert(1)>sentinel_canary_xss_999",
        "sentinel_canary_xss_999",
        "Error\n    at renderUser (app.js:42:15)",
    ).unwrap();

    assert_eq!(event.category, DomSinkCategory::DomInjection);
    assert!(event.is_confirmed_vulnerability);
}

#[test]
fn test_worker_security_inspector() {
    use sentinel_browser::{ServiceWorkerRegistrationInfo, WorkerSecurityInspector};

    let worker = ServiceWorkerRegistrationInfo {
        script_url: "https://target.com/sw.js".to_string(),
        scope: "/".to_string(),
        active_state: "activated".to_string(),
        cached_keys: vec!["v1-cache".to_string()],
        uses_import_scripts: true,
        has_unvalidated_postmessage: true,
    };

    let findings = WorkerSecurityInspector::audit_service_worker(&worker, "https://target.com");
    assert_eq!(findings.len(), 3);
    assert!(findings.iter().any(|f| f.title.contains("Unvalidated Worker postMessage")));
    assert!(findings.iter().any(|f| f.title.contains("importScripts")));
}

