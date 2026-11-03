import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import AppIcon from '../components/AppIcon';

const priorityStyles = {
  'High Priority': 'border-rose-200 bg-rose-50 text-rose-700',
  'Needs Monitoring': 'border-amber-200 bg-amber-50 text-amber-700',
  Manageable: 'border-sky-200 bg-sky-50 text-sky-700',
  'No Gap': 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const validationStyles = {
  'For Validation': 'border-amber-200 bg-amber-50 text-amber-700',
  'Possible for SNP': 'border-sky-200 bg-sky-50 text-sky-700',
  'Not Eligible': 'border-rose-200 bg-rose-50 text-rose-700',
  'Already Accommodated': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Unable to Contact': 'border-slate-200 bg-slate-50 text-slate-600',
};

const StatCard = ({ label, value, hint, icon, tone = 'sky' }) => {
  const toneMap = {
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
        </div>
        <span className={`rounded-xl p-2 ${toneMap[tone] || toneMap.sky}`}>
          <AppIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
};

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${className}`}>
    {children}
  </span>
);

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

function SNPPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [validationFilter, setValidationFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [recommendationsRes, barangaysRes] = await Promise.all([
          api.get('/integration/snp-recommendations/'),
          api.get('/barangays/'),
        ]);
        setRecommendations(normalizeList(recommendationsRes.data));
        setBarangays(normalizeList(barangaysRes.data));
      } catch (err) {
        console.error(err);
        setError('Unable to load SNP planning recommendations.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const matchesBarangay = barangayFilter === 'all' || String(item.barangay) === barangayFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority_level === priorityFilter;
      return matchesBarangay && matchesPriority;
    });
  }, [recommendations, barangayFilter, priorityFilter]);

  const possibleChildren = useMemo(() => {
    return filteredRecommendations.flatMap((item) =>
      (item.possible_snp_children || []).map((child) => ({
        ...child,
        source_barangay_id: item.barangay,
        source_priority: item.priority_level,
      }))
    ).filter((child) => (
      validationFilter === 'all' || child.validation_status === validationFilter
    ));
  }, [filteredRecommendations, validationFilter]);

  const weeklyPlans = useMemo(() => {
    return filteredRecommendations
      .filter((item) => Number(item.recommended_snp_slots || 0) > 0)
      .map((item) => ({
        ...item.weekly_plan,
        barangay_id: item.barangay,
        priority_level: item.priority_level,
        recommended_snp_slots: item.recommended_snp_slots,
      }));
  }, [filteredRecommendations]);

  const summary = useMemo(() => {
    const totalGap = filteredRecommendations.reduce((sum, item) => sum + Number(item.service_gap || 0), 0);
    const totalSlots = filteredRecommendations.reduce((sum, item) => sum + Number(item.recommended_snp_slots || 0), 0);
    const highPriority = filteredRecommendations.filter((item) => item.priority_level === 'High Priority').length;
    return {
      barangays: filteredRecommendations.length,
      totalGap,
      totalSlots,
      highPriority,
    };
  }, [filteredRecommendations]);

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">Supervised Neighborhood Play</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">SNP Planning and Recommendation</h1>
          </div>
          <Badge className="border-sky-200 bg-sky-50 text-sky-700">Planning basis only</Badge>
        </div>

        {error ? <div className="mt-4 lgu-alert-error">{error}</div> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Barangays Reviewed" value={summary.barangays} hint="Using current population basis" icon="barangay" />
          <StatCard label="Total Service Gap" value={summary.totalGap} hint="Eligible 3-4 minus CDC capacity/accommodated" icon="gap" tone="amber" />
          <StatCard label="Recommended SNP Slots" value={summary.totalSlots} hint="Suggested only, not enrollment" icon="children" tone="sky" />
          <StatCard label="High Priority Barangays" value={summary.highPriority} hint="Need validation first" icon="bell" tone="rose" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold text-slate-700">
            Barangay
            <select value={barangayFilter} onChange={(event) => setBarangayFilter(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
              <option value="all">All barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>{barangay.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Priority
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
              <option value="all">All priorities</option>
              <option value="High Priority">High Priority</option>
              <option value="Needs Monitoring">Needs Monitoring</option>
              <option value="Manageable">Manageable</option>
              <option value="No Gap">No Gap</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Validation Status
            <select value={validationFilter} onChange={(event) => setValidationFilter(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none">
              <option value="all">All validation statuses</option>
              <option value="For Validation">For Validation</option>
              <option value="Possible for SNP">Possible for SNP</option>
              <option value="Already Accommodated">Already Accommodated</option>
              <option value="Unable to Contact">Unable to Contact</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-xl font-black text-slate-950">Barangay SNP Planning Basis</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] text-left text-sm">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Eligible Children Aged 3-4</th>
                <th>CDC Capacity</th>
                <th>Current CDC Enrollment</th>
                <th>Service Gap</th>
                <th>Recommended SNP Slots</th>
                <th>Priority Level</th>
                <th>Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecommendations.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-slate-950">{item.barangay_name}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.population_3_4 || 0}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.cdc_capacity || 0}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.current_enrollment_3_4 || 0}</td>
                  <td className="px-4 py-3 font-black text-amber-700">{item.service_gap || 0}</td>
                  <td className="px-4 py-3 font-black text-sky-700">{item.recommended_snp_slots || 0}</td>
                  <td className="px-4 py-3">
                    <Badge className={priorityStyles[item.priority_level] || priorityStyles.Manageable}>{item.priority_level}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.suggested_action}</td>
                </tr>
              ))}
              {!filteredRecommendations.length ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No SNP planning recommendation available for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-xl font-black text-slate-950">Possible SNP Children</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] text-left text-sm">
            <thead>
              <tr>
                <th>Child Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Barangay</th>
                <th>Guardian Name</th>
                <th>Contact Number</th>
                <th>Address</th>
                <th>Enrollment Match Status</th>
                <th>Validation Status</th>
                <th>Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {possibleChildren.map((child) => (
                <tr key={`${child.source_barangay_id}-${child.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-slate-950">{child.name}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.age}</td>
                  <td className="px-4 py-3 font-semibold capitalize text-slate-700">{child.sex || 'Unspecified'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.barangay}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.guardian_name || 'Not yet recorded'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.contact_number || 'Not yet recorded'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.address || 'Not yet recorded'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.enrollment_match_status}</td>
                  <td className="px-4 py-3">
                    <Badge className={validationStyles[child.validation_status] || validationStyles['For Validation']}>{child.validation_status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{child.suggested_action}</td>
                </tr>
              ))}
              {!possibleChildren.length ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No possible SNP children available for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-950">This Week's Possible SNP List</h2>
          <Badge className="border-slate-200 bg-slate-50 text-slate-600">For CDW / Volunteer Validation</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {weeklyPlans.map((plan) => (
            <article key={plan.barangay_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{plan.barangay}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Suggested Slots: {plan.suggested_children} children</p>
                </div>
                <Badge className={priorityStyles[plan.priority_level] || priorityStyles.Manageable}>{plan.priority_level}</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Schedule: {plan.suggested_session_days}, {plan.suggested_time}</p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Venue: {plan.venue}</p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Assigned: {plan.assigned_cdw_or_volunteer}</p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Status: For CDW / Volunteer Validation</p>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">{plan.notes}</p>
            </article>
          ))}
          {!weeklyPlans.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 xl:col-span-2">
              No weekly SNP list is suggested for the selected filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default SNPPage;
