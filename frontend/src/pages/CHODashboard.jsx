import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { LoadingSpinner, LoadingState } from '../components/LoadingState';

const expectedColumns = ['child_full_name', 'date_of_birth', 'sex', 'barangay', 'guardian_name'];
const AGE_COVERAGE_LABEL = 'Children aged 0-5';
const AGE_COVERAGE_VALUE = '0-5';
const normalizeAcademicYearInput = (value = '') => String(value).trim().replace(/\u2013|\u2014/g, '-');

const formatDate = (value) => {
  if (!value) return 'No uploads yet';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function CHODashboard({ historyOnly = false }) {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYearText, setAcademicYearText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploads, setUploads] = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [revisionFiles, setRevisionFiles] = useState({});
  const [revisionNotes, setRevisionNotes] = useState({});
  const [resubmittingId, setResubmittingId] = useState(null);
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);

  const fetchAcademicYears = useCallback(async () => {
    try {
      const response = await api.get('/academic-years/');
      const years = response.data || [];
      setAcademicYears(years);
      const active = years.find((item) => item.is_active) || years[0];
      if (active) {
        setAcademicYearText(active.name || '');
      }
    } catch (yearError) {
      console.error('Failed to fetch academic years:', yearError);
    }
  }, []);

  const fetchUploads = useCallback(async () => {
    try {
      setLoadingUploads(true);
      const response = await api.get('/population-data/');
      setUploads(historyOnly ? (response.data || []).filter((item) => !item.data_request) : response.data || []);
      setError('');
    } catch (uploadError) {
      console.error('Failed to fetch uploads:', uploadError);
      setError('Unable to load submitted population files.');
    } finally {
      setLoadingUploads(false);
    }
  }, [historyOnly]);

  useEffect(() => {
    fetchUploads();
    fetchAcademicYears();
  }, [fetchUploads, fetchAcademicYears]);

  const handleFileChange = async (event) => {
    const nextFile = event.target.files[0] || null;
    setFile(nextFile);
    setPreviewData(null);
    setPreviewError('');

    if (!nextFile) return;

    setPreviewLoading(true);
    try {
      const previewFormData = new FormData();
      previewFormData.append('data_file', nextFile);
      const response = await api.post('/population-data/preview_upload/', previewFormData);
      setPreviewData(response.data);
    } catch (previewUploadError) {
      console.error('Preview failed:', previewUploadError);
      const detail = previewUploadError?.response?.data;
      setPreviewError(detail?.error || 'Unable to preview the selected file.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedAcademicYear = normalizeAcademicYearInput(academicYearText);
    const matchedAcademicYear = academicYears.find((item) => item.name === normalizedAcademicYear);

    if (!file || !title.trim() || !normalizedAcademicYear) {
      alert('Please provide a title, academic year / data year, and file.');
      return;
    }

    if (!/^\d{4}\s*-\s*\d{4}$/.test(normalizedAcademicYear)) {
      alert('Please use academic year format YYYY-YYYY, for example 2026-2027.');
      return;
    }

    if (previewData?.missing_required_columns?.length) {
      alert(`Please fix the file first. Missing required columns: ${previewData.missing_required_columns.join(', ')}`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (matchedAcademicYear?.id) {
        formData.append('academic_year', matchedAcademicYear.id);
      }
      formData.append('academic_year_name', normalizedAcademicYear);
      formData.append('data_file', file);
      formData.append(
        'data_payload',
        JSON.stringify({
          age_range: AGE_COVERAGE_VALUE,
          age_coverage_label: AGE_COVERAGE_LABEL,
          academic_year: normalizedAcademicYear,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'unknown',
          expected_columns: expectedColumns,
          uploaded_at: new Date().toISOString(),
        })
      );

      await api.post('/population-data/', formData);

      alert('Population data sent to City Planning successfully.');
      setFile(null);
      setTitle('');
      setDescription('');
      const active = academicYears.find((item) => item.is_active) || academicYears[0];
      setAcademicYearText(active?.name || normalizedAcademicYear);
      setPreviewData(null);
      setPreviewError('');
      const input = document.getElementById('cho-file-upload');
      if (input) input.value = '';
      await fetchUploads();
    } catch (uploadError) {
      console.error('Upload failed:', uploadError);
      const detail = uploadError?.response?.data;
      if (typeof detail === 'string') alert(detail);
      else if (detail?.data_file?.[0]) alert(detail.data_file[0]);
      else if (detail?.data_payload?.[0]) alert(detail.data_payload[0]);
      else alert('Failed to send data. Please review the file format and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevisionFileChange = (submissionId, event) => {
    const nextFile = event.target.files[0] || null;
    setRevisionFiles((current) => ({ ...current, [submissionId]: nextFile }));
  };

  const handleResubmitRevision = async (submission) => {
    const revisedFile = revisionFiles[submission.id];
    if (!revisedFile) {
      alert('Please choose the corrected CSV or Excel file before resubmitting.');
      return;
    }

    setResubmittingId(submission.id);
    try {
      const normalizedAcademicYear = normalizeAcademicYearInput(submission.academic_year_name || submission.data_payload?.academic_year || academicYearText);
      const formData = new FormData();
      formData.append('title', submission.title);
      formData.append('description', submission.description || '');
      if (submission.academic_year) {
        formData.append('academic_year', submission.academic_year);
      }
      formData.append('academic_year_name', normalizedAcademicYear);
      formData.append('data_file', revisedFile);
      formData.append('resubmission_notes', revisionNotes[submission.id] || '');
      formData.append(
        'data_payload',
        JSON.stringify({
          ...(submission.data_payload || {}),
          age_range: AGE_COVERAGE_VALUE,
          age_coverage_label: AGE_COVERAGE_LABEL,
          academic_year: normalizedAcademicYear,
          revised_file_name: revisedFile.name,
          revised_file_size: revisedFile.size,
          revised_at: new Date().toISOString(),
          previous_revision_reason: submission.revision_reason || '',
        })
      );

      await api.post(`/population-data/${submission.id}/resubmit_revision/`, formData);
      alert('Revised population data resubmitted to City Planning.');
      setRevisionFiles((current) => ({ ...current, [submission.id]: null }));
      setRevisionNotes((current) => ({ ...current, [submission.id]: '' }));
      const input = document.getElementById(`revision-file-${submission.id}`);
      if (input) input.value = '';
      await fetchUploads();
    } catch (revisionError) {
      console.error('Revision resubmission failed:', revisionError);
      const detail = revisionError?.response?.data;
      if (typeof detail === 'string') alert(detail);
      else if (detail?.error) alert(detail.error);
      else if (detail?.data_file?.[0]) alert(detail.data_file[0]);
      else alert('Failed to resubmit the revised population data.');
    } finally {
      setResubmittingId(null);
    }
  };

  const stats = useMemo(() => {
    return {
      totalUploads: uploads.length,
      pendingReview: uploads.filter((item) => ['submitted', 'received', 'under_planning_review', 'revised_by_cho'].includes(item.status)).length,
      lastUpload: uploads[0]?.submitted_on || null,
      forwarded: uploads.filter((item) => ['sent_to_cswdo', 'received_by_cswdo', 'current_basis', 'archived'].includes(item.status)).length,
      revisionNeeded: uploads.filter((item) => item.status === 'returned_to_cho').length,
    };
  }, [uploads]);

  const fileSummary = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
    };
  }, [file]);

  const statusTone = (status) => {
    switch (status) {
      case 'submitted':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'received':
      case 'under_planning_review':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'returned_to_cho':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'revised_by_cho':
        return 'border-amber-200 bg-amber-50 text-amber-700';
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
  };

  const statusLabel = (status) => {
    if (status === 'current_basis') return 'Currently used for planning';
    if (status === 'archived') return 'History';
    if (status === 'returned_to_cho') return 'Returned to CHO for revision';
    if (status === 'revised_by_cho') return 'Revised by CHO';
    if (status === 'under_planning_review') return 'Under City Planning review';
    return (status || 'submitted').replaceAll('_', ' ');
  };

  const previewReady = previewData && !previewData.missing_required_columns?.length;
  const returnedUploads = uploads.filter((item) => item.status === 'returned_to_cho');

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="cho-page-heading"><div><Link to="/cho/submissions" className="text-sm font-medium text-brand-navy">&larr; My submissions</Link><h1 className="mt-3 text-3xl text-slate-900">Earlier submissions</h1><p className="mt-2 text-sm text-slate-500">Previous files and outstanding corrections.</p></div><Link to="/cho/data-requests" className="lgu-button-primary">View data requests</Link></header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Files submitted', stats.totalUploads], ['In review', stats.pendingReview], ['Needs correction', stats.revisionNeeded], ['Forwarded', stats.forwarded]].map(([label, value]) => <div key={label} className="cho-stat"><span className="text-xs text-slate-500">{label}</span><span className="cho-stat-value">{loadingUploads ? '...' : value}</span></div>)}</div>

      {!historyOnly && <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">Submission Desk</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Population Dataset Details</h2>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-brand-navy">
              <AppIcon name="upload" className="h-4 w-4" />
              CSV or Excel
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.55fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Dataset Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g., 2026 Barangay Children Population"
                  className="login-field"
                  required
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700">Age Coverage</span>
                <div className="login-field flex items-center rounded-xl bg-slate-50 font-bold text-slate-800">
                  {AGE_COVERAGE_LABEL}
                </div>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Academic Year / Data Year</span>
              <input
                type="text"
                value={academicYearText}
                onChange={(event) => {
                  const value = event.target.value;
                  setAcademicYearText(value);
                }}
                placeholder="Example: 2026-2027"
                className="login-field"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Barangays covered, source, or corrections."
                rows={3}
                className="login-field min-h-[104px] resize-y"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-bold text-slate-700">Upload File</span>
              <label
                htmlFor="cho-file-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-[#0f4b94] hover:bg-sky-50"
              >
                <input id="cho-file-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" required />
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-brand-navy shadow-sm">
                  <AppIcon name="upload" className="h-6 w-6" />
                </span>
                <span className="mt-3 text-sm font-black text-slate-900">{file ? file.name : 'Upload CSV / Excel file'}</span>
                <span className="mt-1 text-xs text-slate-500">Accepted formats: .csv, .xlsx, .xls</span>
              </label>
            </div>

            {fileSummary ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <FileFact label="Filename" value={fileSummary.name} />
                <FileFact label="Type" value={fileSummary.type} />
                <FileFact label="Size" value={fileSummary.size} />
              </div>
            ) : null}

            {(previewLoading || previewError || previewData) ? (
              <PreviewPanel
                previewLoading={previewLoading}
                previewError={previewError}
                previewData={previewData}
                previewReady={previewReady}
              />
            ) : null}

            <button
              type="submit"
              disabled={!file || !academicYearText.trim() || isUploading || previewLoading || Boolean(previewData?.missing_required_columns?.length)}
              className="login-primary-button w-full"
            >
              {isUploading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner />
                  Uploading...
                </span>
              ) : (
                'Submit Population Data'
              )}
            </button>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">Quick Guide</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">What CHO needs to send</h3>
            <div className="mt-4 space-y-3">
              {[
                'One row per child or population record.',
                'Use date_of_birth when available so the system can compute the child age per academic year.',
                'Barangay names should match official Lucena barangay names.',
                'Do not include enrollment status; the system gets that from CDW student profiles.',
              ].map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Required columns</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {expectedColumns.map((column) => (
                <span key={column} className="rounded-full bg-sky-50 px-3 py-2 text-sm font-bold text-brand-navy">
                  {column}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Last activity</h3>
            <p className="mt-3 text-2xl font-black text-brand-navy">{formatDate(stats.lastUpload)}</p>
            <p className="mt-2 text-sm text-slate-500">Most recent CHO population submission.</p>
          </section>
        </aside>
      </div>}

      {returnedUploads.length > 0 ? (
        <section className={`rounded-xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6 ${notificationFocus === 'cho_population_needs_revision' ? 'notification-focus-ring' : ''}`}>
          <div className="flex flex-col gap-3 border-b border-rose-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Needs Revision</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Files to correct</h2>
              <p className="mt-1 text-sm text-slate-600">Use the feedback below to correct and resubmit.</p>
            </div>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              {returnedUploads.length} returned
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {returnedUploads.map((item) => (
              <article key={item.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.academic_year_name || item.data_payload?.academic_year || 'No academic year'}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>

                <div className="mt-4 rounded-lg border border-rose-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-600">City Planning Remarks</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{item.revision_reason || 'Needs revision'}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.revision_remarks || 'No remarks provided.'}</p>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Corrected File</span>
                  <input
                    id={`revision-file-${item.id}`}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(event) => handleRevisionFileChange(item.id, event)}
                    className="login-field"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Resubmission Notes</span>
                  <textarea
                    value={revisionNotes[item.id] || ''}
                    onChange={(event) => setRevisionNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    rows={2}
                    className="login-field resize-y"
                    placeholder="Short note about the correction."
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.data_file ? (
                    <a href={item.data_file} target="_blank" rel="noopener noreferrer" className="lgu-button-secondary">
                      View returned file
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleResubmitRevision(item)}
                    disabled={resubmittingId === item.id || !revisionFiles[item.id]}
                    className="lgu-button-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {resubmittingId === item.id ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner />
                        Resubmitting...
                      </span>
                    ) : (
                      'Resubmit file'
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${notificationFocus ? 'notification-focus-ring' : ''}`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">Submission History</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Population files sent</h2>
          </div>
          <button type="button" onClick={fetchUploads} className="lgu-button-secondary w-fit">
            Refresh
          </button>
        </div>

        {error ? <p className="lgu-alert-error mt-5">{error}</p> : null}

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          {loadingUploads ? (
            <div className="bg-slate-50 p-8">
              <LoadingState title="Loading submissions..." message="Fetching population files." />
            </div>
          ) : uploads.length === 0 ? (
            <div className="bg-slate-50 p-8 text-center">
              <p className="text-lg font-black text-slate-800">No uploads yet</p>
              <p className="mt-1 text-sm text-slate-500">Submitted population files will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Age Coverage</th>
                    <th>Academic Year</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((item) => (
                    <tr key={item.id} className={
                      (notificationFocus === 'cho_pending_review' && item.status === 'submitted') ||
                      (notificationFocus === 'cho_population_needs_revision' && item.status === 'returned_to_cho') ||
                      (notificationFocus === 'cho_forwarded_uploads' && ['sent_to_cswdo', 'received_by_cswdo', 'current_basis', 'archived'].includes(item.status))
                        ? 'notification-focus-ring'
                        : ''
                    }>
                      <td>
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 max-w-xl truncate text-xs text-slate-500">{item.description || 'No notes provided.'}</p>
                      </td>
                      <td>{item.data_payload?.age_coverage_label || AGE_COVERAGE_LABEL}</td>
                      <td>{item.academic_year_name || item.data_payload?.academic_year || 'Not specified'}</td>
                      <td>{formatDate(item.submitted_on)}</td>
                      <td>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        {item.data_file ? (
                          <a href={item.data_file} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-navy hover:text-brand-hover">
                            View file
                          </a>
                        ) : (
                          <span className="text-slate-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FileFact({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function PreviewPanel({ previewLoading, previewError, previewData, previewReady }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">File Check</p>
          <p className="mt-1 text-sm text-slate-600">Headers and sample rows are checked before sending.</p>
        </div>
        {previewLoading ? <span className="text-sm font-bold text-brand-navy">Checking...</span> : null}
        {previewReady ? <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-brand-navy">Ready</span> : null}
      </div>

      {previewError ? <div className="lgu-alert-error mt-4">{previewError}</div> : null}

      {previewData ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FileFact label="Rows" value={previewData.row_count ?? 0} />
            <FileFact label="Columns" value={previewData.column_count ?? 0} />
            <FileFact label="Required" value={previewData.missing_required_columns?.length ? 'Incomplete' : 'Complete'} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(previewData.detected_columns || []).map((column) => (
              <span key={column} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {column}
              </span>
            ))}
          </div>

          {previewData.missing_required_columns?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Missing required columns: {previewData.missing_required_columns.join(', ')}
            </div>
          ) : null}

          {previewData.preview_rows?.length ? (
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {(previewData.detected_columns || []).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview_rows.map((row, index) => (
                    <tr key={index}>
                      {(previewData.detected_columns || []).map((column) => (
                        <td key={`${index}-${column}`}>{String(row[column] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default CHODashboard;

