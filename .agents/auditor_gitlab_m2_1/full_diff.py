import difflib

DOC_A = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab\docs\GITLAB_AUTHORIZATION_MODEL.md"
DOC_B = r"c:\Users\Legion 5 pro\Desktop\cyber sec\gitlab_research_lab\GITLAB_AUTHORIZATION_MODEL.md"

with open(DOC_A, "r", encoding="utf-8") as fa:
    text_a = fa.readlines()
with open(DOC_B, "r", encoding="utf-8") as fb:
    text_b = fb.readlines()

diff = list(difflib.unified_diff(text_a, text_b, fromfile="docs/GITLAB_AUTHORIZATION_MODEL.md", tofile="GITLAB_AUTHORIZATION_MODEL.md", n=3))
print(f"Total diff lines: {len(diff)}")
for line in diff:
    print(line, end="")
