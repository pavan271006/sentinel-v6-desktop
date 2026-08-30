import os
import re

root_dir = r'c:\Users\Legion 5 pro\Desktop\cyber sec'

print("="*80)
print("V7 PARALLEL CRATES / DIRECTORIES / FORKS AUDIT")
print("="*80)

v7_items = []

for root, dirs, files in os.walk(root_dir):
    # Check directories
    for d in dirs:
        if d.startswith('.agents') or d == '.git' or d == 'target' or d == 'node_modules':
            continue
        if re.search(r'\bv7\b', d, re.IGNORECASE) or 'sentinel_v7' in d.lower():
            v7_items.append(('DIR', os.path.join(root, d)))
            
    # Check files
    for f in files:
        if root.startswith(os.path.join(root_dir, '.agents')) or 'node_modules' in root or 'target' in root:
            continue
        if re.search(r'\bv7\b', f, re.IGNORECASE) or 'sentinel_v7' in f.lower():
            # Exclude documentation files that discuss "No V7 fork" or comparisons
            if not f.endswith('.md'):
                v7_items.append(('FILE', os.path.join(root, f)))

print(f"V7 Artifacts found in codebase/workspace: {len(v7_items)}")
for t, path in v7_items:
    print(f"  [{t}] {path}")

if not v7_items:
    print("\nPASSED: Zero parallel V7 crates, directories, or binaries found.")
