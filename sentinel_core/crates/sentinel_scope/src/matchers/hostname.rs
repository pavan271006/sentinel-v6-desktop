// crates/sentinel_scope/src/matchers/hostname.rs
//
// Exact and Wildcard Hostname Matching Engine.
// Handles case-insensitivity, subdomain boundaries, and apex domain containment.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostnameMatcher {
    /// Matches any non-empty hostname (`*`).
    Any,
    /// Matches exact hostname case-insensitively (e.g. `api.example.com`).
    Exact(String),
    /// Matches wildcard subdomains and apex domain (e.g. `*.example.com` matches `example.com`, `sub.example.com`, `a.b.example.com`).
    Wildcard { base_domain: String },
}

impl HostnameMatcher {
    /// Creates a new `HostnameMatcher` from a pattern string.
    pub fn parse(pattern: &str) -> Self {
        let pattern = pattern.trim().to_lowercase();
        let pattern = pattern.trim_end_matches('.');

        if pattern == "*" {
            return HostnameMatcher::Any;
        }

        if let Some(stripped) = pattern.strip_prefix("*.") {
            let base = stripped.trim().trim_start_matches('.');
            if base.is_empty() {
                HostnameMatcher::Any
            } else {
                HostnameMatcher::Wildcard {
                    base_domain: base.to_string(),
                }
            }
        } else {
            HostnameMatcher::Exact(pattern.to_string())
        }
    }

    /// Evaluates whether the given candidate hostname matches this rule.
    pub fn matches(&self, candidate_host: &str) -> bool {
        let candidate = candidate_host.trim().to_lowercase();
        let candidate = candidate.trim_end_matches('.');

        if candidate.is_empty() {
            return false;
        }

        match self {
            HostnameMatcher::Any => true,
            HostnameMatcher::Exact(expected) => candidate == *expected,
            HostnameMatcher::Wildcard { base_domain } => {
                if candidate == *base_domain {
                    // Apex domain matches (e.g. example.com matches *.example.com)
                    return true;
                }
                let suffix = format!(".{}", base_domain);
                candidate.ends_with(&suffix)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_hostname_matching() {
        let matcher = HostnameMatcher::parse("api.example.com");
        assert!(matcher.matches("api.example.com"));
        assert!(matcher.matches("API.EXAMPLE.COM"));
        assert!(matcher.matches("api.example.com."));
        assert!(!matcher.matches("sub.api.example.com"));
        assert!(!matcher.matches("example.com"));
        assert!(!matcher.matches("evil-api.example.com"));
        assert!(!matcher.matches(""));
    }

    #[test]
    fn test_wildcard_hostname_matching() {
        let matcher = HostnameMatcher::parse("*.example.com");
        assert!(matcher.matches("example.com"));
        assert!(matcher.matches("api.example.com"));
        assert!(matcher.matches("dev.staging.example.com"));
        assert!(matcher.matches("API.EXAMPLE.COM"));

        // Boundary checks
        assert!(!matcher.matches("evil-example.com"));
        assert!(!matcher.matches("example.com.attacker.com"));
        assert!(!matcher.matches("notexample.com"));
        assert!(!matcher.matches("attacker.org"));
        assert!(!matcher.matches(""));
    }

    #[test]
    fn test_any_hostname_matching() {
        let matcher = HostnameMatcher::parse("*");
        assert!(matcher.matches("anything.com"));
        assert!(matcher.matches("sub.example.org"));
        assert!(!matcher.matches(""));
    }
}
