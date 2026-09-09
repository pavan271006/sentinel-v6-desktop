from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

path = Path(r'C:\Users\Legion 5 pro\Desktop\cyber sec\Assignment_5_Lung_Cancer_Detection_ML_Style.docx')
doc = Document(path)
start = None
for paragraph in doc.paragraphs:
    if paragraph.text.strip() == '13. APPENDIX A - CNN ARCHITECTURE AND DATA FLOW':
        start = paragraph._p
        break
if start is None:
    raise RuntimeError('Appendix A not found')
body = doc._element.body
children = list(body)
start_index = children.index(start)
if start_index and children[start_index - 1].tag == qn('w:p'):
    start_index -= 1
for child in children[start_index:]:
    if child is not body.sectPr:
        body.remove(child)
doc.save(path)
