"""
Fixture Environments for Differential Security Engine
Provides response pairs for VULNERABLE (BOLA/BFLA/TimeSQLi), FIXED, BENIGN, and NOISY test cases.
"""

from ..models import ResponseSnapshot, DifferentialAxis


def get_bola_vulnerable_pair() -> tuple[ResponseSnapshot, ResponseSnapshot]:
    """User A (victim) response vs User B (attacker) accessing victim invoice."""
    resp_a = ResponseSnapshot(
        status_code=200,
        body='{"invoice_id": 10924, "user_id": 42, "amount": 999.00, "timestamp": "2026-08-22T09:00:00Z"}',
        latency_ms=35.0,
    )
    # Attacker B sends request for invoice 10924 and gets victim data back (BOLA vulnerability!)
    resp_b = ResponseSnapshot(
        status_code=200,
        body='{"invoice_id": 10924, "user_id": 42, "amount": 999.00, "timestamp": "2026-08-22T09:00:02Z"}',
        latency_ms=38.0,
    )
    return resp_a, resp_b


def get_bola_fixed_pair() -> tuple[ResponseSnapshot, ResponseSnapshot]:
    """User A (victim) response vs User B (attacker) accessing victim invoice (Remediated: 403 Forbidden)."""
    resp_a = ResponseSnapshot(
        status_code=200,
        body='{"invoice_id": 10924, "user_id": 42, "amount": 999.00, "timestamp": "2026-08-22T09:00:00Z"}',
        latency_ms=35.0,
    )
    resp_b = ResponseSnapshot(
        status_code=403,
        body='{"error": "Forbidden", "message": "Access to invoice 10924 denied for tenant"}',
        latency_ms=12.0,
    )
    return resp_a, resp_b


def get_time_sqli_distributions() -> tuple[list[float], list[float]]:
    """Baseline latency population (mean ~30ms) vs Sleep-Injected population (mean ~5030ms)."""
    base = [28.0, 32.5, 31.0, 29.5, 34.0, 30.2, 33.1, 28.9, 31.8, 30.0]
    injected = [5025.0, 5035.0, 5028.0, 5040.0, 5032.0, 5029.0, 5038.0, 5031.0, 5033.0, 5027.0]
    return base, injected
