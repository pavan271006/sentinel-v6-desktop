//! DBMS Error signature and conditional syntax crash oracle.

use serde::{Deserialize, Serialize};
use ucma_response::signatures::{DbmsErrorCatalog, DbmsErrorMatch, DbmsType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorOracleVerdict {
    pub is_vulnerable: bool,
    pub dbms_type: Option<DbmsType>,
    pub matched_signature: Option<DbmsErrorMatch>,
    pub confidence: f32,
}

pub struct ErrorOracle;

impl ErrorOracle {
    pub fn evaluate(response_body: &str) -> ErrorOracleVerdict {
        let catalog = DbmsErrorCatalog::new();
        if let Some(matched) = catalog.find_error(response_body) {
            let confidence = matched.confidence;
            let dbms_type = Some(matched.dbms);
            ErrorOracleVerdict {
                is_vulnerable: true,
                dbms_type,
                matched_signature: Some(matched),
                confidence,
            }
        } else {
            ErrorOracleVerdict {
                is_vulnerable: false,
                dbms_type: None,
                matched_signature: None,
                confidence: 0.0,
            }
        }
    }
}
