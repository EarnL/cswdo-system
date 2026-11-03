import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLabel(value) {
  return String(value || 'record')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function getCertificateDateParts(value) {
  const date = value ? new Date(value) : new Date();
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    display: date.toLocaleDateString(),
  };
}

export async function generateGrantToOperatePDF(request, options = {}) {
  const dateParts = getCertificateDateParts(request?.grant_issued_on || request?.final_decision_at || request?.updated_at);
  const mayorName = options.mayorName || 'MARK DON VICTOR B. ALCALA';
  const certificateNumber = request?.certificate_number || `GTO-LCN-${dateParts.year}-${String(request?.cdc || request?.id || 0).padStart(4, '0')}`;
  const cdcName = request?.cdc_name || 'Registered Child Development Center';
  const address = request?.cdc_address || `${request?.barangay_name || ''} Lucena City, Quezon`.trim();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #111827;
          background: #ffffff;
          font-family: "Times New Roman", Times, serif;
        }
        .sheet {
          width: 11in;
          min-height: 8.5in;
          padding: 0.55in 0.75in;
          background: #ffffff;
          border: 10px double #1f2937;
        }
        .topline {
          display: grid;
          grid-template-columns: 1in 1fr 1in;
          align-items: center;
          text-align: center;
        }
        .logo {
          width: 0.85in;
          height: 0.85in;
          object-fit: contain;
        }
        .republic { font-size: 13px; }
        .city { margin-top: 4px; font-size: 18px; font-weight: 700; text-transform: uppercase; }
        .office { margin-top: 2px; font-size: 14px; font-weight: 700; }
        .cert-no {
          margin-top: 24px;
          text-align: right;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          font-weight: 700;
        }
        h1 {
          margin: 34px 0 20px;
          text-align: center;
          font-size: 31px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .lead, .body {
          text-align: center;
          font-size: 17px;
          line-height: 1.65;
        }
        .name {
          margin: 14px auto 8px;
          max-width: 7.6in;
          border-bottom: 1px solid #111827;
          text-align: center;
          font-size: 23px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .address {
          margin: 0 auto 24px;
          max-width: 7.1in;
          border-bottom: 1px solid #111827;
          text-align: center;
          font-size: 16px;
        }
        .given {
          margin: 30px auto 0;
          max-width: 8in;
          text-align: center;
          font-size: 16px;
          line-height: 1.7;
        }
        .signature {
          margin-top: 56px;
          margin-left: auto;
          width: 3.6in;
          text-align: center;
        }
        .mayor {
          border-bottom: 1px solid #111827;
          padding-bottom: 4px;
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .role { margin-top: 5px; font-size: 12px; text-transform: uppercase; }
        .footer {
          margin-top: 34px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          color: #4b5563;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <header class="topline">
          <img class="logo" src="/cswdo_logo.png" alt="Lucena City Government seal" />
          <div>
            <div class="republic">Republic of the Philippines</div>
            <div class="city">City Government of Lucena</div>
            <div class="office">Office of the City Mayor</div>
            <div class="office">Lucena City, Quezon, Philippines</div>
          </div>
          <img class="logo" src="/cswdo_logo.png" alt="Lucena City Government seal" />
        </header>

        <div class="cert-no">Certificate No. ${escapeHtml(certificateNumber)}</div>
        <h1>Grant to Operate</h1>
        <p class="lead">is hereby issued to</p>
        <div class="name">${escapeHtml(cdcName)}</div>
        <div class="address">${escapeHtml(address)}</div>
        <p class="body">
          for compliance to requirements set by the ECCD Council for Center-Based Programs
          for 0 to 4 Years Old Children.
        </p>
        <p class="given">
          Given this ${escapeHtml(dateParts.day)} day of ${escapeHtml(dateParts.month)}, ${escapeHtml(dateParts.year)}
          in Lucena City, Quezon, Philippines.
        </p>
        <section class="signature">
          <div class="mayor">${escapeHtml(mayorName)}</div>
          <div class="role">City/Municipal Mayor</div>
        </section>
        <footer class="footer">
          This printable Grant to Operate was automatically generated and stored in the CDC accreditation record.
        </footer>
      </main>
    </body>
    </html>
  `;

  const element = document.createElement('div');
  element.innerHTML = htmlContent;

  return html2pdf().set({
    margin: 0,
    filename: `grant_to_operate_${certificateNumber}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
  }).from(element).save();
}

function renderSubmittedData(submissions = {}) {
  const rows = Object.entries(submissions || {}).map(([key, value]) => {
    const formattedValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value ?? 'N/A');

    return `
      <tr>
        <td>${escapeHtml(formatLabel(key))}</td>
        <td><pre>${escapeHtml(formattedValue)}</pre></td>
      </tr>
    `;
  }).join('');

  return rows || '<tr><td colspan="2">No submitted data available.</td></tr>';
}

