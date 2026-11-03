from html import escape
import re
import textwrap

from django.core.files.base import ContentFile

from core.report_definitions import get_cdc_periodic_report_definition, get_quarterly_report_definition


class ReportFileService:
    @staticmethod
    def attach_generated_report_file(report):
        definition = get_quarterly_report_definition(report.report_type)
        periodic_definition = get_cdc_periodic_report_definition(report.report_type)
        if not definition and not periodic_definition:
            return

        if definition:
            label = definition['label']
            html_content = ReportFileService._render_quarterly_report_html(report, definition)
            pdf_content = ReportFileService._render_quarterly_report_pdf(report, definition)
        else:
            label = periodic_definition['label']
            html_content = ReportFileService._render_periodic_report_html(report, periodic_definition)
            pdf_content = ReportFileService._render_periodic_report_pdf(report, periodic_definition)

        html_filename = ReportFileService._build_filename(report, label, 'html')
        pdf_filename = ReportFileService._build_filename(report, label, 'pdf')

        if report.attachment:
            report.attachment.delete(save=False)
        if report.pdf_attachment:
            report.pdf_attachment.delete(save=False)

        report.attachment.save(
            html_filename,
            ContentFile(html_content.encode('utf-8')),
            save=False,
        )
        report.pdf_attachment.save(
            pdf_filename,
            ContentFile(pdf_content),
            save=False,
        )

    @staticmethod
    def _build_filename(report, label, extension):
        safe_center = ReportFileService._slugify(report.cdc.name)
        safe_label = ReportFileService._slugify(label)
        safe_period = ReportFileService._slugify(ReportFileService._period_label(report))
        return f'{safe_period}_{safe_center}_{safe_label}_{report.id}.{extension}'

    @staticmethod
    def _period_label(report):
        if getattr(report, 'period_type', 'quarterly') == 'monthly' and getattr(report, 'month', 0):
            return f'm{report.month}_{report.year}'
        if getattr(report, 'period_type', 'quarterly') == 'annual':
            return f'annual_{report.year}'
        return f'q{report.quarter}_{report.year}'

    @staticmethod
    def _slugify(value):
        normalized = re.sub(r'[^a-zA-Z0-9]+', '-', (value or '').strip().lower())
        return normalized.strip('-') or 'report'

    @staticmethod
    def _render_quarterly_report_html(report, definition):
        payload = report.payload or {}
        metadata = payload.get('report_meta') or {}
        fields = payload.get('fields') or {}
        center_name = metadata.get('center_name') or report.cdc.name
        barangay_name = metadata.get('barangay_name') or getattr(report.cdc.barangay, 'name', 'Unknown')
        cdw_name = metadata.get('cdw_name') or getattr(report.submitted_by, 'username', 'Unknown')
        reporting_period = metadata.get('reporting_period') or f'Q{report.quarter} {report.year}'

        sections_markup = []
        for section in definition['sections']:
            rows = []
            for field in section['fields']:
                rows.append(
                    f"""
                    <tr>
                      <th>{escape(field['label'])}</th>
                      <td>{ReportFileService._format_value(fields.get(field['key']))}</td>
                    </tr>
                    """
                )

            sections_markup.append(
                f"""
                <section class="section">
                  <h2>{escape(section['title'])}</h2>
                  <table>
                    <tbody>
                      {''.join(rows)}
                    </tbody>
                  </table>
                </section>
                """
            )

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(report.title or definition['label'])}</title>
  <style>
    body {{
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 32px;
    }}
    .page {{
      max-width: 980px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dbe4f0;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }}
    .hero {{
      background: linear-gradient(135deg, #0f4b94, #0ea5e9);
      color: white;
      padding: 32px;
    }}
    .hero h1 {{
      margin: 8px 0 0;
      font-size: 32px;
    }}
    .hero p {{
      margin: 12px 0 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
    }}
    .meta {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      padding: 24px 32px 8px;
    }}
    .meta-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 16px;
    }}
    .meta-card .label {{
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
    }}
    .meta-card .value {{
      margin-top: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      white-space: pre-wrap;
    }}
    .summary {{
      margin: 8px 32px 0;
      padding: 18px 20px;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      border-radius: 18px;
    }}
    .summary .label {{
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #1d4ed8;
      font-weight: 700;
    }}
    .summary .value {{
      margin-top: 10px;
      font-size: 14px;
      line-height: 1.7;
      color: #1e293b;
      white-space: pre-wrap;
    }}
    .content {{
      padding: 12px 32px 32px;
    }}
    .section {{
      margin-top: 24px;
    }}
    .section h2 {{
      margin: 0 0 12px;
      font-size: 20px;
      color: #0f4b94;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
    }}
    th, td {{
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 16px;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
      line-height: 1.6;
    }}
    th {{
      width: 34%;
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
    }}
    td {{
      color: #0f172a;
      white-space: pre-wrap;
    }}
    tr:last-child th, tr:last-child td {{
      border-bottom: none;
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.18em;">CSWDO Quarterly Submission</div>
      <h1>{escape(definition['label'])}</h1>
      <p>{escape(definition['description'])}</p>
    </div>

    <div class="meta">
      <div class="meta-card"><div class="label">Center Name</div><div class="value">{escape(center_name)}</div></div>
      <div class="meta-card"><div class="label">Barangay</div><div class="value">{escape(barangay_name)}</div></div>
      <div class="meta-card"><div class="label">CDW Name</div><div class="value">{escape(cdw_name)}</div></div>
      <div class="meta-card"><div class="label">Reporting Period</div><div class="value">{escape(reporting_period)}</div></div>
      <div class="meta-card"><div class="label">Submitted On</div><div class="value">{escape(report.submitted_on.strftime('%Y-%m-%d %H:%M')) if report.submitted_on else ''}</div></div>
      <div class="meta-card"><div class="label">Generated File</div><div class="value">Automatically prepared for CSWDO records</div></div>
    </div>

    <div class="summary">
      <div class="label">Submission Summary</div>
      <div class="value">{escape(report.summary or 'No additional summary was provided.')}</div>
    </div>

    <div class="content">
      {''.join(sections_markup)}
    </div>
  </div>
</body>
</html>"""

    @staticmethod
    def _render_quarterly_report_pdf(report, definition):
        payload = report.payload or {}
        metadata = payload.get('report_meta') or {}
        fields = payload.get('fields') or {}
        center_name = metadata.get('center_name') or report.cdc.name
        barangay_name = metadata.get('barangay_name') or getattr(report.cdc.barangay, 'name', 'Unknown')
        cdw_name = metadata.get('cdw_name') or getattr(report.submitted_by, 'username', 'Unknown')
        reporting_period = metadata.get('reporting_period') or f'Q{report.quarter} {report.year}'

        lines = [
            'CSWDO QUARTERLY SUBMISSION',
            definition['label'].upper(),
            '',
            f'Center Name: {center_name}',
            f'Barangay: {barangay_name}',
            f'CDW Name: {cdw_name}',
            f'Reporting Period: {reporting_period}',
            f'Submitted On: {report.submitted_on.strftime("%Y-%m-%d %H:%M") if report.submitted_on else ""}',
            '',
            'Submission Summary:',
        ]
        lines.extend(ReportFileService._wrap_text(report.summary or 'No additional summary was provided.'))

        for section in definition['sections']:
            lines.extend(['', section['title'].upper()])
            for field in section['fields']:
                value = ReportFileService._text_value(fields.get(field['key']))
                wrapped_value = ReportFileService._wrap_text(value, width=74)
                if wrapped_value:
                    lines.append(f'{field["label"]}: {wrapped_value[0]}')
                    for continuation in wrapped_value[1:]:
                        lines.append(f'  {continuation}')
                else:
                    lines.append(f'{field["label"]}: Not provided')

        pages = ReportFileService._paginate_lines(lines, lines_per_page=46)
        return ReportFileService._build_pdf_from_pages(pages)

    @staticmethod
    def _render_periodic_report_html(report, definition):
        if (report.payload or {}).get('summary_version') == 2:
            from core.services.center_report_renderer import render_html
            return render_html(report)
        payload = report.payload or {}
        period = payload.get('period') or {}
        sections = payload.get('template_sections') or []
        metrics = payload.get('auto_calculated') or {}
        charts = payload.get('charts') or []
        evidence = payload.get('evidence') or {}
        auto_tables = payload.get('auto_tables') or {}
        period_label = period.get('label') or ReportFileService._period_label(report).replace('_', ' ').upper()

        def metric_value(key, suffix=''):
            value = metrics.get(key)
            if isinstance(value, float):
                value = round(value, 1)
            return f'{ReportFileService._format_value(value)}{escape(suffix)}'

        def table_markup(rows):
            if not rows:
                return ''
            return f"""
              <table class="data-table">
                <tbody>
                  {''.join(f'<tr><th>{escape(str(row[0]))}</th><td>{ReportFileService._format_value(row[1] if len(row) > 1 else "")}</td></tr>' for row in rows)}
                </tbody>
              </table>
            """

        section_markup = []
        for section in sections:
            rows = section.get('table') or []
            section_markup.append(
                f"""
                <section class="section">
                  <div class="section-heading">
                    <span>{escape(str(len(section_markup) + 1).zfill(2))}</span>
                    <h2>{escape(section.get('title') or 'Report Section')}</h2>
                  </div>
                  <div class="auto-note">{escape(section.get('autoText') or '')}</div>
                  <div class="narrative">{ReportFileService._format_value(section.get('notes'))}</div>
                  {table_markup(rows)}
                </section>
                """
            )

        chart_markup = ''.join(
            f"""
            <div class="chart-row">
              <div class="chart-label"><span>{escape(str(item.get('label') or 'Metric'))}</span><strong>{float(item.get('value') or 0):.1f}%</strong></div>
              <div class="bar"><i style="width:{max(0, min(100, float(item.get('value') or 0))):.1f}%"></i></div>
            </div>
            """
            for item in charts
        )

        evidence_markup = ''
        evidence_items = [(key, value) for key, value in evidence.items() if value]
        if evidence_items:
            cards = []
            for key, value in evidence_items:
                value_text = str(value)
                is_uploaded_image = value_text.lower().startswith('data:image/')
                is_image = is_uploaded_image or re.search(r'\.(png|jpe?g|webp|gif|bmp)(\?.*)?$', value_text, re.IGNORECASE)
                media = f'<img src="{escape(value_text)}" alt="{escape(key.replace("_", " ").title())}" />' if is_image else ''
                file_link = (
                    '<span>Uploaded image</span>'
                    if is_uploaded_image
                    else f'<a href="{escape(value_text)}">{escape(value_text)}</a>'
                )
                cards.append(
                    f"""
                    <div class="evidence-card">
                      {media}
                      <div>
                        <p>{escape(key.replace('_', ' ').title())}</p>
                        {file_link}
                      </div>
                    </div>
                    """
                )
            evidence_markup = f'<section class="evidence"><h2>Photo and File Evidence</h2><div class="evidence-grid">{"".join(cards)}</div></section>'

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(report.title or definition['label'])}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #e5e7eb; color: #172033; }}
    .page {{ max-width: 1040px; margin: 0 auto; background: #fff; box-shadow: 0 24px 80px rgba(15, 23, 42, .18); }}
    .cover {{ min-height: 520px; display: grid; grid-template-columns: 1.1fr .9fr; background: #173f5f; color: #fff; }}
    .cover-copy {{ padding: 56px; display: flex; flex-direction: column; justify-content: space-between; }}
    .kicker {{ font-size: 12px; text-transform: uppercase; letter-spacing: .22em; color: #a7f3d0; font-weight: 800; }}
    .cover h1 {{ margin: 18px 0 0; font-size: 46px; line-height: 1.04; }}
    .cover p {{ max-width: 620px; color: #dbeafe; line-height: 1.7; }}
    .cover-media {{ background: linear-gradient(160deg, #fbbf24, #22c55e 48%, #0891b2); min-height: 320px; }}
    .cover-media img {{ width: 100%; height: 100%; min-height: 520px; object-fit: cover; display: block; }}
    .meta-strip {{ display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #dbe4f0; }}
    .meta-card {{ padding: 20px 24px; border-right: 1px solid #dbe4f0; }}
    .meta-card:last-child {{ border-right: 0; }}
    .label {{ font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-weight: 800; }}
    .value {{ margin-top: 8px; font-size: 16px; font-weight: 800; color: #172033; }}
    .content {{ padding: 32px 42px 46px; }}
    .metric-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }}
    .metric {{ border: 1px solid #dbe4f0; border-radius: 8px; padding: 16px; background: #f8fafc; }}
    .metric strong {{ display: block; margin-top: 8px; font-size: 25px; color: #0f4b94; }}
    .charts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 30px; }}
    .chart-panel, .summary-panel {{ border: 1px solid #dbe4f0; border-radius: 8px; padding: 18px; }}
    .chart-panel h2, .summary-panel h2, .evidence h2 {{ margin: 0 0 14px; font-size: 18px; color: #173f5f; }}
    .chart-row {{ margin-top: 12px; }}
    .chart-label {{ display: flex; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 800; color: #475569; }}
    .bar {{ height: 12px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }}
    .bar i {{ display: block; height: 100%; border-radius: 999px; background: #0f4b94; }}
    .summary-panel p {{ margin: 0; line-height: 1.75; white-space: pre-wrap; }}
    .section {{ margin-top: 24px; break-inside: avoid; }}
    .section-heading {{ display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #173f5f; padding-bottom: 10px; }}
    .section-heading span {{ display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 50%; background: #173f5f; color: #fff; font-size: 13px; font-weight: 900; }}
    .section-heading h2 {{ margin: 0; font-size: 21px; color: #173f5f; }}
    .auto-note {{ margin-top: 12px; padding: 12px 14px; border-left: 4px solid #f59e0b; background: #fffbeb; color: #713f12; font-size: 13px; font-weight: 700; line-height: 1.6; }}
    .narrative {{ margin-top: 12px; line-height: 1.75; white-space: pre-wrap; }}
    .data-table {{ width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #dbe4f0; }}
    .data-table th, .data-table td {{ border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }}
    .data-table th {{ width: 36%; background: #f8fafc; color: #334155; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }}
    .evidence {{ margin-top: 30px; break-inside: avoid; }}
    .evidence-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }}
    .evidence-card {{ overflow: hidden; border: 1px solid #dbe4f0; border-radius: 8px; background: #f8fafc; }}
    .evidence-card img {{ width: 100%; height: 210px; object-fit: cover; display: block; }}
    .evidence-card div {{ padding: 12px; }}
    .evidence-card p {{ margin: 0 0 6px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; color: #64748b; }}
    .evidence-card a, .evidence-card span {{ color: #0f4b94; font-size: 12px; font-weight: 700; word-break: break-all; }}
    @media print {{
      body {{ background: #fff; }}
      .page {{ box-shadow: none; }}
      .cover {{ min-height: 440px; }}
      .cover-media img {{ min-height: 440px; }}
      .section {{ page-break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="cover">
      <div class="cover-copy">
        <div>
          <div class="kicker">CSWDO CDC/CDW Generated Report</div>
          <h1>{escape(report.title or definition['label'])}</h1>
          <p>{escape(definition['description'])}</p>
        </div>
        <div>
          <p><strong>{escape(report.cdc.name)}</strong><br>{escape(getattr(report.cdc.barangay, 'name', 'Unknown'))} Barangay<br>{escape(period_label)}</p>
        </div>
      </div>
      <div class="cover-media">
        {f'<img src="{escape(str(evidence.get("cover_image")))}" alt="CDC cover evidence" />' if evidence.get('cover_image') else ''}
      </div>
    </div>
    <div class="meta-strip">
      <div class="meta-card"><div class="label">Center Name</div><div class="value">{escape(report.cdc.name)}</div></div>
      <div class="meta-card"><div class="label">Barangay</div><div class="value">{escape(getattr(report.cdc.barangay, 'name', 'Unknown'))}</div></div>
      <div class="meta-card"><div class="label">Submitted By</div><div class="value">{escape(getattr(report.submitted_by, 'username', 'Unknown'))}</div></div>
      <div class="meta-card"><div class="label">Reporting Period</div><div class="value">{escape(period_label)}</div></div>
    </div>
    <div class="content">
      <div class="metric-grid">
        <div class="metric"><div class="label">Enrollment</div><strong>{metric_value('enrollment')}</strong></div>
        <div class="metric"><div class="label">Capacity Use</div><strong>{metric_value('utilization', '%')}</strong></div>
        <div class="metric"><div class="label">Reports</div><strong>{metric_value('reportsSubmitted')}</strong></div>
        <div class="metric"><div class="label">Public CDC Gap</div><strong>{metric_value('publicGap')}</strong></div>
      </div>
      <div class="charts">
        <div class="summary-panel">
          <h2>Submission Summary</h2>
          <p>{escape(report.summary or 'No additional summary was provided.')}</p>
        </div>
        <div class="chart-panel">
          <h2>Generated Indicators</h2>
          {chart_markup}
        </div>
      </div>
      {table_markup(auto_tables.get('cdc_information') or [])}
      {''.join(section_markup)}
      {evidence_markup}
    </div>
  </div>
</body>
</html>"""

    @staticmethod
    def _render_periodic_report_pdf(report, definition):
        if (report.payload or {}).get('summary_version') == 2:
            from core.services.center_report_renderer import render_pdf
            return render_pdf(report)
        payload = report.payload or {}
        period = payload.get('period') or {}
        sections = payload.get('template_sections') or []
        metrics = payload.get('auto_calculated') or {}
        period_label = period.get('label') or ReportFileService._period_label(report).replace('_', ' ').upper()

        lines = [
            'CSWDO CDC REPORT',
            definition['label'].upper(),
            '',
            f'Center Name: {report.cdc.name}',
            f'Barangay: {getattr(report.cdc.barangay, "name", "Unknown")}',
            f'Submitted By: {getattr(report.submitted_by, "username", "Unknown")}',
            f'Reporting Period: {period_label}',
            '',
            'AUTO-CALCULATED FIELDS',
        ]
        for key, value in metrics.items():
            lines.append(f'{str(key).replace("_", " ").title()}: {ReportFileService._text_value(value)}')
        lines.extend(['', 'SUMMARY'])
        lines.extend(ReportFileService._wrap_text(report.summary or 'No additional summary was provided.'))

        for section in sections:
            lines.extend(['', str(section.get('title') or 'Report Section').upper()])
            auto_text = section.get('autoText') or ''
            if auto_text:
                lines.extend(ReportFileService._wrap_text(f'Auto: {auto_text}', width=74))
            lines.extend(ReportFileService._wrap_text(section.get('notes') or 'No notes encoded.', width=74))

        pages = ReportFileService._paginate_lines(lines, lines_per_page=46)
        return ReportFileService._build_pdf_from_pages(pages)

    @staticmethod
    def _format_value(value):
        if value in [None, '', [], {}]:
            return '<span style="color:#94a3b8;">Not provided</span>'
        if isinstance(value, bool):
            return 'Yes' if value else 'No'
        if isinstance(value, list):
            return escape(', '.join(str(item) for item in value if item not in [None, '']))
        return escape(str(value))

    @staticmethod
    def _text_value(value):
        if value in [None, '', [], {}]:
            return 'Not provided'
        if isinstance(value, bool):
            return 'Yes' if value else 'No'
        if isinstance(value, list):
            return ', '.join(str(item) for item in value if item not in [None, '']) or 'Not provided'
        return str(value)

    @staticmethod
    def _wrap_text(value, width=82):
        text = ReportFileService._sanitize_pdf_text(value)
        parts = str(text).splitlines() or ['']
        wrapped = []
        for part in parts:
            wrapped.extend(textwrap.wrap(part, width=width) or [''])
        return wrapped

    @staticmethod
    def _paginate_lines(lines, lines_per_page=46):
        pages = []
        current_page = []
        for line in lines:
            current_page.append(line)
            if len(current_page) >= lines_per_page:
                pages.append(current_page)
                current_page = []
        if current_page:
            pages.append(current_page)
        return pages or [['No content available']]

    @staticmethod
    def _build_pdf_from_pages(pages):
        objects = []

        def add_object(content):
            objects.append(content)
            return len(objects)

        font_obj = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        content_obj_ids = []
        page_obj_ids = []

        for page_lines in pages:
            stream = ReportFileService._build_page_stream(page_lines)
            content_obj_ids.append(
                add_object(
                    f"<< /Length {len(stream)} >>\nstream\n".encode('latin-1') + stream + b"\nendstream"
                )
            )
            page_obj_ids.append(None)

        pages_obj_id = add_object(b"")

        for index, content_obj_id in enumerate(content_obj_ids):
            page_obj_ids[index] = add_object(
                (
                    f"<< /Type /Page /Parent {pages_obj_id} 0 R /MediaBox [0 0 612 792] "
                    f"/Resources << /Font << /F1 {font_obj} 0 R >> >> /Contents {content_obj_id} 0 R >>"
                ).encode('latin-1')
            )

        kids = ' '.join(f'{page_id} 0 R' for page_id in page_obj_ids)
        objects[pages_obj_id - 1] = (
            f"<< /Type /Pages /Count {len(page_obj_ids)} /Kids [{kids}] >>"
        ).encode('latin-1')
        catalog_obj = add_object(f"<< /Type /Catalog /Pages {pages_obj_id} 0 R >>".encode('latin-1'))

        pdf = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf += f'{index} 0 obj\n'.encode('latin-1') + obj + b'\nendobj\n'

        xref_offset = len(pdf)
        pdf += f'xref\n0 {len(objects) + 1}\n'.encode('latin-1')
        pdf += b'0000000000 65535 f \n'
        for offset in offsets[1:]:
            pdf += f'{offset:010d} 00000 n \n'.encode('latin-1')
        pdf += (
            f'trailer\n<< /Size {len(objects) + 1} /Root {catalog_obj} 0 R >>\nstartxref\n{xref_offset}\n%%EOF'
        ).encode('latin-1')
        return pdf

    @staticmethod
    def _build_page_stream(lines):
        commands = ['BT', '/F1 11 Tf', '14 TL', '50 760 Td']
        for line in lines:
            escaped = ReportFileService._escape_pdf_string(ReportFileService._sanitize_pdf_text(line))
            commands.append(f'({escaped}) Tj')
            commands.append('T*')
        commands.append('ET')
        return '\n'.join(commands).encode('latin-1')

    @staticmethod
    def _sanitize_pdf_text(value):
        text = str(value or '')
        return text.encode('latin-1', 'replace').decode('latin-1')

    @staticmethod
    def _escape_pdf_string(value):
        return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
