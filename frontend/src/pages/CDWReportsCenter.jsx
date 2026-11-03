import { reportDisplayName } from '../utils/reportLabels';
import AppIcon from '../components/AppIcon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import RoleLayout from '../components/RoleLayout';
import api from '../api';
import { quarterlyReportCards } from '../data/quarterlyReportDefinitions';

const reportFormMeta = {
  eccd_checklist: { category: 'Child Development', period: 'Quarterly' },
  child_profile: { category: 'Enrollment', period: 'Quarterly' },
  health_nutrition: { category: 'Health', period: 'Quarterly' },
  activities: { category: 'Programs', period: 'Quarterly' },
  parent_community: { category: 'Programs', period: 'Quarterly' },
  cdw_accomplishment: { category: 'Child Development', period: 'Quarterly' },
  facility_status: { category: 'Facility', period: 'Quarterly' },
};

const categoryFilters = ['All', 'Enrollment', 'Child Development', 'Health', 'Programs', 'Facility'];

const statusTone = {
  submitted: 'border-sky-200 bg-sky-50 text-sky-700',
  under_review: 'border-sky-200 bg-sky-50 text-sky-700',
  needs_revision: 'border-amber-200 bg-amber-50 text-amber-700',
  verified_by_staff: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  forwarded_to_admin: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatDate(value, fallback = 'Not recorded') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatPeriod(report) {
  if (!report) return 'Not recorded';
  if (report.reporting_period) return report.reporting_period;
  if (report.quarter && report.year) return `Q${report.quarter} ${report.year}`;
  return report.year || 'Not recorded';
}

function reportTimestamp(report) {
  return new Date(report?.submitted_on || report?.submitted_at || report?.created_at || 0).getTime();
}

function displayStatus(report) {
  if (!report) return 'Not submitted';
  if (['submitted', 'under_review'].includes(report.status)) return 'Under Review';
  if (report.status === 'needs_revision') return 'Returned for Revision';
  if (['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status)) return 'Approved';
  if (report.status === 'rejected') return 'Rejected';
  return report.status_label || report.submission_status || 'Submitted';
}

function statusClass(report) {
  return statusTone[report?.status] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function getReportRoute(report) {
  return report?.id ? `/cdw/reports/submissions/${report.id}` : '';
}

function SummaryCard({ label, value, hint, tone = 'blue' }) {
  const tones = { blue: 'border-blue-200 bg-blue-50 text-blue-700', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700', amber: 'border-amber-200 bg-amber-50 text-amber-700', rose: 'border-rose-200 bg-rose-50 text-rose-700', violet: 'border-violet-200 bg-violet-50 text-violet-700' };
  return <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}><p className="text-xs font-black uppercase tracking-wide">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p>{hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}</div>;
}

function StatusBadge({ report }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(report)}`}>
      {displayStatus(report)}
    </span>
  );
}

function CDWReportsCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeTab, setActiveTab] = useState('forms');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeReportId, setActiveReportId] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);

  const isFocusedReport = useCallback((report) => {
    if (notificationFocus === 'cdw_reports_need_revision') return report.status === 'needs_revision';
    if (notificationFocus === 'cdw_reports_under_review') return ['submitted', 'under_review'].includes(report.status);
    if (notificationFocus === 'cdw_reports_approved') return ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status);
    if (notificationFocus === 'cdw_reports_rejected') return report.status === 'rejected';
    return false;
  }, [notificationFocus]);

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      setLoading(true);
      setError('');
      try {
        const [reportRes, reminderRes] = await Promise.all([
          api.get('/reports/', { params: { include_history: 'true' } }),
          api.get('/reminders/'),
        ]);
        if (!mounted) return;
        const nextReports = Array.isArray(reportRes.data) ? reportRes.data : [];
        setReports(nextReports);
        setReminders(reminderRes.data?.reminders || []);
        setActiveReportId((current) => current || nextReports[0]?.id || null);
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load report center:', err);
        setError('Failed to load monitoring reports.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReports();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notificationFocus || !reports.length) return;
    const focused = reports.find(isFocusedReport);
    if (focused) {
      setActiveReportId(focused.id);
      setActiveTab(notificationFocus === 'cdw_report_history' ? 'history' : 'submitted');
    }
  }, [isFocusedReport, notificationFocus, reports]);

  const reportsByType = useMemo(() => {
    return reports.reduce((acc, report) => {
      const key = report.report_type || 'unknown';
      const list = acc[key] || [];
      list.push(report);
      acc[key] = list.sort((a, b) => reportTimestamp(b) - reportTimestamp(a));
      return acc;
    }, {});
  }, [reports]);

  const stats = useMemo(() => {
    const underReview = reports.filter((report) => ['submitted', 'under_review'].includes(report.status)).length;
    const needsRevision = reports.filter((report) => report.status === 'needs_revision').length;
    const approved = reports.filter((report) => ['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status) || report.is_complete).length;
    return {
      available: quarterlyReportCards.length + 4,
      submitted: reports.length,
      underReview,
      needsRevision,
      approved,
    };
  }, [reports]);

  const visibleForms = useMemo(() => {
    if (activeCategory === 'All') return quarterlyReportCards;
    return quarterlyReportCards.filter((card) => (reportFormMeta[card.id]?.category || 'Child Development') === activeCategory);
  }, [activeCategory]);

  const submittedReports = useMemo(() => [...reports].sort((a, b) => reportTimestamp(b) - reportTimestamp(a)), [reports]);
  const selectedReport = submittedReports.find((report) => report.id === activeReportId) || submittedReports[0] || null;

  const filteredHistoryReports = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return submittedReports;
    return submittedReports.filter((report) => [
      report.title,
      report.report_type_label,
      report.cdc_name,
      report.barangay_name,
      formatPeriod(report),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [historySearch, submittedReports]);

  const reportReminder = useMemo(() => {
    const reportItems = reminders.filter((item) => String(item.category || '').toLowerCase().includes('report'));
    return reportItems.find((item) => item.priority === 'high') || reportItems[0] || null;
  }, [reminders]);

  const dueTitle = reportReminder?.title;
  const dueMessage = reportReminder?.message;
  const dueLink = reportReminder?.link || quarterlyReportCards[0]?.route || '/cdw/reports';

  return (
    <RoleLayout role="cdw">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">CDW Workspace</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Monitoring Reports</h1>
          <p className="mt-2 text-sm font-black leading-6 text-slate-500">
            Prepare, submit, and track CDC monitoring reports for CSWDO review.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <SummaryCard label="Available Forms" value={stats.available} hint="Forms and CDC reports" />
          <SummaryCard label="Submitted Reports" value={stats.submitted} hint="Total submitted" tone="emerald" />
          <SummaryCard label="Under Review" value={stats.underReview} hint="With CSWDO" tone="amber" />
          <SummaryCard label="Needs Revision" value={stats.needsRevision} hint="Returned reports" tone="violet" />
          <SummaryCard label="Approved" value={stats.approved} hint="Completed" tone="emerald" />
        </section>
        {reportReminder && <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-lg font-black text-rose-600">!</span><div><p className="text-lg font-black text-rose-700">Due Reports</p><h2 className="mt-1 text-xl font-black text-slate-950">{dueTitle}</h2></div></div><p className="mt-3 text-sm font-black text-slate-600">{dueMessage}</p></div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-rose-700 ring-1 ring-rose-200">Status: {reportReminder.status?.replaceAll('_', ' ') || 'Due'}</span><Link to={dueLink} className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700">Open Required Form</Link></div></div>
        </section>}

        {error ? <div className="rounded-xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-700">{error}</div> : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap border-b border-slate-200 bg-slate-50">
            {[
              ['forms', 'Report Forms'],
              ['submitted', 'Submitted Reports'],
              ['history', 'Report History'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`border-b-2 px-5 py-4 text-sm font-black transition ${
                  activeTab === key
                    ? 'border-[#0f4b94] bg-white text-[#0f4b94]'
                    : 'border-transparent text-slate-600 hover:bg-white hover:text-[#0f4b94]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'forms' ? (
            <div className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Available Report Forms</h2>
                  <p className="mt-1 text-sm font-black text-slate-500">Choose a form to encode and submit to CSWDO.</p>
                </div>
                <Link to="/cdw/reports" className="w-fit rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-black text-[#0f4b94]">Report Submission Guide</Link>
              </div>


              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  { id: 'form6', route: '/cdw/report', heading: 'Child Development Worker Profile', description: 'Personal details, qualifications and work experience.', icon: 'profile', category: 'Worker profile' },
                  { id: 'form7', route: '/cdw/form7', heading: 'Child Development Center Profile', description: 'Center information, facilities and operating details.', icon: 'building', category: 'Center profile' },
                  { id: 'special_needs', route: '/cdw/reports/special-needs-summary', heading: 'Special Needs Assessment Summary Report', description: 'Review saved assessment results by CDC and quarter.', icon: 'reports', category: 'Child development' },
                  { id: 'automated', route: '/cdw/cdc-reports', heading: 'Center Report', description: 'Generate annual, quarterly or monthly reports from stored records.', icon: 'reports', category: 'Automated reports' },
                ].map(card => <ReportEntryCard key={card.id} card={card} latest={reportsByType[card.id]?.[0]} loading={loading} automated={card.id === 'automated'} />)}
              </div>
              <div className="mb-4 mt-8 flex items-center gap-3"><h3 className="text-base font-black text-slate-900">Quarterly Forms</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{visibleForms.length}</span><div className="h-px flex-1 bg-slate-100" /></div>
              <div className="mb-4 flex flex-wrap gap-2">
                {categoryFilters.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                      activeCategory === category
                        ? 'border-[#0f4b94] bg-[#0f4b94] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#0f4b94] hover:text-[#0f4b94]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleForms.map(card => <ReportEntryCard key={card.id} card={{ ...card, category: reportFormMeta[card.id]?.category, icon: reportFormMeta[card.id]?.category === 'Health' ? 'health' : reportFormMeta[card.id]?.category === 'Facility' ? 'building' : 'reports' }} latest={reportsByType[card.id]?.[0]} loading={loading} />)}
              </div>
            </div>
          ) : null}

          {activeTab === 'submitted' ? (
            <div className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Submitted Reports</h2>
                  <p className="mt-1 text-sm font-black text-slate-500">View all reports you have submitted.</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {submittedReports.length} report{submittedReports.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                {loading ? (
                  <div className="p-8 text-center text-sm font-black text-slate-500">Loading submitted reports...</div>
                ) : submittedReports.length === 0 ? (
                  <div className="p-8 text-center text-sm font-black text-slate-500">No reports have been submitted yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th>Report Title</th>
                          <th>Report Type</th>
                          <th>Reporting Period</th>
                          <th>Date Submitted</th>
                          <th>Status</th>
                          <th>Reviewed By</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submittedReports.map((report) => {
                          const viewRoute = getReportRoute(report);
                          return (
                            <tr key={report.id} className={isFocusedReport(report) ? 'notification-focus-ring' : ''}>
                              <td className="font-bold text-slate-900">{reportDisplayName(report.title || report.report_type_label)}</td>
                              <td>{reportDisplayName(report.report_type_label || report.report_type)}</td>
                              <td>{formatPeriod(report)}</td>
                              <td>{formatDate(report.submitted_on)}</td>
                              <td><StatusBadge report={report} /></td>
                              <td>{report.staff_reviewed_by_name || report.admin_reviewed_by_name || 'Not reviewed yet'}</td>
                              <td>
                                <div className="flex flex-wrap gap-2">
                                  {viewRoute ? (
                                    <Link to={viewRoute} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                                      View Report
                                    </Link>
                                  ) : null}
                                  {report.pdf_attachment_url ? (
                                    <a href={report.pdf_attachment_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-black text-[#0f4b94] hover:bg-sky-50">
                                      Download PDF
                                    </a>
                                  ) : null}
                                  {report.status === 'needs_revision' ? (
                                    <Link to={(report.report_type === 'special_needs' ? '/cdw/reports/special-needs-summary' : quarterlyReportCards.find((card) => card.id === report.report_type)?.route) || '/cdw/reports'} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-white">
                                      Revise
                                    </Link>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'history' ? (
            <div className="p-5">
              <h2 className="text-xl font-black text-slate-950">Report History</h2>
              <p className="mt-1 text-sm font-black text-slate-500">Select a report to view full details and history.</p>
              <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div>
                  <input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Search reports..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                  />
                  <div className="mt-3 space-y-2">
                    {filteredHistoryReports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => navigate(getReportRoute(report))}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          selectedReport?.id === report.id
                            ? 'border-[#0f4b94] bg-sky-50'
                            : 'border-slate-200 bg-white hover:border-[#0f4b94]'
                        }`}
                      >
                        <p className="font-black text-slate-950">{reportDisplayName(report.title || report.report_type_label)}</p>
                        <p className="mt-1 text-xs font-black text-slate-500">{formatPeriod(report)} | {formatDate(report.submitted_on, 'No date')}</p>
                        <div className="mt-2"><StatusBadge report={report} /></div>
                      </button>
                    ))}
                    {!filteredHistoryReports.length ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-black text-slate-500">
                        No reports match your search.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  {!selectedReport ? (
                    <div className="p-8 text-center text-sm font-black text-slate-500">Select a submitted report to see details.</div>
                  ) : (
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black text-slate-950">{reportDisplayName(selectedReport.title || selectedReport.report_type_label)}</h3>
                          <p className="mt-1 text-sm font-black text-slate-500">{formatPeriod(selectedReport)}</p>
                        </div>
                        <StatusBadge report={selectedReport} />
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Info label="CDC" value={selectedReport.cdc_name} />
                        <Info label="Barangay" value={selectedReport.barangay_name} />
                        <Info label="Submitted By" value={selectedReport.submitted_by_name} />
                        <Info label="Date Submitted" value={formatDate(selectedReport.submitted_on)} />
                        <Info label="Report Type" value={reportDisplayName(selectedReport.report_type_label)} />
                        <Info label="Reviewed By" value={selectedReport.staff_reviewed_by_name || selectedReport.admin_reviewed_by_name || 'Not reviewed yet'} />
                      </div>

                      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Staff Remarks</p>
                        <p className="mt-2 text-sm font-black leading-6 text-slate-700">{selectedReport.review_remarks || 'No remarks recorded yet.'}</p>
                      </div>

                      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Decision History</p>
                        <div className="mt-3 space-y-3 text-sm font-black text-slate-700">
                          <TimelineItem label="Report submitted" value={formatDate(selectedReport.submitted_on)} />
                          {selectedReport.staff_reviewed_by_name ? <TimelineItem label="Reviewed by CSWDO Staff" value={selectedReport.staff_reviewed_by_name} /> : null}
                          {selectedReport.admin_reviewed_by_name ? <TimelineItem label="Reviewed by Admin" value={selectedReport.admin_reviewed_by_name} /> : null}
                          {!selectedReport.staff_reviewed_by_name && !selectedReport.admin_reviewed_by_name ? <TimelineItem label="Forwarded to CSWDO" value="Waiting for review" /> : null}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        {selectedReport.pdf_attachment_url ? (
                          <a href={selectedReport.pdf_attachment_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-black text-[#0f4b94]">
                            Download PDF
                          </a>
                        ) : null}
                        {getReportRoute(selectedReport) ? (
                          <Link to={getReportRoute(selectedReport)} className="rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-black text-white">
                            View Report
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </RoleLayout>
  );
}

function ReportEntryCard({ card, latest, loading, automated = false }) {
  return <Link to={card.route} className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f4b94]">
    <div className="flex items-center justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${automated ? 'bg-[#0f4b94] text-white' : 'bg-blue-50 text-[#0f4b94]'}`}><AppIcon name={card.icon} className="h-5 w-5" /></span><span className="text-xs font-medium text-slate-500">{card.category}</span></div>
    <h3 className="mt-4 text-lg font-semibold leading-6 text-slate-900 group-hover:text-[#0f4b94]">{card.heading}</h3>
    <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
    <div className="mt-auto">
      {automated ? <div className="mb-4 flex flex-wrap gap-2">{['Annual', 'Quarterly', 'Monthly'].map(period => <span key={period} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{period}</span>)}</div> : <div className="mb-4 space-y-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${latest ? statusClass(latest) : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{loading ? 'Loading...' : latest ? displayStatus(latest) : 'Not yet submitted'}</span><p className="text-xs text-slate-400">{latest ? `Last submitted ${formatDate(latest.submitted_on || latest.created_at)}` : 'No submission yet'}</p></div>}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-[#0f4b94]"><span>{automated ? 'Generate report' : 'Open form'}</span><span aria-hidden="true" className="transition group-hover:translate-x-1">&rarr;</span></div>
    </div>
  </Link>;
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value || 'Not recorded'}</p>
    </div>
  );
}

function TimelineItem({ label, value }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#0f4b94]" />
      <div>
        <p className="text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{value}</p>
      </div>
    </div>
  );
}

export default CDWReportsCenter;
