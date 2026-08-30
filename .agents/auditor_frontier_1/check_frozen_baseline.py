import os
import time
import datetime

frozen_dirs = [
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\frontend',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6'
]

# Frontier research started around 2026-08-22 16:57 UTC (22:27 local time)
frontier_start_ts = datetime.datetime(2026, 8, 22, 22, 20).timestamp()

print("="*80)
print("FROZEN BASELINE INTEGRITY AUDIT")
print("="*80)

modified_recently = []
total_files = 0

for d in frozen_dirs:
    if not os.path.exists(d):
        print(f"Directory not found: {d}")
        continue
    dir_files = 0
    for root, _, files in os.walk(d):
        for f in files:
            total_files += 1
            dir_files += 1
            fpath = os.path.join(root, f)
            mtime = os.path.getmtime(fpath)
            if mtime > frontier_start_ts:
                modified_recently.append((fpath, mtime))
    print(f"Verified {dir_files:>4} files in {d}")

print(f"\nTotal files checked in frozen baseline: {total_files}")
print(f"Files modified after Frontier dispatch start ({datetime.datetime.fromtimestamp(frontier_start_ts)}): {len(modified_recently)}")

if modified_recently:
    print("\nWARNING: Recently modified files in frozen baseline:")
    for f, m in modified_recently:
        print(f"  {f} (mtime: {datetime.datetime.fromtimestamp(m)})")
else:
    print("\nPASSED: Zero files modified in frozen V6 baseline during Frontier research program.")
