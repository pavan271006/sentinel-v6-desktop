//! Target models representing authorized validation root targets.

use crate::ids::TargetId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

/// Environment categorization for an authorized target.
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EnvironmentTag {
    Production,
    Staging,
    Development,
    #[default]
    Testing,
    LocalLab,
    Custom(String),
}

/// Target configuration for scan execution bounds and request parameters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TargetConfig {
    pub max_concurrency: usize,
    pub rate_limit_per_second: Option<u32>,
    pub custom_headers: HashMap<String, String>,
    pub user_agent: Option<String>,
    pub tls_verify: bool,
    pub follow_redirects: bool,
    pub max_redirects: usize,
}

impl Default for TargetConfig {
    fn default() -> Self {
        Self {
            max_concurrency: 8,
            rate_limit_per_second: Some(50),
            custom_headers: HashMap::new(),
            user_agent: Some("UCMA-X/0.1.0 (Security Validation Engine; Authorized)".to_string()),
            tls_verify: true,
            follow_redirects: true,
            max_redirects: 5,
        }
    }
}

/// An authorized target definition and scope root.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Target {
    pub id: TargetId,
    pub root_url: Url,
    pub name: String,
    pub environment: EnvironmentTag,
    pub allowed_paths: Vec<String>,
    pub disallowed_paths: Vec<String>,
    pub config: TargetConfig,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
}

impl Target {
    /// Creates a new Target from a root URL and name.
    pub fn new(root_url: Url, name: impl Into<String>) -> Self {
        let id = TargetId::derive(root_url.as_str());
        Self {
            id,
            root_url,
            name: name.into(),
            environment: EnvironmentTag::default(),
            allowed_paths: Vec::new(),
            disallowed_paths: Vec::new(),
            config: TargetConfig::default(),
            metadata: HashMap::new(),
            created_at: Utc::now(),
            is_active: true,
        }
    }

    /// Builder constructor.
    pub fn builder(root_url: Url) -> TargetBuilder {
        TargetBuilder::new(root_url)
    }

    /// Checks whether a given path is allowed by target path constraints.
    pub fn is_path_allowed(&self, path: &str) -> bool {
        let normalized = if !path.starts_with('/') {
            format!("/{}", path)
        } else {
            path.to_string()
        };

        // If disallowed_paths has a match, deny.
        for denied in &self.disallowed_paths {
            if normalized.starts_with(denied) {
                return false;
            }
        }

        // If allowed_paths is specified, at least one must match.
        if !self.allowed_paths.is_empty() {
            return self
                .allowed_paths
                .iter()
                .any(|allowed| normalized.starts_with(allowed));
        }

        true
    }
}

/// Fluent builder for Target.
#[derive(Debug, Clone)]
pub struct TargetBuilder {
    root_url: Url,
    name: Option<String>,
    environment: EnvironmentTag,
    allowed_paths: Vec<String>,
    disallowed_paths: Vec<String>,
    config: TargetConfig,
    metadata: HashMap<String, String>,
    is_active: bool,
}

impl TargetBuilder {
    pub fn new(root_url: Url) -> Self {
        Self {
            root_url,
            name: None,
            environment: EnvironmentTag::default(),
            allowed_paths: Vec::new(),
            disallowed_paths: Vec::new(),
            config: TargetConfig::default(),
            metadata: HashMap::new(),
            is_active: true,
        }
    }

    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    pub fn environment(mut self, env: EnvironmentTag) -> Self {
        self.environment = env;
        self
    }

    pub fn allow_path(mut self, path: impl Into<String>) -> Self {
        self.allowed_paths.push(path.into());
        self
    }

    pub fn disallow_path(mut self, path: impl Into<String>) -> Self {
        self.disallowed_paths.push(path.into());
        self
    }

    pub fn config(mut self, config: TargetConfig) -> Self {
        self.config = config;
        self
    }

    pub fn metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    pub fn is_active(mut self, active: bool) -> Self {
        self.is_active = active;
        self
    }

    pub fn build(self) -> Target {
        let name = self.name.unwrap_or_else(|| self.root_url.to_string());
        let id = TargetId::derive(self.root_url.as_str());
        Target {
            id,
            root_url: self.root_url,
            name,
            environment: self.environment,
            allowed_paths: self.allowed_paths,
            disallowed_paths: self.disallowed_paths,
            config: self.config,
            metadata: self.metadata,
            created_at: Utc::now(),
            is_active: self.is_active,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_target_creation() {
        let url = Url::parse("https://target.local:8443/api").unwrap();
        let target = Target::new(url.clone(), "Test API Target");
        assert_eq!(target.id, TargetId::derive("https://target.local:8443/api"));
        assert_eq!(target.name, "Test API Target");
        assert!(target.is_active);
    }

    #[test]
    fn test_target_path_filtering() {
        let url = Url::parse("https://target.local").unwrap();
        let target = Target::builder(url)
            .allow_path("/api/v1")
            .disallow_path("/api/v1/internal")
            .build();

        assert!(target.is_path_allowed("/api/v1/users"));
        assert!(!target.is_path_allowed("/api/v1/internal/admin"));
        assert!(!target.is_path_allowed("/other/path"));
    }
}
