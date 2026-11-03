import React, { useEffect, useState } from 'react';
import api from '../api';

export default function PopulationAdoptionStatus() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(false);
  useEffect(() => { api.get('/population-adoption-status/').then(response => setRows(response.data)).catch(() => setError(true)); }, []);
  return <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-semibold text-slate-800">CDC adoption <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{rows.filter(row => row.status === 'Pending review').length} pending</span></summary>{error ? <p role="alert" className="mt-3 text-sm text-red-700">Could not load adoption status. Refresh to retry.</p> : <div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-500">{['CDC', 'Academic year', 'CDW', 'Status'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-3 font-medium text-slate-800">{row.cdc}</td><td className="px-3 py-3 text-slate-600">{row.year}</td><td className="px-3 py-3 text-slate-600">{row.cdw}</td><td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${row.status === 'Applied' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{row.status}</span></td></tr>)}</tbody></table>{!rows.length && <p className="p-3 text-sm text-slate-500">No published population basis yet.</p>}</div>}</details>;
}
