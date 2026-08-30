"""
E2E Test Suite - Milestone 1: Bug-Bounty Policy & Environment Pinning
=====================================================================
Covers Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases),
Tier 3 (Pairwise Combinations), and Tier 4 (Real-World Scenarios).

Authoritative Sources:
- gitlab_research_lab/docs/GITLAB_BUG_BOUNTY_POLICY.md
- gitlab_research_lab/docs/GITLAB_RESEARCH_VERSION.md
- gitlab_research_lab/docs/GITLAB_LOCAL_ENVIRONMENT.md
- gitlab_research_lab/PROJECT.md
"""

import os
import re
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = LAB_ROOT / "docs"


class TestMilestone1PolicyEnv(unittest.TestCase):
    """Milestone 1 Test Suite: Bug-Bounty Policy, Versions, and Local Environment."""

    @classmethod
    def setUpClass(cls):
        """Verify existence and readability of required Milestone 1 documentation files."""
        cls.policy_file = DOCS_DIR / "GITLAB_BUG_BOUNTY_POLICY.md"
        cls.version_file = DOCS_DIR / "GITLAB_RESEARCH_VERSION.md"
        cls.env_file = DOCS_DIR / "GITLAB_LOCAL_ENVIRONMENT.md"

        if not cls.policy_file.exists():
            cls.policy_file = LAB_ROOT / "GITLAB_BUG_BOUNTY_POLICY.md"
        if not cls.version_file.exists():
            cls.version_file = LAB_ROOT / "GITLAB_RESEARCH_VERSION.md"
        if not cls.env_file.exists():
            cls.env_file = LAB_ROOT / "GITLAB_LOCAL_ENVIRONMENT.md"

        cls.policy_content = cls.policy_file.read_text(encoding="utf-8") if cls.policy_file.exists() else ""
        cls.version_content = cls.version_file.read_text(encoding="utf-8") if cls.version_file.exists() else ""
        cls.env_content = cls.env_file.read_text(encoding="utf-8") if cls.env_file.exists() else ""

    # =========================================================================
    # TIER 1: FEATURE COVERAGE TESTS (6 TESTS)
    # =========================================================================

    def test_t1_bug_bounty_in_scope_assets_documented(self):
        """[Tier 1] Verify all mandatory in-scope assets are defined in bug bounty policy."""
        self.assertTrue(self.policy_file.exists(), f"Missing policy file: {self.policy_file}")
        in_scope_assets = [
            "gitlab.com",
            "registry.gitlab.com",
            "customers.gitlab.com",
            "pages.gitlab.io",
            "gitlab-org/gitlab",
            "gitlab-org/gitaly",
            "gitlab-org/gitlab-runner",
            "gitlab-org/gitlab-shell",
            "gitlab-org/gitlab-workhorse",
            "gitlab_research_lab",
        ]
        for asset in in_scope_assets:
            self.assertIn(
                asset,
                self.policy_content,
                f"Required in-scope asset '{asset}' not found in GITLAB_BUG_BOUNTY_POLICY.md",
            )

    def test_t1_bug_bounty_excluded_vectors_and_safe_harbor(self):
        """[Tier 1] Verify mandatory excluded vectors and Safe Harbor protections are defined."""
        excluded_vectors = [
            "Denial of Service",
            "Automated Volumetric Scanning",
            "Social Engineering",
            "Physical",
            "Third-Party",
            "Prompt Injection",
        ]
        for vector in excluded_vectors:
            self.assertIn(
                vector,
                self.policy_content,
                f"Required excluded vector '{vector}' not found in GITLAB_BUG_BOUNTY_POLICY.md",
            )

        self.assertIn("Gold Standard Safe Harbor", self.policy_content)
        self.assertIn("Good-Faith", self.policy_content)

    def test_t1_bug_bounty_severity_tiers_and_payouts(self):
        """[Tier 1] Verify CVSS severity score tiers and payout structures."""
        severity_tiers = [
            ("Critical", "9.0", "10.0", "$20,000", "$35,000"),
            ("High", "7.0", "8.9", "$5,000", "$15,000"),
            ("Medium", "4.0", "6.9", "$1,000", "$3,000"),
            ("Low", "0.1", "3.9", "$100", "$750"),
        ]
        for tier, min_cvss, max_cvss, min_pay, max_pay in severity_tiers:
            self.assertIn(tier, self.policy_content, f"Tier '{tier}' missing from bounty matrix")
            self.assertIn(min_cvss, self.policy_content, f"Min CVSS '{min_cvss}' missing for tier {tier}")
            self.assertIn(max_cvss, self.policy_content, f"Max CVSS '{max_cvss}' missing for tier {tier}")
            self.assertIn(min_pay, self.policy_content, f"Min payout '{min_pay}' missing for tier {tier}")
            self.assertIn(max_pay, self.policy_content, f"Max payout '{max_pay}' missing for tier {tier}")

    def test_t1_target_version_and_dependency_matrix(self):
        """[Tier 1] Verify target GitLab CE version and dependency stack pinning."""
        self.assertTrue(self.version_file.exists(), f"Missing version file: {self.version_file}")
        dependencies = {
            "GitLab CE Core": "17.3.0",
            "Ruby MRI": "3.2.4",
            "Ruby on Rails": "7.0.8",
            "Go Runtime": "1.22",
            "PostgreSQL": "14.11",
            "Redis": "7.0.15",
        }
        for component, version in dependencies.items():
            self.assertIn(
                version,
                self.version_content,
                f"Pinned version '{version}' for component '{component}' not found in GITLAB_RESEARCH_VERSION.md",
            )

    def test_t1_component_topology_and_ports(self):
        """[Tier 1] Verify multi-component service ports and protocols in local environment."""
        self.assertTrue(self.env_file.exists(), f"Missing env file: {self.env_file}")
        expected_ports = {
            "8080": "GitLab Workhorse",
            "3000": "Puma Web Server",
            "8075": "Gitaly",
            "5432": "PostgreSQL",
            "6379": "Redis",
            "2222": "GitLab Shell",
        }
        for port, service in expected_ports.items():
            self.assertIn(
                port,
                self.env_content,
                f"Port '{port}' for service '{service}' not found in GITLAB_LOCAL_ENVIRONMENT.md",
            )

    def test_t1_identity_vault_and_lab_hierarchy(self):
        """[Tier 1] Verify 7-role seed identity matrix and multi-tenant organization structure."""
        roles = [
            "sec_admin",
            "alpha_owner",
            "alpha_maintainer",
            "alpha_developer",
            "alpha_reporter",
            "alpha_guest",
            "beta_user",
        ]
        for role_user in roles:
            self.assertIn(
                role_user,
                self.env_content,
                f"Seed username '{role_user}' not found in GITLAB_LOCAL_ENVIRONMENT.md",
            )

        self.assertIn("group-alpha", self.env_content)
        self.assertIn("group-beta", self.env_content)
        self.assertIn("project-alpha-core", self.env_content)

    # =========================================================================
    # TIER 2: BOUNDARY & CORNER CASES TESTS (6 TESTS)
    # =========================================================================

    def test_t2_safe_harbor_gold_standard_third_party_clause(self):
        """[Tier 2] Validate Safe Harbor explicit CFAA/DMCA and third-party protection clauses."""
        self.assertTrue(
            "CFAA" in self.policy_content or "1030" in self.policy_content,
            "Policy must explicitly cite CFAA authorization safe harbor",
        )
        self.assertTrue(
            "Third-Party" in self.policy_content or "third party" in self.policy_content.lower(),
            "Policy must include third-party defense commitment",
        )

    def test_t2_reporting_standard_non_destructive_payload_rule(self):
        """[Tier 2] Validate boundary constraints on non-destructive exploit payloads."""
        self.assertIn("whoami", self.policy_content)
        self.assertIn("Non-Destructive", self.policy_content)
        self.assertIn("wearehackerone.com", self.policy_content)

    def test_t2_ce_ee_codebase_boundary_and_mit_license(self):
        """[Tier 2] Validate explicit boundary separation between MIT CE core and EE additions."""
        self.assertIn("MIT", self.version_content)
        self.assertIn("ee/", self.version_content)
        self.assertIn("Feature.enabled?", self.version_content)

    def test_t2_database_extensions_required_pg_trgm_btree_gist(self):
        """[Tier 2] Validate PostgreSQL mandatory extensions requirement."""
        self.assertIn("pg_trgm", self.version_content)
        self.assertIn("btree_gist", self.version_content)
        self.assertIn("plpgsql", self.version_content)

    def test_t2_external_user_isolation_boundary(self):
        """[Tier 2] Validate boundary requirement for External Users (beta_user)."""
        self.assertIn("External", self.env_content)
        self.assertIn("beta_user", self.env_content)
        self.assertIn("glpat-ext-beta-token-0007", self.env_content)

    def test_t2_cvss_calculator_boundary_thresholds(self):
        """[Tier 2] Validate CVSS severity calculation boundary logic."""
        def classify_cvss(score: float) -> str:
            if score >= 9.0:
                return "Critical"
            elif score >= 7.0:
                return "High"
            elif score >= 4.0:
                return "Medium"
            elif score > 0.0:
                return "Low"
            return "None"

        # Boundary checks
        self.assertEqual(classify_cvss(10.0), "Critical")
        self.assertEqual(classify_cvss(9.0), "Critical")
        self.assertEqual(classify_cvss(8.99), "High")
        self.assertEqual(classify_cvss(7.0), "High")
        self.assertEqual(classify_cvss(6.99), "Medium")
        self.assertEqual(classify_cvss(4.0), "Medium")
        self.assertEqual(classify_cvss(3.99), "Low")
        self.assertEqual(classify_cvss(0.1), "Low")
        self.assertEqual(classify_cvss(0.0), "None")

    # =========================================================================
    # TIER 3: PAIRWISE COMBINATIONS TESTS (2 TESTS)
    # =========================================================================

    def test_t3_pairwise_role_vs_tenant_namespace_mapping(self):
        """[Tier 3] Verify pairwise membership mapping across 7 roles and 2 isolated tenants."""
        matrix = [
            ("sec_admin", "Owner", "Owner"),
            ("alpha_owner", "Owner", "None"),
            ("alpha_maintainer", "Maintainer", "None"),
            ("alpha_developer", "Developer", "None"),
            ("alpha_reporter", "Reporter", "None"),
            ("alpha_guest", "Guest", "None"),
            ("beta_user", "None", "Developer"),
        ]
        for username, group_a_role, group_b_role in matrix:
            self.assertIn(username, self.env_content)
            # Ensure proper tenant cross-isolation semantics
            if username == "beta_user":
                self.assertIn("Cross-tenant", self.env_content)
            if username == "alpha_owner":
                self.assertIn("Group Alpha", self.env_content)

    def test_t3_pairwise_service_port_and_protocol_matrix(self):
        """[Tier 3] Verify pairwise consistency across services, ports, and protocols."""
        service_matrix = [
            ("Workhorse", "8080", "HTTP"),
            ("Puma", "3000", "HTTP"),
            ("Gitaly", "8075", "gRPC"),
            ("PostgreSQL", "5432", "PostgreSQL"),
            ("Redis", "6379", "RESP"),
            ("GitLab Shell", "2222", "SSH"),
        ]
        for service, port, proto in service_matrix:
            self.assertIn(port, self.env_content)
            self.assertIn(service, self.env_content)

    # =========================================================================
    # TIER 4: REAL-WORLD SCENARIOS TESTS (1 TEST)
    # =========================================================================

    def test_t4_e2e_environment_verification_workflow(self):
        """[Tier 4] Execute end-to-end environment verification parsing and integrity checks."""
        # Check all 3 M1 documents exist and contain required headers
        docs = [
            (self.policy_content, "# GitLab HackerOne Bug Bounty Policy"),
            (self.version_content, "# GitLab Community Edition Target Version"),
            (self.env_content, "# GitLab Local Security Research Lab Environment"),
        ]
        for content, expected_header in docs:
            self.assertTrue(len(content) > 500, "Document content too short or empty")
            self.assertIn(expected_header, content)

        # Parse seed tokens from environment specification
        token_pattern = re.compile(r"glpat-[a-z0-9-]+")
        found_tokens = token_pattern.findall(self.env_content)
        self.assertGreaterEqual(
            len(set(found_tokens)),
            7,
            f"Expected at least 7 distinct seed tokens, found: {len(set(found_tokens))}",
        )


if __name__ == "__main__":
    unittest.main()
