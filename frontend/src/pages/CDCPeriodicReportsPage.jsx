import CenterReportSummary from '../components/CenterReportSummary';
import ReportCdcField from '../components/ReportCdcField';
import { loadReportCdcs } from '../utils/reportCdcs';
import useReportChanges from '../hooks/useReportChanges';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { TableSkeleton } from '../components/LoadingState';

const reportModes = {
  annual: {
    type: 'cdc_annual_report',
    label: 'CDC Report',
    title: 'CDC Report Summary',
    description: 'A full center summary generated from CDC information, forms, programs, activities, monitoring records, and CDW notes.',
  },
  quarterly: {
    type: 'cdc_quarterly_report',
    label: 'Quarterly',
    title: 'Automated CDC Quarterly Report',
    description: 'A focused progress report for the selected quarter using the latest encoded CDC records.',
  },
  monthly: {
    type: 'cdc_monthly_report',
    label: 'Monthly',
    title: 'Automated CDC Monthly Report',
    description: 'A short monitoring report for monthly enrollment, programs, health, and activity updates.',
  },
};

const monthOptions = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

const statusMeta = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-sky-50 text-sky-700',
  needs_revision: 'bg-amber-50 text-amber-700',
  verified_by_staff: 'bg-emerald-50 text-emerald-700',
  forwarded_to_admin: 'bg-indigo-50 text-indigo-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-rose-50 text-rose-700',
};

const blankNarratives = {
  executive_summary: '',
  cdc_profile: '',
  enrollment_and_children: '',
  health_nutrition: '',
  learning_programs: '',
  parent_community: '',
  staffing_development: '',
  facility_safety: '',
  accomplishments: '',
  challenges: '',
  recommendations: '',
};

const blankEvidence = {
  cover_image: '',
  activity_photo_1: '',
  activity_photo_2: '',
  facility_photo: '',
  supporting_file: '',
};

