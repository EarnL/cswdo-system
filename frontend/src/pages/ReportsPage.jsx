import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TableSkeleton } from '../components/LoadingState';
import { loadReportList } from '../utils/loadReportList';

export default function ReportsPage() {
  const [centers, setCenters] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const base = localStorage.getItem('role') === 'staff' ? '/staff' : '/admin';
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    Promise.all([loadReportList('/cdcs/'), loadReportList('/reports/', { include_history: 'true' })]).then(([cdcs, files]) => {
      if (live) { setCenters(cdcs); setReports(files); }
    }).catch(() => { if (live) setError('Unable to load monitoring reports. Please try again.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);
  const rows = useMemo(() => centers.map(center => {
    const files = reports.filter(report => String(report.cdc) === String(center.id));
    const latest = files.reduce((value, report) => report.submitted_on && (!value || report.submitted_on > value) ? report.submitted_on : value, null);
    return { ...center, count: files.length, latest };
  }).filter(center => `${center.name} ${center.barangay_name} ${center.assigned_cdw_name || ''}`.toLowerCase().includes(search.toLowerCase())), [centers, reports, search]);
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Monitoring Reports</p><h1 className="mt-2 text-2xl font-black text-slate-950">CDC List</h1><p className="mt-2 text-sm text-slate-500">Select a center to view its reports and history.</p></header>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><label className="w-full sm:max-w-md"><span className="sr-only">Search centers</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search CDC or barangay" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0f4b94]" /></label><span className="text-xs font-black text-slate-500">{loading ? 'Loading...' : `${rows.length} centers`}</span></div>
      {error ? <div role="alert" className="p-6 text-sm font-bold text-rose-700">{error} <button onClick={() => setAttempt(attempt + 1)} className="underline">Retry</button></div> : loading ? <TableSkeleton rows={5} columns={3} /> : <div className="divide-y divide-slate-100">{rows.map(center => <Link key={center.id} to={`${base}/reports/cdc/${center.id}`} className="flex flex-col gap-4 p-5 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f4b94] sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="break-words text-base font-black text-slate-950">{center.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{center.barangay_name || 'Barangay not recorded'}</p></div><div className="flex shrink-0 items-center justify-between gap-6"><div className="text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{center.count} reports</span><p className="mt-2 text-xs text-slate-500">{center.latest ? `Latest: ${new Date(center.latest).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No reports yet'}</p></div><span className="text-sm font-black text-[#0f4b94]">View reports &rarr;</span></div></Link>)}{!rows.length && <p className="p-8 text-center text-sm text-slate-500">No centers match your search.</p>}</div>}
    </section>
  </div>;
}
