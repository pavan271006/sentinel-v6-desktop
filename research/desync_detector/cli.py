"""
CLI Entrypoint for Temporal State Desynchronization Detector (TSDE)
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from research.desync_detector.core import TemporalStateDesyncDetector

def main():
    parser = argparse.ArgumentParser(description="TSDE - Temporal State Desynchronization Vulnerability Scanner")
    parser.add_argument("--url", default="http://127.0.0.1:8888", help="Target base URL")
    parser.add_argument("--token-a", required=True, help="Bearer token for Identity A (Victim)")
    parser.add_argument("--token-b", required=True, help="Bearer token for Identity B (Attacker)")
    parser.add_argument("--budget", type=int, default=50, help="Max request budget")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")

    args = parser.parse_args()

    detector = TemporalStateDesyncDetector(args.url, request_budget=args.budget)
    res = detector.scan_workflow(args.token_a, args.token_b)

    if args.json:
        print(json.dumps(res, indent=2))
    else:
        diff = res.get("differential_result", {})
        print(f"=== TSDE SCAN REPORT: {args.url} ===")
        print(f"Workflow ID: {res.get('workflow_id')}")
        print(f"Requests Used: {res.get('requests_used')}")
        print(f"Elapsed Time: {res.get('elapsed_seconds')}s")
        print(f"Vulnerability Detected: {diff.get('vulnerability_detected')}")
        print(f"Confidence: {diff.get('confidence')}")
        print(f"Pre-Rollback HTTP Code: {diff.get('pre_rollback_code')}")
        print(f"Rollback HTTP Code: {diff.get('rollback_code')}")
        print(f"Post-Rollback HTTP Code: {diff.get('post_rollback_code')}")
        if diff.get("vulnerability_detected"):
            print(">>> CRITICAL FINDING: Asynchronous Context Dissociation Confirmed! <<<")

    if res.get("differential_result", {}).get("vulnerability_detected"):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
