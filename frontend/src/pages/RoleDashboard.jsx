import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import RoleLayout from '../components/RoleLayout';
import NotificationHighlights from '../components/NotificationHighlights';
import communityHero from '../assets/community-learning-hero.png';

const roleDescriptions = {
  staff: 'Receive, review, approve, return, or reject CDW reports while maintaining CDC, enrollment, capacity, monitoring, and compliance records.',
  cho: 'Child health and nutrition coordination.',
  planning: 'Coverage data for city planning.',
};

function DashboardCard({ label, value, tone = 'blue', hint }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-2 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

function RoleDashboard({ role }) {
  const [loading, setLoading] = useState(role === 'staff');
  const [error, setError] = useState('');
  const [staffData, setStaffData] = useState({
    reports: [],
    populationFiles: [],
    snpPrograms: [],
    cdcs: [],
  });

  useEffect(() => {
    if (role !== 'staff') {
      return;
    }

    let isMounted = true;

    async function loadStaffWorkspace() {
      setLoading(true);
      setError('');

      try {
        const [reportsRes, populationRes, snpRes, cdcRes] = await Promise.all([
          api.get('/reports/'),
          api.get('/population-data/'),
          api.get('/snps/'),
          api.get('/cdcs/'),
        ]);

        if (!isMounted) {
          return;
        }

        setStaffData({
          reports: Array.isArray(reportsRes.data) ? reportsRes.data : [],
          populationFiles: Array.isArray(populationRes.data) ? populationRes.data : [],
          snpPrograms: Array.isArray(snpRes.data) ? snpRes.data : [],
          cdcs: Array.isArray(cdcRes.data) ? cdcRes.data : [],
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load staff workspace:', err);
        setError('Some staff dashboard data could not be loaded.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStaffWorkspace();

    return () => {
      isMounted = false;
    };
  }, [role]);

  const staffOverview = useMemo(() => {
    if (role !== 'staff') {
      return null;
    }

    const reports = staffData.reports || [];
    const populationFiles = staffData.populationFiles || [];
    const snpPrograms = staffData.snpPrograms || [];
    const cdcs = staffData.cdcs || [];

    const processedPopulation = populationFiles.filter(
      (item) => ['received_by_cswdo', 'current_basis'].includes(item.status)
    );
    const pendingPopulation = populationFiles.filter(
      (item) => item.status === 'sent_to_cswdo'
    );
    const accreditedCdcs = cdcs.filter((item) => item.is_accredited);
    const activeSnps = snpPrograms.filter((item) => item.is_active);

    return {
      submittedReports: reports.length,
      processedPopulationFiles: processedPopulation.length,
      pendingPopulationFiles: pendingPopulation.length,
      activePrograms: activeSnps.length,
      activeCenters: cdcs.length,
      accreditedCenters: accreditedCdcs.length,
      latestReport: reports[0] || null,
      latestPopulationFile: populationFiles[0] || null,
    };
  }, [role, staffData]);

  if (role !== 'staff') {
    return (
      <RoleLayout role={role}>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img
              src={communityHero}
              alt="Community child development workspace illustration"
              className="h-44 w-full object-cover"
            />
            <div className="p-4">
              <h2 className="text-xl font-semibold text-gray-800">Workspace Overview</h2>
              <p className="mt-1 text-sm text-gray-600">{roleDescriptions[role] || 'Your account is ready.'}</p>
            </div>
          </div>
          <NotificationHighlights compact />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout role={role}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_18px_48px_-38px_rgba(15,23,42,0.45)]">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="bg-[linear-gradient(135deg,_#f8fdff_0%,_#eef7ff_48%,_#f8fafc_100%)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">CSWDO Staff Workspace</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Staff Workspace</h2>
            </div>
            <img
              src={communityHero}
              alt="CSWDO staff workspace illustration"
              className="h-40 w-full object-cover lg:h-full"
            />
          </div>
        </section>

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <DashboardCard
            label="Submitted Reports"
            value={loading ? '...' : staffOverview?.submittedReports ?? 0}
            tone="blue"
          />
          <DashboardCard
            label="Processed Population"
            value={loading ? '...' : staffOverview?.processedPopulationFiles ?? 0}
            tone="emerald"
          />
          <DashboardCard
            label="Pending Population"
            value={loading ? '...' : staffOverview?.pendingPopulationFiles ?? 0}
            tone="amber"
          />
          <DashboardCard
            label="Active SNP"
            value={loading ? '...' : staffOverview?.activePrograms ?? 0}
            tone="violet"
          />
          <DashboardCard
            label="CDC Centers"
            value={loading ? '...' : staffOverview?.activeCenters ?? 0}
            tone="blue"
          />
          <DashboardCard
            label="Accredited"
            value={loading ? '...' : staffOverview?.accreditedCenters ?? 0}
            tone="emerald"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Work Areas</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Reports Review</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Population Monitoring</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Program Coordination</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Case Support</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Quick Actions</h3>
            <div className="mt-3 grid gap-2">
              <Link to="/staff/reports" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50">
                Review Submitted Reports
              </Link>
              <Link to="/staff/population-data" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50">
                Open Population Analytics
              </Link>
              <Link to="/staff/population-map" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50">
                View Heatmap
              </Link>
              <Link to="/staff/operations" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50">
                Monitor Program Operations
              </Link>
              <Link to="/staff/operations/special-needs" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50">
                View Special Needs Assessments
              </Link>
            </div>
          </div>
        </section>

        <NotificationHighlights title="Staff Notices" compact />

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Latest Activity</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Report</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{staffOverview?.latestReport?.title || 'No report submitted yet'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {staffOverview?.latestReport
                    ? `Submitted on ${new Date(staffOverview.latestReport.created_at || staffOverview.latestReport.submitted_on || Date.now()).toLocaleDateString()}`
                    : 'No report yet.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Population File</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{staffOverview?.latestPopulationFile?.title || 'No population file available yet'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {staffOverview?.latestPopulationFile
                    ? `Current status: ${(staffOverview.latestPopulationFile.status || 'submitted').replaceAll('_', ' ')}`
                    : 'No file yet.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Role Scope</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 px-3 py-2">Report checking and remarks</div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">CDC records and monitoring</div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">Service gaps and heatmap</div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">Admin-limited exports</div>
            </div>
          </div>
        </section>
      </div>
    </RoleLayout>
  );
}

export default RoleDashboard;
