"""
Fixture Environments for Adaptive Test Planner
Provides sets of test candidates and target environments: VULNERABLE, FIXED, BENIGN, and NOISY.
"""

from ..models import (
    VulnClass,
    ParamClassification,
    TargetExposure,
    TestCandidate,
)
from ..planner import AdaptiveTestPlanner


def create_vulnerable_target_candidates() -> list[TestCandidate]:
    """Candidates for a target with real high-risk SQLi and IDOR endpoints."""
    return [
        TestCandidate(
            endpoint="/api/v1/search",
            method="GET",
            parameter_name="query",
            param_type=ParamClassification.SEARCH_QUERY,
            vuln_class=VulnClass.SQL_INJECTION,
            exposure=TargetExposure.PUBLIC_DMZ,
            estimated_latency_ms=45.0,
            payload_sample="' UNION SELECT null, username, password FROM users--",
        ),
        TestCandidate(
            endpoint="/api/v1/invoices/export",
            method="GET",
            parameter_name="invoice_id",
            param_type=ParamClassification.NUMERIC_ID,
            vuln_class=VulnClass.IDOR_BOLA,
            exposure=TargetExposure.AUTHENTICATED_USER,
            estimated_latency_ms=30.0,
            payload_sample="10924",
        ),
        TestCandidate(
            endpoint="/api/v1/admin/run_backup",
            method="POST",
            parameter_name="backup_path",
            param_type=ParamClassification.SYSTEM_COMMAND,
            vuln_class=VulnClass.COMMAND_INJECTION,
            exposure=TargetExposure.ADMIN_PRIVILEGED,
            estimated_latency_ms=120.0,
            payload_sample="; cat /etc/passwd",
        ),
    ]


def create_noisy_candidate_batch(count: int = 200) -> list[TestCandidate]:
    """Creates a large noisy batch of low-value, static, or cosmetic test candidates."""
    candidates = create_vulnerable_target_candidates()
    for i in range(count):
        cand = TestCandidate(
            endpoint=f"/static/theme_{i}",
            method="GET",
            parameter_name="v",
            param_type=ParamClassification.GENERIC_STRING,
            vuln_class=VulnClass.CROSS_SITE_SCRIPTING,
            exposure=TargetExposure.PUBLIC_DMZ,
            estimated_latency_ms=15.0,
            payload_sample="<script>1</script>",
        )
        candidates.append(cand)
    return candidates
