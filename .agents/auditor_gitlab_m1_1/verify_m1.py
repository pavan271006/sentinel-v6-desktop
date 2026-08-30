import os
import hashlib
import re

files = [
    'gitlab_research_lab/docs/GITLAB_BUG_BOUNTY_POLICY.md',
    'gitlab_research_lab/GITLAB_BUG_BOUNTY_POLICY.md',
    'gitlab_research_lab/docs/GITLAB_RESEARCH_VERSION.md',
    'gitlab_research_lab/GITLAB_RESEARCH_VERSION.md',
    'gitlab_research_lab/docs/GITLAB_LOCAL_ENVIRONMENT.md',
    'gitlab_research_lab/GITLAB_LOCAL_ENVIRONMENT.md'
]

print("=== TARGET FILES AUDIT ===")
all_exist = True
for f in files:
    if os.path.exists(f):
        data = open(f, 'rb').read()
        digest = hashlib.sha256(data).hexdigest()
        print(f"File: {f}")
        print(f"  Size: {len(data)} bytes")
        print(f"  SHA-256: {digest}")
    else:
        print(f"File: {f} MISSING!")
        all_exist = False

print("\n=== MIRROR PARITY CHECK ===")
pairs = [
    ('gitlab_research_lab/docs/GITLAB_BUG_BOUNTY_POLICY.md', 'gitlab_research_lab/GITLAB_BUG_BOUNTY_POLICY.md'),
    ('gitlab_research_lab/docs/GITLAB_RESEARCH_VERSION.md', 'gitlab_research_lab/GITLAB_RESEARCH_VERSION.md'),
    ('gitlab_research_lab/docs/GITLAB_LOCAL_ENVIRONMENT.md', 'gitlab_research_lab/GITLAB_LOCAL_ENVIRONMENT.md')
]
for doc, root in pairs:
    d_data = open(doc, 'rb').read()
    r_data = open(root, 'rb').read()
    match = (d_data == r_data)
    print(f"{doc} == {root}: {match}")

print("\n=== PROHIBITED PATTERNS CHECK ===")
# Search for placeholders, todo, fixme, dummy, placeholder, lorem ipsum
prohibited_patterns = [
    r'\bTODO\b',
    r'\bFIXME\b',
    r'\bTBD\b',
    r'\bXXX\b',
    r'lorem ipsum',
    r'dummy',
    r'placeholder',
    r'<insert',
    r'\[insert',
    r'not yet implemented',
    r'mock',
    r'fake'
]

for f in files:
    content = open(f, 'r', encoding='utf-8', errors='ignore').read()
    print(f"\nChecking prohibited patterns in {f}:")
    violations = 0
    for pat in prohibited_patterns:
        matches = list(re.finditer(pat, content, re.IGNORECASE))
        if matches:
            for m in matches:
                # print context
                start = max(0, m.start() - 30)
                end = min(len(content), m.end() + 30)
                snippet = content[start:end].replace('\n', ' ')
                print(f"  [FLAG] Pattern '{pat}' found at char {m.start()}: '...{snippet}...'")
                violations += 1
    if violations == 0:
        print("  0 prohibited patterns found. Clean.")
