//! SENTINEL V6: Business Logic, State Machine & Race Testing Subsystem (WP-13.1)
//!
//! Provides state machine invariant tracking, multi-actor role models,
//! barrier-synchronized and HTTP/2 single-packet race condition probing,
//! and multi-step workflow recording / step-skipping permutation analysis.

pub mod race;
pub mod state_machine;
pub mod workflow;

pub use race::{RaceConditionProber, RaceSyncResult, SinglePacketAttackFrame};
pub use state_machine::{ActorRole, InvariantViolationFinding, MultiActorTransition, StateMachineEngine, StateTransition};
pub use workflow::{BusinessLogicMutation, WorkflowEngine, WorkflowPermutation};