const evidenceFieldLabels = {
  cover_image: 'Cover Photo',
  activity_photo_1: 'Activity Photo',
  activity_photo_2: 'Second Activity Photo',
  facility_photo: 'Facility Photo',
  supporting_file: 'Supporting Photo',
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getCurrentQuarter = () => String(Math.floor(new Date().getMonth() / 3) + 1);
const getQuarterFromMonth = (month) => Math.max(1, Math.ceil(toNumber(month) / 3));

const getRoleBase = (role) => {
  if (role === 'staff') return '/staff';
  if (role === 'cdw') return '/cdw';
  return '/admin';
};

const getPeriodLabel = (report) => {
  if (report.period_type === 'monthly' && report.month) {
    const match = monthOptions.find(([value]) => Number(value) === Number(report.month));
    return `${match?.[1] || `Month ${report.month}`} ${report.year}`;
  }
  if (report.period_type === 'annual') return `Annual ${report.year}`;
  return `Q${report.quarter || '-'} ${report.year || '-'}`;
};

const isGeneratedSummaryReport = (report) => (
  report?.report_type === 'cdc_annual_report' && report?.payload?.generated_summary_report === true
);

const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function MetricCard({ label, value, helper, tone = 'border-slate-200 bg-white text-slate-900' }) {
  return (
    <div className={`min-h-[112px] rounded-lg border p-4 ${tone}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold opacity-70">{helper}</p> : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function CDCReportsPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') || 'admin' : 'admin';
  const basePath = getRoleBase(role);
  const canCreateCdcReport = role === 'cdw';
  const canSubmit = canCreateCdcReport;
  const canGenerateAnnual = canCreateCdcReport;
  const { reportMode } = useParams();
  const navigate = useNavigate();
  const mode = reportModes[reportMode] ? reportMode : 'annual';
  const [cdcs, setCdcs] = useState([]);
  const [reports, setReports] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [selectedCdcId, setSelectedCdcId] = useState('');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [narratives, setNarratives] = useState(blankNarratives);
  const [evidence, setEvidence] = useState(blankEvidence);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { markSaved, resetBaseline, confirmDiscard } = useReportChanges({ narratives, evidence }, !loading);
  const activeMode = reportModes[mode];
  const isAnnualMode = mode === 'annual';

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setMessage('');
      try {
        const [cdcRes, reportRes, draftRes] = await Promise.all([
          loadReportCdcs(canCreateCdcReport),
          api.get('/reports/', { params: { include_history: 'true' } }),
          api.get('/report-drafts/'),
        ]);

        if (!mounted) return;
        const nextCdcs = Array.isArray(cdcRes.data) ? cdcRes.data : [];
        setCdcs(nextCdcs);
        setReports(Array.isArray(reportRes.data) ? reportRes.data : []);
        setDrafts(Array.isArray(draftRes.data) ? draftRes.data : []);
        setSelectedCdcId((current) => current || String(nextCdcs[0]?.id || ''));
      } catch (error) {
        if (mounted) setMessage(error.response?.data?.detail || 'Failed to load CDC report data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [canCreateCdcReport]);

  const selectedCdc = useMemo(
    () => cdcs.find((cdc) => String(cdc.id) === String(selectedCdcId)) || null,
    [cdcs, selectedCdcId]
  );

  const period = useMemo(() => {
    if (mode === 'monthly') {
      return {
        period_type: 'monthly',
        month: Number(month),
        quarter: getQuarterFromMonth(month),
        year: Number(year),
        label: `${monthOptions.find(([value]) => value === String(month))?.[1] || 'Month'} ${year}`,
      };
    }
    if (mode === 'annual') {
      return { period_type: 'annual', month: 0, quarter: 4, year: Number(year), label: `Annual ${year}` };
    }
    return { period_type: 'quarterly', month: 0, quarter: Number(quarter), year: Number(year), label: `Q${quarter} ${year}` };
  }, [mode, month, quarter, year]);

  const existingDraft = useMemo(() => drafts.find((draft) => (
    String(draft.cdc) === String(selectedCdcId)
    && draft.report_type === activeMode.type
    && draft.period_type === period.period_type
    && Number(draft.month || 0) === Number(period.month || 0)
    && Number(draft.quarter) === Number(period.quarter)
    && Number(draft.year) === Number(period.year)
  )), [activeMode.type, drafts, period, selectedCdcId]);

  useEffect(() => {
    const nextNarratives = { ...blankNarratives, ...(existingDraft?.payload?.narratives || existingDraft?.payload?.fields || {}) };
    const nextEvidence = { ...blankEvidence, ...(existingDraft?.payload?.evidence || {}) };
    resetBaseline({ narratives: nextNarratives, evidence: nextEvidence });
    setNarratives(nextNarratives);
    setEvidence(nextEvidence);
  }, [existingDraft, resetBaseline, selectedCdcId, period, mode]);

  const [summaryPayload, setSummaryPayload] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    let active = true;
    setSummaryPayload(null);
    setPreviewError('');
    if (!selectedCdcId || !canCreateCdcReport) return undefined;
    setPreviewLoading(true);
    api.get('/reports/center-summary-preview/', { params: { cdc: selectedCdcId, ...period } })
      .then(({ data }) => { if (active) setSummaryPayload(data); })
      .catch(error => { if (active) setPreviewError(error.response?.data?.error || 'Could not load the report preview. Check the reporting period and reload.'); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [selectedCdcId, period, canCreateCdcReport]);
  const reportSections = useMemo(() => Object.keys({ ...blankNarratives, ...narratives }).map(key => ({
    key, title: key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
    autoText: summaryPayload?.template_sections?.find(section => section.key === key)?.autoText || '',
  })), [summaryPayload, narratives]);
  const reportPayload = useMemo(() => ({ ...(summaryPayload || {}), period, narratives, evidence }), [summaryPayload, period, narratives, evidence]);

  const formalReports = useMemo(() => reports.filter((report) => (
    ['cdc_monthly_report', 'cdc_quarterly_report', 'cdc_annual_report'].includes(report.report_type)
  )), [reports]);

  const visibleFormalReports = useMemo(() => formalReports.filter((report) => (
    !selectedCdcId || String(report.cdc) === String(selectedCdcId)
  )), [formalReports, selectedCdcId]);

  const refreshReports = async () => {
    const [reportRes, draftRes] = await Promise.all([api.get('/reports/', { params: { include_history: 'true' } }), api.get('/report-drafts/')]);
    setReports(Array.isArray(reportRes.data) ? reportRes.data : []);
    setDrafts(Array.isArray(draftRes.data) ? draftRes.data : []);
  };

  const saveDraft = async () => {
    if (!summaryPayload || previewLoading) { setMessage('Wait for a valid report preview before continuing.'); return; }
    if (!selectedCdc) {
      setMessage('Please select a CDC before saving a draft.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api.post('/report-drafts/', {
        cdc: selectedCdc.id,
        report_type: activeMode.type,
        title: `${activeMode.title} - ${selectedCdc.name} - ${period.label}`,
        payload: reportPayload,
        period_type: period.period_type,
        month: period.month,
        quarter: period.quarter,
        year: period.year,
      });
      markSaved();
      await refreshReports();
      setMessage('Automated report draft saved.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const submitReport = async () => {
    if (isAnnualMode) {
      await generateAnnualReport();
      return;
    }

    if (!summaryPayload || previewLoading) { setMessage('Wait for a valid report preview before continuing.'); return; }
    if (!selectedCdc) {
      setMessage('Please select a CDC before submitting.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api.post('/reports/', {
        cdc: selectedCdc.id,
        report_type: activeMode.type,
        title: `${activeMode.title} - ${selectedCdc.name} - ${period.label}`,
        summary: `${activeMode.title} for ${selectedCdc.name}, ${period.label}. Generated from encoded CDC/CDW records with editable CDW narrative and evidence.`,
        payload: reportPayload,
        period_type: period.period_type,
        month: period.month,
        quarter: period.quarter,
        year: period.year,
      });
      markSaved();
      await refreshReports();
      setMessage('Automated CDC report submitted for CSWDO review.');
    } catch (error) {
      setMessage(error.response?.data?.detail || error.response?.data?.error || 'Failed to submit report.');
    } finally {
      setSaving(false);
    }
  };

  const handleEvidenceUpload = async (key, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file for report evidence.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage('Please upload an image smaller than 3 MB.');
      return;
    }

    try {
      const imageData = await readImageFile(file);
      setEvidence((current) => ({ ...current, [key]: imageData }));
      setMessage('');
    } catch (error) {
      setMessage('Failed to read the selected image.');
    }
  };

  const removeEvidenceImage = (key) => {
    setEvidence((current) => ({ ...current, [key]: '' }));
  };

  const generateAnnualReport = async () => {
    if (!summaryPayload || previewLoading) { setMessage('Wait for a valid report preview before continuing.'); return; }
    if (!selectedCdc) {
      setMessage('No assigned CDC is available. Contact CSWDO to check your account assignment.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api.post('/reports/generate-cdc-annual/', {
        cdc: selectedCdc.id,
        year: Number(year),
      });
      await refreshReports();
      setMessage('CDC annual report generated. CSWDO staff can open it here and download the PDF.');
    } catch (error) {
      setMessage(error.response?.data?.detail || error.response?.data?.error || 'Failed to generate CDC annual report.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton rows={6} columns={4} />;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <Link to={`${basePath}/reports`} className="inline-flex text-sm font-semibold text-[#0f4b94] hover:underline">Back to Monitoring Reports</Link>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 border-b border-slate-200 bg-slate-950 p-5 text-white xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">CDC Reports</p>
            <h1 className="mt-2 text-2xl font-black">{activeMode.title}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
              {canCreateCdcReport
                ? 'Build a formal report from the CDC profile, forms, submitted reports, programs, readiness records, and CDW-added narratives or evidence.'
                : 'View submitted CDC Reports generated by CDWs for monitoring and oversight.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 self-start">
            {Object.entries(reportModes).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(`${basePath}/cdc-reports/${key}`)}
                className={`rounded-lg px-3 py-3 text-sm font-black transition ${
                  mode === key ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {(summaryPayload?.key_figures || []).map(item => <MetricCard key={item.label} label={item.label} value={item.value ?? 'Not recorded'} helper={item.context} />)}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="CDC">
            <ReportCdcField value={selectedCdcId} onChange={(event) => { if (confirmDiscard()) { setSelectedCdcId(event.target.value); } } } className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" cdcs={cdcs} readOnlyWhenSingle={canCreateCdcReport} />
          </Field>
          {mode === 'monthly' ? (
            <Field label="Month">
              <select value={month} onChange={(event) => { if (confirmDiscard()) { setMonth(event.target.value); } } } className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          ) : null}
          {mode === 'quarterly' ? (
            <Field label="Quarter">
              <select value={quarter} onChange={(event) => { if (confirmDiscard()) { setQuarter(event.target.value); } } } className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </Field>
          ) : null}
          <Field label="Year">
            <input type="number" value={year} onChange={(event) => { if (confirmDiscard()) { setYear(event.target.value); } } } min="2020" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </Field>
          <div className="flex items-end xl:col-span-2">
            <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              {activeMode.title}<br />
              <span className="text-xs font-semibold text-slate-500">{period.label} | {selectedCdc?.assigned_cdw_name || 'Assigned CDW not encoded'}</span>
            </div>
          </div>
        </div>
      </section>

      {message ? <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">{message}</section> : null}

      <div className={isAnnualMode ? 'space-y-5' : 'grid items-start gap-5 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]'}>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Report Contents</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{activeMode.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{activeMode.description}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {isAnnualMode ? 'Fully automated' : 'Auto + CDW editable'}
            </span>
          </div>

          {isAnnualMode ? (
            <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-black text-blue-950">Annual report is generated from stored records</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
                The report will use the selected CDC profile, current population basis, enrollment, child records, programs, monitoring records, submitted forms, and available uploaded evidence.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 space-y-4">
                {reportSections.map((section) => (
                  <div key={section.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-black text-slate-900">{section.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{section.autoText}</p>
                    <textarea
                      aria-label={section.title}
                      value={narratives[section.key] || ''}
                      onChange={(event) => setNarratives((current) => ({ ...current, [section.key]: event.target.value }))}
                      disabled={!canCreateCdcReport}
                      rows={4}
                      placeholder="Add the specific CDC/CDW narrative, accomplishments, observations, explanations, or recommendations for this section."
                      className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Evidence and Images</p>
                <h3 className="mt-1 font-black text-slate-950">Upload report images</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {Object.entries(evidenceFieldLabels).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <Field label={label}>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!canCreateCdcReport}
                          onChange={(event) => handleEvidenceUpload(key, event.target.files?.[0])}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </Field>
                      {evidence[key] ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <img src={evidence[key]} alt={label} className="h-28 w-full object-cover" />
                          <div className="flex items-center justify-between gap-3 p-2">
                            <span className="text-xs font-bold text-slate-600">Image selected</span>
                            {canCreateCdcReport ? <button type="button" onClick={() => removeEvidenceImage(key)} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 hover:bg-slate-200">
                              Remove
                            </button> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {canCreateCdcReport ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {!isAnnualMode ? (
                <button type="button" onClick={saveDraft} disabled={!canSubmit || saving || previewLoading || !summaryPayload} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Save Draft
                </button>
              ) : null}
              <button type="button" onClick={submitReport} disabled={(isAnnualMode ? !canGenerateAnnual : !canSubmit) || saving || previewLoading || !summaryPayload} className="rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-black text-white transition hover:bg-[#0b3b76] disabled:cursor-not-allowed disabled:opacity-50">
              {isAnnualMode ? 'Generate CDC Report' : 'Generate and Submit Report'}
              </button>
              {!isAnnualMode ? <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800">
                Print Preview
              </button> : null}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              CDWs generate and submit CDC Reports. Staff and Admin can view submitted reports for review.
            </div>
          )}
        </section>

        <aside className="space-y-5">
          {previewLoading && <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-500">Preparing report preview...</p>}
          {previewError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{previewError}</p>}
          {summaryPayload && <CenterReportSummary payload={summaryPayload} title={activeMode.title} narratives={isAnnualMode ? undefined : narratives} evidence={isAnnualMode ? undefined : evidence} />}

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Submitted History</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Generated CDC Reports</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{visibleFormalReports.length}</span>
            </div>

            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {!visibleFormalReports.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No automated CDC reports have been submitted for this selection.</div>
              ) : (
                visibleFormalReports.map((report) => (
                  <div key={report.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{report.report_type_label || report.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{report.cdc_name} | {getPeriodLabel(report)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isGeneratedSummaryReport(report) ? 'bg-emerald-50 text-emerald-700' : statusMeta[report.status] || statusMeta.submitted}`}>
                        {isGeneratedSummaryReport(report) ? 'Generated Summary' : report.status_label || report.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{report.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.attachment_url ? <a href={report.attachment_url} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Open HTML</a> : null}
                      {report.pdf_attachment_url ? <a href={report.pdf_attachment_url} target="_blank" rel="noreferrer" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">Open PDF</a> : null}
                      {report.id ? (
                        <Link to={role === 'cdw' ? `/cdw/reports/submissions/${report.id}` : `${basePath}/reports/cdc/${report.cdc}/forms/${report.id}`}  className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">
                          View Report
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function CDCPeriodicReportRoute() {
  const { reportMode } = useParams();
  return <CDCReportsPage key={reportMode || 'annual'} />;
}
