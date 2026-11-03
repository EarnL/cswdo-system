import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import RoleLayout from '../components/RoleLayout';
import PopulationBasisNotice from '../components/PopulationBasisNotice';
import ChildTransfers from '../components/ChildTransfers';
import NotificationHighlights from '../components/NotificationHighlights';
import AppIcon from '../components/AppIcon';
import { getRequirementStatuses, requirementLink } from '../utils/accreditationRequirements';

const fallbackSteps = [
  { key: 'basic', title: 'CDC Basic Information', done: false },
  { key: 'facility', title: 'Facility and Safety', done: false },
  { key: 'staff', title: 'Staff Requirements', done: false },
  { key: 'program', title: 'Program Readiness Records', done: false },
  { key: 'documents', title: 'Supporting Documents', done: false },
];

function getStepLink(step, cdc) {
  return requirementLink(cdc?.id, step.key);
}

function GuideStep({ step, index, cdc, locked }) {
  const card = (
    <div className={`h-full rounded-lg border p-4 transition ${step.done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-white hover:border-[#0f4b94] hover:bg-sky-50'}`}>
      <div className="flex gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${step.done ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
          {step.done ? 'OK' : index + 1}
        </span>
        <div>
          <p className={`text-sm font-black ${step.done ? 'text-emerald-900' : 'text-slate-900'}`}>{step.title || step.label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{step.done ? 'Complete' : 'Missing'}</p>
        </div>
      </div>
    </div>
  );

  if (locked) return card;
  return <Link to={getStepLink(step, cdc)}>{card}</Link>;
}

function ActionLink({ to, children, primary = false, icon = 'dashboard' }) {
  return (
    <Link
      to={to}
      className={`inline-flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-black transition ${
        primary
          ? 'bg-[#0f4b94] text-white hover:bg-[#0b3b76]'
          : 'border border-slate-200 bg-slate-50 text-slate-800 hover:border-[#0f4b94] hover:bg-sky-50'
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        <AppIcon name={icon} className="h-5 w-5 shrink-0" />
        <span className="whitespace-normal text-left leading-5">{children}</span>
      </span>
      <AppIcon name="chevronRight" className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function InfoTile({ label, value, icon = 'dashboard' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0f4b94]">
          <AppIcon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-1 truncate text-sm font-black text-slate-950">{value || 'Not set'}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-black ${className}`}>
      {children}
    </span>
  );
}

function WorkspaceSection({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SummaryCard({ label, value, hint, icon = 'dashboard', tone = 'blue', to }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-[#0f4b94]',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
    orange: 'bg-orange-50 text-orange-700',
  };
  const content = (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0f4b94]">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone] || toneClasses.blue}`}>
          <AppIcon name={icon} className="h-6 w-6" />
        </span>
        {to ? <AppIcon name="chevronRight" className="mt-1 h-4 w-4 text-[#0f4b94]" /> : null}
      </div>
      <p className="mt-4 text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value || 'Not set'}</p>
      {hint ? <p className="mt-2 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function ActiveGuideItem({ item, index }) {
  return (
    <Link to={item.to} className="rounded-lg border border-slate-200 bg-white p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50">
      <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{index + 1}</span>
        <AppIcon name={item.icon} className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-black text-slate-950">{item.title}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.text}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#0f4b94]">
        {item.action}
        <AppIcon name="chevronRight" className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function PreGrantGuideItem({ item, index }) {
  return (
    <Link to={item.to} className="rounded-lg border border-amber-200 bg-white p-4 transition hover:border-[#0f4b94] hover:bg-sky-50">
      <div className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-900">{index + 1}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AppIcon name={item.icon} className="h-4 w-4 shrink-0 text-[#0f4b94]" />
            <p className="text-sm font-black text-slate-950">{item.title}</p>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.text}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#0f4b94]">
            {item.action}
            <AppIcon name="chevronRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CDWDashboard() {
  const [assignedCdc, setAssignedCdc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem('cdwOperatingGuideCollapsed') !== 'true');

  useEffect(() => {
    let mounted = true;

    async function loadAssignedCdc() {
      setLoading(true);
      try {
        const response = await api.get('/cdcs/', { params: { assigned_to_me: true } });
        const cdcs = Array.isArray(response.data) ? response.data : [];
        if (mounted) { setAssignedCdc(cdcs.find(cdc => cdc.has_valid_grant_to_operate) || cdcs[0] || null); }
      } catch (error) {
        console.error('Failed to load assigned CDC:', error);
        if (mounted) setAssignedCdc(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAssignedCdc();
    return () => {
      mounted = false;
    };
  }, []);

  const grantStatus = assignedCdc?.grant_to_operate_status || {};
  const populationCards = (assignedCdc ? [assignedCdc] : []).map(cdc => <PopulationBasisNotice key={cdc.id} cdcId={cdc.id} onApplied={() => api.get(`/cdcs/${cdc.id}/`).then(({ data }) => {
    setAssignedCdc(current => current?.id === cdc.id ? data : current);
  }).catch(() => {})} />);
  const grantGuide = assignedCdc?.grant_to_operate_guide || {};
  const hasGrant = Boolean(assignedCdc?.has_valid_grant_to_operate);
  const requirementStatus = getRequirementStatuses(assignedCdc || {});
  const guideSteps = assignedCdc ? requirementStatus.groups : fallbackSteps;
  const missing = requirementStatus.groups.filter((item) => !item.done).map((item) => item.title);
  const actions = grantGuide.current_actions || grantStatus.current_actions || [];
  const readiness = requirementStatus.readiness;
  const statusLabel = hasGrant ? 'Grant Active' : grantGuide.title || grantStatus.label || 'Pre-Grant';
  const nextStep = grantGuide.next_step || grantStatus.next_step || 'Complete missing requirements first.';
  const docsLink = '/cdw/accreditation-requirements';
  const primaryAction = hasGrant
    ? { to: '/cdw/cdc-information', label: 'Open CDC Information', icon: 'building' }
    : { to: docsLink, label: 'Open Accreditation Requirements', icon: 'shield' };

  const capacity = assignedCdc?.effective_capacity || assignedCdc?.max_capacity || assignedCdc?.capacity_per_session || 0;
  const enrollment = assignedCdc?.current_enrollment || 0;
  const utilization = capacity ? Math.round((enrollment / capacity) * 100) : 0;
  const grantExpiresOn = grantStatus.grant_expires_on || assignedCdc?.license_expiry_date;
  const reportsDue = assignedCdc?.report_summary?.due_count || assignedCdc?.pending_reports_count || 0;
  const pendingNotices = assignedCdc?.notification_count || 0;

  const toggleGuide = () => {
    setGuideOpen((current) => {
      localStorage.setItem('cdwOperatingGuideCollapsed', current ? 'true' : 'false');
      return !current;
    });
  };

  const activeGuideItems = [
    {
      title: 'Keep CDC Information Updated',
      text: 'Update profile, contact details, schedule, and facility information.',
      action: 'Open CDC Information',
      icon: 'building',
      to: '/cdw/cdc-information',
    },
    {
      title: 'Manage Student Profiles',
      text: 'Add enrolled children and keep child records updated.',
      action: 'Open Students',
      icon: 'children',
      to: '/cdw/students',
    },
    {
      title: 'Maintain Program Records',
      text: 'Keep health, feeding, special needs, and program records updated.',
      action: 'Open Records',
      icon: 'programs',
      to: '/cdw/regular-programs',
    },
    {
      title: 'Submit Required Reports',
      text: 'Prepare monitoring and CDC reports on time.',
      action: 'Open Reports',
      icon: 'reports',
      to: '/cdw/reports',
    },
    {
      title: 'Use Learning and Program Guides',
      text: 'Review curriculum guides, LRPs, and daily program references.',
      action: 'Open Curriculum',
      icon: 'curriculum',
      to: '/cdw/curriculum-assessment',
    },
    {
      title: 'Monitor Grant and Compliance',
      text: 'Check grant validity, reminders, and required compliance updates.',
      action: 'View Compliance',
      icon: 'shield',
      to: '/cdw/accreditation-requirements',
    },
  ];

  const preGrantGuideItems = [
    {
      title: 'Complete CDC Basic Information',
      text: 'Check the CDC name, barangay, address, contact details, operating schedule, and assigned CDW.',
      action: 'Open Requirements',
      icon: 'building',
      to: docsLink,
    },
    {
      title: 'Upload Supporting Documents',
      text: 'Attach real files such as CDC photos, facility photos, staff certificates, permits, or other proof.',
      action: 'Upload Documents',
      icon: 'reports',
      to: `${docsLink}#supporting-documents`,
    },
    {
      title: 'Fill Required Record Forms',
      text: 'Prepare facility, staff, health and safety, and program readiness records for review.',
      action: 'Open Forms',
      icon: 'shield',
      to: docsLink,
    },
    {
      title: 'Submit Accreditation Request',
      text: 'When missing items are complete, send the request so CSWDO can review the CDC.',
      action: 'Request Accreditation',
      icon: 'registration',
      to: '/cdw/accreditation',
    },
    {
      title: 'Watch Notices and Remarks',
      text: 'If CSWDO returns the request, review the remarks and update only the missing items.',
      action: 'View Notices',
      icon: 'bell',
      to: '/cdw/notifications',
    },
  ];



  if (hasGrant) {
    return (
      <RoleLayout role="cdw">
        <div className="mb-5"><ChildTransfers onChanged={() => api.get(`/cdcs/${assignedCdc.id}/`).then(response => setAssignedCdc(response.data)).catch(() => {})} /></div>
        <div className="grid gap-5">
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            {loading ? (
              <p className="text-sm font-semibold text-slate-600">Checking Grant to Operate status...</p>
            ) : (
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                    <AppIcon name="shield" className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Active CDC Operations</p>
                    <h1 className="mt-1 text-2xl font-black text-emerald-950">Your CDC is ACTIVE and authorized to operate.</h1>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">Keep records updated, submit reports on time, and monitor grant validity.</p>
                  </div>
                </div>
                <Badge className="border-emerald-200 bg-white text-emerald-700">Grant Active</Badge>
              </div>
            )}
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]"><div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard label="CDC Name" value={assignedCdc?.name || 'Assigned CDC'} hint="View profile details" icon="building" to="/cdw/cdc-information" />
            <SummaryCard label="Barangay" value={assignedCdc?.barangay_name || 'No barangay'} icon="barangay" />
            <SummaryCard label="Operation Status" value="Operate Normally" hint="Authorized to serve children" icon="shield" tone="emerald" to="/cdw/cdc-information" />
            <SummaryCard label="Grant Status" value={statusLabel} hint={`Valid until ${formatDate(grantExpiresOn)}`} icon="registration" tone="violet" to="/cdw/accreditation-requirements" />
            <SummaryCard label="Current Enrollment" value={`${enrollment} / ${capacity || 'N/A'}`} hint={capacity ? `${utilization}% of capacity` : 'Capacity not set'} icon="children" tone="orange" to="/cdw/students" />
            <SummaryCard label="Reports Due" value={reportsDue} hint="Submit reports on time" icon="reports" tone={reportsDue ? 'amber' : 'emerald'} to="/cdw/cdc-reports" />
            <SummaryCard label="Pending Notices" value={pendingNotices} hint="Check important updates" icon="bell" tone={pendingNotices ? 'rose' : 'emerald'} to="/cdw/notifications" />
          </div><div id="population-update">{populationCards}</div></div>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <AppIcon name="curriculum" className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-emerald-950">Operating Guide</h2>
                  <p className="text-sm font-semibold text-emerald-900">{guideOpen ? 'Follow these steps to manage your CDC effectively.' : 'View what to do next for active CDC operations.'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleGuide}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-emerald-700 shadow-sm ring-1 ring-emerald-200"
              >
                {guideOpen ? 'Hide Guide' : 'Operating Guide - View What to Do Next'}
                <AppIcon name={guideOpen ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
              </button>
            </div>
            {guideOpen ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {activeGuideItems.map((item, index) => (
                    <ActiveGuideItem key={item.title} item={item} index={index} />
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900">
                  Tip: Keeping records updated and submitting reports on time helps maintain your CDC's good standing.
                </div>
              </>
            ) : null}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">Quick Actions</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Active CDC Tools</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                <ActionLink to="/cdw/cdc-information" icon="building">Open CDC Information</ActionLink>
                <ActionLink to="/cdw/accreditation-requirements" icon="shield">View Accreditation Requirements</ActionLink>
                <ActionLink to="/cdw/students" icon="children">Open Student Profiles</ActionLink>
                <ActionLink to="/cdw/reports" icon="reports">Open Monitoring Reports</ActionLink>
                <ActionLink to="/cdw/cdc-reports" icon="reports">Open CDC Reports</ActionLink>
                <ActionLink to="/cdw/regular-programs" icon="programs">Open Regular Programs</ActionLink>
                <ActionLink to="/cdw/curriculum-assessment" icon="curriculum">Open Curriculum Guides</ActionLink>
                <ActionLink to="/cdw/notifications" icon="bell">View Notices</ActionLink>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">Reminders</h2>
                <Link to="/cdw/notifications" className="text-xs font-black text-[#0f4b94]">View All</Link>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-black text-amber-900">Submit Reports on Time</p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">Prepare monitoring and CDC reports before deadlines.</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-black text-emerald-900">Monitor Grant Validity</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-800">Grant valid until {formatDate(grantExpiresOn)}.</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <p className="text-sm font-black text-sky-900">Keep Records Updated</p>
                  <p className="mt-1 text-xs font-semibold text-sky-800">Update children, programs, and facility records when changes happen.</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Status Notes</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Operate Normally', 'Keep Records Updated', 'Submit Reports on Time', 'Monitor Grant Validity'].map((item) => (
                  <span key={item} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">{item}</span>
                ))}
              </div>
            </section>
            <NotificationHighlights title="Recent Notices" compact />
          </div>
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout role="cdw">
        <div className="mb-5"><ChildTransfers onChanged={() => api.get(`/cdcs/${assignedCdc.id}/`).then(response => setAssignedCdc(response.data)).catch(() => {})} /></div>
      <div className="grid gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm font-semibold text-slate-600">Checking Grant to Operate status...</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="lgu-kicker">CDW Workspace</p>
                  <h1 className="mt-2 truncate text-3xl font-black text-slate-950">{assignedCdc?.name || 'Assigned CDC'}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{assignedCdc?.barangay_name || 'No barangay'}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${hasGrant ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{statusLabel}</span>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ActionLink to={primaryAction.to} primary icon={primaryAction.icon}>{primaryAction.label}</ActionLink>
                  <ActionLink to="/cdw/accreditation" icon="shield">Accreditation Request</ActionLink>
                </div>
              </div>

              <div className={`mt-5 rounded-lg border p-4 ${hasGrant ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Next Step</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{nextStep}</p>
                  </div>
                  <div className="min-w-[180px]">
                    <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-700">
                      <span>Readiness</span>
                      <span>{Math.round(readiness)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className={`h-full ${hasGrant ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]"><div className="grid gap-3 sm:grid-cols-2">
          <InfoTile label="CDC" value={assignedCdc?.name || 'No CDC assigned'} icon="building" />
          <InfoTile label="Barangay" value={assignedCdc?.barangay_name} icon="barangay" />
          <InfoTile label="Operation" value={hasGrant ? 'Approved to operate' : 'Awaiting grant'} icon="shield" />
          <InfoTile label="Readiness" value={`${Math.round(readiness)}% Complete`} icon="score" />
        </div><div id="population-update">{populationCards}</div></div>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Pre-Accreditation Guide</p>
              <h2 className="mt-1 text-xl font-black text-amber-950">What to do before the CDC can operate</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-amber-900">
                This CDC is not yet accredited and does not have authority to operate. Complete the preparation records first, then submit the accreditation request for CSWDO review.
              </p>
            </div>
            <Badge className="border-amber-200 bg-white text-amber-800">Not Yet Authorized</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {preGrantGuideItems.map((item, index) => (
              <PreGrantGuideItem key={item.title} item={item} index={index} />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="lgu-kicker">Accreditation Readiness</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Requirements</h2>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{Math.round(readiness)}% Complete</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {guideSteps.map((step, index) => (
                <GuideStep key={step.key || step.label} step={step} index={index} cdc={assignedCdc} locked={hasGrant} />
              ))}
            </div>
            {!hasGrant && missing.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {missing.map((item) => (
                  <span key={item} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-200">{item}</span>
                ))}
              </div>
            ) : null}
          </section>

          <div className="grid gap-5">
            <WorkspaceSection title="Quick Actions">
              <ActionLink to={docsLink} primary={!hasGrant} icon="shield">Accreditation Requirements</ActionLink>
              <ActionLink to="/cdw/accreditation" icon="registration">Request Accreditation</ActionLink>
              {hasGrant ? <ActionLink to="/cdw/cdc-information" primary icon="building">CDC Information</ActionLink> : null}
            </WorkspaceSection>

            <WorkspaceSection title="Records">
              {hasGrant ? (
                <>
                  <ActionLink to="/cdw/students" icon="children">Student Profiles</ActionLink>
                  <ActionLink to="/cdw/reports" icon="reports">Monitoring Reports</ActionLink>
                  <ActionLink to="/cdw/cdc-reports" icon="reports">CDC Reports</ActionLink>
                </>
              ) : (
                <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                  Records open after the Grant to Operate is approved.
                </div>
              )}
            </WorkspaceSection>

            {hasGrant ? (
              <WorkspaceSection title="Programs">
                <ActionLink to="/cdw/regular-programs" icon="programs">Regular Programs</ActionLink>
                <ActionLink to="/cdw/curriculum-assessment" icon="curriculum">Curriculum</ActionLink>
                <ActionLink to="/cdw/special-needs" icon="children">Special Needs</ActionLink>
              </WorkspaceSection>
            ) : null}
          </div>
        </div>

        {actions.length ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="lgu-kicker">Status Notes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((item) => (
                <span key={item} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">{item}</span>
              ))}
            </div>
          </section>
        ) : null}

        <NotificationHighlights title="My Priority Alerts" compact />
      </div>
    </RoleLayout>
  );
}

export default CDWDashboard;
