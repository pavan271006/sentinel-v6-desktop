import os
import sys
import datetime
import re

print("=== FORENSIC SCAN START ===")
workspace_dir = os.path.abspath(".")
cutoff = datetime.datetime(2026, 8, 30, 0, 0, 0)

exclude_dirs = {"node_modules", ".git", ".pytest_cache", "target", "dist"}

modified_files = []
for root, dirs, files in os.walk(workspace_dir):
    # filter out excluded dirs
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for f in files:
        p = os.path.join(root, f)
        try:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(p))
            if mtime >= cutoff:
                rel = os.path.relpath(p, workspace_dir)
                modified_files.append((mtime, os.path.getsize(p), rel))
        except Exception:
            pass

modified_files.sort(key=lambda x: x[0])
print(f"Total files modified on/after 2026-08-30 (excluding target/node_modules): {len(modified_files)}")
for mtime, sz, rel in modified_files:
    if not rel.startswith(".agents"):
        print(f"  [ROOT/SRC] {mtime.strftime('%Y-%m-%d %H:%M:%S')} | {sz:10d} bytes | {rel}")

print("\n=== CHECKING SPECIFIC SQLI DELIVERABLES ===")
sqli_docs = [
    "NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md",
    "RESEARCH_OPEN_SOURCE_STUDY.md",
    "RESEARCH_LITERATURE_SYNTHESIS.md",
    "CANDIDATE_ARCHITECTURES_AND_ATTACKS.md",
    "BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md",
    "IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md"
]

for doc in sqli_docs:
    p = os.path.join(workspace_dir, doc)
    if os.path.exists(p):
        sz = os.path.getsize(p)
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        lines = len(content.splitlines())
        words = len(content.split())
        print(f"[FOUND] {doc}: {lines} lines, {words} words, {sz} bytes")
    else:
        print(f"[MISSING] {doc}")

print("\n=== CHECKING FOR CODE MODIFICATIONS IN SENTINEL_CORE ===")
sentinel_core_mods = [f for f in modified_files if f[2].startswith("sentinel_core")]
if sentinel_core_mods:
    print(f"WARNING: Found {len(sentinel_core_mods)} modified files in sentinel_core:")
    for mtime, sz, rel in sentinel_core_mods:
        print(f"  {mtime.strftime('%Y-%m-%d %H:%M:%S')} | {sz:10d} bytes | {rel}")
else:
    print("CLEAN: Zero files in sentinel_core modified on/after 2026-08-30.")

print("\n=== CHECKING FOR CODE MODIFICATIONS IN SRC/SRC-TAURI ===")
src_mods = [f for f in modified_files if f[2].startswith("src") or f[2].startswith("src-tauri")]
if src_mods:
    print(f"WARNING: Found {len(src_mods)} modified files in src/src-tauri:")
    for mtime, sz, rel in src_mods:
        print(f"  {mtime.strftime('%Y-%m-%d %H:%M:%S')} | {sz:10d} bytes | {rel}")
else:
    print("CLEAN: Zero files in src / src-tauri modified on/after 2026-08-30.")

print("\n=== CHECKING FOR PREMATURE SCANNER CODE OR SCRIPTS ===")
root_code_files = [f for f in modified_files if not f[2].startswith(".agents") and (f[2].endswith(".py") or f[2].endswith(".rs") or f[2].endswith(".sh") or f[2].endswith(".bat") or f[2].endswith(".js") or f[2].endswith(".ts"))]
if root_code_files:
    print(f"Modified script/code files in root:")
    for mtime, sz, rel in root_code_files:
        print(f"  {mtime.strftime('%Y-%m-%d %H:%M:%S')} | {sz:10d} bytes | {rel}")
else:
    print("CLEAN: Zero code/script files added or modified in root on/after 2026-08-30.")

print("=== FORENSIC SCAN COMPLETE ===")
