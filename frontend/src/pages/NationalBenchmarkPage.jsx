import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import AppIcon from '../components/AppIcon';

const statusStyles = {
  meets: {
    label: 'Meets Standard',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    ring: '#16a34a',
    soft: 'bg-emerald-50',
  },
  near: {
    label: 'Needs Attention',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    ring: '#f97316',
    soft: 'bg-amber-50',
  },
  attention: {
    label: 'Needs Attention',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    ring: '#f97316',
    soft: 'bg-amber-50',
  },
  below: {
    label: 'Critical',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    text: 'text-rose-700',
    ring: '#ef4444',
    soft: 'bg-rose-50',
  },
  critical: {
    label: 'Critical',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    text: 'text-rose-700',
    ring: '#ef4444',
    soft: 'bg-rose-50',
  },
  no_data: {
    label: 'No record available yet',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
    text: 'text-slate-500',
    ring: '#94a3b8',
    soft: 'bg-slate-50',
  },
  data_needed: {
    label: 'Not yet recorded',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
    text: 'text-slate-500',
    ring: '#94a3b8',
    soft: 'bg-slate-50',
  },
};

const areaDetails = {
  health_nutrition_safety: {
    icon: 'nutrition',
    accent: 'text-emerald-600',
    keywords: 'Health, nutrition, safety',
    evidence: 'Health services, feeding program, safe water, child health records, emergency readiness, first aid, and child protection records.',
    value: 'Keeps every CDC accountable for children being healthy, nourished, protected, and ready for emergencies.',
  },
  physical_environment_safety: {
    icon: 'building',
    accent: 'text-blue-600',
    keywords: 'Facilities, utilities, hygiene',
    evidence: 'CDC facility profile, classroom condition, sanitation, water, electricity, emergency readiness, safety equipment, and facility assessment records.',
    value: 'Confirms that children learn in a safe, functional, and hygienic physical environment.',
  },
  staff_qualifications_development: {
    icon: 'users',
    accent: 'text-purple-600',
    keywords: 'Qualifications, training, support',
    evidence: 'Assigned CDW, active staff profiles, qualifications, trainings, certificates, duty schedules, and supervision ratio.',
    value: 'Protects quality by checking whether children are guided by enough trained and qualified adults.',
  },
  curriculum_instruction_assessment: {
    icon: 'curriculum',
    accent: 'text-cyan-600',
    keywords: 'Curriculum, instruction, assessment',
    evidence: 'Curriculum plans, LRPs or guides, NELF/ELDS alignment, toddler or preschool program records, daily schedules, and child assessments.',
    value: 'Connects daily teaching practice to developmentally appropriate learning and documented child progress.',
  },
  family_community_linkages: {
    icon: 'barangay',
    accent: 'text-teal-600',
    keywords: 'Parents, community, linkages',
    evidence: 'Parent or guardian information, contact records, volunteers, community activities, referral coordination, and parent/community reports.',
    value: 'Measures how well the CDC stays connected with families, barangay partners, and support networks.',
  },
  leadership_management_support: {
    icon: 'shield',
    accent: 'text-indigo-600',
    keywords: 'Leadership, management, support',
    evidence: 'CDC profile, operating schedule, capacity, status, authority or permit records, accreditation status, reports, and monitoring history.',
    value: 'Checks whether the CDC has the management structure and oversight needed for reliable service delivery.',
  },
  child_records_program_readiness: {
    icon: 'children',
    accent: 'text-rose-600',
    keywords: 'Child records, population, readiness',
    evidence: 'Student profiles, enrollment records, guardian details, current population basis, service gap analysis, capacity readiness, and recent CDC reports.',
    value: 'Shows whether child records and population-based planning data are ready for CDC service decisions.',
  },
};

const filterOptions = [
  { value: 'all', label: 'All Barangays' },
  { value: 'meets', label: 'Meets Standard' },
  { value: 'attention', label: 'Needs Attention' },
  { value: 'critical', label: 'Critical' },
  { value: 'no_data', label: 'No CDC Data' },
];

const formatPercent = (value) => `${Number(value || 0).toFixed(0)}%`;

const getAreaStatus = (score) => {
  if (score == null) return 'data_needed';
  if (score >= 80) return 'meets';
  if (score >= 60) return 'attention';
  return 'critical';
};

const getScoreRing = (value, status) => {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  const color = statusStyles[status]?.ring || statusStyles.no_data.ring;
  return {
    background: `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)`,
  };
};

