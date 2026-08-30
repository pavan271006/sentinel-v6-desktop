"""
Authentication and Cryptographic JWT Handling for Fixed Negative Controls Laboratory.
Enforces strict HS256 signature verification, rejection of `alg: none`, and role authorization.
"""

import os
import time
import hashlib
import hmac
from typing import Dict, Any, Optional, List
import jwt
from fastapi import HTTPException, status, Header, Depends

FIXED_CONTROLS_SECRET_KEY = "fixed_controls_laboratory_secret_key_hs256_seed_secure"
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
    return jwt.encode(payload, FIXED_CONTROLS_SECRET_KEY, algorithm=ALGORITHM)


def decode_strict_jwt(token: str) -> Dict[str, Any]:
    """
    FIXED_NEGATIVE_CONTROL: LAB-JWT-001 (CWE-347 Remediated).
    Strict JWT decoding:
    Enforces mandatory HS256 algorithm and signature validation. Unsigned tokens and `alg: none` are strictly rejected.
    """
    try:
        payload = jwt.decode(
            token,
            FIXED_CONTROLS_SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "tenant_id", "role"], "verify_signature": True}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except (jwt.InvalidTokenError, Exception) as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature or algorithm")


async def get_current_user_strict(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency that extracts user from Authorization header using strict JWT decoding."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Bearer token")
    token = authorization.split("Bearer ")[1].strip()
    return decode_strict_jwt(token)


def require_roles(allowed_roles: List[str]):
    """Role-based authorization dependency for administrative endpoints."""
    async def role_checker(user: Dict[str, Any] = Depends(get_current_user_strict)) -> Dict[str, Any]:
        user_role = user.get("role", "member")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Requires one of roles {allowed_roles}, current role is '{user_role}'"
            )
        return user
    return role_checker
