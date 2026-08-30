"""
Differential Security Engine - Data Models and Enums
Module: research.prototypes.differential_security_engine.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import uuid
import time


class DifferentialAxis(str, Enum):
    BASELINE_VS_MUTATED = "BASELINE_VS_MUTATED"         # Input injection detection
    ROLE_A_VS_ROLE_B = "ROLE_A_VS_ROLE_B"               # Horizontal privilege escalation (IDOR / BOLA)
    AUTHENTICATED_VS_ANONYMOUS = "AUTH_VS_ANON"         # Vertical privilege escalation / BFLA
    HTTP1_VS_HTTP2 = "HTTP1_VS_HTTP2"                   # Protocol differential / desync
    PROXY_VS_ORIGIN = "PROXY_VS_ORIGIN"                 # Smuggling boundary differential


@dataclass
class ResponseSnapshot:
    """Snapshot of a single HTTP response."""
    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    body: str = ""
    latency_ms: float = 0.0
    timestamp: float = field(default_factory=time.time)

    @property
    def body_length(self) -> int:
        return len(self.body.encode("utf-8"))


@dataclass
class LatencyDistribution:
    """Latency sample population for statistical significance testing."""
    samples: List[float] = field(default_factory=list)

    @property
    def mean(self) -> float:
        return sum(self.samples) / len(self.samples) if self.samples else 0.0

    @property
    def variance(self) -> float:
        if len(self.samples) < 2:
            return 0.0
        m = self.mean
        return sum((x - m) ** 2 for x in self.samples) / (len(self.samples) - 1)

    @property
    def std_dev(self) -> float:
        import math
        return math.sqrt(self.variance)


@dataclass
class DivergenceResult:
    """
    Comprehensive multi-dimensional divergence analysis outcome.
    """
    axis: DifferentialAxis
    divergence_score: float = 0.0         # Normalized in [0.0, 1.0], where 1.0 = completely divergent
    status_code_diverged: bool = False
    body_length_delta: int = 0
    ast_jaccard_similarity: float = 1.0   # 1.0 = identical, 0.0 = completely different
    token_distance: float = 0.0
    latency_welch_t_stat: Optional[float] = None
    latency_welch_p_value: Optional[float] = None
    is_statistically_significant: bool = False
    masked_volatile_tokens_count: int = 0
    finding_verdict: str = "BENIGN"       # BENIGN, POTENTIAL_ANOMALY, CONFIRMED_VULNERABILITY
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "axis": self.axis.value,
            "divergence_score": round(self.divergence_score, 4),
            "status_code_diverged": self.status_code_diverged,
            "body_length_delta": self.body_length_delta,
            "ast_jaccard_similarity": round(self.ast_jaccard_similarity, 4),
            "token_distance": round(self.token_distance, 4),
            "latency_welch_t_stat": round(self.latency_welch_t_stat, 4) if self.latency_welch_t_stat is not None else None,
            "latency_welch_p_value": round(self.latency_welch_p_value, 6) if self.latency_welch_p_value is not None else None,
            "is_statistically_significant": self.is_statistically_significant,
            "masked_volatile_tokens_count": self.masked_volatile_tokens_count,
            "finding_verdict": self.finding_verdict,
            "details": self.details,
        }
