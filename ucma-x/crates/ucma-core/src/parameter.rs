//! Parameter domain models representing request injection points and input vectors.

use crate::ids::{EndpointId, ParameterId};
use serde::{Deserialize, Serialize};
use std::fmt;

/// The protocol location where a parameter is transmitted in an HTTP request.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParameterLocation {
    Query,
    Header,
    Cookie,
    Path,
    BodyForm,
    BodyJson,
    BodyXml,
    Multipart,
    Unknown(String),
}

impl ParameterLocation {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Query => "query",
            Self::Header => "header",
            Self::Cookie => "cookie",
            Self::Path => "path",
            Self::BodyForm => "body_form",
            Self::BodyJson => "body_json",
            Self::BodyXml => "body_xml",
            Self::Multipart => "multipart",
            Self::Unknown(s) => s.as_str(),
        }
    }
}

impl fmt::Display for ParameterLocation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Inferred data type of a parameter value.
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParameterType {
    #[default]
    String,
    Integer,
    Float,
    Boolean,
    Json,
    Base64,
    Uuid,
    Custom(String),
}

/// Formal definition of an endpoint parameter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParameterDefinition {
    pub id: ParameterId,
    pub name: String,
    pub location: ParameterLocation,
    pub param_type: ParameterType,
    pub default_value: Option<String>,
    pub is_required: bool,
    pub sample_values: Vec<String>,
    pub description: Option<String>,
}

impl ParameterDefinition {
    /// Creates a new parameter definition bound to an endpoint.
    pub fn new(
        endpoint_id: &EndpointId,
        name: impl Into<String>,
        location: ParameterLocation,
    ) -> Self {
        let name_str = name.into();
        let id = ParameterId::derive(endpoint_id, location.as_str(), &name_str);
        Self {
            id,
            name: name_str,
            location,
            param_type: ParameterType::default(),
            default_value: None,
            is_required: false,
            sample_values: Vec::new(),
            description: None,
        }
    }

    pub fn with_type(mut self, param_type: ParameterType) -> Self {
        self.param_type = param_type;
        self
    }

    pub fn with_default(mut self, default: impl Into<String>) -> Self {
        self.default_value = Some(default.into());
        self
    }

    pub fn with_required(mut self, required: bool) -> Self {
        self.is_required = required;
        self
    }

    pub fn with_sample(mut self, sample: impl Into<String>) -> Self {
        self.sample_values.push(sample.into());
        self
    }
}

/// An instantiated parameter key-value pair.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ParameterValue {
    pub name: String,
    pub location: ParameterLocation,
    pub raw_value: String,
}

impl ParameterValue {
    pub fn new(
        name: impl Into<String>,
        location: ParameterLocation,
        raw_value: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            location,
            raw_value: raw_value.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::TargetId;

    #[test]
    fn test_parameter_definition() {
        let target_id = TargetId::derive("https://target.local");
        let endpoint_id = EndpointId::derive(&target_id, "GET", "/search");
        let param = ParameterDefinition::new(&endpoint_id, "q", ParameterLocation::Query)
            .with_type(ParameterType::String)
            .with_default("test")
            .with_required(true);

        assert_eq!(param.name, "q");
        assert_eq!(param.location, ParameterLocation::Query);
        assert_eq!(param.param_type, ParameterType::String);
        assert_eq!(param.default_value.as_deref(), Some("test"));
        assert!(param.is_required);
    }
}
