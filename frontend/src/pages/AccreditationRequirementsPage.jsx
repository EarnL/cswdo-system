import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { requirementLink } from '../utils/accreditationRequirements';

const inputStyle = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const errorText = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string') return 'Unable to save. Please try again.';
  return data ? Object.entries(data).map(([key, value]) => `${key === 'detail' ? '' : `${key}: `}${Array.isArray(value) ? value.join(' ') : value}`).join(' ') : 'Unable to connect. Please try again.';
};

export default function AccreditationRequirementsPage({ review = false }) {
  const { cdcId, section } = useParams();
  const [centers, setCenters] = useState([]);
  const [selectedId, setSelectedId] = useState(cdcId || '');
  const [workspace, setWorkspace] = useState(null);
  const [values, setValues] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const active = workspace?.sections.find(item => item.key === section);

  useEffect(() => {
    let alive = true;
    setLoading(true); setWorkspace(null); setError(''); setMessage(''); setFile(null); setDirty(false);
    async function load() {
      try {
        let id = cdcId || selectedId;
        if (!cdcId) {
          const response = await api.get('/cdcs/', { params: { assigned_to_me: true } });
          const assigned = Array.isArray(response.data) ? response.data : response.data.results || [];
          if (!alive) return;
          setCenters(assigned); id = id || assigned[0]?.id; setSelectedId(id || '');
        }
        if (!id) { if (alive) setWorkspace(null); return; }
        const response = await api.get(`/cdcs/${id}/pre-opening/`);
        if (!alive) return;
        setWorkspace(response.data);
        setValues(response.data.sections.find(item => item.key === section)?.data || {});
      } catch (failure) { if (alive) setError(errorText(failure)); }
      finally { if (alive) setLoading(false); }
    }
    load();
    return () => { alive = false; };
  }, [cdcId, selectedId, section]);

  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = event => { if (dirty && !window.confirm('Leave without saving your changes?')) event.preventDefault(); };
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = new FormData(); payload.append('data', JSON.stringify(values));
      if (file) payload.append('evidence', file);
      await api.put(`/cdcs/${workspace.cdc.id}/pre-opening/${section}/`, payload);
      const response = await api.get(`/cdcs/${workspace.cdc.id}/pre-opening/`);
      setWorkspace(response.data); setDirty(false); setFile(null);
      setMessage('Saved. You can return and continue at any time.');
    } catch (failure) { setError(errorText(failure)); }
    finally { setSaving(false); }
  }

  async function download(key, filename) {
    try {
      const response = await api.get(`/cdcs/${workspace.cdc.id}/pre-opening/${key}/`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError('Unable to download the file. Please try again.'); }
  }

  if (loading) return <p role="status" className="p-8 text-slate-600">Loading your preparation workspace…</p>;
  if (error && !workspace) return <div role="alert" className="rounded-xl bg-red-50 p-6 text-red-800">{error}<button className="ml-4 underline" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!workspace) return <div className="rounded-2xl bg-white p-8"><h1 className="text-2xl font-bold">No center assigned yet</h1><p className="mt-3 text-slate-600">Ask CSWDO staff to assign your center. You can then prepare requirements here before opening.</p></div>;
  if (section && !active) return <div className="p-8">Requirement not found. <Link className="underline" to="/cdw/accreditation-requirements">Back to requirements</Link></div>;

  return <main className="mx-auto max-w-5xl space-y-6 pb-12">
    <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Before your center opens</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900">{active?.title || 'Prepare to open'}</h1>
      <p className="mt-2 font-medium text-slate-700">{workspace.cdc.name} · {workspace.cdc.barangay}</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{active?.description || 'Prepare your plans and supporting information one step at a time. You do not need enrolled children, attendance, completed health records or an existing accreditation.'}</p>
      {!active && <><p className="mt-5 text-sm font-semibold">{workspace.completedCount} of {workspace.groups.length} sections prepared</p><progress className="mt-2 h-2 w-full accent-blue-700" max="100" value={workspace.readiness} aria-label="Preparation progress" /><p className="mt-2 text-xs text-slate-500">Prepared means the form is filled in. CSWDO still needs to review the information; this does not authorize operation.</p></>}
      {!cdcId && centers.length > 1 && <label className="mt-4 block text-sm font-medium">Your center<select className={inputStyle} value={selectedId} onChange={event => setSelectedId(event.target.value)}>{centers.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>}
    </header>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</div>}
    {message && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</div>}
    {active ? <>
      <Link onClick={leave} to={`/cdw/accreditation-requirements/${workspace.cdc.id}`} className="inline-block font-semibold text-blue-700">← All requirements</Link>
      <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-sm text-slate-600">Save an unfinished form whenever you need. Fill every field to mark this section prepared. If something is not ready, describe what is still needed.</p>
        <fieldset disabled={saving || review} className="space-y-5">
          {active.fields.map(([key, label, kind]) => <label key={key} className="block text-sm font-semibold text-slate-800">{label}
            {kind === 'textarea' ? <textarea rows="3" maxLength="5000" className={inputStyle} value={values[key] || ''} onChange={event => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} /> : <input type={kind} min={kind === 'number' ? 1 : undefined} max={kind === 'number' ? 10000 : undefined} maxLength="5000" className={inputStyle} value={values[key] || ''} onChange={event => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} />}
          </label>)}
          <label className="block rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-5 text-sm font-semibold">{section === 'documents' ? 'Supporting file' : 'Evidence file (optional)'}<span className="mt-1 block text-xs font-normal text-slate-600">PDF, JPG or PNG, up to 10 MB. Combine related pages in one PDF. A new upload replaces the file for this section.</span><input key={active.updated_at || section} className="mt-3 block w-full text-sm" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { const chosen = event.target.files[0]; if (chosen?.size > 10 * 1024 * 1024) { setError('Choose a file smaller than 10 MB.'); event.target.value = ''; return; } setFile(chosen || null); setDirty(true); }} /></label>
        </fieldset>
        {active.filename && <button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={() => download(section, active.filename)}>Download saved file: {active.filename}</button>}
        {!review && <div className="flex flex-wrap items-center gap-4 border-t pt-5"><button disabled={saving} className="rounded-xl bg-blue-800 px-6 py-3 font-semibold text-white hover:bg-blue-900 disabled:opacity-50">{saving ? 'Saving…' : 'Save preparation'}</button><span className="text-sm text-slate-500">{dirty ? 'Unsaved changes' : 'You can edit this again later.'}</span></div>}
      </form>
    </> : <>
      <section aria-label="Preparation requirements" className="grid gap-4 sm:grid-cols-2">
        {workspace.groups.map((group, index) => <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-800">{index + 1}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${group.done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{group.status}</span></div><h2 className="mt-4 text-lg font-bold">{group.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
          {review ? <div className="mt-4 space-y-3">{workspace.sections.find(item => item.key === group.key)?.fields.map(([key, label]) => <div key={key}><p className="text-xs font-bold text-slate-500">{label}</p><p className="whitespace-pre-wrap break-words text-sm">{workspace.sections.find(item => item.key === group.key).data[key] || 'Not provided'}</p></div>)}{workspace.sections.find(item => item.key === group.key)?.filename && <button className="font-semibold text-blue-700 underline" onClick={() => download(group.key, workspace.sections.find(item => item.key === group.key).filename)}>Download evidence</button>}</div> : <Link className="mt-5 inline-flex font-semibold text-blue-700 hover:underline" to={requirementLink(workspace.cdc.id, group.key)}>{group.done ? 'Review or edit' : 'Open form'} →</Link>}
        </article>)}
      </section>
      {!review && <aside className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Ready for CSWDO review?</h2><p className="mt-2 text-sm text-slate-600">Check your saved information, then open Accreditation to submit your request. Keep actual child-service records in the operational modules after authorization.</p><Link to="/cdw/accreditation" className="mt-4 inline-block rounded-xl bg-blue-800 px-5 py-3 font-semibold text-white">Open accreditation request</Link></aside>}
    </>}
  </main>;
}
