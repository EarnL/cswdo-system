import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  ArcElement,
} from 'chart.js';
import api from '../api';
import AnalyticsInsight from '../components/AnalyticsInsight';
import ChartInsightModal from '../components/ChartInsightModal';
import { LoadingState } from '../components/LoadingState';
import { describeSelectedBar, getExtremes, simpleFinding, sliceInsight } from '../utils/chartInsights';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const formatNumber = value => value == null ? 'No data' : Math.round(Number(value)).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const capPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const formatCappedPercent = value => value == null ? 'No data' : `${Math.round(capPercent(value))}%`;
const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const needStyles = {
  no_data: 'border-slate-200 bg-slate-50 text-slate-600',
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
  elevated: 'border-amber-200 bg-amber-50 text-amber-800',
  watch: 'border-sky-200 bg-sky-50 text-sky-800',
};

const statusStyles = {
  service_gap: 'border-rose-200 bg-rose-50 text-rose-800',
  near_capacity: 'border-amber-200 bg-amber-50 text-amber-800',
  stable: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const getCdcLoadLabel = (status) => {
  if (status === 'service_gap') return 'Over capacity';
  if (status === 'near_capacity') return 'Near capacity';
  return 'Within capacity';
};

const metricDefinitions = [
  {
    label: 'Need',
    front: 'Priority level',
    text: 'Barangay-wide coverage urgency. Critical is score 70+, Elevated is 35-69.9, Watch is below 35.',
  },
  {
    label: 'Score',
    front: '0-100 rating',
    text: 'Percentage of children aged 3-4 outside recorded public CDC enrollment.',
  },
  {
    label: 'Gap 3-4',
    front: 'Unserved ages 3-4',
    text: 'Estimated children ages 3-4 not covered by daycare services. The percentage below shows actual CDC enrollment against the barangay age 3-4 population, capped at 100% for readability.',
  },
  {
    label: 'Vulnerable',
    front: 'Special attention',
    text: 'Unenrolled children tagged in the integrated data as children with disabilities or working children.',
  },
  {
    label: 'CDC Capacity Status',
    front: 'Current CDC capacity',
    text: 'Capacity condition of existing CDCs only. A CDC can be within capacity while the barangay still has many children outside CDC coverage.',
  },
];

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function InfoDot({ label }) {
  const item = metricDefinitions.find((definition) => definition.label === label);
  return (
    <span
      title={item?.text || ''}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500"
    >
      i
    </span>
  );
}

function StatCard({ label, value, hint, tone = 'blue', insight, onOpen }) {
  const tones = {
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  const toneClass = tones[tone] || tones.blue;

  return (
    <AnalyticsInsight
      as="button"
      insight={insight}
      onOpen={onOpen}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
      title={hint || ''}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black leading-none text-slate-950">{value}</p>
        </div>
        <span className={`h-3 w-3 shrink-0 rounded-full border ${toneClass}`} />
      </div>
    </AnalyticsInsight>
  );
}

function ProgressBar({ value, tone = 'bg-[#0f4b94]' }) {
  const width = capPercent(value);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function SectionButton({ active, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? 'border-[#0f4b94] bg-[#0f4b94] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50'
      }`}
    >
      <p className="text-sm font-black">{title}</p>
      <p className={`mt-1 text-xs font-semibold ${active ? 'text-white/75' : 'text-slate-500'}`}>{hint}</p>
    </button>
  );
}

function ChartPanel({ title, value, children, action }) {
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          {value ? <p className="mt-1 text-sm font-semibold text-slate-500">{value}</p> : null}
        </div>
        {action ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{action}</span> : null}
      </div>
      <div className="h-72">{children}</div>
    </section>
  );
}

function ServiceGapAnalyticsPage() {
  const isPlanningMonitor = ['planning', 'city_planning'].includes(localStorage.getItem('role'));
  const [heatmapRows, setHeatmapRows] = useState([]);
  const [publicRows, setPublicRows] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [gapRows, setGapRows] = useState([]);
  const [followUpChildren, setFollowUpChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needFilter, setNeedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMethod, setShowMethod] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [activeInsight, setActiveInsight] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError('');
        const [heatmapRes, gapRes, childrenRes, publicRes] = await Promise.all([
          api.get('/heatmap/'),
          api.get('/integration/gap-analysis/'),
          isPlanningMonitor
            ? Promise.resolve({ data: [] })
            : api.get('/children/', { params: { status: 'not_enrolled' } }),
          api.get('/public-map/'),
        ]);

        if (!isMounted) return;

        setHeatmapRows(normalizeList(heatmapRes.data));
        setPublicRows(normalizeList(publicRes.data));
        setGapRows(normalizeList(gapRes.data));
        setFollowUpChildren(
          normalizeList(childrenRes.data).filter((child) => child.population_match_status?.value === 'population_only' || child.population_source_submission)
        );
      } catch (err) {
        console.error('Failed to load service gap analytics:', err);
        if (isMounted) {
          setError('Unable to load service gap analytics right now.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [isPlanningMonitor]);

  const barangayRows = useMemo(() => {
    const byBarangay = new Map();

    heatmapRows.forEach((cdc) => {
      const key = cdc.barangay || 'Unknown';
      const current = byBarangay.get(key) || {
        barangay: key,
        cdc_count: 0,
        enrollment: 0,
        effective_capacity: 0,
        available_slots: 0,
        service_gap_cdcs: 0,
        near_capacity_cdcs: 0,
        max_need_score: 0,
        need_level: 'watch',
        total_gap_0_5: 0,
        public_cdc_gap_3_4: 0,
        public_cdc_enrollment_3_4: 0,
        vulnerable_unenrolled: 0,
        working_children_unenrolled: 0,
        enrollment_rate_0_5: 0,
        cdc_coverage_rate_0_5: null,
        population_children_0_5: 0,
      };

      current.cdc_count += 1;
      current.enrollment += Number(cdc.enrollment || 0);
      current.effective_capacity += Number(cdc.effective_capacity || 0);
      current.available_slots += Number(cdc.available_slots || 0);
      current.service_gap_cdcs += cdc.status === 'service_gap' ? 1 : 0;
      current.near_capacity_cdcs += cdc.status === 'near_capacity' ? 1 : 0;

      if (Number(cdc.need_score || 0) >= current.max_need_score) {
        current.max_need_score = Number(cdc.need_score || 0);
        current.need_level = cdc.need_level || 'watch';
      }

      const gap = cdc.barangay_gap || {};
      current.total_gap_0_5 = Math.max(current.total_gap_0_5, Number(gap.total_gap_0_5 || 0));
      current.public_cdc_gap_3_4 = Math.max(current.public_cdc_gap_3_4, Number(gap.public_cdc_gap_3_4 || 0));
      current.vulnerable_unenrolled = Math.max(current.vulnerable_unenrolled, Number(gap.vulnerable_unenrolled || 0));
      current.working_children_unenrolled = Math.max(current.working_children_unenrolled, Number(gap.working_children_unenrolled || 0));
      current.enrollment_rate_0_5 = Math.max(current.enrollment_rate_0_5, Number(gap.enrollment_rate_0_5 || 0));
      current.public_cdc_enrollment_3_4 = Math.max(
        current.public_cdc_enrollment_3_4 || 0,
        Number(gap.public_cdc_enrollment_3_4 || 0)
      );
      current.population_children_0_5 = Math.max(
        current.population_children_0_5,
        Number(cdc.barangay_population?.total_children_0_5 || 0)
      );

      byBarangay.set(key, current);
    });

    gapRows.forEach((gap) => {
      const key = gap.barangay_name || gap.barangay?.name || gap.barangay || 'Unknown';
      const current = byBarangay.get(key) || {
        barangay: key,
        cdc_count: 0,
        enrollment: 0,
        effective_capacity: 0,
        available_slots: 0,
        service_gap_cdcs: 0,
        near_capacity_cdcs: 0,
        max_need_score: 0,
        need_level: 'watch',
        cdc_coverage_rate_0_5: null,
        public_cdc_enrollment_3_4: 0,
        population_children_0_5: 0,
      };

      current.total_gap_0_5 = Number(gap.total_gap_0_5 || current.total_gap_0_5 || 0);
      current.public_cdc_gap_3_4 = Number(gap.public_cdc_gap_children_3_4 || current.public_cdc_gap_3_4 || 0);
      current.public_cdc_enrollment_3_4 = Number(gap.public_cdc_enrollment_children_3_4 || current.public_cdc_enrollment_3_4 || 0);
      if (Number(current.enrollment || 0) === 0 && current.public_cdc_enrollment_3_4 > 0) {
        current.enrollment = current.public_cdc_enrollment_3_4;
      }
      current.vulnerable_unenrolled = Number(gap.vulnerable_children_unenrolled || current.vulnerable_unenrolled || 0);
      current.working_children_unenrolled = Number(gap.working_children_unenrolled || current.working_children_unenrolled || 0);
      current.enrollment_rate_0_5 = Number(gap.enrollment_rate_0_5 || current.enrollment_rate_0_5 || 0);
      current.population_children_0_5 = Number(gap.population_metrics?.total_children_0_5 || current.population_children_0_5 || 0);
      current.cdc_has_service_gap = Boolean(gap.cdc_has_service_gap);
      if (current.cdc_has_service_gap) {
        current.service_gap_cdcs = Math.max(current.service_gap_cdcs || 0, 1);
      }

      byBarangay.set(key, current);
    });

    return publicRows.map(basis => {
      const row = byBarangay.get(basis.barangay.name) || {};
      return { ...row, barangay: basis.barangay.name, basis,
        cdc_count: basis.public_cdc.centers, enrollment: basis.public_cdc.enrollment_3_4,
        effective_capacity: basis.public_cdc.capacity,
        total_gap_0_5: basis.public_cdc.gap_3_4, public_cdc_gap_3_4: basis.public_cdc.gap_3_4,
        cdc_coverage_rate_0_5: basis.public_cdc.coverage_rate_3_4,
        max_need_score: basis.service_signal.need_score, need_level: basis.service_signal.need_level,
        utilization: basis.public_cdc.capacity > 0 ? capPercent(basis.public_cdc.enrollment_3_4 / basis.public_cdc.capacity * 100) : null,
      };
    }).sort((a,b) => (b.max_need_score ?? -1) - (a.max_need_score ?? -1));
  }, [gapRows, heatmapRows, publicRows]);

  const filteredBarangays = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return barangayRows.filter((row) => {
      const matchesNeed = needFilter === 'all' || row.need_level === needFilter;
      const matchesSearch = !normalizedSearch || row.barangay.toLowerCase().includes(normalizedSearch);
      return matchesNeed && matchesSearch;
    });
  }, [barangayRows, needFilter, searchTerm]);

  const childrenByBarangay = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const groups = new Map();

    followUpChildren.forEach((child) => {
      const barangayName = child.barangay_name || 'Barangay not recorded';
      const childName = child.name || [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ') || 'Unnamed child';
      const matchesSearch = !normalizedSearch
        || barangayName.toLowerCase().includes(normalizedSearch)
        || childName.toLowerCase().includes(normalizedSearch)
        || String(child.parent_guardian_name || '').toLowerCase().includes(normalizedSearch);
      if (!matchesSearch) return;

      const current = groups.get(barangayName) || {
        barangay: barangayName,
        children: [],
      };
      current.children.push(child);
      groups.set(barangayName, current);
    });

    return Array.from(groups.values())
      .map((group) => {
        const gapRow = barangayRows.find((row) => row.barangay === group.barangay);
        return {
          ...group,
          gap: Number(gapRow?.total_gap_0_5 || gapRow?.public_cdc_gap_3_4 || 0),
          needLevel: gapRow?.need_level || 'watch',
        };
      })
      .sort((a, b) => b.children.length - a.children.length || b.gap - a.gap || a.barangay.localeCompare(b.barangay));
  }, [barangayRows, followUpChildren, searchTerm]);

  const summary = useMemo(() => {
    const totalGap05 = barangayRows.reduce((sum, row) => sum + Number(row.total_gap_0_5 || 0), 0);
    const totalVulnerable = barangayRows.reduce((sum, row) => sum + Number(row.vulnerable_unenrolled || 0), 0);
    return {
      barangays: barangayRows.length,
      critical: barangayRows.filter((row) => row.need_level === 'critical').length,
      elevated: barangayRows.filter((row) => row.need_level === 'elevated').length,
      serviceGapCdcs: heatmapRows.filter((row) => row.status === 'service_gap').length,
      nearCapacityCdcs: heatmapRows.filter((row) => row.status === 'near_capacity').length,
      totalGap05: barangayRows.some(row => row.need_level === 'no_data') ? null : totalGap05,
      totalVulnerable,
      namedFollowUp: followUpChildren.length,
      barangaysWithNamedFollowUp: new Set(followUpChildren.map((child) => child.barangay_name || child.barangay).filter(Boolean)).size,
    };
  }, [barangayRows, followUpChildren, heatmapRows]);

  const analyticsBasis = useMemo(() => {
    if (followUpChildren.length > 0) {
      return {
        label: 'Named follow-up records included',
        short: 'Uses named not-enrolled child records plus population, enrollment, and CDC capacity data.',
        mode: 'named',
      };
    }
    return {
      label: 'Population and enrollment basis',
      short: 'No named not-enrolled child records are available yet, so analytics use latest population and enrollment totals.',
      mode: 'aggregate',
    };
  }, [followUpChildren.length]);

  const openBarangayInsight = (row) => ({
    title: `${row.barangay} Service Gap`,
    meaning: 'This row combines current barangay population, enrollment, public CDC gap, and CDC capacity signals to show where support may be needed.',
    methodology: analyticsBasis.mode === 'named'
      ? 'The dashboard uses named non-enrolled child records when available, then cross-checks them against barangay gap analysis and CDC capacity.'
      : 'No named non-enrolled child records are available, so this dashboard uses the latest available population metrics and most recent enrollment data.',
    period: 'Current academic year and latest integrated planning basis.',
    factors: [
      `Priority score: ${formatNumber(row.max_need_score)}`,
      `Vulnerable records: ${formatNumber(row.vulnerable_unenrolled)}`,
      `Working-child records: ${formatNumber(row.working_children_unenrolled)}`,
      `Age 3-4 estimated gap: ${formatNumber(row.total_gap_0_5)}`,
      `Public CDC gap ages 3-4: ${formatNumber(row.public_cdc_gap_3_4)}`,
      `CDC capacity flag: ${getCdcLoadLabel(row.service_gap_cdcs > 0 ? 'service_gap' : row.near_capacity_cdcs > 0 ? 'near_capacity' : 'stable')}`,
    ],
    actions: [getRecommendation(row), 'Open the CDC watchlist to review center-level load.', 'Use named follow-up only when CHO/CDW child records are available.'],
  });

  const topOperationalCdcs = useMemo(() => {
    return [...heatmapRows]
      .sort((a, b) => {
        const statusWeight = { service_gap: 2, near_capacity: 1, stable: 0 };
        return (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0) || Number(b.utilization || 0) - Number(a.utilization || 0);
      })
      .slice(0, 8);
  }, [heatmapRows]);

  const highRatioCdcs = useMemo(() => {
    return [...heatmapRows]
      .map((cdc) => {
        const ratio = Number(cdc.children_per_teacher || 0);
        const enrollment = Number(cdc.enrollment || 0);
        const teacherCount = Number(cdc.teacher_count || 0);
        return {
          ...cdc,
          ratio,
          ratioGap: Math.max(0, ratio - 25),
          teacherShortage: teacherCount > 0 ? Math.max(0, Math.ceil(enrollment / 25) - teacherCount) : enrollment > 0 ? 1 : 0,
        };
      })
      .filter((cdc) => cdc.ratio > 0 || Number(cdc.enrollment) > 0)
      .sort((a, b) => b.ratio - a.ratio || Number(b.need_score || 0) - Number(a.need_score || 0))
      .slice(0, 10);
  }, [heatmapRows]);

  const topUnderservedBarangays = useMemo(() => filteredBarangays.filter(row => row.need_level !== 'no_data').sort((a,b) => b.total_gap_0_5 - a.total_gap_0_5).slice(0, 10), [filteredBarangays]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatNumber(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#475569', font: { weight: 700 }, maxRotation: 45, minRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#e2e8f0' },
        ticks: { color: '#64748b', font: { weight: 700 } },
      },
    },
  }), []);

  const chartWithClick = (onClick) => ({
    ...chartOptions,
    onClick,
    onHover: (event) => {
      if (event?.native?.target) event.native.target.style.cursor = 'pointer';
    },
  });

  const underservedChart = useMemo(() => ({
    labels: topUnderservedBarangays.map((row) => row.barangay),
    datasets: [
      {
        label: 'Need score',
        data: topUnderservedBarangays.map((row) => Number(row.max_need_score || 0)),
        backgroundColor: topUnderservedBarangays.map((row) => row.need_level === 'critical' ? '#e11d48' : row.need_level === 'elevated' ? '#f59e0b' : '#0ea5e9'),
        borderRadius: 8,
      },
    ],
  }), [topUnderservedBarangays]);

  const gapChart = useMemo(() => ({
    labels: topUnderservedBarangays.map((row) => row.barangay),
    datasets: [
      {
        label: 'Unserved ages 3-4',
        data: topUnderservedBarangays.map((row) => Number(row.total_gap_0_5 || 0)),
        backgroundColor: '#0f4b94',
        borderRadius: 8,
      },
    ],
  }), [topUnderservedBarangays]);

  const ratioChart = useMemo(() => ({
    labels: highRatioCdcs.map((cdc) => cdc.name),
    datasets: [
      {
        label: 'Children per teacher',
        data: highRatioCdcs.map((cdc) => Number(cdc.ratio || 0)),
        backgroundColor: highRatioCdcs.map((cdc) => cdc.ratio > 25 ? '#e11d48' : cdc.ratio >= 10 ? '#f59e0b' : '#10b981'),
        borderRadius: 8,
      },
    ],
  }), [highRatioCdcs]);

  const statusDonut = useMemo(() => ({
    labels: ['Capacity Exceeded', 'Near Capacity', 'Within Capacity'],
    datasets: [
      {
        data: [
          summary.serviceGapCdcs,
          summary.nearCapacityCdcs,
          Math.max(0, heatmapRows.length - summary.serviceGapCdcs - summary.nearCapacityCdcs),
        ],
        backgroundColor: ['#e11d48', '#f59e0b', '#10b981'],
        borderColor: '#ffffff',
        borderWidth: 4,
      },
    ],
  }), [heatmapRows.length, summary.nearCapacityCdcs, summary.serviceGapCdcs]);

  const immediateActions = useMemo(() => {
    const critical = barangayRows.find((row) => row.need_level === 'critical');
    const ratio = highRatioCdcs.find((cdc) => cdc.ratio > 25);
    const capacity = topOperationalCdcs.find((cdc) => cdc.status === 'service_gap');
    return [
      critical ? {
        title: `${critical.barangay}: add service access`,
        metric: `${formatNumber(critical.total_gap_0_5)} gap`,
        action: getRecommendation(critical),
        tone: 'border-rose-200 bg-rose-50 text-rose-800',
      } : null,
      ratio ? {
        title: `${ratio.name}: reduce child ratio`,
        metric: `${ratio.ratio}:1`,
        action: ratio.teacherShortage > 0 ? `Add ${ratio.teacherShortage} teacher/caregiver or split sessions.` : 'Review staffing and session grouping.',
        tone: 'border-amber-200 bg-amber-50 text-amber-800',
      } : null,
      capacity ? {
        title: `${capacity.name}: capacity exceeded`,
        metric: `${formatNumber(capacity.excess_children || 0)} over`,
        action: 'Open extra session, redirect enrollment, or review room/staff capacity.',
        tone: 'border-sky-200 bg-sky-50 text-sky-800',
      } : null,
    ].filter(Boolean);
  }, [barangayRows, highRatioCdcs, topOperationalCdcs]);

  const underservedFindings = simpleFinding({
    ...getExtremes(topUnderservedBarangays, (row) => row.max_need_score),
    labelGetter: (row) => row.barangay,
    unit: ' need score',
  });

  const gapFindings = simpleFinding({
    ...getExtremes(topUnderservedBarangays, (row) => row.total_gap_0_5),
    labelGetter: (row) => row.barangay,
    unit: ' unserved children',
  });

  const ratioFindings = simpleFinding({
    ...getExtremes(highRatioCdcs, (cdc) => cdc.ratio),
    labelGetter: (cdc) => cdc.name,
    unit: ':1 child-to-teacher ratio',
  });

  const openUnderservedChartItem = (_event, elements) => {
    const row = topUnderservedBarangays[elements?.[0]?.index ?? 0];
    if (!row) return;
    setActiveInsight({
      title: 'Underserved Barangay Score',
      selectedLabel: row.barangay,
      selectedValue: `${Number(row.max_need_score || 0).toFixed(1)}/100`,
      meaning: 'This graph shows which barangays need the most service support. A taller bar means stronger need.',
      itemInsight: describeSelectedBar({
        label: row.barangay,
        value: Number(row.max_need_score || 0).toFixed(1),
        threshold: 70,
        unit: '/100 need score',
        highLabel: 'critical',
        lowLabel: row.need_level === 'elevated' ? 'elevated' : 'watch',
        action: getRecommendation(row),
      }),
      findings: underservedFindings,
      period: 'Current academic year and latest integrated planning basis.',
      factors: [`Gap 3-4: ${formatNumber(row.total_gap_0_5)}`, `Vulnerable: ${formatNumber(row.vulnerable_unenrolled)}`, `CDC status: ${row.service_gap_cdcs > 0 ? 'Capacity exceeded' : row.near_capacity_cdcs > 0 ? 'Near capacity' : 'Within capacity'}`],
      actions: [getRecommendation(row), 'Check exact CDC load before final planning.'],
    });
  };

  const openGapChartItem = (_event, elements) => {
    const row = topUnderservedBarangays[elements?.[0]?.index ?? 0];
    if (!row) return;
    setActiveInsight({
      title: 'Largest Coverage Gaps',
      selectedLabel: row.barangay,
      selectedValue: `${formatNumber(row.total_gap_0_5)} children`,
      meaning: 'This graph shows estimated children ages 3-4 who are not covered by daycare services.',
      itemInsight: `${row.barangay} has an estimated gap of ${formatNumber(row.total_gap_0_5)} children ages 3-4. This matters because a large gap may mean children are not reaching CDC or related services.`,
      findings: gapFindings,
      period: 'Current academic year and latest population basis.',
      factors: [`CDC enrollment coverage: ${formatCappedPercent(row.cdc_coverage_rate_0_5)}`, `Public CDC gap ages 3-4: ${formatNumber(row.public_cdc_gap_3_4)}`],
      actions: ['Plan added CDC slots or outreach.', 'Check if nearby CDCs still have available capacity.', 'Coordinate SNP referral when CDC enrollment is not possible.'],
    });
  };

  const openRatioChartItem = (_event, elements) => {
    const cdc = highRatioCdcs[elements?.[0]?.index ?? 0];
    if (!cdc) return;
    setActiveInsight({
      title: 'High Child Ratio CDC',
      selectedLabel: cdc.name,
      selectedValue: `${cdc.ratio}:1`,
      meaning: 'This graph shows CDCs with the highest number of children per teacher or caregiver. Higher bars may mean overcrowding or too much workload.',
      itemInsight: `${cdc.name} has a ${cdc.ratio}:1 child-to-teacher ratio. ${cdc.ratio > 25 ? 'This is above the recommended ceiling and needs action.' : 'This should be monitored so it does not become overloaded.'}`,
      findings: ratioFindings,
      period: 'Current CDC staffing and enrollment records.',
      factors: [`Enrollment: ${formatNumber(cdc.enrollment)}`, `Teachers: ${formatNumber(cdc.teacher_count)}`, `Estimated teacher shortage: ${formatNumber(cdc.teacherShortage)}`],
      actions: cdc.ratio > 25 ? ['Add teacher/caregiver support.', 'Split sessions or redirect new enrollees.', 'Check if staffing records are complete.'] : ['Continue monitoring during enrollment updates.'],
    });
  };

  const openCapacitySlice = (_event, elements) => {
    const labels = ['Capacity Exceeded', 'Near Capacity', 'Within Capacity'];
    const values = [
      summary.serviceGapCdcs,
      summary.nearCapacityCdcs,
      Math.max(0, heatmapRows.length - summary.serviceGapCdcs - summary.nearCapacityCdcs),
    ];
    const index = elements?.[0]?.index ?? 0;
    const label = labels[index];
    const value = values[index];
    const total = values.reduce((sum, item) => sum + Number(item || 0), 0);
    setActiveInsight({
      title: 'CDC Capacity Status',
      selectedLabel: label,
      selectedValue: `${formatNumber(value)} CDCs`,
      meaning: 'This round chart shows how many CDCs are overloaded, near capacity, or still within capacity.',
      itemInsight: sliceInsight({
        label,
        value,
        total,
        action: label === 'Capacity Exceeded' ? 'These CDCs need immediate review for slots, staffing, sessions, or referrals.' : label === 'Near Capacity' ? 'These CDCs should be watched before accepting more children.' : 'These CDCs may still support referrals if they are near the child location.',
      }),
      findings: [`${formatNumber(summary.serviceGapCdcs)} CDCs are over capacity and ${formatNumber(summary.nearCapacityCdcs)} are near capacity.`],
      period: 'Current CDC capacity records.',
      actions: ['Review exceeded CDCs first.', 'Use within-capacity CDCs for referral planning when practical.'],
    });
  };

  function getRecommendation(row) {
    if (row.need_level === 'critical') {
      return 'Prioritize additional slots, outreach, or CDC expansion review.';
    }
    if (row.need_level === 'elevated') {
      return 'Monitor enrollment and prepare targeted support planning.';
    }
    if (row.service_gap_cdcs > 0 || row.near_capacity_cdcs > 0) {
      return 'Review CDC session load and capacity utilization.';
    }
    return 'Continue regular monitoring.';
  }

  const exportCsv = () => {
    const followUpCounts = new Map(childrenByBarangay.map((row) => [row.barangay, row.children.length]));
    const headers = ['Barangay', 'Need Level', 'Score', 'Gap 3-4', 'Named Follow-up', 'CDC Enrollment %', 'Vulnerable', 'CDC Capacity Status', 'Recommendation'];
    const rows = filteredBarangays.map((row) => {
      const status = getCdcLoadLabel(row.service_gap_cdcs > 0 ? 'service_gap' : row.near_capacity_cdcs > 0 ? 'near_capacity' : 'stable');
      return [
        row.barangay,
        row.need_level,
        row.max_need_score == null ? 'No data' : Number(row.max_need_score).toFixed(1),
        row.total_gap_0_5 ?? 'No data',
        followUpCounts.get(row.barangay) || 0,
        Math.round(capPercent(row.cdc_coverage_rate_0_5 || 0)),
        row.vulnerable_unenrolled || 0,
        status,
        getRecommendation(row),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service-gap-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,#e0f2fe_0%,#eff6ff_45%,#f8fafc_100%)] p-3 shadow-[0_26px_80px_-48px_rgba(15,23,42,0.65)] sm:p-5">
        <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="lgu-kicker">{isPlanningMonitor ? 'View-only monitoring' : 'Analytics'}</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Service Coverage Gaps</h1><p className="mt-2 text-sm text-slate-600">Academic year: {publicRows[0]?.academic_year?.name || 'Not recorded'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Current coverage for ages 3-4. Some children may attend other services.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowMethod((current) => !current)} className="lgu-button-secondary">
                {showMethod ? 'Hide Method' : 'View Method'}
              </button>
              <button type="button" onClick={exportCsv} disabled={loading || filteredBarangays.length === 0} className="lgu-button-primary">
                Export CSV
              </button>
            </div>
          </div>

          {error ? <div className="mt-4 lgu-alert-error">{error}</div> : null}

          <details className="mt-4 rounded-xl border border-slate-200 p-3" open={showMethod}>
            <summary className="cursor-pointer text-sm font-semibold" onClick={event => { event.preventDefault(); setShowMethod(!showMethod); }}>Data sources and calculation</summary>
            <p className="mt-3 text-sm text-slate-600">Coverage gap = approved ages 3-4 population minus recorded CDC enrollment. Priority is the percentage outside recorded enrollment. Missing data is not zero need.</p>
            <div className="mt-2 max-h-48 overflow-auto text-xs text-slate-500">{publicRows.filter(row => row.population.has_current_basis).map(row => <p key={row.barangay.id} className="py-1">{row.barangay.name}: {row.population.source?.title || 'Source not recorded'} | {row.population.source?.period_start || 'Period not recorded'}{row.population.source?.period_end ? ` to ${row.population.source.period_end}` : ''}</p>)}</div>
          </details>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Priority Barangays" value={summary.critical + summary.elevated} onOpen={setActiveInsight} insight={{ title: 'Priority Barangays', findings: barangayRows.filter(row => ['critical','elevated'].includes(row.need_level)).map(row => `${row.barangay}: ${formatNumber(row.total_gap_0_5)} coverage gap`) }} />
            <StatCard label="Coverage Gap" value={formatNumber(summary.totalGap05)} onOpen={setActiveInsight} insight={{ title: 'Coverage Gap', meaning: 'Ages 3-4 outside recorded CDC enrollment. Citywide totals require complete population coverage.', findings: barangayRows.map(row => `${row.barangay}: ${formatNumber(row.total_gap_0_5)}`) }} />
            <StatCard label="CDCs Over Capacity" value={summary.serviceGapCdcs} onOpen={setActiveInsight} insight={{ title: 'CDCs Over Capacity', findings: heatmapRows.filter(row => row.status === 'service_gap').map(row => `${row.name} (${row.barangay}): ${formatNumber(row.enrollment)} enrolled / ${formatNumber(row.effective_capacity)} slots`) }} />
            {!isPlanningMonitor && <StatCard label="Children for Follow-up" value={summary.namedFollowUp} onOpen={setActiveInsight} insight={{ title: 'Children for Follow-up', findings: childrenByBarangay.map(group => `${group.barangay}: ${group.children.length} records`), actions: ['Open Follow-up to review child records.'] }} />}
          </section>

          <section className="mt-5 grid gap-3 md:grid-cols-4">
            <SectionButton active={activeSection === 'overview'} title="Overview" hint="Key graphs and actions" onClick={() => setActiveSection('overview')} />
            <SectionButton active={activeSection === 'barangays'} title="Barangays" hint="Service gap by barangay" onClick={() => setActiveSection('barangays')} />
            <SectionButton active={activeSection === 'cdc'} title="CDC Capacity" hint="High child ratio and capacity" onClick={() => setActiveSection('cdc')} />
            {!isPlanningMonitor && <SectionButton active={activeSection === 'followup'} title="Follow-up" hint="Named children when available" onClick={() => setActiveSection('followup')} />}
          </section>

          {activeSection === 'overview' ? (
            <section className="mt-5 space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartPanel title="Largest Coverage Gaps" value="Ages 3-4 estimated gap" action="Gap">
                  <Bar data={gapChart} options={chartWithClick(openGapChartItem)} />
                </ChartPanel>
                <ChartPanel title="CDC Capacity Status" value="Current centers" action="Status">
                  <Doughnut data={statusDonut} options={{ responsive: true, maintainAspectRatio: false, onClick: openCapacitySlice, onHover: (event) => { if (event?.native?.target) event.native.target.style.cursor = 'pointer'; }, plugins: { legend: { position: 'bottom' } } }} />
                </ChartPanel>
              </div>

              <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Suggested Next Actions</h3>
                    <p className="text-sm font-semibold text-slate-500">Short, practical actions based on the current highest risks.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{immediateActions.length || 0} items</span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {immediateActions.map((item) => (
                    <div key={item.title} className={`rounded-xl border p-4 ${item.tone}`}>
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="mt-2 text-2xl font-black">{item.metric}</p>
                      <p className="mt-2 text-sm font-semibold leading-5">{item.action}</p>
                    </div>
                  ))}
                  {!immediateActions.length ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                      No urgent action flags. Continue routine monitoring.
                    </div>
                  ) : null}
                </div>
              </section>
            </section>
          ) : null}

          {activeSection === 'barangays' ? (
          <div className="mt-5 grid gap-4 ">
            <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">Underserved Barangays</h2>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">{filteredBarangays.length} shown</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">70+ Critical</span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">35-69 Elevated</span>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">Below 35 Watch</span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search barangay"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
                  />
                  <select
                    value={needFilter}
                    onChange={(event) => setNeedFilter(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    <option value="all">All need levels</option>
                    <option value="critical">Critical only</option>
                    <option value="elevated">Elevated only</option>
                    <option value="watch">Watch only</option><option value="no_data">No data</option>
                  </select>
                </div>
              </div>

              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Barangay</th>
                      <th className="px-3 py-2">Need <InfoDot label="Need" /></th>
                      <th className="px-3 py-2">Coverage gap</th>
                      <th className="px-3 py-2">Enrollment coverage</th>
                      <th className="px-3 py-2">CDC Capacity <InfoDot label="CDC Capacity Status" /></th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBarangays.map((row) => {
                      const status = row.service_gap_cdcs > 0 ? 'service_gap' : row.near_capacity_cdcs > 0 ? 'near_capacity' : 'stable';
                      const statusLabel = row.cdc_count === 0 ? 'No CDC' : getCdcLoadLabel(status);
                      return (
                        <AnalyticsInsight
                          key={row.barangay}
                          as="tr"
                          onOpen={setActiveInsight}
                          insight={openBarangayInsight(row)}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-3 py-3">
                            <p className="font-black text-slate-900">{row.barangay}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{row.cdc_count} CDC{row.cdc_count === 1 ? '' : 's'}</p>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={needStyles[row.need_level] || needStyles.watch}>{row.need_level === 'no_data' ? 'No data' : row.need_level}</Badge>
                          </td>
                          <td className="px-3 py-3 font-semibold">{formatNumber(row.total_gap_0_5)}</td>
                          <td className="px-3 py-3">{formatCappedPercent(row.cdc_coverage_rate_0_5)}</td>
                          <td className="px-3 py-3">
                            <Badge className={statusStyles[status]}>{statusLabel}</Badge>
                            <p className="mt-1 text-[11px] text-slate-500">{row.service_gap_cdcs || row.near_capacity_cdcs || 0} flagged</p>
                          </td>
                          <td className="max-w-[220px] px-3 py-3 text-xs font-semibold leading-5 text-slate-600">
                            <button type="button" className="font-semibold text-blue-700" onClick={event => { event.stopPropagation(); setActiveInsight(openBarangayInsight(row)); }}>View details</button>
                          </td>
                        </AnalyticsInsight>
                      );
                    })}
                  </tbody>
                </table>
                {!loading && filteredBarangays.length === 0 ? (
                  <div className="m-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No barangays match the selected need level.</div>
                ) : null}
                {loading ? (
                  <div className="m-4">
                    <LoadingState title="Loading service gaps..." message="Comparing population, CDC capacity, and enrollment data." />
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Capacity Queue</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <AnalyticsInsight
                    as="div"
                    onOpen={setActiveInsight}
                    insight={{
                      title: 'Capacity Exceeded',
                      meaning: 'These CDCs have enrollment pressure above their effective capacity.',
                      methodology: 'The system compares current enrolled children with capacity adjusted by session settings.',
                      period: 'Current CDC records.',
                      actions: ['Review added sessions.', 'Check staffing and room capacity before accepting more children.'],
                    }}
                    className="rounded-lg border border-rose-100 bg-rose-50 p-3"
                  >
                    <p className="text-xs font-bold uppercase text-rose-700">Exceeded</p>
                    <p className="mt-1 text-2xl font-black text-rose-800">{summary.serviceGapCdcs}</p>
                  </AnalyticsInsight>
                  <AnalyticsInsight
                    as="div"
                    onOpen={setActiveInsight}
                    insight={{
                      title: 'Near Capacity',
                      meaning: 'These CDCs are approaching their capacity threshold and should be monitored.',
                      methodology: 'Near capacity is flagged when utilization is high but not yet beyond effective capacity.',
                      period: 'Current CDC records.',
                      actions: ['Monitor enrollment updates.', 'Prepare session or referral options if demand increases.'],
                    }}
                    className="rounded-lg border border-amber-100 bg-amber-50 p-3"
                  >
                    <p className="text-xs font-bold uppercase text-amber-700">Near</p>
                    <p className="mt-1 text-2xl font-black text-amber-800">{summary.nearCapacityCdcs}</p>
                  </AnalyticsInsight>
                </div>
              </section>

              <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">CDC Watchlist</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Capacity Review</h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">{topOperationalCdcs.length}</span>
                </div>

                <div className="mt-4 max-h-[410px] space-y-3 overflow-auto pr-1">
                  {topOperationalCdcs.map((cdc) => {
                    const rawUtilization = Number(cdc.utilization || 0);
                    const visibleUtilization = capPercent(rawUtilization);
                    const excessChildren = Math.max(
                      Number(cdc.excess_children || 0),
                      Number(cdc.enrollment || 0) - Number(cdc.effective_capacity || 0),
                      0
                    );
                    return (
                      <AnalyticsInsight
                        key={cdc.id}
                        as="article"
                        onOpen={setActiveInsight}
                        insight={{
                          title: `${cdc.name} Capacity Review`,
                          meaning: 'This CDC card explains whether the center has enough effective capacity for its current enrollment.',
                          methodology: 'Utilization is current enrollment divided by effective capacity. Effective capacity uses capacity per session and sessions per day.',
                          period: 'Current CDC enrollment and capacity records.',
                          factors: [
                            `Enrollment: ${formatNumber(cdc.enrollment)}`,
                            `Effective capacity: ${formatNumber(cdc.effective_capacity)}`,
                            `Available slots: ${formatNumber(cdc.available_slots)}`,
                            `Status: ${getCdcLoadLabel(cdc.status)}`,
                          ],
                          actions: excessChildren > 0
                            ? ['Review extra session needs.', 'Check whether added staff or referral support is required.']
                            : ['Continue monitoring utilization.', 'Use available slots for appropriate referrals.'],
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate font-black text-slate-900">{cdc.name}</h4>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">{cdc.barangay}</p>
                          </div>
                          <Badge className={statusStyles[cdc.status] || statusStyles.stable}>{getCdcLoadLabel(cdc.status)}</Badge>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-500">Utilization</span>
                            <span className="font-black text-slate-900">{formatPercent(visibleUtilization)}</span>
                          </div>
                          <ProgressBar value={visibleUtilization} tone={cdc.status === 'service_gap' ? 'bg-rose-500' : cdc.status === 'near_capacity' ? 'bg-amber-500' : 'bg-emerald-500'} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="font-bold uppercase text-slate-400">Enroll</p>
                            <p className="font-black text-slate-900">{formatNumber(cdc.enrollment)}</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase text-slate-400">Cap</p>
                            <p className="font-black text-slate-900">{formatNumber(cdc.effective_capacity)}</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase text-slate-400">Slots</p>
                            <p className="font-black text-slate-900">{formatNumber(cdc.available_slots)}</p>
                          </div>
                        </div>
                        {excessChildren > 0 ? (
                          <p className="mt-3 rounded-md bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
                            Over by {formatNumber(excessChildren)} children
                          </p>
                        ) : null}
                      </AnalyticsInsight>
                    );
                  })}
                  {!loading && topOperationalCdcs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No CDC capacity records yet.</div>
                  ) : null}
                </div>
              </section>
            </aside>
          </div>
          ) : null}

          {activeSection === 'cdc' ? (
            <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <ChartPanel title="CDC High Child Ratio" value="Centers with the highest children per teacher/caregiver" action="25:1 limit">
                  <Bar data={ratioChart} options={chartWithClick(openRatioChartItem)} />
                </ChartPanel>
                <div className="grid gap-3 md:grid-cols-2">
                  {highRatioCdcs.map((cdc) => (
                    <AnalyticsInsight
                      key={cdc.id}
                      as="article"
                      onOpen={setActiveInsight}
                      insight={{
                        title: `${cdc.name} Child Ratio`,
                        meaning: `${cdc.ratio}:1 children per teacher/caregiver.`,
                        methodology: 'Current enrollment divided by encoded teacher/caregiver count.',
                        period: 'Current CDC records.',
                        factors: [`Enrollment: ${formatNumber(cdc.enrollment)}`, `Teachers: ${formatNumber(cdc.teacher_count)}`, `Ratio: ${cdc.ratio}:1`],
                        actions: cdc.ratio > 25
                          ? ['Add teacher/caregiver support.', 'Split class/session or redirect enrollment if possible.']
                          : ['Monitor ratio during new enrollment.', 'Keep staffing records updated.'],
                      }}
                      className={`rounded-xl border p-4 ${cdc.ratio > 25 ? 'border-rose-200 bg-rose-50' : cdc.ratio >= 10 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-slate-950">{cdc.name}</h3>
                          <p className="text-xs font-semibold text-slate-600">{cdc.barangay}</p>
                        </div>
                        <Badge className={cdc.ratio > 25 ? statusStyles.service_gap : cdc.ratio >= 10 ? statusStyles.near_capacity : statusStyles.stable}>{Number(cdc.teacher_count) > 0 ? `${cdc.ratio}:1` : 'Staff data needed'}</Badge>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={(cdc.ratio / 25) * 100} tone={cdc.ratio > 25 ? 'bg-rose-500' : cdc.ratio >= 10 ? 'bg-amber-500' : 'bg-emerald-500'} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        {!Number(cdc.teacher_count) ? 'Record teacher/caregiver staffing to assess the ratio.' : cdc.ratio > 25
                          ? cdc.teacherShortage > 0 ? `Suggestion: add ${cdc.teacherShortage} teacher/caregiver or split sessions.` : 'Suggestion: split sessions or redirect new enrollees.'
                          : 'Suggestion: continue monitoring.'}
                      </p>
                    </AnalyticsInsight>
                  ))}
                </div>
              </div>
              <aside className="space-y-4">
                <ChartPanel title="Capacity Status" value="All CDCs" action="Share">
                  <Doughnut data={statusDonut} options={{ responsive: true, maintainAspectRatio: false, onClick: openCapacitySlice, onHover: (event) => { if (event?.native?.target) event.native.target.style.cursor = 'pointer'; }, plugins: { legend: { position: 'bottom' } } }} />
                </ChartPanel>
                <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-black text-slate-950">Fast Rules</h3>
                  <div className="mt-3 grid gap-2 text-sm font-semibold">
                    <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">Above 25:1: review staffing</div>
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">10:1 to 25:1: monitor</div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Below 10:1: stable</div>
                  </div>
                </section>
              </aside>
            </section>
          ) : null}

          {!isPlanningMonitor && activeSection === 'followup' ? (
            <section className="mt-5 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Named Children for Follow-up</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Use this only when CHO/CDW records include child names.</p>
                </div>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search barangay or child"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {childrenByBarangay.map((group) => (
                  <article key={group.barangay} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-amber-950">{group.barangay}</h3>
                        <p className="text-xs font-semibold text-amber-800">{formatNumber(group.children.length)} child record{group.children.length === 1 ? '' : 's'}</p>
                      </div>
                      <Badge className={needStyles[group.needLevel] || needStyles.watch}>{group.needLevel}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {(expandedGroups[group.barangay] ? group.children : group.children.slice(0, 6)).map((child) => (
                        <div key={child.id} className="rounded-lg bg-white px-3 py-2">
                          <p className="text-sm font-black text-slate-950">{child.name || 'Unnamed child'}</p>
                          <p className="text-xs font-semibold text-slate-500">Age {child.computed_age ?? child.age ?? 'N/A'} | Guardian: {child.parent_guardian_name || 'Not recorded'}</p>
                        </div>
                      ))}
                    </div>
                    {group.children.length > 6 && <button type="button" className="mt-3 text-sm font-bold text-blue-700" onClick={() => setExpandedGroups(current => ({ ...current, [group.barangay]: !current[group.barangay] }))}>{expandedGroups[group.barangay] ? 'Show less' : `View all ${group.children.length}`}</button>}
                    <p className="mt-3 text-sm font-semibold text-amber-900">Suggestion: validate record, then enroll, refer to SNP, or document why not eligible.</p>
                  </article>
                ))}
                {!loading && childrenByBarangay.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
                    No named children available. Use the Overview and Barangay Comparison graphs for aggregate planning.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <ChartInsightModal insight={activeInsight} onClose={() => setActiveInsight(null)} />
    </div>
  );
}

export default ServiceGapAnalyticsPage;
