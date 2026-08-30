import os
import sys
import datetime

print("=== AGENTS FOLDER ANALYSIS ===")
agents_dir = os.path.abspath(".agents")
subdirs = [d for d in os.listdir(agents_dir) if os.path.isdir(os.path.join(agents_dir, d))]

sqli_agents = []
for d in subdirs:
    if "sqli" in d.lower() or "sql" in d.lower():
        p = os.path.join(agents_dir, d)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(p))
        sqli_agents.append((mtime, d, p))

sqli_agents.sort(key=lambda x: x[0])
print(f"Found {len(sqli_agents)} SQLi-related agent folders:")
for mtime, d, p in sqli_agents:
    print(f"  {mtime.strftime('%Y-%m-%d %H:%M:%S')} | {d}")
    files = os.listdir(p)
    for f in files:
        fp = os.path.join(p, f)
        fmtime = datetime.datetime.fromtimestamp(os.path.getmtime(fp))
        print(f"    - {f} ({os.path.getsize(fp)} bytes, {fmtime.strftime('%H:%M:%S')})")

print("\n=== CHECKING SRC/SERVICES/SQLSCANNER ===")
sql_scanner_dir = os.path.abspath("src/services/sqlScanner")
if os.path.exists(sql_scanner_dir):
    for f in os.listdir(sql_scanner_dir):
        fp = os.path.join(sql_scanner_dir, f)
        fmtime = datetime.datetime.fromtimestamp(os.path.getmtime(fp))
        print(f"  {f} ({os.path.getsize(fp)} bytes, modified: {fmtime.strftime('%Y-%m-%d %H:%M:%S')})")
else:
    print("src/services/sqlScanner does not exist")
