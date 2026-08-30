//! Scope-Bound Katana-Style Recursive Crawler Engine
//!
//! Autonomous crawling pipeline discovering attack surface:
//! - Recursively traverses discovered hyperlinks, forms, script tags, and redirect endpoints
//! - Strict SEC-01 fail-closed scope boundary enforcement on every candidate URL
//! - Tracks crawl depth, URL deduplication (normalized URL set), and form parameter extraction

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawledItem {
    pub url: String,
    pub depth: usize,
    pub parent_url: Option<String>,
    pub extracted_links: Vec<String>,
    pub extracted_forms: Vec<CrawledForm>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawledForm {
    pub action: String,
    pub method: String,
    pub inputs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerConfig {
    pub max_depth: usize,
    pub max_urls: usize,
    pub allowed_domain: String,
}

pub struct AutonomousCrawlerEngine;

impl AutonomousCrawlerEngine {
    /// Extracts all outbound hyperlinks, form actions, and script sources from raw HTML
    pub fn extract_all_links(base_url: &str, html: &str) -> (Vec<String>, Vec<CrawledForm>) {
        let base = match Url::parse(base_url) {
            Ok(u) => u,
            Err(_) => return (Vec::new(), Vec::new()),
        };

        let mut links = Vec::new();
        let mut forms = Vec::new();

        // 1. Extract <a href="...">
        let re_href = Regex::new(r#"(?i)<a[^>]+href=["']([^"']+)["']"#).unwrap();
        for cap in re_href.captures_iter(html) {
            if let Some(m) = cap.get(1) {
                if let Ok(resolved) = base.join(m.as_str()) {
                    let s = resolved.to_string();
                    if !links.contains(&s) {
                        links.push(s);
                    }
                }
            }
        }

        // 2. Extract <script src="...">
        let re_script = Regex::new(r#"(?i)<script[^>]+src=["']([^"']+)["']"#).unwrap();
        for cap in re_script.captures_iter(html) {
            if let Some(m) = cap.get(1) {
                if let Ok(resolved) = base.join(m.as_str()) {
                    let s = resolved.to_string();
                    if !links.contains(&s) {
                        links.push(s);
                    }
                }
            }
        }

        // 3. Extract <form action="..." method="...">
        let re_form = Regex::new(r#"(?i)<form[^>]*action=["']([^"']+)["'][^>]*method=["']([^"']+)["'][^>]*>(.*?)</form>"#).unwrap();
        for cap in re_form.captures_iter(html) {
            let action_raw = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let method = cap.get(2).map(|m| m.as_str().to_uppercase()).unwrap_or_else(|| "GET".to_string());
            let form_body = cap.get(3).map(|m| m.as_str()).unwrap_or("");

            let action_resolved = base.join(action_raw).map(|u| u.to_string()).unwrap_or_else(|_| action_raw.to_string());

            let mut inputs = Vec::new();
            let re_input = Regex::new(r#"(?i)<input[^>]+name=["']([^"']+)["']"#).unwrap();
            for inp in re_input.captures_iter(form_body) {
                if let Some(name) = inp.get(1) {
                    inputs.push(name.as_str().to_string());
                }
            }

            forms.push(CrawledForm {
                action: action_resolved.clone(),
                method,
                inputs,
            });

            if !links.contains(&action_resolved) {
                links.push(action_resolved);
            }
        }

        (links, forms)
    }

    /// Simulates recursive breadth-first crawl given a page provider function
    pub fn crawl_seeded<F>(
        seed_url: &str,
        config: &CrawlerConfig,
        mut html_provider: F,
    ) -> Vec<CrawledItem>
    where
        F: FnMut(&str) -> Option<String>,
    {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        let mut results = Vec::new();

        queue.push_back((seed_url.to_string(), 0, None));
        visited.insert(seed_url.to_string());

        while let Some((current_url, depth, parent)) = queue.pop_front() {
            if results.len() >= config.max_urls {
                break;
            }

            if let Some(html) = html_provider(&current_url) {
                let (links, forms) = Self::extract_all_links(&current_url, &html);

                // Filter in-scope links
                let mut in_scope_links = Vec::new();
                for link in &links {
                    if let Ok(parsed) = Url::parse(link) {
                        if let Some(host) = parsed.host_str() {
                            if host == config.allowed_domain || host.ends_with(&format!(".{}", config.allowed_domain)) {
                                in_scope_links.push(link.clone());

                                if depth + 1 <= config.max_depth && !visited.contains(link) {
                                    visited.insert(link.clone());
                                    queue.push_back((link.clone(), depth + 1, Some(current_url.clone())));
                                }
                            }
                        }
                    }
                }

                results.push(CrawledItem {
                    url: current_url,
                    depth,
                    parent_url: parent,
                    extracted_links: in_scope_links,
                    extracted_forms: forms,
                });
            }
        }

        results
    }
}
