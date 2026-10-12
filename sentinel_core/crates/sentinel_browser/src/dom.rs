//! DOM Tree Dissection & Interactive Element Extraction
//!
//! Provides deep HTML parsing for endpoint, form, link, script, meta, and
//! interactive element extraction — replacing the previous mock implementation
//! with production-grade regex-based parsing across all HTML element surfaces.

use regex::Regex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormElement {
    pub action: String,
    pub method: String,
    pub inputs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetaRedirect {
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomSnapshot {
    pub title: String,
    pub forms: Vec<FormElement>,
    pub links: Vec<String>,
    pub scripts: Vec<String>,
    pub meta_redirects: Vec<MetaRedirect>,
    pub iframe_sources: Vec<String>,
    pub comments: Vec<String>,
}

pub struct DomExtractor;

impl DomExtractor {
    pub fn extract(html: &str) -> DomSnapshot {
        let mut title = String::new();
        let mut forms = Vec::new();
        let mut links = Vec::new();
        let mut scripts = Vec::new();
        let mut meta_redirects = Vec::new();
        let mut iframe_sources = Vec::new();
        let mut comments = Vec::new();

        // 1. Extract <title>
        if let Ok(re) = Regex::new(r"(?i)<title[^>]*>([\s\S]*?)</title>") {
            if let Some(cap) = re.captures(html) {
                title = cap[1].trim().to_string();
            }
        }

        // 2. Extract all href attributes: <a href="...">, <link href="...">, <area href="...">
        if let Ok(re) = Regex::new(r#"(?i)<(?:a|link|area)\s+[^>]*href\s*=\s*["']([^"'#\s>]+)["']"#) {
            for cap in re.captures_iter(html) {
                let link = cap[1].trim();
                if !link.is_empty()
                    && !link.starts_with("javascript:")
                    && !link.starts_with("data:")
                    && !link.starts_with("mailto:")
                {
                    if !links.contains(&link.to_string()) {
                        links.push(link.to_string());
                    }
                }
            }
        }

        // 3. Extract <script src="..."> external scripts and inline script bodies
        if let Ok(re_src) = Regex::new(r#"(?i)<script[^>]+src\s*=\s*["']([^"']+)["']"#) {
            for cap in re_src.captures_iter(html) {
                let src = cap[1].trim().to_string();
                if !src.is_empty() && !scripts.contains(&src) {
                    scripts.push(src);
                }
            }
        }
        // Inline script bodies for JS route mining
        if let Ok(re_inline) = Regex::new(r"(?i)<script[^>]*>([\s\S]*?)</script>") {
            for cap in re_inline.captures_iter(html) {
                let body = cap[1].trim();
                if !body.is_empty() && body.len() > 10 {
                    // Extract API endpoints from inline scripts
                    if let Ok(re_api) = Regex::new(r#"["'`](/[a-zA-Z0-9_\-./]+)["'`]"#) {
                        for ep in re_api.captures_iter(body) {
                            let path = ep[1].to_string();
                            if path.len() > 1 && !links.contains(&path) {
                                links.push(path);
                            }
                        }
                    }
                }
            }
        }

        // 4. Real form extraction (replaces old mock)
        if let Ok(re_form) = Regex::new(r"(?is)<form\s+([^>]*?)>([\s\S]*?)</form>") {
            for cap in re_form.captures_iter(html) {
                let form_attrs = &cap[1];
                let form_body = &cap[2];

                // Extract action
                let action = Regex::new(r#"(?i)action\s*=\s*["']([^"']*)["']"#)
                    .ok()
                    .and_then(|r| r.captures(form_attrs))
                    .map(|c| c[1].to_string())
                    .unwrap_or_default();

                // Extract method
                let method = Regex::new(r#"(?i)method\s*=\s*["']([a-zA-Z]+)["']"#)
                    .ok()
                    .and_then(|r| r.captures(form_attrs))
                    .map(|c| c[1].to_uppercase())
                    .unwrap_or_else(|| "GET".to_string());

                // Extract all input/textarea/select names
                let mut inputs = Vec::new();
                if let Ok(re_input) = Regex::new(r#"(?i)<(?:input|textarea|select)\s+[^>]*name\s*=\s*["']([^"']+)["']"#) {
                    for inp in re_input.captures_iter(form_body) {
                        let name = inp[1].to_string();
                        if !inputs.contains(&name) {
                            inputs.push(name);
                        }
                    }
                }

                // Add form action as a discoverable link
                if !action.is_empty() && !links.contains(&action) {
                    links.push(action.clone());
                }

                forms.push(FormElement {
                    action,
                    method,
                    inputs,
                });
            }
        }

        // 5. Extract <meta http-equiv="refresh" content="...;url=...">
        if let Ok(re) = Regex::new(r#"(?i)<meta\s+[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'\s;>]+)"#) {
            for cap in re.captures_iter(html) {
                meta_redirects.push(MetaRedirect {
                    url: cap[1].trim().to_string(),
                });
                if !links.contains(&cap[1].trim().to_string()) {
                    links.push(cap[1].trim().to_string());
                }
            }
        }

        // 6. Extract <iframe src="...">
        if let Ok(re) = Regex::new(r#"(?i)<iframe\s+[^>]*src\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(html) {
                let src = cap[1].trim().to_string();
                if !src.is_empty() && !iframe_sources.contains(&src) {
                    iframe_sources.push(src.clone());
                    if !links.contains(&src) {
                        links.push(src);
                    }
                }
            }
        }

        // 7. Extract HTML comments for hidden endpoint mining
        if let Ok(re) = Regex::new(r"<!--([\s\S]*?)-->") {
            for cap in re.captures_iter(html) {
                let comment = cap[1].trim().to_string();
                if !comment.is_empty() {
                    // Mine endpoints from comments
                    if let Ok(re_ep) = Regex::new(r"(/[a-zA-Z0-9_\-./]{2,})") {
                        for ep in re_ep.captures_iter(&comment) {
                            let path = ep[1].to_string();
                            if !links.contains(&path) {
                                links.push(path);
                            }
                        }
                    }
                    comments.push(comment);
                }
            }
        }

        // 8. Extract onclick/formaction navigation targets
        if let Ok(re) = Regex::new(r#"(?i)(?:onclick|formaction)\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(html) {
                let code = &cap[1];
                if let Ok(re_nav) = Regex::new(r#"(?:location\.href|window\.open|navigate)\s*[=(]\s*['"]([^'"]+)['"]"#) {
                    for nav in re_nav.captures_iter(code) {
                        let url = nav[1].to_string();
                        if !links.contains(&url) {
                            links.push(url);
                        }
                    }
                }
                // Direct formaction URLs
                if code.starts_with('/') || code.starts_with("http") {
                    if !links.contains(&code.to_string()) {
                        links.push(code.to_string());
                    }
                }
            }
        }

        // 9. Extract data-url, data-href, data-endpoint attributes
        if let Ok(re) = Regex::new(r#"(?i)data-(?:url|href|endpoint|route|action|src)\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(html) {
                let url = cap[1].trim().to_string();
                if !url.is_empty() && !links.contains(&url) {
                    links.push(url);
                }
            }
        }

        // 10. Extract HTMX attributes: hx-get, hx-post, hx-put, hx-delete
        if let Ok(re) = Regex::new(r#"(?i)hx-(?:get|post|put|delete|patch)\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(html) {
                let url = cap[1].trim().to_string();
                if !url.is_empty() && !links.contains(&url) {
                    links.push(url);
                }
            }
        }

        DomSnapshot {
            title,
            forms,
            links,
            scripts,
            meta_redirects,
            iframe_sources,
            comments,
        }
    }
}
