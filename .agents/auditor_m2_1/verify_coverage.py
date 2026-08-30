import os

with open('TOOL_ECOSYSTEM_AUDIT.md', 'r', encoding='utf-8') as f:
    audit_text = f.read()

with open('FINAL_TOOL_ECOSYSTEM.md', 'r', encoding='utf-8') as f:
    final_text = f.read()

print("--- Checking Crates in Audit ---")
for term in ['adapter', 'ai', 'agent', 'cli']:
    print(f"Term '{term}' in audit: {audit_text.lower().count(term)}")

print("\n--- Checking Placeholders in Deliverables ---")
for name, content in [('TOOL_ECOSYSTEM_AUDIT.md', audit_text), ('FINAL_TOOL_ECOSYSTEM.md', final_text)]:
    for stub in ['TODO', 'TBD', 'FIXME', 'PLACEHOLDER', 'NOT IMPLEMENTED', 'STUB', 'COMING SOON']:
        count = content.upper().count(stub)
        print(f"{name} -> '{stub}': {count}")

print("\n--- Invariants Check in FINAL_TOOL_ECOSYSTEM.md ---")
for inv in ['SEC-01', 'SEC-06', 'SEC-07', 'SEC-09', 'SEC-10', 'SEC-11', 'SEC-12', 'SEC-17']:
    print(f"{inv}: {final_text.count(inv)} occurrences")

