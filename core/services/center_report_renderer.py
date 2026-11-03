"""HTML and A4 PDF presentation of the same saved summary payload."""
from html import escape
from io import BytesIO
from pathlib import Path
import base64

from core.services.center_summary_service import display

NAVY = '#0f4b94'


def evidence_items(payload):
    return [(key.replace('_', ' ').title(), str(value)) for key, value in (payload.get('evidence') or {}).items() if value]


def render_html(report):
    p = report.payload
    header = p.get('report_header', {})
    def table(rows):
        if not rows:
            return ''
        width = max(len(row) for row in rows)
        headings = ['Measure', 'Recorded value', 'Basis'][:width]
        return '<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in headings) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{escape(display(value))}</td>' for value in row) + '</tr>' for row in rows) + '</tbody></table></div>'
    figures = ''.join(f'<div class="figure"><strong>{escape(display(item["value"]))}</strong><b>{escape(item["label"])}</b><small>{escape(item["context"])}</small></div>' for item in p.get('key_figures', []))
    sections = ''.join(f'<section><h2>{escape(section["title"])}</h2><p class="basis">{escape(section.get("basis", ""))}</p><p class="narrative">{escape(section.get("autoText", ""))}</p>{table(section.get("table"))}</section>' for section in p.get('template_sections', []))
    charts = ''
    for item in p.get('charts', []):
        value = item.get('value')
        bar = '' if value is None else f'<div class="track"><div style="width:{min(100, max(0, float(value)))}%"></div></div>'
        label = display(value) + ('%' if value is not None else '')
        charts += f'<div class="chart"><b>{escape(item["label"])}</b><span>{escape(label)}</span>{bar}<small>{escape(item.get("basis", ""))}</small></div>'
    notes = ''.join(f'<h3>{escape(item["label"])}</h3><p class="narrative">{escape(str(item["text"]))}</p>' for item in p.get('cdw_notes', []))
    evidence = ''
    for label, value in evidence_items(p):
        evidence += f'<h3>{escape(label)}</h3>'
        if value.startswith('data:image/'):
            evidence += f'<img class="evidence" src="{escape(value, quote=True)}" alt="{escape(label)}" />'
        elif value.startswith(('/media/', 'https://', 'http://')):
            evidence += f'<a href="{escape(value, quote=True)}">Open saved evidence</a>'
        else:
            evidence += '<p>Evidence recorded in the source record.</p>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(report.title)}</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#eef2f7;color:#17283c;font:14px/1.6 Arial,sans-serif}}main{{max-width:1000px;margin:24px auto;padding:40px;background:white}}
    header{{border-top:7px solid {NAVY};border-bottom:1px solid #dce5ef;padding:20px 0}}h1{{font-size:28px;line-height:1.2;color:{NAVY};margin:8px 0}}h2{{font-size:19px;color:{NAVY};background:#eef5fc;border-left:4px solid {NAVY};padding:10px 14px;line-height:1.3}}h3{{font-size:14px}}section{{margin-top:28px}}.eyebrow{{font-size:11px;letter-spacing:1px;font-weight:bold;color:{NAVY}}}.meta,.basis,small{{color:#526176;font-size:12px}}.figures{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}}.figure{{border:1px solid #dce5ef;border-radius:8px;padding:16px}}.figure strong{{display:block;font-size:28px;color:{NAVY}}}.figure b,.figure small{{display:block}}.narrative{{white-space:pre-wrap}}table{{border-collapse:collapse;width:100%;font-size:12px}}th{{background:{NAVY};color:white;text-align:left}}th,td{{padding:9px;border:1px solid #dce5ef;vertical-align:top;overflow-wrap:anywhere}}tr:nth-child(even){{background:#f5f8fc}}.table-wrap{{overflow-x:auto}}.chart{{margin:16px 0}}.chart span{{float:right}}.chart small{{display:block}}.track{{height:8px;background:#edf1f5;margin:6px 0}}.track div{{height:8px;background:{NAVY}}}.evidence{{display:block;max-width:100%;max-height:350px;object-fit:contain}}footer{{margin-top:30px;border-top:1px solid #dce5ef;padding-top:12px;font-size:11px;color:#526176}}
    @media(max-width:600px){{main{{padding:18px;margin:0}}.figures{{grid-template-columns:repeat(2,1fr)}}h1{{font-size:24px}}}}
    @page{{size:A4 portrait;margin:16mm}}@media print{{body{{background:white;font-size:10pt}}main{{padding:0;margin:0;max-width:none}}h1{{font-size:22pt}}h2,h3{{break-after:avoid}}.figure,.chart{{break-inside:avoid}}thead{{display:table-header-group}}tr{{break-inside:avoid}}.table-wrap{{overflow:visible}}th{{color:#17283c;background:#e9eff7}}a{{color:#17283c}}}}
    </style></head><body><main><header><div class="eyebrow">CSWDO / CENTER REPORT</div><h1>{escape(report.title)}</h1><p>{escape(header.get('center', report.cdc.name))} / {escape(header.get('barangay', ''))}</p><div class="meta">Reporting period: {escape(p['period']['label'])}<br>Prepared by: {escape(header.get('prepared_by', 'Not recorded'))}<br>Prepared: {escape(p.get('prepared_on') or p.get('generated_at', '')[:10])}</div></header>
    <section><h2>Key Figures</h2><div class="figures">{figures}</div></section>{sections}<section><h2>Current Record Indicators</h2><p class="basis">These indicators use existing formulas and current records, not measured changes during this period.</p>{charts}</section>
    {('<section><h2>CDW Observations</h2>' + notes + '</section>') if notes else ''}{('<section><h2>Evidence References</h2>' + evidence + '</section>') if evidence else ''}<footer>CSWDO / {escape(p['period']['label'])} / Generated from saved records. Missing information is not treated as zero.</footer></main></body></html>'''


def render_pdf(report):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
    from reportlab.graphics.shapes import Drawing, Rect
    font = 'Helvetica'
    for candidate in ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(candidate).exists():
            if 'CenterReport' not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont('CenterReport', candidate))
            font = 'CenterReport'
            break
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('BodyReport', fontName=font, fontSize=9, leading=13, spaceAfter=7))
    styles.add(ParagraphStyle('SectionReport', fontName=font, fontSize=13, leading=18, textColor=colors.HexColor(NAVY), backColor=colors.HexColor('#eef5fc'), borderPadding=8, spaceBefore=18, spaceAfter=12, keepWithNext=True))
    styles.add(ParagraphStyle('TitleReport', parent=styles['BodyReport'], fontSize=22, leading=27, textColor=colors.HexColor(NAVY), spaceAfter=14))
    styles.add(ParagraphStyle('SmallReport', parent=styles['BodyReport'], fontSize=7, leading=10, textColor=colors.HexColor('#526176')))
    styles.add(ParagraphStyle('SectionBasis', parent=styles['SmallReport'], keepWithNext=True))
    styles.add(ParagraphStyle('TableReport', parent=styles['BodyReport'], leading=12, spaceAfter=0))
    styles.add(ParagraphStyle('KeyNumber', parent=styles['TitleReport'], fontSize=22, leading=26, spaceAfter=6))
    def para(text, style='BodyReport'):
        return Paragraph(escape(display(text)).replace('\n', '<br/>'), styles[style])
    width = A4[0] - 32 * mm
    story = []
    p = report.payload
    header = p.get('report_header', {})
    story.extend([para('CSWDO / CENTER REPORT', 'SmallReport'), para(report.title, 'TitleReport'), para(f"{header.get('center', report.cdc.name)} / {header.get('barangay', '')}"), para(f"Reporting period: {p['period']['label']} | Prepared: {p.get('prepared_on') or p.get('generated_at', '')[:10]}\nPrepared by: {header.get('prepared_by', 'Not recorded')}", 'SmallReport')])
    def add_table(rows, headings=True):
        if not rows:
            return
        count = max(len(row) for row in rows)
        data = [[para(cell, 'TableReport') for cell in (list(row) + [''] * (count - len(row)))] for row in rows]
        if headings:
            data.insert(0, [para(label, 'TableReport') for label in ['Measure', 'Recorded value', 'Basis'][:count]])
        widths = [width * .47, width * .53] if count == 2 else [width * .35, width * .18, width * .47]
        table = Table(data, colWidths=widths, repeatRows=1 if headings else 0, hAlign='LEFT', splitInRow=1)
        table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#dce5ef')), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e7f0fa')), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f8fc')]), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        story.append(table)
    story.append(para('Key Figures', 'SectionReport'))
    cards = [[para(display(item['value']), 'KeyNumber'), para(item['label']), para(item['context'], 'SmallReport')] for item in p.get('key_figures', [])]
    if cards:
        card_rows = [cards[index:index + 2] for index in range(0, len(cards), 2)]
        if len(card_rows[-1]) == 1:
            card_rows[-1].append('')
        figure_table = Table(card_rows, colWidths=[width / 2] * 2, hAlign='LEFT')
        figure_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), .5, colors.HexColor('#dce5ef')), ('INNERGRID', (0, 0), (-1, -1), .5, colors.HexColor('#dce5ef')), ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f8fc')), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 10)]))
        story.append(figure_table)
    for section in p.get('template_sections', []):
        story.extend([para(section['title'], 'SectionReport'), para(section.get('basis', ''), 'SectionBasis'), para(section.get('autoText', ''))])
        add_table(section.get('table', []))
    story.append(para('Current Record Indicators', 'SectionReport'))
    story.append(para('Existing formulas applied to current records; these are not measured changes during the reporting period.', 'SmallReport'))
    for chart in p.get('charts', []):
        value = chart.get('value')
        chart_block = [para(f"{chart['label']}: {display(value)}{'%' if value is not None else ''}")]
        if value is not None:
            drawing = Drawing(width, 13)
            drawing.add(Rect(0, 5, width, 6, fillColor=colors.HexColor('#edf1f5'), strokeColor=None))
            drawing.add(Rect(0, 5, width * min(100, max(0, float(value))) / 100, 6, fillColor=colors.HexColor(NAVY), strokeColor=None))
            chart_block.append(drawing)
        story.append(KeepTogether(chart_block))
    if p.get('cdw_notes'):
        story.append(para('CDW Observations', 'SectionReport'))
        for note in p['cdw_notes']:
            story.extend([para(note['label'], 'SmallReport'), para(note['text'])])
    if evidence_items(p):
        story.append(para('Evidence References', 'SectionReport'))
        for label, value in evidence_items(p):
            story.append(para(label))
            if value.startswith('data:image/'):
                try:
                    img = Image(BytesIO(base64.b64decode(value.split(',', 1)[1])))
                    scale = min(width / img.imageWidth, 230 / img.imageHeight, 1)
                    img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
                    story.extend([img, Spacer(1, 10)])
                except Exception:
                    story.append(para('Image available in the saved HTML report.', 'SmallReport'))
            else:
                story.append(para(value, 'SmallReport'))
    output = BytesIO()
    def footer(canvas, doc):
        canvas.setStrokeColor(colors.HexColor('#dce5ef'))
        canvas.line(16 * mm, 14 * mm, A4[0] - 16 * mm, 14 * mm)
        canvas.setFont(font, 7)
        canvas.setFillColor(colors.HexColor('#526176'))
        canvas.drawString(16 * mm, 10 * mm, f"CSWDO / {p['period']['label']}")
        canvas.drawRightString(A4[0] - 16 * mm, 10 * mm, f'Page {doc.page}')
    SimpleDocTemplate(output, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=20 * mm, title=report.title, author='CSWDO').build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
