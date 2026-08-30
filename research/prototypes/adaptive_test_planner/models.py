"""
Adaptive Test Planner - Data Models and Enums
Module: research.prototypes.adaptive_test_planner.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
import uuid
import time


class VulnClass(str, Enum):
    SQL_INJECTION = "SQL_INJECTION"
    NOSQL_INJECTION = "NOSQL_INJECTION"
    COMMAND_INJECTION = "COMMAND_INJECTION"
    SERVER_SIDE_TEMPLATE_INJECTION = "SERVER_SIDE_TEMPLATE_INJECTION"
    CROSS_SITE_SCRIPTING = "CROSS_SITE_SCRIPTING"
    PATH_TRAVERSAL = "PATH_TRAVERSAL"
    IDOR_BOLA = "IDOR_BOLA"
    BFLA = "BFLA"
    SSRF = "SSRF"
    DESERIALIZATION = "DESERIALIZATION"
    HTTP_REQUEST_SMUGGLING = "HTTP_REQUEST_SMUGGLING"
    RACE_CONDITION = "RACE_CONDITION"


class ParamClassification(str, Enum):
    NUMERIC_ID = "NUMERIC_ID"
    SEARCH_QUERY = "SEARCH_QUERY"
    FILENAME_PATH = "FILENAME_PATH"
    JSON_BODY = "JSON_BODY"
    AUTH_HEADER = "AUTH_HEADER"
    SESSION_COOKIE = "SESSION_COOKIE"
    SYSTEM_COMMAND = "SYSTEM_COMMAND"
    URL_REDIRECT = "URL_REDIRECT"
    GENERIC_STRING = "GENERIC_STRING"


class TargetExposure(str, Enum):
    PUBLIC_DMZ = "PUBLIC_DMZ"
    AUTHENTICATED_USER = "AUTHENTICATED_USER"
    ADMIN_PRIVILEGED = "ADMIN_PRIVILEGED"
    INTERNAL_MICROSERVICE = "INTERNAL_MICROSERVICE"


@dataclass
class SixFactorReasoning:
    """
    Explicit 6-factor explainable 'WHY' reasoning breakdown for test selection.
    """
    prior_vuln_prob: float = 0.5            # Factor 1: Bayesian prior based on tech stack & historical CWEs
    param_entropy_score: float = 0.5        # Factor 2: Shannon entropy & semantic parameter type
    attack_surface_criticality: float = 0.5  # Factor 3: Target exposure, data sensitivity & role privileges
    anomaly_signal_score: float = 0.0       # Factor 4: Observed reflection, error cues, timing deviations
    coverage_debt_score: float = 1.0        # Factor 5: Unexplored paths & parameter combinations
    execution_cost_budget: float = 0.1      # Factor 6: Latency penalty, token bucket headroom & WAF risk

    def compute_composite_utility(self, waf_risk_lambda: float = 1.5) -> float:
        """
        Computes composite utility metric:
        U = (Prior * Criticality * (1 + Anomaly) * CoverageDebt * (1 + ParamEntropy)) / (Cost + lambda * WAFRisk)
        """
        numerator = (
            self.prior_vuln_prob
            * self.attack_surface_criticality
            * (1.0 + self.anomaly_signal_score)
            * self.coverage_debt_score
            * (1.0 + self.param_entropy_score)
        )
        denominator = max(0.01, self.execution_cost_budget * waf_risk_lambda)
        return round(numerator / denominator, 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "factor_1_prior_vuln_prob": round(self.prior_vuln_prob, 4),
            "factor_2_param_entropy_score": round(self.param_entropy_score, 4),
            "factor_3_attack_surface_criticality": round(self.attack_surface_criticality, 4),
            "factor_4_anomaly_signal_score": round(self.anomaly_signal_score, 4),
            "factor_5_coverage_debt_score": round(self.coverage_debt_score, 4),
            "factor_6_execution_cost_budget": round(self.execution_cost_budget, 4),
            "composite_utility": self.compute_composite_utility(),
        }


@dataclass
class TestCandidate:
    """
    A proposed security probe targeting a specific endpoint and parameter.
    """
    __test__ = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    endpoint: str = "/api/v1/resource"
    method: str = "GET"
    parameter_name: str = "id"
    param_type: ParamClassification = ParamClassification.GENERIC_STRING
    vuln_class: VulnClass = VulnClass.SQL_INJECTION
    exposure: TargetExposure = TargetExposure.PUBLIC_DMZ
    estimated_latency_ms: float = 50.0
    payload_sample: str = "' OR 1=1--"
    
    # 6-Factor Reasoning Model
    reasoning: SixFactorReasoning = field(default_factory=SixFactorReasoning)
    calculated_utility: float = 0.0
    why_explanation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "endpoint": f"{self.method} {self.endpoint}",
            "parameter": self.parameter_name,
            "vuln_class": self.vuln_class.value,
            "calculated_utility": self.calculated_utility,
            "why_explanation": self.why_explanation,
            "factors": self.reasoning.to_dict(),
        }


@dataclass
class ExecutionFeedback:
    """
    Observation returned after test dispatch, used to update Bayesian posterior beliefs.
    """
    test_id: str
    vuln_class: VulnClass
    endpoint: str
    parameter_name: str
    status_code: int
    latency_ms: float
    finding_confirmed: bool = False
    anomaly_detected: bool = False
    waf_challenge: bool = False
    rate_limited: bool = False
    reflection_found: bool = False
