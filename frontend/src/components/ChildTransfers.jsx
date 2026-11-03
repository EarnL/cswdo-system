import React, { useEffect, useState } from 'react';
import api from '../api';

export default function ChildTransfers({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.get('/children/transfers/').then(({ data }) => { if (active) { setRows(Array.isArray(data) ? data : []); setError(''); } })
      .catch(() => { if (active) setError('Transfers unavailable.'); });
    return () => { active = false; };
  }, [attempt]);
  const review = async (row, decision) => {
    setBusy(row.id); setError('');
    try {
      await api.post(`/children/transfers/${row.id}/review/`, { decision });
      setRows(current => current.map(item => item.id === row.id ? { ...item, status: decision, can_review: false } : item));
      setConfirm(null); onChanged?.();
    } catch (err) { setError(err.response?.data?.error || err.response?.data?.detail || 'Unable to review this request. Refresh and try again.'); }
    finally { setBusy(null); }
  };
  if (!rows.length && !error) return null;
  const pending = rows.filter(row => row.status === 'pending');
  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-label="Child transfers">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Child transfers</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{pending.length} pending</span></div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Retry</button></p>}
    {pending.map(row => <div key={row.id} className="mt-4 border-t border-slate-100 pt-4"><p className="font-medium text-slate-900">{row.child_name}</p><p className="mt-1 text-sm text-slate-500">{row.from_cdc} → {row.to_cdc} · {row.academic_year}</p>
      {row.can_review ? confirm === row.id ? <div className="mt-3 rounded-xl bg-blue-50 p-3"><p className="text-sm text-blue-900">Move enrollment to {row.to_cdc}? The child’s records will be retained.</p><div className="mt-3 flex gap-3"><button type="button" disabled={busy !== null} onClick={() => review(row, 'approved')} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === row.id ? 'Saving…' : 'Confirm transfer'}</button><button type="button" disabled={busy !== null} onClick={() => setConfirm(null)} className="text-sm text-slate-600">Cancel</button></div></div> : <div className="mt-3 flex gap-3"><button type="button" disabled={busy !== null} onClick={() => setConfirm(row.id)} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Review transfer</button><button type="button" disabled={busy !== null} onClick={() => review(row, 'declined')} className="text-sm font-medium text-slate-600">Decline</button></div> : <p className="mt-2 text-xs font-medium text-amber-700">Awaiting current center approval</p>}
    </div>)}
    {rows.some(row => row.status !== 'pending') && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-slate-600">Transfer history</summary>{rows.filter(row => row.status !== 'pending').map(row => <div key={row.id} className="mt-3 text-sm"><p className="font-medium">{row.child_name} <span className="ml-2 text-xs capitalize text-slate-500">{row.status}</span></p><p className="text-xs text-slate-500">{row.from_cdc} → {row.to_cdc} · {row.academic_year}</p></div>)}</details>}
  </section>;
}
