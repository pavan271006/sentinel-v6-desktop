import os
import datetime

frozen_dirs = [
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\frontend',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6'
]

# Frontier research started around 2026-08-22 16:57 UTC (22:27 local time)
frontier_start_ts = datetime.datetime(2026, 8, 22, 22, 20).timestamp()

source_extensions = {'.rs', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.proto', '.sql', '.toml', '.html', '.css'}

modified_sources = []
total_source_files = 0

for d in frozen_dirs:
    for root, dirs, files in os.walk(d):
        # ignore build target and node_modules
        if 'target' in root.split(os.sep) or 'node_modules' in root.split(os.sep) or '.git' in root.split(os.sep):
            continue
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in source_extensions:
                total_source_files += 1
                fpath = os.path.join(root, f)
                mtime = os.path.getmtime(fpath)
                if mtime > frontier_start_ts:
                    modified_sources.append((fpath, mtime))

print(f"Total source files verified across frozen V6 baseline: {total_source_files}")
print(f"Frozen source files modified after Frontier dispatch: {len(modified_sources)}")
if modified_sources:
    print("\nVIOLATION: The following source files were modified:")
    for p, m in modified_sources:
        print(f"  - {p} ({datetime.datetime.fromtimestamp(m)})")
else:
    print("\nPASS: 100% Frozen Baseline Compliance. Zero source code modifications in sentinel_core, src-tauri, frontend, or architecture/v6.")
