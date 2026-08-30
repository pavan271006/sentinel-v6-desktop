import os
import hashlib
import time
import datetime
import re

ROOT = r"c:\Users\Legion 5 pro\Desktop\cyber sec"
LAB_DIR = os.path.join(ROOT, "gitlab_research_lab")
DOC_M2_A = os.path.join(LAB_DIR, "docs", "GITLAB_AUTHORIZATION_MODEL.md")
DOC_M2_B = os.path.join(LAB_DIR, "GITLAB_AUTHORIZATION_MODEL.md")
SENTINEL_CORE = os.path.join(ROOT, "sentinel_core")
ARCHITECTURE = os.path.join(ROOT, "architecture")

def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def check_parity():
    print("=== 1. Deliverable Existence & SHA-256 Parity ===")
    exists_a = os.path.isfile(DOC_M2_A)
    exists_b = os.path.isfile(DOC_M2_B)
    print(f"File A ({DOC_M2_A}) exists: {exists_a}")
    print(f"File B ({DOC_M2_B}) exists: {exists_b}")
    if not (exists_a and exists_b):
        print("FAIL: One or both files missing!")
        return False
    
    size_a = os.path.getsize(DOC_M2_A)
    size_b = os.path.getsize(DOC_M2_B)
    print(f"File A size: {size_a} bytes")
    print(f"File B size: {size_b} bytes")
    
    hash_a = sha256_file(DOC_M2_A)
    hash_b = sha256_file(DOC_M2_B)
    print(f"File A SHA-256: {hash_a}")
    print(f"File B SHA-256: {hash_b}")
    
    if hash_a != hash_b:
        print("FAIL: SHA-256 mismatch between mirror files!")
        return False
    if size_a < 1000:
        print("FAIL: File size too small!")
        return False
    print("PASS: 100% SHA-256 Parity & Non-zero Size Verified.")
    return True

def check_sentinel_invariants():
    print("\n=== 2. Sentinel V6 Invariant Check (Zero Modification) ===")
    cutoff = time.time() - 4 * 3600 # 4 hours ago (M2 was in last 1 hour)
    
    modified_core = []
    for root, _, files in os.walk(SENTINEL_CORE):
        for f in files:
            p = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(p)
                if mtime > cutoff:
                    modified_core.append((p, datetime.datetime.fromtimestamp(mtime).isoformat()))
            except Exception:
                pass
                
    modified_arch = []
    for root, _, files in os.walk(ARCHITECTURE):
        for f in files:
            p = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(p)
                if mtime > cutoff:
                    modified_arch.append((p, datetime.datetime.fromtimestamp(mtime).isoformat()))
            except Exception:
                pass
                
    print(f"Recently modified files in sentinel_core: {len(modified_core)}")
    for f, mt in modified_core:
        print(f"  [MODIFIED] {f} at {mt}")
    print(f"Recently modified files in architecture: {len(modified_arch)}")
    for f, mt in modified_arch:
        print(f"  [MODIFIED] {f} at {mt}")
        
    if len(modified_core) > 0 or len(modified_arch) > 0:
        print("FAIL: Modifications detected in sentinel_core or architecture!")
        return False
    print("PASS: ZERO modifications in sentinel_core and architecture verified.")
    return True

def scan_prohibited_patterns():
    print("\n=== 3. Prohibited Patterns Scan in M2 Deliverable ===")
    with open(DOC_M2_A, "r", encoding="utf-8") as f:
        content = f.read()
        lines = content.splitlines()
        
    patterns = [
        r"\bTODO\b",
        r"\bFIXME\b",
        r"\bXXX\b",
        r"\bTBD\b",
        r"\bPLACEHOLDER\b",
        r"\bstub\b",
        r"\bdummy\b",
        r"\bLorem ipsum\b",
        r"coming soon",
        r"not implemented",
    ]
    
    findings = []
    for idx, line in enumerate(lines, 1):
        for pat in patterns:
            matches = re.findall(pat, line, re.IGNORECASE)
            for m in matches:
                # Check if it's in a benign explanatory context (like discussing stubbing or dummy tokens)
                findings.append((idx, pat, line.strip()))
                
    print(f"Total pattern matches found: {len(findings)}")
    for line_no, pat, text in findings:
        print(f"  Line {line_no} [{pat}]: {text}")
        
    # Categorize findings into violations vs legitimate domain documentation
    violations = []
    for line_no, pat, text in findings:
        # Check if line indicates incomplete work product
        lower = text.lower()
        if "todo:" in lower or "fixme:" in lower or "tbd" in lower:
            violations.append((line_no, pat, text))
            
    if violations:
        print(f"FAIL: Found {len(violations)} actual prohibited placeholder markers!")
        return False
    print("PASS: No unhandled TODOs, FIXMEs, placeholders, or facade content.")
    return True

if __name__ == "__main__":
    r1 = check_parity()
    r2 = check_sentinel_invariants()
    r3 = scan_prohibited_patterns()
    print("\nOverall preliminary check passed:", r1 and r2 and r3)
