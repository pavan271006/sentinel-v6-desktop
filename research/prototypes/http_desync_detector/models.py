"""
HTTP Desync & Smuggling Detector - Data Models and Enums
Module: research.prototypes.http_desync_detector.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
import uuid
import time


class DesyncVectorType(str, Enum):
    CL_TE = "CL_TE"                 # Frontend uses Content-Length, Backend uses Transfer-Encoding
    TE_CL = "TE_CL"                 # Frontend uses Transfer-Encoding, Backend uses Content-Length
    TE_TE_OBFUSCATED = "TE_TE_OBFUSCATED" # Obfuscated TE header (e.g., Transfer-Encoding: xchunked)
    H2_CL = "H2_CL"                 # HTTP/2 frontend downgrades with Content-Length to HTTP/1.1 backend
    H2_TE = "H2_TE"                 # HTTP/2 frontend downgrades with Transfer-Encoding to HTTP/1.1 backend


class ProbeMethod(str, Enum):
    TIMEOUT_HANG = "TIMEOUT_HANG"   # Non-destructive timeout detection
    DIFFERENTIAL_PREFIX = "DIFFERENTIAL_PREFIX" # Smuggled prefix attacking secondary request
    SINGLE_PACKET_SYNC = "SINGLE_PACKET_SYNC"   # HTTP/2 single-packet synchronization


@dataclass
class DesyncProbe:
    """
    Constructed raw byte or frame payload for a specific desync probe vector.
    """
    vector_type: DesyncVectorType
    probe_method: ProbeMethod
    raw_payload: bytes
    expected_timeout_threshold_ms: float = 4000.0
    prefix_canary: str = ""
    description: str = ""


@dataclass
class ProbeResponseObservation:
    """
    Observed network behavior when dispatching a desync probe.
    """
    status_code: Optional[int] = None
    response_body: bytes = b""
    elapsed_time_ms: float = 0.0
    connection_closed_by_server: bool = False
    socket_timeout_triggered: bool = False
    secondary_response_status: Optional[int] = None
    secondary_response_body: bytes = b""


@dataclass
class SmugglingDetectionResult:
    """
    Diagnostic assessment of target smuggling/desync vulnerability.
    """
    vector_type: DesyncVectorType
    is_vulnerable: bool = False
    confidence: float = 0.0         # 0.0 to 1.0
    evidence_type: str = "NONE"     # TIMEOUT_INDUCED, PREFIX_LEAK, STATUS_ANOMALY, NONE
    diagnostic_details: Dict[str, Any] = field(default_factory=dict)
    remediation_recommendation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "vector_type": self.vector_type.value,
            "is_vulnerable": self.is_vulnerable,
            "confidence": round(self.confidence, 4),
            "evidence_type": self.evidence_type,
            "diagnostic_details": self.diagnostic_details,
            "remediation_recommendation": self.remediation_recommendation,
        }
