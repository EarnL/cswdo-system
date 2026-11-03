import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import FloatingDomainResults from '../components/FloatingDomainResults';
import useReportChanges from '../hooks/useReportChanges';
import { loadAllAssessments } from '../utils/specialNeeds';

import domains from '../data/specialNeedsDomains.json';

const resultMeta = {
  needs_monitoring: { label: 'Re-test after 3 to 6 months', tone: 'bg-amber-50 text-amber-700 border-amber-200', note: 'The ECCD form indicates re-testing after 3 to 6 months.' },
  no_concern: { label: 'Average development', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', note: 'The child is within the average development range.' },
  for_referral: { label: 'Suggests advanced development', tone: 'bg-sky-50 text-sky-700 border-sky-200', note: 'The ECCD form indicates advanced development.' },
  needs_further_assessment: { label: 'For further review', tone: 'bg-orange-50 text-orange-700 border-orange-200', note: 'Review the scores and observations before final interpretation.' },
};

const assessmentOptions = [
  { value: 'first', label: '1st assessment' },
  { value: 'second', label: '2nd assessment' },
  { value: 'third', label: '3rd assessment' },
];

const normalizeList = (payload) => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

const blankChecklist = () => domains.reduce((acc, domain) => {
  acc[domain.key] = domain.items.map((label, index) => ({ id: `${domain.key}_${index + 1}`, label, present: '', comments: '' }));
  return acc;
}, {});

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

const blankChildProfile = () => ({
  child_name: '',
  sex: '',
  date_of_birth: '',
  address: '',
  handedness: '',
  presently_studying: '',
  school_name: '',
  father_name: '',
  father_age: '',
  father_occupation: '',
  father_education: '',
  mother_name: '',
  mother_age: '',
  mother_occupation: '',
  mother_education: '',
  siblings_count: '',
  birth_order: '',
  child_background: '',
  family_environment: '',
  parent_stimulation: '',
  home_environment: '',
  others: '',
});

function childProfileFromRecord(child) {
  if (!child) return {};
  return {
    child_name: child.name || '',
    sex: child.sex || '',
    date_of_birth: child.date_of_birth || '',
    address: child.complete_address || child.barangay_name || '',
    presently_studying: child.current_status === 'enrolled' ? 'Yes' : '',
    school_name: child.cdc_name || '',
    father_name: child.father_name || '',
    father_occupation: child.occupation || '',
    mother_name: child.mother_name || '',
  };
}

function mergeChildProfile(currentProfile, child, overwrite = true) {
  const childProfile = childProfileFromRecord(child);
  if (overwrite) {
    return { ...currentProfile, ...childProfile };
  }
  return Object.entries(childProfile).reduce((profile, [key, value]) => {
    if (!profile[key] && value) {
      profile[key] = value;
    }
    return profile;
  }, { ...currentProfile });
}

function computeResult(checklist, scoring = {}) {
  const standardScore = Number(scoring.standard_score || 0);
  if (standardScore >= 120) return 'for_referral';
  if (standardScore >= 80) return 'no_concern';
  if (standardScore > 0) return 'needs_monitoring';

  const score = computeScore(checklist);
  if (!score.scored) return 'needs_further_assessment';
  if (score.percent >= 95) return 'for_referral';
  if (score.percent >= 80) return 'no_concern';
  return 'needs_monitoring';
}

function computeScore(checklist) {
  const allItems = Object.values(checklist || {}).flat();
  const scored = allItems.filter((item) => item.present);
  const present = scored.filter((item) => item.present === 'present').length;
  const unable = scored.filter((item) => item.present === 'unable').length;
  const percent = scored.length ? Math.round((present / scored.length) * 100) : 0;
  return {
    total: allItems.length,
    scored: scored.length,
    present,
    unable,
    unscored: allItems.length - scored.length,
    percent,
  };
}

function scoreDomains(checklist) {
  return domains.reduce((acc, domain) => {
    const items = checklist[domain.key] || [];
    acc[domain.key] = {
      raw_score: items.filter((item) => item.present === 'present').length,
      unable_score: items.filter((item) => item.present === 'unable').length,
      total: items.length,
      percent: items.filter((item) => item.present).length
        ? Math.round((items.filter((item) => item.present === 'present').length / items.filter((item) => item.present).length) * 100)
        : 0,
    };
    return acc;
  }, {});
}

function assessmentScorePercent(item) {
  const scored = item?.score_summary?.scored || 0;
  const percent = item?.score_summary?.percent;
  if (Number.isFinite(Number(percent)) && scored) return Number(percent);
  const domainValues = Object.values(item?.domain_scores || {}).filter((value) => value && typeof value === 'object' && Number.isFinite(Number(value.percent)));
  if (!domainValues.length) return 0;
  return Math.round(domainValues.reduce((sum, value) => sum + Number(value.percent || 0), 0) / domainValues.length);
}

function summarizeChildAssessments(child, childAssessments) {
  const sorted = [...childAssessments].sort((a, b) => new Date(b.assessment_date) - new Date(a.assessment_date));
  const latest = sorted[0] || null;
  const completed = new Set(childAssessments.filter((item) => item.status === 'submitted').map((item) => item.assessment_type));
  const draftCount = childAssessments.filter((item) => item.status === 'draft').length;
  const monitoringCount = childAssessments.filter((item) => ['needs_monitoring', 'needs_further_assessment'].includes(item.result)).length;
  const averagePercent = childAssessments.length
    ? Math.round(childAssessments.reduce((sum, item) => sum + assessmentScorePercent(item), 0) / childAssessments.length)
    : 0;
  return {
    child,
    latest,
    total: childAssessments.length,
    submitted: completed.size,
    draftCount,
    monitoringCount,
    averagePercent,
    completionPercent: Math.round((completed.size / assessmentOptions.length) * 100),
    pendingLabels: assessmentOptions.filter((option) => !completed.has(option.value)).map((option) => option.label),
  };
}

function ChildVisualSummary({ summary }) {
  const meta = resultMeta[summary.latest?.result] || resultMeta.needs_further_assessment;
  const bars = [
    ['Progress', summary.completionPercent, 'bg-[#0f4b94]'],
    ['Average score', summary.averagePercent, 'bg-emerald-500'],
    ['Monitoring', Math.min(100, summary.monitoringCount * 34), 'bg-amber-500'],
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">Selected Child Dashboard</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{summary.child?.name || 'No child selected'}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Age {summary.child?.age || '-'} | {summary.child?.cdc_name || 'Assigned CDC'}
          </p>
        </div>
        <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black ${meta.tone}`}>
          {summary.latest ? meta.label : 'No assessment yet'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-500">Submitted</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{summary.submitted}/{assessmentOptions.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-500">Drafts</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{summary.draftCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-500">Latest Date</p>
          <p className="mt-2 text-lg font-black text-slate-950">{summary.latest?.assessment_date || '-'}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {bars.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs font-black uppercase text-slate-500">
              <span>{label}</span>
              <span>{value}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecialNeedsAssessmentPage() {
  const activeRole = localStorage.getItem('role') || '';
  const [searchParams] = useSearchParams();
  const [children, setChildren] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { assessmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isForm = location.pathname.endsWith('/new') || !!assessmentId;
  const [editable, setEditable] = useState(!assessmentId);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    assessment_type: 'first',
    assessment_date: today(),
    examiner_name: '',
    place_administered: '',
    child_profile: blankChildProfile(),
    checklist: blankChecklist(),
    scoring: {
      scaled_scores: domains.reduce((acc, domain) => ({ ...acc, [domain.key]: '' }), {}),
      standard_score: '',
    },
    remarks: '',
  });

  const changes = useReportChanges({ form, selectedChildId }, !loading && isForm);

  const selectedChild = children.find((child) => String(child.id) === String(selectedChildId));
  const score = computeScore(form.checklist);
  const result = computeResult(form.checklist, form.scoring);
  const domainScores = scoreDomains(form.checklist);
  const selectedAssessmentLabel = assessmentOptions.find((option) => option.value === form.assessment_type)?.label || 'assessment';

  const completedAssessmentsByChild = useMemo(() => {
    return assessments.reduce((lookup, item) => {
      if (item.status !== 'submitted') return lookup;
      const childKey = String(item.child);
      if (!lookup[childKey]) lookup[childKey] = new Set();
      lookup[childKey].add(item.assessment_type);
      return lookup;
    }, {});
  }, [assessments]);

  const pendingChildren = useMemo(() => {
    return children.filter((child) => {
      const childKey = String(child.id);
      const completedTypes = completedAssessmentsByChild[childKey];
      const isCompletedForSelectedType = completedTypes?.has(form.assessment_type);
      const isEditingThisChild = editingId && String(child.id) === String(selectedChildId);
      return !isCompletedForSelectedType || isEditingThisChild;
    });
  }, [children, completedAssessmentsByChild, editingId, form.assessment_type, selectedChildId]);

  const childOptions = useMemo(() => {
    if (!selectedChild || pendingChildren.some((child) => String(child.id) === String(selectedChild.id))) {
      return pendingChildren;
    }
    return [selectedChild, ...pendingChildren];
  }, [pendingChildren, selectedChild]);

  const assessmentsByChild = useMemo(() => assessments.reduce((lookup, item) => {
    const key = String(item.child);
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(item);
    return lookup;
  }, {}), [assessments]);

  const childSummaries = useMemo(() => children.map((child) => summarizeChildAssessments(child, assessmentsByChild[String(child.id)] || [])), [assessmentsByChild, children]);

  const selectedChildSummary = useMemo(() => {
    if (!selectedChild) return summarizeChildAssessments(null, []);
    return summarizeChildAssessments(selectedChild, assessmentsByChild[String(selectedChild.id)] || []);
  }, [assessmentsByChild, selectedChild]);

  const assessmentProgress = useMemo(() => {
    return assessmentOptions.map((option) => {
      const completed = children.filter((child) => completedAssessmentsByChild[String(child.id)]?.has(option.value)).length;
      return {
        ...option,
        completed,
        pending: Math.max(0, children.length - completed),
      };
    });
  }, [children, completedAssessmentsByChild]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [childrenRes, assessmentsRes] = await Promise.all([
        loadAllAssessments('/children/?status=enrolled'),
        loadAllAssessments('/special-needs-assessments/'),
      ]);
      const nextChildren = normalizeList(childrenRes.data).filter((child) => child.current_status === 'enrolled' && child.cdc);
      setChildren(nextChildren);
      setAssessments(normalizeList(assessmentsRes.data));
      if (assessmentId) {
        const detail = await api.get(`/special-needs-assessments/${assessmentId}/`);
        const item = detail.data;
        if (!nextChildren.some(child => String(child.id) === String(item.child))) {
          setChildren([...nextChildren, { id: item.child, name: item.child_name, cdc: item.cdc, cdc_name: item.cdc_name, current_status: 'historical' }]);
        }
        setEditingId(item.id);
        setSelectedChildId(item.child);
        setForm({ assessment_type: item.assessment_type, assessment_date: item.assessment_date,
          examiner_name: item.examiner_name || '', place_administered: item.place_administered || '',
          child_profile: { ...blankChildProfile(), child_name: item.child_name, ...item.child_profile },
          checklist: Object.fromEntries(domains.map(domain => [domain.key, domain.items.map((label, index) => {
            const id = `${domain.key}_${index + 1}`;
            return { id, label, present: '', comments: '', ...(item.checklist?.[domain.key] || []).find(row => row.id === id) };
          })])),
          scoring: { scaled_scores: item.domain_scores?.scaled_scores || Object.fromEntries(domains.map(domain => [domain.key, item.domain_scores?.[domain.key]?.scaled_score ?? ''])), standard_score: item.domain_scores?.standard_score ?? '' },
          remarks: item.remarks || '',
        });
        return;
      }
      const requestedChild = nextChildren.find((child) => String(child.id) === String(searchParams.get('child')));
      const initialChild = requestedChild || nextChildren[0];
      const completedTypes = new Set(normalizeList(assessmentsRes.data)
        .filter((item) => String(item.child) === String(requestedChild?.id) && item.status === 'submitted')
        .map((item) => item.assessment_type));
      const nextType = ['first', 'second', 'third'].find((type) => !completedTypes.has(type));
      if (requestedChild && !nextType) {
        setNotice('This child has completed all three assessments. Select a saved assessment below to review or update it. Updating an assessment changes the existing record.');
      }
      setSelectedChildId((current) => current || initialChild?.id || '');
      setForm((current) => current.child_profile.child_name || !initialChild ? current : ({
        ...current,
        assessment_type: requestedChild ? nextType || 'third' : current.assessment_type,
        child_profile: mergeChildProfile(current.child_profile, initialChild, false),
        examiner_name: current.examiner_name || initialChild.assigned_cdw_name || '',
        place_administered: current.place_administered || initialChild.cdc_name || '',
      }));
    } catch (err) {
      console.error(err);
      setError('Failed to load special needs assessment records.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || editingId || assessmentId || !children.length) return;
    // Keep the child opened from their profile selected, including when all stages are complete.
    if (selectedChild && String(selectedChildId) === searchParams.get('child')) return;
    const selectedIsPending = pendingChildren.some((child) => String(child.id) === String(selectedChildId));
    const nextChild = selectedIsPending ? selectedChild : pendingChildren[0];

    if (!nextChild) {
      setSelectedChildId('');
      setForm((current) => ({
        ...current,
        child_profile: { ...current.child_profile, child_name: '' },
      }));
      return;
    }

    if (String(nextChild.id) !== String(selectedChildId)) {
      setSelectedChildId(nextChild.id);
      setForm((current) => ({
        ...current,
        child_profile: mergeChildProfile(blankChildProfile(), nextChild, true),
        examiner_name: nextChild.assigned_cdw_name || current.examiner_name,
        place_administered: nextChild.cdc_name || current.place_administered,
      }));
    }
  }, [children.length, editingId, loading, pendingChildren, selectedChild, selectedChildId, searchParams, assessmentId]);

  const stats = useMemo(() => assessments.reduce((acc, item) => {
    acc.total += 1;
    acc[item.result] = (acc[item.result] || 0) + 1;
    acc.drafts += item.status === 'draft' ? 1 : 0;
    acc.submitted += item.status === 'submitted' ? 1 : 0;
    return acc;
  }, { total: 0, drafts: 0, submitted: 0, no_concern: 0, needs_monitoring: 0, needs_further_assessment: 0, for_referral: 0 }), [assessments]);

  const updateProfile = (name, value) => setForm((current) => ({
    ...current,
    child_profile: { ...current.child_profile, [name]: value },
  }));

  const changeChildSelection = (value) => {
    const matchedChild = childOptions.find((child) => String(child.id) === String(value));
    if (matchedChild) {
      setSelectedChildId(matchedChild.id);
      setForm((current) => ({
        ...current,
        child_profile: mergeChildProfile(current.child_profile, matchedChild, true),
        examiner_name: matchedChild.assigned_cdw_name || current.examiner_name,
        place_administered: matchedChild.cdc_name || current.place_administered,
      }));
    }
  };

  const updateChecklist = (domainKey, itemId, field, value) => setForm((current) => ({
    ...current,
    checklist: {
      ...current.checklist,
      [domainKey]: current.checklist[domainKey].map((item) => item.id === itemId ? { ...item, [field]: value } : item),
    },
  }));

  const resetForm = () => {
    if (!changes.confirmDiscard()) return;
    if (assessmentId) { navigate('/cdw/special-needs/new'); return; }
    setEditingId(null);
    const nextChild = children.find((child) => !completedAssessmentsByChild[String(child.id)]?.has('first')) || null;
    setSelectedChildId(nextChild?.id || '');
    setForm((current) => ({
      ...current,
      assessment_type: 'first',
      assessment_date: today(),
      child_profile: nextChild ? mergeChildProfile(blankChildProfile(), nextChild, true) : blankChildProfile(),
      checklist: blankChecklist(),
      scoring: {
        scaled_scores: domains.reduce((acc, domain) => ({ ...acc, [domain.key]: '' }), {}),
        standard_score: '',
      },
      remarks: '',
    }));
  };

  const changeAssessmentType = (assessmentType) => {
    if (editingId || !changes.confirmDiscard()) return;
    setEditingId(null);
    setForm((current) => ({
      ...current,
      assessment_type: assessmentType,
      checklist: blankChecklist(),
      scoring: {
        scaled_scores: domains.reduce((acc, domain) => ({ ...acc, [domain.key]: '' }), {}),
        standard_score: '',
      },
      remarks: '',
    }));
  };

  const editAssessment = (item) => navigate(`/cdw/special-needs/${item.id}`);

  const saveAssessment = async (status) => {
    if (activeRole !== 'cdw') {
      setError('Only CDW users can encode Special Needs Assessments.');
      return;
    }
    const matchedChild = selectedChild || children.find((child) => child.name.toLowerCase() === (form.child_profile.child_name || '').trim().toLowerCase());
    if (!matchedChild) {
      setError("Enter a child's name from your assigned CDC before saving.");
      return;
    }
    if (!editingId && completedAssessmentsByChild[String(matchedChild.id)]?.has(form.assessment_type)) {
      setError(`${matchedChild.name} already completed the ${selectedAssessmentLabel}. Choose another child or assessment type.`);
      return;
    }
    if (status === 'submitted' && score.unscored) {
      setError(`Answer the remaining ${score.unscored} checklist items before submitting.`);
      return;
    }
    setSaving(status);
    setError('');
    setNotice('');
    const payload = {
      child: matchedChild.id,
      cdc: matchedChild.cdc,
      assessment_type: form.assessment_type,
      assessment_date: form.assessment_date,
      examiner_name: form.examiner_name,
      place_administered: form.place_administered,
      child_profile: form.child_profile,
      checklist: form.checklist,
      domain_scores: {
        ...domainScores,
        scaled_scores: form.scoring.scaled_scores,
        standard_score: form.scoring.standard_score,
        interpretation: resultMeta[result].label,
      },
      score_summary: score,
      result,
      remarks: form.remarks,
      status: 'draft',
    };
    try {
      let saved;
      if (editingId) {
        saved = await api.put(`/special-needs-assessments/${editingId}/`, payload);
      } else {
        saved = await api.post('/special-needs-assessments/', payload);
        setEditingId(saved.data.id);
      }
      if (status === 'submitted') {
        await api.post(`/special-needs-assessments/${saved.data.id}/submit/`);
      }
      changes.markSaved();
      setNotice(status === 'submitted' ? 'Assessment submitted.' : 'Draft saved.');
      await loadData();
    } catch (err) {
      const responseData = err.response?.data;
      const apiError = responseData?.error
        || responseData?.detail
        || responseData?.child?.[0]
        || responseData?.non_field_errors?.[0];
      setError(apiError || 'Failed to save assessment.');
    } finally {
      setSaving('');
    }
  };

  const downloadAssessment = async (item) => {
    setError('');
    try {
      const response = await api.get(`/special-needs-assessments/${item.id}/download/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/html' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `special-needs-assessment-${item.child_name || item.id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download assessment form.');
    }
  };

  if (activeRole !== 'cdw') {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Special Needs Assessment encoding is available only to CDW users. Staff and Admin may review submitted summaries through Reports.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isForm && <Link to="/cdw/special-needs" className="inline-block font-semibold text-[#0f4b94]">Back to Assessments</Link>}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Special Needs Assessment</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{isForm ? (assessmentId ? 'View Assessment' : 'New Assessment') : 'Assessment Records'}</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">{isForm ? "ECCD Checklist, Child's Record 2" : 'Review saved assessments or start a new checklist.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Assessed', stats.total, 'bg-blue-50 text-blue-800 border-blue-200'],
              ['Drafts', stats.drafts, 'bg-slate-50 text-slate-800 border-slate-200'],
              ['Submitted', stats.submitted, 'bg-emerald-50 text-emerald-800 border-emerald-200'],
              ['Re-test', stats.needs_monitoring, 'bg-amber-50 text-amber-800 border-amber-200'],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-2xl border px-3 py-2 ${tone}`}>
                <p className="text-[11px] font-black uppercase">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</section> : null}
      {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</section> : null}

      {!isForm && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <label className="text-sm font-medium text-slate-700">Search children<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Child name" className="ml-3 rounded-xl border border-slate-200 px-3 py-2" /></label>
          <Link to={`/cdw/special-needs/new${searchParams.get('child') ? `?child=${searchParams.get('child')}` : ''}`} className="rounded-xl bg-[#0f4b94] px-4 py-3 text-sm font-semibold text-white">New Assessment</Link>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Child', 'Assessment date', 'Stage', 'Status', 'Result', ''].map((label, index) => <th key={index} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{assessments.filter(item => item.child_name.toLowerCase().includes(query.toLowerCase())).map(item => <tr key={item.id} className="border-t border-slate-100">
            <td className="px-5 py-4 font-semibold">{item.child_name}<p className="mt-1 text-xs font-normal text-slate-500">{item.cdc_name}</p></td><td className="px-5 py-4">{item.assessment_date}</td><td className="px-5 py-4">{assessmentOptions.find(option => option.value === item.assessment_type)?.label}</td><td className="px-5 py-4">{item.status_label || item.status}</td><td className="px-5 py-4">{item.status === 'draft' ? 'Provisional: ' : ''}{item.result_label || resultMeta[item.result]?.label || 'Not recorded'}</td><td className="px-5 py-4"><Link className="whitespace-nowrap font-semibold text-[#0f4b94]" to={`/cdw/special-needs/${item.id}`}>View Assessment</Link></td>
          </tr>)}</tbody>
        </table></div>
        {!loading && !assessments.some(item => item.child_name.toLowerCase().includes(query.toLowerCase())) && <p className="p-8 text-center text-sm text-slate-500">No matching assessments. Start a new assessment for an enrolled child.</p>}
      </section>}

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading...</section>
      ) : null}

      {!loading && isForm && (!assessmentId || editingId) ? (
        <div className="space-y-5">
        <div>
        {assessmentId && <div className="mb-4 flex gap-3"><button type="button" onClick={() => setEditable(!editable)} disabled={selectedChild?.current_status !== 'enrolled'} className="rounded-xl border border-blue-200 bg-white px-4 py-2 font-semibold text-[#0f4b94]">{editable ? 'View Mode' : 'Edit Assessment'}</button><button type="button" onClick={() => downloadAssessment({ id: assessmentId })} className="rounded-xl border bg-white px-4 py-2">Download</button></div>}
        <fieldset disabled={!editable} className="min-w-0">
        <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-xl font-black text-[#0f4b94]">Sociodemographic Profile</h2>
              <p className="mt-1 text-sm text-slate-500">Select an enrolled child. Available profile details are filled automatically.</p>
            </div>
            <div className="p-5">
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                {assessmentProgress.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => changeAssessmentType(item.value)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      form.assessment_type === item.value
                        ? 'border-[#0f4b94] bg-blue-50 text-[#0f4b94]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-wide">{item.label}</p>
                    <p className="mt-2 text-2xl font-black">{item.pending}</p>
                    <p className="mt-1 text-xs font-semibold opacity-75">{item.completed} completed | {item.pending} pending</p>
                  </button>
                ))}
              </div>

              <details className="mb-5 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Previous assessment progress</summary><div className="mt-3"><ChildVisualSummary summary={selectedChildSummary} /></div></details>

              <div className="grid gap-x-4 gap-y-5 md:grid-cols-3">
                <label className="block text-sm font-bold text-slate-700">Child's Name
                  <select
                    value={selectedChildId}
                    onChange={(event) => changeChildSelection(event.target.value)}
                    disabled={!childOptions.length}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="">{childOptions.length ? 'Select enrolled child' : 'No enrolled children available'}</option>
                    {childOptions.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-slate-700">Assessment
                  <select value={form.assessment_type} onChange={(event) => changeAssessmentType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2">
                    {assessmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-slate-700">Assessment Date
                  <input type="date" value={form.assessment_date} onChange={(event) => setForm((current) => ({ ...current, assessment_date: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-bold text-slate-700">Examiner / CDW Name
                  <input value={form.examiner_name} onChange={(event) => setForm((current) => ({ ...current, examiner_name: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-bold text-slate-700 md:col-span-2">Place Where Test is Administered
                  <input value={form.place_administered} onChange={(event) => setForm((current) => ({ ...current, place_administered: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
                </label>
              {[
                ['sex', 'Sex'], ['date_of_birth', 'Date of Birth'], ['address', 'Address'], ['handedness', 'Handedness'], ['presently_studying', 'Presently Studying'], ['school_name', 'School / Learning Center / Day Care'],
                ['father_name', "Father's Name"], ['father_age', "Father's Age"], ['father_occupation', "Father's Occupation"], ['father_education', "Father's Educational Attainment"],
                ['mother_name', "Mother's Name"], ['mother_age', "Mother's Age"], ['mother_occupation', "Mother's Occupation"], ['mother_education', "Mother's Educational Attainment"],
                ['siblings_count', 'Number of Siblings'], ['birth_order', 'Birth Order'],
              ].map(([key, label]) => <label key={key} className="block text-sm font-bold text-slate-700">{label}<input type={key === 'date_of_birth' ? 'date' : 'text'} value={form.child_profile[key] || ''} onChange={(event) => updateProfile(key, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>)}
              </div>
              {selectedChild ? <p className="mt-4 text-sm font-semibold text-slate-500">Linked child record: Age {selectedChild.age}, {selectedChild.cdc_name}, {selectedChild.barangay_name}, CDW {selectedChild.assigned_cdw_name}</p> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#0f4b94]">How to Administer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">There is no pass or fail score. Some questions are for older children. Do not teach or coach the child. If the child exhibits the skill or behavior, mark Present. If not, mark Unable and write comments explaining why the child was unable to demonstrate the behavior.</p>
          </section>

          {domains.map((domain) => (
            <section key={domain.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black text-[#0f4b94]">{domain.title}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  Present {domainScores[domain.key]?.raw_score || 0}/{domain.items.length} | {domainScores[domain.key]?.percent || 0}%
                </span>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-12 border-b border-slate-200 px-3 py-3">No.</th>
                      <th className="border-b border-slate-200 px-3 py-3">Material / Procedure / Checklist Item</th>
                      <th className="w-64 border-b border-slate-200 px-3 py-3">Present</th>
                      <th className="border-b border-slate-200 px-3 py-3">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                {(form.checklist[domain.key] || []).map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-200 align-top last:border-b-0">
                    <td className="px-3 py-3 font-black text-slate-400">{index + 1}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{item.label}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-3">
                        <label className="font-semibold"><input type="radio" checked={item.present === 'present'} onChange={() => updateChecklist(domain.key, item.id, 'present', 'present')} /> Present</label>
                        <label className="font-semibold"><input type="radio" checked={item.present === 'unable'} onChange={() => updateChecklist(domain.key, item.id, 'present', 'unable')} /> Unable</label>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input value={item.comments} onChange={(event) => updateChecklist(domain.key, item.id, 'comments', event.target.value)} placeholder="Comments" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </td>
                  </tr>
                ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#0f4b94]">Raw Scores, Scaled Scores, and Interpretation</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-3">Domain</th>
                    <th className="border-b border-slate-200 px-3 py-3">Raw Score</th>
                    <th className="border-b border-slate-200 px-3 py-3">Scaled Score</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <tr key={domain.key} className="border-b border-slate-200 last:border-b-0">
                      <td className="px-3 py-3 font-bold text-slate-800">{domain.title.replace(' Domain', '')}</td>
                      <td className="px-3 py-3 font-black text-slate-700">{domainScores[domain.key]?.raw_score || 0}</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="1"
                          max="19"
                          value={form.scoring.scaled_scores[domain.key] || ''}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            scoring: {
                              ...current.scoring,
                              scaled_scores: { ...current.scoring.scaled_scores, [domain.key]: event.target.value },
                            },
                          }))}
                          placeholder="1-19"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-900">Standard Score</td>
                    <td className="px-3 py-3 font-black text-slate-700" colSpan="2">
                      <input
                        type="number"
                        value={form.scoring.standard_score}
                        onChange={(event) => setForm((current) => ({ ...current, scoring: { ...current.scoring, standard_score: event.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-3 font-black text-slate-900">Interpretation</td>
                    <td className="px-3 py-3" colSpan="2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${resultMeta[result].tone}`}>{resultMeta[result].label}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Examiner Notes and Observations</p>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-black ${resultMeta[result].tone}`}>{resultMeta[result].label} | {score.percent}%</span>
              </div>
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">New Assessment</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {['child_background', 'family_environment', 'parent_stimulation', 'home_environment', 'others'].map((key) => <label key={key} className="block text-sm font-bold text-slate-700">{key.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase())}<textarea value={form.child_profile[key] || ''} onChange={(event) => updateProfile(key, event.target.value)} rows="3" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>)}
            </div>
            <textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="3" placeholder="CDW remarks and observations" className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => saveAssessment('draft')} disabled={!!saving} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-60">{saving === 'draft' ? 'Saving...' : 'Save Draft'}</button>
              <button type="button" onClick={() => saveAssessment('submitted')} disabled={!!saving} className="rounded-xl bg-[#0f4b94] px-5 py-3 text-sm font-black text-white disabled:opacity-60">{saving === 'submitted' ? 'Submitting...' : 'Submit Completed Assessment'}</button>
            </div>
          </section>
        </form>
        </fieldset></div>
        <FloatingDomainResults answered={score.scored} total={score.total}>
              {domains.map(domain => {
                const items = form.checklist[domain.key] || [];
                const answered = items.filter(item => ['present', 'unable'].includes(item.present)).length;
                const raw = domainScores[domain.key]?.raw_score || 0;
                return <div key={domain.key} className="border-b border-slate-100 pb-3">
                  <p className="text-sm font-semibold text-slate-800">{domain.title.replace(' Domain', '')}</p>
                  <div className="my-2 h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full bg-[#0f4b94]" style={{ width: `${answered / domain.items.length * 100}%` }} /></div>
                  <p className="text-xs text-slate-600">Raw score {raw} / {answered}/{domain.items.length} answered</p>
                  <p className="mt-1 text-xs text-slate-500">{answered < domain.items.length ? 'Incomplete' : `${raw} skills demonstrated; ${answered - raw} unable`}</p>
                </div>;
              })}
              <p className="text-sm font-semibold text-[#0f4b94]">{score.unscored ? 'Provisional: ' : ''}{resultMeta[result].label}</p>
              <p className="text-xs text-slate-500">Domain scores describe observed skills. Scaled and standard scores require the existing scoring reference.</p>
        </FloatingDomainResults>
        </div>
      ) : null}

      {!loading && !isForm ? (
        <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="mb-4 cursor-pointer text-lg font-semibold text-slate-950">Per-Child Assessment Progress</summary>
          <div className="grid gap-3 xl:grid-cols-2">
            {childSummaries.map((item, index) => {
              const meta = resultMeta[item.latest?.result] || resultMeta.needs_further_assessment;
              return (
                <div key={item.child.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Child {index + 1}</p>
                      <h3 className="font-black text-slate-950">{item.child.name}</h3>
                      <p className="text-xs font-semibold text-slate-500">Age {item.child.age || '-'} | {item.child.cdc_name}</p>
                    </div>
                    <span className={`h-fit rounded-full border px-3 py-1 text-xs font-black ${meta.tone}`}>{item.latest ? meta.label : 'Not started'}</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#0f4b94]" style={{ width: `${Math.max(3, item.completionPercent)}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] font-black uppercase text-slate-400">Done</p><p className="font-black">{item.submitted}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] font-black uppercase text-slate-400">Draft</p><p className="font-black">{item.draftCount}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] font-black uppercase text-slate-400">Score</p><p className="font-black">{item.averagePercent}%</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(assessmentsByChild[String(item.child.id)] || []).map((assessment) => (
                      <button key={assessment.id} type="button" onClick={() => editAssessment(assessment)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">
                        {assessmentOptions.find((option) => option.value === assessment.assessment_type)?.label || 'Assessment'}
                      </button>
                    ))}
                    {item.latest ? <button type="button" onClick={() => downloadAssessment(item.latest)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">Download Latest</button> : null}
                  </div>
                </div>
              );
            })}
            {!childSummaries.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No officially enrolled children found for this CDC.</div> : null}
          </div>
        </details>
      ) : null}

    </div>
  );
}

export default SpecialNeedsAssessmentPage;
