"""
Ground-Truth Vulnerability Lab module.
Provides deliberately vulnerable test fixtures for security scanner benchmarking.
"""

from .app import create_ground_truth_app
from .database import GroundTruthDatabase
from .auth import (
    create_access_token, create_unsigned_none_token,
    verify_password, hash_password, decode_vulnerable_jwt
)

__all__ = [
    "create_ground_truth_app",
    "GroundTruthDatabase",
    "create_access_token",
    "create_unsigned_none_token",
    "verify_password",
    "hash_password",
    "decode_vulnerable_jwt"
]
