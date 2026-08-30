import os

research_dir = r'c:\Users\Legion 5 pro\Desktop\cyber sec\research'

for root, dirs, files in os.walk(research_dir):
    for f in sorted(files):
        if f.endswith('.py') or f.endswith('.md') or f.endswith('.rs') or f.endswith('.toml'):
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, research_dir)
            size = os.path.getsize(full_path)
            print(f"{rel_path:<60} | {size:>6} B")
