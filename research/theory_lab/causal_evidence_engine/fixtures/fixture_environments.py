"""
Fixture Environments for Causal Evidence Engine
Provides evidence chains for VULNERABLE (proven causal link), FIXED (negative control), and NOISY confounding environments.
"""

def get_vulnerable_sqli_evidence_data() -> tuple[bytes, str, bytes, str]:
    """Returns raw probe bytes, payload variable name, raw response bytes, and finding title."""
    probe = b"POST /api/v1/auth HTTP/1.1\r\nHost: target.com\r\n\r\nusername=admin' OR '1'='1&password=x"
    payload_var = "username=admin' OR '1'='1"
    response = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"auth\":\"token_admin_super_secret\"}"
    title = "Authentication Bypass via SQL Injection"
    return probe, payload_var, response, title


def get_fixed_sqli_evidence_data() -> tuple[bytes, str, bytes, str]:
    """Remediated endpoint returning 401 Unauthorized."""
    probe = b"POST /api/v1/auth HTTP/1.1\r\nHost: target.com\r\n\r\nusername=admin' OR '1'='1&password=x"
    payload_var = "username=admin' OR '1'='1"
    response = b"HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n{\"error\":\"Invalid credentials\"}"
    title = "Authentication Bypass via SQL Injection"
    return probe, payload_var, response, title
