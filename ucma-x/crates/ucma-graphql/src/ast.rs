//! GraphQL AST definitions for query, mutation, and variable parameter models.

use serde::{Deserialize, Serialize};

/// GraphQL Operation Type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GraphQlOperationType {
    Query,
    Mutation,
    Subscription,
}

/// GraphQL Value literal or variable.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GraphQlValue {
    Variable(String),
    Int(i64),
    Float(f64),
    String(String),
    Boolean(bool),
    Null,
    Enum(String),
    List(Vec<GraphQlValue>),
    Object(Vec<(String, GraphQlValue)>),
}

/// GraphQL Field Argument.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphQlArgument {
    pub name: String,
    pub value: GraphQlValue,
}

/// GraphQL Selection (Field, Fragment Spread, Inline Fragment).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GraphQlSelection {
    Field(GraphQlField),
    FragmentSpread(String),
}

/// GraphQL Selection Field.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphQlField {
    pub name: String,
    pub alias: Option<String>,
    pub arguments: Vec<GraphQlArgument>,
    pub selection_set: Vec<GraphQlSelection>,
}

/// GraphQL Variable Definition.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphQlVariableDefinition {
    pub name: String,
    pub type_name: String,
    pub default_value: Option<GraphQlValue>,
}

/// GraphQL Operation Definition.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphQlOperation {
    pub operation_type: GraphQlOperationType,
    pub name: Option<String>,
    pub variable_definitions: Vec<GraphQlVariableDefinition>,
    pub selection_set: Vec<GraphQlSelection>,
}

/// Root GraphQL Document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphQlDocument {
    pub operations: Vec<GraphQlOperation>,
}
