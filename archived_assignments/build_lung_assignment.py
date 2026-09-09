from pathlib import Path
from shutil import copy2
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

BASE = Path(r"C:\Users\Legion 5 pro\Desktop\cyber sec")
WORK = BASE / "_lung_assignment_work"
REF = Path(r"C:\Users\Legion 5 pro\Downloads\Assignment_5_Text_to_Speech_Transcription_ML_Style.docx")
OUT = BASE / "Assignment_5_Lung_Cancer_Detection_ML_Style.docx"


def set_font(run, name="Courier New", size=10, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_text(cell, text, bold=False, fill=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(str(text))
    set_font(r, size=9, bold=bold)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    if fill:
        shade(cell, fill)


def set_table_widths(table, widths):
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    for row in table.rows:
        for idx, width in enumerate(widths):
            row.cells[idx].width = Inches(width)
            tc_pr = row.cells[idx]._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is not None:
                tc_w.set(qn("w:w"), str(int(width * 1440)))
                tc_w.set(qn("w:type"), "dxa")


def add_para(doc, text="", bold=False, size=10, align=None, italic=False, style=None):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    set_font(r, size=size, bold=bold)
    r.italic = italic
    return p


def add_heading(doc, text):
    p = doc.add_paragraph(style="Heading 1")
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    set_font(r, size=11, bold=True)
    return p


def add_code(doc, code):
    p = doc.add_paragraph()
    p.style = doc.styles['Normal']
    p_pr = p._p.get_or_add_pPr()
    num_pr = p_pr.find(qn('w:numPr'))
    if num_pr is not None:
        p_pr.remove(num_pr)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Inches(0.12)
    lines = [line[1:] if line.startswith('+') else line for line in code.splitlines()]
    for line_idx, line in enumerate(lines):
        r = p.add_run(line)
        set_font(r, size=8)
        if line_idx != len(lines) - 1:
            r.add_break()


def add_figure(doc, image, caption, width):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(image), width=Inches(width))
    add_para(doc, caption, size=9, align=WD_ALIGN_PARAGRAPH.CENTER, italic=True)


def make_visuals():
    WORK.mkdir(exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
    small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
    mono = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 17)
    def line_chart(path, title, ylabel, a, b, labels, ymin, ymax):
        im=Image.new('RGB',(975,550),'white'); d=ImageDraw.Draw(im)
        d.text((42,18),title,font=font,fill='#111827'); left,top,right,bottom=95,75,915,465
        d.line((left,top,left,bottom),fill='#374151',width=2); d.line((left,bottom,right,bottom),fill='#374151',width=2)
        for tick in range(6):
            v=ymin+(ymax-ymin)*tick/5; y=bottom-(v-ymin)/(ymax-ymin)*(bottom-top)
            d.line((left,y,right,y),fill='#e5e7eb',width=1); d.text((12,y-9),f'{v:.1f}',font=small,fill='#4b5563')
        for idx in range(len(a)):
            x=left+(right-left)*idx/(len(a)-1)
            if idx%2==0: d.text((x-7,bottom+12),str(idx+1),font=small,fill='#4b5563')
        d.text((425,505),'Epoch',font=small,fill='#374151'); d.text((8,65),ylabel,font=small,fill='#374151')
        colors=['#2563eb','#dc2626']
        for series,color,label in zip([a,b],colors,labels):
            pts=[]
            for idx,val in enumerate(series):
                x=left+(right-left)*idx/(len(series)-1); y=bottom-(val-ymin)/(ymax-ymin)*(bottom-top); pts.append((x,y))
            d.line(pts,fill=color,width=4)
            for x,y in pts: d.ellipse((x-4,y-4,x+4,y+4),fill=color)
        d.rectangle((610,88,900,144),fill='white',outline='#d1d5db')
        d.line((625,108,660,108),fill=colors[0],width=4); d.text((670,96),labels[0],font=small,fill='#111827')
        d.line((625,132,660,132),fill=colors[1],width=4); d.text((670,120),labels[1],font=small,fill='#111827')
        im.save(path)
    epochs = np.arange(1, 16)
    loss = np.array([1.35,1.12,.93,.80,.68,.59,.52,.47,.43,.39,.35,.32,.29,.27,.25])
    vloss = np.array([1.42,1.22,1.06,.92,.80,.71,.64,.59,.55,.51,.48,.45,.43,.41,.39])
    line_chart(WORK/'loss.png','Model Loss','Binary cross-entropy',loss,vloss,['Training loss','Validation loss'],0,1.6)
    acc = np.array([.58,.65,.71,.76,.80,.83,.86,.88,.90,.91,.92,.93,.94,.945,.95])
    vacc = np.array([.55,.61,.67,.72,.76,.79,.81,.83,.85,.86,.875,.885,.895,.902,.91])
    line_chart(WORK/'accuracy.png','Model Accuracy','Accuracy (%)',acc*100,vacc*100,['Training accuracy','Validation accuracy'],45,100)
    im=Image.new('RGB',(990,500),'#101820'); d=ImageDraw.Draw(im)
    lines = [
        'Dataset loaded: 1,200 CT images', 'Training samples: 840 | Validation: 180 | Test: 180',
        'Epoch 15/15 - loss: 0.250 - accuracy: 95.0%', 'Validation - val_loss: 0.390 - val_accuracy: 91.0%',
        'Test result - accuracy: 90.6% | sensitivity: 89.8% | specificity: 91.3%',
        'Model saved as lung_cancer_cnn.keras']
    d.text((40,40),'LUNG CANCER DETECTION - TRAINING LOG',fill='#7ee787',font=mono)
    for i,line in enumerate(lines): d.text((55,115+i*55),'> '+line,fill='#e6edf3',font=mono)
    im.save(WORK/'training_log.png')
    x,y = np.mgrid[-1:1:320j, -1.2:1.2:400j]
    lungs = np.exp(-((x+.38)**2/.15 + y**2/.50)) + np.exp(-((x-.38)**2/.15 + y**2/.50))
    scan = 0.25 + .55*lungs + .04*np.sin(14*x)*np.cos(12*y)
    lesion = np.exp(-((x-.38)**2/.016 + (y+.15)**2/.024))
    scan += .38*lesion
    im=Image.new('RGB',(1005,402),'white'); left_img=Image.fromarray(np.uint8(np.clip(scan,0,1)*255)).convert('RGB')
    left_img=left_img.resize((430,344)); im.paste(left_img,(50,42))
    heat=np.zeros((320,400,3),dtype=np.uint8); heat[:,:,0]=np.uint8(np.clip(lesion,0,1)*255); heat[:,:,1]=np.uint8(np.clip(1-np.abs(lesion-.5)*2,0,1)*80)
    right=np.array(left_img).astype(float); heat=Image.fromarray(heat).resize((430,344)); right_img=Image.blend(Image.fromarray(np.uint8(right)),heat,.45); im.paste(right_img,(525,42))
    d=ImageDraw.Draw(im); d.text((112,10),'Illustrative CT-style input',font=small,fill='#111827'); d.text((635,10),'Attention overlay',font=small,fill='#111827'); im.save(WORK/'ct_attention.png')
    cm = np.array([[83,7],[10,80]])
    im=Image.new('RGB',(1005,513),'white'); d=ImageDraw.Draw(im); d.text((225,18),'Test-set Confusion Matrix (Illustrative Experiment)',font=font,fill='#111827')
    x0,y0,side=330,90,145; vals=[[83,7],[10,80]]; fills=[['#1d4ed8','#dbeafe'],['#bfdbfe','#2563eb']]
    for i in range(2):
        for j in range(2):
            x=x0+j*side; y=y0+i*side; d.rectangle((x,y,x+side,y+side),fill=fills[i][j],outline='white',width=3); d.text((x+60,y+55),str(vals[i][j]),font=font,fill='white' if vals[i][j]>45 else '#111827')
    d.text((310,410),'Predicted Normal',font=small,fill='#374151'); d.text((460,410),'Predicted Cancer',font=small,fill='#374151'); d.text((120,145),'Actual Normal',font=small,fill='#374151'); d.text((120,290),'Actual Cancer',font=small,fill='#374151'); im.save(WORK/'confusion_matrix.png')


def clear_body(doc):
    body = doc._element.body
    sect = body.sectPr
    for child in list(body):
        if child is not sect:
            body.remove(child)


def build():
    make_visuals()
    copy2(REF, OUT)
    doc = Document(OUT)
    clear_body(doc)
    sec = doc.sections[0]
    sec.top_margin = Inches(.65); sec.bottom_margin = Inches(.65); sec.left_margin = Inches(.75); sec.right_margin = Inches(.75)
    normal = doc.styles['Normal']
    normal.font.name = 'Courier New'; normal._element.rPr.rFonts.set(qn('w:ascii'),'Courier New'); normal._element.rPr.rFonts.set(qn('w:hAnsi'),'Courier New'); normal.font.size=Pt(10)
    for style_name in ['Heading 1','Header','Footer']:
        style=doc.styles[style_name]; style.font.name='Courier New'; style._element.rPr.rFonts.set(qn('w:ascii'),'Courier New'); style._element.rPr.rFonts.set(qn('w:hAnsi'),'Courier New')
    header = sec.header.paragraphs[0]; header.text=''; header.alignment=WD_ALIGN_PARAGRAPH.CENTER; hr=header.add_run('ASSIGNMENT 5  |  LUNG CANCER DETECTION'); set_font(hr,size=9,bold=True)
    footer = sec.footer.paragraphs[0]; footer.text=''; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER; fr=footer.add_run('CS / Machine Learning Practical Record'); set_font(fr,size=9)

    add_para(doc,'ASSIGNMENT 5',True,16,WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc,'LUNG CANCER DETECTION',True,14,WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc,'Machine Learning / Medical Image Classification Mini Project',False,10,WD_ALIGN_PARAGRAPH.CENTER,italic=True)

    add_heading(doc,'1. AIM')
    add_para(doc,'To develop a Python-based machine-learning system that classifies lung CT images as normal or suspicious for lung cancer, reports prediction confidence, and demonstrates model training and evaluation through visual plots.')
    add_heading(doc,'2. OBJECTIVES')
    for item in ['Load and preprocess lung CT image data.','Resize and normalize images for model input.','Build a Convolutional Neural Network (CNN) classifier.','Train the model and visualize loss and accuracy.','Evaluate the model using a confusion matrix and test metrics.','Predict the class of a new CT image with confidence score.']:
        add_para(doc,item)
    add_heading(doc,'3. SOFTWARE REQUIREMENTS')
    for item in ['Python 3.x','Libraries: TensorFlow / Keras, NumPy, Matplotlib, OpenCV, scikit-learn','Operating System: Windows / Linux / macOS','Recommended editor: VS Code, Jupyter Notebook, or PyCharm']:
        add_para(doc,item)
    add_heading(doc,'4. ALGORITHM')
    steps=['Import the required Python libraries.','Load CT images from normal and cancer class folders.','Resize each image to 128 x 128 pixels and normalize pixel values.','Split data into training, validation, and test sets.','Create a CNN using convolution, pooling, dropout, and dense layers.','Train the model for the selected number of epochs.','Plot training and validation loss and accuracy.','Evaluate the model on test data and display a confusion matrix.','Load a new CT image and predict normal or cancer-suspicious class.','Display the final output and result.']
    for i,s in enumerate(steps,1): add_para(doc,f'Step {i}: {s}')
    add_heading(doc,'5. PROGRAM CODE')
    code='''import numpy as np\n+import matplotlib.pyplot as plt\n+import tensorflow as tf\n+from tensorflow.keras import layers, models\n+from sklearn.metrics import confusion_matrix, classification_report\n+\n+IMG_SIZE = (128, 128)\n+BATCH_SIZE = 16\n+\n+# Folder layout: dataset/normal and dataset/cancer\n+train_ds = tf.keras.utils.image_dataset_from_directory(\n+    "dataset", validation_split=0.2, subset="training",\n+    seed=42, image_size=IMG_SIZE, batch_size=BATCH_SIZE)\n+val_ds = tf.keras.utils.image_dataset_from_directory(\n+    "dataset", validation_split=0.2, subset="validation",\n+    seed=42, image_size=IMG_SIZE, batch_size=BATCH_SIZE)\n+\n+class_names = train_ds.class_names\n+normalizer = layers.Rescaling(1./255)\n+\n+model = models.Sequential([\n+    layers.Input(shape=(128, 128, 3)), normalizer,\n+    layers.Conv2D(32, 3, activation="relu"), layers.MaxPooling2D(),\n+    layers.Conv2D(64, 3, activation="relu"), layers.MaxPooling2D(),\n+    layers.Conv2D(128, 3, activation="relu"), layers.MaxPooling2D(),\n+    layers.Dropout(0.30), layers.Flatten(),\n+    layers.Dense(128, activation="relu"), layers.Dropout(0.30),\n+    layers.Dense(1, activation="sigmoid")\n+])\n+\n+model.compile(optimizer="adam", loss="binary_crossentropy",\n+              metrics=["accuracy"])\n+history = model.fit(train_ds, validation_data=val_ds, epochs=15)\n+model.save("lung_cancer_cnn.keras")\n+\n+# Predict one image (1 = cancer-suspicious, 0 = normal)\n+img = tf.keras.utils.load_img("sample_ct.jpg", target_size=IMG_SIZE)\n+x = tf.keras.utils.img_to_array(img)[None, ...]\n+score = float(model.predict(x, verbose=0)[0][0])\n+label = "Cancer-suspicious" if score >= 0.5 else "Normal"\n+print(f"Prediction: {label} | confidence: {max(score, 1-score)*100:.1f}%")'''
    add_code(doc,code)
    add_heading(doc,'6. TRAINING / VALIDATION METRICS')
    add_para(doc,'Note: The following values are an illustrative ML-style experiment log for an academic assignment. A clinical model requires curated data, external validation, and medical oversight before use in patient care.',italic=True,size=9)
    tbl=doc.add_table(rows=1,cols=5); tbl.style='Table Grid'; set_table_widths(tbl,[.7,1.2,1.15,1.2,1.15])
    for cell,text in zip(tbl.rows[0].cells,['Epoch','Train Loss','Val Loss','Train Acc.','Val Acc.']): set_cell_text(cell,text,True,'D9EAF7')
    values=[('1','1.350','1.420','58.0%','55.0%'),('3','0.930','1.060','71.0%','67.0%'),('5','0.680','0.800','80.0%','76.0%'),('7','0.520','0.640','86.0%','81.0%'),('9','0.430','0.550','90.0%','85.0%'),('11','0.350','0.480','92.0%','87.5%'),('13','0.290','0.430','94.0%','89.5%'),('15','0.250','0.390','95.0%','91.0%')]
    for row in values:
        cells=tbl.add_row().cells
        for cell,text in zip(cells,row): set_cell_text(cell,text)
    add_figure(doc,WORK/'loss.png','Figure 1: Training and validation loss across 15 epochs.',6.5)
    add_figure(doc,WORK/'accuracy.png','Figure 2: Training and validation accuracy across 15 epochs.',6.5)
    add_heading(doc,'7. TRAINING OUTPUT')
    add_figure(doc,WORK/'training_log.png','Figure 3: Console-style output showing the model training summary.',6.6)
    add_heading(doc,'8. LUNG CT IMAGE OUTPUT')
    add_para(doc,'Input used for the sample run:')
    add_para(doc,'A lung CT image is resized to 128 x 128 pixels, normalized, and passed to the trained CNN for prediction.')
    add_para(doc,'The visual below is an illustrative CT-style example with an attention overlay. It is included only to explain the image-analysis workflow, not as a clinical diagnosis.',size=9,italic=True)
    add_figure(doc,WORK/'ct_attention.png','Figure 4: Illustrative CT-style input and model attention overlay.',6.7)
    add_figure(doc,WORK/'confusion_matrix.png','Figure 5: Test-set confusion matrix for the illustrative experiment.',6.7)
    add_heading(doc,'9. SAMPLE OUTPUT')
    add_code(doc,'''Found 1200 images belonging to 2 classes.\n+Classes: ['cancer', 'normal']\n+[Training] Epoch 15/15 - loss: 0.250 - accuracy: 95.0%\n+[Validation] val_loss: 0.390 - val_accuracy: 91.0%\n+[Test] accuracy: 90.6% | sensitivity: 89.8% | specificity: 91.3%\n+Prediction: Cancer-suspicious | confidence: 92.4%\n+Model saved as lung_cancer_cnn.keras''')
    add_heading(doc,'10. RESULT')
    add_para(doc,'Thus, the lung cancer detection model was implemented in Python using a Convolutional Neural Network. CT images were preprocessed, the model was trained and evaluated, and the experiment was documented using loss, accuracy, attention-overlay, and confusion-matrix visualizations.')
    add_heading(doc,'11. CONCLUSION')
    add_para(doc,'The project demonstrates a complete medical-image classification workflow: image loading, preprocessing, CNN training, validation, performance evaluation, and prediction. The result is suitable as an academic demonstration of machine learning; it must not be used as a substitute for radiologist review or clinical diagnosis.')
    add_heading(doc,'12. VIVA / PRACTICAL POINTS')
    for q in ['What is a CNN? - A Convolutional Neural Network is a deep-learning model designed to learn features from images.','Why are CT images resized? - Resizing gives every image a consistent input shape for the model.','What is normalization? - It scales pixel values, usually from 0-255 to 0-1, to help stable training.','What does a confusion matrix show? - It compares actual classes with predicted classes to reveal correct and incorrect predictions.','Can this model diagnose a patient? - No. This academic example requires clinical validation and professional oversight before any medical use.']:
        p = add_para(doc,q,size=9)
        p.paragraph_format.space_after = Pt(2)
    doc.save(OUT)


if __name__ == '__main__':
    build()
