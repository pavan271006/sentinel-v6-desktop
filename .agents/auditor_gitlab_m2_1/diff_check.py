import os
import difflib

DOC_A = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab\docs\GITLAB_AUTHORIZATION_MODEL.md"
DOC_B = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab\GITLAB_AUTHORIZATION_MODEL.md"

with open(DOC_A, "rb") as fa:
    content_a_bytes = fa.read()
with open(DOC_B, "rb") as fb:
    content_b_bytes = fb.read()

print("Bytes identical:", content_a_bytes == content_b_bytes)
print("CRLF in A:", b"\r\n" in content_a_bytes)
print("CRLF in B:", b"\r\n" in content_b_bytes)
print("LF in A (only):", b"\n" in content_a_bytes and b"\r\n" not in content_a_bytes)
print("LF in B (only):", b"\n" in content_b_bytes and b"\r\n" not in content_b_bytes)

with open(DOC_A, "r", encoding="utf-8") as fa:
    text_a = fa.readlines()
with open(DOC_B, "r", encoding="utf-8") as fb:
    text_b = fb.readlines()

diff = list(difflib.unified_diff(text_a, text_b, fromfile="docs/GITLAB_AUTHORIZATION_MODEL.md", tofile="GITLAB_AUTHORIZATION_MODEL.md"))
print(f"Text diff line count: {len(diff)}")
for line in diff[:30]:
    print(line, end="")
