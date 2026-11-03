import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import ActivityLogPanel from '../components/ActivityLogPanel';
import PerformanceTable from '../components/PerformanceTable';
import { TableSkeleton } from '../components/LoadingState';

const detailMeta = {
  total: { title: 'All Reports', description: 'Complete registry for the selected school year.', filter: () => true },
  pending: { title: 'Under Review Reports', description: 'Reports waiting for Staff decision.', filter: (report) => ['submitted', 'under_review'].includes(report.status) },
  returned: { title: 'Returned Reports', description: 'Reports returned or rejected for correction.', filter: (report) => ['needs_revision', 'rejected'].includes(report.status) },
  complete: { title: 'Complete Reports', description: 'Reports approved by Staff.', filter: (report) => report.is_complete || ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status) },
  late: { title: 'Late Reports', description: 'Reports submitted after the expected due date.', filter: (report) => report.is_on_time === false },
  approved: { title: 'Approved Reports', description: 'Reports approved by Staff.', filter: (report) => ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status) },
  verified: { title: 'Approved Reports', description: 'Reports approved by Staff.', filter: (report) => ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status) },
};

const compactDate = (value) => {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const roleBase = () => (localStorage.getItem('role') === 'staff' ? '/staff/reports' : '/admin/reports');

function StatusPill({ report }) {
  const tones = {
    submitted: 'bg-sky-50 text-sky-700',
    under_review: 'bg-sky-50 text-sky-700',
    needs_revision: 'bg-amber-50 text-amber-700',
    verified_by_staff: 'bg-emerald-50 text-emerald-700',
    forwarded_to_admin: 'bg-emerald-50 text-emerald-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-rose-50 text-rose-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tones[report.status] || 'bg-slate-100 text-slate-700'}`}>
      {report.status_label || report.status || 'Submitted'}
    </span>
  );
}

function ReportDetailsPage() {
  const { section = 'total' } = useParams();
  const [reports, setReports] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const basePath = roleBase();
  const meta = detailMeta[section] || detailMeta.total;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [reportRes, activityRes] = await Promise.all([
          api.get('/reports/'),
          api.get('/activity-logs/', { params: { limit: 20 } }).catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setReports(Array.isArray(reportRes.data) ? reportRes.data : []);
        setActivities(Array.isArray(activityRes.data) ? activityRes.data : []);
      } catch (err) {
        if (mounted) setError('Failed to load report details.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => reports.filter(meta.filter), [meta, reports]);
  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(detailMeta.pending.filter).length,
    returned: reports.filter(detailMeta.returned.filter).length,
    complete: reports.filter(detailMeta.complete.filter).length,
  }), [reports]);

  if (loading) return <TableSkeleton rows={5} columns={4} />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to={basePath} className="text-sm font-black text-[#0f4b94] hover:underline">Back to Monitoring Reports</Link>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Report Details</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{section === 'activity' ? 'Report Activity Log' : section === 'performance' ? 'CDC Performance' : meta.title}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{section === 'activity' ? 'Recent report-related system activity.' : section === 'performance' ? 'Performance review table for CDC monitoring.' : meta.description}</p>
          </div>
          {section !== 'activity' && section !== 'performance' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Total', stats.total],
                ['Pending', stats.pending],
                ['Returned', stats.returned],
                ['Complete', stats.complete],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</section> : null}

      {section === 'activity' ? (
        <ActivityLogPanel title="Report Activity Log" activities={activities} emptyMessage="No report activity has been recorded yet." />
      ) : section === 'performance' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <PerformanceTable />
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!filteredReports.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
              No reports found for this detail view.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[940px] text-sm">
                <thead>
                  <tr>
                    <th>CDC</th>
                    <th>Report</th>
                    <th>Period</th>
                    <th>Submitted By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>File</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => {
                    const cdcId = report.cdc || report.cdc_id;
                    return (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td>
                          <p className="font-black text-slate-900">{report.cdc_name || 'Unassigned CDC'}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{report.barangay_name || 'No barangay'}</p>
                        </td>
                        <td className="font-bold text-slate-700">{report.report_type_label || report.title || report.report_type}</td>
                        <td className="font-bold text-slate-700">{report.period_type === 'annual' ? `Annual ${report.year}` : `Q${report.quarter || '-'} ${report.year || '-'}`}</td>
                        <td className="font-bold text-slate-700">{report.submitted_by_name || 'Unknown'}</td>
                        <td className="font-bold text-slate-700">{compactDate(report.submitted_on)}</td>
                        <td><StatusPill report={report} /></td>
                        <td className="font-bold text-slate-700">{report.pdf_attachment_url || report.attachment_url ? 'Ready' : 'None'}</td>
                        <td>
                          <Link to={`${basePath}/cdc/${cdcId}/forms/${report.id}`} className="rounded-lg bg-[#0f4b94] px-3 py-2 text-xs font-black text-white">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ReportDetailsPage;
