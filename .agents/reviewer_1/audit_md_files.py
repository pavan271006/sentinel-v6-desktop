#!/usr/bin/env python3
import re
from pathlib import Path

WORKSPACE = Path(r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6")

def audit_markdown_files():
    md_files = sorted(WORKSPACE.glob("V6_FINAL_*.md"))
    print(f"Total V6_FINAL_*.md files found: {len(md_files)}")
    
    subsystems_expected = [
        "SUB-01", "SUB-02", "SUB-03", "SUB-04", "SUB-05", "SUB-06", "SUB-07",
        "SUB-08", "SUB-09", "SUB-10", "SUB-11", "SUB-12", "SUB-13", "SUB-14",
        "SUB-15", "SUB-16", "SUB-17", "SUB-18", "SUB-19", "SUB-20", "SUB-21",
        "SUB-22", "SUB-23", "SUB-24", "SUB-25", "SUB-26", "SUB-27", "SUB-28"
    ]
    
    manifest_file = WORKSPACE / "V6_FINAL_SUBSYSTEM_MANIFEST.md"
    manifest_text = manifest_file.read_text(encoding='utf-8')
    
    missing_in_manifest = [s for s in subsystems_expected if s not in manifest_text]
    print(f"Subsystems missing in manifest: {missing_in_manifest}")
    
    # Check domain model
    domain_file = WORKSPACE / "V6_FINAL_DOMAIN_MODEL.md"
    domain_text = domain_file.read_text(encoding='utf-8')
    pipeline = "Transaction -> Observation -> Candidate -> VerificationResult -> Evidence -> Finding"
    has_pipeline = pipeline.lower() in domain_text.lower() or "transaction → observation → candidate → verificationresult → evidence → finding" in domain_text.lower() or "transaction -> observation -> candidate -> verification -> evidence -> finding" in domain_text.lower()
    print(f"Domain model has canonical 6-stage lifecycle pipeline: {has_pipeline}")
    
    # Check broken markdown links across all MD files
    broken_links = []
    for md in WORKSPACE.glob("*.md"):
        content = md.read_text(encoding='utf-8')
        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
        for text, url in links:
            if url.startswith('http://') or url.startswith('https://') or url.startswith('#') or url.startswith('mailto:'):
                continue
            target = url.split('#')[0]
            if target and not (WORKSPACE / target).exists():
                broken_links.append({"file": md.name, "target": target, "text": text})
                
    print(f"Broken links count: {len(broken_links)}")
    if broken_links:
        print("Broken links:", broken_links)

if __name__ == "__main__":
    audit_markdown_files()
