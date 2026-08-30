"""
Differential Security Engine - Standalone CLI
Module: research.theory_lab.differential_engine.cli
"""

import sys
import os
import argparse
import json

from .models import ResponseSnapshot, DifferentialAxis
from .engine import DifferentialSecurityEngine, welch_t_test


def main():
    parser = argparse.ArgumentParser(description="SENTINEL V6 Differential Security Engine CLI")
    parser.add_argument("--axis", choices=[a.value for a in DifferentialAxis], default=DifferentialAxis.ROLE_A_VS_ROLE_B.value, help="Differential comparison axis")
    parser.add_argument("--status-a", type=int, default=200, help="Baseline HTTP status code")
    parser.add_argument("--status-b", type=int, default=200, help="Candidate HTTP status code")
    parser.add_argument("--body-a", type=str, default="{\"user\":\"alice\",\"role\":\"admin\",\"session\":\"1111-2222-3333\"}", help="Baseline response body")
    parser.add_argument("--body-b", type=str, default="{\"user\":\"bob\",\"role\":\"user\",\"session\":\"4444-5555-6666\"}", help="Candidate response body")
    parser.add_argument("--entropy-threshold", type=float, default=3.8, help="Shannon entropy threshold for volatile masking")
    
    args = parser.parse_args()

    engine = DifferentialSecurityEngine(entropy_threshold=args.entropy_threshold)
    snap_a = ResponseSnapshot(status_code=args.status_a, body=args.body_a)
    snap_b = ResponseSnapshot(status_code=args.status_b, body=args.body_b)

    axis = DifferentialAxis(args.axis)
    res = engine.analyze_divergence(snap_a, snap_b, axis)

    print(json.dumps(res.to_dict(), indent=2))


if __name__ == "__main__":
    main()
