"""
Verifier: Cryptographic Content-Addressable Storage (CAS) Evidence Vault
========================================================================
Implements an immutable, tamper-evident evidence recording system for security research.
All HTTP requests, responses, execution traces, and context metadata are serialized
deterministically, indexed by SHA-256 cryptographic digests, and verifiable on demand.

Invariants Enforced:
1. Determinism: Identical request/response/metadata tuples yield identical SHA-256 digests.
2. Tamper-Evidence: Any single-bit mutation in stored evidence invalidates verification.
3. Immutability: Stored evidence cannot be overwritten or altered without changing its digest.
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class CASEvidenceVault:
    """Cryptographic Content-Addressable Storage (CAS) proof recorder and verifier."""

    def __init__(self, storage_dir: Optional[Union[str, Path]] = None):
        """
        Initialize CAS vault.
        
        Args:
            storage_dir: Optional filesystem directory for persisting CAS artifacts.
        """
        self.vault: Dict[str, bytes] = {}
        self.receipts: Dict[str, Dict[str, Any]] = {}
        self.storage_dir = Path(storage_dir) if storage_dir else None
        if self.storage_dir:
            self.storage_dir.mkdir(parents=True, exist_ok=True)

    @property
    def store(self) -> Dict[str, bytes]:
        """Backward compatibility alias for internal vault dictionary."""
        return self.vault

    def _normalize_payload(self, data: Any) -> Any:
        """Ensure payload is cleanly JSON-serializable."""
        if isinstance(data, dict):
            return {str(k): self._normalize_payload(v) for k, v in data.items()}
        if isinstance(data, (list, tuple, set)):
            return [self._normalize_payload(item) for item in data]
        if isinstance(data, (str, int, float, bool)) or data is None:
            return data
        if isinstance(data, bytes):
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError:
                return data.hex()
        return str(data)

    def record_evidence(
        self,
        request_data: Any,
        response_data: Any,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Record evidence and return its immutable SHA-256 CAS digest.
        
        Args:
            request_data: Raw HTTP request string, dict, or bytes.
            response_data: Raw HTTP response string, dict, or bytes.
            metadata: Execution context (spec ID, role, status code, timestamp, etc.).
            
        Returns:
            64-character hexadecimal SHA-256 digest string.
        """
        norm_request = self._normalize_payload(request_data)
        norm_response = self._normalize_payload(response_data)
        norm_meta = self._normalize_payload(metadata or {})

        payload_obj = {
            "metadata": norm_meta,
            "request": norm_request,
            "response": norm_response,
        }

        serialized = json.dumps(payload_obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
        digest = hashlib.sha256(serialized).hexdigest()

        self.vault[digest] = serialized

        receipt = {
            "cas_digest": digest,
            "hash_algorithm": "SHA-256",
            "byte_size": len(serialized),
            "recorded_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "metadata_summary": norm_meta,
            "verified": True,
        }
        self.receipts[digest] = receipt

        if self.storage_dir:
            blob_path = self.storage_dir / f"{digest}.json"
            blob_path.write_bytes(serialized)
            receipt_path = self.storage_dir / f"{digest}.receipt.json"
            receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")

        return digest

    def store_evidence(
        self,
        request_payload: Any,
        response_payload: Any,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Alias for record_evidence matching alternative API signature."""
        return self.record_evidence(
            request_data=request_payload,
            response_data=response_payload,
            metadata=context or {},
        )

    def verify_evidence(self, digest: str) -> bool:
        """
        Cryptographically verify the integrity of stored evidence.
        
        Args:
            digest: Expected 64-character SHA-256 digest.
            
        Returns:
            True if stored payload matches digest, False if tampered or missing.
        """
        if digest not in self.vault:
            return False
        payload = self.vault[digest]
        calculated = hashlib.sha256(payload).hexdigest()
        return calculated == digest

    def get_evidence(self, digest: str) -> Optional[Dict[str, Any]]:
        """Retrieve deserialized evidence payload by SHA-256 digest."""
        if not self.verify_evidence(digest):
            return None
        raw = self.vault.get(digest)
        if raw is None:
            return None
        return json.loads(raw.decode("utf-8"))

    def get_raw_payload(self, digest: str) -> Optional[bytes]:
        """Retrieve raw serialized payload bytes."""
        return self.vault.get(digest)

    def generate_receipt(self, digest: str) -> Optional[Dict[str, Any]]:
        """Generate structured cryptographic verification receipt."""
        if not self.verify_evidence(digest):
            return None
        evidence = self.get_evidence(digest)
        return {
            "evidence_digest_sha256": digest,
            "status": "VALID_TAMPER_FREE",
            "byte_length": len(self.vault[digest]),
            "timestamp": self.receipts.get(digest, {}).get("recorded_at_utc"),
            "evidence_summary": {
                "has_request": bool(evidence.get("request")),
                "has_response": bool(evidence.get("response")),
                "metadata": evidence.get("metadata", {}),
            },
        }

    def export_receipt(self, digest: str, output_path: Union[str, Path]) -> bool:
        """Export JSON receipt to target file path."""
        receipt = self.generate_receipt(digest)
        if not receipt:
            return False
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
        return True

    def all_digests(self) -> List[str]:
        """Return list of all recorded SHA-256 digests."""
        return list(self.vault.keys())

    def count(self) -> int:
        """Return total count of stored evidence records."""
        return len(self.vault)

    def clear(self) -> None:
        """Clear memory cache (for test isolation)."""
        self.vault.clear()
        self.receipts.clear()
