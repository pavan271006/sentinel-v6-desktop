from pathlib import Path
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn

BASE=Path(r'C:\Users\Legion 5 pro\Desktop\cyber sec')
def style(p):
 p.paragraph_format.space_after=Pt(5)
 for r in p.runs:
  r.font.name='Aptos';r._element.rPr.rFonts.set(qn('w:ascii'),'Aptos');r._element.rPr.rFonts.set(qn('w:hAnsi'),'Aptos');r.font.size=Pt(9)
def insert_before(doc,anchor,text):
 p=doc.add_paragraph(text);style(p);anchor._p.addprevious(p._p)
def before_heading(doc,title,texts):
 paragraphs=list(doc.paragraphs)
 pos=next(i for i,p in enumerate(paragraphs) if p.text.strip()==title)
 h=paragraphs[pos]
 # The immediately preceding empty paragraph carries the explicit page break.
 anchor=h
 for p in reversed(paragraphs[:pos]):
  if p.text=='':anchor=p;break
 for t in texts:insert_before(doc,anchor,t)
def fill_lung():
 f=BASE/'Assignment_5_Lung_Cancer_Detection_ML_Style.docx';d=Document(f)
 for t in ['A practical experiment should retain the random seed, image dimensions, preprocessing steps, model configuration, training epochs and the exact data split. These details make the outcome reproducible and make it easier to compare alternate models fairly.','Data quality affects the result strongly. Images should be checked for incorrect labels, duplicates, inconsistent orientation, scanner artifacts and differences between acquisition sites before model training begins.','A simple CNN is a useful teaching baseline. In a real project, comparison with transfer learning, cross-validation and calibration checks would help determine whether the prediction probability is reliable.','The visual heatmap is explanatory only. Attention methods can be misleading and must not be treated as proof that a model recognized a medically meaningful lesion.']:
  p=d.add_paragraph(t);style(p)
 d.save(f)
def fill_malware():
 f=BASE/'Malware_Infection_Incident_Response_Report.docx';d=Document(f)
 additions={
 'Appendix B - Evidence Preservation Checklist':['Store evidence in an access-controlled repository and preserve original timestamps where possible.','Use a consistent naming convention so that analysts can trace each artifact to a host and collection action.','Avoid opening suspected malware on production systems; use an approved isolated analysis environment.'],
 'Appendix C - Host Status Ledger':['The ledger should be updated by the responsible workstream at every shift handover.','A separate column should record business criticality so that recovery sequencing is transparent.','Closed entries should show the evidence used to approve return to service.'],
 'Appendix D - Enterprise Hunting Plan':['Hunting queries should be documented so they can be rerun when new IOCs are discovered.','Negative results are valuable because they define the searched scope and reduce uncertainty.','Searches should include systems that share credentials, email threads or network segments with confirmed hosts.'],
 'Appendix E - Credential Recovery Plan':['Password resets should be performed from a known-clean administration workstation.','Service-account changes must be coordinated with application owners to avoid unnecessary outages.','Privileged accounts require additional review because their compromise can affect many systems.'],
 'Appendix F - Backup and Restore Validation':['Maintain a written recovery sequence that prioritizes identity, network and essential business services.','Test restores periodically rather than waiting for an incident to discover access or integrity problems.','Record any restored data that cannot be verified and obtain business-owner approval before use.'],
 'Appendix G - Recovery Communications':['Every update should include current status, user impact, actions in progress and the next review time.','Technical channels and executive updates should use consistent facts but appropriate levels of detail.','After recovery, issue a clear closure notice and provide a route for users to report recurrence.'],
 'Appendix H - Post-Incident Metrics':['Compare measured response times with the organization’s incident-response objectives.','Assign each corrective action an owner and due date, then track completion to closure.','Repeat an exercise after improvements to verify that changes are effective.']}
 for title,texts in additions.items():before_heading(d,title,texts)
 # Fill final appendix page directly.
 for t in ['Metrics should be reviewed in context: a lower response time is useful only if evidence preservation and recovery quality remain strong.','Leadership should receive a concise final report describing impact, recovery status, residual risk and the funded improvement plan.','The incident record should be retained according to the organization’s evidence-retention and privacy requirements.']:
  p=d.add_paragraph(t);style(p)
 d.save(f)
def fill_student():
 f=BASE/'Student_Performance_Analysis_Mini_Project.docx';d=Document(f)
 adds={
 'Appendix C - Data Quality Checks':['Range checks should be reviewed with educators because an apparently unusual value may reflect a legitimate student circumstance.','Data cleaning decisions must be recorded so the same results can be reproduced later.','Small subgroup sizes should be flagged because averages can be unstable or identify individuals.'],
 'Appendix D - Suggested Python Workflow':['Separate raw data from cleaned analysis data and never include names in the analysis export.','Use descriptive comments so another student or instructor can understand each analytical decision.','Create figures with clear labels and report both patterns and limitations.'],
 'Appendix E - Regression Assumptions':['A good predictive fit does not prove that a variable causes student success.','Prediction errors should be analyzed for systematic patterns across groups to reduce unfairness.','Models should be reviewed regularly because classroom conditions and curricula change over time.'],
 'Appendix F - Responsible Use Guidelines':['Students should be able to understand what information is used and how it supports learning.','Support should be offered in ways that preserve dignity and avoid public comparison of performance.','Sensitive data should be retained only for the minimum time necessary for the stated purpose.']}
 for title,texts in adds.items():before_heading(d,title,texts)
 # The first appendix and final page benefit from supporting explanation.
 before_heading(d,'Appendix C - Data Quality Checks',['A data dictionary also promotes consistent reporting: the same variable name, unit and permitted range should be used in every table and chart.','Only de-identified and aggregated findings should leave the authorized teaching or analytics environment.'])
 d.save(f)
if __name__=='__main__':fill_lung();fill_malware();fill_student()
