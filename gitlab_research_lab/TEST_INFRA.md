# E2E Test Infra: GitLab Security Research Lab

## Test Philosophy
- Requirement-driven, opaque-box and clean-room testing.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Interaction Testing + Real-World Workload Testing.
- Strict isolation: Verifier tests operate without shared state with exploratory scripts.

## Feature Inventory & Test Coverage Goals
| # | Feature | Requirement | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|-------------|:-----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Bug-Bounty Policy & Environment | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Authorization Model & Matrix | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | Multi-Interface Differential Engine | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Hypothesis & Clean-Room Verifier | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Prior-Art Clearance & Disclosure | R5 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- **Master Test Runner**: `gitlab_research_lab/tests/run_all_research_tests.py`
- **Exit Code**: 0 for 100% pass, non-zero on any failure.
- **Pass Semantics**: All individual test assertions must pass; zero unhandled exceptions; positive and negative controls strictly validated.

## Coverage Thresholds
- Tier 1 (Feature Coverage): >= 25 tests across all 5 milestones.
- Tier 2 (Boundary & Corner Cases): >= 25 tests covering edge cases (e.g., external user permissions, disabled project features, cyclic group sharing, invalid token scopes).
- Tier 3 (Pairwise Combinations): >= 5 tests validating cross-interface and cross-module interactions (REST vs GraphQL vs Policy vs Workers).
- Tier 4 (Real-World Scenarios): >= 5 tests validating full end-to-end research workflows (from hypothesis to verification to prior-art clearance and disclosure generation).
- **Total Minimum Target**: >= 60 test cases across the test suite.
