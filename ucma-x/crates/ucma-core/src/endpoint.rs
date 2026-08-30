//! Endpoint models representing API operations and URL route templates.

use crate::ids::{EndpointId, TargetId};
use crate::parameter::ParameterDefinition;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;

/// Standard HTTP request methods.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
    Options,
    Trace,
    Connect,
    Other(String),
}

impl HttpMethod {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Delete => "DELETE",
            Self::Patch => "PATCH",
            Self::Head => "HEAD",
            Self::Options => "OPTIONS",
            Self::Trace => "TRACE",
            Self::Connect => "CONNECT",
            Self::Other(s) => s.as_str(),
        }
    }
}

impl fmt::Display for HttpMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for HttpMethod {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let upper = s.trim().to_uppercase();
        Ok(match upper.as_str() {
            "GET" => Self::Get,
            "POST" => Self::Post,
            "PUT" => Self::Put,
            "DELETE" => Self::Delete,
            "PATCH" => Self::Patch,
            "HEAD" => Self::Head,
            "OPTIONS" => Self::Options,
            "TRACE" => Self::Trace,
            "CONNECT" => Self::Connect,
            _ => Self::Other(upper),
        })
    }
}

/// An endpoint representing a route operation on an authorized target.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Endpoint {
    pub id: EndpointId,
    pub target_id: TargetId,
    pub method: HttpMethod,
    pub path_template: String,
    pub parameters: Vec<ParameterDefinition>,
    pub headers: HashMap<String, String>,
    pub auth_required: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl Endpoint {
    /// Creates a new endpoint bound to a target.
    pub fn new(target_id: &TargetId, method: HttpMethod, path_template: impl Into<String>) -> Self {
        let path = path_template.into();
        let normalized_path = if !path.starts_with('/') {
            format!("/{}", path)
        } else {
            path
        };
        let id = EndpointId::derive(target_id, method.as_str(), &normalized_path);
        Self {
            id,
            target_id: *target_id,
            method,
            path_template: normalized_path,
            parameters: Vec::new(),
            headers: HashMap::new(),
            auth_required: false,
            is_active: true,
            created_at: Utc::now(),
        }
    }

    /// Adds a parameter definition to this endpoint.
    pub fn add_parameter(&mut self, parameter: ParameterDefinition) {
        self.parameters.push(parameter);
    }

    /// Builder method to add a parameter.
    pub fn with_parameter(mut self, parameter: ParameterDefinition) -> Self {
        self.parameters.push(parameter);
        self
    }

    /// Builder method to require authentication.
    pub fn with_auth_required(mut self, auth: bool) -> Self {
        self.auth_required = auth;
        self
    }

    /// Builder method to set default headers.
    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.insert(key.into(), value.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::TargetId;

    #[test]
    fn test_endpoint_creation() {
        let target_id = TargetId::derive("https://target.local");
        let endpoint = Endpoint::new(&target_id, HttpMethod::Post, "/api/v1/auth/login")
            .with_auth_required(false)
            .with_header("Content-Type", "application/json");

        assert_eq!(endpoint.method, HttpMethod::Post);
        assert_eq!(endpoint.path_template, "/api/v1/auth/login");
        assert_eq!(
            endpoint.headers.get("Content-Type").unwrap(),
            "application/json"
        );
        assert!(!endpoint.auth_required);
    }

    #[test]
    fn test_http_method_parsing() {
        assert_eq!("get".parse::<HttpMethod>().unwrap(), HttpMethod::Get);
        assert_eq!("POST".parse::<HttpMethod>().unwrap(), HttpMethod::Post);
        assert_eq!(
            "CustomMethod".parse::<HttpMethod>().unwrap(),
            HttpMethod::Other("CUSTOMMETHOD".to_string())
        );
    }
}
