import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import api from '../api';
import ChildTransfers from '../components/ChildTransfers';
import { profileAge, matchesAge } from '../utils/profileAge';
import AppIcon from '../components/AppIcon';
import ChildProfileInformation from '../components/ChildProfileInformation';
import { AssessmentResults } from './StudentAssessmentResultsPage';

const statusStyles = {
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  needs_monitoring: 'border-amber-200 bg-amber-50 text-amber-700',
  needs_intervention: 'border-rose-200 bg-rose-50 text-rose-700',
  not_assessed: 'border-slate-200 bg-slate-50 text-slate-600',
  enrolled: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  not_enrolled: 'border-rose-200 bg-rose-50 text-rose-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
  matched: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  population_only: 'border-amber-200 bg-amber-50 text-amber-700',
  cdc_encoded: 'border-sky-200 bg-sky-50 text-sky-700',
  submitted: 'border-sky-200 bg-sky-50 text-sky-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  cho: 'border-purple-200 bg-purple-50 text-purple-700',
};

function badgeClass(value) {
  return statusStyles[value] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getChildName(child) {
  return child?.name || [child?.first_name, child?.middle_name, child?.last_name].filter(Boolean).join(' ') || 'Unnamed child';
}

function getProfilePath(childId) {
  const role = localStorage.getItem('role') || 'cdw';
  return `/${role}/students/${childId}`;
}

function ProfileBadge({ value, label }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${badgeClass(value)}`}>
      {label}
    </span>
  );
}

function compactId(child) {
  return child.student_id || `ID: CHO-${String(child.id || 0).padStart(6, '0')}`;
}

const sexGroups = [
  { key: 'male', label: 'Male Children', icon: 'children', tone: 'bg-sky-50 text-sky-700' },
  { key: 'female', label: 'Female Children', icon: 'children', tone: 'bg-violet-50 text-violet-700' },
];
export function belongsToGroup(child, group) {
  if (group === 'male' || group === 'female') return child.sex === group;
  if (group === 'unspecified') return !['male', 'female'].includes(child.sex);
  if (group === 'enrolled') return child.enrollment_match_status?.value === 'enrolled' || (child.current_status === 'enrolled' && Boolean(child.cdc));
  if (group === 'not_enrolled') return Boolean(child.in_selected_population_basis || child.population_source_submission) && (child.enrollment_match_status?.value === 'not_enrolled' || child.current_status === 'not_enrolled' || !child.cdc);
  return true;
}

export function sourceRecords(children, source) {
  return children.filter(child => source === 'cho'
    ? (child.in_selected_population_basis ?? (Boolean(child.population_source_submission) && child.population_source_status === 'current_basis'))
    : belongsToGroup(child, 'enrolled'));
}

function SourceSection({ source, records, loading, referenceDate, linkTo, centerName }) {
  const cho = source === 'cho';
  const groups = [...sexGroups, ...(records.some(child => belongsToGroup(child, 'unspecified')) ? [{ key: 'unspecified', label: 'Sex not recorded', icon: 'children', tone: 'bg-slate-100 text-slate-600' }] : [])];
  return <section aria-label={cho ? 'CHO records' : 'CDC enrollment records'} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">{cho ? 'Barangay Population' : `Records at ${centerName}`}</h2><Link to={linkTo(source, 'all')} className="text-sm font-semibold text-[#0f4b94]">View all ({records.length}) &rarr;</Link></div>
    <div className="grid gap-4 md:grid-cols-2">{groups.map(group => <GroupPreviewCard key={group.key} group={group} children={records} loading={loading} referenceDate={referenceDate} to={linkTo(source, group.key)} />)}</div>
    {cho && <Link to={linkTo(source, 'not_enrolled')} className="inline-block text-sm font-medium text-[#0f4b94]">Not enrolled ({records.filter(child => belongsToGroup(child, 'not_enrolled')).length}) &rarr;</Link>}
  </section>;
}

function ChildAvatar({ child }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const name = getChildName(child);
  const className = 'h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover';
  if (child.photo && failedPhoto !== child.photo) {
    return <img src={child.photo} alt={name} loading="lazy" onError={() => setFailedPhoto(child.photo)} className={className} />;
  }
  return <span role="img" aria-label={`No photo available for ${name}`} className={`${className} flex items-center justify-center bg-slate-100 text-slate-400`}><AppIcon name="profile" className="h-6 w-6" /></span>;
}

function GroupPreviewCard({ group, children, loading, referenceDate, to }) {
  const records = children.filter(child => belongsToGroup(child, group.key))
    .sort((a, b) => getChildName(a).localeCompare(getChildName(b)));
  const preview = records.slice(0, 3);
  return <Link to={to} aria-label={`Open ${group.label} children`} className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${group.border || ''}`}>
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${group.tone}`}><AppIcon name={group.icon} className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-semibold text-slate-900">{group.label}</h2><p className="text-xs text-slate-500">{group.note}</p></div>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${group.tone}`}>{loading ? '...' : records.length.toLocaleString()}</span>
    </div>
    <div className="flex-1 px-5">
      {loading ? <div className="space-y-5 py-5" aria-label="Loading children">{[0, 1, 2].map(item => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div> : preview.length ? <ul className="divide-y divide-slate-100">
        {preview.map(child => {
          const age = profileAge(child, referenceDate);
          const ageLabel = !age ? 'Age not recorded' : age.exact && age.years === 0 ? `${age.months} months old` : `${age.years} ${age.years === 1 ? 'year' : 'years'} old`;
          const name = getChildName(child);
          return <li key={child.id} className="flex items-center gap-3 py-4">
            <ChildAvatar child={child} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800" title={name}>{name}</p><p className="mt-1 truncate text-xs text-slate-500" title={child.barangay_name || 'Barangay not recorded'}>{child.barangay_name || 'Barangay not recorded'}</p></div>
            <span className="shrink-0 text-right text-xs text-slate-600"><span className="block">{ageLabel}</span>{age && !age.exact && <span className="mt-1 block text-[11px] text-slate-400">Reported age</span>}</span>
          </li>;
        })}
      </ul> : <div className="flex min-h-[208px] flex-col items-center justify-center gap-2 text-slate-400"><AppIcon name="children" className="h-7 w-7" /><p className="text-sm">No children yet</p></div>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
      <span className="text-xs text-slate-400">{loading ? 'Loading...' : records.length > 3 ? `+${(records.length - 3).toLocaleString()} more children` : `${records.length} ${records.length === 1 ? 'child' : 'children'}`}</span>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f4b94]">View all <span aria-hidden="true" className="transition group-hover:translate-x-1">&rarr;</span></span>
    </div>
  </Link>;
}

function StudentRow({ child, ageUnit, referenceDate, returnTo }) {
  const age = profileAge(child, referenceDate);
  const ageText = age ? (ageUnit === 'months' ? `${age.months}${age.exact ? '' : `-${age.months + 11}`} mo` : `${age.years} yr`) : 'Not recorded';
  return <tr className="transition hover:bg-slate-50/80">
    <td className="px-5 py-4"><div className="flex items-center gap-3"><ChildAvatar child={child} /><div><p className="font-semibold text-slate-900">{getChildName(child)}</p><p className="mt-1 text-xs text-slate-400">{compactId(child)}</p></div></div></td>
    <td className="px-5 py-4 text-slate-600"><span title={age?.exact ? 'Calculated from birth date' : 'Reported age; birth date unavailable'}>{ageText}{age && !age.exact && <span className="ml-1 text-slate-400" title="Reported age">*</span>}</span></td>
    <td className="px-5 py-4 text-slate-600">{child.barangay_name || 'Not recorded'}</td>
    <td className="px-5 py-4"><ProfileBadge value={child.current_status || child.enrollment_match_status?.value} label={child.current_status ? child.current_status.replace(/_/g, ' ') : child.enrollment_match_status?.label || 'Unknown'} /></td>
    <td className="px-5 py-4 text-right">{child.can_view_profile === false ? <span className="inline-block rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{child.current_status === 'enrolled' ? 'Enrolled at' : 'Linked to'} {child.cdc_name}</span> : <Link to={getProfilePath(child.id)} state={{ returnTo }} aria-label={`View profile for ${getChildName(child)}`} className="inline-flex whitespace-nowrap rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0f4b94] transition hover:bg-blue-100">View Profile</Link>}</td>
  </tr>;
}

function StudentProfilesPage() {
  const { childId } = useParams();
  if (childId) {
    return <StudentProfileDetail childId={childId} />;
  }
  return <StudentProfilesList />;
}

function RecordTable({ title, records, ageUnit, referenceDate, returnTo }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(records.length / 12));
  const current = Math.min(page, pages);
  return <section aria-label={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{records.length}</span></div>
    {records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Child', 'Age', 'Barangay', 'Status', ''].map((label, index) => <th key={index} scope="col" className="px-5 py-3">{label || <span className="sr-only">Profile</span>}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{records.slice((current - 1) * 12, current * 12).map(child => <StudentRow key={child.id} child={child} ageUnit={ageUnit} referenceDate={referenceDate} returnTo={returnTo} />)}</tbody></table></div> : <p className="p-6 text-sm text-slate-500">No children found</p>}
    {pages > 1 && <nav aria-label={`${title} pagination`} className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm"><button disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Previous</button><span>{current} / {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Next</button></nav>}
  </section>;
}

function StudentProfilesList() {
  const [context, setContext] = useState(null);
  const [children, setChildren] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requestedCdc = params.get('record_cdc') || '';
  const historyMode = params.get('include_history') === 'true';
  const historyYear = params.get('academic_year') || '';
  const group = params.get('group') || '';
  const source = params.get('source') === 'cho' && !historyMode ? 'cho' : 'cdc';
  const search = params.get('q') || '';
  const ageFilter = params.get('age') || '';
  const ageUnit = params.get('unit') === 'months' ? 'months' : 'years';
  const assigned = context?.assignments?.find(item => item.id === context.selected_cdc);
  const selectedYear = context?.years?.find(item => String(item.academic_year) === historyYear);
  const historyIndex = historyMode && !historyYear;
  const isList = Boolean(group) || (historyMode && Boolean(historyYear));
  const referenceDate = historyMode ? selectedYear?.academic_year__start_date : assigned?.academic_year.start_date;

  useEffect(() => {
    let active = true;
    setContext(null); setChildren([]); setLoading(true); setError('');
    api.get(`/children/record-context/${requestedCdc ? `?record_cdc=${encodeURIComponent(requestedCdc)}` : ''}`).then(({ data }) => {
      if (active) setContext(data);
    }).catch(() => { if (active) { setError('Unable to load your assigned records.'); setLoading(false); } });
    return () => { active = false; };
  }, [requestedCdc, revision]);

  useEffect(() => {
    if (!context) return;
    let active = true;
    setChildren([]); setLoading(true);
    if (!assigned?.can_view || historyIndex || (historyMode && !selectedYear)) { setLoading(false); return; }
    const load = async () => {
      try {
        let url = `/children/?record_cdc=${assigned.id}&record_scope=${source === 'cho' ? 'population' : 'cdc'}${historyMode ? `&include_history=true&academic_year=${historyYear}` : ''}`;
        const records = [];
        while (url) {
          const response = await api.get(url);
          if (!active) return;
          records.push(...normalizeList(response.data)); url = response.data?.next || null;
        }
        // Backend enforces this boundary; keep the interface scoped as well.
        setChildren(Array.from(new Map(records.filter(child => String(child.barangay) === String(assigned.barangay)).map(child => [child.id, child])).values()));
      } catch { if (active) setError('Unable to load child records.'); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [context, assigned, historyMode, historyYear, historyIndex, selectedYear, source]);

  const linkTo = (section = '', childGroup = '', year = historyYear, history = historyMode) => {
    const next = new URLSearchParams();
    if (assigned) next.set('record_cdc', assigned.id);
    if (history) { next.set('include_history', 'true'); if (year) next.set('academic_year', year); }
    if (section) next.set('source', section);
    if (childGroup) next.set('group', childGroup);
    return `?${next}`;
  };
  const updateFilter = (key, value) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next, { replace: true }); };
  const clearFilters = () => { const next = new URLSearchParams(params); ['q', 'age', 'unit'].forEach(key => next.delete(key)); setParams(next, { replace: true }); };
  const cho = sourceRecords(children, 'cho');
  const ownRecords = children.filter(child => child.cdc === assigned?.id);
  const selectedRecords = source === 'cho' ? cho : ownRecords;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const [min = '', max = ''] = ageFilter.split(':');
    return selectedRecords.filter(child => belongsToGroup(child, group)
      && (!term || [child.name, child.student_id].some(value => value?.toLowerCase().includes(term)))
      && matchesAge(profileAge(child, referenceDate), ageUnit, min, max)).sort((a, b) => getChildName(a).localeCompare(getChildName(b)));
  }, [selectedRecords, group, search, ageFilter, ageUnit, referenceDate]);
  const visibleGroups = [...sexGroups, { key: 'unspecified', label: 'Sex not recorded' }].filter(item =>
    ['male', 'female', 'unspecified'].includes(group) ? item.key === group : item.key !== 'unspecified' || filtered.some(child => belongsToGroup(child, 'unspecified')));
  const control = 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

  return <section className="mx-auto max-w-6xl space-y-6 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div>
      {(isList || historyMode) && <Link to={historyMode && historyYear ? linkTo('', '', '', true) : linkTo('', '', '', false)} className="mb-3 inline-block text-sm font-semibold text-[#0f4b94]">&larr; {historyMode && historyYear ? 'All academic years' : 'Child Profiles'}</Link>}
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{historyMode ? historyYear && selectedYear ? `Academic year ${selectedYear.academic_year__name}` : 'Child Record History' : source === 'cho' ? 'Barangay Population' : 'Our CDC Records'}</h1>
      <p className="mt-2 text-sm text-slate-500">{historyMode ? historyIndex ? 'Choose an academic year.' : 'Historical records' : assigned?.name || 'Your assigned records'}</p>
    </div>{!historyMode && <Link to={`/cdw/students/add${assigned ? `?record_cdc=${assigned.id}` : ''}`} className="rounded-xl bg-[#0f4b94] px-4 py-3 text-sm font-semibold text-white">Add Child</Link>}</header>
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button onClick={() => setRevision(value => value + 1)} className="font-semibold underline">Retry</button></div>}

    {assigned && <section aria-label="Record scope" className={`grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 ${historyMode ? 'border-amber-100 bg-amber-50/40' : 'border-blue-100 bg-blue-50/40'}`}>
      <div><p className="text-xs font-medium text-slate-500">Barangay</p><p className="mt-1 font-semibold text-slate-900">{assigned.barangay_name}</p></div>
      <div><p className="text-xs font-medium text-slate-500">{historyMode ? 'Historical academic year' : 'CHO reporting period'}</p><p className="mt-1 font-semibold text-slate-900">{historyMode ? selectedYear?.academic_year__name || 'Select a year below' : assigned.basis?.year || 'No population basis applied'}</p>{!historyMode && assigned.basis && <p className="mt-1 text-xs text-slate-500">{assigned.basis.title}</p>}</div>
    </section>}
    {!context && !error && <p role="status" className="p-6 text-sm text-slate-500">Loading your records…</p>}
    {context && !assigned && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No CDC assigned. Contact CSWDO.</p>}
    {assigned && !assigned.can_view && <p className="rounded-xl bg-amber-50 p-5 text-sm text-amber-800">A valid Grant to Operate is required to view records.</p>}
    {assigned?.can_view && <>
      {!historyMode && <nav aria-label="Record sections" className="flex flex-wrap gap-2"><Link to={linkTo('cdc')} aria-current={source === 'cdc' ? 'page' : undefined} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${source === 'cdc' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}>Our CDC Records</Link><Link to={linkTo('cho')} aria-current={source === 'cho' ? 'page' : undefined} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${source === 'cho' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}>Barangay Population</Link></nav>}
      {historyIndex ? <div className="grid gap-4 sm:grid-cols-2">{context.years.map(year => <Link key={year.academic_year} to={linkTo('', '', String(year.academic_year), true)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"><div className="flex items-center justify-between gap-3"><span className="rounded-lg bg-blue-50 p-3 text-[#0f4b94]"><AppIcon name="children" className="h-5 w-5" /></span><span className="text-xs text-slate-500">{year.total} children</span></div><h2 className="mt-4 text-lg font-bold text-slate-900">Academic year {year.academic_year__name}</h2><p className="mt-2 text-xs text-slate-500">{year.male} male · {year.female} female{year.total > year.male + year.female ? ` · ${year.total - year.male - year.female} sex not recorded` : ''}</p><p className="mt-4 text-sm font-semibold text-[#0f4b94]">View records &rarr;</p></Link>)}{!context.years.length && <p className="p-5 text-sm text-slate-500">No record history yet.</p>}</div>
      : historyMode && !selectedYear ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">This academic year is not available for your assigned barangay.</p>
      : loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading children…</p>
      : isList ? <>
        <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"><input aria-label="Search children" value={search} onChange={event => updateFilter('q', event.target.value)} placeholder="Search name or ID" className={`${control} min-w-0 flex-1`} /><select aria-label="Age" value={ageFilter} onChange={event => updateFilter('age', event.target.value)} className={control}><option value="">All ages</option>{Array.from({ length: 18 }, (_, year) => <option key={year} value={ageUnit === 'years' ? `${year}:${year}` : `${year * 12}:${year * 12 + 11}`}>{ageUnit === 'years' ? `${year} years` : `${year * 12}–${year * 12 + 11} months`}</option>)}</select><div role="group" aria-label="Age unit" className="flex rounded-xl bg-slate-100 p-1">{['years', 'months'].map(unit => <button key={unit} aria-pressed={ageUnit === unit} onClick={() => { const next = new URLSearchParams(params); next.set('unit', unit); next.delete('age'); setParams(next, { replace: true }); }} className={`rounded-lg px-3 text-sm capitalize ${ageUnit === unit ? 'bg-white font-semibold text-[#0f4b94] shadow-sm' : 'text-slate-500'}`}>{unit}</button>)}</div>{(search || ageFilter) && <button onClick={clearFilters} className="text-sm font-semibold text-[#0f4b94]">Clear filters</button>}</div>
        <p className="text-xs text-slate-500">{filtered.length} results · Ages at academic-year start</p>
        {visibleGroups.map(item => <RecordTable key={`${historyYear}-${item.key}-${search}-${ageFilter}`} title={item.label} records={filtered.filter(child => belongsToGroup(child, item.key))} ageUnit={ageUnit} referenceDate={referenceDate} returnTo={`${location.pathname}${location.search}`} />)}
      </> : <>
        {source === 'cho' ? <SourceSection source="cho" records={cho} loading={loading} referenceDate={referenceDate} linkTo={linkTo} centerName={assigned.name} /> : <SourceSection source="cdc" records={ownRecords} loading={loading} referenceDate={referenceDate} linkTo={linkTo} centerName={assigned.name} />}
      </>}
      {!historyMode && <div className="flex flex-wrap gap-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-[#0f4b94]"><Link to={linkTo('', '', '', true)}>Child Record History &rarr;</Link><Link to={linkTo('', 'all')}>All CDC records &rarr;</Link><Link to="/cdw/students/health-records">Health records</Link><Link to="/cdw/students/assessment-results">Assessments</Link></div>}
      {!historyMode && <ChildTransfers onChanged={() => setRevision(value => value + 1)} />}
    </>}
  </section>;
}

function StudentProfileDetail({ childId }) {
  const location = useLocation();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError('');
      try {
        const childRes = await api.get(`/children/${childId}/`);
        if (!active) return;
        setChild(childRes.data);
      } catch (err) {
        console.error('Failed to load student profile:', err);
        if (active) setError('Unable to load this student profile.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [childId]);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">Loading student profile...</div>;
  }

  if (error || !child) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error || 'Student profile not found.'}</div>;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 pb-8">
      {location.state?.enrollmentNotice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{location.state.enrollmentNotice}</p>}
      <ChildProfileInformation child={child} onUpdated={setChild} backTo={location.state?.returnTo || '/cdw/students'} />
      {child.other_year_records?.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Records from other years</summary><div className="mt-3 flex flex-wrap gap-3">{child.other_year_records.map(record => <Link key={record.id} to={`/cdw/students/${record.id}`} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-[#0f4b94]">{record.academic_year__name} →</Link>)}</div></details>}
      <div className="flex flex-wrap gap-2">
        <ProfileBadge value={child.enrollment_match_status?.value} label={child.enrollment_match_status?.label || 'Not recorded'} />
        <ProfileBadge value={child.population_match_status?.value} label={child.population_match_status?.label || 'Not recorded'} />
        <ProfileBadge value={child.development_status?.value} label={child.development_status?.label || 'Not recorded'} />
      </div>
          <AssessmentResults child={child} />

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">Health Check-up Records</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {child.latest_health_checkup ? `Latest check-up on ${formatDate(child.latest_health_checkup.screening_date)}` : 'No health check-up recorded yet.'}
                </p>
              </div>
              <Link to={`/cdw/students/${child.id}/health-records`} className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-[#0f4b94] transition hover:bg-slate-50">
                Open Health Check-ups
              </Link>
            </div>

            <div className="mt-4 grid gap-3">
              {(child.health_checkup_records || []).map((record) => (
                <article key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-slate-950">{record.checkup_type_label || 'Health check-up'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatDate(record.screening_date)} | {record.conducted_by_name || record.conducted_by_label || 'Health worker'}
                      </p>
                    </div>
                    <ProfileBadge value={record.status} label={record.status_label || 'Submitted'} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <InfoItem label="Nutrition" value={record.nutritional_status_label || 'Not recorded'} />
                    <InfoItem label="Finding" value={record.health_findings || 'Not recorded'} />
                    <InfoItem label="Next Step" value={record.needs_referral ? `Referral: ${record.referred_to_label || 'Needed'}` : record.follow_up_needed ? `Follow-up: ${formatDate(record.follow_up_date)}` : record.advice_given || 'Not recorded'} />
                  </div>
                </article>
              ))}
              {!child.health_checkup_records?.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                  Save a health check-up from Regular Programs to show it here.
                </div>
              ) : null}
            </div>
          </div>
    </section>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value === null || value === undefined || value === '' ? 'Not recorded' : value}</p>
    </div>
  );
}

export default StudentProfilesPage;
