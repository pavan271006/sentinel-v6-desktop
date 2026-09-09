from pathlib import Path
from docx import Document

path=Path(r'C:\Users\Legion 5 pro\Desktop\cyber sec\Assignment_5_Lung_Cancer_Detection_ML_Style.docx')
d=Document(path); body=d._element.body; ps=list(d.paragraphs); target=next(p for p in ps if p.text.strip()=='14. APPENDIX B - EVALUATION LIMITATIONS')
children=list(body); idx=children.index(target._p)
if idx and children[idx-1].tag.endswith('}p'): idx-=1
for child in children[idx:]:
 if child is not body.sectPr:body.remove(child)
d.save(path)
