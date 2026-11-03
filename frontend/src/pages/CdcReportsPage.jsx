import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { loadReportList } from '../utils/loadReportList';
import { TableSkeleton } from '../components/LoadingState';

const statusTone = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-sky-50 text-sky-700',
  needs_revision: 'bg-amber-50 text-amber-700',
  verified_by_staff: 'bg-emerald-50 text-emerald-700',
  forwarded_to_admin: 'bg-indigo-50 text-indigo-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-rose-50 text-rose-700',
};

const compactDate = (value) => {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getRoleBase = () => {
  const role = localStorage.getItem('role') || 'admin';
  return role === 'staff' ? '/staff' : '/admin';
};

const getPeriodLabel = (report) => {
  if (report.period_type === 'monthly' && report.month) return `M${report.month} ${report.year}`;
  if (report.period_type === 'annual') return `Annual ${report.year}`;
  return `Q${report.quarter || '-'} ${report.year || '-'}`;
};

const isGeneratedSummaryReport = (report) => (
  report?.report_type === 'cdc_annual_report' && report?.payload?.generated_summary_report === true
);

function Counter({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function CdcReportsPage() {
  const { cdcId } = useParams();
  const [cdc, setCdc] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  const [search, setSearch] = useState('');
  const basePath = getRoleBase();

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [cdcRes, reportRes] = await Promise.all([
          api.get(`/cdcs/${cdcId}/`),
          loadReportList('/reports/', { cdc: cdcId, include_history: 'true' }),
        ]);
        if (!mounted) return;
        setCdc(cdcRes.data || null);
        setReports(reportRes.filter(report => String(report.cdc) === String(cdcId)).sort((a, b) => new Date(b.submitted_on || 0) - new Date(a.submitted_on || 0)));
      } catch (err) {
        if (mounted) setError(err.response?.data?.detail || 'Failed to load CDC reports.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [cdcId]);

  const stats = useMemo(() => reports.reduce((acc, report) => {
    const generatedSummary = isGeneratedSummaryReport(report);
    acc.total += 1;
    acc.pending += !generatedSummary && ['submitted', 'under_review', 'needs_revision'].includes(report.status) ? 1 : 0;
    acc.approved += generatedSummary || ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status) ? 1 : 0;
    acc.returned += ['needs_revision', 'rejected'].includes(report.status) ? 1 : 0;
    return acc;
  }, { total: 0, pending: 0, approved: 0, returned: 0 }), [reports]);

  const visibleReports = reports.filter(report => `${report.title || ''} ${report.report_type_label || ''} ${getPeriodLabel(report)}`.toLowerCase().includes(search.toLowerCase()));
  const events = reports.flatMap(report => [
    { date: report.submitted_on, label: 'Report recorded', actor: report.submitted_by_name, report },
    ...(report.staff_reviewed_on ? [{ date: report.staff_reviewed_on, label: 'Staff review recorded', actor: report.staff_reviewed_by_name, report }] : []),
    ...(report.admin_reviewed_on ? [{ date: report.admin_reviewed_on, label: 'Admin review recorded', actor: report.admin_reviewed_by_name, report }] : []),
  ]).filter(event => event.date && visibleReports.includes(event.report)).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (loading) return <TableSkeleton rows={5} columns={4} />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to={`${basePath}/reports`} className="text-sm font-black text-[#0f4b94] hover:underline">Back to Monitoring Reports</Link>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">CDC Report File</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{cdc?.name || 'CDC Reports'}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{cdc?.barangay_name || 'No barangay'} | {reports.length} report file(s)</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Counter label="Total" value={stats.total} />
              <Counter label="Pending" value={stats.pending} />
              <Counter label="Complete" value={stats.approved} />
              <Counter label="Returned" value={stats.returned} />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</section>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{[['reports', 'Submitted Reports'], ['history', 'Report History']].map(([key, label]) => <button key={key} type="button" aria-pressed={activeTab === key} onClick={() => setActiveTab(key)} className={`rounded-lg px-4 py-3 text-sm font-black ${activeTab === key ? 'bg-[#0f4b94] text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div><label><span className="sr-only">Search reports</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search report or period" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label></div>
        {activeTab === 'history' ? <div className="divide-y divide-slate-100">{events.map((event, index) => <div key={`${event.report.id}-${index}`} className="flex flex-wrap items-start justify-between gap-4 py-5"><div><p className="text-xs font-bold text-slate-500">{compactDate(event.date)} / {event.label}</p><Link to={`${basePath}/reports/cdc/${cdcId}/forms/${event.report.id}`} className="mt-2 inline-block font-black text-[#0f4b94]">{event.report.title || event.report.report_type_label}</Link><p className="mt-1 text-sm text-slate-500">{event.actor || 'Not recorded'} / {getPeriodLabel(event.report)}</p></div></div>)}{!events.length && <p className="p-6 text-sm text-slate-500">No report history found.</p>}</div> : !visibleReports.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No report files are linked to this CDC yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Period</th>
                                    <th>Date</th>
                  <th>Status</th>
                  <th>Files</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td>
                      <p className="font-black text-slate-900">{report.report_type_label || report.title}</p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{report.submitted_by_name || 'Not recorded'}</p>
                    </td>
                    <td className="font-bold text-slate-700">{getPeriodLabel(report)}</td>
                    
                    <td className="font-bold text-slate-700">{compactDate(report.submitted_on)}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isGeneratedSummaryReport(report) ? 'bg-emerald-50 text-emerald-700' : statusTone[report.status] || statusTone.submitted}`}>
                        {isGeneratedSummaryReport(report) ? 'Generated Summary' : report.status_label || report.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {report.attachment_url ? <a href={report.attachment_url} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">HTML</a> : null}
                        {report.pdf_attachment_url ? <a href={report.pdf_attachment_url} className="rounded-full bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">PDF</a> : null}
                        {!report.attachment_url && !report.pdf_attachment_url ? <span className="text-xs text-slate-400">No file</span> : null}
                      </div>
                    </td>
                    <td>
                      <Link to={`${basePath}/reports/cdc/${cdcId}/forms/${report.id}`} className="rounded-lg bg-[#0f4b94] px-3 py-2 text-xs font-black text-white">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default CdcReportsPage;
