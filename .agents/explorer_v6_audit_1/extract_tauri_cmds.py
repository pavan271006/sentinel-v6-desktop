import re

with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\commands.rs", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
for idx, line in enumerate(lines):
    if "#[tauri::command]" in line:
        fn_line = lines[idx+1] if idx+1 < len(lines) else ""
        print(f"Line {idx+1}: {line} -> {fn_line}")
