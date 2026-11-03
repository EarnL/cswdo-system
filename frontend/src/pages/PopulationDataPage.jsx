import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import api from '../api';
import PopulationAdoptionStatus from '../components/PopulationAdoptionStatus';
import ChildTransfers from '../components/ChildTransfers';
import ChartInsightModal from '../components/ChartInsightModal';
import { LoadingSpinner, LoadingState } from '../components/LoadingState';
import { getExtremes, simpleFinding, sliceInsight } from '../utils/chartInsights';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;
const POPULATION_ACTION_TIMEOUT_MS = 5 * 60 * 1000;

const ageLabels = {
  early_childhood_0_2: 'Early Childhood 0-2',
  daycare_3_4: 'Daycare 3-4',
  kindergarten_5: 'Kindergarten 5',
  early_school_6_9: 'Early School 6-9',
  pre_teen_10_12: 'Pre-Teen 10-12',
  adolescents_13_17: 'Adolescents 13-17',
  young_adults_18_24: 'Young Adults 18-24',
  adults_25_59: 'Adults 25-59',
  seniors_60_plus: 'Seniors 60+',
};

function StatCard({ label, value, tone = 'blue', hint }) {
  const tones = {
    blue: 'border-slate-200 bg-white text-[#0f4b94]',
    green: 'border-slate-200 bg-white text-emerald-700',
    amber: 'border-slate-200 bg-white text-amber-700',
    rose: 'border-slate-200 bg-white text-slate-700',
  };

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function HistoryNote({ item }) {
  const latest = item?.history?.[0];
  if (!latest) return null;
  return (
    <div className="mt-3 border-l-2 border-slate-200 pl-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Latest update</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{latest.message}</p>
      {latest.remarks ? <p className="mt-1 text-xs text-slate-500">Remarks: {latest.remarks}</p> : null}
    </div>
  );
}

function PopulationDataPage() {
  const location = useLocation();
  const userRole = localStorage.getItem('role') || '';
  const isAdmin = userRole === 'admin';
  const [receivedData, setReceivedData] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [activeChartInsight, setActiveChartInsight] = useState(null);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [historyLimit, setHistoryLimit] = useState(8);
  const notificationFocus = useMemo(() => new URLSearchParams(location.search).get('notification_focus') || '', [location.search]);
  const isPendingPopulationFocus = notificationFocus === 'cswdo_population_waiting';
  const isActionProcessing = Boolean(actionState);
  const actionKey = actionState?.key || '';

  useEffect(() => {
    if (!actionKey) return undefined;
    const timer = window.setTimeout(() => {
      setActionState((current) => (
        current ? { ...current, message: 'Still updating population data. Please wait...' } : current
      ));
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [actionKey]);

  const fetchPopulationData = useCallback(async () => {
    try {
      setLoading(true);
      const [populationResponse, academicYearResponse] = await Promise.all([
        api.get('/population-data/'),
        api.get('/academic-years/'),
      ]);
      const years = academicYearResponse.data || [];
      const visibleStatuses = isAdmin
        ? ['sent_to_cswdo', 'received_by_cswdo', 'current_basis', 'archived', 'rejected_by_admin']
        : ['received_by_cswdo', 'current_basis', 'archived'];
      const cswdoData = (populationResponse.data || []).filter((item) => visibleStatuses.includes(item.status));
      const activeYear = years.find((item) => item.is_active) || years[0];
      setAcademicYears(years);
      setReceivedData(cswdoData);
      setSelectedAcademicYear((current) => current || String(activeYear?.id || cswdoData[0]?.academic_year || ''));
      setError('');
    } catch (err) {
      console.error('Failed to fetch population data:', err);
      setError('Failed to load population data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPopulationData();
  }, [fetchPopulationData]);

  const handleMarkReceived = async (dataId) => {
    if (!isAdmin || isActionProcessing) return;
    setFeedback(null);
    setActionState({
      key: `${dataId}-receive`,
      title: 'Applying new population basis',
      message: 'Updating population-dependent records and displays...',
    });
    try {
      await api.post(
        `/population-data/${dataId}/mark_received_by_cswdo/`,
        null,
        { timeout: POPULATION_ACTION_TIMEOUT_MS }
      );
      await fetchPopulationData();
      setFeedback({
        type: 'success',
        title: 'New population basis applied successfully.',
        message: 'City planning figures are updated. CDWs can review and apply the update from their dashboards. Child records are retained.',
      });
    } catch (err) {
      console.error('Failed to mark as received:', err);
      setFeedback({
        type: 'error',
        title: 'Failed to apply the new population basis.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'Please try again.',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleArchivePopulationBasis = async (dataId) => {
    if (!isAdmin || isActionProcessing) return;
    const confirmed = window.confirm('Mark this population data as outdated and move it to history? Current planning data will be rebuilt from the latest available basis, or cleared if no replacement exists.');
    if (!confirmed) return;

    setFeedback(null);
    setActionState({
      key: `${dataId}-archive`,
      title: 'Applying new population basis',
      message: 'Updating population-dependent records and displays...',
    });
    try {
      await api.post(
        `/population-data/${dataId}/archive_population_basis/`,
        null,
        { timeout: POPULATION_ACTION_TIMEOUT_MS }
      );
      setSelectedAnalysis(null);
      await fetchPopulationData();
      setFeedback({
        type: 'success',
        title: 'New population basis applied successfully.',
        message: 'The outdated basis was moved to history and all population-dependent displays were refreshed.',
      });
    } catch (err) {
      console.error('Failed to archive population basis:', err);
      setFeedback({
        type: 'error',
        title: 'Failed to apply the new population basis.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'Please try again.',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleRejectPopulationData = async (dataId) => {
    if (!isAdmin || isActionProcessing) return;
    const remarks = window.prompt('Add rejection remarks for the history log, or leave blank.');
    if (remarks === null) return;

    setFeedback(null);
    setActionState({
      key: `${dataId}-reject`,
      title: 'Rejecting population data',
      message: 'Recording Admin decision. Please wait...',
    });
    try {
      await api.post(
        `/population-data/${dataId}/reject_population_data/`,
        { remarks },
        { timeout: POPULATION_ACTION_TIMEOUT_MS }
      );
      await fetchPopulationData();
      setFeedback({
        type: 'success',
        title: 'Population data rejected.',
        message: 'The forwarded file was moved to history and was not applied as the current basis.',
      });
    } catch (err) {
      console.error('Failed to reject population data:', err);
      setFeedback({
        type: 'error',
        title: 'Failed to reject population data.',
        message: err?.response?.data?.error || err?.response?.data?.detail || 'Please try again.',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleDownload = (data) => {
    if (isActionProcessing) return;
    if (!data?.data_file) {
      alert('No uploaded file is available for download.');
      return;
    }
    window.open(data.data_file, '_blank', 'noopener,noreferrer');
  };

  const scopedReceivedData = useMemo(() => {
    if (!selectedAcademicYear) return receivedData;
    return receivedData.filter((item) => String(item.academic_year) === String(selectedAcademicYear));
  }, [receivedData, selectedAcademicYear]);

  const processedData = useMemo(
    () => scopedReceivedData.filter((item) => item.status === 'current_basis'),
    [scopedReceivedData]
  );
  const pendingData = useMemo(
    () => (isAdmin ? scopedReceivedData.filter((item) => item.status === 'sent_to_cswdo') : []),
    [isAdmin, scopedReceivedData]
  );
  const historyData = useMemo(
    () =>
      receivedData.filter((item) => {
        if (['archived', 'received_by_cswdo', 'rejected_by_admin'].includes(item.status)) return true;
        return selectedAcademicYear && String(item.academic_year) !== String(selectedAcademicYear) && item.status !== 'sent_to_cswdo';
      }),
    [receivedData, selectedAcademicYear]
  );
  const selectedAcademicYearRecord = academicYears.find((year) => String(year.id) === String(selectedAcademicYear));

  const totals = useMemo(() => {
    return processedData.reduce(
      (acc, item) => {
        acc.population += item.total_population || 0;
        acc.records += item.total_records || 0;
        acc.sources += item.data_sources || 0;
        return acc;
      },
      { population: 0, records: 0, sources: 0 }
    );
  }, [processedData]);

  const analysis = selectedAnalysis?.analysis_results || {};
  const executiveSummary = analysis.executive_summary || {};
  const barangayBreakdown = analysis.geographic_analysis?.barangay_breakdown || selectedAnalysis?.barangay_breakdown || {};
  const barangayRows = Object.entries(barangayBreakdown);
  const ageDistribution = analysis.age_distribution || selectedAnalysis?.age_distribution || {};
  const ageRows = Object.entries(ageDistribution).filter(([key]) => !key.includes('0_1'));
  const interventions = analysis.risk_assessment?.intervention_priorities || [];
  const policyRecommendations = analysis.policy_recommendations || {};
  const staffing = analysis.resource_allocation?.staffing_requirements || {};
  const facilities = analysis.resource_allocation?.facility_needs || {};
  const filteredBarangayRows = useMemo(() => {
    return barangayRows.filter(([barangay, data]) => {
      const matchesSearch = barangay.toLowerCase().includes(barangaySearch.trim().toLowerCase());
      const matchesPriority = priorityFilter === 'all' || (data.planning_priority || 'standard') === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [barangayRows, barangaySearch, priorityFilter]);
  const topBarangays = filteredBarangayRows.slice(0, 8);
  const topChildrenBarangays = filteredBarangayRows.slice(0, 5);
  const highestUnderFiveBarangays = [...filteredBarangayRows]
    .sort((a, b) => (b[1].under_five_total || 0) - (a[1].under_five_total || 0))
    .slice(0, 5);
  const highestVulnerabilityBarangays = [...filteredBarangayRows]
    .sort(
      (a, b) =>
        ((b[1].low_income_families || 0) + (b[1].persons_with_disability || 0) + (b[1].single_parent_households || 0)) -
        ((a[1].low_income_families || 0) + (a[1].persons_with_disability || 0) + (a[1].single_parent_households || 0))
    )
    .slice(0, 5);

  const barangayChildrenChartData = useMemo(() => ({
    labels: topBarangays.map(([barangay]) => barangay),
    datasets: [
      {
        label: 'Children 0-17',
        data: topBarangays.map(([, data]) => data.children_total || 0),
        backgroundColor: '#0284c7',
        borderRadius: 12,
      },
      {
        label: 'Under 5',
        data: topBarangays.map(([, data]) => data.under_five_total || 0),
        backgroundColor: '#f59e0b',
        borderRadius: 12,
      },
    ],
  }), [topBarangays]);

  const ageChartData = useMemo(() => ({
    labels: ageRows.map(([key]) => ageLabels[key] || key),
    datasets: [
      {
        data: ageRows.map(([, data]) => data.count || 0),
        backgroundColor: ['#0f766e', '#0284c7', '#7c3aed', '#f59e0b', '#ef4444', '#14b8a6', '#2563eb', '#64748b', '#a855f7'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  }), [ageRows]);

  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      const element = elements?.[0];
      if (!element) return;
      const [barangay, data] = topBarangays[element.index] || [];
      setActiveChartInsight({
        title: 'Children by Barangay',
        selectedLabel: barangay,
        selectedValue: `${formatNumber(data?.children_total || 0)} children 0-17`,
        meaning: 'This bar chart shows where children are concentrated by barangay. It helps CSWDO see which areas may need more CDC slots, outreach, or child-development support.',
        itemInsight: `${barangay} has ${formatNumber(data?.children_total || 0)} children ages 0-17 and ${formatNumber(data?.under_five_total || 0)} children under five. A high under-five count matters because these children are closest to CDC service age.`,
        findings: simpleFinding({
          ...getExtremes(topBarangays.map(([name, row]) => ({ name, ...row })), (row) => row.children_total),
          labelGetter: (row) => row.name,
          unit: ' children ages 0-17',
        }),
        methodology: 'The chart plots children ages 0-17 and under-five counts from the analyzed barangay breakdown.',
        period: selectedAnalysis?.title || 'Selected population submission',
        factors: ['Barangay-level child population', 'Under-five population', 'Current search and priority filters', 'Uploaded population dataset quality'],
        actions: ['Prioritize barangays with high under-five counts for CDC and child-development planning.', 'Compare child population with service gap analytics.', 'Use the filtered table below for exact barangay records.'],
      });
    },
    onHover: (event) => {
      if (event?.native?.target) event.native.target.style.cursor = 'pointer';
    },
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  }), [selectedAnalysis?.title, topBarangays]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    onClick: (_event, elements) => {
      const element = elements?.[0];
      if (!element) return;
      const [key, data] = ageRows[element.index] || [];
      setActiveChartInsight({
        title: 'Population Age Profile',
        selectedLabel: ageLabels[key] || key,
        selectedValue: `${formatNumber(data?.count || 0)} people`,
        meaning: 'This round chart shows the age mix of the submitted population. It helps users see whether planning should focus more on young children, school-age children, adolescents, adults, or seniors.',
        itemInsight: sliceInsight({
          label: ageLabels[key] || key,
          value: data?.count || 0,
          total: ageRows.reduce((sum, [, item]) => sum + Number(item?.count || 0), 0),
          action: ['Daycare 3-4'].includes(ageLabels[key] || key)
            ? 'This group is important for CDC and early childhood planning.'
            : 'Use this group for the matching CSWDO program or referral plan.',
        }),
        findings: simpleFinding({
          ...getExtremes(ageRows.map(([ageKey, row]) => ({ label: ageLabels[ageKey] || ageKey, ...row })), (row) => row.count),
          labelGetter: (row) => row.label,
          unit: ' people',
        }),
        methodology: 'Age groups are counted from the selected population file and displayed as proportional segments.',
        period: selectedAnalysis?.title || 'Selected population submission',
        factors: ['Age group counts', 'Uploaded records', 'Barangay data coverage', 'Data quality score'],
        actions: ['Use under-five and child-age groups for CDC planning.', 'Use adolescent and adult groups for complementary CSWDO services.', 'Check data quality before using the distribution for major decisions.'],
      });
    },
    onHover: (event) => {
      if (event?.native?.target) event.native.target.style.cursor = 'pointer';
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 14 },
      },
    },
  }), [ageRows, selectedAnalysis?.title]);

  const handleExportBarangayCsv = () => {
    if (!filteredBarangayRows.length) {
      alert('No barangay summary is available for export.');
      return;
    }

    const headers = [
      'Barangay',
      'Total Population',
      'Children 0-17',
      'Under 5',
      'School Age 6-12',
      'Adolescents 13-17',
      'Persons With Disability',
      'Single Parent Households',
      'Low Income Families',
      'Planning Priority',
    ];

    const lines = filteredBarangayRows.map(([barangay, data]) => [
      barangay,
      data.count || 0,
      data.children_total || 0,
      data.under_five_total || 0,
      data.school_age_total || 0,
      data.adolescent_total || 0,
      data.persons_with_disability || 0,
      data.single_parent_households || 0,
      data.low_income_families || 0,
      data.planning_priority || 'standard',
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (selectedAnalysis?.title || 'population-summary').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.href = url;
    link.download = `${safeTitle}-barangay-summary.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintSummary = () => {
    if (!selectedAnalysis) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Please allow pop-ups to print the planning summary.');
      return;
    }

    const summaryRows = filteredBarangayRows
      .map(
        ([barangay, data]) => `
          <tr>
            <td>${barangay}</td>
            <td>${formatNumber(data.count)}</td>
            <td>${formatNumber(data.children_total)}</td>
            <td>${formatNumber(data.under_five_total)}</td>
            <td>${formatNumber(data.school_age_total)}</td>
            <td>${formatNumber(data.adolescent_total)}</td>
            <td>${data.planning_priority || 'standard'}</td>
          </tr>
        `
      )
      .join('');

    const highlights = (analysis.planning_highlights || []).map((item) => `<li>${item}</li>`).join('');
    const topBarangayLabel = executiveSummary.highest_child_population_barangay?.barangay || 'N/A';
    const topBarangayCount = executiveSummary.highest_child_population_barangay?.children_total || 0;

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedAnalysis.title} - CSWDO Planning Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
            h1, h2, h3 { margin-bottom: 8px; }
            .meta, .cards { margin-bottom: 24px; }
            .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
            .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #e2e8f0; }
            ul { margin-top: 8px; }
          </style>
        </head>
        <body>
          <h1>CSWDO Barangay Population Planning Summary</h1>
          <div class="meta">
            <p><strong>Submission:</strong> ${selectedAnalysis.title}</p>
            <p><strong>Prepared from analytics dashboard:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="cards">
            <div class="card"><strong>Total Population</strong><br />${formatNumber(executiveSummary.total_population || selectedAnalysis.total_population)}</div>
            <div class="card"><strong>Children 0-17</strong><br />${formatNumber(executiveSummary.child_population)}</div>
            <div class="card"><strong>Under Five</strong><br />${formatNumber(executiveSummary.under_five_population)}</div>
            <div class="card"><strong>Top Child Concentration</strong><br />${topBarangayLabel} (${formatNumber(topBarangayCount)})</div>
          </div>
          <h2>Planning Highlights</h2>
          <ul>${highlights}</ul>
          <h2>Barangay Summary Table</h2>
          <table>
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Total Population</th>
                <th>Children</th>
                <th>Under 5</th>
                <th>School Age</th>
                <th>Adolescents</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PopulationAdoptionStatus key={receivedData.map(item => `${item.id}-${item.status}`).join(',')} />
      {['admin', 'staff'].includes(userRole) && <ChildTransfers />}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f4b94]">CHO Population Data</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-bold text-slate-900">Population Data</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              {isAdmin
                ? 'Review files and manage the current population basis.'
                : 'View population figures and previous submissions.'}
            </p>
            {!isAdmin ? (
              <span className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                View Only
              </span>
            ) : null}
          </div>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Academic year</span>
            <select
              value={selectedAcademicYear}
              onChange={(event) => {
                setSelectedAcademicYear(event.target.value);
                setSelectedAnalysis(null);
              }}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}{year.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {selectedAcademicYearRecord?.is_active ? 'Using the active school year.' : 'Viewing historical basis.'}
            </p>
          </label>
        </div>
      </section>

      {loading && (
        <LoadingState title="Loading population analytics..." message="Fetching received files and barangay summaries." />
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <p className="text-lg font-semibold">Population data could not be loaded</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {actionState && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-sky-800 shadow-sm" role="status" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LoadingSpinner className="h-5 w-5 text-sky-700" />
            <div>
              <p className="font-black">{actionState.title}</p>
              <p className="mt-1 text-sm font-semibold text-sky-700">{actionState.message}</p>
            </div>
          </div>
        </div>
      )}

      {feedback && !actionState && (
        <div
          className={`rounded-xl border p-5 shadow-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
          aria-live="polite"
        >
          <p className="font-black">{feedback.title}</p>
          <p className="mt-1 text-sm font-semibold">{feedback.message}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Current Basis" value={formatNumber(processedData.length)} tone="green" hint={`${selectedAcademicYearRecord?.name || 'Selected year'} active population file`} />
            {isAdmin ? (
              <StatCard label="Pending Files" value={formatNumber(pendingData.length)} tone="amber" hint="Awaiting review" />
            ) : (
              <StatCard label="Access" value="View Only" tone="amber" hint="Monitoring and analytics only" />
            )}
            <StatCard label="Total Population" value={formatNumber(totals.population)} tone="blue" hint="Current basis only" />
            <StatCard label="Historical Files" value={formatNumber(historyData.length)} tone="rose" hint="Previous submissions" />
          </div>

          {isAdmin && pendingData.length > 0 && (
            <section className={`rounded-2xl border border-amber-100 bg-white p-6 shadow-sm ${isPendingPopulationFocus ? 'notification-focus-ring' : ''}`}>
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Pending files</h2>
                  <p className="text-sm text-slate-600">Forwarded by City Planning for approval.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {pendingData.map((data) => (
                  <div key={data.id} className={`rounded-xl border border-amber-200 bg-amber-50/70 p-5 ${isPendingPopulationFocus ? 'notification-focus-ring' : ''}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{data.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Submitted by {data.submitted_by_name || 'Unknown'} for {data.academic_year_name || 'No academic year'} on {new Date(data.submitted_on).toLocaleDateString()}.
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatNumber(data.total_records)} records{data.description ? ` / ${data.description}` : ''}
                        </p>
                        <HistoryNote item={data} />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleDownload(data)}
                          disabled={isActionProcessing}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Download file
                        </button>
                        <button
                          onClick={() => handleMarkReceived(data.id)}
                          disabled={isActionProcessing}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                        >
                          {actionState?.key === `${data.id}-receive` ? (
                            <span className="inline-flex items-center gap-2">
                              <LoadingSpinner />
                              Processing...
                            </span>
                          ) : (
                            'Approve and set current basis'
                          )}
                        </button>
                        <button
                          onClick={() => handleRejectPopulationData(data.id)}
                          disabled={isActionProcessing}
                          className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionState?.key === `${data.id}-reject` ? (
                            <span className="inline-flex items-center gap-2">
                              <LoadingSpinner />
                              Rejecting...
                            </span>
                          ) : (
                            'Reject'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Current population basis</h2>
                <p className="text-sm text-slate-600">Approved CHO data used for planning.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {processedData.map((data) => (
                <div key={data.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{data.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Population: {formatNumber(data.total_population)} | Records: {formatNumber(data.total_records)} | Sources:{' '}
                        {formatNumber(data.data_sources)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Received by CSWDO: {data.received_by_cswdo_on ? new Date(data.received_by_cswdo_on).toLocaleDateString() : 'Pending'}
                      </p>
                      <HistoryNote item={data} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleDownload(data)}
                        disabled={isActionProcessing}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Download file
                      </button>
                      <button
                        onClick={() => setSelectedAnalysis(data)}
                        disabled={isActionProcessing}
                        className="rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
                      >
                        View analytics
                      </button>
                      {isAdmin ? (
                        <button
                          onClick={() => handleArchivePopulationBasis(data.id)}
                          disabled={isActionProcessing}
                          className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionState?.key === `${data.id}-archive` ? (
                            <span className="inline-flex items-center gap-2">
                              <LoadingSpinner />
                              Processing...
                            </span>
                          ) : (
                            'Mark outdated'
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {processedData.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-lg font-semibold text-slate-700">No current population basis yet</p>
                  <p className="mt-2 text-sm text-slate-500">No approved file for {selectedAcademicYearRecord?.name || 'this academic year'}.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Submission history</h2>
                <p className="text-sm text-slate-600">Previous files, kept separately from the current basis.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{historyData.length} file{historyData.length === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-5 space-y-3">
              {historyData.slice(0, historyLimit).map((data) => (
                <div key={data.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{data.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {data.academic_year_name || 'No academic year'} | {(data.status || '').replaceAll('_', ' ')} | {formatNumber(data.total_records)} records
                      </p>
                      <HistoryNote item={data} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAcademicYear(String(data.academic_year || ''));
                        setSelectedAnalysis(data);
                      }}
                      className="w-fit rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      View history
                    </button>
                  </div>
                </div>
              ))}
              {historyData.length > historyLimit && <button type="button" onClick={() => setHistoryLimit(historyLimit + 8)} className="lgu-button-secondary">Show more submissions</button>}
              {!historyData.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                  No historical population submissions yet.
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}

      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Population analytics</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">{selectedAnalysis.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-600">
                    {selectedAnalysis.academic_year_name || 'Reporting year not recorded'} / CHO data
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExportBarangayCsv}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handlePrintSummary}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Print summary
                  </button>
                  <button
                    onClick={() => setSelectedAnalysis(null)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close dashboard
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-8 p-6">
              {analysis.error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                  <p className="font-semibold">Analytics note</p>
                  <p className="mt-1 text-sm">{analysis.error}</p>
                </div>
              )}

              <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard label="Total Population" value={formatNumber(executiveSummary.total_population || selectedAnalysis.total_population)} tone="blue" />
                <StatCard label="Children 0-17" value={formatNumber(executiveSummary.child_population)} tone="green" hint={formatPercent(executiveSummary.child_population_percentage)} />
                <StatCard label="Under Five" value={formatNumber(executiveSummary.under_five_population)} tone="amber" />
                <StatCard
                  label="Data Quality"
                  value={formatPercent(analysis.data_quality_score)}
                  tone="rose"
                  hint={`Dependency ratio: ${formatPercent(analysis.dependency_ratio)}`}
                />
              </section>

              {(analysis.planning_highlights || []).length > 0 && (
                <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-6">
                  <h3 className="text-xl font-bold text-slate-900">Planning highlights</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {analysis.planning_highlights.map((item, index) => (
                      <div key={index} className="rounded-xl border border-sky-100 bg-white p-4 text-sm text-slate-700 shadow-sm">
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Children by barangay</h3>
                    <span className="text-sm text-slate-500">Top {topBarangays.length} barangays</span>
                  </div>
                  <div className="mt-5 h-[320px]">
                    {topBarangays.length > 0 ? (
                      <Bar data={barangayChildrenChartData} options={barChartOptions} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">No barangay chart data available.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Population age profile</h3>
                    <span className="text-sm text-slate-500">Submission distribution</span>
                  </div>
                  <div className="mt-5 h-[320px]">
                    {ageRows.length > 0 ? (
                      <Doughnut data={ageChartData} options={doughnutOptions} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">No age distribution data available.</div>
                    )}
                  </div>
                </div>
              </section>
              <ChartInsightModal insight={activeChartInsight} onClose={() => setActiveChartInsight(null)} />

              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Find a barangay</h3>
                    <p className="mt-1 text-sm text-slate-600">Search by name or priority.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search Barangay</span>
                      <input
                        type="text"
                        value={barangaySearch}
                        onChange={(event) => setBarangaySearch(event.target.value)}
                        placeholder="Type barangay name"
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Priority Filter</span>
                      <select
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="all">All priorities</option>
                        <option value="high">High priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="standard">Standard priority</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <StatCard label="Visible Barangays" value={formatNumber(filteredBarangayRows.length)} tone="blue" hint="Barangays currently shown in the summary below" />
                  <StatCard
                    label="High Priority"
                    value={formatNumber(filteredBarangayRows.filter(([, data]) => data.planning_priority === 'high').length)}
                    tone="rose"
                    hint="Barangays needing the strongest planning attention"
                  />
                  <StatCard
                    label="Children Covered"
                    value={formatNumber(filteredBarangayRows.reduce((sum, [, data]) => sum + (data.children_total || 0), 0))}
                    tone="green"
                    hint="Combined child population across filtered barangays"
                  />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Barangay planning summary</h3>
                    <span className="text-sm text-slate-500">{filteredBarangayRows.length} barangays</span>
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-left text-slate-600">
                        <tr>
                          <th className="rounded-l-2xl px-4 py-3 font-semibold">Barangay</th>
                          <th className="px-4 py-3 font-semibold">Total Pop.</th>
                          <th className="px-4 py-3 font-semibold">Children</th>
                          <th className="px-4 py-3 font-semibold">Under 5</th>
                          <th className="px-4 py-3 font-semibold">School Age</th>
                          <th className="px-4 py-3 font-semibold">Adolescents</th>
                          <th className="px-4 py-3 font-semibold">Vulnerable</th>
                          <th className="rounded-r-2xl px-4 py-3 font-semibold">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBarangayRows.map(([barangay, data]) => (
                          <tr key={barangay} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-4 py-3 font-semibold text-slate-800">{barangay}</td>
                            <td className="px-4 py-3">{formatNumber(data.count)}</td>
                            <td className="px-4 py-3">{formatNumber(data.children_total)}</td>
                            <td className="px-4 py-3">{formatNumber(data.under_five_total)}</td>
                            <td className="px-4 py-3">{formatNumber(data.school_age_total)}</td>
                            <td className="px-4 py-3">{formatNumber(data.adolescent_total)}</td>
                            <td className="px-4 py-3">
                              {formatNumber((data.low_income_families || 0) + (data.persons_with_disability || 0) + (data.single_parent_households || 0))}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                                  data.planning_priority === 'high'
                                    ? 'bg-rose-100 text-rose-700'
                                    : data.planning_priority === 'medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {data.planning_priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredBarangayRows.length === 0 && (
                          <tr>
                            <td colSpan="8" className="px-4 py-6 text-center text-slate-500">
                              No barangays match the current filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Priority barangay rankings</h3>
                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Highest Child Population</p>
                        <div className="mt-3 space-y-3">
                          {topChildrenBarangays.map(([barangay, data], index) => (
                            <div key={barangay} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{index + 1}. {barangay}</p>
                                <p className="text-xs text-slate-500">Children 0-17</p>
                              </div>
                              <p className="text-base font-bold text-sky-700">{formatNumber(data.children_total)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Highest Under-Five Need</p>
                        <div className="mt-3 space-y-3">
                          {highestUnderFiveBarangays.map(([barangay, data], index) => (
                            <div key={barangay} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{index + 1}. {barangay}</p>
                                <p className="text-xs text-slate-500">Under five</p>
                              </div>
                              <p className="text-base font-bold text-amber-700">{formatNumber(data.under_five_total)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">Highest Vulnerability Load</p>
                        <div className="mt-3 space-y-3">
                          {highestVulnerabilityBarangays.map(([barangay, data], index) => (
                            <div key={barangay} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{index + 1}. {barangay}</p>
                                <p className="text-xs text-slate-500">Low income + PWD + single parent</p>
                              </div>
                              <p className="text-base font-bold text-rose-700">
                                {formatNumber((data.low_income_families || 0) + (data.persons_with_disability || 0) + (data.single_parent_households || 0))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Executive planning brief</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Primary Target Area</p>
                        <p className="mt-2 text-xl font-bold text-slate-900">
                          {topChildrenBarangays[0]?.[0] || 'No target identified'}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          This barangay currently has the largest child population in the filtered view and should be considered first for program capacity review.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Early Childhood Focus</p>
                        <p className="mt-2 text-xl font-bold text-slate-900">
                          {highestUnderFiveBarangays[0]?.[0] || 'No target identified'}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Use this barangay for daycare, feeding, and early-childhood scheduling if CSWDO needs to phase implementation.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Recommended use: review the ranking cards first, apply a priority filter, then export the filtered table for your planning meeting or program proposal.
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Age distribution</h3>
                    <div className="mt-4 space-y-3">
                      {ageRows.map(([key, data]) => (
                        <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-800">{ageLabels[key] || key}</p>
                            <p className="text-sm text-slate-600">{formatNumber(data.count)} people</p>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(Number(data.percentage || 0), 100)}%` }} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {formatPercent(data.percentage)} of total population. {data.program_relevance}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-bold text-slate-900">Resource outlook</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-800">Required staff</p>
                        <p className="mt-2 text-2xl font-bold text-sky-700">{formatNumber(staffing.total_staff_required)}</p>
                        <p className="mt-1 text-slate-500">Staff-to-population ratio: {formatNumber(staffing.staff_to_population_ratio)} per 1,000 residents</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-800">Facility demand</p>
                        <p className="mt-2 text-2xl font-bold text-emerald-700">{formatNumber(facilities.daycare_centers)}</p>
                        <p className="mt-1 text-slate-500">Estimated daycare or CDC service points needed for the selected academic year population.</p>
                      </div>
                    </div>
                  </section>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="text-xl font-bold text-slate-900">Recommended interventions</h3>
                  <div className="mt-4 space-y-3">
                    {interventions.length > 0 ? (
                      interventions.map((item, index) => (
                        <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{item.intervention}</p>
                              <p className="mt-1 text-sm text-slate-600">Target population: {formatNumber(item.target_population)}</p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                                item.urgency === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.urgency}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No intervention priorities were generated for this dataset.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="text-xl font-bold text-slate-900">Policy and program directions</h3>
                  <div className="mt-4 space-y-4 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-800">Immediate actions</p>
                      <div className="mt-2 space-y-2">
                        {(policyRecommendations.immediate_actions || []).map((item, index) => (
                          <div key={index} className="rounded-[16px] bg-slate-50 px-4 py-3">{item}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Short-term programs</p>
                      <div className="mt-2 space-y-2">
                        {(policyRecommendations.short_term_programs || []).map((item, index) => (
                          <div key={index} className="rounded-[16px] bg-slate-50 px-4 py-3">{item}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Monitoring indicators</p>
                      <div className="mt-2 space-y-2">
                        {(policyRecommendations.monitoring_indicators || []).map((item, index) => (
                          <div key={index} className="rounded-[16px] bg-slate-50 px-4 py-3">{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PopulationDataPage;
