import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../api';
import AnalyticsInsight from './AnalyticsInsight';
import ChartInsightModal from './ChartInsightModal';
import { describeSelectedBar, getExtremes, simpleFinding, sliceInsight } from '../utils/chartInsights';

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip
);

const capPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const formatNumber = (value) => Number(value || 0).toLocaleString();
const getCdcName = (row) => row.cdc_name || row.cdc || row.name || 'CDC';

const palette = {
  blue: '#2563eb',
  blueSoft: 'rgba(37, 99, 235, 0.76)',
  cyan: '#0891b2',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#334155',
  grid: 'rgba(148, 163, 184, 0.2)',
};

const ChartShell = ({ kicker, title, children, insightHint }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">{kicker}</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">{title}</h3>
      </div>
      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">{insightHint}</span>
    </div>
    {children}
  </section>
);

const buildBaseOptions = ({ stacked = false, onClick }) => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick,
  onHover: (event) => {
    if (event?.native?.target) event.native.target.style.cursor = 'pointer';
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        color: '#475569',
        font: { size: 11, weight: '700' },
        useBorderRadius: true,
        borderRadius: 4,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      titleColor: '#f8fafc',
      bodyColor: '#e2e8f0',
      padding: 12,
      cornerRadius: 10,
      displayColors: true,
    },
  },
  scales: {
    x: {
      stacked,
      ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      stacked,
      beginAtZero: true,
      ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      grid: { color: palette.grid },
      border: { display: false },
    },
  },
});

