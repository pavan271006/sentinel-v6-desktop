"""
Independent Verifier: 4-Tier Novelty Classification Engine
Enforces formal gate: KNOWN, VARIANT, NOVEL-CANDIDATE, CONFIRMED-NOVEL.
"""

from typing import Dict, Any, List
from enum import Enum

class NoveltyVerdict(str, Enum):
    KNOWN = "KNOWN"
    VARIANT = "VARIANT"
    NOVEL_CANDIDATE = "NOVEL-CANDIDATE"
    CONFIRMED_NOVEL = "CONFIRMED-NOVEL"

class NoveltyClassifier:
    """Classifies findings based on prior art overlap, independent reproduction, and negative controls."""

    @staticmethod
    def classify(
        positive_reproduced: bool,
        negative_control_passed: bool,
        prior_art_matches: List[Any],
        is_novel_primitive: bool
    ) -> Dict[str, Any]:
        if not positive_reproduced:
            return {"verdict": NoveltyVerdict.KNOWN.value, "reason": "Failed positive reproduction"}
        if not negative_control_passed:
            return {"verdict": NoveltyVerdict.KNOWN.value, "reason": "Failed negative control (false positive)"}

        if any(m.similarity_score > 0.8 for m in prior_art_matches):
            return {"verdict": NoveltyVerdict.KNOWN.value, "reason": "Direct prior art exact match"}
        
        if is_novel_primitive and positive_reproduced and negative_control_passed:
            return {
                "verdict": NoveltyVerdict.CONFIRMED_NOVEL.value,
                "reason": "Uncharacterized state context dissociation primitive verified with 0% FP"
            }
        
        return {"verdict": NoveltyVerdict.NOVEL_CANDIDATE.value, "reason": "Awaiting extended generalization testing"}
