"""
Adaptive Test Planner - Bayesian Utility & 6-Factor Explainability Engine
Module: research.prototypes.adaptive_test_planner.planner
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict
import heapq
import math
import time

from .models import (
    VulnClass,
    ParamClassification,
    TargetExposure,
    SixFactorReasoning,
    TestCandidate,
    ExecutionFeedback,
)


class BayesianBeliefModel:
    """
    Beta-Binomial conjugate Bayesian belief model tracking vulnerability probability
    distribution P(theta | evidence) ~ Beta(alpha, beta).
    """

    def __init__(self):
        # Key: (vuln_class, param_type) -> (alpha, beta)
        self._priors: Dict[Tuple[VulnClass, ParamClassification], Tuple[float, float]] = {}
        self._initialize_domain_priors()

    def _initialize_domain_priors(self):
        """Seed baseline empirical priors from security industry baseline vulnerability frequency."""
        # SQL Injection high on search query & numeric ID
        self._priors[(VulnClass.SQL_INJECTION, ParamClassification.SEARCH_QUERY)] = (4.0, 6.0)     # Mean = 0.40
        self._priors[(VulnClass.SQL_INJECTION, ParamClassification.NUMERIC_ID)] = (3.0, 7.0)       # Mean = 0.30
        self._priors[(VulnClass.SQL_INJECTION, ParamClassification.AUTH_HEADER)] = (1.0, 19.0)     # Mean = 0.05

        # XSS high on search query & generic string
        self._priors[(VulnClass.CROSS_SITE_SCRIPTING, ParamClassification.SEARCH_QUERY)] = (6.0, 4.0) # Mean = 0.60
        self._priors[(VulnClass.CROSS_SITE_SCRIPTING, ParamClassification.NUMERIC_ID)] = (1.0, 19.0) # Mean = 0.05

        # IDOR high on numeric ID & URL paths
        self._priors[(VulnClass.IDOR_BOLA, ParamClassification.NUMERIC_ID)] = (7.0, 3.0)           # Mean = 0.70
        self._priors[(VulnClass.IDOR_BOLA, ParamClassification.FILENAME_PATH)] = (5.0, 5.0)        # Mean = 0.50

        # Command injection high on system command & filename
        self._priors[(VulnClass.COMMAND_INJECTION, ParamClassification.SYSTEM_COMMAND)] = (8.0, 2.0) # Mean = 0.80
        self._priors[(VulnClass.COMMAND_INJECTION, ParamClassification.FILENAME_PATH)] = (4.0, 6.0) # Mean = 0.40

        # SSRF high on URL redirect & filenames
        self._priors[(VulnClass.SSRF, ParamClassification.URL_REDIRECT)] = (7.0, 3.0)              # Mean = 0.70

    def get_belief(self, vuln_class: VulnClass, param_type: ParamClassification) -> Tuple[float, float, float]:
        """
        Returns (mean_probability, variance, alpha, beta).
        """
        key = (vuln_class, param_type)
        alpha, beta = self._priors.get(key, (2.0, 8.0)) # Default prior mean = 0.20
        total = alpha + beta
        mean = alpha / total
        variance = (alpha * beta) / ((total ** 2) * (total + 1.0))
        return mean, variance, alpha

    def update(self, vuln_class: VulnClass, param_type: ParamClassification, positive: bool, weight: float = 1.0):
        """
        Bayesian update: Beta(alpha + 1, beta) for positive finding, Beta(alpha, beta + 1) for negative.
        """
        key = (vuln_class, param_type)
        alpha, beta = self._priors.get(key, (2.0, 8.0))
        if positive:
            alpha += weight
        else:
            beta += weight
        self._priors[key] = (alpha, beta)


def compute_shannon_entropy(value: str) -> float:
    """Computes normalized Shannon entropy H(X) in [0.0, 1.0]."""
    if not value:
        return 0.0
    freq: Dict[str, int] = defaultdict(int)
    for char in value:
        freq[char] += 1
    
    length = len(value)
    entropy = 0.0
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    
    # Normalize by log2(min(length, 64))
    max_entropy = math.log2(min(length, 64)) if length > 1 else 1.0
    return min(1.0, entropy / max(1.0, max_entropy))


class TokenBucketRateLimiter:
    """Host-level token bucket rate limiter to prevent target overloading."""
    def __init__(self, rate_limit_per_sec: float = 20.0, burst_capacity: int = 50):
        self.rate = rate_limit_per_sec
        self.capacity = burst_capacity
        self.tokens = float(burst_capacity)
        self.last_update = time.perf_counter()

    def consume(self, count: int = 1) -> bool:
        now = time.perf_counter()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_update = now

        if self.tokens >= count:
            self.tokens -= count
            return True
        return False

    @property
    def headroom_fraction(self) -> float:
        return max(0.0, min(1.0, self.tokens / self.capacity))


class AdaptiveTestPlanner:
    """
    Intelligent test planning engine optimizing risk and coverage under budget constraints
    with explainable 6-factor reasoning logs.
    """

    def __init__(self, max_request_budget: int = 500, requests_per_sec: float = 25.0):
        self.budget = max_request_budget
        self.requests_dispatched = 0
        self.belief_model = BayesianBeliefModel()
        self.rate_limiter = TokenBucketRateLimiter(rate_limit_per_sec=requests_per_sec)

        # Tracking state
        self._candidate_pool: Dict[str, TestCandidate] = {}
        # Priority queue entries: (-utility, tie_breaker_id, candidate_id)
        self._pq: List[Tuple[float, int, str]] = []
        self._tie_breaker = 0
        
        # Coverage tracking: endpoint -> Set[vuln_class]
        self._covered_combinations: Dict[str, Set[VulnClass]] = defaultdict(set)
        # Anomaly signal cache: endpoint -> float score
        self._endpoint_anomaly_scores: Dict[str, float] = defaultdict(float)

    def add_candidate(self, candidate: TestCandidate):
        """Ingests a new test candidate and computes initial 6-factor utility."""
        self._candidate_pool[candidate.id] = candidate
        self._evaluate_and_enqueue(candidate)

    def _evaluate_and_enqueue(self, cand: TestCandidate):
        """Computes the 6 factor scores, formats the WHY reasoning, and pushes to priority queue."""
        # 1. Prior Probability
        prior_mean, _, _ = self.belief_model.get_belief(cand.vuln_class, cand.param_type)
        cand.reasoning.prior_vuln_prob = prior_mean

        # 2. Parameter Entropy
        entropy = compute_shannon_entropy(cand.parameter_name + cand.payload_sample)
        cand.reasoning.param_entropy_score = entropy

        # 3. Attack Surface Criticality
        crit_map = {
            TargetExposure.ADMIN_PRIVILEGED: 0.95,
            TargetExposure.AUTHENTICATED_USER: 0.75,
            TargetExposure.PUBLIC_DMZ: 0.85,
            TargetExposure.INTERNAL_MICROSERVICE: 0.40,
        }
        cand.reasoning.attack_surface_criticality = crit_map.get(cand.exposure, 0.5)

        # 4. Anomaly Signal Score
        cand.reasoning.anomaly_signal_score = self._endpoint_anomaly_scores.get(cand.endpoint, 0.0)

        # 5. Coverage Debt Score
        tested_vulns = self._covered_combinations.get(cand.endpoint, set())
        cand.reasoning.coverage_debt_score = 1.0 if cand.vuln_class not in tested_vulns else 0.2

        # 6. Execution Cost & Rate Budget
        latency_penalty = max(0.05, cand.estimated_latency_ms / 1000.0)
        rate_headroom = max(0.1, self.rate_limiter.headroom_fraction)
        cand.reasoning.execution_cost_budget = latency_penalty / rate_headroom

        # Calculate composite utility
        cand.calculated_utility = cand.reasoning.compute_composite_utility()

        # Format explicit explainable 'WHY' reasoning log
        cand.why_explanation = (
            f"Selected for {cand.method} {cand.endpoint} [{cand.parameter_name}]: "
            f"Bayesian Prior P({cand.vuln_class.value}|{cand.param_type.value})={prior_mean:.2f}; "
            f"Criticality={cand.exposure.value} ({cand.reasoning.attack_surface_criticality:.2f}); "
            f"Anomaly Signal={cand.reasoning.anomaly_signal_score:.2f}; "
            f"Coverage Debt={cand.reasoning.coverage_debt_score:.2f}; "
            f"Estimated Latency Cost={cand.reasoning.execution_cost_budget:.2f}s "
            f"=> Composite Utility: {cand.calculated_utility:.2f}"
        )

        self._tie_breaker += 1
        heapq.heappush(self._pq, (-cand.calculated_utility, self._tie_breaker, cand.id))

    def schedule_next_batch(self, batch_size: int = 5) -> List[TestCandidate]:
        """
        Schedules the top-k highest utility test candidates that fit within the remaining budget.
        """
        scheduled: List[TestCandidate] = []
        
        while self._pq and len(scheduled) < batch_size and self.requests_dispatched < self.budget:
            neg_util, _, cand_id = heapq.heappop(self._pq)
            cand = self._candidate_pool.get(cand_id)
            if not cand:
                continue

            # Check rate limiter
            if not self.rate_limiter.consume(1):
                # Rate limited: re-enqueue with latency penalty
                cand.estimated_latency_ms += 100.0
                self._evaluate_and_enqueue(cand)
                break

            self.requests_dispatched += 1
            self._covered_combinations[cand.endpoint].add(cand.vuln_class)
            scheduled.append(cand)

        return scheduled

    def record_feedback(self, feedback: ExecutionFeedback):
        """
        Updates Bayesian priors, anomaly cache, and reprioritizes dependent tests based on feedback.
        """
        # 1. Update Bayesian belief
        if feedback.finding_confirmed:
            self.belief_model.update(feedback.vuln_class, ParamClassification.SEARCH_QUERY, positive=True, weight=2.0)
            self._endpoint_anomaly_scores[feedback.endpoint] = min(1.0, self._endpoint_anomaly_scores[feedback.endpoint] + 0.5)
        elif feedback.anomaly_detected or feedback.status_code >= 500:
            self._endpoint_anomaly_scores[feedback.endpoint] = min(1.0, self._endpoint_anomaly_scores[feedback.endpoint] + 0.3)
        else:
            self.belief_model.update(feedback.vuln_class, ParamClassification.SEARCH_QUERY, positive=False, weight=0.5)

        # 2. Dynamic Replanning: Re-score remaining candidates targeting the same endpoint
        active_ids = {item[2] for item in self._pq}
        affected_candidates = [c for c in self._candidate_pool.values() if c.endpoint == feedback.endpoint and c.id in active_ids]
        if affected_candidates:
            # Rebuild PQ cleanly
            self._pq = []
            for c in self._candidate_pool.values():
                if c.id in active_ids:
                    self._evaluate_and_enqueue(c)

    @property
    def remaining_budget(self) -> int:
        return max(0, self.budget - self.requests_dispatched)

    @property
    def pending_test_count(self) -> int:
        return len(self._pq)
