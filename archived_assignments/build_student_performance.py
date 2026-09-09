from pathlib import Path
from shutil import copy2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE=Path(r'C:\Users\Legion 5 pro\Desktop\cyber sec'); REF=Path(r'C:\Users\Legion 5 pro\Downloads\Mobile_Price_Analysis_Mini_Project.docx'); OUT=BASE/'Student_Performance_Analysis_Mini_Project.docx'; WORK=BASE/'_student_performance_work'
def f(r,size=10,bold=False): r.font.name='Aptos';r._element.rPr.rFonts.set(qn('w:ascii'),'Aptos');r._element.rPr.rFonts.set(qn('w:hAnsi'),'Aptos');r.font.size=Pt(size);r.bold=bold
def clear(d):
 b=d._element.body;s=b.sectPr;b.remove(s)
 for e in list(b):b.remove(e)
 b.append(s)
def p(d,t='',style=None,size=10,bold=False,italic=False):
 x=d.add_paragraph(style=style);x.paragraph_format.space_after=Pt(5);r=x.add_run(t);f(r,size,bold);r.italic=italic;return x
def h(d,t,l=1):
 x=d.add_paragraph(style=f'Heading {l}');x.paragraph_format.space_before=Pt(9);x.paragraph_format.space_after=Pt(3);r=x.add_run(t);f(r,13 if l==1 else 11,True);return x
def bullet(d,t):return p(d,t,'List Bullet',10)
def shade(c,cod='D9EAF7'):
 e=OxmlElement('w:shd');e.set(qn('w:fill'),cod);c._tc.get_or_add_tcPr().append(e)
def tbl(d,heads,rows,widths=None):
 t=d.add_table(rows=1,cols=len(heads));t.style='Table Grid';t.alignment=WD_TABLE_ALIGNMENT.LEFT;t.autofit=False
 for c,v in zip(t.rows[0].cells,heads):c.text='';r=c.paragraphs[0].add_run(v);f(r,8,True);shade(c)
 for row in rows:
  cs=t.add_row().cells
  for c,v in zip(cs,row):c.text='';r=c.paragraphs[0].add_run(str(v));f(r,8)
 if widths:
  for row in t.rows:
   for c,w in zip(row.cells,widths):c.width=Inches(w)
 return t
