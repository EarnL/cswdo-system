import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import FloatingReviewPanel from '../components/FloatingReviewPanel';
import { generateGrantToOperatePDF } from '../utils/pdfGenerator';
import { getRequirementStatuses, requirementLink } from '../utils/accreditationRequirements';

const statusStyles = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-amber-100 text-amber-800',
  under_evaluation: 'bg-blue-100 text-blue-800',
  needs_revision: 'bg-orange-100 text-orange-800',
  evaluated_by_staff: 'bg-cyan-100 text-cyan-800',
  forwarded_to_admin: 'bg-violet-100 text-violet-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  not_yet_eligible: 'bg-rose-100 text-rose-800',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');

function StatusBadge({ request }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusStyles[request.status] || statusStyles.draft}`}>
      {request.status_label || request.status?.replaceAll('_', ' ')}
    </span>
  );
}

function ScorePanel({ request }) {
  const percentage = Number(request?.percentage || 0);
  const eligible = percentage >= Number(request?.passing_percentage || 75);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Result</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-black text-slate-950">{percentage.toFixed(1)}%</p>
          <p className="text-sm text-slate-500">{request?.total_score || 0} / {request?.max_score || 0} points</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {request?.eligibility_result || 'Not Yet Evaluated'}
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
        title={`Accreditation score is ${percentage.toFixed(1)}%. ${eligible ? 'This meets the passing level. Action: prepare final review or approval.' : 'This is below the passing level. Action: review missing checklist items and return clear corrections.'}`}
        aria-label="Accreditation score progress"
      >
        <div className={eligible ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-rose-500'} style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Passing percentage: {Number(request?.passing_percentage || 75).toFixed(0)}%</p>
    </div>
  );
}

function computeChecklistScores(answers, checklist, passingPercentage = 75) {
  if (!checklist?.sections?.length) {
    return {
      total_score: 0,
      max_score: 0,
      percentage: 0,
      eligibility_result: 'Not Yet Evaluated',
      sections_needing_improvement: [],
    };
  }

  let totalScore = 0;
  let maxScore = Number(checklist.total_max_score || 0);
  const sectionsNeedingImprovement = [];

  checklist.sections.forEach((section) => {
    let sectionScore = 0;
    const computedSectionMax = (section.items || []).reduce((sum, item) => sum + Number(item.points || 0), 0);
    const sectionMax = Number(section.max_score || computedSectionMax || 0);
    const minimumScore = Number(section.minimum_score || ((sectionMax * passingPercentage) / 100));

    section.items.forEach((item) => {
      const points = Number(item.points || 0);
      const compliance = answers?.[item.id]?.compliance || '';

      if (['yes', 'na'].includes(compliance)) {
        totalScore += points;
        sectionScore += points;
      }
    });

    const sectionPercentage = sectionMax ? (sectionScore / sectionMax) * 100 : 0;
    if (sectionScore < minimumScore) {
      sectionsNeedingImprovement.push({
        id: section.id,
        title: section.title,
        percentage: Number(sectionPercentage.toFixed(1)),
      });
    }
  });

  if (!maxScore) {
    maxScore = checklist.sections.reduce((sum, section) => {
      const computedSectionMax = (section.items || []).reduce((sectionSum, item) => sectionSum + Number(item.points || 0), 0);
      return sum + Number(section.max_score || computedSectionMax || 0);
    }, 0);
  }
  const percentage = maxScore ? (totalScore / maxScore) * 100 : 0;
  const eligible = percentage >= passingPercentage && !sectionsNeedingImprovement.length;
  const recognition = !eligible
    ? 'Not Yet Eligible'
    : totalScore >= 201
      ? 'Level 3 Recognition - Outstanding Rating'
      : totalScore >= 180
        ? 'Level 2 Recognition - Very Satisfactory Rating'
        : 'Level 1 Recognition - Satisfactory Rating';
  return {
    total_score: Number(totalScore.toFixed(2)),
    max_score: Number(maxScore.toFixed(2)),
    percentage: Number(percentage.toFixed(2)),
    eligibility_result: recognition,
    sections_needing_improvement: sectionsNeedingImprovement,
  };
}

function getChecklistCompletion(answers, checklist) {
  const items = checklist?.sections?.flatMap((section) => section.items || []) || [];
  const answeredItems = items.filter((item) => Boolean(answers?.[item.id]?.compliance));
  return {
    complete: items.length > 0 && answeredItems.length === items.length,
    answered: answeredItems.length,
    total: items.length,
  };
}

function AccreditationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { requestId } = useParams();
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const isCDW = role === 'cdw';
  const isStaff = role === 'staff';
  const isAdmin = role === 'admin';

  const [cdcs, setCdcs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [template, setTemplate] = useState(null);
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [headerAnswers, setHeaderAnswers] = useState({});
  const [answers, setAnswers] = useState({});
  const [closingAnswers, setClosingAnswers] = useState({});
  const [staffRemarks, setStaffRemarks] = useState('');
  const [requestReview, setRequestReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const assignedQuery = isCDW ? '?assigned_to_me=true' : '';
      const [cdcRes, requestRes, templateRes] = await Promise.all([
        api.get(`/cdcs/${assignedQuery}`),
        api.get('/accreditation-requests/'),
        api.get('/accreditation-requests/checklist-template/'),
      ]);
      setCdcs(Array.isArray(cdcRes.data) ? cdcRes.data : []);
      setRequests(Array.isArray(requestRes.data) ? requestRes.data : []);
      setTemplate(templateRes.data);
    } catch (err) {
      console.error(err);
      setError('Unable to load accreditation workspace.');
    } finally {
      setLoading(false);
    }
  }, [isCDW]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRequests = useMemo(() => {
    if (isAdmin) return requests.filter((item) => ['forwarded_to_admin', 'approved', 'rejected'].includes(item.status));
    if (isStaff) return requests.filter((item) => !['approved', 'rejected'].includes(item.status));
    return requests;
  }, [isAdmin, isStaff, requests]);

  const stats = useMemo(() => ({
    submitted: requests.filter((item) => item.status === 'pending_review').length,
    pending: requests.filter((item) => item.status === 'pending_review').length,
    evaluating: requests.filter((item) => item.status === 'under_evaluation').length,
    revision: requests.filter((item) => item.status === 'needs_revision').length,
    forwarded: requests.filter((item) => item.status === 'forwarded_to_admin').length,
    approved: requests.filter((item) => item.status === 'approved').length,
  }), [requests]);

  const latestRequest = useMemo(() => (
    requests.length
      ? [...requests].sort((a, b) => new Date(b.updated_at || b.requested_at || 0) - new Date(a.updated_at || a.requested_at || 0))[0]
      : null
  ), [requests]);

  const isFocusedRequest = useCallback((request) => {
    if (notificationFocus === 'admin_accreditation_for_approval') return request.status === 'forwarded_to_admin';
    if (notificationFocus === 'cswdo_accreditation_queue') return ['pending_review', 'under_evaluation'].includes(request.status);
    if (notificationFocus === 'cdw_accreditation_followup') return ['pending_review', 'under_evaluation', 'forwarded_to_admin'].includes(request.status);
    if (notificationFocus === 'cdw_accreditation_action_needed') return ['needs_revision', 'not_yet_eligible', 'rejected'].includes(request.status);
    return false;
  }, [notificationFocus]);

  const requirementStatus = useMemo(() => getRequirementStatuses(cdcs.find(center => center.id === selected?.cdc) || cdcs[0] || {}), [cdcs, selected]);
  const readinessScore = requirementStatus.readiness;

  const activeTemplate = useMemo(() => (
    selected?.checklist_snapshot?.sections ? selected.checklist_snapshot : template
  ), [selected, template]);

  const activeItems = activeTemplate?.sections?.[activeSection]?.items || [];
  const liveScores = useMemo(() => (
    computeChecklistScores(answers, activeTemplate, selected?.passing_percentage || activeTemplate?.passing_percentage || 75)
  ), [answers, activeTemplate, selected]);
  const checklistCompletion = useMemo(() => (
    getChecklistCompletion(answers, activeTemplate)
  ), [answers, activeTemplate]);
  const displayRequest = selected && isStaff
    ? {
        ...selected,
        total_score: liveScores.total_score,
        max_score: liveScores.max_score,
        percentage: liveScores.percentage,
        eligibility_result: liveScores.eligibility_result,
        sections_needing_improvement: liveScores.sections_needing_improvement,
      }
    : selected;

  const openRequest = useCallback((request) => {
    if (isAdmin && !requestId) {
      navigate(`/admin/accreditation/${request.id}`);
      return;
    }

    setSelected(request);
    setHeaderAnswers(request.header_answers || {});
    setAnswers(request.checklist_answers || {});
    setClosingAnswers(request.closing_answers || {});
    setStaffRemarks(request.staff_remarks || '');
    setAdminRemarks(request.admin_remarks || '');
    setActiveSection(0);
    setMessage('');
    setError('');
  }, [isAdmin, navigate, requestId]);

  useEffect(() => {
    if (!notificationFocus || selected || !filteredRequests.length) return;
    const focusedRequest = filteredRequests.find(isFocusedRequest);
    if (focusedRequest) {
      if (isAdmin) {
        navigate(`/admin/accreditation/${focusedRequest.id}`);
      } else {
        openRequest(focusedRequest);
      }
    }
  }, [filteredRequests, isAdmin, isFocusedRequest, navigate, notificationFocus, openRequest, requestId, selected]);

  useEffect(() => {
    if (!isAdmin || !requestId || !filteredRequests.length) return;
    const matchedRequest = filteredRequests.find((item) => String(item.id) === String(requestId));
    if (matchedRequest && selected?.id !== matchedRequest.id) {
      openRequest(matchedRequest);
    }
  }, [filteredRequests, isAdmin, openRequest, requestId, selected]);

  const refreshSelected = (updated) => {
    setSelected(updated);
    setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const requestAccreditation = async (cdc) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/accreditation-requests/', { cdc: cdc.id, remarks });
      setRequests((current) => [response.data, ...current]);
      setRemarks('');
      setRequestReview(null);
      setMessage('Accreditation request submitted. Status is now Pending Review.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit accreditation request.');
    } finally {
      setSaving(false);
    }
  };

  const startEvaluation = async (request) => {
    setSaving(true);
    try {
      const response = await api.post(`/accreditation-requests/${request.id}/start-evaluation/`);
      refreshSelected(response.data);
      setMessage('Evaluation started.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const forwardToAdmin = async () => {
    if (!selected) return;
    if (!checklistCompletion.complete) {
      setError(`Complete all compliance fields before forwarding. ${checklistCompletion.answered}/${checklistCompletion.total} items completed.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await api.post(`/accreditation-requests/${selected.id}/save-checklist/`, {
        header_answers: headerAnswers,
        checklist_answers: answers,
        closing_answers: closingAnswers,
        staff_remarks: staffRemarks,
        status: 'evaluated_by_staff',
      });
      const response = await api.post(`/accreditation-requests/${saved.data.id}/forward-to-admin/`, { staff_remarks: staffRemarks });
      refreshSelected(response.data);
      setMessage('Evaluation forwarded to CSWDO Admin.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to forward evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const adminDecision = async (decision) => {
    if (!selected) return;
    if (decision === 'rejected' && !adminRemarks.trim()) {
      setError('Please provide a reason before rejecting the application.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/accreditation-requests/${selected.id}/admin-decision/`, { decision, remarks: adminRemarks });
      refreshSelected(response.data);
      setMessage(decision === 'approved' ? 'CDC accredited successfully.' : 'Accreditation request rejected.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit admin decision.');
    } finally {
      setSaving(false);
    }
  };

  const markNeedsRevision = async () => {
    if (!selected) return;
    if (isAdmin && !adminRemarks.trim()) {
      setError('Please provide comments before requesting a revision.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/accreditation-requests/${selected.id}/needs-revision/`, { remarks: staffRemarks || adminRemarks });
      refreshSelected(response.data);
      setMessage('Request marked as needing revision.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark needs revision.');
    } finally {
      setSaving(false);
    }
  };

  const downloadGrantToOperate = async (request = selected) => {
    if (!request || request.status !== 'approved') {
      setError('The Grant to Operate is available only after admin approval.');
      return;
    }
    setError('');
    try {
      await generateGrantToOperatePDF(request);
    } catch (err) {
      console.error(err);
      setError('Failed to generate the Grant to Operate PDF.');
    }
  };

  const setItemAnswer = (itemId, field, value) => {
    setAnswers((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {}),
        [field]: value,
      },
    }));
  };

  if (loading) {
    return <div className="rounded-lg bg-white p-8 text-sm text-slate-500">Loading accreditation workspace...</div>;
  }

  return (
    <div className="space-y-5">
      {isCDW ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="lgu-kicker">Accreditation</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">{isCDW ? 'Accreditation Requests' : 'Admin Accreditation Review'}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {isCDW
                  ? 'Submit accreditation requests for your assigned CDC and track the CSWDO review status.'
                  : 'Review staff-evaluated accreditation requests and record the final CSWDO Admin decision.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
              {[
                [isCDW ? 'Submitted' : 'Pending', stats.pending],
                [isCDW ? 'Review' : 'Evaluating', stats.evaluating],
                ['Returned', stats.revision],
                ['Admin', stats.forwarded],
                ['Approved', stats.approved],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xl font-black text-slate-900">{value}</p>
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {isAdmin && !requestId ? <header className="py-2"><p className="lgu-kicker">Programs</p><h1 className="mt-1 text-3xl font-black text-slate-950">Accreditation</h1><p className="mt-2 text-sm text-slate-500">Review requests and track decisions.</p></header> : null}

      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="lgu-alert-error">{error}</div> : null}

      {isAdmin && !requestId ? (
        <AdminReviewQueue requests={filteredRequests} onOpen={openRequest} isFocusedRequest={isFocusedRequest} />
      ) : null}

      {isAdmin && requestId ? (
        <AdminAccreditationReview
          request={selected}
          template={activeTemplate}
          adminRemarks={adminRemarks}
          setAdminRemarks={setAdminRemarks}
          saving={saving}
          onApprove={() => adminDecision('approved')}
          onReject={() => adminDecision('rejected')}
          onRevision={markNeedsRevision}
          onDownloadGrant={() => downloadGrantToOperate(selected)}
        />
      ) : null}

      {isCDW ? (
        <section className="space-y-5">
          {latestRequest?.status === 'needs_revision' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">Returned for correction</p>
              <p className="mt-1">{latestRequest.staff_remarks || latestRequest.admin_remarks || 'Please review the request and coordinate with CSWDO Staff for correction requirements.'}</p>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="lgu-kicker">Current Accreditation Request</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">{cdcs[0]?.name || 'No assigned CDC'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{cdcs[0]?.barangay_name || 'No barangay'} | CDW: {localStorage.getItem('username') || 'Current user'}</p>
                </div>
                {latestRequest ? <StatusBadge request={latestRequest} /> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-700">Not Submitted</span>}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Readiness</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{readinessScore}%</p>
                  <div
                    className="mt-2 h-2 rounded-full bg-slate-200"
                    title={`Readiness is ${readinessScore}%. ${readinessScore >= 75 ? 'The CDC looks ready for accreditation review.' : 'The CDC still needs missing documents or checklist items before review.'}`}
                    aria-label="CDC accreditation readiness progress"
                  >
                    <div className="h-2 rounded-full bg-[#0f4b94]" style={{ width: `${readinessScore}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Latest Request</p>
                  <p className="mt-2 text-sm font-black text-slate-950">{latestRequest ? `REQ-${String(latestRequest.id).padStart(4, '0')}` : 'None'}</p>
                  <p className="mt-1 text-xs text-slate-500">{latestRequest ? formatDateTime(latestRequest.requested_at) : 'Start a request below'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Result</p>
                  <p className="mt-2 text-sm font-black text-slate-950">{latestRequest?.eligibility_result || 'Not yet evaluated'}</p>
                  <p className="mt-1 text-xs text-slate-500">{latestRequest?.percentage ? `${Number(latestRequest.percentage).toFixed(1)}% score` : 'Waiting for review'}</p>
                </div>
              </div>

              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows="3"
                placeholder="Optional remarks for CSWDO Staff"
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setRequestReview(cdcs[0] || null)}
                disabled={saving || !cdcs.length}
                className="mt-3 rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Review and Submit Request
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="lgu-kicker">Readiness Checklist</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Requirements to Prepare</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{readinessScore}% Complete</span>
              </div>
              <div className="mt-4 grid gap-3">
                {requirementStatus.groups.map((group) => (
                  <Link key={group.key} to={requirementLink(cdcs[0]?.id, group.key)} className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-[#0f4b94] hover:bg-sky-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-900">{group.title}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${group.done ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {group.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <AccreditationHistory requests={filteredRequests} onOpen={openRequest} selected={selected} isFocusedRequest={isFocusedRequest} />
        </section>
      ) : !isAdmin ? (
        !selected ? (
          <RequestList requests={filteredRequests} onOpen={openRequest} selected={selected} title="Staff Review Queue" isFocusedRequest={isFocusedRequest} />
        ) : (
          <section className="space-y-4">
            <button type="button" onClick={() => setSelected(null)} className="text-sm font-black text-[#0f4b94] hover:text-[#0b3b76]">
              Back to Review Queue
            </button>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="lgu-kicker">Accreditation</p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950">CDC Accreditation Review</h1>
                  <p className="mt-1 text-sm text-slate-500">Review the CDC request and complete the accreditation checklist.</p>
                </div>
                <StatusBadge request={selected} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
              {[
                ['Pending', stats.pending],
                ['Evaluating', stats.evaluating],
                ['Returned', stats.revision],
                ['Admin', stats.forwarded],
                ['Approved', stats.approved],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  <p className="text-2xl font-black text-slate-950">{value}</p>
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="min-w-0 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-xl font-black text-slate-950">{selected.cdc_name}</h2>
                      <Link className="mt-2 inline-block font-semibold text-blue-700 underline" to={`/staff/daycare-centers/${selected.cdc}/pre-opening`}>Review pre-opening requirements</Link>
                      <p className="mt-1 text-sm text-slate-500">{selected.barangay_name} Barangay</p>
                    </div>
                    <StatusBadge request={selected} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase text-slate-500">Requested By</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selected.requested_by_name || selected.cdw_name || 'Not recorded'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase text-slate-500">Requested Date</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(selected.requested_at)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase text-slate-500">Current Status</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selected.status_label || selected.status?.replaceAll('_', ' ') || 'Pending'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase text-slate-500">Request No.</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">REQ-{String(selected.id).padStart(4, '0')}</p>
                    </div>
                  </div>
                </div>

                <AccreditationTimeline request={selected} />

                {selected.status === 'pending_review' ? (
                  <button type="button" onClick={() => startEvaluation(selected)} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Start Evaluation</button>
                ) : null}

                <ChecklistForm
                  template={activeTemplate}
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                  activeItems={activeItems}
                  headerAnswers={headerAnswers}
                  setHeaderAnswers={setHeaderAnswers}
                  answers={answers}
                  setItemAnswer={setItemAnswer}
                  closingAnswers={closingAnswers}
                  setClosingAnswers={setClosingAnswers}
                  disabled={selected.status === 'forwarded_to_admin'}
                />

                <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Remarks</span>
                  <textarea value={staffRemarks} onChange={(event) => setStaffRemarks(event.target.value)} rows="3" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <FloatingReviewPanel key={selected.id}>
                <ScorePanel request={displayRequest} />
                {displayRequest?.sections_needing_improvement?.length ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-black text-rose-900">Needs Improvement</p>
                    <div className="mt-2 space-y-2">
                      {displayRequest.sections_needing_improvement.map((section) => (
                        <div key={section.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-rose-800">
                          <span>{section.title}</span>
                          <span>{section.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black text-slate-900">Actions</p>
                  <div className={`rounded-lg border p-3 text-xs font-bold ${checklistCompletion.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    {checklistCompletion.complete
                      ? 'Checklist complete. The result will be saved when submitted.'
                      : `Complete compliance fields before submitting: ${checklistCompletion.answered}/${checklistCompletion.total}.`}
                  </div>
                  <button
                    type="button"
                    onClick={forwardToAdmin}
                    disabled={saving || !checklistCompletion.complete || selected.status === 'forwarded_to_admin'}
                    className="rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                  >
                    Submit to Admin
                  </button>
                  <button type="button" onClick={markNeedsRevision} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Return for Revision</button>
                </div>
              </FloatingReviewPanel>
            </div>
          </section>
        )
      ) : null}

      {isCDW && selected ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">{selected.cdc_name}</h2>
              <Link className="mt-2 inline-block font-semibold text-blue-700 underline" to={`/admin/daycare-centers/${selected.cdc}/pre-opening`}>Review pre-opening requirements</Link>
              <p className="text-sm text-slate-500">{selected.status_label}</p>
            </div>
            <ScorePanel request={selected} />
            {selected.status === 'approved' ? (
              <button type="button" onClick={() => downloadGrantToOperate(selected)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white">
                Download Grant to Operate
              </button>
            ) : null}
          </div>
          <div className="mt-4">
            <AccreditationTimeline request={selected} />
          </div>
        </section>
      ) : null}

      {requestReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Review Accreditation Request</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Submit accreditation request?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This request will be forwarded to CSWDO Staff for checklist evaluation. Please make sure your CDC records and supporting documents are prepared.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">CDC</p><p className="mt-1 font-bold text-slate-900">{requestReview.name}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Barangay</p><p className="mt-1 font-bold text-slate-900">{requestReview.barangay_name}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Readiness</p><p className="mt-1 font-bold text-slate-900">{readinessScore}%</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Current Status</p><p className="mt-1 font-bold text-slate-900">{requestReview.accreditation_status?.replaceAll('_', ' ') || 'Pending'}</p></div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="font-black text-blue-900">Supporting documents to prepare</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {requirementStatus.groups.map((group) => (
                  <div key={group.key} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <span>{group.title}</span>
                    <span className={group.done ? 'text-emerald-700' : 'text-rose-700'}>{group.status}</span>
                  </div>
                ))}
              </div>
            </div>
            {remarks ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">CDW Remarks</p>
                <p className="mt-1 text-sm text-slate-700">{remarks}</p>
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRequestReview(null)} className="lgu-button-secondary">Cancel</button>
              <button type="button" onClick={() => requestAccreditation(requestReview)} disabled={saving} className="lgu-button-primary">
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AccreditationHistory({ requests, onOpen, selected, isFocusedRequest = () => false }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="lgu-kicker">Accreditation History</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Previous and Current Requests</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{requests.length} requests</span>
      </div>
      {!requests.length ? (
        <div className="lgu-empty-state mt-4">
          No accreditation request has been submitted yet. Start by reviewing your CDC readiness checklist.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[860px] text-sm">
            <thead>
              <tr>
                <th>Request No.</th>
                <th>CDC</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.id} className={isFocusedRequest(item) ? 'notification-focus-ring' : selected?.id === item.id ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                  <td className="font-black text-slate-900">REQ-{String(item.id).padStart(4, '0')}</td>
                  <td><p className="font-bold text-slate-800">{item.cdc_name}</p><p className="text-xs text-slate-500">{item.barangay_name}</p></td>
                  <td>{formatDateTime(item.requested_at)}</td>
                  <td><StatusBadge request={item} /></td>
                  <td>{item.staff_evaluator_name || item.admin_approver_name || 'Pending'}</td>
                  <td className="max-w-[260px] truncate">{item.staff_remarks || item.admin_remarks || item.remarks || 'No remarks'}</td>
                  <td><button type="button" onClick={() => onOpen(item)} className="lgu-button-secondary px-3 py-2 text-xs">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminReviewQueue({ requests, onOpen, isFocusedRequest = () => false }) {
  const [view, setView] = useState('pending');
  const [search, setSearch] = useState('');
  const pending = requests.filter(request => request.status === 'forwarded_to_admin');
  const history = requests.filter(request => request.status !== 'forwarded_to_admin');
  const visible = (view === 'pending' ? pending : history).filter(request =>
    `${request.cdc_name} ${request.barangay_name} REQ-${String(request.id).padStart(4, '0')}`.toLowerCase().includes(search.toLowerCase().trim())
  );
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" aria-label="Request views">
          {[['pending', 'Awaiting decision', pending.length], ['history', 'Request history', history.length]].map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-lg px-4 py-3 text-sm font-bold transition ${view === key ? 'bg-[#0f4b94] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {label} <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5">{count}</span>
            </button>
          ))}
        </div>
        <label className="block sm:w-72"><span className="sr-only">Search requests</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search center, barangay or ID" type="search" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm" /></label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map(request => (
          <article key={request.id} className={`flex min-w-0 flex-col rounded-xl border bg-white shadow-sm ${isFocusedRequest(request) ? 'notification-focus-ring' : 'border-slate-200'}`}>
            <div className="flex-1 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-500">REQ-{String(request.id).padStart(4, '0')}</span><StatusBadge request={request} /></div>
              <h2 className="mt-4 break-words text-xl font-black text-slate-950">{request.cdc_name}</h2>
              <p className="mt-1 text-sm text-slate-500">{request.barangay_name || 'Barangay not recorded'}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div><dt className="text-xs font-bold text-slate-500">Assessment</dt><dd className="mt-1 font-black text-[#0f4b94]">{request.percentage == null ? 'Not recorded' : `${Number(request.percentage).toFixed(1)}%`}</dd><dd className="mt-1 text-xs text-slate-500">{request.eligibility_result || 'Result not recorded'}</dd></div>
                <div><dt className="text-xs font-bold text-slate-500">Staff reviewer</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{request.staff_evaluator_name || 'Not recorded'}</dd><dd className="mt-1 text-xs text-slate-500">{formatDateTime(request.staff_evaluated_at)}</dd></div>
              </dl>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <p className="text-xs text-slate-500">{view === 'pending' ? 'Submitted' : 'Decision'} ? {formatDateTime(view === 'pending' ? request.requested_at : request.final_decision_at)}</p>
              <button type="button" onClick={() => onOpen(request)} className={view === 'pending' ? 'lgu-button-primary' : 'lgu-button-secondary'}>{view === 'pending' ? 'Review Request' : 'View Details'} <span aria-hidden="true">?</span></button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{search ? 'No matching requests.' : view === 'pending' ? 'No requests awaiting your decision.' : 'No request history yet.'}</div>}
    </section>
  );
}

function AdminAccreditationReview({
  request,
  template,
  adminRemarks,
  setAdminRemarks,
  saving,
  onApprove,
  onReject,
  onRevision,
  onDownloadGrant,
}) {
  if (!request) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading accreditation request...
      </section>
    );
  }

  const canDecide = request.status === 'forwarded_to_admin';
  const supportingDocumentsPath = request.cdc ? `/admin/daycare-centers/${request.cdc}/papers` : '/admin/daycare-centers';

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Link to="/admin/accreditation" className="text-sm font-bold text-[#0f4b94] hover:text-[#0b3b76]">
          ? Back to Accreditation
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="lgu-kicker">Accreditation Review</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">{request.cdc_name}</h2>
            <p className="mt-2 text-sm text-slate-500">{request.barangay_name} Barangay | Request REQ-{String(request.id).padStart(4, '0')}</p>
          </div>
          <StatusBadge request={request} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Submitted By</p>
              <p className="mt-2 font-bold text-slate-900">{request.requested_by_name || request.cdw_name || 'Not recorded'}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(request.requested_at)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Staff Reviewer</p>
              <p className="mt-2 font-bold text-slate-900">{request.staff_evaluator_name || 'Not recorded'}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(request.staff_evaluated_at)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Recommendation</p>
              <p className="mt-2 font-bold text-slate-900">{request.eligibility_result || 'Not recorded'}</p>
              <p className="mt-1 text-xs text-slate-500">Passing: {Number(request.passing_percentage || 75).toFixed(0)}%</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="lgu-kicker">Supporting Documents</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">Records and Files</h3>
              </div>
              <Link to={supportingDocumentsPath} className="lgu-button-secondary">
                View Documents
              </Link>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Check supporting records before making a decision.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="lgu-kicker">Reviewer Remarks</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">CDW Remarks</p>
                <p className="mt-2 text-sm text-slate-700">{request.remarks || 'No CDW remarks submitted.'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Staff Remarks</p>
                <p className="mt-2 text-sm text-slate-700">{request.staff_remarks || 'No staff remarks recorded.'}</p>
              </div>
            </div>
          </div>

          <ReadOnlyChecklist request={request} template={template} />
        </div>

        <aside className="space-y-4">
          <ScorePanel request={request} />
          {request.status === 'approved' ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-900">Grant to Operate Issued</p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Certificate No. {request.certificate_number || 'Generated on approval'}
              </p>
              <button type="button" onClick={onDownloadGrant} className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white">
                Download Grant to Operate
              </button>
            </div>
          ) : null}
          {request.sections_needing_improvement?.length ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-black text-rose-900">Needs Improvement</p>
              <div className="mt-2 space-y-2">
                {request.sections_needing_improvement.map((section) => (
                  <div key={section.id} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-rose-800">
                    {section.title} - {section.percentage}%
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">Admin Comments / Decision Reason</span>
              <textarea
                value={adminRemarks}
                onChange={(event) => setAdminRemarks(event.target.value)}
                rows="5"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Enter approval notes, revision requirements, or rejection reason"
              />
            </label>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={onApprove}
                disabled={saving || !canDecide}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Approve / Grant Accreditation
              </button>
              <button
                type="button"
                onClick={onRevision}
                disabled={saving || !canDecide}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Request Revision
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={saving || !canDecide}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Reject Application
              </button>
            </div>
            {!canDecide ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                This request already has a final or returned status.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AccreditationTimeline({ request }) {
  const steps = [
    { key: 'pending_review', label: 'Submitted by CDW', done: Boolean(request?.requested_at), date: request?.requested_at },
    { key: 'under_evaluation', label: 'Received / Under Review', done: ['under_evaluation', 'evaluated_by_staff', 'forwarded_to_admin', 'approved', 'rejected', 'needs_revision'].includes(request?.status), date: request?.staff_evaluated_at },
    { key: 'evaluated_by_staff', label: 'Evaluated by Staff', done: ['evaluated_by_staff', 'forwarded_to_admin', 'approved', 'rejected'].includes(request?.status), date: request?.staff_evaluated_at },
    { key: 'forwarded_to_admin', label: 'Submitted to Admin', done: ['forwarded_to_admin', 'approved', 'rejected'].includes(request?.status), date: request?.updated_at },
    { key: 'approved', label: request?.status === 'rejected' ? 'Rejected' : 'Final Decision', done: ['approved', 'rejected'].includes(request?.status), date: request?.final_decision_at },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Status Timeline</p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div key={step.key} className="relative min-w-0">
            <div className="flex items-center">
              <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${step.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step.done ? 'OK' : index + 1}
              </span>
              {index < steps.length - 1 ? <span className={`h-1 flex-1 ${step.done ? 'bg-emerald-300' : 'bg-slate-200'}`} /> : null}
            </div>
            <p className="mt-2 text-xs font-black text-slate-900">{step.label}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{formatDateTime(step.date)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestList({ requests, onOpen, selected, title, isFocusedRequest = () => false }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="lgu-kicker">Accreditation</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{title}</h1>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{requests.length} request{requests.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-5 grid gap-3">
        {requests.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className={`w-full rounded-lg border p-4 text-left shadow-sm transition hover:border-[#0f4b94] hover:bg-sky-50 ${isFocusedRequest(item) ? 'notification-focus-ring' : selected?.id === item.id ? 'border-[#0f4b94] bg-sky-50' : 'border-slate-200 bg-white'}`}
          >
            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
              <div>
                <p className="text-lg font-black text-slate-950">{item.cdc_name}</p>
                <p className="text-sm font-semibold text-slate-500">{item.barangay_name} Barangay</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Requested By</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{item.requested_by_name || item.cdw_name || 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Date Requested</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(item.requested_at)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <StatusBadge request={item} />
                <span className="rounded-lg bg-[#0f4b94] px-3 py-2 text-xs font-black text-white">Open</span>
              </div>
            </div>
          </button>
        ))}
        {!requests.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg font-black text-slate-900">No accreditation requests yet.</p>
            <p className="mt-1 text-sm text-slate-500">Submitted CDC accreditation requests will appear here for staff review.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ChecklistForm({
  template,
  activeSection,
  setActiveSection,
  headerAnswers,
  setHeaderAnswers,
  answers,
  setItemAnswer,
  closingAnswers,
  setClosingAnswers,
  disabled,
}) {
  const [expandedDetails, setExpandedDetails] = useState({});

  if (!template) return null;

  const updateHeaderValue = (key, value) => {
    setHeaderAnswers((current) => ({ ...current, [key]: value }));
  };
  const toggleHeaderOption = (key, option) => {
    setHeaderAnswers((current) => {
      const existing = Array.isArray(current[key])
        ? current[key]
        : current[key]
          ? [current[key]]
          : [];
      const next = existing.includes(option)
        ? existing.filter((item) => item !== option)
        : [...existing, option];
      return { ...current, [key]: next };
    });
  };
  const formatAreaTitle = (section, index) => {
    const areaLetter = String.fromCharCode(65 + index);
    const cleanTitle = section.title.replace(/^(Area\s+[A-Z]\.|[IVX]+\.)\s*/i, '');
    return `Area ${areaLetter}: ${cleanTitle}`;
  };
  const toggleDetails = (itemId) => {
    setExpandedDetails((current) => ({ ...current, [itemId]: !current[itemId] }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Application Details</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {template.header_fields.map((field) => (
            <div key={field.key} className={field.type === 'multi_choice' ? 'block text-sm md:col-span-2' : 'block text-sm'}>
              <span className="mb-1 block font-bold text-slate-700">{field.label}</span>
              {field.type === 'choice' ? (
                <select
                  value={headerAnswers[field.key] || ''}
                  onChange={(event) => updateHeaderValue(field.key, event.target.value)}
                  disabled={disabled}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">Select</option>
                  {(field.options || []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : field.type === 'multi_choice' ? (
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(field.options || []).map((option) => {
                    const selectedOptions = Array.isArray(headerAnswers[field.key])
                      ? headerAnswers[field.key]
                      : headerAnswers[field.key]
                        ? [headerAnswers[field.key]]
                        : [];
                    return (
                      <label key={option} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option)}
                          onChange={() => toggleHeaderOption(field.key, option)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={headerAnswers[field.key] || ''}
                  onChange={(event) => updateHeaderValue(field.key, event.target.value)}
                  disabled={disabled}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="lgu-kicker">Accreditation Checklist</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Accreditation Checklist</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">{template.sections.length} sections</span>
        </div>

        <div className="mt-4 space-y-2">
          {template.sections.map((section, index) => {
            const expanded = activeSection === index;
            return (
              <div key={section.id} className="overflow-hidden rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveSection(expanded ? -1 : index)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${expanded ? 'bg-blue-50 text-[#0f4b94]' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
                >
                  <span className="text-sm font-black">{formatAreaTitle(section, index)}</span>
                  <span className="text-lg font-black">{expanded ? '-' : '+'}</span>
                </button>

                {expanded ? (
                  <div className="border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Requirement</th>
                            <th className="w-24 px-3 py-2">Score</th>
                            <th className="w-40 px-3 py-2">Compliance</th>
                            <th className="w-64 px-3 py-2">Remarks</th>
                            <th className="w-24 px-3 py-2 text-center">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {section.items.map((item) => (
                            <React.Fragment key={item.id}>
                              <tr>
                                <td className="px-3 py-3 font-semibold text-slate-800">{item.label}</td>
                                <td className="px-3 py-3">{item.points} pt{item.points === 1 ? '' : 's'}</td>
                                <td className="px-3 py-3">
                                  <select
                                    value={answers[item.id]?.compliance || ''}
                                    onChange={(event) => setItemAnswer(item.id, 'compliance', event.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2"
                                  >
                                    <option value="">Select</option>
                                    <option value="yes">Complied</option>
                                    <option value="no">Not Complied</option>
                                    <option value="na">N/A</option>
                                  </select>
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    value={answers[item.id]?.remarks || ''}
                                    onChange={(event) => setItemAnswer(item.id, 'remarks', event.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-lg border border-slate-300 px-2 py-2"
                                    placeholder="Remarks"
                                  />
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleDetails(item.id)}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-[#0f4b94] hover:text-[#0f4b94]"
                                  >
                                    Details
                                  </button>
                                </td>
                              </tr>
                              {expandedDetails[item.id] ? (
                                <tr>
                                  <td colSpan="5" className="bg-slate-50 px-3 py-3">
                                    <div className="grid gap-3 text-xs leading-5 text-slate-600 md:grid-cols-2">
                                      <div>
                                        <p className="font-black uppercase text-slate-500">Method</p>
                                        <p className="mt-1">{item.method || 'Not specified'}</p>
                                      </div>
                                      <div>
                                        <p className="font-black uppercase text-slate-500">Evidence</p>
                                        <p className="mt-1">{item.evidence || 'As specified in the assessment tool'}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {template.closing_fields.map((field) => (
          <label key={field.key} className={field.type === 'textarea' ? 'block md:col-span-2' : 'block'}>
            <span className="mb-1 block text-sm font-bold text-slate-700">{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea
                rows="3"
                value={closingAnswers[field.key] || ''}
                onChange={(event) => setClosingAnswers((current) => ({ ...current, [field.key]: event.target.value }))}
                disabled={disabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            ) : (
              <input
                value={closingAnswers[field.key] || ''}
                onChange={(event) => setClosingAnswers((current) => ({ ...current, [field.key]: event.target.value }))}
                disabled={disabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyChecklist({ request, template }) {
  const [activeId, setActiveId] = useState(null);
  const sections = template?.sections || [];
  const section = sections.find(item => item.id === activeId) || sections[0];
  if (!template) return null;
  const answers = request.checklist_answers || {};
  const labels = { yes: 'Complied', no: 'Not complied', na: 'Not applicable' };
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="text-xl font-black text-slate-900">Assessment Checklist</h3>
        <p className="mt-1 text-xs text-slate-500">{template.title}</p>
      </div>
      <nav aria-label="Assessment sections" className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 p-4">
        {sections.map((item, index) => <button key={item.id} type="button" aria-pressed={section?.id === item.id} onClick={() => setActiveId(item.id)} className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${section?.id === item.id ? 'border-[#0f4b94] bg-[#0f4b94] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}><span className="mr-2 opacity-70">{index + 1}.</span>{item.title}</button>)}
      </nav>
      {section ? <div className="p-5">
        <h4 className="font-black text-slate-900">{section.title}</h4>
        <div className="mt-4 divide-y divide-slate-100">
          {section.items.map(item => <article key={item.id} className="py-4 first:pt-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><p className="text-sm font-semibold text-slate-800">{item.label}</p><span className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold ${answers[item.id]?.compliance === 'yes' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{labels[answers[item.id]?.compliance] || answers[item.id]?.compliance || 'Not recorded'}</span></div>
            <p className="mt-2 text-xs text-slate-500">{item.points} pt ? {item.evidence || item.method || 'Evidence not recorded'}</p>
            {answers[item.id]?.remarks && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold">Remarks: </span>{answers[item.id].remarks}</p>}
          </article>)}
        </div>
      </div> : <p className="p-5 text-sm text-slate-500">No assessment sections recorded.</p>}
    </section>
  );
}

export default AccreditationPage;
