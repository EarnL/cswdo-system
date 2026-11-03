import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import AppIcon from './AppIcon';

const dateLabel = value => value ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : 'Previously approved';
const errorText = error => error.response?.data?.detail || (Array.isArray(error.response?.data) ? error.response.data.join(' ') : 'Unable to save. Please try again.');

export default function PopulationBasisNotice({ cdcId, onApplied }) {
  const [data, setData] = useState(null);
  const dialog = useRef(null);
  const historyDialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    if (!cdcId) return;
    try { const response = await api.get(`/cdcs/${cdcId}/population-basis/`); setData(response.data); setError(''); }
    catch { setError('Unable to check updates.'); }
  }, [cdcId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open, data]);
  if (!cdcId) return null;
  if (!data) return error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{error} <button onClick={load} className="ml-2 font-semibold underline">Retry</button></div> : <div role="status" className="h-20 animate-pulse rounded-2xl bg-slate-100"><span className="sr-only">Checking population updates</span></div>;
  const pending = data.updates.filter(item => !item.is_applied);
  const previous = data.history.find(row => row.basis.id !== data.current?.id);
  const item = pending.find(row => row.available.id === selected) || pending[0];
  const apply = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await api.post(`/cdcs/${cdcId}/population-basis/`, { submission: item.available.id });
      setData(response.data); setOpen(false);
      setSuccess('Update applied. All child records are retained.');
      onApplied?.();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  return <section id={`population-update-${cdcId}`} aria-label="Population basis" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0f4b94]"><AppIcon name="children" className="h-5 w-5" /></span><div className="min-w-0"><h2 className="text-sm font-semibold text-slate-500">Population Data</h2><p className="mt-3 text-xs font-semibold text-slate-500">Currently in Use</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{data.current ? `Academic year ${data.working_year}` : 'No population data selected'}</p><p className="mt-2 break-words text-sm text-slate-600">{data.current?.title || 'Review an approved update to get started.'}</p><p className="mt-1 text-xs text-slate-400">{data.cdc}</p></div></div>
      {data.current?.population != null && <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-2xl font-bold tabular-nums text-slate-900">{data.current.population.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Children ages 3–4</p></div>}
    </div>
    {pending.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 bg-blue-50/70 px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><AppIcon name="bell" className="h-4 w-4 text-blue-700" /><p className="text-sm font-semibold text-blue-900">{pending.length > 1 ? `${pending.length} updates ready` : item.new_year ? 'New academic year available' : 'Update available'}</p></div><div className="w-full text-sm text-slate-600">{item.available.title}<span className="mt-1 block text-xs">Academic year {item.available.year}</span></div><button onClick={() => setOpen(true)} aria-haspopup="dialog" className="rounded-xl bg-[#0f4b94] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Review update</button></div>}
    {success && <p role="status" className="px-5 pb-4 text-sm text-emerald-700">{success}</p>}
    {error && !open && <p role="alert" className="px-5 py-3 text-sm text-red-700">{error} <button onClick={load} className="ml-2 font-semibold underline">Retry</button></p>}
    {!pending.length && data.current && !error && <p className="border-t border-slate-100 px-5 py-3 text-xs font-semibold text-emerald-700">Up to date</p>}
    <div className="space-y-2 border-t border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-xs font-semibold text-slate-500">Previous Dataset</h3>{previous ? <><p className="text-sm font-medium text-slate-800">{previous.basis.title}</p><p className="text-xs text-slate-500">Academic year {previous.basis.year}</p></> : <p className="text-sm text-slate-500">No previous datasets.</p>}<button onClick={() => historyDialog.current.showModal()} className="text-sm font-semibold text-[#0f4b94]">View Dataset History &rarr;</button></div>
    <dialog ref={historyDialog} aria-labelledby={`dataset-history-${cdcId}`} className="m-auto max-h-[85vh] w-11/12 max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-5 shadow-2xl backdrop:bg-slate-900/40"><div className="flex items-center justify-between gap-3"><h2 id={`dataset-history-${cdcId}`} className="text-xl font-bold text-slate-900">Dataset History</h2><button onClick={() => historyDialog.current.close()} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Close history</button></div><p className="mt-2 text-sm text-slate-500">Datasets applied by {data.cdc}.</p><div className="mt-5 space-y-3">{data.history.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Academic year {row.basis.year}</p><h3 className="mt-1 font-semibold text-slate-900">{row.basis.title}</h3>{row.basis.id === data.current?.id && <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Currently in Use</span>}<p className="mt-2 text-xs text-slate-500">Applied {dateLabel(row.applied_at)} · {row.applied_by}</p></article>)}{!data.history.length && <p className="text-sm text-slate-500">No datasets have been applied yet.</p>}</div></dialog>
    <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else setOpen(false); }} aria-labelledby={`basis-title-${cdcId}`} className="m-auto max-h-[90vh] w-11/12 max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40">
      {item && <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.new_year ? 'New academic year' : 'Population update'}</p><h2 id={`basis-title-${cdcId}`} className="mt-1 text-xl font-bold text-slate-900">Review population update</h2></div><button disabled={busy} onClick={() => setOpen(false)} aria-label="Close review" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Close</button></div>
        {pending.length > 1 && <div role="group" aria-label="Available updates" className="flex flex-wrap gap-2">{pending.map(row => <button key={row.available.id} disabled={busy} aria-pressed={row.available.id === item.available.id} onClick={() => setSelected(row.available.id)} className={`rounded-xl border px-3 py-2 text-left text-sm ${row.available.id === item.available.id ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-600'}`}>{row.available.year}<span className="mt-1 block text-xs">{row.available.title}</span></button>)}</div>}
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Academic year {item.available.year}</p><h3 className="mt-1 font-semibold text-slate-900">{item.available.title}</h3><p className="mt-2 text-xs text-slate-500">Approved by {item.available.approved_by} · {dateLabel(item.available.approved_at)}</p></div>
        <div className="grid grid-cols-2 gap-3">{[['Current population', item.current?.population ?? data.current?.population ?? '—', 'bg-slate-50'], ['New population', item.available.population ?? 'No data', 'bg-blue-50']].map(([label, value, tone]) => <div key={label} className={`rounded-xl p-4 ${tone}`}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="mt-1 text-xs text-slate-500">Children ages 3–4</p></div>)}</div>
        <div className="flex flex-wrap gap-3 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">{item.added} added</span><span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800">{item.needs_review} to review</span></div>
        {item.review_children?.length > 0 && <section className="rounded-xl border border-amber-100 p-4"><h3 className="text-sm font-semibold text-amber-900">Missing from this upload</h3><p className="mt-1 text-xs text-slate-500">Existing records are retained.</p><ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">{item.review_children.map(child => <li key={child.id} className="text-sm text-slate-700">{child.name}</li>)}</ul></section>}
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{item.new_year ? 'Previous-year records stay in history. Enroll children separately for the new year.' : 'Enrollment, health and assessment records stay intact.'}</p>
        {item.new_year && item.year_review?.length > 0 && <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-700">Next-year enrollment</h3><ul className="mt-3 max-h-40 space-y-3 overflow-y-auto">{item.year_review.map(child => <li key={child.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{child.name}</span><span className="text-xs text-slate-500">{child.eligible ? 'Eligible to re-enroll' : 'Outside daycare age range'}</span></li>)}</ul></section>}
        {item.available.population === null && <p role="alert" className="text-sm text-amber-800">No figures for your barangay. Ask CSWDO to check this upload.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4"><button disabled={busy} onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Later</button><button disabled={busy || item.available.population === null} onClick={apply} className="rounded-xl bg-[#0f4b94] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50">{busy ? 'Applying…' : item.new_year ? 'Open academic year' : 'Apply update'}</button></div>
      </div>}
    </dialog>
  </section>;
}
