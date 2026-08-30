"""
Harness: Identity & Token Scope Boundary Auditor
================================================
Tests CI_JOB_TOKEN, Personal Access Tokens (PAT), Impersonation Tokens,
Deploy Tokens, and all 10 token types across GitLab CE privilege boundaries.

Authoritative Reference:
- gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md (Section 4)
- INV-AUTH-06 (CI Token Scoping) & INV-AUTH-08 (Token Scope Intersection)
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class TokenType(Enum):
    PAT = "Personal Access Token"
    IMPERSONATION_TOKEN = "Impersonation Token"
    OAUTH2_TOKEN = "OAuth2 Access Token"
    CI_JOB_TOKEN = "CI_JOB_TOKEN"
    PROJECT_ACCESS_TOKEN = "Project Access Token"
    GROUP_ACCESS_TOKEN = "Group Access Token"
    DEPLOY_TOKEN = "Deploy Token"
    DEPLOY_KEY = "Deploy Key"
    TRIGGER_TOKEN = "Pipeline Trigger Token"
    RUNNER_AUTH_TOKEN = "Runner Authentication Token"


class TokenStorageModel(Enum):
    SHA256_DIGEST = "SHA-256 Digest in Database"
    ENCRYPTED_DB = "Encrypted in Database (AES-256-GCM / attr_encrypted)"
    EPHEMERAL_JWT = "Ephemeral Signed JWT"
    SSH_PUBLIC_KEY = "SSH Public Key in Database"
    CLEARTEXT_HASH = "Hashed Token in Database"


@dataclass
class TokenDefinition:
    token_type: TokenType
    bound_identity: str
    max_lifetime: str
    supported_scopes: List[str]
    storage_model: TokenStorageModel
    security_boundary: str


# Authoritative mapping of all 10 token types per GITLAB_AUTHORIZATION_MODEL.md
TEN_TOKEN_TAXONOMY: Dict[TokenType, TokenDefinition] = {
    TokenType.PAT: TokenDefinition(
        token_type=TokenType.PAT,
        bound_identity="User account",
        max_lifetime="Configurable (Max 365d default)",
        supported_scopes=["api", "read_api", "read_user", "read_repository", "write_repository", "read_registry", "write_registry", "sudo", "admin_mode"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="User permissions intersected with token scopes.",
    ),
    TokenType.IMPERSONATION_TOKEN: TokenDefinition(
        token_type=TokenType.IMPERSONATION_TOKEN,
        bound_identity="Target User (Admin created)",
        max_lifetime="Configurable",
        supported_scopes=["api", "read_api", "read_user", "read_repository", "write_repository"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="Target user permissions only; ignores Admin Mode step-up.",
    ),
    TokenType.OAUTH2_TOKEN: TokenDefinition(
        token_type=TokenType.OAUTH2_TOKEN,
        bound_identity="User + Application",
        max_lifetime="Configurable TTL (default 2h)",
        supported_scopes=["api", "read_user", "openid", "profile", "email"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="Doorkeeper OAuth scopes intersected with user permissions.",
    ),
    TokenType.CI_JOB_TOKEN: TokenDefinition(
        token_type=TokenType.CI_JOB_TOKEN,
        bound_identity="Ephemeral Pipeline Job Execution",
        max_lifetime="Pipeline Job Runtime Duration",
        supported_scopes=["read_artifacts", "download_artifacts", "container_registry", "git_clone", "job_token_scope"],
        storage_model=TokenStorageModel.EPHEMERAL_JWT,
        security_boundary="Target project Inbound Allowlist gate.",
    ),
    TokenType.PROJECT_ACCESS_TOKEN: TokenDefinition(
        token_type=TokenType.PROJECT_ACCESS_TOKEN,
        bound_identity="Project Bot User (User.project_bot)",
        max_lifetime="Configurable (Max 365d)",
        supported_scopes=["api", "read_api", "read_repository", "write_repository", "read_registry", "write_registry"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="Strictly bounded to target project membership role.",
    ),
    TokenType.GROUP_ACCESS_TOKEN: TokenDefinition(
        token_type=TokenType.GROUP_ACCESS_TOKEN,
        bound_identity="Group Bot User (User.project_bot)",
        max_lifetime="Configurable (Max 365d)",
        supported_scopes=["api", "read_api", "read_repository", "write_repository", "read_registry", "write_registry"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="Bounded to parent group and all descendant subgroups/projects.",
    ),
    TokenType.DEPLOY_TOKEN: TokenDefinition(
        token_type=TokenType.DEPLOY_TOKEN,
        bound_identity="Non-user entity (deploy_tokens table)",
        max_lifetime="Configurable / Indefinite",
        supported_scopes=["read_repository", "read_registry", "write_registry", "read_package_registry", "write_package_registry"],
        storage_model=TokenStorageModel.CLEARTEXT_HASH,
        security_boundary="Project or Group repository and registry read/write only.",
    ),
    TokenType.DEPLOY_KEY: TokenDefinition(
        token_type=TokenType.DEPLOY_KEY,
        bound_identity="SSH Key Pair",
        max_lifetime="Indefinite",
        supported_scopes=["read_repository", "write_repository"],
        storage_model=TokenStorageModel.SSH_PUBLIC_KEY,
        security_boundary="Git operations over SSH for linked projects.",
    ),
    TokenType.TRIGGER_TOKEN: TokenDefinition(
        token_type=TokenType.TRIGGER_TOKEN,
        bound_identity="Pipeline Trigger Entity",
        max_lifetime="Indefinite",
        supported_scopes=["trigger_pipeline"],
        storage_model=TokenStorageModel.ENCRYPTED_DB,
        security_boundary="POST /projects/:id/trigger/pipeline execution only.",
    ),
    TokenType.RUNNER_AUTH_TOKEN: TokenDefinition(
        token_type=TokenType.RUNNER_AUTH_TOKEN,
        bound_identity="GitLab Runner (glrt-*)",
        max_lifetime="Indefinite / Rotatable",
        supported_scopes=["request_job", "update_job", "upload_artifacts"],
        storage_model=TokenStorageModel.SHA256_DIGEST,
        security_boundary="Job queue fetching for assigned project, group, or instance scope.",
    ),
}


class TokenBoundaryAuditor:
    """Verifies cross-project isolation, storage models, and scope restrictions across GitLab token types."""

    @staticmethod
    def test_ci_job_token_isolation(
        source_project_id: int,
        target_project_id: int,
        inbound_allowlist: List[int],
        simulated_response_status: int,
        job_status: str = "running",
    ) -> Dict[str, Any]:
        """
        Original method kept backward-compatible with enhanced job-lifecycle checking.
        """
        is_same_project = (source_project_id == target_project_id)
        is_allowlisted = source_project_id in inbound_allowlist
        is_active_job = (job_status == "running")
        
        authorized = (is_same_project or is_allowlisted) and is_active_job
        leak_occurred = (simulated_response_status == 200 and not authorized)

        return {
            "source_project": source_project_id,
            "target_project": target_project_id,
            "job_status": job_status,
            "is_authorized": authorized,
            "leak_occurred": leak_occurred,
            "verdict": "VULNERABLE_CROSS_PROJECT_LEAK" if leak_occurred else "ISOLATION_ENFORCED",
        }

    @staticmethod
    def is_scope_sufficient(
        token_scopes: List[str],
        required_capability: str,
        is_write: bool = False,
    ) -> bool:
        """
        Calculates if token scopes satisfy a required operation.
        Hierarchy rules:
        - 'api' grants all read and write capabilities
        - 'read_api' grants all read capabilities
        - Specific scopes (e.g., 'read_repository', 'write_repository') grant their respective functions
        """
        if "api" in token_scopes:
            return True
        if not is_write and "read_api" in token_scopes and required_capability.startswith("read_"):
            return True
        if required_capability in token_scopes:
            return True
        return False

    @staticmethod
    def compute_effective_permissions(
        user_role_abilities: Set[str],
        token_scopes: List[str],
        ability_to_scope_map: Dict[str, Tuple[str, bool]],
    ) -> Set[str]:
        """
        INV-AUTH-08: EffectivePerms(Token) = UserPerms(Actor) ∩ GrantedScopes(Token)
        """
        effective = set()
        for ability in user_role_abilities:
            if ability in ability_to_scope_map:
                req_scope, is_write = ability_to_scope_map[ability]
                if TokenBoundaryAuditor.is_scope_sufficient(token_scopes, req_scope, is_write):
                    effective.add(ability)
            else:
                # If ability requires general api
                if "api" in token_scopes:
                    effective.add(ability)
        return effective

    @staticmethod
    def hash_pat_token(raw_token: str) -> str:
        """Simulate GitLab CE SHA-256 token digest storage."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def get_taxonomy() -> Dict[TokenType, TokenDefinition]:
        """Returns the full 10-token taxonomy."""
        return TEN_TOKEN_TAXONOMY


if __name__ == "__main__":
    auditor = TokenBoundaryAuditor()
    res = auditor.test_ci_job_token_isolation(
        source_project_id=101,
        target_project_id=202,
        inbound_allowlist=[202, 303],
        simulated_response_status=403,
    )
    print("CI_JOB_TOKEN isolation result:", res)
    print("Taxonomy token count:", len(auditor.get_taxonomy()))
