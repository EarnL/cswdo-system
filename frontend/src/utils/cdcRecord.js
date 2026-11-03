export const recordLabel = (key) => key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\bCdc\b/g, 'CDC').replace(/\bCdw\b/g, 'CDW').replace(/\bSnp\b/g, 'SNP');

const definitions = [
  ['CDC Information', /^(id|name|contact_person|contact_number|email|establishment_date|registration_purpose|operating_days|operating_hours|special_notes)$/],
  ['Location', /^(barangay|barangay_name|address|latitude|longitude)$/],
  ['CDW Information & Staffing', /staff|caregiver|volunteer|assigned_cdw/],
  ['Accreditation & Compliance', /accredit|license|grant|authority|permit|evaluation|supervisory|compliance|supporting_document/],
  ['Capacity & Enrollment', /capacity|enrollment|session|population|gap|coverage|snp/],
  ['Programs & Facilities', /building|area|water|sanitation|electricity|offers_|feeding|has_health_services|physical_environment/],
  ['Health & Safety', /health|emergency|safety|protection/],
  ['Curriculum & Interactions', /curriculum|assessment|interaction/],
  ['Record Activity', /audit|created_at|updated_at/],
  ['Other Records', /.*/],
];

export function groupCdcRecord(cdc) {
  const groups = definitions.map(([title]) => ({ title, fields: {} }));
  Object.entries(cdc).forEach(([key, value]) => {
    groups[definitions.findIndex(([, pattern]) => pattern.test(key))].fields[key] = value;
  });
  return groups.filter((group) => Object.keys(group.fields).length);
}

export function recordText(value) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

const escape = (value) => recordText(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function recordHtml(value) {
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `<article><h4>Record ${index + 1}</h4>${recordHtml(item)}</article>`).join('') : '<p>No records</p>';
  if (value && typeof value === 'object') return `<dl>${Object.entries(value).map(([key, item]) => `<div><dt>${escape(recordLabel(key))}</dt><dd>${recordHtml(item)}</dd></div>`).join('')}</dl>`;
  return `<span>${escape(value)}</span>`;
}

export function buildCdcRecordDownload({ cdc, records, exported_at }) {
  const sections = [...groupCdcRecord(cdc).map(({ title, fields }) => [title, fields]), ...Object.entries(records).map(([key, value]) => [recordLabel(key), value])];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(cdc.name)} — Official CDC Record</title><style>
  body{font:14px/1.6 system-ui,sans-serif;color:#172033;max-width:1000px;margin:40px auto;padding:0 24px}h1{margin-bottom:0}h2{color:#0f4b94;border-bottom:2px solid #dae4ef;padding-bottom:8px}section{margin:32px 0}dl{margin:0}dl>div{padding:8px 0;border-bottom:1px solid #e2e8f0}dt{font-weight:700;color:#475569}dd{margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}dd dl{margin-left:16px}article{border:1px solid #cbd5e1;padding:16px;margin:12px 0}h4{margin:0 0 8px}nav a{display:inline-block;margin:4px 16px 4px 0}a{color:#0f4b94}@media print{body{margin:0;max-width:none}nav{display:none}h2,h4,dt{break-after:avoid}section{break-inside:auto}}
  </style></head><body><p>Official CDC Record</p><h1>${escape(cdc.name)}</h1><p>${escape(cdc.barangay_name)} · Exported ${escape(exported_at)}</p><p>Complete recorded information and related records. File references are included; uploaded file contents are not embedded. Open this file in a browser to read, print, or save as PDF.</p><nav>${sections.map(([title], index) => `<a href="#section-${index}">${escape(title)}</a>`).join('')}</nav>${sections.map(([title, value], index) => `<section id="section-${index}"><h2>${escape(title)}</h2>${recordHtml(value)}</section>`).join('')}</body></html>`;
}

export function downloadCdcRecord(payload) {
  const url = URL.createObjectURL(new Blob([buildCdcRecordDownload(payload)], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(payload.cdc.name || 'CDC').replace(/[^a-z0-9_-]/gi, '_')}_Official_Record.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