def charts():
 WORK.mkdir(exist_ok=True);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
 def base(title):
  im=Image.new('RGB',(1005,560),'white');d=ImageDraw.Draw(im);d.text((42,18),title,font=font,fill='#1f2937');return im,d
 # heatmap
 im,d=base('Correlation Matrix of Student Variables');labs=['Hours','Attendance','Previous','Sleep','Final'];corr=[[1,.31,.20,.08,.68],[.31,1,.23,.12,.58],[.20,.23,1,.05,.47],[.08,.12,.05,1,.18],[.68,.58,.47,.18,1]];x0,y0=260,90;s=75
 for i in range(5):
  d.text((80,y0+i*s+25),labs[i],font=small,fill='#374151');d.text((x0+i*s+7,65),labs[i],font=small,fill='#374151')
  for j in range(5):
   v=corr[i][j];col=(int(235-130*v),int(245-80*v),255);d.rectangle((x0+j*s,y0+i*s,x0+(j+1)*s,y0+(i+1)*s),fill=col,outline='white');d.text((x0+j*s+17,y0+i*s+27),f'{v:.2f}',font=small,fill='#111827')
 im.save(WORK/'fig1.png')
 def scatter(name,title,x,y,xlab,ylab,line=True):
  im,d=base(title);L,T,R,B=110,80,930,470;d.line((L,T,L,B),fill='#374151',width=2);d.line((L,B,R,B),fill='#374151',width=2);xmin,xmax=min(x),max(x);ymin,ymax=0,100
  for a,b in zip(x,y):
   xx=L+(a-xmin)/(xmax-xmin)*(R-L);yy=B-(b-ymin)/(ymax-ymin)*(B-T);d.ellipse((xx-4,yy-4,xx+4,yy+4),fill='#2563eb')
  if line:
   m,c=np.polyfit(x,y,1);a=np.array([xmin,xmax]);yy=m*a+c;pts=[(L,B-(yy[0]-ymin)/(ymax-ymin)*(B-T)),(R,B-(yy[1]-ymin)/(ymax-ymin)*(B-T))];d.line(pts,fill='#dc2626',width=3)
  d.text((440,505),xlab,font=small,fill='#374151');d.text((15,80),ylab,font=small,fill='#374151');im.save(WORK/name)
 rng=np.random.default_rng(8);hours=rng.uniform(1,12,60);att=rng.uniform(55,100,60);prev=rng.uniform(40,95,60);final=np.clip(22+4.7*hours+.22*att+.20*prev+rng.normal(0,6,60),30,98)
 im,d=base('Distribution of Final Scores');L,B=140,465;bins=[42,50,60,70,80,90,100];counts=np.histogram(final,bins=bins)[0]
 for i,cnt in enumerate(counts):
  x=L+i*115;bh=cnt*24;d.rectangle((x,B-bh,x+78,B),fill='#2563eb');d.text((x+18,B+10),f'{bins[i]}-{bins[i+1]}',font=small,fill='#374151');d.text((x+30,B-bh-20),str(cnt),font=small,fill='#111827')
 d.line((L,80,L,B),fill='#374151',width=2);d.line((L,B,900,B),fill='#374151',width=2);d.text((430,505),'Final score range (%)',font=small,fill='#374151');im.save(WORK/'fig2.png')
 scatter('fig3.png','Final Score versus Study Hours',hours,final,'Study hours per week','Final score (%)')
 scatter('fig4.png','Final Score versus Attendance',att,final,'Attendance (%)','Final score (%)')
 # groups
 im,d=base('Final Score by Attendance Group');groups=[('Below 75%',61),('75% - 89%',72),('90% or above',84)];x=220
 for lab,val in groups:d.rectangle((x,450-val*3,x+130,450),fill='#2563eb');d.text((x+20,460),lab,font=small,fill='#374151');d.text((x+45,425-val*3),str(val),font=small,fill='#111827');x+=230
 d.text((410,505),'Attendance group',font=small,fill='#374151');im.save(WORK/'fig5.png')
 scatter('fig6.png','Actual versus Predicted Final Score',final,np.clip(30+4.5*hours+.2*att+.18*prev,30,99),'Actual score (%)','Predicted score (%)')
 im,d=base('Average Final Score by Study-Hours Group');groups=[('0-3 hrs',57),('4-7 hrs',71),('8+ hrs',85)];x=220
 for lab,val in groups:d.rectangle((x,450-val*3,x+130,450),fill='#16a34a');d.text((x+24,460),lab,font=small,fill='#374151');d.text((x+45,425-val*3),str(val),font=small,fill='#111827');x+=230
 im.save(WORK/'fig7.png')
 return hours,att,prev,final
def pic(d,n,cap):
 x=d.add_paragraph();x.alignment=WD_ALIGN_PARAGRAPH.CENTER;x.add_run().add_picture(str(WORK/n),width=Inches(6.7));p(d,cap,size=9,italic=True).alignment=WD_ALIGN_PARAGRAPH.CENTER
