"""
Research Engine: Security Context & State Graph Model
Tracks identities, tenants, roles, sessions, resources, and state transition invariants.
"""

from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field

@dataclass
class IdentityContext:
    username: str
    tenant_id: str
    role: str
    token: str

@dataclass
class StateNode:
    entity_id: str
    tenant_id: str
    current_state: str
    context_lock: Optional[str]
    version_id: int = 1

class SecurityContextModel:
    """Maintains active identity sessions, resource mappings, and state graphs."""

    def __init__(self):
        self.identities: Dict[str, IdentityContext] = {}
        self.state_nodes: Dict[str, StateNode] = {}
        self.recorded_anomalies: List[Dict[str, Any]] = []

    def register_identity(self, username: str, tenant_id: str, role: str, token: str):
        self.identities[username] = IdentityContext(username, tenant_id, role, token)

    def record_state(self, entity_id: str, tenant_id: str, state: str, lock: Optional[str], version: int = 1):
        self.state_nodes[entity_id] = StateNode(entity_id, tenant_id, state, lock, version)

    def check_tenant_invariant(self, entity_id: str, requesting_tenant: str) -> bool:
        node = self.state_nodes.get(entity_id)
        if not node:
            return True
        return node.tenant_id == requesting_tenant
