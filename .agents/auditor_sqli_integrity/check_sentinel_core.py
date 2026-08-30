import os
import datetime

print("=== CHECKING SENTINEL_CORE DIRECTORY TIMESTAMPS ===")
sentinel_core_dir = os.path.abspath("sentinel_core")
recent_cutoff = datetime.datetime(2026, 8, 30, 0, 0, 0)

any_recent = False
for root, dirs, files in os.walk(sentinel_core_dir):
    if "target" in root:
        continue
    for f in files:
        fp = os.path.join(root, f)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(fp))
        if mtime >= recent_cutoff:
            print(f"RECENT FILE FOUND: {fp} (mtime: {mtime})")
            any_recent = True

if not any_recent:
    print("CONFIRMED: Zero files in sentinel_core have been touched on or after 2026-08-30.")
else:
    print("ALERT: Modifications found in sentinel_core!")

print("=== SENTINEL_CORE CHECK COMPLETE ===")
