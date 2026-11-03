import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { buildProgramCards, statusClasses } from '../data/programDefinitions';

const normalizeList = (payload) => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

const resultTone = {
  no_concern: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_monitoring: 'bg-amber-50 text-amber-700 border-amber-200',
  needs_further_assessment: 'bg-orange-50 text-orange-700 border-orange-200',
  for_referral: 'bg-sky-50 text-sky-700 border-sky-200',
};

const daycareProgramGuides = {
  preschool: {
    overview: 'Preschool Program focuses on early learning, school readiness, classroom routines, social skills, and basic literacy and numeracy preparation.',
    cdcTitle: 'CDCs Offering Preschool Program',
    reportTitle: 'Related Preschool Program Reports',
    reportKeywords: ['preschool', 'pre-k', 'prek', 'pre k', 'school readiness'],
    lrps: [
      { label: 'LRP 1 - General Curriculum Guide', url: '/curriculum/LRP-1-28-pages-in-all.pdf' },
      { label: 'LRP 2 - Standards, Competencies, and Learning Domains', url: '/curriculum/LRP-2-35-pages-in-all.pdf' },
      { label: 'LRP 4 - Pre-K Routine Activities', url: '/curriculum/LRP-4-18-pages-in-all.pdf' },
      { label: 'LRP 5 - Pre-K1 Activities', url: '/curriculum/LRP-5-Q1-267-pages-in-all.pdf' },
      { label: 'LRP 6 - Pre-K2 Activities', url: '/curriculum/LRP-6-Q2-285-pages-in-all.pdf' },
      { label: 'LRP 7 - Songs, Rhymes, Poems, and Creative Activities', url: '/curriculum/LRP-7-123-pages-in-all.pdf' },
      { label: 'LRP 8 - Family Support Program', url: '/curriculum/LRP-8-221-pages-in-all.pdf' },
    ],
  },
};

const compactDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString();
};

const programReportText = (report) => {
  const payloadText = typeof report.payload === 'string' ? report.payload : JSON.stringify(report.payload || {});
  return [
    report.title,
    report.summary,
    report.report_type_label,
    report.report_type,
    payloadText,
  ].filter(Boolean).join(' ').toLowerCase();
};

function EnrolledChildrenTag() {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
      For enrolled children
    </span>
  );
}

