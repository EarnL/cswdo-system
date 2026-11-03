import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { LoadingSpinner, LoadingState } from '../components/LoadingState';

const POPULATION_ACTION_TIMEOUT_MS = 5 * 60 * 1000;
const REVISION_REASONS = [
  'Missing required child information',
  'Invalid or unclear barangay data',
  'Duplicate records found',
  'Incorrect age coverage',
  'File format issue',
  'Incomplete population file',
  'Needs clarification from CHO',
  'Other',
];

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusLabel = (status) => {
  if (status === 'submitted') return 'For Receiving';
  if (status === 'received' || status === 'under_planning_review') return 'Under Planning Review';
  if (status === 'returned_to_cho') return 'Returned to CHO';
  if (status === 'revised_by_cho') return 'Revised by CHO';
  if (status === 'sending') return 'Sending';
  if (status === 'sent_to_cswdo') return 'Sent to CSWDO';
  if (status === 'received_by_cswdo') return 'Received by CSWDO';
  if (status === 'current_basis') return 'Currently used for planning';
  if (status === 'archived') return 'History';
  return status || 'Submitted';
};

function CityPlanningDashboard() {
  const location = useLocation();
  const [queueTab, setQueueTab] = useState('review');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [returnReason, setReturnReason] = useState(REVISION_REASONS[0]);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);
  const actionLoading = actionState?.key || '';
  const isActionProcessing = Boolean(actionState);
  const actionKey = actionState?.key || '';

  useEffect(() => {
    if (!actionKey) return undefined;
    const timer = window.setTimeout(() => {
      setActionState((current) => (
        current ? { ...current, message: 'Still processing. Please wait...' } : current
      ));
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [actionKey]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/population-data/');
      setFiles(response.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load population data files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleMarkReceived = async (fileId) => {
    if (isActionProcessing) return;
    setFeedback(null);
    try {
      setActionState({
        key: `${fileId}-receive`,
        title: 'Processing population data',
        message: 'Validating population data. Please wait...',
      });
      await api.post(`/population-data/${fileId}/mark_received/`, null, { timeout: POPULATION_ACTION_TIMEOUT_MS });
      await fetchFiles();
      setFeedback({
        type: 'success',
        title: 'Population data marked as received.',
        message: 'Review the file for accuracy and completeness before approving it.',
      });
    } catch (err) {
      console.error('Failed to mark as received:', err);
      setFeedback({
        type: 'error',
        title: 'Population data was not marked as received.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'The backend confirmed the request could not be completed.',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleSendToCSWDO = async (fileId) => {
    if (isActionProcessing) return;
    const confirmed = window.confirm('Forward this reviewed population data to CSWDO? Its linked request will be completed.');
    if (!confirmed) return;
    setFeedback(null);
    try {
      setActionState({
        key: `${fileId}-forward`,
        title: 'Processing population data',
        message: 'Forwarding population data to CSWDO. Please wait...',
      });
      setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, status: 'sending' } : file)));
      await api.post(`/population-data/${fileId}/send_to_cswdo/`, null, { timeout: POPULATION_ACTION_TIMEOUT_MS });
      await fetchFiles();
      setFeedback({
        type: 'success',
        title: 'Population data sent to CSWDO.',
        message: 'The validated file is now available to CSWDO. Applying it as the current planning basis is a separate decision.',
      });
    } catch (err) {
      console.error('Failed to send to CSWDO:', err);
      setFeedback({
        type: 'error',
        title: 'Population data was not sent to CSWDO.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'The backend confirmed the request could not be completed.',
      });
      setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, status: 'received' } : file)));
    } finally {
      setActionState(null);
    }
  };

  const openReturnModal = (file) => {
    if (isActionProcessing) return;
    setReturnModal(file);
    setReturnReason(REVISION_REASONS[0]);
    setReturnRemarks('');
    setFeedback(null);
  };

  const closeReturnModal = () => {
    if (isActionProcessing) return;
    setReturnModal(null);
    setReturnReason(REVISION_REASONS[0]);
    setReturnRemarks('');
  };

  const handleReturnToCHO = async (event) => {
    event.preventDefault();
    if (isActionProcessing || !returnModal) return;
    if (!returnReason.trim() || !returnRemarks.trim()) {
      setFeedback({
        type: 'error',
        title: 'Revision details are required.',
        message: 'Select a revision reason and add clear remarks for CHO before returning the file.',
      });
      return;
    }

    try {
      setActionState({
        key: `${returnModal.id}-return`,
        title: 'Processing population data',
        message: 'Returning population data to CHO for revision. Please wait...',
      });
      await api.post(
        `/population-data/${returnModal.id}/return_to_cho/`,
        { revision_reason: returnReason, remarks: returnRemarks, revision_due_date: returnDeadline },
        { timeout: POPULATION_ACTION_TIMEOUT_MS }
      );
      await fetchFiles();
      setFeedback({
        type: 'success',
        title: 'Population data returned to CHO.',
        message: 'CHO can now review the City Planning remarks and resubmit a revised file.',
      });
      setReturnModal(null);
      setReturnReason(REVISION_REASONS[0]);
      setReturnRemarks('');
    } catch (err) {
      console.error('Failed to return to CHO:', err);
      setFeedback({
        type: 'error',
        title: 'Population data was not returned to CHO.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'The backend confirmed the request could not be completed.',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleDownload = (file) => {
    if (isActionProcessing) return;
    if (!file?.data_file) {
      alert('No uploaded file is available.');
      return;
    }
    window.open(file.data_file, '_blank', 'noopener,noreferrer');
  };

  const queues = useMemo(() => {
    const forReceiving = files.filter((file) => ['submitted', 'revised_by_cho'].includes(file.status));
    const readyToForward = files.filter((file) => ['received', 'under_planning_review', 'sending'].includes(file.status));
    const returned = files.filter((file) => file.status === 'returned_to_cho');
    const forwarded = files.filter((file) => ['sent_to_cswdo', 'received_by_cswdo', 'current_basis', 'archived'].includes(file.status));

    return { forReceiving, readyToForward, returned, forwarded };
  }, [files]);

  const latestFile = files[0] || null;
  const activeQueue = [...queues.forReceiving, ...queues.readyToForward];

  if (loading) {
    return <LoadingState title="Loading population files..." message="Preparing the City Planning review queue." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5"><Link to="/planning/data-requests" className="lgu-button-secondary">Review data requests</Link>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="p-6 sm:p-8">
            <p className="lgu-kicker">Planning and Development</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Population Data Review Desk</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Receive CHO population submissions, confirm readable files, and forward verified data to CSWDO for analytics.
            </p>
          </div>
          <div className="border-t border-slate-200 bg-brand-navy p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/95 p-2 text-brand-navy">
                <AppIcon name="map" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Current Queue</p>
                <p className="text-lg font-black">{activeQueue.length} pending actions</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <MiniStat label="Files" value={files.length} />
              <MiniStat label="Receive" value={queues.forReceiving.length} />
              <MiniStat label="Returned" value={queues.returned.length} />
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="lgu-alert-error">{error}</div> : null}

      {actionState ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-800 shadow-sm" role="status" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LoadingSpinner className="h-5 w-5 text-brand-navy" />
            <div>
              <p className="font-black">{actionState.title}</p>
              <p className="mt-1 text-sm font-semibold text-sky-700">{actionState.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {feedback && !actionState ? (
        <div
          className={`rounded-xl border p-4 shadow-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
          aria-live="polite"
        >
          <p className="font-black">{feedback.title}</p>
          <p className="mt-1 text-sm font-semibold">{feedback.message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.28fr_0.72fr]">
        <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${notificationFocus ? 'notification-focus-ring' : ''}`}>
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">City Planning Review</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Population Submissions</h2>
            </div>
            <button type="button" onClick={fetchFiles} className="lgu-button-secondary w-fit">
              Refresh
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Submission status">
            {[['review','To Review'],['returned','Awaiting CHO'],['forwarded','Forwarded'],['history','History']].map(([key,label]) => <button type="button" key={key} aria-pressed={queueTab === key} onClick={() => setQueueTab(key)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${queueTab === key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>{label}</button>)}
          </div>
          <div className="mt-4 space-y-3">{files.filter(file => queueTab === 'review' ? ['submitted','revised_by_cho','received','under_planning_review','sending'].includes(file.status) : queueTab === 'returned' ? file.status === 'returned_to_cho' : queueTab === 'history' ? ['archived','rejected_by_admin'].includes(file.status) : ['sent_to_cswdo','received_by_cswdo','current_basis'].includes(file.status)).map(file => <details key={file.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer"><span className="font-semibold text-slate-900">{file.title}</span><span className="ml-3 text-xs text-blue-700">{statusLabel(file.status)}</span><p className="mt-1 text-xs text-slate-500">{file.academic_year_name || 'Year not recorded'} | {file.data_payload?.reporting_period_start || 'Period not recorded'}{file.data_payload?.reporting_period_end ? ` to ${file.data_payload.reporting_period_end}` : ''} | Version {1 + (file.history || []).filter(entry => entry.action === 'revised_by_cho').length} | {file.data_request ? `Request #${file.data_request}` : 'Legacy submission'}</p></summary>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="lgu-button-secondary" onClick={() => handleDownload(file)}>View file</button>{file.data_request && <Link className="lgu-button-secondary" to={`/planning/data-requests/${file.data_request}`}>Review request</Link>}
              {['submitted','revised_by_cho'].includes(file.status) && <button type="button" disabled={isActionProcessing} className="lgu-button-primary" onClick={() => handleMarkReceived(file.id)}>Start review</button>}
              {['submitted','revised_by_cho','received','under_planning_review'].includes(file.status) && <button type="button" disabled={isActionProcessing} className="lgu-button-secondary" onClick={() => openReturnModal(file)}>Request revision</button>}
              {['received','under_planning_review'].includes(file.status) && <button type="button" disabled={isActionProcessing} className="lgu-button-primary" onClick={() => handleSendToCSWDO(file.id)}>Forward to CSWDO</button>}
            </div><details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-600">Revision history</summary>{(file.history || []).map(entry => <p key={entry.id} className="mt-2 border-l-2 border-slate-200 pl-3 text-xs text-slate-600">{formatDate(entry.created_at)}: {entry.message}{entry.remarks ? ` - ${entry.remarks}` : ''}</p>)}</details>
          </details>)}{!files.some(file => queueTab === 'review' ? ['submitted','revised_by_cho','received','under_planning_review','sending'].includes(file.status) : queueTab === 'returned' ? file.status === 'returned_to_cho' : queueTab === 'history' ? ['archived','rejected_by_admin'].includes(file.status) : ['sent_to_cswdo','received_by_cswdo','current_basis'].includes(file.status)) && <p className="py-6 text-center text-sm text-slate-500">No submissions here.</p>}</div>

        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">Workflow</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Review path</h3>
            <div className="mt-4 space-y-3">
              {[
                ['1', 'CHO submits child population file'],
                ['2', 'Planning reviews the file'],
                ['3', 'Planning forwards valid files or returns files needing revision'],
                ['4', 'CSWDO validates and sets the current basis'],
              ].map(([step, text]) => (
                <div key={step} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-xs font-black text-white">{step}</span>
                  <p className="text-sm font-semibold text-slate-700">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Latest file</h3>
            <p className="mt-3 text-lg font-black text-brand-navy">{latestFile?.title || 'No files yet'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {latestFile ? `${latestFile.academic_year_name || 'No academic year'} | ${formatDate(latestFile.submitted_on)}` : 'Waiting for CHO submission.'}
            </p>
            {latestFile ? (
              <span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(latestFile.status)}`}>
                {statusLabel(latestFile.status)}
              </span>
            ) : null}
          </section>

          <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <h3 className="text-lg font-black text-brand-navy">Forwarding check</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Forward only files that are readable, clearly titled, and intended for CSWDO population analysis.
            </p>
          </section>
        </aside>
      </div>

      {returnModal ? (
        <ReturnToCHOModal
          file={returnModal}
          reason={returnReason}
          remarks={returnRemarks}
          deadline={returnDeadline}
          onDeadlineChange={setReturnDeadline}
          onReasonChange={setReturnReason}
          onRemarksChange={setReturnRemarks}
          onClose={closeReturnModal}
          onSubmit={handleReturnToCHO}
          isSubmitting={actionLoading === `${returnModal.id}-return`}
        />
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-sky-100">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function QueueColumn({ title, subtitle, files, emptyText, renderActions, highlight = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${highlight ? 'notification-focus-ring' : ''}`}>
      <div className="mb-4">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
            {emptyText}
          </div>
        ) : (
          files.map((file) => (
            <FileCard key={file.id} file={file} renderActions={renderActions} highlight={highlight} />
          ))
        )}
      </div>
    </div>
  );
}

function FileCard({ file, renderActions, highlight = false }) {
  return (
    <article className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'notification-focus-ring' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-black text-slate-950">{file.title}</h4>{file.data_request && <Link to={`/planning/data-requests/${file.data_request}`} className="mt-1 inline-block text-xs font-semibold text-brand-navy underline">Open linked request</Link>}
          <p className="mt-1 text-sm text-slate-600">
            {file.submitted_by_name || 'CHO'} | {file.academic_year_name || 'No academic year'} | {formatDate(file.submitted_on)}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(file.status)}`}>
          {statusLabel(file.status)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-500">{file.description || 'No description provided.'}</p>
      <HistoryPreview file={file} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Records: {file.total_records || 0}</p>
        <div className="flex flex-wrap gap-2">{renderActions(file)}</div>
      </div>
    </article>
  );
}

function HistoryPreview({ file }) {
  const latest = file.history?.[0];
  if (!latest) return null;
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Latest Activity</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{latest.message}</p>
      {latest.remarks ? <p className="mt-1 text-xs text-slate-500">Remarks: {latest.remarks}</p> : null}
    </div>
  );
}

function ReturnToCHOModal({ file, reason, remarks, deadline, onDeadlineChange, onReasonChange, onRemarksChange, onClose, onSubmit, isSubmitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Request Revision</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Return to CHO for Revision</h2>
            <p className="mt-2 text-sm text-slate-600">{file.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-60">
            Close
          </button>
        </div>

        {file.data_request && <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Correction deadline</span><input type="date" required value={deadline} onChange={(event) => onDeadlineChange(event.target.value)} className="login-field" /></label>}
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Revision Reason</span>
          <select value={reason} onChange={(event) => onReasonChange(event.target.value)} className="login-field" required>
            {REVISION_REASONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Remarks / Notes</span>
          <textarea
            value={remarks}
            onChange={(event) => onRemarksChange(event.target.value)}
            className="login-field min-h-[130px] resize-y"
            placeholder="Explain what CHO needs to correct or clarify."
            required
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="lgu-button-secondary disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || !remarks.trim()} className="lgu-button-primary disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner />
                Returning...
              </span>
            ) : (
              'Return to CHO for Revision'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function statusTone(status) {
  switch (status) {
    case 'submitted':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'revised_by_cho':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'received':
    case 'under_planning_review':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'returned_to_cho':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'sending':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'sent_to_cswdo':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'received_by_cswdo':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'current_basis':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'archived':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export default CityPlanningDashboard;
