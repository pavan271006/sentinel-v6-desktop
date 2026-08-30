"""
Differential Security Engine Module - Theory Lab
Module: research.theory_lab.differential_engine
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
from .v0_baseline import V0RawByteDiff
from .v1_ast_masking import V1ASTMaskingEngine
from .v2_composite import V2CompositeDifferentialEngine

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
    "V0RawByteDiff",
    "V1ASTMaskingEngine",
    "V2CompositeDifferentialEngine",
]
