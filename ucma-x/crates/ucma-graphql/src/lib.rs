//! # UCMA-GraphQL
//! GraphQL query & mutation parser, variable extractor, and AST parameter extraction for UCMA-X.

pub mod ast;
pub mod extractor;
pub mod mutator;
pub mod parser;

pub use ast::{
    GraphQlArgument, GraphQlDocument, GraphQlField, GraphQlOperation, GraphQlOperationType,
    GraphQlSelection, GraphQlValue, GraphQlVariableDefinition,
};
pub use extractor::GraphQlParameterExtractor;
pub use mutator::GraphQlMutator;
pub use parser::GraphQlParser;
