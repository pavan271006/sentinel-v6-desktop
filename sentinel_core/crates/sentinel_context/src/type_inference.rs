//! API Parameter Type & Constraint Inference Engine
//!
//! Infers data types, bounds, and syntactic constraints from parameter names and sample values:
//! - Inferred types: Integer, Float, Boolean, UUID, DateTime, Email, Url, Json, Xml, Enum, FreeText
//! - Infers numeric minimum/maximum bounds and regex formats

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum InferredType {
    Integer { min: Option<i64>, max: Option<i64> },
    Float,
    Boolean,
    Uuid,
    IsoDateTime,
    Email,
    Url,
    Json,
    Xml,
    Enum(Vec<String>),
    FreeText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferredParameterSchema {
    pub parameter_name: String,
    pub inferred_type: InferredType,
    pub is_nullable: bool,
    pub sample_count: usize,
}

pub struct TypeInferenceEngine;

impl TypeInferenceEngine {
    /// Infers the parameter schema and type constraints from observed sample values
    pub fn infer_schema(param_name: &str, sample_values: &[&str]) -> InferredParameterSchema {
        if sample_values.is_empty() {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::FreeText,
                is_nullable: false,
                sample_count: 0,
            };
        }

        let is_nullable = sample_values.iter().any(|&v| v.is_empty() || v == "null" || v == "None");
        let non_null_samples: Vec<&str> = sample_values
            .iter()
            .copied()
            .filter(|&v| !v.is_empty() && v != "null" && v != "None")
            .collect();

        if non_null_samples.is_empty() {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::FreeText,
                is_nullable: true,
                sample_count: sample_values.len(),
            };
        }

        // 1. Check Boolean
        if non_null_samples.iter().all(|&v| {
            let lower = v.to_ascii_lowercase();
            lower == "true" || lower == "false" || lower == "1" || lower == "0"
        }) {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Boolean,
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        // 2. Check Integer
        let int_parse_results: Vec<Option<i64>> = non_null_samples
            .iter()
            .map(|&v| v.parse::<i64>().ok())
            .collect();

        if int_parse_results.iter().all(|res| res.is_some()) {
            let ints: Vec<i64> = int_parse_results.into_iter().flatten().collect();
            let min = ints.iter().min().copied();
            let max = ints.iter().max().copied();

            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Integer { min, max },
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        // 3. Check Float
        if non_null_samples.iter().all(|&v| v.parse::<f64>().is_ok()) {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Float,
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        // 4. Check UUID
        if non_null_samples.iter().all(|&v| Uuid::parse_str(v).is_ok()) {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Uuid,
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        // 5. Check Email
        if non_null_samples.iter().all(|&v| v.contains('@') && v.contains('.')) {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Email,
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        // 6. Check JSON
        if non_null_samples.iter().all(|&v| serde_json::from_str::<serde_json::Value>(v).is_ok()) {
            return InferredParameterSchema {
                parameter_name: param_name.to_string(),
                inferred_type: InferredType::Json,
                is_nullable,
                sample_count: sample_values.len(),
            };
        }

        InferredParameterSchema {
            parameter_name: param_name.to_string(),
            inferred_type: InferredType::FreeText,
            is_nullable,
            sample_count: sample_values.len(),
        }
    }
}
