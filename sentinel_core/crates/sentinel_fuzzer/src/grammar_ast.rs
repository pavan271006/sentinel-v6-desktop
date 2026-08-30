//! Structured Grammar AST Fuzzing Engine
//!
//! Generates syntactically complex and deep test payloads from Context-Free Grammars:
//! - SQL Expression Trees: nested boolean conditions, function calls, subqueries
//! - XML Element Hierarchies: nested tags, CDATA, namespaces, entity declarations
//! - GraphQL Queries: nested fields, inline fragments, alias projections

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GrammarDomain {
    Sql,
    Xml,
    GraphQl,
    Json,
}

pub struct GrammarAstFuzzer;

impl GrammarAstFuzzer {
    /// Generates nested SQL expression AST payloads with depth `depth`
    pub fn generate_sql_expression(depth: usize) -> String {
        if depth == 0 {
            return "1=1".to_string();
        }
        let inner = Self::generate_sql_expression(depth - 1);
        match depth % 4 {
            0 => format!("({}) AND ({})", inner, inner),
            1 => format!("EXISTS(SELECT 1 FROM users WHERE {})", inner),
            2 => format!("(SELECT CASE WHEN {} THEN 1 ELSE 0 END) = 1", inner),
            _ => format!("NOT ({})", inner),
        }
    }

    /// Generates nested XML AST structures with depth `depth`
    pub fn generate_xml_structure(depth: usize) -> String {
        if depth == 0 {
            return "<leaf>sentinel_data</leaf>".to_string();
        }
        let inner = Self::generate_xml_structure(depth - 1);
        format!("<node level=\"{}\">{}</node>", depth, inner)
    }

    /// Generates nested GraphQL query AST with depth `depth`
    pub fn generate_graphql_nested_query(depth: usize) -> String {
        if depth == 0 {
            return "{ id name }".to_string();
        }
        let inner = Self::generate_graphql_nested_query(depth - 1);
        format!("{{ user(id: {}) {{ friends {} }} }}", depth, inner)
    }
}
