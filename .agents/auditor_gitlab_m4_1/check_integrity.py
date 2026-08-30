import os
import datetime
import hashlib

print("--- INTEGRITY CHECK ---")

# 1. Check SHA256 parity
docs_path = 'gitlab_research_lab/docs/GITLAB_HYPOTHESIS_CATALOG.md'
root_path = 'gitlab_research_lab/GITLAB_HYPOTHESIS_CATALOG.md'

h1 = hashlib.sha256(open(docs_path, 'rb').read()).hexdigest()
h2 = hashlib.sha256(open(root_path, 'rb').read()).hexdigest()

print(f"Catalog docs SHA-256: {h1}")
print(f"Catalog root SHA-256: {h2}")
print(f"Parity Match: {h1 == h2}")

# 2. Check modifications in sentinel_core and architecture
target_dirs = ['sentinel_core', 'architecture']
cutoff = datetime.datetime(2026, 8, 21, 0, 0, 0).timestamp()
modified = []
total_scanned = 0

for d in target_dirs:
    if not os.path.exists(d):
        continue
    for root, dirs, files in os.walk(d):
        for f in files:
            total_scanned += 1
            fp = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(fp)
                if mtime > cutoff:
                    modified.append((fp, datetime.datetime.fromtimestamp(mtime).isoformat()))
            except Exception as e:
                pass

print(f"Total scanned files in sentinel_core and architecture: {total_scanned}")
print(f"Modified files today (since 2026-08-21 00:00:00): {len(modified)}")
for m in modified:
    print(f"  {m[0]}: {m[1]}")

print("Integrity check complete.")