const MetricCard = ({ title, value, hint, icon, tone = 'default', progress }) => {
  const toneClass =
    tone === 'good'
      ? 'from-emerald-50 to-white'
      : tone === 'alert'
        ? 'from-rose-50 to-white'
        : tone === 'warning'
          ? 'from-amber-50 to-white'
          : 'from-sky-50 to-white';

  return (
    <div className={`rounded-xl border border-slate-200 bg-gradient-to-br ${toneClass} p-3 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-base font-black text-[#0f4b94] shadow-sm">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-1 break-words text-xl font-black leading-snug text-slate-900">{value}</p>
          <p className="mt-1 text-xs leading-4 text-slate-500">{hint}</p>
        </div>
      </div>
      {progress != null ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
};

const FlipStandardCard = ({ area, summary, index }) => {
  const [flipped, setFlipped] = useState(false);
  const score = summary?.average_score;
  const status = getAreaStatus(score);
  const styles = statusStyles[status] || statusStyles.no_data;
  const details = areaDetails[area.key] || {
    icon: 'reports',
    accent: 'text-slate-600',
    keywords: area.label,
    evidence: area.data_gap_note || 'Evidence details are not configured yet.',
    value: 'This area supports a complete picture of CDC compliance.',
  };

  return (
    <button
      type="button"
      onClick={() => setFlipped((current) => !current)}
      className={`group rounded-2xl text-left outline-none [perspective:1200px] ${flipped ? 'min-h-[250px]' : 'min-h-[130px]'}`}
      aria-pressed={flipped}
    >
      <div className={`relative rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? 'min-h-[250px] [transform:rotateY(180deg)]' : 'min-h-[130px]'}`}>
        <div className="relative min-h-[130px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-lg [backface-visibility:hidden]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-xs font-black text-white">
                {index + 1}
              </span>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg font-black ${details.accent}`}>
                <AppIcon name={details.icon} className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black leading-5 text-slate-900">{area.label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{details.keywords}</p>
              </div>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-1" style={getScoreRing(score, status)}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-black text-slate-900">
                {score == null ? '--' : formatPercent(score)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-600">{area.measurable_indicator_count} indicators</p>
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${styles.badge}`}>{styles.label}</span>
          </div>
        </div>

        <div className="absolute inset-0 flex overflow-hidden rounded-2xl border border-[#2563eb]/20 bg-slate-900 p-3 text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex min-h-0 flex-col overflow-y-auto pr-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-sky-200">Standard Definition</p>
                <h3 className="mt-1 text-base font-black leading-5">{area.label}</h3>
              </div>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white">{score == null ? 'No data' : formatPercent(score)}</span>
            </div>
            <p className="mt-2 text-xs leading-4 text-slate-200">{area.description}</p>
            <div className="mt-2 grid gap-1.5 text-xs leading-4 text-slate-200">
              <p><span className="font-bold text-white">Evidence:</span> {details.evidence}</p>
              <p><span className="font-bold text-white">Why it matters:</span> {details.value}</p>
            </div>
            {area.data_gap_note ? (
              <p className="mt-auto pt-2 text-xs leading-4 text-amber-100">{area.data_gap_note}</p>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
};

const AreaDots = ({ areas = [] }) => (
  <div className="flex flex-wrap gap-1.5">
    {areas.map((area) => {
      const status = area.status || getAreaStatus(area.score);
      const color =
        status === 'meets'
          ? 'bg-emerald-500'
          : status === 'near' || status === 'attention'
            ? 'bg-amber-500'
            : status === 'below' || status === 'critical'
              ? 'bg-rose-500'
              : 'bg-slate-300';
      return <span key={area.key} className={`h-2.5 w-2.5 rounded-full ${color}`} title={`${area.label}: ${area.score ?? 'Data needed'}`} />;
    })}
  </div>
);

const NationalBenchmarkPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadBenchmarks() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/benchmarks/');
        if (!isMounted) return;
        setData(response.data);
      } catch (requestError) {
        if (!isMounted) return;
        console.error('Failed to load national benchmark comparison', requestError);
        setError('Failed to load national benchmark comparison.');
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

  const rows = useMemo(() => {
    const items = data?.barangay_comparison || [];
    return items.filter((item) => {
      const matchesFilter = filter === 'all' || item.status_code === filter;
      const matchesQuery = item.barangay_name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  const filterCounts = useMemo(() => {
    const items = data?.barangay_comparison || [];
    return {
      all: items.length,
      meets: items.filter((item) => item.status_code === 'meets').length,
      attention: items.filter((item) => item.status_code === 'attention').length,
      critical: items.filter((item) => item.status_code === 'critical').length,
      no_data: items.filter((item) => item.status_code === 'no_data').length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-52 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-600" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || 'Unable to load national benchmark comparison.'}</p>;
  }

  const standardReference = data.national_standard_reference || {};
  const overview = data.overview || {};
  const areaSummary = data.area_summary || [];
  const totalBarangays = overview.total_barangays || data.barangay_comparison?.length || 0;
  const assessedProgress = overview.total_cdcs_assessed ? 86 : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#2563eb]">National Benchmark</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">CDC Standards Dashboard</h1>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-bold text-slate-900">{standardReference.issuing_body}</p>
            <p>{standardReference.approval_date}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricCard
            title="CDCs Assessed"
            value={overview.total_cdcs_assessed || 0}
            hint={`${overview.barangays_with_data || 0} barangays with data`}
            icon={<AppIcon name="building" className="h-5 w-5" />}
            progress={assessedProgress}
          />
          <MetricCard
            title="Average CDC Compliance"
            value={formatPercent(overview.average_cdc_compliance)}
            hint="Across measurable standards"
            icon={<AppIcon name="score" className="h-5 w-5" />}
            tone="good"
          />
          <MetricCard
            title="Barangays Meeting Standard"
            value={overview.barangays_meeting_all_standards || 0}
            hint={`${totalBarangays ? Math.round(((overview.barangays_meeting_all_standards || 0) / totalBarangays) * 100) : 0}% of barangays`}
            icon={<AppIcon name="shield" className="h-5 w-5" />}
            tone="good"
          />
          <MetricCard
            title="Barangays Needing Attention"
            value={overview.barangays_needing_attention || 0}
            hint={`${totalBarangays ? Math.round(((overview.barangays_needing_attention || 0) / totalBarangays) * 100) : 0}% of barangays`}
            icon={<AppIcon name="bell" className="h-5 w-5" />}
            tone="warning"
          />
          <MetricCard
            title="Weakest System Area"
            value={overview.weakest_system_area ? formatPercent(overview.weakest_system_area.average_score) : 'No data'}
            hint={overview.weakest_system_area?.label || 'Area score pending'}
            icon={<AppIcon name="gap" className="h-5 w-5" />}
            tone="alert"
          />
          <MetricCard
            title="Top Barangay"
            value={overview.top_barangay?.barangay_name || 'No data'}
            hint={overview.top_barangay ? `${formatPercent(overview.top_barangay.average_compliance)} avg compliance` : 'Pending'}
            icon={<AppIcon name="trophy" className="h-5 w-5" />}
            tone="good"
          />
          <MetricCard
            title="Most At-Risk Barangay"
            value={overview.most_at_risk_barangay?.barangay_name || 'No data'}
            hint={overview.most_at_risk_barangay ? `${formatPercent(overview.most_at_risk_barangay.average_compliance)} avg compliance` : 'Pending'}
            icon={<AppIcon name="map" className="h-5 w-5" />}
            tone="alert"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">National Standard Areas</h2>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Meets Standard</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Needs Attention</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Critical</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />No record available yet</span>
          </div>
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {(standardReference.areas || []).map((area, index) => {
            const summary = areaSummary.find((item) => item.key === area.key);
            return <FlipStandardCard key={area.key} area={area} summary={summary} index={index} />;
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Barangay Compliance Comparison</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <span className="sr-only">Search barangay</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search barangay..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm outline-none sm:w-72"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">/</span>
              </label>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({filterCounts[option.value] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1440px] [&_th]:leading-5 [&_td]:py-4 [&_td]:align-middle [&_td]:leading-5">
            <thead>
              <tr>
                <th>Rank</th>
                <th className="min-w-[180px]">Barangay</th>
                <th className="min-w-[160px]">Status</th>
                <th>Total CDCs</th>
                <th>Avg Compliance</th>
                <th>Compliant CDCs</th>
                <th>At-Risk CDCs</th>
                <th>Data Coverage</th>
                <th className="min-w-[180px]">Strongest Area</th>
                <th className="min-w-[180px]">Weakest Area</th>
                <th>Area Scores</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowStyle = statusStyles[row.status_code] || statusStyles.no_data;
                return (
                  <tr key={row.barangay_name} className="hover:bg-slate-50">
                    <td>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-black text-[#2563eb]">{row.barangay_name}</p>
                        <p className="text-xs text-slate-500">{row.total_cdcs} CDCs linked</p>
                      </div>
                    </td>
                    <td>
                      <span title={row.status} className={`inline-flex whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-bold leading-5 ${rowStyle.badge}`}>
                        {row.status_code === 'no_data' ? 'No CDC data' : rowStyle.label}
                      </span>
                    </td>
                    <td className="font-bold text-slate-900">{row.total_cdcs}</td>
                    <td>
                      <div className="flex min-w-[120px] items-center gap-3 whitespace-nowrap">
                        <span className="w-10 text-sm font-bold text-slate-900">{formatPercent(row.average_compliance)}</span>
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                          <span className={`block h-full rounded-full ${row.average_compliance >= 80 ? 'bg-emerald-500' : row.average_compliance >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(0, Math.min(100, row.average_compliance))}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="font-bold text-emerald-700">{row.compliant_cdcs}</td>
                    <td className="font-bold text-rose-600">{row.at_risk_cdcs}</td>
                    <td>
                      <div className="flex min-w-[120px] items-center gap-3 whitespace-nowrap">
                        <span className="w-10 text-sm font-bold text-slate-900">{formatPercent(row.average_data_coverage)}</span>
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, row.average_data_coverage))}%` }} />
                        </span>
                      </div>
                    </td>
                    <td>
                      <p className="max-w-[150px] text-xs font-bold leading-5 text-slate-700">{row.strongest_area?.label || 'No record available yet'}</p>
                    </td>
                    <td>
                      <p className="max-w-[150px] text-xs font-bold leading-5 text-slate-700">{row.weakest_area?.label || 'No record available yet'}</p>
                    </td>
                    <td>
                      <AreaDots areas={row.area_details || []} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              No barangays match the current search or filter.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default NationalBenchmarkPage;