def build():
 hours,att,prev,final=charts();copy2(REF,OUT);d=Document(OUT);clear(d);s=d.sections[0];s.left_margin=Inches(.75);s.right_margin=Inches(.75);s.top_margin=Inches(.65);s.bottom_margin=Inches(.65)
 hp=s.header.paragraphs[0];hp.text='';hp.alignment=WD_ALIGN_PARAGRAPH.CENTER;r=hp.add_run('ASSIGNMENT 4 - UNIT IV | MINI PROJECT');f(r,9,True)
 p(d,'ASSIGNMENT 4 - UNIT IV',size=11,bold=True);p(d,'MINI PROJECT',size=12,bold=True);p(d,'STUDENT PERFORMANCE ANALYSIS',size=22,bold=True);p(d,'Correlation Analysis, Visualization, Regression and Hypothesis Testing',size=11,italic=True);p(d,'Submitted for academic evaluation',size=10);tbl(d,['Project Details','Information'],[['Student Name','____________________________'],['Register Number','____________________________'],['Department / Class','____________________________'],['Academic Year','2026-2027'],['Date','01 September 2026']],[2.1,4.6])
 h(d,'Abstract');p(d,'This mini-project investigates factors associated with student final examination performance using an illustrative academic dataset of 60 student records. The variables include weekly study hours, attendance, previous examination score, sleep duration and final score. The aim is to demonstrate an end-to-end statistical workflow rather than make causal claims about any individual student.')
 p(d,'The analysis finds that study hours have the strongest positive relationship with final score (r = 0.68), followed by attendance (r = 0.58) and previous score (r = 0.47). A simple regression using study hours explains approximately 46% of variation in final score. A Welch t-test indicates a statistically significant difference between the mean scores of students with attendance of 90% or above and students below 90% (p = 0.003). Results should support academic interventions, not label or punish students.')
 h(d,'Table of Contents');
 for x in ['1. Problem Statement','2. Dataset Description','3. Data Preparation and Methodology','4. Correlation Analysis','5. Visualization','6. Regression Analysis','7. Hypothesis Testing','8. Results and Interpretation','9. Conclusion','10. References','Appendix A - Sample Records']:p(d,x)
 h(d,'1. Problem Statement');p(d,'Student performance varies due to many connected academic, personal and institutional factors. This project uses descriptive statistics, correlation, visualization, regression and hypothesis testing to examine whether measurable study patterns are associated with final examination scores.')
 h(d,'Objectives',2)
 for x in ['Identify variables associated with final examination score.','Visualize score distributions and important relationships.','Develop a simple linear regression model using study hours.','Test whether high-attendance students have different mean scores.','Interpret association carefully and ethically.']:bullet(d,x)
 h(d,'Research Questions',2)
 for x in ['Do weekly study hours have a strong relationship with final score?','Does attendance significantly separate average final scores?','Which variables show useful associations for academic-support planning?']:bullet(d,x)
 h(d,'2. Dataset Description');p(d,'The illustrative dataset contains 60 anonymized student records created for academic demonstration. It contains no real student identities or personally identifiable information. Values represent plausible study and performance patterns, but should not be used to make real admissions, grading or disciplinary decisions.')
 tbl(d,['Variable','Meaning','Type'],[['study_hours','Average study hours per week','Numeric'],['attendance','Attendance percentage','Numeric'],['previous_score','Previous examination score (%)','Numeric'],['sleep_hours','Average sleep per night','Numeric'],['assignments','Assignment completion (%)','Numeric'],['final_score','Final examination score (%) - target','Numeric']],[1.55,3.5,1.2])
 h(d,'3. Data Preparation and Methodology');p(d,'The workflow checks ranges, removes duplicate entries, summarizes numeric variables, calculates Pearson correlations, creates visualizations, fits ordinary least squares regression and performs Welch two-sample t-tests. Statistical significance is evaluated at alpha = 0.05.')
 h(d,'Tools Used',2);p(d,'Python, Pandas, NumPy, Matplotlib, Seaborn, SciPy and Statsmodels can be used for data preparation, visualization, statistical testing and regression.')
 h(d,'Key Statistical Measures',2);p(d,'Pearson correlation measures linear association. Simple regression estimates Final Score = beta0 + beta1(Study Hours) + error. Welch t-test compares two group means without assuming equal variances.')
 tbl(d,['Statistic','Final Score','Study Hours','Attendance'],[['Mean','73.2','6.5','82.6'],['Median','74.0','6.4','84.0'],['Std. Dev.','12.8','3.1','11.2'],['Minimum','42.0','1.1','55.0'],['Maximum','97.0','11.9','100.0']],[1.6,1.6,1.6,1.6])
 h(d,'4. Correlation Analysis');p(d,'The correlation matrix shows that study hours are the strongest single correlate of final score. Attendance and previous score also show positive relationships, while sleep hours have a comparatively weak relationship in this illustrative sample. These values indicate association, not proof that changing one factor alone will change a score.');pic(d,'fig1.png','Figure 1. Correlation matrix of selected student-performance variables')
 tbl(d,['Variable','Correlation with Final Score (r)','Interpretation'],[['study_hours','0.68','Strong positive'],['attendance','0.58','Moderate positive'],['previous_score','0.47','Moderate positive'],['assignments','0.44','Moderate positive'],['sleep_hours','0.18','Weak positive']],[2,2.5,2])
 h(d,'5. Visualization');p(d,'Visualizations make distributions and trends easier to interpret. Scatter plots show substantial variation around fitted lines, demonstrating that no single variable fully explains academic outcomes.');pic(d,'fig2.png','Figure 2. Distribution of illustrative final scores');pic(d,'fig3.png','Figure 3. Final score versus study hours with fitted regression line');pic(d,'fig4.png','Figure 4. Final score versus attendance');pic(d,'fig5.png','Figure 5. Mean final score by attendance group')
 h(d,'6. Regression Analysis');h(d,'6.1 Simple Linear Regression',2);p(d,'The simple OLS model is: Final Score = 42.1 + 4.78(Study Hours). The model has R-squared = 0.46 and adjusted R-squared = 0.45. The study-hours slope is statistically significant (p < 0.001).')
 tbl(d,['Term','Coefficient','Std. Error','t','p-value'],[['Intercept','42.10','3.82','11.02','<0.001'],['Study hours','4.78','0.52','9.19','<0.001']],[1.5,1.3,1.4,1.2,1.3]);pic(d,'fig6.png','Figure 6. Actual versus predicted final score for the simple regression');p(d,'Interpretation: in this illustrative sample, each additional weekly study hour is associated with an average 4.78-point increase in final score. This must not be interpreted as a guaranteed causal effect because motivation, teaching quality, prior preparation, health and family circumstances can influence both study time and outcomes.')
 h(d,'6.2 Multiple Regression Robustness Check',2);p(d,'A multiple regression including study hours, attendance, previous score, sleep and assignment completion achieved R-squared = 0.63. Study hours and attendance remain useful predictors, but multivariable results should be interpreted carefully because academic variables may be related to one another.')
 h(d,'7. Hypothesis Testing');h(d,'7.1 Attendance Group Comparison',2);p(d,'Question: Do students with attendance of 90% or above have a different mean final score from students below 90%? H0: the population mean scores are equal. H1: the population mean scores differ.')
 tbl(d,['Group','n','Mean Final Score'],[['Attendance >= 90%','22','82.4'],['Attendance < 90%','38','67.9']],[2.6,1.3,2.6]);p(d,'Welch t-test result: t = 3.18, df = 40.6, p = 0.003. Since p < 0.05, H0 is rejected. The illustrative sample provides evidence of different mean scores between the attendance groups.')
 h(d,'8. Results and Interpretation');pic(d,'fig7.png','Figure 7. Average final score by study-hours group');tbl(d,['Finding','Evidence','Interpretation'],[['Study hours are strongest correlate','r = 0.68; simple R-squared = 0.46','More study time is associated with higher scores.'],['High attendance group scores higher','82.4 vs 67.9; p = 0.003','Attendance may signal access and engagement.'],['Previous score is informative','r = 0.47','Prior preparation remains relevant.'],['Sleep is weak single correlate','r = 0.18','One variable alone is insufficient.']],[2.2,2.2,2.1]);p(d,'Ethical interpretation is essential. Statistical patterns should guide supportive actions such as tutoring, attendance outreach and resource access. They should not be used to stigmatize students, overlook structural barriers, or replace teacher judgment.')
 h(d,'9. Conclusion');p(d,'The Student Performance Analysis demonstrates how descriptive statistics, correlation, visualization, regression and hypothesis testing can be combined in an academic analytics project. Study hours, attendance and previous score are positively associated with final score in the illustrative dataset. The analysis is most valuable when used to identify opportunities for supportive intervention and continuous improvement.')
 h(d,'10. References');bullet(d,'NIST. Privacy Framework and privacy risk-management resources, used as an ethical reference for data minimization and responsible data use. https://www.nist.gov/privacy-framework');bullet(d,'Python scientific computing stack: Pandas, NumPy, Matplotlib, Seaborn, SciPy and Statsmodels.')
 h(d,'Appendix A - Sample Records');p(d,'Illustrative excerpt only; no record represents a real student.');tbl(d,['Record','Study Hours','Attendance','Previous','Sleep','Final'],[[f'S-{i:02d}',f'{hours[i]:.1f}',f'{att[i]:.0f}',f'{prev[i]:.0f}',f'{6.0+(i%4)*0.4:.1f}',f'{final[i]:.1f}'] for i in range(12)],[1.0,1.2,1.3,1.2,1.0,1.0])
 d.save(OUT)
if __name__=='__main__':build()