function ReadOnlyTag() {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
      Monitoring only
    </span>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

function ProgramGuideMonitoring({ program, reports }) {
  const guide = daycareProgramGuides[program.id];
  const cdcItems = program.items;
  const cdcIds = new Set(cdcItems.map((item) => String(item.source?.id || '').trim()).filter(Boolean));
  const relatedReports = reports
    .filter((report) => {
      const reportCdcId = String(report.cdc || '').trim();
      const text = programReportText(report);
      const isSameProgramCdc = reportCdcId && cdcIds.has(reportCdcId);
      const mentionsProgram = guide.reportKeywords.some((keyword) => text.includes(keyword));
      const isCdcSummary = ['cdc_monthly_report', 'cdc_quarterly_report', 'cdc_annual_report'].includes(report.report_type);
      return isSameProgramCdc && (mentionsProgram || isCdcSummary);
    })
    .sort((a, b) => new Date(b.submitted_on || 0) - new Date(a.submitted_on || 0));

  const barangayCount = new Set(cdcItems.map((item) => item.barangay)).size;
  const totalEnrollment = cdcItems.reduce((sum, item) => sum + Number(item.source?.current_enrollment || 0), 0);
  const totalCapacity = cdcItems.reduce((sum, item) => sum + Number(item.source?.max_capacity || item.source?.effective_capacity || 0), 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">CDCs</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{cdcItems.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Barangays</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{barangayCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Enrollment</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{totalEnrollment}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Capacity</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{totalCapacity}</p>
        </div>
      </section>

      <section className="program-record-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Program Overview</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{program.title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{guide.overview}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnrolledChildrenTag />
            <ReadOnlyTag />
          </div>
        </div>
      </section>

      <section className="program-record-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Curriculum Implementation Guide</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Related Learning Resource Packages</h2>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{guide.lrps.length} LRPs</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {guide.lrps.map((lrp) => (
            <a
              key={lrp.label}
              href={lrp.url}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black leading-5 text-sky-800 transition hover:border-[#0f4b94] hover:bg-white hover:text-[#0f4b94] hover:shadow-sm"
              title={`Open ${lrp.label}`}
            >
              <span>{lrp.label}</span>
              <AppIcon name="externalLink" className="h-4 w-4 shrink-0 opacity-70 transition group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </section>

      <section className="program-record-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">CDC Monitoring</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{guide.cdcTitle}</h2>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{cdcItems.length} shown</span>
        </div>

        {cdcItems.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">CDC Name</th>
                  <th className="px-3 py-3">Barangay</th>
                  <th className="px-3 py-3">Assigned CDW</th>
                  <th className="px-3 py-3">Current Enrollment</th>
                  <th className="px-3 py-3">Capacity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Tag</th>
                </tr>
              </thead>
              <tbody>
                {cdcItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-black text-slate-900">{item.cdcName}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{item.barangay}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{item.source?.assigned_cdw_name || 'Not assigned'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.source?.current_enrollment || 0}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.source?.max_capacity || item.source?.effective_capacity || 0}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses(item.status)}`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-3"><EnrolledChildrenTag /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState>No CDCs are currently marked as offering this program.</EmptyState>
          </div>
        )}
      </section>

      <section className="program-record-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Submitted CDC Reports</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{guide.reportTitle}</h2>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{relatedReports.length} reports</span>
        </div>

        {relatedReports.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Report Title</th>
                  <th className="px-3 py-3">CDC Name</th>
                  <th className="px-3 py-3">Submitted By</th>
                  <th className="px-3 py-3">Date Submitted</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Tag</th>
                </tr>
              </thead>
              <tbody>
                {relatedReports.map((report) => (
                  <tr key={report.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-black text-slate-900">{report.title || report.report_type_label || 'CDC Summary Report'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{report.cdc_name || 'Unassigned CDC'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{report.submitted_by_name || 'Unknown'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">{compactDate(report.submitted_on)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses(report.status_label || report.status)}`}>
                        {report.status_label || report.status || 'Submitted'}
                      </span>
                    </td>
                    <td className="px-3 py-3"><EnrolledChildrenTag /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState>No submitted CDC summary reports are connected to this program yet.</EmptyState>
          </div>
        )}
      </section>
    </div>
  );
}

function groupSpecialNeedsByCdc(items) {
  const groups = new Map();
  items.forEach((item) => {
    const cdcKey = item.source?.cdc || item.source?.cdc_name || item.barangay || 'unknown';
    const group = groups.get(cdcKey) || {
      id: cdcKey,
      cdcName: item.source?.cdc_name || item.barangay || 'Unassigned CDC',
      barangay: item.source?.barangay_name || 'No barangay',
      items: [],
      counts: { submitted: 0, draft: 0, no_concern: 0, needs_monitoring: 0, needs_further_assessment: 0, for_referral: 0 },
    };
    group.items.push(item);
    group.counts[item.source?.status || 'draft'] = (group.counts[item.source?.status || 'draft'] || 0) + 1;
    group.counts[item.source?.result || 'needs_further_assessment'] = (group.counts[item.source?.result || 'needs_further_assessment'] || 0) + 1;
    groups.set(cdcKey, group);
  });
  return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length || a.cdcName.localeCompare(b.cdcName));
}

function AdminProgramDetailPage() {
  const { programId } = useParams();
  const location = useLocation();
  const [program, setProgram] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const notificationFocus = new URLSearchParams(location.search).get('notification_focus') || '';
  const isFocusedProgram = programId === 'feeding' && notificationFocus.includes('feeding');
  const activeRole = localStorage.getItem('role') || 'admin';
  const programBasePath = activeRole === 'staff' ? '/staff/operations' : '/admin/programs';

  useEffect(() => {
    let isMounted = true;

    async function loadProgram() {
      setLoading(true);
      setError('');

      try {
        const [cdcRes, snpRes, feedingRes, specialNeedsRes, healthRecordsRes, reportsRes] = await Promise.allSettled([
          api.get('/cdcs/'),
          api.get('/snps/'),
          api.get('/feeding-programs/'),
          api.get('/special-needs-assessments/'),
          api.get('/child-health-records/'),
          api.get('/reports/'),
        ]);

        if (!isMounted) return;
        const cards = buildProgramCards({
          cdcs: cdcRes.status === 'fulfilled' ? normalizeList(cdcRes.value.data) : [],
          snpPrograms: snpRes.status === 'fulfilled' ? normalizeList(snpRes.value.data) : [],
          feedingPrograms: feedingRes.status === 'fulfilled' ? normalizeList(feedingRes.value.data) : [],
          specialNeedsAssessments: specialNeedsRes.status === 'fulfilled' ? normalizeList(specialNeedsRes.value.data) : [],
          childHealthRecords: healthRecordsRes.status === 'fulfilled' ? normalizeList(healthRecordsRes.value.data) : [],
        });
        setProgram(cards.find((card) => card.id === programId) || null);
        setReports(reportsRes.status === 'fulfilled' ? normalizeList(reportsRes.value.data) : []);
      } catch (err) {
        console.log(err);
        if (isMounted) setError('Failed to load program records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgram();
    return () => {
      isMounted = false;
    };
  }, [programId]);

  if (loading) {
    return <div className="lgu-card text-sm font-semibold text-slate-500">Loading program records...</div>;
  }

  if (error || !program) {
    return (
      <div className="lgu-card">
        <p className="text-sm font-semibold text-rose-700">{error || 'Program not found.'}</p>
        <Link to={programBasePath} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0f4b94]">
          <AppIcon name="chevronLeft" className="h-4 w-4" />
          Back to Programs
        </Link>
      </div>
    );
  }

  return (
    <div className="program-detail-page space-y-4">
      <section className={`program-detail-hero ${isFocusedProgram ? 'notification-focus-ring' : ''}`}>
        <img src={program.image} alt={`${program.title} program`} />
        <div className="program-detail-hero-overlay" />
        <div className="program-detail-hero-content">
          <Link to={programBasePath} className="inline-flex items-center gap-2 text-sm font-bold text-white/85 hover:text-white">
            <AppIcon name="chevronLeft" className="h-4 w-4" />
            Back to Programs
          </Link>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-white/75">{program.subtitle}</p>
            <h1 className="mt-2 text-3xl font-black text-white">{program.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-white/78">{program.description}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="program-detail-stat">
              <span>Records</span>
              <strong>{program.count}</strong>
            </div>
            <div className="program-detail-stat">
              <span>Barangays</span>
              <strong>{program.barangayCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {daycareProgramGuides[program.id] ? (
        <ProgramGuideMonitoring program={program} reports={reports} />
      ) : program.id === 'special-needs' ? (
        <section className="program-record-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Grouped by CDC</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Assessment Results Summary</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Each CDC shows child assessment results and quick counts for monitoring.</p>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{groupSpecialNeedsByCdc(program.items).length} CDCs</span>
          </div>

          <div className="mt-4 grid gap-4">
            {groupSpecialNeedsByCdc(program.items).map((group) => (
              <article key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{group.cdcName}</h3>
                    <p className="text-sm font-semibold text-slate-500">{group.barangay}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-2 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Total</p><p className="font-black">{group.items.length}</p></div>
                    <div className="rounded-xl bg-white px-3 py-2 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Submitted</p><p className="font-black">{group.counts.submitted || 0}</p></div>
                    <div className="rounded-xl bg-white px-3 py-2 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Monitoring</p><p className="font-black">{group.counts.needs_monitoring || 0}</p></div>
                    <div className="rounded-xl bg-white px-3 py-2 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Review</p><p className="font-black">{group.counts.needs_further_assessment || 0}</p></div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {group.items.map((item) => (
                    <Link key={item.id} to={`${programBasePath}/${program.id}/${item.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-200 hover:bg-sky-50">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-black text-slate-950">{item.source?.child_name || item.cdcName}</p>
                          <p className="text-xs font-semibold text-slate-500">Age {item.source?.child_age || '-'} | {item.source?.assessment_date || 'No date'} | {item.source?.assessment_type || 'assessment'}</p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${resultTone[item.source?.result] || resultTone.needs_further_assessment}`}>
                          {item.source?.result_label || item.source?.result || 'No result'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </article>
            ))}
            {!program.items.length ? <div className="lgu-empty-state">No special needs assessment records were found yet.</div> : null}
          </div>
        </section>
      ) : (
      <section className={`program-record-panel ${isFocusedProgram ? 'notification-focus-ring' : ''}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">CDW Submitted Records</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Program Results</h2>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{program.items.length} shown</span>
        </div>

        {program.items.length === 0 ? (
          <div className="mt-4 lgu-empty-state">
            {program.id === 'health'
              ? 'No health check-up records yet. Once CDW users save child health check-ups, CDC summaries will appear here.'
              : 'No barangay or CDC records were found for this program yet.'}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {program.items.map((item) => (
              <Link key={item.id} to={`${programBasePath}/${program.id}/${item.id}`} className={`program-record-card block ${isFocusedProgram && item.status === 'Needs review' ? 'notification-focus-ring' : ''}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-950">{item.cdcName}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{item.barangay}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClasses(item.status)}`}>{item.status}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-[#0f4b94]">
                      View full info <AppIcon name="chevronRight" className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {[item.infoA, item.infoB, item.infoC].map((info, index) => (
                    <div key={`${item.id}-${index}`} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Info {index + 1}</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{info}</p>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}

export default AdminProgramDetailPage;
