"""
Research Engine: Adaptive Test Planner & Scheduler
Prioritizes hypotheses based on surface match, risk profile, and resource budget.
"""

from typing import List, Dict, Any
from .hypotheses import FormalHypothesis, HypothesisCatalog
from .observer import EndpointSurface

class AdaptiveTestPlanner:
    """Schedules research experiments dynamically based on attack surface and budget."""

    def __init__(self, budget: int = 100):
        self.budget = budget
        self.planned_experiments: List[Dict[str, Any]] = []

    def plan_research_run(self, surfaces: List[EndpointSurface]) -> List[Dict[str, Any]]:
        hypotheses = HypothesisCatalog.get_all_hypotheses()
        scheduled = []
        
        for hyp in hypotheses:
            matched_surfaces = []
            for s in surfaces:
                if any(tag.lower() in [t.lower() for t in hyp.target_tags] for tag in s.tags):
                    matched_surfaces.append(s)
            
            scheduled.append({
                "hypothesis_id": hyp.id,
                "hypothesis_name": hyp.name,
                "category": hyp.category,
                "strategy": hyp.test_strategy,
                "matched_endpoints": [m.path for m in matched_surfaces],
                "confidence_prior": hyp.confidence_prior
            })

        self.planned_experiments = scheduled
        return scheduled
