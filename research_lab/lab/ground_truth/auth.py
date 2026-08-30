"""
Authentication and JWT management for Ground-Truth Vulnerability Lab.
Includes deliberate vulnerabilities such as JWT `alg: none` / signature bypass (CWE-347).
"""

import os
import json
import base64
import hashlib
import hmac
import time
from typing import Dict, Any, Optional, Tuple
import jwt
from fastapi import HTTPException, status, Header

GROUND_TRUTH_SECRET_KEY = "ground_truth_laboratory_secret_key_hs256_seed"
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Standard SHA-256 password hash for test fixtures."""
    salt = "lab_fixed_salt_2026"
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"sha256${salt}${h}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        _, salt, expected_hash = hashed_password.split("$")
        actual_hash = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
        return hmac.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False


def create_access_token(user_id: str, username: str, tenant_id: str, role: str, expires_in: int = 3600) -> str:
    """Generates standard HS256 signed access token."""
    payload = {
        "sub": user_id,
        "username": username,
        "tenant_id": tenant_id,
        "role": role,
        "exp": int(time.time()) + expires_in,
        "iat": int(time.time())
    }
    return jwt.encode(payload, GROUND_TRUTH_SECRET_KEY, algorithm=ALGORITHM)


def create_unsigned_none_token(user_id: str, username: str, tenant_id: str, role: str) -> str:
    """
    Creates an intentionally vulnerable JWT with `alg: none` and empty signature.
    Exemplifies CWE-347 payload generation.
    """
    header = {"typ": "JWT", "alg": "none"}
    payload = {
        "sub": user_id,
        "username": username,
        "tenant_id": tenant_id,
        "role": role,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time())
    }

    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    header_b64 = b64url(json.dumps(header).encode("utf-8"))
    payload_b64 = b64url(json.dumps(payload).encode("utf-8"))
    return f"{header_b64}.{payload_b64}."


def decode_vulnerable_jwt(token: str) -> Dict[str, Any]:
    """
    KNOWN_LAB_VULNERABILITY: LAB-JWT-001 (CWE-347).
    Vulnerable JWT decoding implementation:
    Parses header and accepts `alg: none` or unsigned tokens without cryptographic verification.
    """
    try:
        parts = token.split(".")
        if len(parts) not in (2, 3):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")

        header_raw = parts[0]
        # Pad base64 if needed
        header_raw += "=" * ((4 - len(header_raw) % 4) % 4)
        header = json.loads(base64.urlsafe_b64decode(header_raw.encode("utf-8")).decode("utf-8"))

        payload_raw = parts[1]
        payload_raw += "=" * ((4 - len(payload_raw) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_raw.encode("utf-8")).decode("utf-8"))

        # Vulnerability: If header specifies alg none (case-insensitive), bypass signature validation completely!
        alg = header.get("alg", "").lower()
        if alg == "none" or len(parts[2]) == 0:
            # Skip signature check!
            if "exp" in payload and payload["exp"] < time.time():
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
            return payload

        # Otherwise attempt PyJWT decode with secret
        return jwt.decode(token, GROUND_TRUTH_SECRET_KEY, algorithms=["HS256"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {str(e)}")


async def get_current_user_vulnerable(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency that extracts user from Authorization header using vulnerable JWT decoding."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Bearer token")
    token = authorization.split("Bearer ")[1].strip()
    return decode_vulnerable_jwt(token)
