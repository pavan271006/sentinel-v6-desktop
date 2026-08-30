import os

root_dir = r'c:\Users\Legion 5 pro\Desktop\cyber sec'
agents_dir = os.path.join(root_dir, '.agents')

print("="*80)
print("LAYOUT COMPLIANCE & ARTIFACT HYGIENE AUDIT")
print("="*80)

# Check .agents contents
print("\n[+] Checking .agents directory structure:")
for item in os.listdir(agents_dir):
    p = os.path.join(agents_dir, item)
    if os.path.isdir(p):
        print(f"  [DIR]  .agents/{item}")
    else:
        print(f"  [FILE] .agents/{item}")

# Check for unexpected stray executables / binaries in root
print("\n[+] Checking workspace root for stray binaries / logs:")
stray_files = []
for f in os.listdir(root_dir):
    p = os.path.join(root_dir, f)
    if os.path.isfile(p):
        if f.endswith('.exe') or f.endswith('.log') or f.endswith('.tmp'):
            stray_files.append(f)

if stray_files:
    print(f"  Stray files found: {stray_files}")
else:
    print("  Zero stray binaries, logs, or temporary files in workspace root.")
