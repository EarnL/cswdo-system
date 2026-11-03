import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { TableSkeleton } from '../components/LoadingState';
import AppIcon from '../components/AppIcon';

const statusOptions = [
  { value: '', label: 'All capacity' },
  { value: 'available', label: 'Available' },
  { value: 'near', label: 'Near capacity' },
  { value: 'full', label: 'Full' },
  { value: 'unset', label: 'Capacity not set' },
];

function MetricCard({ label, value, hint, icon, tone = 'sky' }) {
  const tones = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return (
    <article className="lgu-card bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className={`summary-card-icon ${tones[tone] || tones.sky}`}>
          <AppIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
      {hint ? <p className="mt-3 text-sm text-slate-600">{hint}</p> : null}
    </article>
  );
}

function CDCSectionTable({ title, description, cdcs, basePath, getCapacityBadge, emptyMessage, featured = false }) {
  return (
    <div className={`overflow-hidden rounded-xl border ${featured ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className={`border-b px-4 py-3 ${featured ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className={`text-lg font-black ${featured ? 'text-emerald-950' : 'text-slate-950'}`}>{title}</h3>
            <p className={`mt-1 text-sm ${featured ? 'text-emerald-800' : 'text-slate-600'}`}>{description}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${featured ? 'bg-white text-emerald-800 ring-1 ring-emerald-200' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {cdcs.length} center{cdcs.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left">Center</th>
              <th className="px-4 py-3 text-left">Barangay</th>
              <th className="px-4 py-3 text-left">Enrollment</th>
              <th className="px-4 py-3 text-left">Capacity Status</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {cdcs.map((cdc) => {
              const badge = getCapacityBadge(cdc);
              const capacity = Number(cdc.max_capacity) || 0;
              const enrollment = Number(cdc.current_enrollment) || 0;
              const percent = capacity ? Math.min(100, Math.round((enrollment / capacity) * 100)) : 0;

              return (
                <tr key={cdc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-900">{cdc.name}</p>
                    <p className="text-sm text-slate-500">{cdc.assigned_cdw_name || cdc.contact_person || 'Assigned worker not set'}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{cdc.barangay_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-black text-slate-900">{enrollment} / {capacity}</span>
                      <span className="text-xs font-bold text-slate-500">{percent}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${percent >= 100 ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{cdc.address || 'Address not available'}</p>
                    <p className="text-sm text-slate-500">
                      {cdc.latitude ?? 'N/A'}, {cdc.longitude ?? 'N/A'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`${basePath}/${cdc.id}`}
                      className="lgu-button-secondary px-3 py-2"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              );
            })}
            {cdcs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DaycareCentersPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : 'admin';
  const basePath = role === 'cdw'
    ? '/cdw/cdc-information'
    : role === 'staff'
      ? '/staff/daycare-centers'
      : '/admin/daycare-centers';
  const canOpenRegistration = role === 'admin';
  const isCdwView = role === 'cdw';
  const [barangays, setBarangays] = useState([]);
  const [cdcs, setCdcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState('');

  const loadData = useCallback(() => {
    const authToken = localStorage.getItem('access');
    const requestHeaders = authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {};

    setLoading(true);
    Promise.all([
      api.get('/barangays/', { headers: requestHeaders }),
      api.get(isCdwView ? '/cdcs/?assigned_to_me=true' : '/cdcs/', { headers: requestHeaders }),
    ])
      .then(([barangaysRes, cdcsRes]) => {
        setBarangays(barangaysRes.data || []);
        setCdcs(cdcsRes.data || []);
      })
      .catch((err) => {
        console.log(err);
        alert('Failed to load CDC directory data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isCdwView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCapacityState = (cdc) => {
    const capacity = Number(cdc.max_capacity) || 0;
    const enrollment = Number(cdc.current_enrollment) || 0;

    if (!capacity) return 'unset';
    if (enrollment >= capacity) return 'full';
    if (enrollment / capacity >= 0.8) return 'near';
    return 'available';
  };

  const filteredCdcs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return cdcs.filter((cdc) => {
      const matchesSearch = !normalizedSearch
        || cdc.name?.toLowerCase().includes(normalizedSearch)
        || cdc.barangay_name?.toLowerCase().includes(normalizedSearch)
        || cdc.assigned_cdw_name?.toLowerCase().includes(normalizedSearch)
        || cdc.contact_person?.toLowerCase().includes(normalizedSearch);
      const matchesBarangay = !selectedBarangay || String(cdc.barangay) === selectedBarangay;
      const matchesCapacity = !selectedCapacity || getCapacityState(cdc) === selectedCapacity;

      return matchesSearch && matchesBarangay && matchesCapacity;
    });
  }, [cdcs, searchTerm, selectedBarangay, selectedCapacity]);

  const categorizedCdcs = useMemo(() => {
    const isAccredited = (cdc) => cdc.is_accredited || cdc.accreditation_status === 'accredited';
    return {
      accredited: filteredCdcs.filter(isAccredited),
      nonAccredited: filteredCdcs.filter((cdc) => !isAccredited(cdc)),
    };
  }, [filteredCdcs]);

  const totalCapacity = filteredCdcs.reduce((sum, cdc) => sum + (Number(cdc.max_capacity) || 0), 0);
  const totalEnrollment = filteredCdcs.reduce((sum, cdc) => sum + (Number(cdc.current_enrollment) || 0), 0);
  const nearCapacityCount = filteredCdcs.filter((cdc) => {
    const capacity = Number(cdc.max_capacity) || 0;
    const enrollment = Number(cdc.current_enrollment) || 0;
    return capacity > 0 && enrollment / capacity >= 0.8;
  }).length;

  const getCapacityBadge = (cdc) => {
    const state = getCapacityState(cdc);

    if (state === 'unset') {
      return {
        label: 'Capacity not set',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
      };
    }

    if (state === 'full') {
      return {
        label: 'Full',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }

    if (state === 'near') {
      return {
        label: 'Near capacity',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }

    return {
      label: 'Available',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  const utilizationPercent = Math.max(0, Math.min(100, totalCapacity ? Math.round((totalEnrollment / totalCapacity) * 100) : 0));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc,#eff6ff)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lgu-kicker">{isCdwView ? 'My CDC Information' : 'CDC Directory'}</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {isCdwView ? 'Assigned Child Development Center' : 'Lucena City Child Development Centers'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {isCdwView
                ? 'View the official CDC profile, papers, review status, and submitted records for the center assigned to your account.'
                : 'A city-wide registry for CDC location, assigned worker, enrollment load, and capacity monitoring.'}
            </p>
          </div>

          {canOpenRegistration ? (
            <Link
              to="/admin/cdc-registration"
              className="lgu-button-primary"
            >
              <AppIcon name="registration" className="mr-2 h-4 w-4" />
              Open CDC Registration
            </Link>
          ) : null}
        </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Visible Centers" value={loading ? '--' : filteredCdcs.length} hint="Centers matching the current filters." icon="building" tone="sky" />
          <MetricCard label="Enrollment" value={loading ? '--' : totalEnrollment} hint={`Total capacity in view: ${loading ? '--' : totalCapacity}`} icon="children" tone="emerald" />
          <MetricCard label="Utilization" value={loading ? '--' : `${utilizationPercent}%`} hint="Enrollment against available capacity." icon="analytics" tone="slate" />
          <MetricCard label="Near Capacity" value={loading ? '--' : nearCapacityCount} hint="Centers at 80% capacity or higher." icon="gap" tone="amber" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="lgu-kicker">Directory View</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {isCdwView ? 'My Assigned CDC' : 'Registered CDC List'}
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search center, barangay, CDW"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
            />
            <select
              value={selectedBarangay}
              onChange={(event) => setSelectedBarangay(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
            <select
              value={selectedCapacity}
              onChange={(event) => setSelectedCapacity(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4b94] focus:ring-4 focus:ring-sky-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <TableSkeleton rows={6} columns={6} />
            </div>
          ) : (
            <div className="space-y-5">
              <CDCSectionTable
                title="Accredited CDCs"
                description="Centers with approved accreditation are listed first for easier review."
                cdcs={categorizedCdcs.accredited}
                basePath={basePath}
                getCapacityBadge={getCapacityBadge}
                emptyMessage={isCdwView ? 'Your assigned CDC is not yet accredited.' : 'No accredited CDCs match the current filters.'}
                featured
              />
              <CDCSectionTable
                title="Non-Accredited CDCs"
                description="Centers still pending, under review, rejected, expired, or without accreditation are listed below."
                cdcs={categorizedCdcs.nonAccredited}
                basePath={basePath}
                getCapacityBadge={getCapacityBadge}
                emptyMessage={isCdwView ? 'No non-accredited CDC is assigned to your account.' : 'No non-accredited CDCs match the current filters.'}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default DaycareCentersPage;
