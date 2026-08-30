//! Default ContextEngine Implementation

use async_trait::async_trait;

use sentinel_common::domain::core::Transaction;
use sentinel_common::enums::ParameterClass;
use sentinel_common::operational::TechFingerprint;
use sentinel_common::traits::ContextEngine;

use crate::classifier::ParameterClassifier;
use crate::fingerprint::TechDetector;

#[derive(Debug, Default, Clone)]
pub struct DefaultContextEngine;

impl DefaultContextEngine {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ContextEngine for DefaultContextEngine {
    fn fingerprint(&self, transaction: &Transaction) -> Vec<TechFingerprint> {
        TechDetector::detect_from_transaction(transaction)
    }

    fn classify_parameter(&self, name: &str, value: &str) -> ParameterClass {
        ParameterClassifier::classify(name, value)
    }
}
