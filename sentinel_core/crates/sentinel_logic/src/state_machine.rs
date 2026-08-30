//! State Machine Transition Graph & Multi-Actor Invariant Validator
//!
//! Models multi-actor state transitions (Admin, Merchant, User, Anonymous) and
//! asserts invariant boundaries (e.g. verifying that Low-Privilege / Anonymous actors
//! cannot bypass intermediate stages or transition directly into privileged states).

use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ActorRole {
    Admin,
    Merchant,
    User(String), // tenant/user id
    Anonymous,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: String,
    pub to: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiActorTransition {
    pub from_state: String,
    pub to_state: String,
    pub action: String,
    pub allowed_roles: Vec<ActorRole>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvariantViolationFinding {
    pub actor: ActorRole,
    pub attempted_from: String,
    pub attempted_to: String,
    pub description: String,
}

pub struct StateMachineEngine {
    valid_transitions: HashSet<(String, String)>,
    multi_actor_transitions: Vec<MultiActorTransition>,
    current_state: String,
    current_actor: ActorRole,
}

impl StateMachineEngine {
    pub fn new(initial_state: &str) -> Self {
        Self {
            valid_transitions: HashSet::new(),
            multi_actor_transitions: Vec::new(),
            current_state: initial_state.to_string(),
            current_actor: ActorRole::Anonymous,
        }
    }

    pub fn with_actor(mut self, actor: ActorRole) -> Self {
        self.current_actor = actor;
        self
    }

    pub fn set_actor(&mut self, actor: ActorRole) {
        self.current_actor = actor;
    }

    pub fn add_allowed_transition(&mut self, from: &str, to: &str) {
        self.valid_transitions
            .insert((from.to_string(), to.to_string()));
    }

    pub fn add_guarded_transition(
        &mut self,
        from_state: &str,
        to_state: &str,
        action: &str,
        allowed_roles: Vec<ActorRole>,
    ) {
        self.valid_transitions
            .insert((from_state.to_string(), to_state.to_string()));
        self.multi_actor_transitions.push(MultiActorTransition {
            from_state: from_state.to_string(),
            to_state: to_state.to_string(),
            action: action.to_string(),
            allowed_roles,
        });
    }

    pub fn current_state(&self) -> &str {
        &self.current_state
    }

    pub fn current_actor(&self) -> &ActorRole {
        &self.current_actor
    }

    pub fn transition(&mut self, next_state: &str) -> Result<(), SentinelError> {
        let pair = (self.current_state.clone(), next_state.to_string());
        if !self.valid_transitions.contains(&pair) {
            return Err(SentinelError::InvariantViolation(format!(
                "Illegal state transition from '{}' to '{}'",
                self.current_state, next_state
            )));
        }

        // Check multi-actor role permissions if guarded
        if let Some(guarded) = self.multi_actor_transitions.iter().find(|t| {
            t.from_state == self.current_state && t.to_state == next_state
        }) {
            let role_allowed = guarded.allowed_roles.iter().any(|r| {
                matches!(
                    (r, &self.current_actor),
                    (ActorRole::Admin, ActorRole::Admin)
                        | (ActorRole::Merchant, ActorRole::Merchant)
                        | (ActorRole::Anonymous, ActorRole::Anonymous)
                        | (ActorRole::User(_), ActorRole::User(_))
                )
            });

            if !role_allowed {
                return Err(SentinelError::auth_error(format!(
                    "Role '{:?}' is not authorized to execute transition '{}' -> '{}'",
                    self.current_actor, self.current_state, next_state
                )));
            }
        }

        self.current_state = next_state.to_string();
        Ok(())
    }

    /// Explores state transitions to find unreachable or privilege-escalating paths
    pub fn check_unauthorized_reachability(
        &self,
        actor: &ActorRole,
        target_privileged_state: &str,
    ) -> Option<InvariantViolationFinding> {
        let mut visited = HashSet::new();
        let mut queue = vec![self.current_state.clone()];

        while let Some(state) = queue.pop() {
            if state == target_privileged_state {
                return Some(InvariantViolationFinding {
                    actor: actor.clone(),
                    attempted_from: self.current_state.clone(),
                    attempted_to: target_privileged_state.to_string(),
                    description: format!(
                        "Privilege State Invariant Broken: Actor '{:?}' can reach privileged state '{}' from '{}'.",
                        actor, target_privileged_state, self.current_state
                    ),
                });
            }

            if visited.insert(state.clone()) {
                for t in &self.multi_actor_transitions {
                    if t.from_state == state && t.allowed_roles.contains(actor) {
                        queue.push(t.to_state.clone());
                    }
                }
            }
        }

        None
    }

    /// Automatically infers a state machine graph from observed HTTP transaction sequences
    pub fn infer_from_traffic(transactions: &[sentinel_common::domain::core::Transaction]) -> Self {
        if transactions.is_empty() {
            return Self::new("INITIAL");
        }

        let initial_state = &transactions[0].request.parsed.uri;
        let mut engine = Self::new(initial_state);

        for window in transactions.windows(2) {
            let from_uri = &window[0].request.parsed.uri;
            let to_uri = &window[1].request.parsed.uri;
            let action = format!("{} -> {}", window[0].request.parsed.method, window[1].request.parsed.method);

            // Infer role from auth header
            let has_admin_header = window[0].request.parsed.headers.iter().any(|(k, v)| {
                k.eq_ignore_ascii_case(b"authorization") && v.windows(5).any(|w| w.eq_ignore_ascii_case(b"admin"))
            });

            let roles = if has_admin_header {
                vec![ActorRole::Admin]
            } else {
                vec![ActorRole::Anonymous, ActorRole::User("inferred_user".to_string())]
            };

            engine.add_guarded_transition(from_uri, to_uri, &action, roles);
        }

        engine
    }
}
