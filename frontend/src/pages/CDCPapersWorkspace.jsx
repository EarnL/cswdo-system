import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';

const TABS = [
  { key: 'documents', label: 'Documents', icon: 'reports' },
  { key: 'compliance', label: 'Compliance', icon: 'shield' },
  { key: 'health', label: 'Health & Safety', icon: 'nutrition' },
  { key: 'facility', label: 'Facility', icon: 'building' },
  { key: 'interaction', label: 'Observations', icon: 'children' },
  { key: 'staff', label: 'Staff & Training', icon: 'users' },
  { key: 'activity', label: 'Activity', icon: 'reports' },
];

const PAPER_TYPES = {
  authority_to_operate: { label: 'Authority to Operate' },
  permits_licenses: { label: 'Permits and Licenses' },
  staff_profiles: { label: 'Staff Profiles' },
  training_records: { label: 'Training Records' },
  child_health_records: { label: 'Child Health Records' },
  curriculum_plan: { label: 'Curriculum Plan' },
  staff_schedule: { label: 'Staff Schedule' },
  facility_assessment: { label: 'Facility Assessment' },
  interaction_observation: { label: 'Observations' },
  accreditation_request: { label: 'Accreditation Request' },
  accreditation_certificate: { label: 'Accreditation Certificate' },
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
}

function titleCase(value) {
  return value ? String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
}

