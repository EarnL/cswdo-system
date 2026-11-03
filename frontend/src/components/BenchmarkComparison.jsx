import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import AnalyticsInsight from './AnalyticsInsight';
import ChartInsightModal from './ChartInsightModal';

const statusClasses = {
  well_served: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
  stable: 'border border-sky-200 bg-sky-100 text-sky-800',
  needs_support: 'border border-amber-200 bg-amber-100 text-amber-800',
  no_cdc: 'border border-rose-200 bg-rose-100 text-rose-800',
};

const sortOptions = [
  { value: 'coverage', label: 'Highest coverage' },
  { value: 'unserved', label: 'Most unserved children' },
  { value: 'gap', label: 'Largest capacity gap' },
  { value: 'name', label: 'Barangay name' },
];

const filterOptions = [
  { value: 'all', label: 'All barangays' },
  { value: 'needs_support', label: 'Needs support' },
  { value: 'well_served', label: 'Well served' },
  { value: 'overlap', label: 'Overlap watchlist' },
  { value: 'no_cdc', label: 'No CDC' },
];

const formatStatus = (status) => {
  if (status === 'well_served') return 'Well served';
  if (status === 'needs_support') return 'Needs support';
  if (status === 'no_cdc') return 'No CDC';
  return 'Stable';
};

const capPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const formatPercent = (value) => `${capPercent(value).toFixed(1)}%`;

const SummaryCard = ({ label, value, hint, onOpen }) => (
  <AnalyticsInsight as="div" onOpen={onOpen} insight={{
    title: label,
    meaning: hint,
    methodology: 'This benchmark metric is generated from current CDC, enrollment, capacity, and barangay coverage analytics.',
    period: 'Current integrated system data.',
    factors: [label, String(value)],
    actions: ['Use this as a summary signal, then review barangay rows for exact locations.'],
  }} className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-600">{hint}</p>
  </AnalyticsInsight>
);

const MetricPill = ({ label, value, tone = 'default' }) => {
  const toneClass =
    tone === 'alert'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'good'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
};

const CDCMetric = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
  </div>
);

