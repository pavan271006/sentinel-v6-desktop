//! SQL Grammar Production Rules.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GrammarSymbol {
    Expression,
    BinaryOp,
    Literal,
    Identifier,
    FunctionCall,
    ClauseComment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionRule {
    pub symbol: GrammarSymbol,
    pub expansions: Vec<String>,
}

pub struct SqlGrammarCatalog;

impl SqlGrammarCatalog {
    pub fn standard_rules() -> Vec<ProductionRule> {
        vec![
            ProductionRule {
                symbol: GrammarSymbol::BinaryOp,
                expansions: vec![
                    "AND".to_string(),
                    "OR".to_string(),
                    "=".to_string(),
                    "!=".to_string(),
                    "LIKE".to_string(),
                    "IN".to_string(),
                ],
            },
            ProductionRule {
                symbol: GrammarSymbol::Literal,
                expansions: vec![
                    "1".to_string(),
                    "0".to_string(),
                    "'a'".to_string(),
                    "NULL".to_string(),
                    "TRUE".to_string(),
                    "FALSE".to_string(),
                ],
            },
            ProductionRule {
                symbol: GrammarSymbol::ClauseComment,
                expansions: vec![
                    "-- -".to_string(),
                    "/* comment */".to_string(),
                    "#".to_string(),
                ],
            },
        ]
    }
}
