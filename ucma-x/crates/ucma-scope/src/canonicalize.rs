//! URL Canonicalization and syntactic normalization.

use crate::errors::ScopeError;
use std::collections::BTreeMap;
use url::Url;

/// Canonicalizes and normalizes an input URL string into a standard, deterministic `url::Url`.
///
/// Steps performed:
/// 1. Parse URL and validate allowed schemes (http, https, ws, wss).
/// 2. Lowercase scheme and hostname.
/// 3. Remove standard default ports (80 for http/ws, 443 for https/wss).
/// 4. Resolve path traversal segments (e.g. `/a/b/../c` -> `/a/c`).
/// 5. Deterministically sort query parameters by key and value.
/// 6. Strip URL fragments (`#...`).
pub fn canonicalize(raw_url: &str) -> Result<Url, ScopeError> {
    let raw_url = raw_url.trim();
    if raw_url.is_empty() {
        return Err(ScopeError::CanonicalizationError(
            "empty URL string".to_string(),
        ));
    }

    let parsed = Url::parse(raw_url)
        .map_err(|e| ScopeError::CanonicalizationError(format!("URL parse error: {}", e)))?;

    canonicalize_url(&parsed)
}

/// Canonicalizes an already-parsed `Url`.
pub fn canonicalize_url(url: &Url) -> Result<Url, ScopeError> {
    let scheme = url.scheme().to_lowercase();
    match scheme.as_str() {
        "http" | "https" | "ws" | "wss" => {}
        other => return Err(ScopeError::DisallowedScheme(other.to_string())),
    }

    let host = url
        .host_str()
        .ok_or_else(|| ScopeError::CanonicalizationError("missing host in URL".to_string()))?
        .to_lowercase();

    let port = match (scheme.as_str(), url.port()) {
        ("http" | "ws", Some(80)) => None,
        ("https" | "wss", Some(443)) => None,
        (_, port) => port,
    };

    let normalized_path = normalize_path(url.path());
    let sorted_query = sort_query_pairs(url.query());

    let mut base_str = format!("{}://{}", scheme, host);
    if let Some(p) = port {
        base_str.push_str(&format!(":{}", p));
    }
    base_str.push_str(&normalized_path);

    if let Some(query) = sorted_query.as_deref().filter(|q| !q.is_empty()) {
        base_str.push('?');
        base_str.push_str(query);
    }

    Url::parse(&base_str)
        .map_err(|e| ScopeError::CanonicalizationError(format!("failed reconstructing URL: {}", e)))
}

/// Resolves dot segments (`.` and `..`) in a URL path.
pub fn normalize_path(path: &str) -> String {
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    let mut segments = Vec::new();
    let has_trailing_slash = path.ends_with('/');

    for part in path.split('/') {
        match part {
            "" | "." => continue,
            ".." => {
                segments.pop();
            }
            segment => {
                segments.push(segment);
            }
        }
    }

    if segments.is_empty() {
        return "/".to_string();
    }

    let mut result = String::new();
    for seg in segments {
        result.push('/');
        result.push_str(seg);
    }

    if has_trailing_slash && !result.ends_with('/') {
        result.push('/');
    }

    result
}

/// Deterministically sorts query parameter pairs alphabetically.
pub fn sort_query_pairs(query: Option<&str>) -> Option<String> {
    let q = query?;
    if q.is_empty() {
        return None;
    }

    let mut map: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for pair in q.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("").to_string();
        let val = parts.next().unwrap_or("").to_string();
        map.entry(key).or_default().push(val);
    }

    let mut formatted_pairs = Vec::new();
    for (k, mut vals) in map {
        vals.sort();
        for v in vals {
            if v.is_empty() {
                formatted_pairs.push(k.clone());
            } else {
                formatted_pairs.push(format!("{}={}", k, v));
            }
        }
    }

    if formatted_pairs.is_empty() {
        None
    } else {
        Some(formatted_pairs.join("&"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonicalize_schemes_and_ports() {
        let u1 = canonicalize("HTTP://EXAMPLE.COM:80/foo/bar").unwrap();
        assert_eq!(u1.as_str(), "http://example.com/foo/bar");

        let u2 = canonicalize("HTTPS://EXAMPLE.COM:443/foo/bar").unwrap();
        assert_eq!(u2.as_str(), "https://example.com/foo/bar");

        let u3 = canonicalize("https://example.com:8443/foo").unwrap();
        assert_eq!(u3.as_str(), "https://example.com:8443/foo");
    }

    #[test]
    fn test_canonicalize_path_traversal() {
        let u = canonicalize("https://example.com/a/b/../c/./d/").unwrap();
        assert_eq!(u.as_str(), "https://example.com/a/c/d/");
    }

    #[test]
    fn test_canonicalize_query_sorting() {
        let u = canonicalize("https://example.com/search?z=3&a=1&m=2&a=0").unwrap();
        assert_eq!(u.as_str(), "https://example.com/search?a=0&a=1&m=2&z=3");
    }

    #[test]
    fn test_strip_fragments() {
        let u = canonicalize("https://example.com/page#section2").unwrap();
        assert_eq!(u.as_str(), "https://example.com/page");
        assert!(u.fragment().is_none());
    }

    #[test]
    fn test_disallowed_schemes() {
        assert!(canonicalize("ftp://example.com").is_err());
        assert!(canonicalize("file:///etc/passwd").is_err());
        assert!(canonicalize("gopher://example.com").is_err());
    }
}
