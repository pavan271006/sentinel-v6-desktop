"""
GitLab Community Edition Security Research Lab - Verifier Package
=================================================================
Independent clean-room dual-role verification engine, negative controls,
and cryptographic CAS evidence recording.
"""

from .cas_evidence_vault import CASEvidenceVault
from .clean_room_verifier import CleanRoomVerifier, CleanRoomVerifierSimulator
from .negative_controls import NegativeControlTester

__all__ = [
    "CASEvidenceVault",
    "CleanRoomVerifier",
    "CleanRoomVerifierSimulator",
    "NegativeControlTester",
]
