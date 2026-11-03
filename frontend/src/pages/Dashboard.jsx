import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import HeatmapMap from '../components/HeatmapMap';
import PerformanceTable from '../components/PerformanceTable';
import AppIcon from '../components/AppIcon';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const capPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const formatPercent = (value) => `${capPercent(value).toFixed(1)}%`;

const getPerformanceTone = (score) => {
  if (score >= 85) return { label: 'Strong network', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 70) return { label: 'Stable', className: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500' };
  if (score >= 55) return { label: 'Needs monitoring', className: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' };
  return { label: 'Needs action', className: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500' };
};

const InsightCard = ({ label, value, hint, icon, tone = 'blue', progress }) => {
  const toneMap = {
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  const barMap = {
    blue: 'bg-sky-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black leading-none text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${toneMap[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs leading-4 text-slate-500">{hint}</p>
      {progress != null ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${barMap[tone]}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
};

const ActionItem = ({ title, value, hint, tone = 'slate', to }) => {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'green'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  const content = (
    <div className={`rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-0.5 text-xs leading-4 text-slate-600">{hint}</p>
        </div>
        <span className="rounded-xl bg-white/85 px-3 py-1 text-sm font-black">{value}</span>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

const ForecastRiskTable = ({ rows = [] }) => {
  const riskStyle = {
    high: 'border-rose-200 bg-rose-50 text-rose-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-700',
    low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[880px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">CDC</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Risk</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Projected Load</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Capacity Gap</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Needed Resources</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Demand Forecast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => {
              const utilization = item.effective_capacity
                ? (Number(item.projected_enrollment_final_year || 0) / Number(item.effective_capacity || 1)) * 100
                : Number(item.current_utilization || 0);
              const visibleUtilization = capPercent(utilization);
              return (
                <tr key={item.cdc_id || `${item.cdc_name}-${index}`} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-black text-slate-950">{item.cdc_name}</p>
                        <p className="text-xs text-slate-500">{item.barangay}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <span className={`rounded-xl border px-3 py-1.5 text-xs font-black uppercase ${riskStyle[item.risk_level] || riskStyle.low}`}>
                      {item.risk_level || 'low'} | {item.risk_score || 0}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-14 text-sm font-black text-slate-950">{formatPercent(visibleUtilization)}</span>
                      <span className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className={`block h-full rounded-full ${visibleUtilization >= 100 ? 'bg-rose-500' : visibleUtilization >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${visibleUtilization}%` }}
                        />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.projected_enrollment_final_year || 0} children forecasted</p>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4 text-sm font-black text-rose-700">{item.projected_capacity_gap || 0}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">
                    {item.additional_slots_needed || 0} slots, {item.additional_staff_needed || 0} staff
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4 text-sm font-black text-slate-950">
                    {formatNumber(item.predicted_not_enrolled || 0)} may not enroll, {formatNumber(item.estimated_cdcs_required || 0)} CDCs
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">No predictive forecast rows available yet.</div>
      ) : null}
    </div>
  );
};

function Dashboard() {
  const [summary, setSummary] = useState({
    totalCdcs: 0,
    totalChildren: 0,
    totalBarangays: 0,
    avgPerformance: 0,
    pendingReports: 0,
    activeDrafts: 0,
    unreadNotifications: 0,
    reminders: [],
    recentActivity: [],
  });
  const [performanceRows, setPerformanceRows] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let active = true;

    api.get('/dashboard/', { headers })
      .then((summaryRes) => {
        if (!active) return;
        setSummary({
          totalCdcs: summaryRes.data.total_cdcs || 0,
          totalChildren: summaryRes.data.total_enrollment || 0,
          totalBarangays: summaryRes.data.total_barangays || 0,
          avgPerformance: 0,
          pendingReports: summaryRes.data.pending_reports_count || 0,
          activeDrafts: summaryRes.data.active_drafts_count || 0,
          unreadNotifications: summaryRes.data.unread_notifications_count || 0,
          reminders: summaryRes.data.reminders || [],
          recentActivity: summaryRes.data.recent_activity || [],
        });
      })
      .catch((err) => {
        if (active) console.log(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Optional panels load independently so none can delay the main summary.
    api.get('/performance/', { headers })
      .then((response) => {
        if (!active) return;
        const rows = response.data || [];
        const averageScore = rows.length
          ? rows.reduce((sum, row) => sum + Number(row.overall_score || 0), 0) / rows.length
          : 0;
        setPerformanceRows(rows);
        setSummary((current) => ({ ...current, avgPerformance: averageScore }));
      })
      .catch((err) => {
        if (active) console.log(err);
      });

    api.get('/predictive-analytics/', { headers })
      .then((response) => {
        if (active) setForecast(response.data || null);
      })
      .catch((err) => {
        if (active) console.log(err);
      });

    return () => { active = false; };
  }, []);

  const performanceTone = getPerformanceTone(summary.avgPerformance);
  const forecastSummary = forecast?.summary || {};
  const forecastRows = forecast?.cdc_forecasts || [];
  const topForecastRows = forecastRows.slice(0, 5);
  const planningSections = forecast?.planning_sections || {};
  const resourcePlanning = planningSections.staffing_projection || planningSections.resource_allocation_planning || {};
  const demandPlanning = planningSections.cdc_demand_projection || {};
  const topCenters = useMemo(
    () => [...performanceRows].sort((left, right) => Number(right.overall_score || 0) - Number(left.overall_score || 0)).slice(0, 4),
    [performanceRows]
  );
  const watchCenters = useMemo(
    () => [...performanceRows].sort((left, right) => Number(left.overall_score || 0) - Number(right.overall_score || 0)).slice(0, 3),
    [performanceRows]
  );
  const highestPriorityCount = summary.pendingReports + summary.activeDrafts + summary.unreadNotifications;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.75)]">
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Main Dashboard</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-normal sm:text-3xl">CSWDO Service Overview</h1>
              </div>
              <span className={`inline-flex w-fit rounded-xl border px-3 py-1.5 text-xs font-black ${performanceTone.className}`}>
                {performanceTone.label}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard
                label="Children Served"
                value={loading ? '...' : formatNumber(summary.totalChildren)}
                hint="Current enrollment across registered CDCs."
                icon={<AppIcon name="children" className="h-5 w-5" />}
                tone="blue"
              />
              <InsightCard
                label="CDC Centers"
                value={loading ? '...' : formatNumber(summary.totalCdcs)}
                hint={`${formatNumber(summary.totalBarangays)} barangays in the coverage network.`}
                icon={<AppIcon name="building" className="h-5 w-5" />}
                tone="green"
              />
              <InsightCard
                label="Avg Performance"
                value={loading ? '...' : formatPercent(summary.avgPerformance)}
                hint="Latest overall CDC performance signal."
                icon={<AppIcon name="score" className="h-5 w-5" />}
                tone={summary.avgPerformance >= 70 ? 'green' : 'amber'}
                progress={summary.avgPerformance}
              />
              <InsightCard
                label="Needs Attention"
                value={loading ? '...' : formatNumber(highestPriorityCount)}
                hint="Pending reports, drafts, and unread notices."
                icon={<AppIcon name="bell" className="h-5 w-5" />}
                tone={highestPriorityCount > 0 ? 'rose' : 'green'}
              />
            </div>
          </div>

          <aside className="border-t border-white/10 bg-white/[0.04] p-4 sm:p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Action Queue</p>
                <h2 className="mt-1 text-lg font-black">Needs attention</h2>
              </div>
              <Link to="/admin/reports" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-slate-100">
                Reports
              </Link>
            </div>

            <div className="mt-4 grid gap-2.5">
              <ActionItem
                title="Pending Reports"
                value={loading ? '...' : summary.pendingReports}
                hint="Missing or overdue submissions."
                tone={summary.pendingReports ? 'rose' : 'green'}
                to="/admin/reports"
              />
              <ActionItem
                title="Saved Drafts"
                value={loading ? '...' : summary.activeDrafts}
                hint="Reports started but not submitted."
                tone={summary.activeDrafts ? 'amber' : 'green'}
                to="/admin/reports"
              />
              <ActionItem
                title="Unread Notices"
                value={loading ? '...' : summary.unreadNotifications}
                hint="Recent system items for review."
                tone={summary.unreadNotifications ? 'amber' : 'green'}
                to="/admin/notifications"
              />
            </div>
          </aside>
        </div>
      </section>

      <section id="heatmap" className="scroll-mt-28">
        <HeatmapMap dashboard expandHref="/admin/coverage-map" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">Predictive Intelligence</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Planning Forecasts</h2>
          </div>
          <Link to="/admin/predictive-analytics" className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800">
            Open Predictive Analytics
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            label="High Risk CDCs"
            value={!forecast ? 'Loading…' : formatNumber(forecastSummary.high_risk_cdcs)}
            hint={!forecast ? 'Forecast is loading in the background.' : `${formatNumber(forecastSummary.medium_risk_cdcs)} medium-risk centers also need monitoring.`}
            icon={<AppIcon name="shield" className="h-5 w-5" />}
            tone={forecastSummary.high_risk_cdcs ? 'rose' : 'green'}
          />
          <InsightCard
            label="Recommended New Slots"
            value={!forecast ? 'Loading…' : formatNumber(forecastSummary.recommended_new_slots)}
            hint="Forecasted additional capacity needed."
            icon={<AppIcon name="children" className="h-5 w-5" />}
            tone="blue"
          />
          <InsightCard
            label="Additional Staff"
            value={!forecast ? 'Loading…' : formatNumber(resourcePlanning.recommended_additional_staff)}
            hint={!forecast ? 'Forecast is loading in the background.' : `${formatNumber(resourcePlanning.recommended_additional_sessions)} sessions may also be needed.`}
            icon={<AppIcon name="users" className="h-5 w-5" />}
            tone="amber"
          />
          <InsightCard
            label="CDC Demand"
            value={!forecast ? 'Loading…' : formatNumber(demandPlanning.estimated_cdcs_required || forecastSummary.estimated_cdcs_required_total)}
            hint={!forecast ? 'Forecast is loading in the background.' : `${formatNumber(demandPlanning.predicted_not_enrolled || forecastSummary.predicted_not_enrolled_total)} children may need additional enrollment support.`}
            icon={<AppIcon name="building" className="h-5 w-5" />}
            tone="slate"
          />
        </div>

        <div className="mt-4">
          {forecast ? <ForecastRiskTable rows={topForecastRows} /> : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Loading forecast details…
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Analytics Table</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">CDC Performance</h2>
            </div>
            <Link to="/admin/reports" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100">
              View reports
            </Link>
          </div>
          <div className="mt-4">
            <PerformanceTable rows={performanceRows} limit={6} compact />
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Top Centers</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Best current signals</h2>
              </div>
              <span className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{topCenters.length} shown</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {topCenters.map((row, index) => {
                const score = Number(row.overall_score || 0);
                return (
                  <div key={`${row.cdc_name || row.cdc}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-950">{row.cdc_name || row.cdc}</p>
                      <p className="text-sm font-black text-emerald-700">{formatPercent(score)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                    </div>
                  </div>
                );
              })}
              {topCenters.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No performance data yet.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-rose-700">Watchlist</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Lowest scores</h2>
              </div>
              <span className="rounded-xl bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">{watchCenters.length} shown</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {watchCenters.map((row, index) => {
                const score = Number(row.overall_score || 0);
                return (
                  <div key={`${row.cdc_name || row.cdc}-watch-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                    <div>
                      <p className="font-black text-slate-950">{row.cdc_name || row.cdc}</p>
                      <p className="text-xs text-slate-600">{row.rating || 'Needs score review'}</p>
                    </div>
                    <span className="rounded-xl bg-white px-3 py-1 text-sm font-black text-rose-700">{formatPercent(score)}</span>
                  </div>
                );
              })}
              {watchCenters.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No watchlist records yet.</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
