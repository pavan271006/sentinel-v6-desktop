import os
from pathlib import Path

crates_dir = Path("sentinel_core/crates")
crates = sorted([d for d in crates_dir.iterdir() if d.is_dir()])

print(f"Total Crates found: {len(crates)}\n")

for c in crates:
    lib_file = c / "src" / "lib.rs"
    if lib_file.exists():
        content = lib_file.read_text(encoding="utf-8", errors="ignore")
        lines = [line.strip() for line in content.splitlines() if line.strip().startswith("pub fn") or line.strip().startswith("pub struct") or line.strip().startswith("pub enum") or line.strip().startswith("pub trait") or line.strip().startswith("pub mod")]
        print(f"=== CRATE: {c.name} ===")
        for l in lines[:15]:
            print(f"  {l}")
        if len(lines) > 15:
            print(f"  ... ({len(lines) - 15} more public items)")
