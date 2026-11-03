import { reportDisplayName } from '../utils/reportLabels';
import { Link } from 'react-router-dom';
import React from 'react';

function isGeneratedSummaryReport(report) {
  return report?.report_type === 'cdc_annual_report' && report?.payload?.generated_summary_report === true;
}

function badgeClasses(report) {
  if (isGeneratedSummaryReport(report)) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  const workflowTones = {
    submitted: 'bg-sky-50 text-sky-700 border border-sky-200',
    under_review: 'bg-sky-50 text-sky-700 border border-sky-200',
    needs_revision: 'bg-amber-50 text-amber-700 border border-amber-200',
    verified_by_staff: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    forwarded_to_admin: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  };

  if (report.status && workflowTones[report.status]) {
    return workflowTones[report.status];
  }

  if (report.is_complete && report.is_on_time) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  if (!report.is_complete) {
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  }

  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function badgeLabel(report) {
  if (isGeneratedSummaryReport(report)) {
    return 'Generated Summary';
  }

  if (['submitted', 'under_review'].includes(report.status)) {
    return 'Under Review';
  }

  if (report.status === 'needs_revision') {
    return 'Revise / Return';
  }

  if (['verified_by_staff', 'forwarded_to_admin', 'approved'].includes(report.status)) {
    return 'Approved';
  }

  if (report.status_label) {
    return report.status_label;
  }

  if (report.is_complete && report.is_on_time) {
    return 'Complete and on time';
  }

  if (!report.is_complete) {
    return 'Pending completion';
  }

  return 'Submitted';
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleString();
}

function ReportCardsPanel({
  title,
  description,
  reports,
  activeReportId,
  onSelect,
  detailBase,
  emptyMessage,
  countLabel = 'submissions',
  workflowRemarks = '',
  onWorkflowRemarksChange,
  onReportAction,
  actionLoading = '',
  currentRole = '',
  isFocusedReport = () => false,
}) {
  const activeReport = reports.find((report) => report.id === activeReportId) || reports[0] || null;
  const canStaffReview = currentRole === 'staff';
  const generatedSummary = isGeneratedSummaryReport(activeReport);

  const actionButtonClass = 'rounded-full px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60';
  const runAction = (actionName) => {
    if (onReportAction && activeReport) {
      onReportAction(activeReport, actionName);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">{title}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Clickable submitted reports</h2>
            {description ? (
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-[#0f4b94]">
            {reports.length} {countLabel}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {reports.map((report) => (
              <ReportCardLink
                detailBase={detailBase}
                reportId={report.id}
                key={report.id}
                type="button"
                onClick={detailBase ? undefined : () => onSelect(report.id)}
                className={`report-action-card group rounded-[24px] border p-5 text-left outline-none transition focus-visible:border-[#0f4b94] focus-visible:ring-4 focus-visible:ring-sky-100 ${
                  isFocusedReport(report)
                    ? 'notification-focus-ring'
                    : activeReport?.id === report.id
                    ? 'is-selected border-[#0f4b94] bg-blue-50 shadow-lg'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{reportDisplayName(report.report_type_label)}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{reportDisplayName(report.title || report.report_type_label)}</h3>
                  </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(report)}`}>
                    {badgeLabel(report)}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">CDC:</span> {report.cdc_name}</p>
                  <p><span className="font-semibold text-slate-700">Barangay:</span> {report.barangay_name}</p>
                  <p><span className="font-semibold text-slate-700">Status:</span> {report.submission_status || badgeLabel(report)}</p>
                  <p><span className="font-semibold text-slate-700">Submitted:</span> {formatDate(report.submitted_on)}</p>
                </div>

                <div className="report-card-cta mt-4">
                  <span>{activeReport?.id === report.id ? 'Selected report' : 'View details'}</span>
                  <span className="report-card-arrow" aria-hidden="true">-&gt;</span>
                </div>
              </ReportCardLink>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">History Detail</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {activeReport ? reportDisplayName(activeReport.title || activeReport.report_type_label) : 'No report selected'}
        </h2>

        {!activeReport ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Select a submitted report card to view its details and history.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(activeReport)}`}>
                {badgeLabel(activeReport)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {reportDisplayName(activeReport.report_type_label)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CDC</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{activeReport.cdc_name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Barangay</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{activeReport.barangay_name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reporting Period</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Q{activeReport.quarter} {activeReport.year}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submitted By</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{activeReport.submitted_by_name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Deadline</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {activeReport.deadline_date ? new Date(activeReport.deadline_date).toLocaleDateString() : 'Not available'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submission Status</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{activeReport.submission_status || badgeLabel(activeReport)}</p>
              </div>
            </div>

            {(activeReport.review_remarks || activeReport.staff_reviewed_by_name || activeReport.admin_reviewed_by_name) ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Review Trail</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {activeReport.staff_reviewed_by_name ? (
                    <p>Staff review: {activeReport.staff_reviewed_by_name}</p>
                  ) : null}
                  {activeReport.admin_reviewed_by_name ? (
                    <p>Admin review: {activeReport.admin_reviewed_by_name}</p>
                  ) : null}
                  {activeReport.review_remarks ? (
                    <p className="leading-6">Remarks: {activeReport.review_remarks}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {onReportAction && activeReport && !generatedSummary ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workflow Actions</p>
                <textarea
                  value={workflowRemarks}
                  onChange={(event) => onWorkflowRemarksChange?.(event.target.value)}
                  rows="3"
                  placeholder="Add review remarks when returning, rejecting, or documenting validation notes."
                  className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {canStaffReview ? (
                    <>
                      <button type="button" disabled={actionLoading === 'needs-revision'} onClick={() => runAction('needs-revision')} className={`${actionButtonClass} bg-amber-600 hover:bg-amber-700`}>
                        Revise / Return
                      </button>
                      <button type="button" disabled={actionLoading === 'approve'} onClick={() => runAction('approve')} className={`${actionButtonClass} bg-emerald-600 hover:bg-emerald-700`}>
                        Approve
                      </button>
                      <button type="button" disabled={actionLoading === 'reject'} onClick={() => runAction('reject')} className={`${actionButtonClass} bg-rose-600 hover:bg-rose-700`}>
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {generatedSummary ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Generated Summary</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-900">
                  This CDC annual report is generated for CSWDO review and filing. It does not require approve, reject, or revision actions.
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submission Summary</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {activeReport.summary || 'No additional summary was saved for this report.'}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Attached Files</p>
              {activeReport.attachment_url || activeReport.pdf_attachment_url ? (
                <div className="mt-3 space-y-3">
                  {activeReport.pdf_attachment_url ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        {activeReport.pdf_attachment_name || 'Generated PDF'}
                      </span>
                      <a
                        href={activeReport.pdf_attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Open PDF
                      </a>
                    </div>
                  ) : null}

                  {activeReport.attachment_url ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {activeReport.attachment_name || 'Generated HTML'}
                      </span>
                      <a
                        href={activeReport.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Open HTML
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No file was attached to this submission.</p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submitted On</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(activeReport.submitted_on)}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ReportCardsPanel;

function ReportCardLink({ detailBase, reportId, children, ...props }) {
  return detailBase ? <Link {...props} to={`${detailBase}/${reportId}`}>{children}</Link> : <button {...props}>{children}</button>;
}
