import React from 'react';

export default function ReportCdcField({ cdcs, value, onChange, readOnlyWhenSingle = true, className = '', ...props }) {
  const selected = cdcs.find(cdc => String(cdc.id) === String(value));
  if (readOnlyWhenSingle && cdcs.length <= 1) return <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"><p className="font-semibold text-slate-900">{selected?.name || 'No CDC assigned'}</p><p className="mt-1 text-xs text-slate-500">{selected ? selected.barangay_name || 'Assigned to your account' : 'Contact CSWDO to assign your account to a CDC.'}</p></div>;
  return <select {...props} aria-label="Assigned CDC" value={value} onChange={onChange} className={className || 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'}><option value="">Select assigned CDC</option>{cdcs.map(cdc => <option key={cdc.id} value={cdc.id}>{cdc.name} - {cdc.barangay_name}</option>)}</select>;
}
