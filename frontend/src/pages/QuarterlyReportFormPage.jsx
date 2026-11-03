import ReportCdcField from '../components/ReportCdcField';
import { loadReportCdcs } from '../utils/reportCdcs';
import useReportChanges from '../hooks/useReportChanges';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RoleLayout from '../components/RoleLayout';
import ReportCardsPanel from '../components/ReportCardsPanel';
import DraftsPanel from '../components/DraftsPanel';
import api from '../api';
import { buildInitialFields, quarterlyReportDefinitions } from '../data/quarterlyReportDefinitions';

function getCurrentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function getQuarterDueDate(quarter, year) {
  const numericQuarter = Number(quarter);
  const numericYear = Number(year);
  const dueMonth = numericQuarter * 3 + 1;
  if (dueMonth > 12) {
    return new Date(numericYear + 1, 0, 15);
  }
  return new Date(numericYear, dueMonth - 1, 15);
}

function QuarterlyReportFormPage() {
  const { reportType } = useParams();
  const definition = quarterlyReportDefinitions[reportType];
  const [availableCdcs, setAvailableCdcs] = useState([]);
  const [selectedCdcId, setSelectedCdcId] = useState('');
  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [quarter, setQuarter] = useState(String(getCurrentQuarter()));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [fields, setFields] = useState(() => (definition ? buildInitialFields(definition) : {}));
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const [ready, setReady] = useState(false);
  const { dirty, markSaved, acceptNextChange, confirmDiscard } = useReportChanges({ selectedCdcId, quarter, year, fields }, ready);

  const cdwName = typeof window !== 'undefined' ? localStorage.getItem('username') || 'Assigned CDW' : 'Assigned CDW';

  useEffect(() => {
    if (!definition) {
      return undefined;
    }

    setFields(buildInitialFields(definition));
  }, [definition]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!definition) {
        return;
      }

      try {
        const [cdcRes, reportRes, draftRes] = await Promise.all([
          loadReportCdcs(),
          api.get('/reports/'),
          api.get('/report-drafts/', {
            params: {
              report_type: definition.id,
            },
          }),
        ]);

        if (!isMounted) {
          return;
        }

        const filteredCdcs = cdcRes.data;
        const nextReports = Array.isArray(reportRes.data)
          ? reportRes.data.filter((report) => report.report_type === definition.id)
          : [];

        setAvailableCdcs(filteredCdcs);
        setReports(nextReports);
        setActiveReportId(nextReports[0]?.id ?? null);
        setDrafts(Array.isArray(draftRes.data) ? draftRes.data : []);

        if (filteredCdcs[0]) {
          setSelectedCdcId(String(filteredCdcs[0].id));
        }
        setReady(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setReady(true);
        setLoadError('Failed to load assigned CDCs or quarterly report history.');
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [definition]);

  const selectedCdc = useMemo(
    () => availableCdcs.find((cdc) => String(cdc.id) === String(selectedCdcId)) || null,
    [availableCdcs, selectedCdcId],
  );

  const reportingPeriod = `Q${quarter} ${year}`;
  const formProgress = useMemo(() => {
    const allFields = definition?.sections?.flatMap((section) => section.fields) || [];
    const answered = allFields.filter((field) => String(fields[field.key] || '').trim() !== '').length;
    const total = allFields.length || 1;
    return {
      answered,
      total,
      percent: Math.round((answered / total) * 100),
    };
  }, [definition, fields]);
  const sectionProgress = useMemo(() => (
    (definition?.sections || []).map((section) => {
      const total = section.fields.length || 1;
      const answered = section.fields.filter((field) => String(fields[field.key] || '').trim() !== '').length;
      return {
        title: section.title,
        answered,
        total,
        complete: answered === total,
        missing: total - answered,
      };
    })
  ), [definition, fields]);
  const missingFields = useMemo(() => (
    (definition?.sections || []).flatMap((section) => (
      section.fields
        .filter((field) => String(fields[field.key] || '').trim() === '')
        .map((field) => ({ section: section.title, ...field }))
    ))
  ), [definition, fields]);

  if (!definition) {
    return (
      <RoleLayout role="cdw">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Unknown quarterly report type.
        </div>
      </RoleLayout>
    );
  }

  const refreshReportHistory = async () => {
    const response = await api.get('/reports/');
    const nextReports = Array.isArray(response.data)
      ? response.data.filter((report) => report.report_type === definition.id)
      : [];
    setReports(nextReports);
    setActiveReportId(nextReports[0]?.id ?? null);
  };

  const refreshDraftHistory = async () => {
    const response = await api.get('/report-drafts/', {
      params: {
        report_type: definition.id,
      },
    });
    const nextDrafts = Array.isArray(response.data) ? response.data : [];
    setDrafts(nextDrafts);
    return nextDrafts;
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    if (event.target.type === 'number' && Number(value) < 0) {
      return;
    }
    setFields((current) => ({
      ...current,
      [name]: value,
    }));
    setValidationErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const resetForm = () => {
    setFields(buildInitialFields(definition));
    setQuarter(String(getCurrentQuarter()));
    setYear(String(new Date().getFullYear()));
    setActiveDraftId(null);
    setValidationErrors({});
    setShowReview(false);
    setShowConfirm(false);
  };

  const validateForm = () => {
    const errors = {};
    if (!selectedCdc) {
      errors.selectedCdc = 'Please select the CDC for this submission.';
    }
    const numericYear = Number(year);
    if (!numericYear || numericYear < 2020 || numericYear > 2100) {
      errors.year = 'Please enter a valid report year.';
    }
    (definition.sections || []).forEach((section) => {
      section.fields.forEach((field) => {
        const value = fields[field.key];
        if (String(value || '').trim() === '') {
          errors[field.key] = `${field.label} is required.`;
        }
        if (field.type === 'number' && Number(value || 0) < 0) {
          errors[field.key] = `${field.label} cannot be negative.`;
        }
      });
    });
    setValidationErrors(errors);
    return errors;
  };

  const openReview = () => {
    const errors = validateForm();
    setShowReview(true);
    if (Object.keys(errors).length) {
      setStatusMessage('Please review the missing or invalid fields before submitting.');
    } else {
      setStatusMessage('');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedCdc) {
      setStatusMessage('Please select the CDC for this draft.');
      return;
    }

    try {
      const response = await api.post('/report-drafts/', {
        cdc: Number(selectedCdc.id),
        report_type: definition.id,
        title: `${definition.heading} Draft - ${selectedCdc.name} - ${reportingPeriod}`,
        quarter: Number(quarter),
        year: Number(year),
        payload: {
          selectedCdcId,
          fields,
        },
      });
      markSaved();
      setActiveDraftId(response.data.id);
      await refreshDraftHistory();
      setStatusMessage('Draft saved successfully.');
    } catch (error) {
      console.error(error.response?.data || error);
      setStatusMessage('Failed to save this draft. Please try again.');
    }
  };

  const handleLoadDraft = (draft) => {
    if (!confirmDiscard()) return;
    acceptNextChange();
    setActiveDraftId(draft.id);
    setSelectedCdcId(String(draft.cdc));
    setQuarter(String(draft.quarter));
    setYear(String(draft.year));
    setFields(draft.payload?.fields || buildInitialFields(definition));
    setStatusMessage('Draft loaded into the form.');
  };

  const handleDeleteDraft = async (draftId) => {
    try {
      await api.delete(`/report-drafts/${draftId}/`);
      await refreshDraftHistory();
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
      setStatusMessage('Draft deleted successfully.');
    } catch (error) {
      console.error(error.response?.data || error);
      setStatusMessage('Failed to delete the selected draft.');
    }
  };

  const buildSummary = () => {
    switch (definition.id) {
      case 'eccd_checklist':
        return `${fields.total_children_assessed || 0} children were assessed. ${fields.number_with_delay || 0} were flagged with developmental delay and ${fields.number_normal || 0} were within normal range.`;
      case 'child_profile':
        return `${fields.total_enrolled || 0} children are enrolled, with ${fields.new_enrollees || 0} new enrollees and ${fields.dropouts || 0} dropouts for ${reportingPeriod}.`;
      case 'health_nutrition':
        return `${fields.children_weighed || 0} children were weighed and ${fields.children_measured || 0} were measured during ${reportingPeriod}.`;
      case 'activities':
        return `Quarterly classroom activities, materials used, and implementation challenges were summarized for ${reportingPeriod}.`;
      case 'parent_community':
        return `Parent meetings and community support activities for ${reportingPeriod} were documented in this submission.`;
      case 'cdw_accomplishment':
        return `CDW accomplishments, trainings, issues, and recommendations for ${reportingPeriod} were submitted to CSWDO.`;
      case 'facility_status':
        return `Facility, sanitation, safety, and material status for ${selectedCdc?.name || 'the assigned center'} were documented for ${reportingPeriod}.`;
      default:
        return `${definition.heading} submitted for ${reportingPeriod}.`;
    }
  };

  const submitReport = async () => {
    if (!selectedCdc) {
      setStatusMessage('Please select the CDC for this submission.');
      return;
    }

    const errors = validateForm();
    if (Object.keys(errors).length) {
      setShowConfirm(false);
      setShowReview(true);
      setStatusMessage('Please complete the required fields before submitting.');
      return;
    }

    setSaving(true);
    setStatusMessage('');

    try {
      await api.post('/reports/', {
        cdc: Number(selectedCdc.id),
        report_type: definition.id,
        title: `${definition.heading} - ${selectedCdc.name} - ${reportingPeriod}`,
        summary: buildSummary(),
        quarter: Number(quarter),
        year: Number(year),
        is_complete: true,
        is_on_time: true,
        payload: {
          schema_version: 1,
          report_meta: {
            center_name: selectedCdc.name,
            barangay_name: selectedCdc.barangay_name,
            cdw_name: cdwName,
            reporting_period: reportingPeriod,
          },
          fields,
        },
      });

      await refreshReportHistory();
      if (activeDraftId) {
        await api.delete(`/report-drafts/${activeDraftId}/`);
        setActiveDraftId(null);
      }
      await refreshDraftHistory();
      acceptNextChange();
      setStatusMessage('Quarterly report submitted successfully. A downloadable CSWDO file was generated automatically.');
      resetForm();
    } catch (error) {
      console.error(error.response?.data || error);
      setStatusMessage('Failed to submit this quarterly report. Please review the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    openReview();
  };

  const activeSection = definition.sections[activeSectionIndex] || definition.sections[0];

  return (
    <RoleLayout role="cdw">
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <p role="status" className="text-sm text-slate-500">{dirty ? 'Unsaved changes' : 'All fields marked Required must be completed before submission.'}</p>


        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc,#eff6ff)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link to="/cdw/reports" className="text-sm font-semibold text-[#0f4b94] hover:text-[#0b3b76]">
                Back to Monitoring Reports
              </Link>
              <p className="mt-4 text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Quarterly CDW Report</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{definition.heading}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {definition.description} Once submitted, this form is automatically converted into both an HTML record and a downloadable PDF file for CSWDO receiving and download history.
              </p>
            </div>

            <div className="rounded-lg border border-sky-100 bg-white px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Reporting Period</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{reportingPeriod}</p>
              <p className="mt-2 text-sm text-slate-600">File-ready submission for CSWDO records.</p>
              <p className="mt-2 text-sm font-medium text-amber-700">
                Due by {getQuarterDueDate(quarter, year).toLocaleDateString()}
              </p>
            </div>
          </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Form Progress</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formProgress.percent}%</p>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-[#0f4b94]" style={{ width: `${formProgress.percent}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">{formProgress.answered} of {formProgress.total} fields filled</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Selected CDC</p>
              <p className="mt-2 text-lg font-black text-slate-950">{selectedCdc?.name || 'Not selected'}</p>
              <p className="mt-1 text-sm text-slate-500">{selectedCdc?.barangay_name || 'Choose a CDC below'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Draft Status</p>
              <p className="mt-2 text-lg font-black text-slate-950">{activeDraftId ? 'Draft loaded' : 'No active draft'}</p>
              <p className="mt-1 text-sm text-slate-500">Save a draft before leaving the page.</p>
            </div>
          </div>
        </section>

        {loadError ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.25)]">
            {loadError}
          </section>
        ) : null}

        {statusMessage ? (
          <section className={`rounded-xl p-5 text-sm shadow-[0_24px_70px_-40px_rgba(15,23,42,0.25)] ${statusMessage.includes('successfully') ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
            {statusMessage}
          </section>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <label className="block text-sm font-semibold text-slate-700">Assigned CDC for this submission (required)</label>
              <ReportCdcField
                aria-label="Assigned CDC"
                aria-required="true"
                aria-invalid={Boolean(validationErrors.selectedCdc)}
                value={selectedCdcId}
                onChange={(event) => setSelectedCdcId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-blue-200 bg-white px-4 py-3"
               cdcs={availableCdcs} />
              {validationErrors.selectedCdc && <p role="alert" className="mt-2 text-sm text-rose-700">{validationErrors.selectedCdc}</p>}
              <p className="mt-3 text-xs text-slate-600">
                The selected center, barangay, and your CDW name will be stamped into the generated report file.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Quarter (required)</label>
                  <select aria-label="Quarter" aria-required="true" value={quarter} onChange={(event) => setQuarter(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Year (required)</label>
                  <input
                    type="number"
                    aria-label="Year"
                    aria-required="true"
                    aria-invalid={Boolean(validationErrors.year)}
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                    min="2020"
                  />
                  {validationErrors.year && <p role="alert" className="mt-2 text-sm text-rose-700">{validationErrors.year}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Center Name</p>
              <p className="mt-3 text-lg font-bold text-slate-900">{selectedCdc?.name || 'Select CDC'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Barangay</p>
              <p className="mt-3 text-lg font-bold text-slate-900">{selectedCdc?.barangay_name || 'Select CDC'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CDW Name</p>
              <p className="mt-3 text-lg font-bold text-slate-900">{cdwName}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Generated Output</p>
              <p className="mt-3 text-lg font-bold text-slate-900">HTML Report File</p>
              <p className="mt-2 text-sm text-slate-600">PDF is generated alongside the HTML record.</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Form Sections</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Step-by-step Encoding</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {missingFields.length} missing
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {sectionProgress.map((section, index) => (
                <button
                  key={section.title}
                  type="button"
                  onClick={() => setActiveSectionIndex(index)}
                  className={`rounded-lg border p-3 text-left transition ${
                    activeSectionIndex === index
                      ? 'border-[#0f4b94] bg-blue-50 ring-2 ring-blue-100'
                      : section.complete
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${section.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {section.complete ? 'Complete' : `${section.missing} missing`}
                    </span>
                  </div>
                  <p className="mt-2 font-black text-slate-900">{section.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{section.answered}/{section.total} fields</p>
                </button>
              ))}
            </div>
          </section>

          {activeSection ? (
            <section key={activeSection.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">{activeSection.title}</p>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Required section</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {activeSection.fields.map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label htmlFor={field.key} className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                      <span>{field.label}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">Required</span>
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        aria-required="true"
                        aria-invalid={Boolean(validationErrors[field.key])}
                        aria-describedby={validationErrors[field.key] ? `${field.key}-error` : undefined}
                        name={field.key}
                        value={fields[field.key] || ''}
                        onChange={handleFieldChange}
                        placeholder={field.placeholder || field.label}
                        rows="4"
                        className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 ${validationErrors[field.key] ? 'border-rose-400 ring-4 ring-rose-100' : 'border-slate-300'}`}
                      ></textarea>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        id={field.key}
                        aria-required="true"
                        aria-invalid={Boolean(validationErrors[field.key])}
                        aria-describedby={validationErrors[field.key] ? `${field.key}-error` : undefined}
                        name={field.key}
                        value={fields[field.key] || ''}
                        onChange={handleFieldChange}
                        placeholder={field.placeholder || field.label}
                        className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 ${validationErrors[field.key] ? 'border-rose-400 ring-4 ring-rose-100' : 'border-slate-300'}`}
                        min={field.type === 'number' ? '0' : undefined}
                      />
                    )}
                    {validationErrors[field.key] ? (
                      <p id={`${field.key}-error`} role="alert" className="mt-2 text-xs font-bold text-rose-600">{validationErrors[field.key]}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between gap-3">
                <button type="button" onClick={() => setActiveSectionIndex((index) => Math.max(0, index - 1))} className="lgu-button-secondary" disabled={activeSectionIndex === 0}>Previous</button>
                <button type="button" onClick={() => setActiveSectionIndex((index) => Math.min(definition.sections.length - 1, index + 1))} className="lgu-button-primary" disabled={activeSectionIndex === definition.sections.length - 1}>Next Section</button>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Submit to CSWDO</p>
                <p className="mt-2 text-sm text-slate-600">
                  Submitting now will save the structured quarterly report and generate both HTML and PDF report files automatically for CSWDO receiving.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="lgu-button-secondary"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirmDiscard()) { acceptNextChange(); resetForm(); } }}
                  className="lgu-button-secondary"
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="lgu-button-primary"
                >
                  {saving ? 'Submitting...' : 'Review and Submit'}
                </button>
              </div>
            </div>
          </section>
        </form>

        <DraftsPanel
          title={`${definition.heading} Drafts`}
          drafts={drafts}
          activeDraftId={activeDraftId}
          emptyMessage="Save a draft any time before submitting this quarterly form."
          onLoad={handleLoadDraft}
          onDelete={handleDeleteDraft}
        />

        <ReportCardsPanel
          title="Submitted File History"
          description="Every quarterly report you submit here is converted into a downloadable file for CSWDO records."
          reports={reports}
          activeReportId={activeReportId}
          onSelect={setActiveReportId}
          detailBase="/cdw/reports/submissions"
          emptyMessage="No quarterly report files have been submitted for this form yet."
          countLabel="files"
        />

        {showReview ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Review Before Submit</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{definition.heading}</h2>
                  <p className="mt-1 text-sm text-slate-500">Check the official report details before sending to CSWDO.</p>
                </div>
                <button type="button" onClick={() => setShowReview(false)} className="lgu-button-secondary">Close</button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  ['CDC', selectedCdc?.name || 'Not selected'],
                  ['Barangay', selectedCdc?.barangay_name || 'Not selected'],
                  ['Period', reportingPeriod],
                  ['Prepared By', cdwName],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-900">Section Completion</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${missingFields.length ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {missingFields.length ? `${missingFields.length} missing` : 'Ready'}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {sectionProgress.map((section) => (
                    <div key={section.title} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-bold text-slate-800">{section.title}</span>
                        <span className={section.complete ? 'font-black text-emerald-700' : 'font-black text-amber-700'}>
                          {section.complete ? 'Complete' : `${section.missing} missing`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {missingFields.length ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="font-black text-amber-900">Fields that need attention</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {missingFields.slice(0, 12).map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => {
                          const index = definition.sections.findIndex((section) => section.title === field.section);
                          setActiveSectionIndex(Math.max(0, index));
                          setShowReview(false);
                        }}
                        className="rounded-md bg-white px-3 py-2 text-left text-sm font-semibold text-amber-900"
                      >
                        {field.section}: {field.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  All required fields are completed. The system will generate the official HTML and PDF report after submission.
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setShowReview(false)} className="lgu-button-secondary">Continue Editing</button>
                <button
                  type="button"
                  onClick={() => {
                    if (Object.keys(validateForm()).length) return;
                    setShowConfirm(true);
                  }}
                  className="lgu-button-primary"
                >
                  Submit Report
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showConfirm ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
            <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Confirm Submission</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Submit this report to CSWDO?</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                After submission, this report will be sent for review and can no longer be edited unless it is returned by CSWDO staff.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowConfirm(false)} className="lgu-button-secondary">Cancel</button>
                <button type="button" onClick={submitReport} disabled={saving} className="lgu-button-primary">
                  {saving ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </RoleLayout>
  );
}

export default function QuarterlyReportRoute() {
  const { reportType } = useParams();
  return <QuarterlyReportFormPage key={reportType} />;
}
