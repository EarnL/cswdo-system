import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ReportCdcField from '../components/ReportCdcField';
import { loadReportCdcs } from '../utils/reportCdcs';
import useReportChanges from '../hooks/useReportChanges';

export default function SpecialNeedsSummaryPage() {
  const [cdcs, setCdcs] = useState([]);
  const [period, setPeriod] = useState({ cdc: '', quarter: String(Math.floor(new Date().getMonth() / 3) + 1), year: String(new Date().getFullYear()) });
  const [preview, setPreview] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const changes = useReportChanges(remarks);
  useEffect(() => {
    let active = true;
    loadReportCdcs().then(({ data }) => {
      if (!active) return;
      setCdcs(data);
      setPeriod(current => ({ ...current, cdc: data.length === 1 ? String(data[0].id) : '' }));
    }).catch(() => { if (active) setError('Unable to load assigned CDCs. Please reload the page.'); });
    return () => { active = false; };
  }, []);
  const updatePeriod = (key, value) => {
    setPeriod(current => ({ ...current, [key]: value }));
    setPreview(null);
    setReport(null);
    setError('');
  };
  const review = async event => {
    event.preventDefault();
    setBusy(true); setError(''); setPreview(null); setReport(null);
    try {
      const { data } = await api.get('/special-needs-assessments/summary-preview/', { params: period });
      setPreview(data);
    } catch (err) { setError(err.response?.data?.error || 'Unable to generate the summary. Please try again.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/special-needs-assessments/submit-summary/', { ...period, remarks, fingerprint: preview.fingerprint, revision_report: preview.revision_report });
      setReport(data.report); changes.markSaved();
    } catch (err) { setError(err.response?.data?.error || 'Unable to submit the report. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link to="/cdw/reports" className="font-semibold text-[#0f4b94]">Back to Monitoring Reports</Link>
    <header><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#0f4b94]">Monitoring Reports</p><h1 className="text-2xl font-bold text-slate-950">Special Needs Assessment Summary Report</h1><p className="mt-2 text-sm text-slate-500">Review saved assessment results before submitting to CSWDO.</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {report && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Report submitted for review. <Link className="font-semibold underline" to={`/cdw/reports/submissions/${report}`}>View submitted report</Link></div>}
    <form onSubmit={review} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <fieldset disabled={busy} className="grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <div><p className="mb-2 text-sm font-medium text-slate-700">Assigned CDC</p><ReportCdcField cdcs={cdcs} value={period.cdc} onChange={event => updatePeriod('cdc', event.target.value)} required /></div>
        <label className="text-sm font-medium text-slate-700">Quarter<select value={period.quarter} onChange={event => updatePeriod('quarter', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3">{[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Year<input type="number" min="1900" max="9999" required value={period.year} onChange={event => updatePeriod('year', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label>
        <button disabled={busy || !period.cdc} className="rounded-xl bg-[#0f4b94] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait...' : 'Generate Preview'}</button>
      </fieldset>
    </form>
    {preview && <>
      {preview.revision_report && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This submission updates returned report #{preview.revision_report}. Staff remarks: {preview.review_remarks || 'Review the assessment summary.'}</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{preview.cdc_name} / Q{preview.quarter} {preview.year}</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">{preview.selection_rule}</p></div><span className="rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0f4b94]">{preview.children.length} children included</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(preview.counts).map(([key, count]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-semibold text-slate-900">{count}</p><p className="mt-1 text-xs text-slate-600">{{ no_concern: 'Average development', needs_monitoring: 'Re-test after 3 to 6 months', for_referral: 'Suggests advanced development', needs_further_assessment: 'For further review' }[key]}</p></div>)}</div>
        <h3 className="mb-3 mt-6 font-semibold">Included assessments</h3>
        <AssessmentRows rows={preview.children} />
        {!preview.children.length && <p className="py-5 text-sm text-slate-500">No complete, submitted assessments in this period. Complete and submit an assessment before generating this report.</p>}
        {!!preview.excluded.length && <details className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4" open={preview.incomplete_count > 0}><summary className="cursor-pointer text-sm font-semibold text-amber-900">Not included: {preview.excluded.length} assessments / {preview.incomplete_count} incomplete</summary><div className="mt-4"><AssessmentRows rows={preview.excluded} excluded /></div></details>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="text-sm font-medium text-slate-700">Remarks (optional)<textarea disabled={busy || !!report} rows="3" value={remarks} onChange={event => setRemarks(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label><div className="mt-4 flex justify-end"><button onClick={submit} disabled={busy || !!report || !preview.children.length} className="rounded-xl bg-[#0f4b94] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Submitting...' : 'Submit Report'}</button></div></section>
    </>}
  </div>;
}

function AssessmentRows({ rows, excluded = false }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Child', 'Date / stage', excluded ? 'Reason / progress' : 'Result', ''].map((label, index) => <th key={index} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.assessment_id} className="border-t border-slate-100"><td className="px-3 py-4 font-medium">{row.name}<p className="text-xs font-normal text-slate-500">Assessment #{row.assessment_id}</p></td><td className="px-3 py-4">{row.assessment_date}<p className="text-xs text-slate-500">{row.assessment_type}</p></td><td className="px-3 py-4">{excluded ? row.reason : row.result}{excluded && <p className="text-xs text-slate-500">{row.answered}/{row.total} answered</p>}</td><td className="px-3 py-4"><Link to={`/cdw/special-needs/${row.assessment_id}`} className="whitespace-nowrap font-semibold text-[#0f4b94]">View Assessment</Link></td></tr>)}</tbody></table></div>;
}
