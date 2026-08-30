//! Default Fuzzer Engine Implementation

use std::sync::Arc;

use async_trait::async_trait;

use sentinel_bus::ChannelEventBus;
use sentinel_common::domain::core::Transaction;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{FuzzProfile, FuzzStream};
use sentinel_common::traits::{FuzzerEngine, ScopeEngine};
use sentinel_dispatch::{DispatchResult, HttpDispatcher};
use sentinel_scope::DefaultScopeEngine;

use crate::mutators::FuzzMutator;
use crate::type_aware::TypeAwareFuzzer;

pub struct DefaultFuzzerEngine {
    scope_engine: Option<Arc<DefaultScopeEngine>>,
    event_bus: Option<Arc<ChannelEventBus>>,
    dispatcher: Option<Arc<HttpDispatcher>>,
}

impl DefaultFuzzerEngine {
    pub fn new() -> Self {
        Self {
            scope_engine: None,
            event_bus: None,
            dispatcher: None,
        }
    }

    pub fn with_scope_engine(mut self, scope: Arc<DefaultScopeEngine>) -> Self {
        self.scope_engine = Some(scope);
        self
    }

    pub fn with_event_bus(mut self, bus: Arc<ChannelEventBus>) -> Self {
        self.event_bus = Some(bus);
        self
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<HttpDispatcher>) -> Self {
        self.dispatcher = Some(dispatcher);
        self
    }

    pub fn generate_mutations(&self, seed: &[u8], profile: &FuzzProfile) -> Vec<Vec<u8>> {
        let mut results = Vec::new();
        for &mutator in &profile.mutators {
            let mut list = FuzzMutator::mutate(seed, mutator);
            results.append(&mut list);
        }
        results
    }

    /// Executes a live fuzzing campaign by generating mutations and dispatching them over the network.
    pub async fn execute_fuzz_campaign(
        &self,
        target_url: &str,
        seed_request: &[u8],
        profile: &FuzzProfile,
        concurrency: usize,
    ) -> Result<Vec<DispatchResult>, SentinelError> {
        let dispatcher = self.dispatcher.as_ref().ok_or_else(|| {
            SentinelError::InvalidConfiguration("HttpDispatcher not configured on FuzzerEngine".to_string())
        })?;

        // 1. Generate standard binary mutations
        let mut mutations = self.generate_mutations(seed_request, profile);

        // 2. If seed contains JSON, generate schema-aware AST mutations
        if let Ok(seed_str) = std::str::from_utf8(seed_request) {
            if let Some(json_start) = seed_str.find('{') {
                let json_slice = &seed_str[json_start..];
                let json_mutations = TypeAwareFuzzer::mutate_json(json_slice);
                for jm in json_mutations {
                    let mut full_req = seed_str[..json_start].to_string();
                    full_req.push_str(&jm);
                    mutations.push(full_req.into_bytes());
                }
            }
        }

        // 3. Batch dispatch mutations with bounded concurrency
        let requests: Vec<(String, Vec<u8>, u32)> = mutations
            .into_iter()
            .map(|m| (target_url.to_string(), m, 1))
            .collect();

        let batch_results = dispatcher.dispatch_batch(requests, concurrency).await;
        let successful: Vec<DispatchResult> = batch_results.into_iter().filter_map(|r| r.ok()).collect();

        Ok(successful)
    }
}

impl Default for DefaultFuzzerEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl FuzzerEngine for DefaultFuzzerEngine {
    async fn fuzz(
        &self,
        seed: &Transaction,
        profile: &FuzzProfile,
    ) -> Result<FuzzStream, SentinelError> {
        // SEC-01: Scope validation on target URI
        if let Some(scope) = &self.scope_engine {
            let target_url = &seed.request.parsed.uri;
            let decision = scope.is_in_scope(target_url);
            if !decision.allowed {
                return Err(SentinelError::ScopeViolation {
                    reason: format!("Fuzz target '{}' is out of scope", target_url),
                });
            }
        }

        // Generate mutator payloads for all insertion points
        let raw_body = seed.request.normalized_text.as_bytes();
        let _mutations = self.generate_mutations(raw_body, profile);

        Ok(FuzzStream {})
    }
}
