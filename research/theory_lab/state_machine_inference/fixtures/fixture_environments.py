"""
Fixture Environments for State Machine Inference
Provides realistic multi-step e-commerce & authentication traces: VULNERABLE, FIXED, BENIGN, and NOISY.
"""

from ..models import TraceAction


def get_standard_checkout_traces() -> list[list[TraceAction]]:
    """Normal e-commerce traces following step 1 -> step 2 -> payment -> success."""
    t1 = [
        TraceAction(method="POST", endpoint="/cart/add", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/address", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/pay", status_code=200),
        TraceAction(method="GET", endpoint="/order/success", status_code=200),
    ]
    t2 = [
        TraceAction(method="POST", endpoint="/cart/add", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/address", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/pay", status_code=200),
        TraceAction(method="GET", endpoint="/order/success", status_code=200),
    ]
    t3 = [
        TraceAction(method="POST", endpoint="/cart/add", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/address", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/coupon", status_code=200),
        TraceAction(method="POST", endpoint="/checkout/pay", status_code=200),
        TraceAction(method="GET", endpoint="/order/success", status_code=200),
    ]
    return [t1, t2, t3]


def get_vulnerable_skip_trace() -> tuple[list[str], str, int]:
    """Out-of-order skipping attempt where payment is skipped but order succeeds."""
    required = ["POST /cart/add", "POST /checkout/pay"]
    terminal = "GET /order/success"
    # Target application returns 200 OK without payment
    observed_status = 200
    return required, terminal, observed_status
