//! Opaque-Box E2E Suite: Hop-by-Hop Redirect Validation and Scope Re-evaluation.

use std::collections::HashMap;
use std::sync::Arc;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns};
use ucma_http::redirect::{RedirectDecision, RedirectValidator};
use ucma_scope::ScopeError;
use url::Url;

#[tokio::test]
async fn test_e2e_in_scope_redirect_followed() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/login").unwrap();
    let mut headers = HashMap::new();
    headers.insert(
        "location".to_string(),
        "https://example.com/dashboard".to_string(),
    );

    let decision = RedirectValidator::evaluate_hop(&initial_url, 302, &headers, 0, 5, &policy)
        .await
        .expect("redirect evaluation should succeed");

    match decision {
        RedirectDecision::Follow(next_auth_req) => {
            assert_eq!(
                next_auth_req.target_url().as_str(),
                "https://example.com/dashboard"
            );
        }
        RedirectDecision::Terminal => panic!("expected Follow decision for 302 redirect"),
    }
}

#[tokio::test]
async fn test_e2e_out_of_scope_redirect_aborted() {
    let resolver = create_mock_dns(
        vec![
            ("example.com", vec!["93.184.216.34"]),
            ("evil-attacker.com", vec!["93.184.216.99"]),
        ],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/redirect").unwrap();
    let mut headers = HashMap::new();
    headers.insert(
        "location".to_string(),
        "https://evil-attacker.com/steal".to_string(),
    );

    let decision_res =
        RedirectValidator::evaluate_hop(&initial_url, 301, &headers, 0, 5, &policy).await;

    assert!(decision_res.is_err());
    assert!(matches!(
        decision_res.unwrap_err(),
        ScopeError::OutOfScope(_)
    ));
}

#[tokio::test]
async fn test_e2e_ssrf_redirect_aborted() {
    let resolver = create_mock_dns(
        vec![
            ("example.com", vec!["93.184.216.34"]),
            ("metadata.target.com", vec!["169.254.169.254"]),
        ],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/proxy").unwrap();
    let mut headers = HashMap::new();
    headers.insert(
        "location".to_string(),
        "https://metadata.target.com/latest/meta-data/".to_string(),
    );

    let decision_res =
        RedirectValidator::evaluate_hop(&initial_url, 307, &headers, 0, 5, &policy).await;

    assert!(decision_res.is_err());
    assert!(matches!(
        decision_res.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));
}

#[tokio::test]
async fn test_e2e_redirect_hop_limit_enforced() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/loop").unwrap();
    let mut headers = HashMap::new();
    headers.insert(
        "location".to_string(),
        "https://example.com/loop".to_string(),
    );

    let decision_res =
        RedirectValidator::evaluate_hop(&initial_url, 302, &headers, 5, 5, &policy).await;

    assert!(decision_res.is_err());
    assert!(matches!(
        decision_res.unwrap_err(),
        ScopeError::TooManyRedirects(5)
    ));
}

#[tokio::test]
async fn test_e2e_relative_redirect_location_canonicalized() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/app/v1/login").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "../v2/dashboard".to_string());

    let decision = RedirectValidator::evaluate_hop(&initial_url, 303, &headers, 1, 5, &policy)
        .await
        .expect("relative redirect resolution should succeed");

    match decision {
        RedirectDecision::Follow(next_auth_req) => {
            assert_eq!(
                next_auth_req.target_url().as_str(),
                "https://example.com/app/v2/dashboard"
            );
        }
        RedirectDecision::Terminal => panic!("expected Follow for 303"),
    }
}
