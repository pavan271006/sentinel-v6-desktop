"""
Differential Security Engine - Data Models and Enums
Module: research.theory_lab.differential_engine.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any


class DifferentialAxis(str, Enum):
    ROLE_A_VS_ROLE_B = "ROLE_A_VS_ROLE_B"                         # Horizontal privilege isolation (BOLA/IDOR)
    AUTHENTICATED_VS_ANONYMOUS = "AUTHENTICATED_VS_ANONYMOUS"     # Vertical privilege isolation (BFLA)
    BASELINE_VS_MUTATED = "BASELINE_VS_MUTATED"                   # Injection & behavioral anomaly detection
    HTTP1_VS_HTTP2 = "HTTP1_VS_HTTP2"                             # Protocol translation discrepancies
    ORIGIN_VS_PROXY_CACHE = "ORIGIN_VS_PROXY_CACHE"               # Cache poisoning / desynchronization


@dataclass
class ResponseSnapshot:
    """Represents a captured HTTP response for differential analysis."""
    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    body: str = ""
    latency_ms: float = 0.0
    content_type: str = "application/json"
    session_id: Optional[str] = None

    @property
    def body_bytes_len(self) -> int:
        return len(self.body.encode("utf-8"))


@dataclass
class LatencyDistribution:
    """Statistical container for latency timing measurements."""
    samples: List[float] = field(default_factory=list)

    @property
    def sample_count(self) -> int:
        return len(self.samples)

    @property
    def mean(self) -> float:
        if not self.samples:
            return 0.0
        return sum(self.samples) / len(self.samples)

    @property
    def variance(self) -> float:
        if len(self.samples) < 2:
            return 0.0
        m = self.mean
        return sum((x - m) ** 2 for x in self.samples) / (len(self.samples) - 1)


@dataclass
class DivergenceResult:
    """Detailed output of differential security analysis."""
    axis: DifferentialAxis
    divergence_score: float                        # Composite metric in [0.0, 1.0]
    status_code_diverged: bool
    body_length_delta: int
    ast_jaccard_similarity: float                 # Structural similarity in [0.0, 1.0]
    token_distance: float                         # 1.0 - AST Jaccard
    latency_welch_t_stat: Optional[float] = None
    latency_welch_p_value: Optional[float] = None
    is_statistically_significant: bool = False
    masked_volatile_tokens_count: int = 0
    finding_verdict: str = "BENIGN"               # "CONFIRMED_VULNERABILITY", "POTENTIAL_ANOMALY", "BENIGN"
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "axis": self.axis.value,
            "divergence_score": self.divergence_score,
            "status_code_diverged": self.status_code_diverged,
            "body_length_delta": self.body_length_delta,
            "ast_jaccard_similarity": self.ast_jaccard_similarity,
            "token_distance": self.token_distance,
            "latency_welch_t_stat": self.latency_welch_t_stat,
            "latency_welch_p_value": self.latency_welch_p_value,
            "is_statistically_significant": self.is_statistically_significant,
            "masked_volatile_tokens_count": self.masked_volatile_tokens_count,
            "finding_verdict": self.finding_verdict,
            "details": self.details,
        }
