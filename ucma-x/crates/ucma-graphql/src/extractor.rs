//! GraphQL Parameter Extractor.
//! Traverses GraphQL Document AST and JSON variables to extract testable input vectors.

use crate::ast::{GraphQlDocument, GraphQlSelection, GraphQlValue};
use crate::parser::GraphQlParser;
use ucma_core::ids::EndpointId;
use ucma_core::parameter::ParameterLocation;
use ucma_parameter::{ExtractedParameter, ParameterExtractor};

/// GraphQL Parameter Extractor.
pub struct GraphQlParameterExtractor;

impl GraphQlParameterExtractor {
    /// Extracts parameters from both the GraphQL query document and the JSON variables map.
    pub fn extract_all(
        endpoint_id: &EndpointId,
        query: &str,
        variables_json: Option<&str>,
    ) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();

        // 1. Extract AST arguments from Query
        if let Ok(doc) = GraphQlParser::parse(query) {
            Self::extract_from_document(endpoint_id, &doc, &mut params);
        }

        // 2. Extract from JSON variables map
        if let Some(vars_str) = variables_json {
            let json_params = ParameterExtractor::extract_from_json(endpoint_id, vars_str);
            for mut p in json_params {
                p.location = ParameterLocation::Unknown("graphql_variable".to_string());
                params.push(p);
            }
        }

        params
    }

    /// Extracts parameters from an AST document.
    pub fn extract_from_document(
        endpoint_id: &EndpointId,
        doc: &GraphQlDocument,
        params: &mut Vec<ExtractedParameter>,
    ) {
        for op in &doc.operations {
            let op_name = op.name.as_deref().unwrap_or("query");
            Self::extract_from_selections(endpoint_id, &op.selection_set, op_name, params);
        }
    }

    fn extract_from_selections(
        endpoint_id: &EndpointId,
        selections: &[GraphQlSelection],
        parent_path: &str,
        params: &mut Vec<ExtractedParameter>,
    ) {
        for sel in selections {
            if let GraphQlSelection::Field(f) = sel {
                let field_path = format!("{}.{}", parent_path, f.name);

                for arg in &f.arguments {
                    let arg_path = format!("{}.arg.{}", field_path, arg.name);
                    Self::extract_from_value(endpoint_id, &arg.value, &arg_path, params);
                }

                if !f.selection_set.is_empty() {
                    Self::extract_from_selections(
                        endpoint_id,
                        &f.selection_set,
                        &field_path,
                        params,
                    );
                }
            }
        }
    }

    fn extract_from_value(
        endpoint_id: &EndpointId,
        val: &GraphQlValue,
        path: &str,
        params: &mut Vec<ExtractedParameter>,
    ) {
        match val {
            GraphQlValue::String(s) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::Unknown("graphql_arg".to_string()),
                    s.clone(),
                ));
            }
            GraphQlValue::Int(i) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::Unknown("graphql_arg".to_string()),
                    i.to_string(),
                ));
            }
            GraphQlValue::Float(f) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::Unknown("graphql_arg".to_string()),
                    f.to_string(),
                ));
            }
            GraphQlValue::Boolean(b) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::Unknown("graphql_arg".to_string()),
                    b.to_string(),
                ));
            }
            GraphQlValue::Enum(e) => {
                params.push(ExtractedParameter::new(
                    endpoint_id,
                    path.to_string(),
                    ParameterLocation::Unknown("graphql_arg".to_string()),
                    e.clone(),
                ));
            }
            GraphQlValue::Object(obj) => {
                for (k, v) in obj {
                    let sub_path = format!("{}.{}", path, k);
                    Self::extract_from_value(endpoint_id, v, &sub_path, params);
                }
            }
            GraphQlValue::List(list) => {
                for (i, v) in list.iter().enumerate() {
                    let sub_path = format!("{}[{}]", path, i);
                    Self::extract_from_value(endpoint_id, v, &sub_path, params);
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_core::ids::TargetId;

    #[test]
    fn test_extract_graphql_params() {
        let tid = TargetId::derive("https://api.local");
        let eid = EndpointId::derive(&tid, "POST", "/graphql");
        let query = r#"
            query GetUser {
                user(id: "101", filter: { status: "active", limit: 5 }) {
                    id
                    name
                }
            }
        "#;
        let vars = r#"{"extraToken": "xyz789"}"#;

        let params = GraphQlParameterExtractor::extract_all(&eid, query, Some(vars));
        assert!(params.iter().any(|p| p.name == "GetUser.user.arg.id" && p.raw_value == "101"));
        assert!(params.iter().any(|p| p.name == "GetUser.user.arg.filter.status" && p.raw_value == "active"));
        assert!(params.iter().any(|p| p.name == "GetUser.user.arg.filter.limit" && p.raw_value == "5"));
        assert!(params.iter().any(|p| p.name == "$.extraToken" && p.raw_value == "xyz789"));
    }
}
