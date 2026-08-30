//! SENTINEL V6: Production Fuzzing Subsystem (WP-7.1 / SUB-08)
//!
//! Provides coverage-guided / differential fuzzing, boundary & mutation generators,
//! type-aware schema-guided mutations, structured grammar AST fuzzing,
//! insertion point encoders, and automated payload minimization.

pub mod engine;
pub mod grammar_ast;
pub mod minimizer;
pub mod mutators;
pub mod type_aware;

pub use engine::DefaultFuzzerEngine;
pub use grammar_ast::{GrammarAstFuzzer, GrammarDomain};
pub use minimizer::PayloadMinimizer;
pub use mutators::FuzzMutator;
pub use type_aware::TypeAwareFuzzer;
