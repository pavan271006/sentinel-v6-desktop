"""
V0 Baseline: Raw Byte Diff & Status Code Comparison (Legacy V6 Baseline)
Module: research.theory_lab.differential_engine.v0_baseline
"""

from __future__ import annotations
from typing import Dict, Any, Optional
from .models import ResponseSnapshot, DifferentialAxis, DivergenceResult


class V0RawByteDiff:
    """
    Legacy V0 implementation: Compares exact raw response bytes and HTTP status codes.
    Known flaws: Fails on volatile dynamic tokens (UUIDs, timestamps, CSRF tokens),
    causing high false-positive rates (~28%) on dynamic modern web applications.
    """

    def analyze_divergence(
        self,
        baseline: ResponseSnapshot,
        candidate: ResponseSnapshot,
        axis: DifferentialAxis = DifferentialAxis.ROLE_A_VS_ROLE_B,
    ) -> DivergenceResult:
        status_diverged = (baseline.status_code != candidate.status_code)
        bytes_equal = (baseline.body == candidate.body)
        body_delta = abs(len(candidate.body.encode("utf-8")) - len(baseline.body.encode("utf-8")))

        # In V0, any difference in raw body bytes is treated as full divergence (1.0)
        div_score = 0.0 if bytes_equal and not status_diverged else 1.0

        # Naive classification
        verdict = "BENIGN"
        if status_diverged:
            verdict = "POTENTIAL_ANOMALY"
        elif not bytes_equal:
            if axis == DifferentialAxis.ROLE_A_VS_ROLE_B and candidate.status_code == 200:
                # Naive check flags any non-equal body as IDOR or discrepancy
                verdict = "POTENTIAL_ANOMALY"

        return DivergenceResult(
            axis=axis,
            divergence_score=div_score,
            status_code_diverged=status_diverged,
            body_length_delta=body_delta,
            ast_jaccard_similarity=1.0 if bytes_equal else 0.0,
            token_distance=0.0 if bytes_equal else 1.0,
            finding_verdict=verdict,
            masked_volatile_tokens_count=0,
            details={"version": "V0_RAW_BYTE_DIFF", "bytes_equal": bytes_equal},
        )
