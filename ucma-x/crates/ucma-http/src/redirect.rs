//! Hop-by-hop redirect security validation and re-authorization.

use std::collections::HashMap;
use std::sync::Arc;
use ucma_core::endpoint::HttpMethod;
use ucma_core::ids::TargetId;
use ucma_core::request::RawRequest;
use ucma_scope::ScopeError;
use ucma_scope::policy::{AuthorizedRequest, ScopePolicy};
use url::Url;

/// Outcome of redirect evaluation.
#[derive(Debug)]
pub enum RedirectDecision {
    /// Proceed to the next hop with a newly minted AuthorizedRequest capability token.
    Follow(Box<AuthorizedRequest>),
    /// Response is not a redirect; process as terminal response.
    Terminal,
}

/// Validator evaluating every HTTP redirect against ScopePolicy.
pub struct RedirectValidator;

impl RedirectValidator {
    /// Evaluates if a response is a redirect and validates the target against ScopePolicy.
    pub async fn evaluate_hop(
        current_url: &Url,
        status_code: u16,
        headers: &HashMap<String, String>,
        hop_count: usize,
        max_redirects: usize,
        scope_policy: &Arc<ScopePolicy>,
    ) -> Result<RedirectDecision, ScopeError> {
        // Check for 3xx redirect status codes
        if !matches!(status_code, 301 | 302 | 303 | 307 | 308) {
            return Ok(RedirectDecision::Terminal);
        }

        // Locate Location header (case-insensitive)
        let location_val = headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("location"))
            .map(|(_, v)| v.trim());

        let location = match location_val {
            Some(loc) if !loc.is_empty() => loc,
            _ => return Ok(RedirectDecision::Terminal),
        };

        // Check hop count
        if hop_count >= max_redirects {
            return Err(ScopeError::TooManyRedirects(max_redirects));
        }

        // Parse and resolve relative redirect URLs
        let redirect_url = current_url.join(location).map_err(|e| {
            ScopeError::CanonicalizationError(format!(
                "invalid redirect Location '{}': {}",
                location, e
            ))
        })?;

        // Re-authorize through ScopePolicy (enforcing DNS and anti-SSRF on the new target!)
        let target_id = TargetId::derive(redirect_url.as_str());
        let raw_req = RawRequest::from_url(target_id, HttpMethod::Get, redirect_url);

        let authorized_hop = scope_policy.authorize(raw_req).await?;
        Ok(RedirectDecision::Follow(Box::new(authorized_hop)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use ucma_scope::dns::SafeDnsResolver;

    #[tokio::test]
    async fn test_redirect_to_in_scope_target() {
        let mut mock_dns = HashMap::new();
        mock_dns.insert(
            "api.example.com".to_string(),
            vec!["93.184.216.34".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = Arc::new(
            ScopePolicy::builder()
                .allow_host("api.example.com")
                .with_resolver(resolver)
                .build(),
        );

        let current = Url::parse("https://api.example.com/old-path").unwrap();
        let mut headers = HashMap::new();
        headers.insert("location".to_string(), "/new-path".to_string());

        let decision = RedirectValidator::evaluate_hop(&current, 302, &headers, 0, 5, &policy)
            .await
            .unwrap();

        match decision {
            RedirectDecision::Follow(auth) => {
                assert_eq!(
                    auth.target_url().as_str(),
                    "https://api.example.com/new-path"
                );
            }
            _ => panic!("expected Follow"),
        }
    }

    #[tokio::test]
    async fn test_redirect_to_out_of_scope_target_rejected() {
        let mut mock_dns = HashMap::new();
        mock_dns.insert(
            "api.example.com".to_string(),
            vec!["93.184.216.34".parse().unwrap()],
        );
        mock_dns.insert(
            "evil.com".to_string(),
            vec!["93.184.216.35".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = Arc::new(
            ScopePolicy::builder()
                .allow_host("api.example.com")
                .with_resolver(resolver)
                .build(),
        );

        let current = Url::parse("https://api.example.com/login").unwrap();
        let mut headers = HashMap::new();
        headers.insert("location".to_string(), "https://evil.com/phish".to_string());

        let res = RedirectValidator::evaluate_hop(&current, 302, &headers, 0, 5, &policy).await;

        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
    }

    #[tokio::test]
    async fn test_redirect_hop_limit_exceeded() {
        let policy = Arc::new(ScopePolicy::builder().allow_host("api.example.com").build());
        let current = Url::parse("https://api.example.com/loop").unwrap();
        let mut headers = HashMap::new();
        headers.insert("location".to_string(), "/loop".to_string());

        let res = RedirectValidator::evaluate_hop(
            &current, 302, &headers, 5, // Already reached max
            5, &policy,
        )
        .await;

        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), ScopeError::TooManyRedirects(5)));
    }
}
