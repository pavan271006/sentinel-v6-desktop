//! Sentinel Interceptor Pipeline Subsystem

pub mod builtin;
pub mod interceptor;
pub mod rules;

use parking_lot::RwLock;
use std::sync::Arc;

use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{InterceptRule, ParsedRequest, ParsedResponse};

pub use builtin::RuleEngineInterceptor;
pub use interceptor::{AsyncProxyInterceptor, InterceptAction, RequestContext, WsFrame};
pub use rules::{CompiledAction, CompiledInterceptRule, ConditionMatcher};

/// Pipeline orchestrator managing all registered interceptors and rules.
#[derive(Clone)]
pub struct InterceptorPipeline {
    interceptors: Arc<RwLock<Vec<Arc<dyn AsyncProxyInterceptor>>>>,
    rules: Arc<RwLock<Vec<CompiledInterceptRule>>>,
}

impl Default for InterceptorPipeline {
    fn default() -> Self {
        Self::new()
    }
}

impl InterceptorPipeline {
    pub fn new() -> Self {
        let rules = Arc::new(RwLock::new(Vec::new()));
        let rule_interceptor = Arc::new(RuleEngineInterceptor::new(rules.clone()));

        Self {
            interceptors: Arc::new(RwLock::new(vec![rule_interceptor])),
            rules,
        }
    }

    /// Registers a custom interceptor.
    pub fn register(&self, interceptor: Arc<dyn AsyncProxyInterceptor>) {
        self.interceptors.write().push(interceptor);
    }

    /// Updates dynamic intercept rules with atomic replacement.
    pub fn set_rules(&self, new_rules: Vec<InterceptRule>) {
        let compiled: Vec<CompiledInterceptRule> = new_rules
            .iter()
            .map(CompiledInterceptRule::compile)
            .collect();
        *self.rules.write() = compiled;
    }

    /// Executes all registered interceptors sequentially on incoming request.
    pub async fn execute_on_request(
        &self,
        req: &mut ParsedRequest,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        let interceptors = self.interceptors.read().clone();
        for interceptor in interceptors {
            let action = interceptor.on_request(req, ctx).await?;
            match action {
                InterceptAction::Continue | InterceptAction::Modified => {}
                InterceptAction::Drop { .. } | InterceptAction::RespondWith(_) => {
                    return Ok(action)
                }
            }
        }
        Ok(InterceptAction::Continue)
    }

    /// Executes all registered interceptors sequentially on incoming response.
    pub async fn execute_on_response(
        &self,
        req: &ParsedRequest,
        res: &mut ParsedResponse,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        let interceptors = self.interceptors.read().clone();
        for interceptor in interceptors {
            let action = interceptor.on_response(req, res, ctx).await?;
            match action {
                InterceptAction::Continue | InterceptAction::Modified => {}
                InterceptAction::Drop { .. } | InterceptAction::RespondWith(_) => {
                    return Ok(action)
                }
            }
        }
        Ok(InterceptAction::Continue)
    }

    /// Executes all registered interceptors on WebSocket frame.
    pub async fn execute_on_ws_frame(
        &self,
        frame: &mut WsFrame,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        let interceptors = self.interceptors.read().clone();
        for interceptor in interceptors {
            let action = interceptor.on_ws_frame(frame, ctx).await?;
            match action {
                InterceptAction::Continue | InterceptAction::Modified => {}
                InterceptAction::Drop { .. } | InterceptAction::RespondWith(_) => {
                    return Ok(action)
                }
            }
        }
        Ok(InterceptAction::Continue)
    }
}
