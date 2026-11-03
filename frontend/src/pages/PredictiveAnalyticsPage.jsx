import React, { useEffect, useState } from 'react';
import PredictionChart from '../components/PredictionChart';
import api from '../api';
import AnalyticsInsight from '../components/AnalyticsInsight';
import AppIcon from '../components/AppIcon';
import ChartInsightModal from '../components/ChartInsightModal';
import { LoadingState } from '../components/LoadingState';

const riskClasses = {
  unknown: 'border-slate-200 bg-slate-50 text-slate-700',
  high: 'border-rose-200 bg-rose-50 text-rose-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const formatNumber = (value) => value == null ? 'Not recorded' : Math.round(Number(value)).toLocaleString();
const basisLabel = value => ({ trend: 'Historical trend', 'constant scenario': 'Current count held steady', 'not recorded': 'No population basis' }[value] || value);
const currentUse = value => value == null ? 'Not recorded' : `${Math.min(100, Math.max(0, Number(value))).toFixed(1)}%`;
const formatPercent = (value) => value == null ? 'Not recorded' : `${Number(value).toFixed(1)}%`;

const chartColors = {
  historical: {
    border: 'rgb(37, 99, 235)',
    fill: 'rgba(37, 99, 235, 0.14)',
    fillStrong: 'rgba(37, 99, 235, 0.72)',
    point: 'rgb(96, 165, 250)',
  },
  current: {
    border: 'rgb(14, 165, 233)',
    fill: 'rgba(14, 165, 233, 0.14)',
    fillStrong: 'rgba(14, 165, 233, 0.72)',
    point: 'rgb(125, 211, 252)',
  },
  predicted: {
    border: 'rgb(124, 58, 237)',
    fill: 'rgba(124, 58, 237, 0.14)',
    fillStrong: 'rgba(124, 58, 237, 0.72)',
    point: 'rgb(167, 139, 250)',
  },
  capacity: {
    border: 'rgb(22, 163, 74)',
    fill: 'rgba(22, 163, 74, 0.14)',
    fillStrong: 'rgba(22, 163, 74, 0.72)',
    point: 'rgb(74, 222, 128)',
  },
  gap: {
    border: 'rgb(220, 38, 38)',
    fill: 'rgba(220, 38, 38, 0.14)',
    fillStrong: 'rgba(220, 38, 38, 0.76)',
    point: 'rgb(248, 113, 113)',
  },
  shortage: {
    border: 'rgb(217, 119, 6)',
    fill: 'rgba(217, 119, 6, 0.14)',
    fillStrong: 'rgba(217, 119, 6, 0.74)',
    point: 'rgb(251, 191, 36)',
  },
};



const MetricTile = ({ label, value, icon, tone = 'sky', insight, onOpen }) => (
  <AnalyticsInsight
    as="button"
    insight={insight}
    onOpen={onOpen}
    className={`predictive-metric text-left predictive-metric-${tone}`}
  >
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
    <span>
      <AppIcon name={icon} className="h-5 w-5" />
    </span>
  </AnalyticsInsight>
);

const ChartPanel = ({ title, kicker, icon, children, tone = 'cyan' }) => (
  <div className={`predictive-chart-panel predictive-chart-panel-${tone}`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{kicker}</p>
        <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
      </div>
      <span className="predictive-chart-icon">
        <AppIcon name={icon} className="h-5 w-5" />
      </span>
    </div>
    {children}
  </div>
);

function PredictiveAnalyticsPage() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeInsight, setActiveInsight] = useState(null);
  const [chartTab, setChartTab] = useState('enrollment');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    async function loadForecast() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/predictive-analytics/');
        if (isMounted) {
          setForecast(response.data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load predictive analytics:', err);
          setError('Failed to load predictive analytics.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadForecast();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = forecast?.summary || {};
  const dataBasis = forecast?.data_basis || {};
  const series = forecast?.chart_series || {};
  const allForecasts = forecast?.cdc_forecasts || [];
  const filteredForecasts = allForecasts.filter(item =>
    (riskFilter === 'all' || item.risk_level === riskFilter) &&
    `${item.cdc_name} ${item.barangay}`.toLowerCase().includes(query.trim().toLowerCase()));
  const historyLabel = item => `${item.history?.length || 0} historical records`;

  const generatedLabel = forecast?.generated_at
    ? new Date(forecast.generated_at).toLocaleString()
    : 'Latest available data';

  const recommendedActions = [
    summary.high_risk_cdcs ? `${summary.high_risk_cdcs} CDCs need a capacity review.` : 'No projected capacity overruns.',
    summary.recommended_new_slots == null ? 'Add missing capacity records to estimate slots.' : summary.recommended_new_slots ? `${summary.recommended_new_slots} extra slots projected.` : 'No extra slots projected.',
    summary.predicted_not_enrolled_total == null ? 'Complete population data to estimate the citywide gap.' : summary.predicted_not_enrolled_total ? `${summary.predicted_not_enrolled_total} potential coverage gap. Other services may serve these children.` : 'No coverage gap is projected under this scenario.',
  ];

  const forecastPeriod = series.labels?.length
    ? `${series.labels[0]} to ${series.labels[series.labels.length - 1]}`
    : `${forecast?.forecast_horizon_years || 4} forecast years`;
  const labels = series.labels || [];
  const enrollmentValues = (series.enrollment || []).map(value => value == null ? null : Math.round(value));
  const capacityGapValues = (series.capacity_gap || []).map(value => value == null ? null : Math.round(value));
  const unenrolledValues = (series.predicted_unenrolled || []).map(value => value == null ? null : Math.round(value));
  const requiredCdcValues = (series.required_cdcs || []).map(value => value == null ? null : Math.round(value));
  const enrollmentDatasets = [
    {
      label: 'Current Enrollment',
      data: labels.map((_, index) => (index === 0 ? Number(enrollmentValues[index] || 0) : null)),
      colors: chartColors.current,
      fill: false,
    },
    {
      label: 'Predicted Enrollment',
      data: enrollmentValues,
      colors: chartColors.predicted,
      fill: true,
    },
  ];
  const capacityGapDatasets = [
    {
      label: 'Projected enrollment within capacity',
      data: enrollmentValues.map((value, index) => capacityGapValues[index] == null ? null : Math.max(Number(value) - Number(capacityGapValues[index]), 0)),
      colors: chartColors.capacity,
    },
    {
      label: 'Service Gap / Shortage',
      data: capacityGapValues,
      colors: chartColors.gap,
    },
  ];
  const unenrolledDatasets = [
    {
      label: 'Projected Enrollment',
      data: enrollmentValues,
      colors: chartColors.current,
    },
    {
      label: 'Predicted Coverage Gap',
      data: unenrolledValues,
      colors: chartColors.shortage,
    },
  ];
  const demandDatasets = [
    {
      label: 'Current 30-slot equivalents',
      data: labels.map((_, index) => index === 0 ? requiredCdcValues[0] : null),
      colors: chartColors.current,
    },
    {
      label: 'Projected 30-slot equivalents',
      data: requiredCdcValues,
      colors: chartColors.predicted,
    },
  ];
  const sharedFactors = [
    'Comparable approved report periods for ages 3-4',
    'Approved barangay population history, counted once per barangay',
    'Current session-adjusted capacity and utilization',
    'Evidence score measures history availability, not prediction accuracy',
  ];

  const openMetric = insight => {
    const title = insight.title;
    const items = allForecasts.filter(item => title === 'CDCs Over Capacity'
      ? item.risk_level === 'high'
      : title === 'Extra Slots Needed' ? item.additional_slots_needed > 0 : true);
    setActiveInsight({ title, period: forecastPeriod, meaning: insight.meaning,
      findings: items.length ? items.map(item => {
        const detail = title === 'Data Availability'
          ? `${historyLabel(item)} ? ${basisLabel(item.evidence_level) || 'Not recorded'}`
          : title === 'Extra Slots Needed' ? `${formatNumber(item.additional_slots_needed)} extra slots`
          : `${formatNumber(item.projected_enrollment_final_year)} projected / ${formatNumber(item.effective_capacity)} capacity`;
        return `${item.cdc_name} (${item.barangay}) ? ${detail}`;
      }) : ['No CDCs in this group.'] });
  };

  const metricInsight = (title, meaning, factors = [], actions = []) => ({
    title,
    meaning,
    methodology: 'Predictive analytics combines latest current data with recent historical enrollment points to create a planning forecast.',
    period: `${dataBasis.academic_year || 'Current academic year'} plus recent report history.`,
    factors,
    actions,
  });

  return (
    <div className="predictive-page space-y-4">
      <section className="predictive-hero">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Predictive Analytics</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Planning Outlook</h1>
          <p className="mt-2 text-sm font-semibold text-white/75">Basis: {dataBasis.academic_year || 'Current academic year'} | Projection: {forecastPeriod}</p>
          <p className="mt-1 text-xs text-white/75">Updated {generatedLabel}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Projected Enrollment" value={formatNumber(series.enrollment?.[series.enrollment.length - 1])} icon="children" tone="slate" onOpen={openMetric} insight={metricInsight('Projected Enrollment', 'Enrollment in the final forecast year.')} />
          <MetricTile label="CDCs Over Capacity" value={summary.high_risk_cdcs || 0} icon="shield" tone="rose" onOpen={openMetric} insight={metricInsight('CDCs Over Capacity', 'Centers projected to exceed their recorded capacity in the final forecast year.')} />
          <MetricTile label="Extra Slots Needed" value={formatNumber(summary.recommended_new_slots)} icon="children" tone="sky" onOpen={openMetric} insight={metricInsight('Extra Slots Needed', 'Sum of projected shortages at individual CDCs.')} />
          <MetricTile label="Data Availability" value={`${summary.trend_supported_cdcs || 0} / ${allForecasts.length} CDCs`} icon="score" tone="slate" onOpen={openMetric} insight={metricInsight('Data Availability', 'Centers with enough comparable history for an enrollment trend. This is not prediction accuracy.')} />
        </div>
      </section>

      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState title="Generating analytics..." message="Loading forecast, risk, and planning insights." />
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="mt-1 text-xl font-black text-slate-950">Planning Priorities</h2>
              </div>

            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {recommendedActions.map((action) => (
                <AnalyticsInsight
                  key={action}
                  as="div"
                  onOpen={setActiveInsight}
                  insight={{
                    title: 'Recommended Planning Note',
                    meaning: action,
                    methodology: 'This note is generated from the forecast summary after combining current capacity, projected enrollment, and service-gap pressure.',
                    period: forecastPeriod,
                    factors: sharedFactors,
                    actions: [action],
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
                >
                  {action}
                </AnalyticsInsight>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Data and reliability</h2>
            <p className="mt-2 text-sm text-slate-600">{summary.trend_supported_cdcs || 0} of {allForecasts.length} centers have comparable enrollment trends. Population coverage: {summary.barangays_with_population_basis || 0} / {summary.total_barangays || 0} barangays.</p>
            <p className="mt-2 text-sm text-slate-600">Historical checks: {summary.validation?.held_out_periods || 0} held-out periods. Average error: {summary.validation?.mean_absolute_error_children == null ? 'Not enough history to measure' : `${summary.validation.mean_absolute_error_children} children`}.</p>
            <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-blue-700">How this is calculated</summary>
            <p className="mt-2 text-sm text-slate-600">Current enrollment + (annual historical change x years ahead). Capacity and staffing stay fixed. Resource estimates use 30 slots per session and 25 children per staff member. Demand units represent total potential population demand, not new centers needed.</p>
            <p className="mt-2 text-xs text-slate-500">Constant scenarios hold the current count unchanged. Future births, migration and new facilities are not assumed. Demand represents potential need for public CDC services.</p></details>
          </section>
          <section className="space-y-4">
            <div role="tablist" aria-label="Forecast charts" className="flex flex-wrap gap-2">
              {[['enrollment', 'Enrollment'], ['capacity', 'Capacity'], ['demand', 'Barangay Demand']].map(([key, label]) => (
                <button key={key} type="button" role="tab" id={`forecast-tab-${key}`} aria-selected={chartTab === key} aria-controls="forecast-chart-panel" onClick={() => setChartTab(key)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${chartTab === key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</button>
              ))}
            </div>
            <div id="forecast-chart-panel" role="tabpanel" aria-labelledby={`forecast-tab-${chartTab}`} className="grid gap-4 xl:grid-cols-2">
            {chartTab === 'enrollment' && <div className="xl:col-span-2">
            <ChartPanel title="Projected Enrollment" kicker="Demand curve" icon="children" tone="emerald">
              <PredictionChart
                premium
                labels={labels}
                values={enrollmentValues}
                datasets={enrollmentDatasets}
                label="Predicted Enrollment"
                insight={{
                  title: 'Projected Enrollment',
                  meaning: 'Projected enrollment estimates how many children are expected to be served by CDCs in each forecast year.',
                  methodology: 'Annual linear change from the same approved report type and seasonal period. Current enrollment is the starting point; sparse histories use a constant scenario.',
                  period: forecastPeriod,
                  factors: sharedFactors,
                  actions: ['Compare projected enrollment against effective capacity.', 'Prepare added sessions or slots for CDCs with rising gaps.', 'Review high-risk CDCs before enrollment pressure reaches the next year.'],
                }}
              />
            </ChartPanel>
            </div>}
            {chartTab === 'capacity' && <div className="xl:col-span-2">
            <ChartPanel title="Capacity Gap Forecast" kicker="Pressure curve" icon="gap" tone="rose">
              <PredictionChart
                premium
                chartType="bar"
                labels={labels}
                values={capacityGapValues}
                datasets={capacityGapDatasets}
                label="Service Gap"
                insight={{
                  title: 'Capacity Gap Forecast',
                  meaning: 'Capacity gap shows the projected number of children that may exceed current effective CDC capacity.',
                  methodology: 'Projected enrollment is compared with encoded effective capacity for each forecast year.',
                  period: forecastPeriod,
                  factors: ['Projected enrollment growth', 'Current effective capacity', 'Additional sessions needed', 'CDC risk classifications'],
                  actions: ['Prioritize CDCs with persistent gaps.', 'Review whether added sessions can absorb demand.', 'Use staffing projections to estimate caregiver support needs.'],
                }}
              />
            </ChartPanel>
            </div>}
            {chartTab === 'demand' && <>
            <ChartPanel title="Coverage Gap Forecast" kicker="Enrollment gap" icon="children" tone="amber">
              <PredictionChart
                premium
                chartType="bar"
                labels={labels}
                values={unenrolledValues}
                datasets={unenrolledDatasets}
                label="Predicted Coverage Gap"
                insight={{
                  title: 'Coverage Gap Forecast',
                  meaning: 'This estimates children who may remain outside CDC enrollment if demand pressure is not addressed.',
                  methodology: 'Each barangay population projection minus the smallest of population, projected enrollment and recorded capacity. Barangays are counted once.',
                  period: forecastPeriod,
                  factors: ['Approved ages 3-4 population', 'Recorded capacity', 'Projected CDC enrollment'],
                  actions: ['Target outreach in barangays with large projected unenrolled groups.', 'Coordinate enrollment drives before peak intake periods.', 'Check whether affected CDCs need more slots or referral support.'],
                }}
              />
            </ChartPanel>
            <ChartPanel title="Demand in 30-slot Units" kicker="Center demand" icon="building" tone="sky">
              <PredictionChart
                premium
                chartType="bar"
                labels={labels}
                values={requiredCdcValues}
                datasets={demandDatasets}
                label="Projected 30-slot equivalents"
                insight={{
                  title: 'Demand in 30-slot Units',
                  meaning: 'Potential eligible-child population expressed in 30-slot planning units. These are not recommended new center counts.',
                  methodology: 'Projected eligible population is divided by 30 and rounded up. Missing population coverage leaves totals unavailable.',
                  period: forecastPeriod,
                  factors: ['Projected eligible population', '30 slots per planning unit', 'Approved population coverage'],
                  actions: ['Use this as an early capacity planning signal.', 'Compare required CDC demand with existing center coverage.', 'Review whether demand can be met through added sessions before considering new centers.'],
                }}
              />
            </ChartPanel>
            </>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Barangay demand and future coverage</h2>
            <p className="mt-1 text-xs text-slate-500">Projected ages 3?4 population. Child counts are rounded; averages may contain decimals.</p>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100"><thead className="bg-slate-50 text-slate-600"><tr><th>Barangay</th><th>Basis</th><th>Eligible children</th><th>Projected enrollment</th><th>Capacity</th><th>Coverage gap</th><th title="Average difference between past predictions and recorded counts. Lower is better; this is not a count of individual children.">Average past error</th></tr></thead><tbody>{(forecast?.barangay_forecasts || []).map(row => { const point = row.forecast_points[row.forecast_points.length - 1]; return <tr key={row.barangay_id}><td className="font-semibold">{row.barangay}</td><td>{basisLabel(row.evidence_level)}</td><td>{formatNumber(point.eligible_children)}</td><td>{formatNumber(point.projected_enrollment)}</td><td>{formatNumber(point.capacity)}</td><td>{formatNumber(point.coverage_gap)}</td><td>{row.validation?.held_out_periods ? `${row.validation.mean_absolute_error_children} children (${row.validation.held_out_periods} periods)` : 'Not enough history'}</td></tr>; })}</tbody></table></div>
          </section>
          <section>
            <div className="predictive-table-panel">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-xl font-black text-slate-950">CDC Forecasts</h2>
                <div className="flex flex-wrap gap-2">
                  <input aria-label="Search CDC or barangay" placeholder="Search CDC or barangay..." value={query} onChange={event => setQuery(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <select aria-label="Filter by risk" value={riskFilter} onChange={event => setRiskFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="all">All risk levels</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Select a CDC for details. Projections for {labels[labels.length - 1] || 'the final forecast year'}.</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm [&_td]:leading-6">
                  <thead className="bg-slate-100 text-left text-slate-600">
                    <tr>
                      <th className="rounded-l-2xl px-4 py-3 font-semibold">CDC</th>
                      <th className="px-4 py-3 font-semibold">Current use</th>
                      <th className="px-4 py-3 font-semibold">Annual change</th>
                      <th className="px-4 py-3 font-semibold">Resources</th>
                      <th className="px-4 py-3 font-semibold">Forecast basis</th>
                      <th className="px-4 py-3 font-semibold">History</th>
                      <th className="rounded-r-2xl px-4 py-3 font-semibold">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForecasts.map((item) => (
                      <AnalyticsInsight
                        key={item.cdc_id}
                        as="tr"
                        onOpen={setActiveInsight}
                        insight={{
                          title: `${item.cdc_name} Forecast Detail`,
                          meaning: 'This row summarizes the CDC forecast, including utilization, growth, staffing and demand indicators.',
                          methodology: 'Comparable approved report periods drive enrollment; barangay population is projected separately.',
                          period: forecastPeriod,
                          factors: [
                            `Current use: ${currentUse(item.current_utilization)}${item.current_utilization > 100 ? " (over capacity)" : ""}`,
                            `Annual change: ${formatPercent(item.projected_growth_rate)} of current enrollment (not compounded)`,
                            `Additional slots: ${formatNumber(item.additional_slots_needed)}`,
                            `Forecast basis: ${item.evidence_level}`,
                          ],
                          actions: item.drivers?.length ? item.drivers : ['Review this CDC if its risk level is medium or high.'],
                        }}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <div>{item.cdc_name}</div>
                          <div className="text-xs font-normal text-slate-500">{item.barangay}</div>
                        </td>
                        <td className="px-4 py-3">{currentUse(item.current_utilization)}{item.current_utilization > 100 && <span className="mt-1 block text-xs font-semibold text-rose-700">Over capacity</span>}</td>
                        <td className="px-4 py-3">{formatPercent(item.projected_growth_rate)}</td>
                        <td className="px-4 py-3">{formatNumber(item.additional_slots_needed)} slots, {formatNumber(item.additional_staff_needed)} staff</td>
                        <td className="px-4 py-3">{basisLabel(item.evidence_level)}</td>
                        <td className="px-4 py-3">{historyLabel(item)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase ${riskClasses[item.risk_level] || riskClasses.unknown}`}>
                            {item.risk_level}
                          </span>
                        </td>
                      </AnalyticsInsight>
                    ))}
                  </tbody>
                </table>
                {!filteredForecasts.length ? (
                  <div className="lgu-empty-state mt-4">No CDCs match your search or risk filter.</div>
                ) : null}
              </div>
            </div>
          </section>
        </>
      )}
      <ChartInsightModal insight={activeInsight} onClose={() => setActiveInsight(null)} />
    </div>
  );
}

export default PredictiveAnalyticsPage;
