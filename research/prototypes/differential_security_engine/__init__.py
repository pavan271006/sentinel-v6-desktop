"""
Differential Security Engine Prototype
"""

from .models import (
    DifferentialAxis,
    ResponseSnapshot,
    LatencyDistribution,
    DivergenceResult,
)
from .engine import (
    DifferentialSecurityEngine,
    compute_token_shannon_entropy,
    mask_volatile_tokens,
    extract_structural_tokens,
    compute_jaccard_similarity,
    welch_t_test,
)

__all__ = [
    "DifferentialAxis",
    "ResponseSnapshot",
    "LatencyDistribution",
    "DivergenceResult",
    "DifferentialSecurityEngine",
    "compute_token_shannon_entropy",
    "mask_volatile_tokens",
    "extract_structural_tokens",
    "compute_jaccard_similarity",
    "welch_t_test",
]
