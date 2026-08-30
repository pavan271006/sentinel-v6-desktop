//! GraphQL Payload Mutator.
//! Modifies GraphQL query AST argument values or JSON variables for security probe testing.

use crate::ast::{GraphQlDocument, GraphQlSelection, GraphQlValue};
use crate::parser::GraphQlParser;
use ucma_parameter::ParameterMutator;

pub struct GraphQlMutator;

impl GraphQlMutator {
    /// Mutates either the GraphQL query AST or the variables JSON depending on parameter target path.
    pub fn mutate_request(
        query: &str,
        variables_json: Option<&str>,
        target_param_name: &str,
        new_val: &str,
    ) -> Result<(String, Option<String>), String> {
        if target_param_name.starts_with('$') {
            // Target is a JSON variable
            if let Some(vars_str) = variables_json {
                let mutated_vars = ParameterMutator::mutate_json(vars_str, target_param_name, new_val)?;
                return Ok((query.to_string(), Some(mutated_vars)));
            }
        }

        // Target is an AST query argument
        let mut doc = GraphQlParser::parse(query)?;
        Self::mutate_document(&mut doc, target_param_name, new_val)?;
        let serialized = GraphQlParser::serialize(&doc);

        Ok((serialized, variables_json.map(String::from)))
    }

    /// Mutates an argument value inside a GraphQlDocument AST.
    pub fn mutate_document(
        doc: &mut GraphQlDocument,
        target_path: &str,
        new_val: &str,
    ) -> Result<(), String> {
        for op in &mut doc.operations {
            let op_name = op.name.as_deref().unwrap_or("query");
            if Self::mutate_selections(&mut op.selection_set, target_path, op_name, new_val) {
                return Ok(());
            }
        }
        Err(format!("Argument path '{}' not found in GraphQL document", target_path))
    }

    fn mutate_selections(
        selections: &mut [GraphQlSelection],
        target_path: &str,
        parent_path: &str,
        new_val: &str,
    ) -> bool {
        for sel in selections.iter_mut() {
            if let GraphQlSelection::Field(f) = sel {
                let field_path = format!("{}.{}", parent_path, f.name);

                for arg in &mut f.arguments {
                    let arg_path = format!("{}.arg.{}", field_path, arg.name);
                    if arg_path == target_path {
                        arg.value = GraphQlValue::String(new_val.to_string());
                        return true;
                    }
                }

                if !f.selection_set.is_empty()
                    && Self::mutate_selections(&mut f.selection_set, target_path, &field_path, new_val) {
                        return true;
                    }
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mutate_graphql_ast() {
        let query = "query GetUser { user(id: 10) { id name } }";
        let (mutated_query, _) =
            GraphQlMutator::mutate_request(query, None, "GetUser.user.arg.id", "10' OR '1'='1")
                .unwrap();
        assert!(mutated_query.contains(r#"id: "10' OR '1'='1""#));
    }
}
