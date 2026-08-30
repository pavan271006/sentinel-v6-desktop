"""
State Machine Inference Prototype - Inference Engine
Module: research.theory_lab.state_machine_inference.inferencer
"""

from collections import defaultdict, deque
from typing import Dict, List, Set, Optional, Tuple
from research.theory_lab.state_machine_inference.models import (
    StateType,
    TransitionEvent,
    StateTransition,
    StateAnomaly,
    InferredFSM,
)


class StateMachineInferencer:
    """
    Infers application state machines from HTTP/API interaction traces, builds an InferredFSM,
    and detects state-skipping and illegal state transitions (e.g. bypassing payment or MFA).
    """

    def __init__(self):
        self.fsm = InferredFSM()
        self.anomalies: List[StateAnomaly] = []
        self._transition_matrix: Dict[Tuple[str, str, str], str] = {} # (source, method, endpoint) -> target

    def register_trace(self, session_id: str, events: List[TransitionEvent]):
        """
        Passive trace ingestion: infers states and transitions from sequential session traces.
        """
        current_state = "UNAUTHENTICATED"
        self.fsm.states.add(current_state)

        for event in events:
            next_state = self._infer_next_state(current_state, event)
            self.fsm.states.add(next_state)

            # Record transition
            transition = StateTransition(
                source_state=current_state,
                target_state=next_state,
                event=event,
            )
            self.fsm.transitions.append(transition)
            self._transition_matrix[(current_state, event.method, event.endpoint)] = next_state
            current_state = next_state

        self.recompute_reachability()

    def _infer_next_state(self, current_state: str, event: TransitionEvent) -> str:
        """Heuristic bisimulation partitioner based on endpoint and response signature."""
        endpoint = event.endpoint.lower()
        if "login" in endpoint and event.status_code == 200:
            return "MFA_PENDING" if "mfa" in event.response_signature else "AUTHENTICATED_USER"
        elif "mfa/verify" in endpoint and event.status_code == 200:
            return "AUTHENTICATED_USER"
        elif "kyc/submit" in endpoint and event.status_code == 200:
            return "KYC_PENDING"
        elif "kyc/approve" in endpoint and event.status_code == 200:
            return "KYC_APPROVED"
        elif "checkout/stage" in endpoint and event.status_code == 200:
            return "CHECKOUT_STAGED"
        elif "payment/charge" in endpoint and event.status_code == 200:
            return "PAYMENT_AUTHORIZED"
        elif "order/finalize" in endpoint and event.status_code == 200:
            return "ORDER_COMPLETED"
        elif event.status_code in [401, 403]:
            return current_state # Access denied, state remains unchanged
        
        # Default next state
        return f"STATE_{event.endpoint.replace('/', '_').strip('_')}"

    def recompute_reachability(self):
        """Computes all-pairs state reachability matrix via BFS."""
        adj: Dict[str, Set[str]] = defaultdict(set)
        for t in self.fsm.transitions:
            adj[t.source_state].add(t.target_state)

        self.fsm.state_reachability = {}
        for state in self.fsm.states:
            visited = set()
            queue = deque([state])
            while queue:
                curr = queue.popleft()
                for neighbor in adj.get(curr, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            self.fsm.state_reachability[state] = visited

    def test_state_skipping_vulnerability(
        self,
        starting_state: str,
        target_state: str,
        skipped_mandatory_state: str,
        jump_event: TransitionEvent
    ) -> Optional[StateAnomaly]:
        """
        Active Falsification Test:
        Attempts to transition directly from starting_state to target_state without traversing skipped_mandatory_state.
        If jump_event returns 200 OK and modifies server state, a critical state-skipping flaw is confirmed.
        """
        if jump_event.status_code in [200, 201, 202]:
            anomaly = StateAnomaly(
                anomaly_id=f"STATE-SKIP-{len(self.anomalies)+1}",
                anomaly_type="STATE_SKIPPING",
                source_state=starting_state,
                target_state=target_state,
                trigger_event=jump_event,
                severity="CRITICAL",
                description=(
                    f"State machine flaw: Successfully transitioned from {starting_state} to {target_state} "
                    f"via {jump_event.method} {jump_event.endpoint}, bypassing mandatory verification state '{skipped_mandatory_state}'!"
                ),
            )
            self.anomalies.append(anomaly)
            return anomaly
        return None
