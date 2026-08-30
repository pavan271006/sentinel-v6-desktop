"""
HTTP Desync & Smuggling Detector - Core Implementation
Module: research.prototypes.http_desync_detector.detector
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any
import time
import uuid

from .models import (
    DesyncVectorType,
    ProbeMethod,
    DesyncProbe,
    ProbeResponseObservation,
    SmugglingDetectionResult,
)


class DesyncProbeGenerator:
    """Generates RFC-compliant and adversarial desync probing byte payloads."""

    @staticmethod
    def generate_cl_te_timeout_probe(host: str, path: str = "/") -> DesyncProbe:
        """
        CL.TE Timeout Probe:
        Frontend parses Content-Length: 4 -> forwards body '1\\r\\nZ\\r\\n'
        Backend parses Transfer-Encoding: chunked -> reads chunk '1\\r\\nZ\\r\\n',
        then reads 'Q' as the next chunk size and hangs waiting for remaining bytes!
        """
        payload = (
            f"POST {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\n"
            f"Content-Type: application/x-www-form-urlencoded\r\n"
            f"Content-Length: 4\r\n"
            f"Transfer-Encoding: chunked\r\n"
            f"Connection: keep-alive\r\n"
            f"\r\n"
            f"1\r\n"
            f"Z\r\n"
            f"Q"
        ).encode("utf-8")

        return DesyncProbe(
            vector_type=DesyncVectorType.CL_TE,
            probe_method=ProbeMethod.TIMEOUT_HANG,
            raw_payload=payload,
            expected_timeout_threshold_ms=3500.0,
            description="Non-destructive CL.TE timeout probe inducing backend hang on unfinished chunk."
        )

    @staticmethod
    def generate_te_cl_timeout_probe(host: str, path: str = "/") -> DesyncProbe:
        """
        TE.CL Timeout Probe:
        Frontend parses Transfer-Encoding: chunked -> reads '0\\r\\n\\r\\n' -> forwards request.
        Backend parses Content-Length: 6 -> expects 6 bytes, but frontend only sends 5 bytes ('0\\r\\n\\r\\n')
        Backend hangs waiting for 1 more byte!
        """
        payload = (
            f"POST {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\n"
            f"Content-Type: application/x-www-form-urlencoded\r\n"
            f"Content-Length: 6\r\n"
            f"Transfer-Encoding: chunked\r\n"
            f"Connection: keep-alive\r\n"
            f"\r\n"
            f"0\r\n"
            f"\r\n"
            f"X"
        ).encode("utf-8")

        return DesyncProbe(
            vector_type=DesyncVectorType.TE_CL,
            probe_method=ProbeMethod.TIMEOUT_HANG,
            raw_payload=payload,
            expected_timeout_threshold_ms=3500.0,
            description="Non-destructive TE.CL timeout probe inducing backend hang on missing Content-Length byte."
        )

    @staticmethod
    def generate_te_te_obfuscated_probes(host: str, path: str = "/") -> List[DesyncProbe]:
        """
        TE.TE Obfuscation Probes:
        Uses various RFC 7230 obfuscations to test parser discrepancies.
        """
        obfuscations = [
            ("Transfer-Encoding: xchunked", "xchunked prefix"),
            ("Transfer-Encoding : chunked", "space before colon"),
            ("Transfer-Encoding:\tchunked", "tab delimiter"),
            ("Transfer-Encoding: chunked\r\nTransfer-Encoding: cow", "duplicate header"),
            ("X: X\r\nTransfer-Encoding: chunked", "line wrap header"),
        ]

        probes = []
        for header_str, desc in obfuscations:
            payload = (
                f"POST {path} HTTP/1.1\r\n"
                f"Host: {host}\r\n"
                f"Content-Length: 4\r\n"
                f"{header_str}\r\n"
                f"Connection: keep-alive\r\n"
                f"\r\n"
                f"1\r\n"
                f"Z\r\n"
                f"Q"
            ).encode("utf-8")

            probes.append(DesyncProbe(
                vector_type=DesyncVectorType.TE_TE_OBFUSCATED,
                probe_method=ProbeMethod.TIMEOUT_HANG,
                raw_payload=payload,
                expected_timeout_threshold_ms=3500.0,
                description=f"TE.TE Obfuscation: {desc}"
            ))
        return probes

    @staticmethod
    def generate_h2_cl_probe(host: str, path: str = "/", canary: Optional[str] = None) -> DesyncProbe:
        """
        H2.CL HTTP/2 Downgrade Probe:
        Sends HTTP/2 request with injected content-length: 0 and smuggled prefix body.
        """
        canary_val = canary or f"sntnl_desync_{uuid.uuid4().hex[:8]}"
        smuggled_prefix = f"GET /{canary_val} HTTP/1.1\r\nHost: {host}\r\nX-Ignore: X".encode("utf-8")
        
        # Emulated H2 frame payload representation
        raw_repr = (
            f":method: POST\n"
            f":path: {path}\n"
            f":authority: {host}\n"
            f"content-length: 0\n"
            f"\n"
            f"{smuggled_prefix.decode('utf-8')}"
        ).encode("utf-8")

        return DesyncProbe(
            vector_type=DesyncVectorType.H2_CL,
            probe_method=ProbeMethod.DIFFERENTIAL_PREFIX,
            raw_payload=raw_repr,
            prefix_canary=canary_val,
            description="HTTP/2 Downgrade H2.CL probe with injected content-length: 0."
        )


class SinglePacketFrameAssembler:
    """
    Assembles multiple concurrent HTTP/2 streams or HTTP/1.1 requests into a single
    physical TCP packet (MSS <= 1460 bytes) to eliminate network arrival dispersion.
    """

    @staticmethod
    def assemble_single_packet_batch(requests: List[bytes], max_mss: int = 1460) -> Tuple[bytes, bool]:
        """
        Packs multiple request payloads into a single contiguous byte buffer.
        Returns (packed_bytes, fits_in_single_packet).
        """
        packed = b"".join(requests)
        fits = len(packed) <= max_mss
        return packed, fits


class HttpDesyncDetector:
    """
    Comprehensive diagnostic detector for HTTP request smuggling and desynchronization flaws.
    """

    def __init__(self, baseline_timeout_ms: float = 500.0):
        self.baseline_timeout_ms = baseline_timeout_ms

    def evaluate_probe_response(
        self,
        probe: DesyncProbe,
        observation: ProbeResponseObservation,
        baseline_observation: Optional[ProbeResponseObservation] = None,
    ) -> SmugglingDetectionResult:
        """
        Evaluates server response behavior against the desync hypothesis.
        """
        is_vuln = False
        confidence = 0.0
        ev_type = "NONE"
        details: Dict[str, Any] = {
            "elapsed_time_ms": observation.elapsed_time_ms,
            "status_code": observation.status_code,
            "probe_description": probe.description,
        }

        # 1. Timeout-induced desync detection
        if probe.probe_method == ProbeMethod.TIMEOUT_HANG:
            # If probe hung for >= threshold (e.g. 3500ms) or triggered socket read timeout,
            # while normal baseline response is fast (<500ms), desync is confirmed!
            if observation.socket_timeout_triggered or observation.elapsed_time_ms >= probe.expected_timeout_threshold_ms:
                base_lat = baseline_observation.elapsed_time_ms if baseline_observation else 100.0
                if observation.elapsed_time_ms > (base_lat + 2500.0) or observation.socket_timeout_triggered:
                    is_vuln = True
                    confidence = 0.95
                    ev_type = "TIMEOUT_INDUCED"
                    details["diagnostic"] = f"Server hung for {observation.elapsed_time_ms:.1f}ms waiting for remaining bytes."

        # 2. Differential Prefix Leak / Secondary Request Poisoning
        elif probe.probe_method == ProbeMethod.DIFFERENTIAL_PREFIX:
            if probe.prefix_canary and probe.prefix_canary.encode("utf-8") in observation.secondary_response_body:
                is_vuln = True
                confidence = 0.99
                ev_type = "PREFIX_LEAK"
                details["diagnostic"] = f"Smuggled prefix canary '{probe.prefix_canary}' reflected in secondary response!"
            elif observation.secondary_response_status == 404 and probe.prefix_canary:
                is_vuln = True
                confidence = 0.90
                ev_type = "STATUS_ANOMALY"
                details["diagnostic"] = f"Secondary response returned 404 Not Found for smuggled canary route."

        remediation = ""
        if is_vuln:
            if probe.vector_type in (DesyncVectorType.CL_TE, DesyncVectorType.TE_CL, DesyncVectorType.TE_TE_OBFUSCATED):
                remediation = "Enforce HTTP/2 end-to-end to backend, or configure front-end proxy to strictly normalize ambiguous Content-Length / Transfer-Encoding headers."
            elif probe.vector_type in (DesyncVectorType.H2_CL, DesyncVectorType.H2_TE):
                remediation = "Disable HTTP/2 downgrade to HTTP/1.1 backend, or reject HTTP/2 requests containing Content-Length or Transfer-Encoding pseudo-headers."

        return SmugglingDetectionResult(
            vector_type=probe.vector_type,
            is_vulnerable=is_vuln,
            confidence=confidence,
            evidence_type=ev_type,
            diagnostic_details=details,
            remediation_recommendation=remediation,
        )
