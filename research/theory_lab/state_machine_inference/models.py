"""
State Machine Inference - Data Models and Enums
Module: research.theory_lab.state_machine_inference.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set, Tuple
import uuid
import time


class AuthStateTier(str, Enum):
    UNAUTHENTICATED = "UNAUTHENTICATED"
    PRE_AUTH_CHALLENGE = "PRE_AUTH_CHALLENGE"
    AUTHENTICATED_STANDARD = "AUTHENTICATED_STANDARD"
    ELEVATED_PRIVILEGE = "ELEVATED_PRIVILEGE"
    SESSION_EXPIRED_REVOKED = "SESSION_EXPIRED_REVOKED"


class StateVulnType(str, Enum):
    OUT_OF_ORDER_BYPASS = "OUT_OF_ORDER_BYPASS"         # State skipping (e.g. Skip Payment / Skip MFA)
    STATE_CONFUSION_PRIVILEGE = "STATE_CONFUSION_PRIVILEGE" # Role swapped mid-workflow
    RACE_TRIGGERED_STATE_FORK = "RACE_TRIGGERED_STATE_FORK" # Parallel transitions double-spend
    BROKEN_SESSION_LIFECYCLE = "BROKEN_SESSION_LIFECYCLE"   # Operation allowed in REVOKED state


@dataclass
class TraceAction:
    """A single HTTP action in a sequence trace."""
    method: str
    endpoint: str
    parameter_keys: List[str] = field(default_factory=list)
    status_code: int = 200
    response_signature: str = ""
    session_id: str = "default_session"
    timestamp: float = field(default_factory=time.time)

    @property
    def action_key(self) -> str:
        return f"{self.method.upper()} {self.endpoint}"

    def to_symbol(self) -> str:
        return f"{self.action_key}:{self.status_code}"


@dataclass
class StateNode:
    """A state in the inferred Mealy machine."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "State_0"
    auth_tier: AuthStateTier = AuthStateTier.UNAUTHENTICATED
    is_initial: bool = False
    is_terminal: bool = False
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StateTransition:
    """A directed transition between application states."""
    from_state: str
    to_state: str
    action_symbol: str
    expected_output: str = "200"
    probability: float = 1.0
    is_authorized: bool = True


@dataclass
class StateVulnerability:
    """Detected state-machine workflow vulnerability."""
    vuln_type: StateVulnType
    title: str
    severity: str
    description: str
    violating_transition_chain: List[str]
    evidence_proof: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "vuln_type": self.vuln_type.value,
            "title": self.title,
            "severity": self.severity,
            "description": self.description,
            "violating_transition_chain": self.violating_transition_chain,
            "evidence_proof": self.evidence_proof,
        }