const Charts = () => {
  const [performanceRows, setPerformanceRows] = useState([]);
  const [cdcRows, setCdcRows] = useState([]);
  const [activeInsight, setActiveInsight] = useState(null);

  useEffect(() => {
    const headers = {
      Authorization: `Bearer ${localStorage.getItem('access')}`,
    };

    Promise.all([
      api.get('/performance/', { headers }),
      api.get('/cdcs/', { headers }),
    ])
      .then(([performanceRes, cdcRes]) => {
        setPerformanceRows(Array.isArray(performanceRes.data) ? performanceRes.data : []);
        setCdcRows(Array.isArray(cdcRes.data) ? cdcRes.data : []);
      })
      .catch((err) => console.log(err));
  }, []);

  const rankedPerformance = useMemo(
    () => [...performanceRows].sort((left, right) => Number(right.overall_score || 0) - Number(left.overall_score || 0)).slice(0, 8),
    [performanceRows]
  );

  const capacityRows = useMemo(() => {
    const rows = cdcRows.length
      ? cdcRows
      : performanceRows.map((row) => ({
        id: row.id,
        name: getCdcName(row),
        current_enrollment: row.current_enrollment || row.enrollment || 0,
        max_capacity: row.max_capacity || row.capacity || 0,
      }));

    return [...rows]
      .map((row) => {
        const enrollment = Number(row.current_enrollment || row.enrollment || 0);
        const capacity = Number(row.max_capacity || row.effective_capacity || row.capacity || 0);
        return {
          ...row,
          label: getCdcName(row),
          enrollment,
          capacity,
          remaining: Math.max(0, capacity - enrollment),
          utilization: capPercent(capacity ? (enrollment / capacity) * 100 : 0),
        };
      })
      .sort((left, right) => right.enrollment - left.enrollment)
      .slice(0, 8);
  }, [cdcRows, performanceRows]);

  const distributionRows = capacityRows.slice(0, 6);
  const totalEnrollment = capacityRows.reduce((sum, row) => sum + row.enrollment, 0);
  const averagePerformance = rankedPerformance.length
    ? rankedPerformance.reduce((sum, row) => sum + Number(row.overall_score || 0), 0) / rankedPerformance.length
    : 0;
  const averageUtilization = capacityRows.length
    ? capacityRows.reduce((sum, row) => sum + row.utilization, 0) / capacityRows.length
    : 0;

  const performanceChart = {
    labels: rankedPerformance.map(getCdcName),
    datasets: [
      {
        label: 'Overall Score',
        data: rankedPerformance.map((row) => capPercent(row.overall_score)),
        backgroundColor: rankedPerformance.map((row) => {
          const score = capPercent(row.overall_score);
          if (score >= 85) return palette.emerald;
          if (score >= 70) return palette.blue;
          if (score >= 55) return palette.amber;
          return palette.rose;
        }),
        borderRadius: 10,
        borderSkipped: false,
      },
    ],
  };

  const capacityChart = {
    labels: capacityRows.map((row) => row.label),
    datasets: [
      {
        label: 'Current Enrollment',
        data: capacityRows.map((row) => row.enrollment),
        backgroundColor: palette.blueSoft,
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: 'Remaining Capacity',
        data: capacityRows.map((row) => row.remaining),
        backgroundColor: 'rgba(16, 185, 129, 0.72)',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const distributionChart = {
    labels: distributionRows.map((row) => row.label),
    datasets: [
      {
        label: 'Enrollment Share',
        data: distributionRows.map((row) => row.enrollment),
        backgroundColor: [palette.blue, palette.emerald, palette.amber, palette.rose, palette.cyan, palette.slate],
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const openInsight = (baseInsight, rows, formatter = (row) => row?.label || getCdcName(row)) => (_event, elements) => {
    const element = elements?.[0];
    const row = rows[element?.index ?? 0];
    setActiveInsight({
      ...baseInsight,
      selectedLabel: formatter(row),
      selectedValue: baseInsight.valueFor?.(row),
      itemInsight: baseInsight.itemInsightFor?.(row),
    });
  };

  const performanceFindings = simpleFinding({
    ...getExtremes(rankedPerformance, (row) => row.overall_score),
    labelGetter: getCdcName,
    unit: '%',
  });

  const capacityFindings = simpleFinding({
    ...getExtremes(capacityRows, (row) => row.utilization),
    labelGetter: (row) => row.label,
    unit: '% utilization',
  });

  const distributionTotal = distributionRows.reduce((sum, row) => sum + Number(row.enrollment || 0), 0);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    onClick: openInsight({
      title: 'Enrollment Distribution',
      meaning: 'This round chart shows which CDCs carry the largest share of enrolled children. A bigger slice means more children are concentrated in that CDC.',
      findings: simpleFinding({
        ...getExtremes(distributionRows, (row) => row.enrollment),
        labelGetter: (row) => row.label,
        unit: ' enrolled children',
      }),
      methodology: 'Enrollment counts are grouped by CDC and represented as proportional shares of the displayed centers.',
      period: 'Current encoded CDC enrollment records.',
      factors: ['Current enrollment per CDC', 'CDC records visible to the current user', 'Top enrolled centers shown for readability'],
      actions: ['Review whether one CDC is carrying a disproportionate share.', 'Compare distribution with capacity and barangay coverage.', 'Use this view to spot centers that may need balancing or referral support.'],
      valueFor: (row) => `${formatNumber(row?.enrollment)} enrolled`,
      itemInsightFor: (row) => sliceInsight({
        label: row?.label || 'This CDC',
        value: row?.enrollment,
        total: distributionTotal,
        action: 'If this slice is large, check whether the CDC still has enough rooms, staff, and sessions.',
      }),
    }, distributionRows),
    onHover: (event) => {
      if (event?.native?.target) event.native.target.style.cursor = 'pointer';
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#475569', font: { size: 11, weight: '700' }, boxWidth: 10, boxHeight: 10 },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context) => `${context.label}: ${formatNumber(context.parsed)} enrolled`,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <AnalyticsInsight as="div" onOpen={setActiveInsight} insight={{
          title: 'Average Performance Score',
          meaning: 'The average overall score across the visible CDC performance records.',
          methodology: 'The score averages the latest overall performance values returned by the performance endpoint.',
          period: 'Latest available performance data.',
          factors: ['CDC performance records', 'Overall score values', 'Visible current user scope'],
          actions: ['Review low-scoring CDCs in the performance chart.', 'Check whether missing reports are lowering scores.'],
        }} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Average Score</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{averagePerformance.toFixed(1)}%</p>
        </AnalyticsInsight>
        <AnalyticsInsight as="div" onOpen={setActiveInsight} insight={{
          title: 'Total Enrollment',
          meaning: 'The total enrolled children across the CDCs shown in the current analytics view.',
          methodology: 'Enrollment is summed from current CDC records, using performance rows only as fallback.',
          period: 'Current CDC data.',
          factors: ['Current CDC enrollment', 'Visible CDC records'],
          actions: ['Compare total enrollment with capacity.', 'Use the capacity chart to find pressure points.'],
        }} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total Enrollment</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{formatNumber(totalEnrollment)}</p>
        </AnalyticsInsight>
        <AnalyticsInsight as="div" onOpen={setActiveInsight} insight={{
          title: 'Average Utilization',
          meaning: 'The average share of CDC capacity currently being used.',
          methodology: 'Each CDC utilization is enrollment divided by capacity, capped at 100% for readability, then averaged.',
          period: 'Current CDC data.',
          factors: ['Current enrollment', 'Maximum or effective capacity'],
          actions: ['Review CDCs near full utilization.', 'Use available-capacity centers for referrals where appropriate.'],
        }} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Avg Utilization</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{averageUtilization.toFixed(1)}%</p>
        </AnalyticsInsight>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartShell kicker="Comparison" title="CDC Performance Scores" insightHint="Click bars">
          <div className="h-80">
            <Bar
              data={performanceChart}
              options={buildBaseOptions({
                onClick: openInsight({
          title: 'CDC Performance Scores',
          meaning: 'This bar chart compares CDC performance scores. Higher bars usually mean the CDC has stronger current records and operations.',
          findings: performanceFindings,
          methodology: 'Scores combine available performance signals such as enrollment utilization, reporting timeliness, and completeness.',
          period: 'Latest performance records available from the system.',
          factors: ['Overall score', 'Report timeliness', 'Report completeness', 'CDC enrollment signal'],
          actions: ['Prioritize low-scoring CDCs for review.', 'Use high-scoring CDCs as reference examples.', 'Check whether low scores are caused by reporting gaps or service pressure.'],
          valueFor: (row) => `${capPercent(row?.overall_score).toFixed(1)}%`,
          itemInsightFor: (row) => describeSelectedBar({
            label: getCdcName(row),
            value: capPercent(row?.overall_score).toFixed(1),
            threshold: 70,
            unit: '%',
            highLabel: 'strong performance',
            lowLabel: 'needs-review performance',
            action: capPercent(row?.overall_score) < 70 ? 'Check missing reports, compliance issues, or service pressure.' : 'Use this CDC as a possible reference for good practice.',
          }),
        }, rankedPerformance, getCdcName),
              })}
            />
          </div>
        </ChartShell>

        <ChartShell kicker="Capacity" title="Enrollment Versus Capacity" insightHint="Click bars">
          <div className="h-80">
            <Bar
              data={capacityChart}
              options={buildBaseOptions({
                stacked: true,
                onClick: openInsight({
          title: 'Enrollment Versus Capacity',
          meaning: 'This stacked bar chart shows how full each CDC is. A CDC with little or no remaining capacity may need added sessions, staff, or enrollment balancing.',
          findings: capacityFindings,
          methodology: 'The first segment is enrolled children; the second segment is available capacity that remains within the encoded maximum.',
          period: 'Current CDC enrollment and capacity records.',
          factors: ['Current enrollment', 'Maximum or effective capacity', 'Remaining available slots', 'Utilization capped at 100% for readability'],
          actions: ['Review CDCs where enrollment fills the full bar.', 'Plan added sessions when capacity is tight.', 'Balance referrals toward CDCs with available capacity.'],
          valueFor: (row) => `${formatNumber(row?.enrollment)} enrolled / ${formatNumber(row?.capacity)} capacity`,
          itemInsightFor: (row) => describeSelectedBar({
            label: row?.label || 'This CDC',
            value: row?.utilization?.toFixed ? row.utilization.toFixed(1) : row?.utilization,
            threshold: 85,
            unit: '% capacity used',
            highLabel: 'high-capacity',
            lowLabel: 'manageable-capacity',
            action: row?.utilization >= 85 ? 'Check if more slots, staff, or sessions are needed.' : 'This CDC may still have space for appropriate referrals.',
          }),
        }, capacityRows),
              })}
            />
          </div>
        </ChartShell>
      </div>

      <ChartShell kicker="Distribution" title="Enrollment Share by CDC" insightHint="Click slices">
        <div className="mx-auto h-80 max-w-3xl">
          <Doughnut data={distributionChart} options={doughnutOptions} />
        </div>
      </ChartShell>

      <ChartInsightModal insight={activeInsight} onClose={() => setActiveInsight(null)} />
    </div>
  );
};

export default Charts;
