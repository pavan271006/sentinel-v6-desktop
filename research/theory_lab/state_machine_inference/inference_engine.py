"""
State Machine Inference Engine - Passive k-Tails & Vulnerability Detection
Module: research.theory_lab.state_machine_inference.inference_engine
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict, deque
import uuid

from .models import (
    AuthStateTier,
    StateVulnType,
    TraceAction,
    StateNode,
    StateTransition,
    StateVulnerability,
)


class InferredMealyMachine:
    """
    Finite State Transducer / Mealy Machine representing inferred application states and transitions.
    """

    def __init__(self):
        self.states: Dict[str, StateNode] = {}
        # transitions: from_state_id -> action_symbol -> (to_state_id, expected_output)
        self.transitions: Dict[str, Dict[str, Tuple[str, str]]] = defaultdict(dict)
        self.initial_state_id: Optional[str] = None

    def add_state(self, state: StateNode) -> str:
        self.states[state.id] = state
        if state.is_initial:
            self.initial_state_id = state.id
        return state.id

    def add_transition(self, from_id: str, to_id: str, symbol: str, output: str = "200"):
        self.transitions[from_id][symbol] = (to_id, output)

    def get_transition(self, from_id: str, symbol: str) -> Optional[Tuple[str, str]]:
        return self.transitions.get(from_id, {}).get(symbol)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "states": {sid: s.name for sid, s in self.states.items()},
            "initial_state": self.initial_state_id,
            "transition_count": sum(len(t) for t in self.transitions.values()),
        }


class KTailsLearner:
    """
    Passive automata inference using the k-Tails state-merging algorithm.
    """

    def __init__(self, k: int = 2):
        self.k = k

    def infer_from_traces(self, traces: List[List[TraceAction]]) -> InferredMealyMachine:
        """
        Builds a Prefix Tree Acceptor (PTA) from traces, then merges states sharing identical k-tails.
        """
        fsm = InferredMealyMachine()
        root = StateNode(name="Q_ROOT", is_initial=True)
        fsm.add_state(root)

        # 1. Build PTA (Prefix Tree Acceptor)
        # state_id -> symbol -> target_state_id
        tree_edges: Dict[str, Dict[str, str]] = defaultdict(dict)
        
        for trace in traces:
            curr_state_id = root.id
            for action in trace:
                sym = action.to_symbol()
                if sym in tree_edges[curr_state_id]:
                    curr_state_id = tree_edges[curr_state_id][sym]
                else:
                    new_node = StateNode(name=f"Q_{len(fsm.states)}")
                    fsm.add_state(new_node)
                    tree_edges[curr_state_id][sym] = new_node.id
                    fsm.add_transition(curr_state_id, new_node.id, sym, str(action.status_code))
                    curr_state_id = new_node.id

        # 2. Compute k-tails for every state in PTA
        def get_k_tails(state_id: str, depth: int) -> Set[Tuple[str, ...]]:
            if depth == 0:
                return {()}
            tails: Set[Tuple[str, ...]] = set()
            for sym, (nxt_id, _) in fsm.transitions.get(state_id, {}).items():
                sub_tails = get_k_tails(nxt_id, depth - 1)
                for st in sub_tails:
                    tails.add((sym,) + st)
            return tails

        # Map state -> k-tails set
        state_tails: Dict[str, Set[Tuple[str, ...]]] = {}
        for sid in list(fsm.states.keys()):
            state_tails[sid] = get_k_tails(sid, self.k)

        # 3. Merge Equivalent States
        # Equivalence relation: state_tails[u] == state_tails[v]
        merged_parent: Dict[str, str] = {sid: sid for sid in fsm.states}

        def find(u: str) -> str:
            if merged_parent[u] != u:
                merged_parent[u] = find(merged_parent[u])
            return merged_parent[u]

        def union(u: str, v: str):
            ru = find(u)
            rv = find(v)
            if ru != rv:
                merged_parent[ru] = rv

        state_list = list(fsm.states.keys())
        for i in range(len(state_list)):
            for j in range(i + 1, len(state_list)):
                s1, s2 = state_list[i], state_list[j]
                # Non-empty identical k-tails merge
                if state_tails[s1] and state_tails[s1] == state_tails[s2]:
                    union(s1, s2)

        # 4. Construct Merged Mealy Machine
        merged_fsm = InferredMealyMachine()
        representative_map: Dict[str, StateNode] = {}

        for sid, state in fsm.states.items():
            rep = find(sid)
            if rep not in representative_map:
                is_init = (find(root.id) == rep)
                new_state = StateNode(id=rep, name=f"M_{len(representative_map)}", is_initial=is_init)
                merged_fsm.add_state(new_state)
                representative_map[rep] = new_state

        for u, trans_map in fsm.transitions.items():
            rep_u = find(u)
            for sym, (v, out) in trans_map.items():
                rep_v = find(v)
                merged_fsm.add_transition(rep_u, rep_v, sym, out)

        return merged_fsm


class AuthLifecycleInferrer:
    """
    Infers user authentication state transitions and lifecycle tiers.
    """

    @staticmethod
    def infer_action_tier(action: TraceAction) -> AuthStateTier:
        path = action.endpoint.lower()
        if "logout" in path or "revoke" in path:
            return AuthStateTier.SESSION_EXPIRED_REVOKED
        elif "login" in path or "auth" in path:
            return AuthStateTier.PRE_AUTH_CHALLENGE
        elif "mfa" in path or "2fa" in path or "elevate" in path or "admin" in path:
            return AuthStateTier.ELEVATED_PRIVILEGE
        elif "api" in path or "profile" in path or "checkout" in path:
            return AuthStateTier.AUTHENTICATED_STANDARD
        return AuthStateTier.UNAUTHENTICATED


class StateVulnerabilityDetector:
    """
    Detects business workflow bypasses, out-of-order skipping, and broken state lifecycles.
    """

    def __init__(self, machine: InferredMealyMachine):
        self.machine = machine

    def check_out_of_order_bypass(
        self,
        required_predecessor_actions: List[str],
        terminal_action: str,
        observed_response_status: int,
    ) -> Optional[StateVulnerability]:
        """
        Checks if terminal action succeeds (200 OK) when all required predecessor actions are omitted.
        """
        if observed_response_status in (200, 201, 204):
            # Target allowed terminal execution without required intermediate states!
            return StateVulnerability(
                vuln_type=StateVulnType.OUT_OF_ORDER_BYPASS,
                title=f"Out-of-Order Business Workflow Bypass: {terminal_action}",
                severity="HIGH",
                description=(
                    f"Terminal action '{terminal_action}' succeeded with HTTP {observed_response_status} "
                    f"without executing mandatory prerequisite actions: {required_predecessor_actions}."
                ),
                violating_transition_chain=[terminal_action],
                evidence_proof={
                    "terminal_action": terminal_action,
                    "skipped_predecessors": required_predecessor_actions,
                    "observed_status": observed_response_status,
                }
            )
        return None

    def check_broken_session_lifecycle(
        self,
        post_logout_action: str,
        observed_response_status: int,
    ) -> Optional[StateVulnerability]:
        """
        Checks if sensitive actions remain executable after session revocation/logout.
        """
        if observed_response_status == 200:
            return StateVulnerability(
                vuln_type=StateVulnType.BROKEN_SESSION_LIFECYCLE,
                title=f"Broken Session Lifecycle: {post_logout_action} Executable Post-Logout",
                severity="CRITICAL",
                description=(
                    f"Action '{post_logout_action}' returned HTTP 200 after explicit session logout / revocation."
                ),
                violating_transition_chain=["POST /logout", post_logout_action],
                evidence_proof={
                    "action": post_logout_action,
                    "status_code": observed_response_status,
                }
            )
        return None
