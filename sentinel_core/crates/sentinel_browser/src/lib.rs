//! SENTINEL V6: Browser Automation & DOM Subsystem (WP-11.1 / SUB-15)
//!
//! Provides headless browser navigation abstraction, DOM snapshotting,
//! JavaScript execution, screenshot CAS evidence persistence, Katana-style
//! autonomous crawler, DOM XSS source-to-sink telemetry, and Service Worker inspection.

pub mod crawler;
pub mod dom;
pub mod dom_telemetry;
pub mod service;
pub mod workers;

pub use crawler::{AutonomousCrawlerEngine, CrawledForm, CrawledItem, CrawlerConfig};
pub use dom::{DomExtractor, DomSnapshot, FormElement};
pub use dom_telemetry::{DomSinkCategory, DomTaintEvent, DomTaintTracker};
pub use service::DefaultBrowserService;
pub use workers::{ServiceWorkerRegistrationInfo, WorkerSecurityFinding, WorkerSecurityInspector};
