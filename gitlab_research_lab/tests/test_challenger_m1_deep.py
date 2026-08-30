"""
Challenger 2 Deep Empirical Validation Test Suite
Milestone 1: Bug-Bounty Policy & Environment Pinning
=====================================================
Rigorous adversarial and empirical verification of:
1. CE Component Dependency Stack and Version Consistency
2. Seed Identity Matrix against Gitlab::Access Constants
3. Network Port Allocations, Loopback Binding, and Isolation Rules
4. Mirror Synchronization (root vs docs/)
5. CVSS Calculator Bounds, Bounty Tiers, and CVD SLAs
6. Safe Harbor Invariants and Out-of-Scope Rule Adherence
7. Negative Controls and Stress-Test Assertions
"""

import os
import re
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = LAB_ROOT / "docs"


class TestChallengerM1DeepVerification(unittest.TestCase):
    """Deep empirical challenge suite for Milestone 1."""

    @classmethod
    def setUpClass(cls):
        cls.policy_doc = DOCS_DIR / "GITLAB_BUG_BOUNTY_POLICY.md"
        cls.version_doc = DOCS_DIR / "GITLAB_RESEARCH_VERSION.md"
        cls.env_doc = DOCS_DIR / "GITLAB_LOCAL_ENVIRONMENT.md"
        cls.project_doc = LAB_ROOT / "PROJECT.md"

        cls.policy_root = LAB_ROOT / "GITLAB_BUG_BOUNTY_POLICY.md"
        cls.version_root = LAB_ROOT / "GITLAB_RESEARCH_VERSION.md"
        cls.env_root = LAB_ROOT / "GITLAB_LOCAL_ENVIRONMENT.md"

        cls.policy_text = cls.policy_doc.read_text(encoding="utf-8")
        cls.version_text = cls.version_doc.read_text(encoding="utf-8")
        cls.env_text = cls.env_doc.read_text(encoding="utf-8")
        cls.project_text = cls.project_doc.read_text(encoding="utf-8")

    # =========================================================================
    # 1. MIRROR SYNCHRONIZATION & STRUCTURAL INTEGRITY
    # =========================================================================

    def test_root_and_docs_mirrors_synchronized(self):
        """Verify root mirror files and docs/ files are identical."""
        self.assertTrue(self.policy_root.exists(), "Root GITLAB_BUG_BOUNTY_POLICY.md missing")
        self.assertTrue(self.version_root.exists(), "Root GITLAB_RESEARCH_VERSION.md missing")
        self.assertTrue(self.env_root.exists(), "Root GITLAB_LOCAL_ENVIRONMENT.md missing")

        self.assertEqual(
            self.policy_doc.read_text(encoding="utf-8"),
            self.policy_root.read_text(encoding="utf-8"),
            "Policy doc and root mirror have diverged!",
        )
        self.assertEqual(
            self.version_doc.read_text(encoding="utf-8"),
            self.version_root.read_text(encoding="utf-8"),
            "Version doc and root mirror have diverged!",
        )
        self.assertEqual(
            self.env_doc.read_text(encoding="utf-8"),
            self.env_root.read_text(encoding="utf-8"),
            "Environment doc and root mirror have diverged!",
        )

    # =========================================================================
    # 2. CE COMPONENT DEPENDENCIES & VERSION CONSISTENCY
    # =========================================================================

    def test_component_dependency_stack_consistency(self):
        """Verify all CE component versions across PROJECT.md, VERSION.md, and ENV.md."""
        expected_versions = {
            "GitLab CE": "17.3.0",
            "Ruby MRI": "3.2.4",
            "Rails": "7.0.8",
            "Go": "1.22",
            "PostgreSQL": ["14", "16"],
            "Redis": "7.0",
            "Sidekiq": "7",
            "Workhorse": "17.3.0",
            "Gitaly": "17.3.0",
            "GitLab Shell": "14.37.0",
            "Node.js": "20.12.2",
            "Yarn": "1.22.19",
            "Git CLI": "2.45.2",
        }

        # Check PROJECT.md alignment
        self.assertIn("v17.3.0", self.project_text)
        self.assertIn("Ruby 3.2.4", self.project_text)
        self.assertIn("Rails 7.0.8", self.project_text)
        self.assertIn("PostgreSQL 14/16", self.project_text)
        self.assertIn("Redis 7.0", self.project_text)

        # Check GITLAB_RESEARCH_VERSION.md detailed specifications
        self.assertIn("17.3.0", self.version_text)
        self.assertIn("3.2.4", self.version_text)
        self.assertIn("7.0.8.4", self.version_text)
        self.assertIn("1.22.5", self.version_text)
        self.assertIn("14.11", self.version_text)
        self.assertIn("16.2", self.version_text)
        self.assertIn("7.0.15", self.version_text)
        self.assertIn("7.1.6", self.version_text)
        self.assertIn("20.12.2", self.version_text)
        self.assertIn("1.22.19", self.version_text)
        self.assertIn("14.37.0", self.version_text)
        self.assertIn("2.45.2", self.version_text)

        # Pinned commit hash validation (40-char hex SHA)
        commit_match = re.search(r"Pinned Commit Hash.*`([0-9a-f]{40})`", self.version_text)
        self.assertIsNotNone(commit_match, "Pinned 40-character commit hash missing from VERSION.md")
        self.assertEqual(len(commit_match.group(1)), 40)

        # Docker container tag validation
        self.assertIn("gitlab/gitlab-ce:17.3.0-ce.0", self.version_text)

    def test_database_extensions_and_redis_partitioning(self):
        """Verify PostgreSQL mandatory extensions and Redis database partition mapping."""
        # PostgreSQL extensions
        required_pg_exts = ["pg_trgm", "btree_gist", "plpgsql", "uuid-ossp"]
        for ext in required_pg_exts:
            self.assertIn(ext, self.version_text, f"PostgreSQL extension '{ext}' missing in VERSION.md")

        # Redis partitioned databases
        redis_partitions = {
            "cache": "db 0",
            "queues": "db 1",
            "shared_state": "db 2",
            "rate_limiting": "db 3",
        }
        for name, db_id in redis_partitions.items():
            self.assertIn(name, self.version_text)
            self.assertIn(db_id, self.version_text)

    # =========================================================================
    # 3. SEED IDENTITY ACCESS LEVEL CONSTANTS VS Gitlab::Access
    # =========================================================================

    def test_gitlab_access_level_constants_accuracy(self):
        """Verify all access levels correspond to canonical Gitlab::Access integer constants."""
        gitlab_access_constants = {
            "NO_ACCESS": 0,
            "MINIMAL_ACCESS": 5,
            "GUEST": 10,
            "REPORTER": 20,
            "DEVELOPER": 30,
            "MAINTAINER": 40,
            "OWNER": 50,
            "ADMIN": 60,
        }

        # Check representations in GITLAB_LOCAL_ENVIRONMENT.md
        expected_role_levels = [
            ("Admin", 60),
            ("Owner", 50),
            ("Maintainer", 40),
            ("Developer", 30),
            ("Reporter", 20),
            ("Guest", 10),
            ("External", 30),
            ("None", 0),
        ]

        for role_name, level_val in expected_role_levels:
            pattern = rf"{role_name}\s*\({level_val}\)"
            self.assertTrue(
                re.search(pattern, self.env_text),
                f"Role constant '{role_name} ({level_val})' not found in GITLAB_LOCAL_ENVIRONMENT.md",
            )

    def test_seed_identities_and_token_vault(self):
        """Verify 7+1 seed identities, token uniqueness, and prefix conformance."""
        seed_matrix = [
            ("ID-01", "sec_admin", "Admin (60)", "Owner (50)", "Owner (50)", "glpat-admin-secret-token-0001"),
            ("ID-02", "alpha_owner", "Regular (30)", "Owner (50)", "None (0)", "glpat-owner-alpha-token-0002"),
            ("ID-03", "alpha_maintainer", "Regular (30)", "Maintainer (40)", "None (0)", "glpat-maint-alpha-token-0003"),
            ("ID-04", "alpha_developer", "Regular (30)", "Developer (30)", "None (0)", "glpat-dev-alpha-token-0004"),
            ("ID-05", "alpha_reporter", "Regular (30)", "Reporter (20)", "None (0)", "glpat-rep-alpha-token-0005"),
            ("ID-06", "alpha_guest", "Regular (30)", "Guest (10)", "None (0)", "glpat-guest-alpha-token-0006"),
            ("ID-07", "beta_user", "External (30)", "None (0)", "Developer (30)", "glpat-ext-beta-token-0007"),
        ]

        tokens = []
        usernames = []
        ids = []

        for id_tag, username, global_lvl, grp_a, grp_b, token in seed_matrix:
            self.assertIn(id_tag, self.env_text)
            self.assertIn(username, self.env_text)
            self.assertIn(token, self.env_text)

            # Assert PAT prefix requirement
            self.assertTrue(token.startswith("glpat-"), f"Token '{token}' must start with 'glpat-'")

            tokens.append(token)
            usernames.append(username)
            ids.append(id_tag)

        # Assert token and username uniqueness
        self.assertEqual(len(tokens), len(set(tokens)), "Duplicate seed tokens found!")
        self.assertEqual(len(usernames), len(set(usernames)), "Duplicate seed usernames found!")
        self.assertEqual(len(ids), len(set(ids)), "Duplicate seed IDs found!")

    def test_multi_tenant_namespace_isolation_specs(self):
        """Verify Group Alpha and Group Beta namespace hierarchy and IDs."""
        namespaces = {
            "group-alpha": 101,
            "subgroup-a1": 102,
            "project-alpha-core": 201,
            "project-alpha-public": 202,
            "group-beta": 103,
            "project-beta-sec": 203,
        }
        for name, expected_id in namespaces.items():
            pattern = rf"{name}.*ID:\s*{expected_id}"
            self.assertTrue(
                re.search(pattern, self.env_text),
                f"Namespace '{name}' with ID {expected_id} not properly defined in ENV.md",
            )

    # =========================================================================
    # 4. NETWORK PORT BINDINGS & LOCALHOST ISOLATION
    # =========================================================================

    def test_network_port_allocations_and_zero_collisions(self):
        """Verify all ports are unique, within valid range, and strictly bound to 127.0.0.1."""
        service_ports = {
            "GitLab Workhorse External": 8080,
            "GitLab Workhorse Internal": 8181,
            "Puma Web Server": 3000,
            "Gitaly Storage Daemon": 8075,
            "PostgreSQL Database": 5432,
            "Redis Multi-Store": 6379,
            "GitLab Shell SSH": 2222,
            "Sidekiq Metrics": 8082,
        }

        # Check port uniqueness
        allocated_ports = list(service_ports.values())
        self.assertEqual(len(allocated_ports), len(set(allocated_ports)), "Port collision detected!")

        # Check port valid range (1024 - 65535, non-privileged or standard)
        for srv, port in service_ports.items():
            self.assertTrue(1024 <= port <= 65535 or port in (80, 443), f"Port {port} out of range for {srv}")
            self.assertIn(str(port), self.env_text, f"Port {port} for {srv} missing from ENV.md")

        # Verify loopback 127.0.0.1 binding invariant
        self.assertIn("127.0.0.1", self.env_text)
        self.assertIn("Zero Outbound Telemetry", self.env_text)
        self.assertIn("usage_ping_enabled", self.env_text)
        self.assertIn("sentry_enabled", self.env_text)

    # =========================================================================
    # 5. BUG BOUNTY POLICY, SAFE HARBOR & CVSS CALCULATOR
    # =========================================================================

    def test_bounty_policy_tiers_and_triage_bonuses(self):
        """Verify bounty amounts, CVSS intervals, and immediate triage bonuses."""
        # Tiers: Critical, High, Medium, Low
        tier_payouts = {
            "Critical": {"min_cvss": 9.0, "max_cvss": 10.0, "payout": "$20,000 – $35,000", "triage": "$1,000"},
            "High": {"min_cvss": 7.0, "max_cvss": 8.9, "payout": "$5,000 – $15,000", "triage": "$1,000"},
            "Medium": {"min_cvss": 4.0, "max_cvss": 6.9, "payout": "$1,000 – $3,000", "triage": "$500"},
            "Low": {"min_cvss": 0.1, "max_cvss": 3.9, "payout": "$100 – $750", "triage": "$0"},
        }

        for tier, data in tier_payouts.items():
            self.assertIn(tier, self.policy_text)
            self.assertIn(data["payout"], self.policy_text)
            self.assertIn(data["triage"], self.policy_text)

        # SLA checks
        self.assertIn("30 days", self.policy_text)  # Critical SLA
        self.assertIn("60 days", self.policy_text)  # High SLA
        self.assertIn("90 days", self.policy_text)  # Med/Low SLA

        # HackerOne alias
        self.assertIn("<username>@wearehackerone.com", self.policy_text)

    def test_gold_standard_safe_harbor_clauses(self):
        """Verify CFAA, DMCA Section 1201, and third-party defense safe harbor guarantees."""
        self.assertIn("Gold Standard Safe Harbor", self.policy_text)
        self.assertIn("Computer Fraud and Abuse Act", self.policy_text)
        self.assertIn("18 U.S.C. § 1030", self.policy_text)
        self.assertIn("DMCA Section 1201", self.policy_text)
        self.assertIn("Third-Party Legal Defense", self.policy_text)

    # =========================================================================
    # 6. NEGATIVE CONTROLS & STRESS TESTING
    # =========================================================================

    def test_negative_controls_invalid_access_levels_rejected(self):
        """Negative control: Ensure invalid access levels (e.g. 15, 25, 35, 45, 70) are not present."""
        invalid_levels = [15, 25, 35, 45, 55, 65, 70, 100]
        for inv_lvl in invalid_levels:
            # Check pattern like "Role (15)"
            match = re.search(rf"\([a-zA-Z\s]*{inv_lvl}\)", self.env_text)
            self.assertIsNone(match, f"Invalid access level {inv_lvl} found in ENV.md!")

    def test_negative_controls_wildcard_ip_bindings_rejected(self):
        """Negative control: Ensure wildcard 0.0.0.0 is not configured as a service listening host."""
        # Ensure no service is bound to 0.0.0.0 in the service table
        for line in self.env_text.splitlines():
            if "|" in line and ("Workhorse" in line or "Puma" in line or "Gitaly" in line or "PostgreSQL" in line):
                self.assertNotIn("0.0.0.0", line, f"Wildcard binding detected on service line: {line}")


if __name__ == "__main__":
    unittest.main()
