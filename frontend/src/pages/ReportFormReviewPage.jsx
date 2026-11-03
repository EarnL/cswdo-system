import CenterReportSummary from '../components/CenterReportSummary';
import { reportDisplayName } from '../utils/reportLabels';
import useReportChanges from '../hooks/useReportChanges';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { quarterlyReportDefinitions } from '../data/quarterlyReportDefinitions';

const statusMeta = {
  submitted: { label: 'Under Review', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  under_review: { label: 'Under Review', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  needs_revision: { label: 'Revise / Return', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified_by_staff: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  forwarded_to_admin: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const fullDate = (value) => {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const valueText = (value) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ') || 'Not provided';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const timelineItems = (report) => [
  {
    label: 'Submitted',
    person: report.submitted_by_name || 'CDW',
    date: report.submitted_on,
    done: true,
  },
  {
    label: 'Staff Decision',
    person: report.staff_reviewed_by_name || 'Pending',
    date: report.staff_reviewed_on,
    done: Boolean(report.staff_reviewed_on),
  },
];

const isGeneratedSummaryReport = (report) => (
  report?.report_type === 'cdc_annual_report' && report?.payload?.generated_summary_report === true
);

const reportPeriodLabel = (report) => {
  if (report?.period_type === 'annual') return `Annual ${report.year || ''}`.trim();
  if (report?.period_type === 'monthly' && report.month) return `M${report.month} ${report.year || ''}`.trim();
  return `Q${report?.quarter || '-'} ${report?.year || ''}`.trim();
};

function ReportFormReviewPage() {
  const { cdcId, reportId } = useParams();
  const currentRole = localStorage.getItem('role') || '';
  const baseReportsPath = `/${['staff', 'cdw'].includes(currentRole) ? currentRole : 'admin'}/reports`;
  const isStaff = currentRole === 'staff';
  const [report, setReport] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { acceptNextChange } = useReportChanges({ remarks });

  const loadReport = async () => {
    const response = await api.get(`/reports/${reportId}/`);
    setReport(response.data || null);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/reports/${reportId}/`);
        if (!isMounted) return;
        setReport(response.data || null);
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setError('Failed to load submitted form.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  const definition = report ? quarterlyReportDefinitions[report.report_type] : null;
  const fields = useMemo(() => report?.payload?.fields || {}, [report]);
  const metadata = report?.payload?.report_meta || {};
  const generatedSummary = isGeneratedSummaryReport(report);
  const status = generatedSummary
    ? { label: 'Generated Summary', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : statusMeta[report?.status] || { label: report?.status_label || 'Submitted', tone: 'bg-slate-50 text-slate-700 border-slate-200' };

  const runAction = async (actionName) => {
    if (['needs-revision', 'reject'].includes(actionName) && !remarks.trim()) {
      setError('Please add a short comment before returning or rejecting this form.');
      return;
    }

    setActionLoading(actionName);
    setError('');
    setNotice('');

    try {
      await api.post(`/reports/${report.id}/${actionName}/`, { remarks: remarks.trim() });
      acceptNextChange();
      setRemarks('');
      setNotice(actionName === 'needs-revision'
        ? 'Returned to the CDW with your comment.'
        : actionName === 'reject'
          ? 'Report rejected and the CDW was notified.'
          : 'Report approved and the CDW was notified.');
      await loadReport();
    } catch (err) {
      const apiError = err.response?.data?.error || err.response?.data?.detail;
      setError(apiError || 'Failed to update this form.');
    } finally {
      setActionLoading('');
    }
  };

  const actionButton = (label, actionName, className) => (
    <button
      type="button"
      onClick={() => runAction(actionName)}
      disabled={actionLoading === actionName}
      className={`rounded-xl px-4 py-2 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {actionLoading === actionName ? 'Saving...' : label}
    </button>
  );

  if (loading) {
    return <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading submitted form...</section>;
  }

  if (!report) {
    return <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error || 'Submitted form not found.'}</section>;
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-20 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            to={baseReportsPath}
            className="inline-flex w-fit items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-700"
          >
            Back to Monitoring Reports
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {cdcId && <Link to={`${baseReportsPath}/cdc/${cdcId}`} className="text-sm font-semibold text-[#0f4b94]">CDC Report History</Link>}
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${status.tone}`}>{status.label}</span>
            {report.attachment_url ? <a href={report.attachment_url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Open HTML</a> : null}
            {report.pdf_attachment_url ? <a href={report.pdf_attachment_url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Download PDF</a> : null}
          </div>
        </div>
      </div>

      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</section> : null}
      {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</section> : null}

      <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)]">
        <div className="border-b border-slate-200 bg-white p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img src="/cswdo_logo.png" alt="CSWDO Lucena City logo" className="h-16 w-16 object-contain" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0f4b94]">City Social Welfare and Development Office</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950">{reportDisplayName(definition?.heading || report.title || report.report_type_label)}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">Lucena City Official Report Record</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Control No.</p>
              <p className="mt-1 text-sm font-black text-slate-950">RPT-{report.year || '0000'}-{report.period_type === 'annual' ? 'ANN' : `Q${report.quarter || '0'}`}-{String(report.id || 0).padStart(4, '0')}</p>
            </div>
          </div>
          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {generatedSummary ? 'Generated CDC annual summary for CSWDO review file. This report is viewable and downloadable, and does not require approve, reject, or revision processing.' : definition?.description || report.summary || 'Official submitted report for CSWDO review and records management.'}
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Center Name', metadata.center_name || report.cdc_name],
            ['Barangay', metadata.barangay_name || report.barangay_name],
            ['CDW Name', metadata.cdw_name || report.submitted_by_name],
            ['Reporting Period', metadata.reporting_period || reportPeriodLabel(report)],
            ['Submitted On', fullDate(report.submitted_on)],
            ['Generated File', 'Automatically prepared for CSWDO records'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
        </div>

        {generatedSummary && report.attachment_url ? (
          <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Generated Report Viewer</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Readable copy generated from current CDC records.</p>
              </div>
              {report.pdf_attachment_url ? (
                <a href={report.pdf_attachment_url} target="_blank" rel="noreferrer" className="lgu-button-primary px-3 py-2 text-xs">Download PDF</a>
              ) : null}
            </div>
            <iframe
              title="Generated CDC annual report"
              src={report.attachment_url}
              className="mt-4 h-[720px] w-full rounded-xl border border-slate-200 bg-white"
            />
          </div>
        ) : null}

        <div className="mx-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-blue-700">Submission Summary</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.summary || 'No additional summary was provided.'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Attached Files</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.pdf_attachment_url ? (
                <a href={report.pdf_attachment_url} target="_blank" rel="noreferrer" className="lgu-button-primary px-3 py-2 text-xs">Open PDF</a>
              ) : null}
              {report.attachment_url ? (
                <a href={report.attachment_url} target="_blank" rel="noreferrer" className="lgu-button-secondary px-3 py-2 text-xs">Open HTML</a>
              ) : null}
              {!report.pdf_attachment_url && !report.attachment_url ? (
                <p className="text-sm font-semibold text-slate-500">No attached file was generated.</p>
              ) : null}
            </div>
          </div>
        </div>

        {!generatedSummary ? <div className="mx-6 mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Review Timeline</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {timelineItems(report).map((item) => (
              <div key={item.label} className={`rounded-xl border p-3 ${item.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{item.label}</p>
                </div>
                <p className="mt-2 text-sm font-black text-slate-900">{item.person}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{fullDate(item.date)}</p>
              </div>
            ))}
          </div>
        </div> : (
          <div className="mx-6 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Review Process</p>
        <p className="mt-2 text-sm font-semibold text-emerald-900">This generated report is view-only.</p>
          </div>
        )}

        <div className="space-y-8 p-6">
          {report.payload?.template_sections && !generatedSummary && <CenterReportSummary payload={report.payload} title={report.title} />}
          {!definition && !generatedSummary && !report.payload?.template_sections && Object.entries(report.payload || {}).map(([key, value]) => <section key={key} className="rounded-xl border border-slate-200 p-4"><h2 className="text-lg font-semibold text-[#0f4b94]">{key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}</h2><ReportValue value={value} /></section>)}
          {(definition?.sections || []).map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black text-[#0f4b94]">{section.title}</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                {section.fields.map((field) => (
                  <div key={field.key} className="grid border-b border-slate-200 last:border-b-0 md:grid-cols-[0.35fr_0.65fr]">
                    <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{field.label}</div>
                    <div className="whitespace-pre-wrap px-4 py-3 text-sm font-semibold leading-6 text-slate-900">{valueText(fields[field.key])}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {!generatedSummary && currentRole === 'cdw' && report.review_remarks && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Staff Remarks</h2><p className="mt-2 whitespace-pre-wrap text-sm">{report.review_remarks}</p></section>}
      {!generatedSummary && isStaff ? (
        <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Review Decision</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {actionButton('Approve', 'approve', 'bg-emerald-600 hover:bg-emerald-700')}
            {actionButton('Revise / Return', 'needs-revision', 'bg-amber-600 hover:bg-amber-700')}
            {actionButton('Reject', 'reject', 'bg-rose-600 hover:bg-rose-700')}
          </div>
          <textarea
            aria-label="Review comments"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows="3"
            placeholder="Comment for revise/return or reject. This will be shown to the CDW."
            className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
          />
          {report.review_remarks ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="text-[11px] font-black uppercase tracking-wide">Latest Remarks</p>
              <p className="mt-1 whitespace-pre-wrap">{report.review_remarks}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {!generatedSummary && currentRole === 'admin' ? (
        <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
          Admin view only. Monitoring report decisions are handled by Staff.
        </section>
      ) : null}
    </div>
  );
}

export default ReportFormReviewPage;

function ReportValue({ value }) {
  if (Array.isArray(value)) return <div className="space-y-3">{value.length ? value.map((item, index) => <div key={index} className="mt-3 border-l-2 border-slate-200 pl-3"><ReportValue value={item} /></div>) : 'Not provided'}</div>;
  if (value && typeof value === 'object') return <dl className="mt-3 divide-y divide-slate-100">{Object.entries(value).map(([key, item]) => <div key={key} className="grid gap-2 py-3 sm:grid-cols-[minmax(120px,1fr)_2fr]"><dt className="text-sm text-slate-500">{key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd className="min-w-0 break-words text-sm"><ReportValue value={item} /></dd></div>)}</dl>;
  if (typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return <img src={value} alt="Report evidence" className="mt-3 max-h-72 max-w-full rounded-lg object-contain" />;
  return <p className="whitespace-pre-wrap break-words text-sm leading-6">{valueText(value)}</p>;
}