function renderAttachments(attachments = []) {
  if (!attachments.length) {
    return '<tr><td colspan="3">No attachments were submitted for this record.</td></tr>';
  }

  return attachments.map((attachment, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(attachment.filename || attachment.name || 'Attachment')}</td>
      <td>${escapeHtml(attachment.file || attachment.url || 'Available in system')}</td>
    </tr>
  `).join('');
}

async function generatePDF(options) {
  const {
    paperId,
    paperType,
    cdcName,
    cdcAddress,
    cdcInfo = {},
    submittedDate,
    verificationStatus,
    verifiedDate,
    verifiedBy,
    notes,
    submissions = {},
    attachments = [],
  } = options;

  const statusClass = verificationStatus === 'verified'
    ? 'status-verified'
    : verificationStatus === 'pending_review'
      ? 'status-pending'
      : verificationStatus === 'needs_revision'
        ? 'status-revision'
        : 'status-draft';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #111827;
          background: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
        }
        .sheet {
          width: 8.5in;
          min-height: 11in;
          padding: 0.55in 0.6in;
          background: #ffffff;
        }
        .office-header {
          display: grid;
          grid-template-columns: 0.9in 1fr 0.9in;
          align-items: center;
          border-bottom: 3px double #1f2937;
          padding-bottom: 14px;
          text-align: center;
        }
        .seal {
          width: 0.72in;
          height: 0.72in;
          margin: 0 auto;
          border: 2px solid #1f2937;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #1f2937;
        }
        .republic { font-family: "Times New Roman", serif; font-size: 12px; }
        .office-title { margin-top: 4px; font-size: 14px; font-weight: 800; letter-spacing: 0.04em; }
        .office-subtitle { margin-top: 3px; font-size: 11px; font-weight: 700; }
        .office-address { margin-top: 3px; color: #4b5563; }
        .document-title {
          margin: 18px 0 12px;
          text-align: center;
          text-transform: uppercase;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .reference-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .box {
          border: 1px solid #9ca3af;
          padding: 10px;
          page-break-inside: avoid;
        }
        .box-title {
          margin: -10px -10px 8px;
          padding: 6px 10px;
          border-bottom: 1px solid #9ca3af;
          background: #f3f4f6;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 14px;
        }
        .field span {
          display: block;
          color: #4b5563;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .field strong {
          display: block;
          min-height: 18px;
          padding-top: 3px;
          border-bottom: 1px solid #d1d5db;
          font-size: 11px;
        }
        .status {
          display: inline-block;
          padding: 4px 8px;
          border: 1px solid #6b7280;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .status-verified { border-color: #047857; background: #d1fae5; color: #065f46; }
        .status-pending { border-color: #b45309; background: #fef3c7; color: #92400e; }
        .status-revision { border-color: #be123c; background: #ffe4e6; color: #9f1239; }
        .status-draft { border-color: #6b7280; background: #f3f4f6; color: #374151; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          page-break-inside: auto;
        }
        th, td {
          border: 1px solid #9ca3af;
          padding: 6px;
          vertical-align: top;
          text-align: left;
        }
        th {
          background: #eef2ff;
          font-size: 10px;
          text-transform: uppercase;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
        }
        .notes {
          min-height: 0.7in;
          white-space: pre-wrap;
          line-height: 1.45;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
          margin-top: 28px;
        }
        .signature {
          padding-top: 34px;
          border-top: 1px solid #111827;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .footer {
          margin-top: 18px;
          border-top: 1px solid #d1d5db;
          padding-top: 8px;
          color: #6b7280;
          font-size: 9px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <header class="office-header">
          <div class="seal">LGU</div>
          <div>
            <div class="republic">Republic of the Philippines</div>
            <div class="office-title">CITY / MUNICIPAL GOVERNMENT</div>
            <div class="office-subtitle">City/Municipal Social Welfare and Development Office</div>
            <div class="office-address">Child Development Center Accreditation and Monitoring Unit</div>
          </div>
          <div class="seal">CSWDO</div>
        </header>

        <h1 class="document-title">${escapeHtml(formatLabel(paperType))}</h1>

        <section class="reference-row">
          <div class="box">
            <div class="box-title">Record Reference</div>
            <div class="field-grid">
              <div class="field"><span>Record No.</span><strong>CDC-${escapeHtml(String(paperId || '').slice(0, 8).toUpperCase())}</strong></div>
              <div class="field"><span>Date Generated</span><strong>${escapeHtml(new Date().toLocaleString())}</strong></div>
            </div>
          </div>
          <div class="box">
            <div class="box-title">Verification Status</div>
            <span class="status ${statusClass}">${escapeHtml(formatLabel(verificationStatus || 'draft'))}</span>
          </div>
        </section>

        <section class="box">
          <div class="box-title">Child Development Center Information</div>
          <div class="field-grid">
            <div class="field"><span>CDC Name</span><strong>${escapeHtml(cdcName || cdcInfo.name || 'Not recorded')}</strong></div>
            <div class="field"><span>Barangay</span><strong>${escapeHtml(cdcInfo.barangay_name || 'Not recorded')}</strong></div>
            <div class="field"><span>Address</span><strong>${escapeHtml(cdcAddress || cdcInfo.address || 'Not recorded')}</strong></div>
            <div class="field"><span>Assigned CDW</span><strong>${escapeHtml(cdcInfo.assigned_cdw_name || 'Not assigned')}</strong></div>
          </div>
        </section>

        <section class="box" style="margin-top: 12px;">
          <div class="box-title">Submission and Verification Details</div>
          <div class="field-grid">
            <div class="field"><span>Date Submitted</span><strong>${escapeHtml(formatDate(submittedDate))}</strong></div>
            <div class="field"><span>Date Verified</span><strong>${escapeHtml(formatDate(verifiedDate))}</strong></div>
            <div class="field"><span>Verifying CSWDO Staff</span><strong>${escapeHtml(verifiedBy || 'Not assigned')}</strong></div>
            <div class="field"><span>Official Status</span><strong>${escapeHtml(formatLabel(verificationStatus || 'draft'))}</strong></div>
          </div>
        </section>

        <section class="box" style="margin-top: 12px;">
          <div class="box-title">Submitted Data</div>
          <table>
            <thead><tr><th style="width: 34%;">Field</th><th>Value</th></tr></thead>
            <tbody>${renderSubmittedData(submissions)}</tbody>
          </table>
        </section>

        <section class="box" style="margin-top: 12px;">
          <div class="box-title">Evidence and Attachments</div>
          <table>
            <thead><tr><th style="width: 8%;">No.</th><th style="width: 42%;">Attachment</th><th>System File Reference</th></tr></thead>
            <tbody>${renderAttachments(attachments)}</tbody>
          </table>
        </section>

        <section class="box" style="margin-top: 12px;">
          <div class="box-title">Comments and Findings</div>
          <div class="notes">${escapeHtml(notes || 'No official comments or findings recorded.')}</div>
        </section>

        <section class="signature-grid">
          <div class="signature">Prepared by / CDW</div>
          <div class="signature">Verified by / CSWDO Staff</div>
          <div class="signature">Approved by / CSWDO Head</div>
        </section>

        <footer class="footer">
          This document was generated from the CDC Accreditation and Monitoring System for office review, printing, and accreditation record filing.
        </footer>
      </main>
    </body>
    </html>
  `;

  const element = document.createElement('div');
  element.innerHTML = htmlContent;

  const optionsHtml2Pdf = {
    margin: 0,
    filename: `cdc_accreditation_record_${paperId}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  };

  return html2pdf().set(optionsHtml2Pdf).from(element).save();
}

export default generatePDF;