function StatusBadge({ children, tone = 'slate' }) {
  const styles = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.slate}`}>{children}</span>;
}

function InfoLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-right text-sm font-bold text-slate-900">{value ?? 'Not recorded'}</span>
    </div>
  );
}

function ReadOnlyRecordCard({ title, badge, children }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {badge}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>
    </article>
  );
}

function RecordSection({ title, description, items, actionLabel, actionTo }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        {actionTo ? (
          <Link to={actionTo} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3b76]">
            {actionLabel || 'Open Form'}
            <AppIcon name="chevronRight" className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
              <StatusBadge tone={item.done ? 'emerald' : 'slate'}>{item.done ? 'Recorded' : 'Not recorded'}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SubmittedRecords({ papers, navigate }) {
  if (!papers.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
        No submitted record items yet.
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {papers.map((paper) => {
        const paperType = PAPER_TYPES[paper.paper_type] || { label: titleCase(paper.paper_type || 'Record') };
        const verified = ['approved', 'verified_by_staff', 'current', 'issued'].includes(paper.verification_status);
        const pending = ['submitted', 'under_review', 'pending_review'].includes(paper.verification_status);
        const tone = verified ? 'emerald' : pending ? 'amber' : paper.verification_status === 'needs_revision' ? 'rose' : 'slate';
        return (
          <article key={paper.id} className="flex flex-col gap-4 bg-white py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                
                <h3 className="mt-1 break-words font-semibold text-slate-950">{paper.title || paperType.label}</h3>
                {paper.title && <p className="mt-1 text-xs text-slate-500">{paperType.label}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-500">Submitted {formatDate(paper.date_submitted)}</p>
              </div>
              <StatusBadge tone={tone}>{titleCase(paper.verification_status || 'draft')}</StatusBadge>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={() => navigate(paper.detailPath)} className="rounded-lg bg-[#0f4b94] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0b3b76]">
                View details
              </button>
              {paper.file && <a href={paper.file} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Open file</a>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CDCPapersWorkspace() {
  const { cdcId } = useParams();
  const navigate = useNavigate();
  const [cdc, setCdc] = useState(null);
  const [papers, setPapers] = useState([]);
  const [activeTab, setActiveTab] = useState('documents');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const role = localStorage.getItem('role');
  const roleBase = role === 'cdw' ? '/cdw' : role === 'staff' ? '/staff/daycare-centers' : '/admin/daycare-centers';
  const profilePath = role === 'cdw' ? `/cdw/cdc-information/${cdcId}` : `${roleBase}/${cdcId}`;

  const formsPath = role === 'cdw' ? `/cdw/papers/${cdcId}/forms` : `${roleBase}/${cdcId}/papers/forms`;
  const curriculumPath = role === 'cdw' ? '/cdw/curriculum-assessment' : role === 'staff' ? '/staff/curriculum-assessment' : '/admin/curriculum-assessment';

  useEffect(() => {
    let live = true;
    const rows = async (url) => {
      const result = [];
      while (url) {
        const response = await api.get(url);
        result.push(...(Array.isArray(response.data) ? response.data : response.data.results || []));
        url = Array.isArray(response.data) ? null : response.data.next;
      }
      return result.filter((item) => String(item.cdc) === String(cdcId));
    };
    const loadData = async () => {
      setLoading(true); setError('');
      const results = await Promise.allSettled([
        api.get(`/cdcs/${cdcId}/`),
        rows(`/reports/?cdc=${cdcId}&include_history=true`),
        rows(`/authority-documents/?cdc=${cdcId}`),
        rows(`/permit-records/?cdc=${cdcId}`),
      ]);
      if (!live) return;
      const [center, reports, authorities, permits] = results;
      setCdc(center.status === 'fulfilled' ? center.value.data : null);
      const reportPath = (id) => role === 'cdw' ? `/cdw/reports/submissions/${id}` : `/${role === 'staff' ? 'staff' : 'admin'}/reports/cdc/${cdcId}/forms/${id}`;
      const compliancePath = role === 'cdw' ? `/cdw/cdc-information/${cdcId}` : `/${role === 'staff' ? 'staff' : 'admin'}/daycare-centers/${cdcId}`;
      const records = [
        ...(reports.status === 'fulfilled' ? reports.value.map((item) => ({ id: `report-${item.id}`, title: item.title || item.report_type_label, paper_type: item.report_type, verification_status: item.status, date_submitted: item.submitted_on, detailPath: reportPath(item.id), file: item.pdf_attachment || item.attachment })) : []),
        ...(authorities.status === 'fulfilled' ? authorities.value.map((item) => ({ id: `authority-${item.id}`, title: item.title || titleCase(item.document_type), paper_type: item.document_type, verification_status: item.is_current ? 'current' : 'expired', date_submitted: item.created_at, detailPath: compliancePath, file: item.file })) : []),
        ...(permits.status === 'fulfilled' ? permits.value.map((item) => ({ id: `permit-${item.id}`, title: `${titleCase(item.permit_type)} Permit`, paper_type: 'permits_licenses', verification_status: item.status, date_submitted: item.created_at, detailPath: compliancePath, file: item.inspection_report_file })) : []),
      ];
      setPapers(records.sort((a, b) => new Date(b.date_submitted || 0) - new Date(a.date_submitted || 0)));
      setPage(1);
      const failed = results.map((result, index) => result.status === 'rejected' ? ['center information', 'reports', 'authority documents', 'permits'][index] : null).filter(Boolean);
      if (failed.length) setError(`Could not load ${failed.join(', ')}. Other available records are shown below.`);
      setLoading(false);
    };
    loadData();
    return () => { live = false; };
  }, [cdcId, role, attempt]);

  const submittedByType = useMemo(() => {
    return papers.reduce((groups, paper) => {
      const key = paper.paper_type || 'other';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }, [papers]);

  const filteredPapers = papers.filter((paper) => (status === 'all' || (paper.verification_status || 'draft') === status) && `${PAPER_TYPES[paper.paper_type]?.label || titleCase(paper.paper_type)} ${paper.title || ''}`.toLowerCase().includes(query.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading records and documents...</p>
      </div>
    );
  }

  const latestAuthority = cdc?.latest_authority_document;
  const latestPermit = cdc?.latest_permit_record;
  const latestEvaluation = cdc?.latest_annual_evaluation;
  const latestVisit = cdc?.latest_supervisory_visit;
  const grantStatus = cdc?.grant_to_operate_status || {};
  const latestPaper = [...papers].sort((a, b) => new Date(b.date_submitted || 0) - new Date(a.date_submitted || 0))[0];

  const healthItems = [
    { label: 'Child Health Records', description: 'Health check-up and child-specific health screening records.', done: Boolean(cdc?.latest_child_health_record || submittedByType.child_health_records) },
    { label: 'Emergency Readiness', description: 'First aid kit, emergency plan, exits, drill, and readiness notes.', done: Boolean(cdc?.latest_emergency_readiness) },
    { label: 'Safety Incident', description: 'Incident reports, injury notes, follow-up, and referral details.', done: Boolean(cdc?.latest_safety_incident) },
    { label: 'Child Protection Review', description: 'Child protection policy, referral contacts, and safe conduct checks.', done: Boolean(cdc?.latest_child_protection_record) },
  ];
  const facilityItems = [
    { label: 'Physical Environment Assessment', description: 'Building condition, room area, utilities, sanitation, and safety support.', done: Boolean(cdc?.latest_physical_environment_assessment || submittedByType.facility_assessment) },
    { label: 'Utilities and Safety Checks', description: 'Water, toilet/sanitation, electricity, ventilation, and exits.', done: Boolean(cdc?.physical_environment_snapshot?.has_assessment) },
    { label: 'Facility Notes', description: 'Classroom area, building type, concerns, and follow-up notes.', done: Boolean(cdc?.physical_environment_snapshot?.has_assessment) },
    { label: 'Facility Photos / Attachments', description: 'Supporting photos and files for facility condition.', done: Boolean(papers.some((paper) => /facility|photo/i.test(`${paper.paper_type} ${paper.title || ''}`))) },
  ];
  const interactionItems = [
    { label: 'Observation Details', description: 'Observation date, observer, session, and classroom context.', done: Boolean(cdc?.latest_interaction_observation) },
    { label: 'Staff-Child Interaction', description: 'Supportive communication and positive guidance observations.', done: Boolean(cdc?.interaction_snapshot?.has_observation) },
    { label: 'Child-Child Interaction', description: 'Peer interaction, inclusion, independence, and routines.', done: Boolean(cdc?.interaction_snapshot?.has_observation) },
    { label: 'Findings and Follow-up Notes', description: 'CSWDO observation findings and next steps.', done: Boolean(cdc?.latest_interaction_observation?.follow_up_notes) },
  ];
  const staffItems = [
    { label: 'Staff Profile', description: 'Assigned CDW and staff profile information.', done: Boolean(cdc?.latest_staff_profile) },
    { label: 'Training Record', description: 'Training, certificate, and qualification records.', done: Boolean(cdc?.latest_staff_training_record) },
    { label: 'Qualification Documents', description: 'Education, eligibility, certifications, and supporting files.', done: Boolean(cdc?.staffing_snapshot?.qualified_staff_profiles) },
    { label: 'Duty Assignment', description: 'Staff schedule, teacher count, assistant count, and duty setup.', done: Boolean(cdc?.latest_staff_schedule) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 cdc-document-workspace">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><Link to={profilePath} className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy"><AppIcon name="chevronLeft" className="h-4 w-4" />Back to center</Link><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Records and Documents</h1><p className="mt-2 text-sm text-slate-500">{cdc?.name || 'CDC'} / {cdc?.barangay_name || 'Barangay not recorded'}</p></div>
        <Link to={formsPath} className="lgu-button-primary"><AppIcon name="upload" className="mr-2 h-4 w-4" />Open record forms</Link>
      </header>
      {error && <div role="alert" className="lgu-alert-error">{error}<button type="button" onClick={() => setAttempt(attempt + 1)} className="ml-3 font-semibold underline">Retry</button></div>}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm">
        {[['Documents', papers.length], ['Verified', papers.filter((p) => ['approved', 'verified_by_staff', 'verified'].includes(p.verification_status)).length], ['Pending review', papers.filter((p) => ['submitted', 'under_review', 'pending_review'].includes(p.verification_status)).length], ['Needs revision', papers.filter((p) => p.verification_status === 'needs_revision').length]].map(([label, value]) => <span key={label} className="text-slate-500">{label} <strong className="ml-2 font-semibold text-slate-900">{value}</strong></span>)}
      </div>
      <nav aria-label="Record categories" className="rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-[#0f4b94] ring-1 ring-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AppIcon name={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-5">
        <div className="grid gap-5">
          {activeTab === 'compliance' ? (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Compliance Summary</h2>
                    <p className="mt-1 text-sm text-slate-500">Accreditation and grant records.</p>
                  </div>
                  <StatusBadge tone={grantStatus.has_valid_grant ? 'emerald' : 'slate'}>{grantStatus.has_valid_grant ? 'Grant active' : titleCase(grantStatus.stage || cdc?.accreditation_status)}</StatusBadge>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <ReadOnlyRecordCard
                    title="Authority to Operate"
                    badge={<StatusBadge tone={latestAuthority?.is_current ? 'emerald' : 'slate'}>{latestAuthority ? (latestAuthority.is_current ? 'Approved' : 'Expired') : 'Not yet available'}</StatusBadge>}
                  >
                    <InfoLine label="Document Type" value={latestAuthority ? titleCase(latestAuthority.document_type) : 'Waiting for approved accreditation result'} />
                    <InfoLine label="Document Number" value={latestAuthority?.document_number} />
                    <InfoLine label="Date Issued" value={formatDate(latestAuthority?.issued_on)} />
                    <InfoLine label="Valid Until" value={formatDate(latestAuthority?.expires_on)} />
                    <InfoLine label="Source" value={latestAuthority ? 'Accreditation Result' : 'Waiting for approved accreditation result'} />
                    <InfoLine label="Status" value={latestAuthority ? (latestAuthority.is_current ? 'Active' : 'Expired') : 'Not yet available'} />
                  </ReadOnlyRecordCard>
                  <ReadOnlyRecordCard
                    title="Permit Record"
                    badge={<StatusBadge tone={latestPermit?.is_active ? 'emerald' : 'slate'}>{latestPermit ? (latestPermit.is_active ? 'Active' : titleCase(latestPermit.status)) : 'Not yet available'}</StatusBadge>}
                  >
                    <InfoLine label="Permit Type" value={latestPermit ? titleCase(latestPermit.permit_type) : 'Waiting for approved accreditation result'} />
                    <InfoLine label="Permit Number" value={cdc?.license_number || latestPermit?.id ? cdc?.license_number : ''} />
                    <InfoLine label="Date Issued" value={formatDate(latestPermit?.issued_on)} />
                    <InfoLine label="Valid Until" value={formatDate(latestPermit?.expires_on)} />
                    <InfoLine label="Source" value={latestPermit ? 'Grant to Operate' : 'Waiting for approved accreditation result'} />
                    <InfoLine label="Status" value={latestPermit ? titleCase(latestPermit.status) : 'Not yet available'} />
                  </ReadOnlyRecordCard>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4"><Link to={profilePath} className="text-sm font-medium text-brand-navy">View accreditation source &rarr;</Link><button type="button" onClick={() => setActiveTab('documents')} className="text-sm font-medium text-brand-navy">View documents &rarr;</button><p className="w-full text-xs text-slate-500">Add compliance notes through supporting documents or monitoring reports.</p></div>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <ReadOnlyRecordCard title="Annual Evaluation" badge={<StatusBadge tone={latestEvaluation ? 'emerald' : 'slate'}>{latestEvaluation ? titleCase(latestEvaluation.readiness_status) : 'No evaluation record yet'}</StatusBadge>}>
                  <InfoLine label="School Year" value={latestEvaluation?.school_year || 'No evaluation record yet'} />
                  <InfoLine label="Evaluation Date" value={formatDate(latestEvaluation?.evaluation_date)} />
                  <InfoLine label="Source" value={latestEvaluation ? 'CSWDO assessment result' : 'Waiting for submitted records'} />
                </ReadOnlyRecordCard>
                <ReadOnlyRecordCard title="Supervisory Visit" badge={<StatusBadge tone={latestVisit ? 'emerald' : 'slate'}>{latestVisit ? titleCase(latestVisit.status) : 'No supervisory visit recorded yet'}</StatusBadge>}>
                  <InfoLine label="Visit Date" value={formatDate(latestVisit?.visit_date)} />
                  <InfoLine label="Supervisor" value={latestVisit?.supervisor_name || 'No supervisory visit recorded yet'} />
                  <InfoLine label="Source" value={latestVisit ? 'Monitoring or CSWDO review' : 'Waiting for submitted records'} />
                </ReadOnlyRecordCard>
              </section>
            </>
          ) : null}

          {activeTab === 'health' ? (
            <RecordSection
              title="Health & Safety Records"
              description="Child health, emergency readiness, safety incident, and child protection records."
              items={healthItems}
              actionLabel="Open Health & Safety Forms"
              actionTo={`${formsPath}#health-safety-form`}
            />
          ) : null}

          {activeTab === 'facility' ? (
            <RecordSection
              title="Facility & Environment"
              description="Physical environment, utilities, building condition, classroom area, notes, and facility attachments."
              items={facilityItems}
              actionLabel="Open Facility Forms"
              actionTo={`${formsPath}#facility-assessment-form`}
            />
          ) : null}

          {activeTab === 'interaction' ? (
            <RecordSection
              title="Interaction Observation"
              description="Observation details, staff-child interaction, child-child interaction, observed practices, findings, and follow-up notes."
              items={interactionItems}
              actionLabel="Open Observation Forms"
              actionTo={`${formsPath}#interaction-observation-form`}
            />
          ) : null}

          {activeTab === 'staff' ? (
            <>
              <RecordSection
                title="Staff & Training"
                description="Staff profile, training records, qualification documents, certificates, and duty assignments."
                items={staffItems}
                actionLabel="Open Staff & Training Forms"
                actionTo={`${formsPath}#staff-training-form`}
              />
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Staff details</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoLine label="Assigned CDW" value={cdc?.assigned_cdw_name || 'Not assigned'} />
                  <InfoLine label="CDC Name" value={cdc?.name} />
                  <InfoLine label="Barangay" value={cdc?.barangay_name} />
                  <InfoLine label="Operating Schedule" value={[cdc?.operating_days, cdc?.operating_hours].filter(Boolean).join(' | ')} />
                </div>
              </section>
            </>
          ) : null}

          {activeTab === 'activity' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Record Activity</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                <ReadOnlyRecordCard title="CDC Record Created">
                  <InfoLine label="Created" value={formatDateTime(cdc?.created_at)} />
                  <InfoLine label="By" value="System record" />
                </ReadOnlyRecordCard>
                <ReadOnlyRecordCard title="Last Updated">
                  <InfoLine label="Updated" value={formatDateTime(cdc?.updated_at)} />
                  <InfoLine label="Record" value={cdc?.name} />
                </ReadOnlyRecordCard>
                <ReadOnlyRecordCard title="Recent Related Report">
                  <InfoLine label="Record" value={latestPaper ? (PAPER_TYPES[latestPaper.paper_type]?.label || titleCase(latestPaper.paper_type)) : 'No related report yet'} />
                  <InfoLine label="Date" value={formatDateTime(latestPaper?.date_submitted)} />
                </ReadOnlyRecordCard>
                <ReadOnlyRecordCard title="Recent Record Changes">
                  <InfoLine label="Status" value={latestPaper ? titleCase(latestPaper.verification_status || 'submitted') : 'No record changes yet'} />
                  <InfoLine label="Updated" value={formatDateTime(latestPaper?.date_verified || latestPaper?.date_submitted)} />
                </ReadOnlyRecordCard>
              </div>
            </section>
          ) : null}

          {activeTab === 'documents' && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Submitted documents</h2><span className="text-xs text-slate-500">{filteredPapers.length} results</span></div>
            <div className="my-5 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Search documents</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search documents" className="login-field" /></label><div aria-label="Document status" className="flex flex-wrap gap-2">{['all', ...new Set(papers.map((paper) => paper.verification_status || 'draft'))].map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-lg px-3 py-2 text-xs font-medium ${status === value ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>{value === 'all' ? 'All statuses' : titleCase(value)}</button>)}</div></div>
            {filteredPapers.length ? <SubmittedRecords papers={filteredPapers.slice((page - 1) * 8, page * 8)} navigate={navigate}  /> : <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{papers.length ? 'No documents match your search.' : error ? 'Document list is incomplete. Retry to load unavailable records.' : 'No submitted documents yet.'}</p>}
            {filteredPapers.length > 8 && <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="lgu-button-secondary">Previous</button><span className="text-xs text-slate-500">{page} / {Math.ceil(filteredPapers.length / 8)}</span><button type="button" disabled={page * 8 >= filteredPapers.length} onClick={() => setPage(page + 1)} className="lgu-button-secondary">Next</button></div>}
          </section>}

        </div>

        <div className="flex flex-wrap gap-5 text-sm"><Link to={formsPath} className="font-medium text-brand-navy">All record forms &rarr;</Link><Link to={curriculumPath} className="font-medium text-brand-navy">Curriculum &rarr;</Link></div>
      </div>
    </div>
  );
}

export default CDCPapersWorkspace;
