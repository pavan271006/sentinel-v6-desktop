import os
import re

PATTERNS = [
    r"NotImplementedError",
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\bdummy\b",
    r"\bfake\b",
    r"\bmock\b",
    r"return\s+True\s*#.*dummy",
]

verifier_dir = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab\verifier"

print("Scanning verifier files for suspicious patterns...")
found = 0
for root, _, files in os.walk(verifier_dir):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as fh:
                for line_no, line in enumerate(fh, 1):
                    for pat in PATTERNS:
                        if re.search(pat, line, re.IGNORECASE):
                            print(f"[{f}:{line_no}] Matched {pat}: {line.strip()}")
                            found += 1

print(f"Total pattern matches found: {found}")
