"""
Fixture Environments for HTTP Desync Detector
Provides simulation observations for VULNERABLE (CL.TE, TE.CL, H2.CL), FIXED, BENIGN, and NOISY environments.
"""

from ..models import (
    DesyncVectorType,
    ProbeMethod,
    DesyncProbe,
    ProbeResponseObservation,
)
from ..detector import DesyncProbeGenerator


def get_vulnerable_cl_te_observation() -> tuple[DesyncProbe, ProbeResponseObservation, ProbeResponseObservation]:
    """Generates a CL.TE probe with an observation showing a 4200ms timeout hang."""
    probe = DesyncProbeGenerator.generate_cl_te_timeout_probe("vulnerable-proxy.corp.com")
    baseline_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=45.0)
    probe_obs = ProbeResponseObservation(status_code=None, elapsed_time_ms=4200.0, socket_timeout_triggered=True)
    return probe, probe_obs, baseline_obs


def get_vulnerable_h2_cl_observation() -> tuple[DesyncProbe, ProbeResponseObservation, ProbeResponseObservation]:
    """Generates an H2.CL probe where the smuggled canary is reflected in the secondary response."""
    canary = "sntnl_test_canary_8899"
    probe = DesyncProbeGenerator.generate_h2_cl_probe("vulnerable-h2.corp.com", canary=canary)
    baseline_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=50.0)
    probe_obs = ProbeResponseObservation(
        status_code=200,
        elapsed_time_ms=52.0,
        secondary_response_status=404,
        secondary_response_body=f"<html>Error 404: Route /{canary} Not Found</html>".encode("utf-8")
    )
    return probe, probe_obs, baseline_obs


def get_fixed_cl_te_observation() -> tuple[DesyncProbe, ProbeResponseObservation, ProbeResponseObservation]:
    """Generates a CL.TE probe against a fixed target that rejects ambiguous Transfer-Encoding with 400 Bad Request."""
    probe = DesyncProbeGenerator.generate_cl_te_timeout_probe("secure-proxy.corp.com")
    baseline_obs = ProbeResponseObservation(status_code=200, elapsed_time_ms=45.0)
    probe_obs = ProbeResponseObservation(status_code=400, response_body=b"Bad Request: Ambiguous Message Framing", elapsed_time_ms=15.0)
    return probe, probe_obs, baseline_obs
