"""
Fixed Negative Controls Laboratory module.
Provides remediated test fixtures ensuring 0% false positives for security evaluation.
"""

from .app import create_fixed_controls_app
from .database import FixedControlsDatabase
from .auth import (
    create_access_token, verify_password, hash_password,
    decode_strict_jwt, require_roles
)

__all__ = [
    "create_fixed_controls_app",
    "FixedControlsDatabase",
    "create_access_token",
    "verify_password",
    "hash_password",
    "decode_strict_jwt",
    "require_roles"
]
