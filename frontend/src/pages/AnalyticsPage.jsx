import React from 'react';
import { Link } from 'react-router-dom';
import Charts from '../components/Charts';
import PopulationBasisNotice from '../components/PopulationBasisNotice';

const buildAnalyticsAreas = (basePath) => [
  {
    title: 'Service Gap Analytics',
    label: 'Underserved areas',
    description: 'Graphs for underserved barangays, high child ratio CDCs, and action suggestions.',
    to: `${basePath}/service-gap-analytics`,
    tone: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  {
    title: 'Barangay Service Comparison',
    label: 'Compare locations',
    description: 'Open Service Gap Analytics, then choose Barangay Comparison.',
    to: `${basePath}/service-gap-analytics`,
    tone: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  {
    title: 'CDC Load and Ratio',
    label: 'Capacity and staffing',
    description: 'Open Service Gap Analytics, then choose CDC Load.',
    to: `${basePath}/service-gap-analytics`,
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    title: 'Map Visualization',
    label: 'Geographic view',
    description: 'See service pressure and population distribution on the city map.',
    to: `${basePath}/population-map`,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    title: 'Predictive Analytics',
    label: 'Forecasting',
    description: 'Enrollment, demand, and staffing forecasts for planning.',
    to: `${basePath}/predictive-analytics`,
    tone: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  {
    title: 'National Benchmark',
    label: 'Standards check',
    description: 'Compare barangay and CDC performance against benchmark indicators.',
    to: `${basePath}/national-benchmark`,
    tone: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
];

function AnalyticsPage() {
  const role = localStorage.getItem('role') || 'admin';
  const basePath = role === 'staff' ? '/staff' : '/admin';
  const analyticsAreas = buildAnalyticsAreas(basePath).filter((area) => {
    if (role === 'staff') return !area.to.includes('predictive-analytics');
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PopulationBasisNotice />
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Daycare Center Analytics</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Daycare Center Analytics</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
              Quick graphs first, then open a focused dashboard when you need deeper barangay or CDC details.
            </p>
          </div>
          <Link to={`${basePath}/service-gap-analytics`} className="lgu-button-primary">
            Open Service Gaps
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">At a Glance</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">CDC Performance and Capacity</h2>
          </div>
          <p className="max-w-xl text-sm font-semibold text-slate-500">
            Click any chart to see the meaning and suggested next action.
          </p>
        </div>
        <Charts />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {analyticsAreas.map((area) => (
          <Link
            key={area.title}
            to={area.to}
            className={`rounded-[20px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${area.tone}`}
          >
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wide">
              {area.label}
            </span>
            <h2 className="mt-4 text-xl font-black">{area.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-5 opacity-80">{area.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default AnalyticsPage;
