import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { useNotifications } from '../components/NotificationContext';

const labels = { awaiting_submission: 'Awaiting submission', under_review: 'Under review', needs_revision: 'Needs correction', completed: 'Completed', cancelled: 'Cancelled' };
const tones = { awaiting_submission: 'bg-brand-tint text-brand-navy', under_review: 'bg-blue-50 text-blue-800', needs_revision: 'bg-rose-50 text-rose-800', completed: 'bg-emerald-50 text-emerald-800', cancelled: 'bg-slate-100 text-slate-600' };
const dateLabel = (value) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errorMessage = (error) => {
  const data = error?.response?.data;
  if (typeof data === 'string') return 'The request could not be completed. Please try again.';
  if (Array.isArray(data)) return data.join(' ');
  if (data) return Object.entries(data).map(([key, value]) => `${['detail', 'error', 'non_field_errors'].includes(key) ? '' : `${key.replaceAll('_', ' ')}: `}${Array.isArray(value) ? value.join(' ') : value}`).join(' ');
  return 'Could not connect. Please try again.';
};
function Badge({ item }) {
  return <span className="inline-flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[item.status]}`}>{labels[item.status]}</span>
    {['due_soon', 'overdue'].includes(item.deadline_status) && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.deadline_status === 'overdue' ? 'bg-rose-50 text-rose-800' : 'bg-brand-cream text-amber-900'}`}>{item.deadline_status === 'overdue' ? 'Overdue' : 'Due soon'}</span>}
  </span>;
}
function Field({ label, children, hint }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}{hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}</label>;
}
const inputClass = 'w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-brand-navy';

function RequestForm({ onCreated, onClose }) {
  const [completedRequests, setCompletedRequests] = useState([]);
  const [existingRequest, setExistingRequest] = useState(null);
  useEffect(() => { let live = true; api.get('/population-requests/').then(response => { if (live) setCompletedRequests((Array.isArray(response.data) ? response.data : response.data.results || []).filter(item => item.status === 'completed')); }).catch(() => {}); return () => { live = false; }; }, []);
  const [years, setYears] = useState([]);
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: 'Child population data', purpose: '', instructions: '', coverage: 'All Lucena City barangays; children aged 0-5', academic_year: '', period_start: '', period_end: '', due_date: '', frequency: 'annually', correction_of: '', overlap_reason: '', next_period_start: '', due_days: 14 });
  useEffect(() => { let live = true; api.get('/academic-years/').then((academic) => {
    if (!live) return;
    setYears(academic.data);
    setForm((current) => ({ ...current, academic_year: academic.data.find((year) => year.is_active)?.id || '' }));
  }).catch((err) => { if (live) setError(errorMessage(err)); }); return () => { live = false; }; }, []);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const field = (key, label, type = 'text', extra = {}) => <Field label={label}><input type={type} value={form[key]} onChange={change(key)} className={inputClass} required {...extra} /></Field>;
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setExistingRequest(null);
    const common = { title: form.title, purpose: form.purpose, instructions: form.instructions, coverage: form.coverage };
    try {
      const response = await api.post(recurring ? '/population-request-schedules/' : '/population-requests/', recurring ? { ...common, frequency: form.frequency, next_period_start: form.next_period_start, due_days: Number(form.due_days) } : { ...common, academic_year: form.academic_year, correction_of: form.correction_of || null, overlap_reason: form.overlap_reason, period_start: form.period_start, period_end: form.period_end, due_date: form.due_date });
      onCreated(recurring ? null : response.data.id);
    } catch (err) { setError(errorMessage(err)); const id = err.response?.data?.existing_request_id; setExistingRequest(Array.isArray(id) ? id[0] : id); } finally { setBusy(false); }
  };
  return <section className="lgu-card p-5 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3"><div><p className="lgu-kicker">New request</p><h2 className="mt-1 text-lg font-semibold text-brand-navy">Tell CHO what you need</h2></div><button type="button" onClick={onClose} disabled={busy} className="lgu-button-secondary">Close</button></div>
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="lgu-alert-error">{error}</p>}{existingRequest && <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => onCreated(existingRequest)}>Open existing request #{existingRequest}</button>}
      <div className="grid gap-4 sm:grid-cols-2">{field('title', 'Request title')}
        <div><p className="mb-1.5 text-sm font-medium text-slate-700">Send to</p><p className="rounded-lg bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand-navy">City Health Office (CHO)</p><p className="mt-1 text-xs text-slate-500">CHO receives this request automatically.</p></div>
      </div>
      <Field label="Why is this data needed?"><textarea required rows={2} value={form.purpose} onChange={change('purpose')} className={inputClass} placeholder="For example, to update barangay childcare coverage estimates." /></Field>
      {field('coverage', 'Coverage')}
      {!recurring && <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Correction or overlapping period</summary><div className="mt-3 space-y-3"><Field label="Completed request"><select value={form.correction_of} onChange={event => { const item = completedRequests.find(row => String(row.id) === event.target.value); setForm(current => ({ ...current, correction_of: event.target.value, ...(item ? {academic_year:item.academic_year, period_start:item.period_start, period_end:item.period_end, coverage:item.coverage} : {}) })); }} className={inputClass}><option value="">Not a correction</option>{completedRequests.map(item => <option key={item.id} value={item.id}>#{item.id} - {item.title} ({item.period_start} to {item.period_end})</option>)}</select></Field><Field label="Reason"><textarea value={form.overlap_reason} onChange={change('overlap_reason')} className={inputClass} rows={2} /></Field></div></details>}
      <Field label="Instructions (optional)"><textarea rows={2} value={form.instructions} onChange={change('instructions')} className={inputClass} placeholder="Include any source, format, or completeness requirements." /></Field>
      <Field label="Request frequency"><select value={recurring ? 'recurring' : 'once'} onChange={(event) => setRecurring(event.target.value === 'recurring')} className={inputClass}><option value="once">One time</option><option value="recurring">Recurring schedule</option></select></Field>
      {recurring ? <div className="grid gap-4 rounded-xl bg-brand-soft p-4 sm:grid-cols-3">
        <Field label="Repeat"><select value={form.frequency} onChange={change('frequency')} className={inputClass}><option value="monthly">Every month</option><option value="quarterly">Every quarter</option><option value="annually">Every year</option></select></Field>
        <Field label="First reporting period" hint="Choose the first day of a calendar month, quarter, or year."><input type="date" required value={form.next_period_start} onChange={change('next_period_start')} className={inputClass} /></Field>
        {field('due_days', 'Days to submit from period start', 'number', { min: 1, max: 366 })}
        <p className="text-xs text-slate-600 sm:col-span-3">One request per period. Periods already covered by another request are skipped. The planning year follows the June–May cycle. You can pause the schedule at any time.</p>
      </div> : <div className="grid gap-4 rounded-xl bg-brand-soft p-4 sm:grid-cols-2">
        {field('period_start', 'Reporting period starts', 'date')}{field('period_end', 'Reporting period ends', 'date', { min: form.period_start })}
        {field('due_date', 'Submission deadline', 'date', { min: today() })}
        <Field label="Planning / academic year" hint="Used to connect the data to existing planning and analysis records."><select required value={form.academic_year} onChange={change('academic_year')} className={inputClass}><option value="">Choose a year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></Field>
      </div>}
      <div className="flex justify-end"><button disabled={busy} className="lgu-button-primary">{busy ? 'Saving…' : recurring ? 'Create schedule' : 'Send request to CHO'}</button></div>
    </form>
  </section>;
}

function UploadResponse({ item, onSaved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current += 1; }, []);
  const choose = async (event) => {
    const selected = event.target.files[0] || null;
    const current = ++version.current;
    setFile(selected); setPreview(null); setError(''); setChecking(false);
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) { setError('Choose a CSV or Excel file smaller than 10 MB.'); return; }
    setChecking(true);
    try { const body = new FormData(); body.append('data_file', selected); const response = await api.post('/population-data/preview_upload/', body); if (current === version.current) setPreview(response.data); }
    catch (err) { if (current === version.current) setError(errorMessage(err)); }
    finally { if (current === version.current) setChecking(false); }
  };
  const ready = file && preview?.valid && !preview.missing_required_columns?.length && !checking;
  const submit = async (event) => {
    event.preventDefault(); if (!ready) return;
    setBusy(true); setError('');
    try { const body = new FormData(); body.append('data_file', file); body.append('notes', notes); await api.post(`/population-requests/${item.id}/submit/`, body); onSaved('Your file was sent to City Planning for review.'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const template = async () => {
    try { const response = await api.get('/population-requests/template/', { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'population-data-template.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (err) { setError('The template could not be downloaded. Please try again.'); }
  };
  return <section className="lgu-card p-5 sm:p-6"><p className="lgu-kicker">Your response</p><h2 className="mt-2 text-lg font-semibold text-brand-navy">{item.status === 'needs_revision' ? 'Upload a corrected file' : 'Upload population data'}</h2>
    <p className="mt-2 text-sm text-slate-600">Check your file preview before sending.</p>
    <div className="my-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-brand-tint px-3 py-1.5">1. Choose file</span><span className="rounded-full bg-brand-tint px-3 py-1.5">2. Check preview</span><span className="rounded-full bg-brand-tint px-3 py-1.5">3. Send for review</span></div>
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="lgu-alert-error">{error}</p>}
      <div className="rounded-xl border border-dashed border-brand-border bg-brand-soft p-5"><Field label="CSV or Excel file" hint="Up to 10 MB. One row per child. Dates should use YYYY-MM-DD."><input type="file" accept=".csv,.xlsx,.xls" required disabled={busy} onChange={choose} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-navy file:px-4 file:py-2 file:text-white" /></Field><button type="button" onClick={template} className="mt-3 text-sm font-semibold text-brand-navy underline underline-offset-4">Download blank template</button></div>
      {checking && <p role="status" className="text-sm text-slate-600">Checking your file…</p>}
      {preview && <div className="space-y-3"><p role="status" className={ready ? 'lgu-alert-success' : 'lgu-alert-warning'}>{ready ? `${preview.row_count} ${preview.row_count === 1 ? 'record' : 'records'} found. Required columns are present. Ready for your review.` : `Add these required columns: ${(preview.missing_required_columns || []).join(', ')}`}</p>
        {preview.preview_rows?.length > 0 && <div className="max-h-56 overflow-auto rounded-lg border border-brand-border"><table><caption className="p-2 text-left text-xs text-slate-500">First {preview.preview_rows.length} rows — check the values before sending.</caption><thead><tr>{preview.detected_columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.preview_rows.map((row, index) => <tr key={index}>{preview.detected_columns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>}
      </div>}
      <Field label={item.status === 'needs_revision' ? 'What did you correct? (optional)' : 'Notes for City Planning (optional)'}><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={inputClass} /></Field>
      <button type="submit" disabled={!ready || busy} className="lgu-button-primary">{busy ? 'Sending…' : item.status === 'needs_revision' ? 'Send corrected file' : 'Send to City Planning'}</button>
    </form>
  </section>;
}

function ReviewActions({ item, onSaved }) {
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = ['received', 'under_planning_review'].includes(item.submission?.status);
  const act = async (action, body, message) => {
    setBusy(true); setError('');
    try { await api.post(`/population-data/${item.submission.id}/${action}/`, body); onSaved(message); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <section className="lgu-card p-5"><p className="lgu-kicker">City Planning review</p><h2 className="mt-2 text-lg font-semibold text-brand-navy">Check the file before forwarding</h2><p className="my-3 text-sm text-slate-600">Confirm accuracy and completeness. Approval forwards the validated file to CSWDO and completes this request. CSWDO decides separately when to use it for planning.</p>
    {error && <p role="alert" className="lgu-alert-error mb-3">{error}</p>}
    <div className="flex flex-wrap gap-3">{!started ? <button disabled={busy} onClick={() => act('mark_received', {}, 'Review started. Check the file, then approve it or request corrections.')} className="lgu-button-primary">Start review</button> : <button disabled={busy} onClick={() => act('send_to_cswdo', {}, 'Approved and sent to CSWDO. This request is complete.')} className="lgu-button-primary">Approve & send to CSWDO</button>}
      <button disabled={busy} onClick={() => setReturning(!returning)} className="lgu-button-secondary">{returning ? 'Close correction form' : 'Request corrections'}</button></div>
    {returning && <form className="mt-5 space-y-4 rounded-xl bg-brand-soft p-4" onSubmit={(event) => { event.preventDefault(); act('return_to_cho', { revision_reason: reason, remarks, revision_due_date: deadline }, 'Returned to CHO with your correction instructions.'); }}>
      <Field label="Reason"><input required maxLength={120} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="For example, missing barangay records" /></Field>
      <Field label="What needs to be corrected?"><textarea required rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} className={inputClass} /></Field>
      <Field label="Correction deadline"><input type="date" required min={today()} value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass} /></Field>
      <button disabled={busy} className="lgu-button-primary">Return to CHO</button>
    </form>}
  </section>;
}

export default function PopulationRequestsPage({ role = 'cho', mode = 'requests' }) {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();
  const [items, setItems] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('status') || 'all';
  const setFilter = (value) => setSearchParams((current) => { const next = new URLSearchParams(current); if (value === 'all') next.delete('status'); else next.set('status', value); return next; });
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cswdo = ['admin', 'staff'].includes(role);
  const base = `/${role}/data-requests`;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/population-requests/'); setItems(response.data);
      if (cswdo) { const result = await api.get('/population-request-schedules/'); setSchedules(result.data); }
      if (role === 'cho' && mode === 'submissions') { const result = await api.get('/population-data/'); setLegacy(result.data.filter((item) => !item.data_request)); }
    } catch (err) { setError(errorMessage(err)); } finally { setLoading(false); }
  }, [cswdo, role, mode]);
  useEffect(() => { load(); }, [load]);
  const saved = async (text) => { setMessage(text); await load(); refreshNotifications(); };
  const selected = items.find((item) => String(item.id) === requestId);
  const open = items.filter((item) => ['awaiting_submission', 'needs_revision'].includes(item.status));
  const attention = open.filter((item) => item.status === 'needs_revision' || ['overdue', 'due_soon'].includes(item.deadline_status)).sort((a, b) => (a.revision_due_date || a.due_date || '9999').localeCompare(b.revision_due_date || b.due_date || '9999'));
  const filtered = items.filter((item) => (filter === 'all' || item.status === filter) && (mode !== 'submissions' || item.submission) && `${item.title} ${item.period_start} ${item.period_end} ${item.academic_year_name}`.toLowerCase().includes(query.toLowerCase()));
  const list = (rows) => role === 'cho' ? <div className="cho-request-list">{rows.map((item) => <Link key={item.id} to={`${base}/${item.id}`} className="cho-request-row">
    <span className="cho-request-icon" aria-hidden="true"><AppIcon name={item.status === 'needs_revision' ? 'bell' : 'reports'} className="h-5 w-5" /></span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="break-words text-sm text-slate-900">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{dateLabel(item.period_start)} / {dateLabel(item.period_end)}</p></div><Badge item={item} /></div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span className="text-slate-500">{['awaiting_submission', 'needs_revision'].includes(item.status) ? `Due ${dateLabel(item.revision_due_date || item.due_date)}` : item.status === 'completed' ? 'Validated by City Planning' : item.status === 'cancelled' ? 'Request closed' : 'With City Planning'}</span><span className="font-semibold text-brand-navy">View details <span aria-hidden="true">&rarr;</span></span></div>
    </div></Link>)}</div> : <div className="divide-y divide-brand-border">{rows.map((item) => <Link key={item.id} to={`${base}/${item.id}`} className="block p-4 transition hover:bg-brand-soft sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">Request #{item.id} · {dateLabel(item.period_start)} – {dateLabel(item.period_end)}</p><h3 className="mt-1 font-semibold text-brand-navy">{item.title}</h3><p className="mt-2 text-sm text-slate-600">{item.status === 'under_review' ? 'Next: City Planning checks the submitted file.' : item.status === 'completed' ? 'Validated data sent to CSWDO.' : item.status === 'cancelled' ? 'This request is closed.' : `Submit by ${dateLabel(item.revision_due_date || item.due_date)}`}</p></div><Badge item={item} /></div></Link>)}</div>;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className={role === 'cho' ? 'cho-page-heading' : 'flex flex-wrap items-start justify-between gap-4 rounded-xl border border-brand-border bg-white p-5 sm:p-6'}><div><p className="lgu-kicker">Population data</p><h1 className="mt-2 text-2xl font-semibold text-brand-navy">{requestId ? 'Request details' : mode === 'dashboard' ? 'CHO overview' : mode === 'submissions' ? 'My submissions' : 'Data requests'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{cswdo ? 'Request the data you need and follow its progress through City Planning review.' : role === 'planning' ? 'Review submissions, explain corrections, and send validated data to CSWDO.' : requestId ? 'Review the request and send your response.' : mode === 'dashboard' ? 'Your population data tasks, at a glance.' : mode === 'submissions' ? 'Track files and review feedback.' : 'Choose a request to upload your data.'}</p></div>
      {requestId ? <Link to={base} className="lgu-button-secondary">All requests</Link> : cswdo ? <button onClick={() => setCreating(!creating)} className="lgu-button-primary"><AppIcon name="registration" className="mr-2 h-4 w-4" />New data request</button> : mode === 'dashboard' ? <Link to={base} className="lgu-button-primary">View data requests</Link> : null}
    </header>
    {message && <p role="status" className="lgu-alert-success">{message}</p>}
    {error && <div role="alert" className="lgu-alert-error">{error} <button onClick={load} className="ml-2 font-semibold underline">Try again</button></div>}
    {creating && <RequestForm onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await saved(id ? 'Request sent. CHO has been notified.' : 'Recurring schedule created.'); if (id) navigate(`${base}/${id}`); }} />}
    {loading ? <p role="status" className="lgu-card text-sm text-slate-600">Loading population requests…</p> : requestId ? selected ? <>
      <section className="lgu-card p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-slate-500">Request #{selected.id} · Requested {dateLabel(selected.created_at)}</p><h2 className="mt-1 text-xl font-semibold text-brand-navy">{selected.title}</h2></div><Badge item={selected} /></div>
        <dl className="my-5 grid gap-4 rounded-xl bg-brand-soft p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{[['Reporting period', `${dateLabel(selected.period_start)} – ${dateLabel(selected.period_end)}`], ['Submission deadline', dateLabel(selected.due_date)], ['Requested from', 'City Health Office (CHO)'], ['Planning year', selected.academic_year_name]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-brand-navy">{value}</dd></div>)}</dl>
        <div className="grid gap-4 text-sm sm:grid-cols-2"><div><h3 className="font-semibold text-brand-navy">Purpose</h3><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{selected.purpose}</p>{selected.correction_of && <p className="mt-2 text-blue-700">Correction of request #{selected.correction_of}</p>}{selected.overlap_reason && <p className="mt-2 text-slate-600">{selected.overlap_reason}</p>}<h3 className="mt-3 font-semibold text-brand-navy">Coverage</h3><p className="mt-1 text-slate-600">{selected.coverage}</p></div><div><h3 className="font-semibold text-brand-navy">Instructions</h3><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{selected.instructions || 'Use the population template. Include child name, birth date, sex, barangay, and guardian name.'}</p></div></div>
        {selected.status === 'needs_revision' && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4"><h3 className="font-semibold text-rose-900">Corrections requested by City Planning</h3><p className="mt-2 text-sm font-medium text-rose-900">{selected.submission?.revision_reason}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-rose-800">{selected.submission?.revision_remarks}</p><p className="mt-3 text-sm font-semibold text-rose-900">Send corrections by {dateLabel(selected.revision_due_date || selected.due_date)}</p></div>}
        {selected.status === 'cancelled' && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Cancellation reason: {selected.cancellation_reason}</p>}
        {selected.submission?.data_file && <div className="mt-5 flex flex-wrap gap-3"><a href={selected.submission.data_file} target="_blank" rel="noopener noreferrer" className="lgu-button-secondary">View latest submitted file</a>{cswdo && selected.status === 'completed' && <Link to={`/${role}/population-data`} className="lgu-button-secondary">Open population records</Link>}</div>}
      </section>
      {role === 'cho' && ['awaiting_submission', 'needs_revision'].includes(selected.status) && <UploadResponse key={`${selected.id}-${selected.status}`} item={selected} onSaved={saved} />}
      {role === 'planning' && selected.status === 'under_review' && selected.submission && <ReviewActions item={selected} onSaved={saved} />}
      <details className="lgu-card p-5"><summary className="cursor-pointer text-sm font-semibold text-brand-navy">Request history</summary><ol className="mt-4 space-y-4 border-l border-brand-border pl-4"><li><p className="text-sm font-medium text-slate-800">Requested by {selected.created_by_name}</p><p className="text-xs text-slate-500">{dateLabel(selected.created_at)}</p></li>{[...(selected.submission?.history || [])].reverse().map((entry) => <li key={entry.id}><p className="text-sm font-medium text-slate-800">{entry.message}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(entry.created_at)} · {entry.acted_by_name || entry.acted_by_role || 'System'}</p>{entry.remarks && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{entry.remarks}</p>}{entry.file_snapshot && <a href={entry.file_snapshot} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand-navy underline">View file at this step</a>}</li>)}{selected.status === 'cancelled' && <li className="text-sm text-slate-600">Cancelled {dateLabel(selected.updated_at)}. {selected.cancellation_reason}</li>}</ol></details>
      {cswdo && ['awaiting_submission', 'needs_revision'].includes(selected.status) && <details className="lgu-card p-5"><summary className="cursor-pointer text-sm font-medium text-slate-600">Cancel this request</summary><form className="mt-3 space-y-3" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { await api.post(`/population-requests/${selected.id}/cancel/`, { reason: cancelReason }); await saved('Request cancelled. CHO has been notified.'); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}><Field label="Reason for cancellation"><textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={inputClass} /></Field><button disabled={busy} className="lgu-button-danger">Cancel request</button></form></details>}
    </> : <p className="lgu-card">This request could not be found or is unavailable.</p> : <>
      {role === 'cho' && mode === 'dashboard' && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          ['Awaiting submission', 'awaiting_submission', 'upload'], ['Needs correction', 'needs_revision', 'bell'], ['Under review', 'under_review', 'reports'], ['Completed', 'completed', 'shield'],
        ].map(([label, status, icon]) => <button key={status} type="button" className="cho-stat" aria-pressed={filter === status} onClick={() => { setFilter(filter === status ? 'all' : status); document.getElementById('cho-request-results')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }}><div className="flex w-full items-center justify-between gap-2"><span className="text-xs font-medium text-slate-600">{label}</span><AppIcon name={icon} className="h-4 w-4 text-brand-navy" /></div><span className="cho-stat-value">{items.filter((item) => item.status === status).length}</span><span className="text-xs text-brand-navy">View requests &rarr;</span></button>)}</div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="overflow-hidden rounded-xl border border-brand-border bg-white"><div className="flex items-center justify-between border-b border-brand-border p-5"><h2 className="font-semibold text-brand-navy">Needs your attention</h2><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{attention.length}</span></div>{attention.length ? list(attention.slice(0, 4)) : <div className="p-6"><p className="font-medium text-slate-800">You're up to date</p><p className="mt-1 text-sm text-slate-500">No corrections or urgent deadlines.</p></div>}{attention.length > 4 && <Link to={base} className="block border-t p-4 text-sm font-semibold text-brand-navy">View all requests &rarr;</Link>}</section>
          <section className="lgu-card p-5"><h2 className="text-sm font-semibold text-brand-navy">Quick access</h2><div className="mt-3 divide-y divide-slate-100">{[['Data requests', 'reports', base], ['My submissions', 'upload', '/cho/submissions'], ['Notifications', 'bell', '/cho/notifications']].map(([label, icon, href]) => <Link key={href} to={href} className="flex items-center gap-3 py-4 text-sm font-medium text-slate-700 hover:text-brand-navy"><AppIcon name={icon} className="h-4 w-4 text-brand-navy" />{label}<span className="ml-auto" aria-hidden="true">&rarr;</span></Link>)}</div><p className="mt-3 border-t pt-4 text-xs leading-5 text-slate-500">CHO uploads &rarr; City Planning validates &rarr; CSWDO receives</p></section>
        </div>
      </>}

      <section id="cho-request-results" className="scroll-mt-28 overflow-hidden rounded-xl border border-brand-border bg-white">{role === 'cho' && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-5 py-4"><h2 className="font-semibold text-brand-navy">{mode === 'dashboard' ? 'Recent requests' : mode === 'submissions' ? 'Submitted files' : 'All requests'}</h2><span className="text-xs text-slate-500">{filtered.length} results</span></div>}<div className="flex flex-wrap items-end gap-3 border-b border-brand-border p-4"><div className="min-w-48 flex-1"><Field label="Find a request"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or reporting year" className={inputClass} /></Field></div><Field label="Progress"><select value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}><option value="all">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><button onClick={load} className="lgu-button-secondary">Refresh</button></div>
        {filtered.length ? list(mode === 'dashboard' ? filtered.slice(0, 5) : filtered) : <div className="p-8 text-center"><p className="font-medium text-brand-navy">{items.length ? 'No matching requests' : 'No data requests yet'}</p><p className="mt-2 text-sm text-slate-500">{cswdo ? 'Create a request when updated population data is needed.' : 'Population data requests appear here with instructions and a deadline.'}</p></div>}
      </section>
      {mode === 'dashboard' && filtered.length > 5 && <Link to={`${base}${filter !== 'all' ? `?status=${filter}` : ''}`} className="lgu-button-secondary">View all {filtered.length} requests</Link>}
      {mode === 'submissions' && legacy.length > 0 && <section className="lgu-card p-5"><h2 className="font-semibold text-brand-navy">Earlier submissions</h2><p className="mt-1 text-sm text-slate-600">{legacy.length} earlier files available.</p><Link to="/cho/submissions/earlier" className="lgu-button-secondary mt-4">View earlier submissions</Link></section>}
      {cswdo && <details className="lgu-card p-5"><summary className="cursor-pointer font-semibold text-brand-navy">Recurring schedules ({schedules.length})</summary><p className="mt-2 text-sm text-slate-500">Each schedule creates one request per reporting period. Pausing leaves existing requests unchanged.</p><div className="mt-4 space-y-3">{schedules.map((schedule) => <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-border p-4"><div><p className="font-medium text-brand-navy">{schedule.title}</p><p className="mt-1 text-xs text-slate-500">{schedule.frequency} · {schedule.assigned_to_name} · {schedule.is_active ? `Next period: ${dateLabel(schedule.next_period_start)}` : 'Paused'}</p></div><button disabled={busy} className="lgu-button-secondary" onClick={async () => { setBusy(true); try { await api.post(`/population-request-schedules/${schedule.id}/toggle/`); await saved(schedule.is_active ? 'Schedule paused.' : 'Schedule resumed.'); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}>{schedule.is_active ? 'Pause' : 'Resume'}</button></div>)}{!schedules.length && <p className="text-sm text-slate-500">Choose “Recurring schedule” when creating a new request.</p>}</div></details>}
    </>}
  </div>;
}
