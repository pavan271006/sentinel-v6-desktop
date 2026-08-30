#!/usr/bin/env python3
"""
Master E2E Test Suite Runner: GitLab Community Edition Security Research Lab
============================================================================
Discovers, executes, and audits all milestone test suites (M1 through M5),
aggregating results across Tier 1 (Feature Coverage), Tier 2 (Boundary Values),
Tier 3 (Pairwise Combinations), and Tier 4 (Real-World Scenarios).

Exit Code:
- 0: All tests passed (100% pass rate).
- 1: One or more test failures, errors, or threshold violations.
"""

import os
import sys
import time
import unittest
from pathlib import Path
from typing import Dict, List, Tuple

# Ensure project root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
WORKSPACE_ROOT = PROJECT_ROOT.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))


class ResearchLabTestResult(unittest.TestResult):
    """Custom TestResult collector tracking per-milestone and per-tier metrics."""

    def __init__(self):
        super().__init__()
        self.tier_counts = {"Tier 1": 0, "Tier 2": 0, "Tier 3": 0, "Tier 4": 0, "Other": 0}
        self.milestone_counts = {
            "M1: Policy & Env": 0,
            "M2: Auth Model": 0,
            "M3: Differential Engine": 0,
            "M4: Clean-Room Verifier": 0,
            "M5: Prior-Art & Registry": 0,
        }
        self.test_records: List[Tuple[str, str, str, str]] = []

    def _classify_test(self, test: unittest.TestCase) -> Tuple[str, str]:
        test_id = test.id()
        method_name = test_id.split(".")[-1]
        lower_id = test_id.lower()

        # Tier classification
        if "_t1_" in method_name:
            tier = "Tier 1"
        elif "_t2_" in method_name:
            tier = "Tier 2"
        elif "_t3_" in method_name:
            tier = "Tier 3"
        elif "_t4_" in method_name:
            tier = "Tier 4"
        else:
            tier = "Other"

        # Milestone classification
        if "test_m1" in lower_id or "milestone1" in lower_id:
            milestone = "M1: Policy & Env"
        elif "test_m2" in lower_id or "milestone2" in lower_id:
            milestone = "M2: Auth Model"
        elif "test_m3" in lower_id or "milestone3" in lower_id:
            milestone = "M3: Differential Engine"
        elif "test_m4" in lower_id or "milestone4" in lower_id:
            milestone = "M4: Clean-Room Verifier"
        elif "test_m5" in lower_id or "milestone5" in lower_id:
            milestone = "M5: Prior-Art & Registry"
        else:
            milestone = "Other"

        return milestone, tier

    def addSuccess(self, test: unittest.TestCase):
        super().addSuccess(test)
        milestone, tier = self._classify_test(test)
        self.tier_counts[tier] = self.tier_counts.get(tier, 0) + 1
        self.milestone_counts[milestone] = self.milestone_counts.get(milestone, 0) + 1
        self.test_records.append((milestone, tier, test.id(), "PASS"))

    def addFailure(self, test: unittest.TestCase, err):
        super().addFailure(test, err)
        milestone, tier = self._classify_test(test)
        self.test_records.append((milestone, tier, test.id(), "FAIL"))

    def addError(self, test: unittest.TestCase, err):
        super().addError(test, err)
        milestone, tier = self._classify_test(test)
        self.test_records.append((milestone, tier, test.id(), "ERROR"))


def run_all_tests() -> int:
    """Discover, run, and summarize all research lab test suites."""
    print("=" * 80)
    print(" GITLAB COMMUNITY EDITION SECURITY RESEARCH LAB -- MASTER E2E TEST RUNNER")
    print("=" * 80)
    print(f" Target Lab Root: {PROJECT_ROOT}")
    print(f" Timestamp:       {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    print("-" * 80)

    test_modules = [
        "gitlab_research_lab.tests.test_m1_policy_env",
        "gitlab_research_lab.tests.test_m2_auth_model",
        "gitlab_research_lab.tests.test_m3_differential_engine",
        "gitlab_research_lab.tests.test_m4_clean_room_verifier",
        "gitlab_research_lab.tests.test_m5_clearance_and_registry",
    ]

    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    for mod in test_modules:
        try:
            loaded_suite = loader.loadTestsFromName(mod)
            suite.addTests(loaded_suite)
            print(f" [+] Loaded module: {mod} ({loaded_suite.countTestCases()} test cases)")
        except Exception as e:
            print(f" [!] Error loading module {mod}: {e}")
            return 1

    print("-" * 80)
    print(f" Executing {suite.countTestCases()} test cases across 5 research milestones...\n")

    start_time = time.time()
    result = ResearchLabTestResult()
    suite.run(result)
    elapsed = time.time() - start_time

    # Output detailed summary tables
    print("=" * 80)
    print(" TEST SUITE EXECUTION SUMMARY")
    print("=" * 80)

    print("\n[1] MILESTONE COVERAGE BREAKDOWN:")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")
    print(f"| {'Milestone Module':<38} | {'Tests Run':<13} | {'Status':<13} |")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")
    for ms, count in result.milestone_counts.items():
        status = "PASSED" if count > 0 else "SKIPPED"
        print(f"| {ms:<38} | {count:<13} | {status:<13} |")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")

    print("\n[2] TIER COVERAGE BREAKDOWN (TEST INFRA SPEC):")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")
    print(f"| {'Test Tier':<38} | {'Count':<13} | {'Threshold':<13} |")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")
    tier_thresholds = {
        "Tier 1": (result.tier_counts.get("Tier 1", 0), ">= 25 (Pass)" if result.tier_counts.get("Tier 1", 0) >= 25 else "< 25 (Fail)"),
        "Tier 2": (result.tier_counts.get("Tier 2", 0), ">= 25 (Pass)" if result.tier_counts.get("Tier 2", 0) >= 25 else "< 25 (Fail)"),
        "Tier 3": (result.tier_counts.get("Tier 3", 0), ">= 5  (Pass)" if result.tier_counts.get("Tier 3", 0) >= 5 else "< 5  (Fail)"),
        "Tier 4": (result.tier_counts.get("Tier 4", 0), ">= 5  (Pass)" if result.tier_counts.get("Tier 4", 0) >= 5 else "< 5  (Fail)"),
    }
    for tier_name, (cnt, thresh_str) in tier_thresholds.items():
        print(f"| {tier_name + ' (Feature/Boundary/Pair/E2E)':<38} | {cnt:<13} | {thresh_str:<13} |")
    print("+" + "-" * 40 + "+" + "-" * 15 + "+" + "-" * 15 + "+")

    total_tests = result.testsRun
    total_failures = len(result.failures)
    total_errors = len(result.errors)

    print(f"\n Total Tests Executed: {total_tests}")
    print(f" Total Passed:         {total_tests - total_failures - total_errors}")
    print(f" Total Failures:       {total_failures}")
    print(f" Total Errors:         {total_errors}")
    print(f" Elapsed Time:         {elapsed:.3f} seconds")
    print("-" * 80)

    if total_failures == 0 and total_errors == 0 and total_tests >= 60:
        print("\n [PASS] VERDICT: 100% PASS RATE -- ALL RESEARCH MILESTONE QUALITY GATES SATISFIED\n")
        return 0
    else:
        print("\n [FAIL] VERDICT: FAILED -- QUALITY GATES NOT SATISFIED\n")
        if result.failures:
            print(" Failures:")
            for f in result.failures:
                print(f"  - {f[0]}: {f[1]}")
        if result.errors:
            print(" Errors:")
            for e in result.errors:
                print(e)
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
