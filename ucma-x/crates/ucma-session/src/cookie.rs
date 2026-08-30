//! Cookie representation, parser, and thread-safe cookie jar.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use url::Url;

/// Represents an HTTP cookie with security flags and domain/path scope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub secure: bool,
    pub http_only: bool,
    pub expires: Option<DateTime<Utc>>,
}

impl Cookie {
    /// Parses a single `Set-Cookie` header value.
    pub fn parse_set_cookie(header_value: &str, current_url: &Url) -> Option<Self> {
        let mut parts = header_value.split(';');
        let name_value = parts.next()?.trim();
        let (name, value) = name_value.split_once('=')?;

        let mut cookie = Cookie {
            name: name.trim().to_string(),
            value: value.trim().to_string(),
            domain: None,
            path: None,
            secure: false,
            http_only: false,
            expires: None,
        };

        for part in parts {
            let part = part.trim();
            if part.eq_ignore_ascii_case("secure") {
                cookie.secure = true;
            } else if part.eq_ignore_ascii_case("httponly") {
                cookie.http_only = true;
            } else if let Some((k, v)) = part.split_once('=') {
                let k_lower = k.trim().to_ascii_lowercase();
                let v_trimmed = v.trim();
                match k_lower.as_str() {
                    "domain" => {
                        cookie.domain = Some(v_trimmed.trim_start_matches('.').to_ascii_lowercase())
                    }
                    "path" => cookie.path = Some(v_trimmed.to_string()),
                    "max-age" => {
                        if let Ok(secs) = v_trimmed.parse::<i64>() {
                            cookie.expires = Some(Utc::now() + Duration::seconds(secs));
                        }
                    }
                    _ => {}
                }
            }
        }

        // Default domain & path if not specified
        if cookie.domain.is_none() {
            cookie.domain = current_url.host_str().map(|h| h.to_ascii_lowercase());
        }
        if cookie.path.is_none() {
            let p = current_url.path();
            let dir_path = if let Some((dir, _)) = p.rsplit_once('/') {
                if dir.is_empty() { "/" } else { dir }
            } else {
                "/"
            };
            cookie.path = Some(dir_path.to_string());
        }

        Some(cookie)
    }

    /// Checks if the cookie has expired.
    pub fn is_expired(&self) -> bool {
        if let Some(exp) = self.expires {
            Utc::now() > exp
        } else {
            false
        }
    }

    /// Evaluates if the cookie matches the target URL's domain, path, and scheme.
    pub fn matches(&self, url: &Url) -> bool {
        if self.is_expired() {
            return false;
        }

        // Scheme / Secure check
        if self.secure && url.scheme() != "https" {
            return false;
        }

        // Domain check
        if let Some(c_domain) = &self.domain {
            if let Some(u_host) = url.host_str() {
                let u_host_lower = u_host.to_ascii_lowercase();
                if u_host_lower != *c_domain && !u_host_lower.ends_with(&format!(".{}", c_domain)) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Path check
        if let Some(c_path) = &self.path {
            let u_path = url.path();
            if !u_path.starts_with(c_path) {
                return false;
            }
        }

        true
    }
}

/// Thread-safe cookie jar storing active session cookies.
#[derive(Debug, Clone, Default)]
pub struct CookieJar {
    cookies: Arc<RwLock<HashMap<String, Cookie>>>,
}

impl CookieJar {
    pub fn new() -> Self {
        Self {
            cookies: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Inserts or updates a cookie in the jar.
    pub fn insert(&self, cookie: Cookie) {
        let key = format!(
            "{}:{}:{}",
            cookie.name,
            cookie.domain.as_deref().unwrap_or(""),
            cookie.path.as_deref().unwrap_or("")
        );
        let mut map = self.cookies.write().expect("lock poisoned");
        map.insert(key, cookie);
    }

    /// Extracts and parses `Set-Cookie` headers from a response map.
    pub fn extract_from_headers(&self, headers: &HashMap<String, String>, url: &Url) {
        for (name, val) in headers {
            if name.eq_ignore_ascii_case("set-cookie") {
                // Handle multiple comma-separated or single cookie values
                if let Some(cookie) = Cookie::parse_set_cookie(val, url) {
                    self.insert(cookie);
                }
            }
        }
    }

    /// Formats matching cookies for a target URL as a `Cookie: name=val; name2=val2` string.
    pub fn cookie_header_for_url(&self, url: &Url) -> Option<String> {
        let map = self.cookies.read().expect("lock poisoned");
        let matching: Vec<String> = map
            .values()
            .filter(|c| c.matches(url))
            .map(|c| format!("{}={}", c.name, c.value))
            .collect();

        if matching.is_empty() {
            None
        } else {
            Some(matching.join("; "))
        }
    }

    /// Returns a list of all stored cookies.
    pub fn all_cookies(&self) -> Vec<Cookie> {
        let map = self.cookies.read().expect("lock poisoned");
        map.values().cloned().collect()
    }

    /// Clears all cookies from the jar.
    pub fn clear(&self) {
        self.cookies.write().expect("lock poisoned").clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cookie_parsing_and_matching() {
        let url = Url::parse("https://target.local/api/users").unwrap();
        let header = "session_id=xyz123; Path=/api; Secure; HttpOnly; Max-Age=3600";
        let cookie = Cookie::parse_set_cookie(header, &url).unwrap();

        assert_eq!(cookie.name, "session_id");
        assert_eq!(cookie.value, "xyz123");
        assert_eq!(cookie.path.as_deref(), Some("/api"));
        assert!(cookie.secure);
        assert!(cookie.http_only);
        assert!(!cookie.is_expired());
        assert!(cookie.matches(&url));

        // Mismatched path
        let other_url = Url::parse("https://target.local/other").unwrap();
        assert!(!cookie.matches(&other_url));

        // Mismatched scheme (http instead of https for secure cookie)
        let insecure_url = Url::parse("http://target.local/api/users").unwrap();
        assert!(!cookie.matches(&insecure_url));
    }

    #[test]
    fn test_cookie_jar_lifecycle() {
        let jar = CookieJar::new();
        let url = Url::parse("https://target.local/api/login").unwrap();

        let mut headers = HashMap::new();
        headers.insert(
            "set-cookie".to_string(),
            "jwt=secret123; Path=/; Secure".to_string(),
        );
        jar.extract_from_headers(&headers, &url);

        let query_url = Url::parse("https://target.local/api/dashboard").unwrap();
        let cookie_header = jar.cookie_header_for_url(&query_url);
        assert_eq!(cookie_header.as_deref(), Some("jwt=secret123"));
    }
}