const BenchmarkComparison = () => {
  const [payload, setPayload] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('coverage');
  const [filterBy, setFilterBy] = useState('all');
  const [activeInsight, setActiveInsight] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBenchmarks() {
      setLoading(true);

      try {
        const [benchmarkResponse, locationResponse] = await Promise.all([
          api.get('/enhanced-benchmarks/'),
          api.get('/location-analytics/'),
        ]);

        if (!isMounted) {
          return;
        }

        setPayload(benchmarkResponse.data?.data || null);
        setLocationData(locationResponse.data?.data || null);
      } catch (error) {
        console.error('Failed to load enhanced benchmark analytics', error);
        if (isMounted) {
          setPayload(null);
          setLocationData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBenchmarks();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleBarangays = useMemo(() => {
    if (!payload?.barangay_rankings) {
      return [];
    }

    let rows = [...payload.barangay_rankings];

    if (filterBy === 'needs_support') {
      rows = rows.filter((row) => row.service_status === 'needs_support');
    } else if (filterBy === 'well_served') {
      rows = rows.filter((row) => row.service_status === 'well_served');
    } else if (filterBy === 'overlap') {
      rows = rows.filter((row) => row.gap_overlap_analysis?.potential_overlap_exists);
    } else if (filterBy === 'no_cdc') {
      rows = rows.filter((row) => row.service_status === 'no_cdc');
    }

    rows.sort((a, b) => {
      if (sortBy === 'name') {
        return a.barangay_info.name.localeCompare(b.barangay_info.name);
      }
      if (sortBy === 'unserved') {
        return b.summary_metrics.total_unserved - a.summary_metrics.total_unserved;
      }
      if (sortBy === 'gap') {
        return b.summary_metrics.total_capacity_gap - a.summary_metrics.total_capacity_gap;
      }
      return b.summary_metrics.overall_coverage - a.summary_metrics.overall_coverage;
    });

    return rows;
  }, [filterBy, payload, sortBy]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-600" />
      </div>
    );
  }

  if (!payload) {
    return <p className="text-sm text-red-600">Unable to load enhanced benchmark analytics.</p>;
  }

  const summary = payload.system_summary;
  const topBarangay = payload.top_performing_barangays?.[0];
  const topPriority = payload.priority_areas?.[0];
  const overlapWatch = payload.overlap_watchlist || [];
  const wellServed = payload.well_served_barangays || [];
  const coverageZones = locationData?.coverage_zones || {};

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(135deg,_rgba(15,75,148,0.08),_rgba(255,255,255,0.96)_48%,_rgba(16,185,129,0.08))] p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">Enhanced CDC Benchmark</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold text-slate-900 sm:text-4xl">
              Compare each CDC by exact barangay location, service reach, and planning pressure.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              This view ties every Child Development Center to its barangay, then compares child population,
              enrollment, capacity, sessions, served versus unserved children, and possible service gaps or overlap
              across the whole network.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="System Coverage"
                value={formatPercent(summary.system_coverage)}
                hint="Children aged 3-4 currently reached across all barangays."
                onOpen={setActiveInsight}
              />
              <SummaryCard
                label="Unserved Children"
                value={summary.total_unserved}
                hint="Children still outside current CDC service coverage."
                onOpen={setActiveInsight}
              />
              <SummaryCard
                label="Barangays Needing Support"
                value={payload.priority_areas.length}
                hint="Areas needing expansion, outreach, or more sessions."
                onOpen={setActiveInsight}
              />
              <SummaryCard
                label="Overlap Watchlist"
                value={overlapWatch.length}
                hint="Barangays with spare capacity that may indicate service overlap."
                onOpen={setActiveInsight}
              />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Best Covered Barangay</p>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">
                {topBarangay?.barangay_info?.name || 'No data yet'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {topBarangay
                  ? `${formatPercent(topBarangay.summary_metrics.overall_coverage)} coverage with ${topBarangay.summary_metrics.total_cdcs} CDCs and ${topBarangay.summary_metrics.total_unserved} unserved children.`
                  : 'Benchmark leaders will appear once barangay records are available.'}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Most Urgent Support Area</p>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">
                {topPriority?.barangay_info?.name || 'No data yet'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {topPriority
                  ? `${topPriority.summary_metrics.total_unserved} unserved children, ${topPriority.summary_metrics.total_capacity_gap} capacity gap, and ${formatPercent(topPriority.summary_metrics.overall_coverage)} coverage.`
                  : 'Priority areas will be highlighted when demand and capacity data are available.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0f4b94]">Location and Coverage Intelligence</h2>
            <p className="mt-2 text-sm text-slate-500">
              CDC mapping now reads each center by its exact barangay and groups locations by current coverage condition.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill label="Excellent Zone" value={coverageZones.excellent?.length || 0} tone="good" />
            <MetricPill label="Good Zone" value={coverageZones.good?.length || 0} tone="good" />
            <MetricPill label="Needs Attention" value={coverageZones.needs_attention?.length || 0} />
            <MetricPill label="Critical Zone" value={coverageZones.critical?.length || 0} tone="alert" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Sessions Available vs Needed</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {summary.total_sessions_available} / {summary.total_sessions_needed}
            </p>
            <p className="mt-2 text-sm text-slate-600">System-wide operating sessions compared with estimated sessions required.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Network Capacity Utilization</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{formatPercent(summary.system_capacity_utilization)}</p>
            <p className="mt-2 text-sm text-slate-600">How much of the total available CDC slots are currently being used.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Well Served Barangays</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{wellServed.length}</p>
            <p className="mt-2 text-sm text-slate-600">Barangays with strong coverage and no active capacity pressure.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0f4b94]">Barangay Service Comparison</h2>
            <p className="mt-2 text-sm text-slate-500">
              Compare barangays by child population, enrollment, capacity, sessions, and whether each CDC network is well served, stable, or under pressure.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block font-medium">Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block font-medium">Show</span>
              <select
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400"
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {visibleBarangays.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              No barangays match the current filter.
            </div>
          ) : null}

          {visibleBarangays.map((barangay, index) => (
            <AnalyticsInsight
              key={barangay.barangay_info.id}
              as="article"
              onOpen={setActiveInsight}
              insight={{
                title: `${barangay.barangay_info.name} Benchmark`,
                meaning: `${barangay.barangay_info.name} is classified as ${formatStatus(barangay.service_status)} in the current benchmark comparison.`,
                methodology: 'The benchmark compares child population, current enrollment, capacity, sessions, unserved children, and service pressure.',
                period: 'Current integrated analytics basis.',
                factors: [
                  `Coverage: ${formatPercent(barangay.summary_metrics.overall_coverage)}`,
                  `Unserved children: ${barangay.summary_metrics.total_unserved}`,
                  `Capacity gap: ${barangay.summary_metrics.total_capacity_gap}`,
                  `CDCs: ${barangay.summary_metrics.total_cdcs}`,
                ],
                actions: barangay.recommendations?.length ? barangay.recommendations.slice(0, 3) : ['Review CDC details for this barangay.'],
              }}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                      Rank {index + 1}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[barangay.service_status] || statusClasses.stable}`}>
                      {formatStatus(barangay.service_status)}
                    </span>
                    {barangay.gap_overlap_analysis?.potential_overlap_exists ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        Overlap watch
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-2xl font-bold text-slate-900">{barangay.barangay_info.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {barangay.summary_metrics.total_cdcs} CDCs serving {barangay.summary_metrics.population_children_3_4 || barangay.summary_metrics.total_population_0_5} children aged 3-4,
                    with {barangay.summary_metrics.total_enrolled} children currently served and {barangay.summary_metrics.total_unserved} still unserved.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px]">
                  <MetricPill
                    label="Coverage"
                    value={formatPercent(barangay.summary_metrics.overall_coverage)}
                    tone={barangay.summary_metrics.overall_coverage >= 95 ? 'good' : barangay.summary_metrics.overall_coverage < 70 ? 'alert' : 'default'}
                  />
                  <MetricPill
                    label="Capacity Gap"
                    value={barangay.summary_metrics.total_capacity_gap}
                    tone={barangay.summary_metrics.total_capacity_gap > 0 ? 'alert' : 'good'}
                  />
                  <MetricPill label="Capacity" value={barangay.summary_metrics.total_capacity} />
                  <MetricPill label="Sessions" value={`${barangay.summary_metrics.total_sessions_available} available`} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-4">
                <MetricPill label="Children 3-4" value={barangay.summary_metrics.population_children_3_4 || 0} />
                <MetricPill label="Preschool Age 3-4" value={barangay.summary_metrics.children_3_4} />
                <MetricPill label="Recorded Enrolled 3-4" value={barangay.summary_metrics.total_enrolled} />
                <MetricPill label="Recorded Enrolled 3-4" value={barangay.summary_metrics.recorded_enrollment_3_4} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-lg font-semibold text-slate-900">Gap and Overlap Analysis</h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <CDCMetric label="Unserved Children" value={barangay.gap_overlap_analysis.children_without_slots} />
                    <CDCMetric label="Excess Capacity" value={barangay.gap_overlap_analysis.excess_capacity} />
                    <CDCMetric label="Session Shortfall" value={barangay.gap_overlap_analysis.sessions_shortfall} />
                    <CDCMetric
                      label="Average CDC Score"
                      value={formatPercent(barangay.performance_summary.average_performance_score)}
                    />
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>Best CDC: {barangay.performance_summary.best_performing_cdc || 'No CDC data yet'}</p>
                    <p>Needs attention: {barangay.performance_summary.worst_performing_cdc || 'No CDC data yet'}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-lg font-semibold text-slate-900">Planning Recommendations</h4>
                  <div className="mt-4 space-y-3">
                    {barangay.recommendations.length > 0 ? (
                      barangay.recommendations.map((recommendation) => (
                        <div key={recommendation} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {recommendation}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        No planning recommendations yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <h4 className="text-lg font-semibold text-slate-900">CDC Details by Location</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Each center is listed with its exact barangay association, current enrollment, capacity, sessions, and service pressure.
                </p>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {barangay.cdc_analytics.map((cdc) => (
                    <div key={cdc.cdc_info.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-sky-700">CDC Location</p>
                          <h5 className="mt-2 text-xl font-bold text-slate-900">{cdc.cdc_info.location_label}</h5>
                          <p className="mt-2 text-sm text-slate-600">
                            {cdc.cdc_info.address || 'No address provided'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cdc.gaps_and_opportunities.expansion_needed ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                              Expansion flag
                            </span>
                          ) : null}
                          {cdc.gaps_and_opportunities.potential_overlap ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Overlap watch
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <CDCMetric label="Current Enrollment" value={cdc.enrollment_data.current_cdc_enrollment} />
                        <CDCMetric label="Effective Capacity" value={cdc.capacity_metrics.effective_capacity} />
                        <CDCMetric label="Sessions Per Day" value={cdc.capacity_metrics.sessions_per_day} />
                        <CDCMetric label="Served Children" value={cdc.service_coverage.served_children} />
                        <CDCMetric label="Barangay Unserved" value={cdc.service_coverage.barangay_unserved_children} />
                        <CDCMetric label="Capacity Utilization" value={formatPercent(cdc.capacity_metrics.capacity_utilization)} />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <CDCMetric label="Estimated Enrolled Age 3-4" value={cdc.enrollment_data.current_cdc_enrollment} />
                        <CDCMetric label="Estimated Enrolled Age 3-4" value={cdc.enrollment_data.estimated_enrolled_3_4} />
                        <CDCMetric label="Share of Barangay Population Served" value={formatPercent(cdc.service_coverage.share_of_barangay_population_served)} />
                        <CDCMetric label="Share of Barangay Enrollment Handled" value={formatPercent(cdc.service_coverage.share_of_barangay_enrollment_handled)} />
                      </div>
                    </div>
                  ))}

                  {barangay.cdc_analytics.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500 xl:col-span-2">
                      No CDC records are registered for this barangay yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </AnalyticsInsight>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <h2 className="text-2xl font-semibold text-[#0f4b94]">System Planning Recommendations</h2>
        <p className="mt-2 text-sm text-slate-500">
          Extra decision support added to help direct expansion, staffing, and barangay-level coordination.
        </p>
        <div className="mt-5 grid gap-3">
          {payload.system_recommendations.map((recommendation) => (
            <div key={recommendation} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {recommendation}
            </div>
          ))}
        </div>
      </section>
      <ChartInsightModal insight={activeInsight} onClose={() => setActiveInsight(null)} />
    </div>
  );
};

export default BenchmarkComparison;
