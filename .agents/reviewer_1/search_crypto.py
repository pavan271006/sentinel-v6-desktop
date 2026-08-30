#!/usr/bin/env python3
import re
from pathlib import Path

WORKSPACE = Path(r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6")

for p in WORKSPACE.glob("*.*"):
    if p.is_file():
        content = p.read_text(encoding='utf-8', errors='ignore')
        for i, line in enumerate(content.splitlines(), 1):
            if "crypto_weaknesses" in line:
                print(f"{p.name}:{i}: {line}")
