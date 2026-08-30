//! Built-in Interceptors

use async_trait::async_trait;
use parking_lot::RwLock;
use std::sync::Arc;

use crate::pipeline::interceptor::{AsyncProxyInterceptor, InterceptAction, RequestContext};
use crate::pipeline::rules::CompiledInterceptRule;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};

/// Built-in interceptor that evaluates dynamic `InterceptRule` matchers.
pub struct RuleEngineInterceptor {
    rules: Arc<RwLock<Vec<CompiledInterceptRule>>>,
}

impl RuleEngineInterceptor {
    pub fn new(rules: Arc<RwLock<Vec<CompiledInterceptRule>>>) -> Self {
        Self { rules }
    }
}

#[async_trait]
impl AsyncProxyInterceptor for RuleEngineInterceptor {
    async fn on_request(
        &self,
        req: &mut ParsedRequest,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        let rules = self.rules.read();
        for rule in rules.iter().filter(|r| r.is_active) {
            if rule.matcher.matches_request(req) {
                let action = rule.action.apply_to_request(req);
                if action != InterceptAction::Continue {
                    return Ok(action);
                }
            }
        }
        Ok(InterceptAction::Continue)
    }

    async fn on_response(
        &self,
        _req: &ParsedRequest,
        res: &mut ParsedResponse,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        let rules = self.rules.read();
        let mut any_modified = false;
        for rule in rules.iter().filter(|r| r.is_active) {
            if rule.matcher.matches_response(res) {
                let action = rule.action.apply_to_response(res);
                match action {
                    InterceptAction::Continue => {}
                    InterceptAction::Modified => {
                        any_modified = true;
                    }
                    InterceptAction::Drop { .. } | InterceptAction::RespondWith(_) => {
                        return Ok(action);
                    }
                }
            }
        }
        if any_modified {
            Ok(InterceptAction::Modified)
        } else {
            Ok(InterceptAction::Continue)
        }
    }
}
