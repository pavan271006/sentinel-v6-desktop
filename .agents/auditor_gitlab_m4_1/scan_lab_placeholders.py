import os
import re

PATTERNS = [
    r"NotImplementedError",
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\bpass\s*#\s*todo",
]

lab_dir = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab"

print("Scanning gitlab_research_lab files for placeholders...")
found = 0
for root, _, files in os.walk(lab_dir):
    for f in files:
        if f.endswith((".py", ".md", ".yaml", ".json")):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                for line_no, line in enumerate(fh, 1):
                    for pat in PATTERNS:
                        if re.search(pat, line, re.IGNORECASE):
                            print(f"[{os.path.relpath(path, lab_dir)}:{line_no}] Matched {pat}: {line.strip()}")
                            found += 1

print(f"Total placeholder pattern matches found: {found}")
