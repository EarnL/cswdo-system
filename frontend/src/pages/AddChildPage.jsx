import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { profileAge } from '../utils/profileAge';

const blank = { name: '', sex: 'unspecified', date_of_birth: '', age: '', guardian_name: '', contact_number: '', complete_address: '', father_name: '', mother_name: '' };
const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const label = value => value ? value.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase()) : 'Not recorded';
const errorMessage = error => {
  const data = error.response?.data;
  if (data?.error) return data.error;
  if (data?.detail) return data.detail;
  return data && typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Unable to complete this request. Please try again.';
};
const control = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';

export default function AddChildPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedCdc = params.get('record_cdc') || '';
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [cdcId, setCdcId] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [searchState, setSearchState] = useState('idle');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState(blank);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [transferSent, setTransferSent] = useState(false);
  const [transferConfirm, setTransferConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError('');
    api.get(`/children/enrollment-options/${requestedCdc ? `?record_cdc=${encodeURIComponent(requestedCdc)}` : ''}`).then(({ data }) => {
      if (!active) return;
      setOptions(data);
      const available = data.cdcs.filter(cdc => cdc.can_enroll);
      setCdcId(String(data.selected_cdc || available[0]?.id || ''));
      setSelected(null); setQuery(''); setManual(false); setConfirmed(false); setTransferSent(false); setTransferConfirm(false); setConflict(null); setSaveError('');
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      setEnrollmentDate(today >= data.academic_year.start_date && today <= data.academic_year.end_date ? today : data.academic_year.start_date);
    }).catch(error => { if (active) setLoadError(errorMessage(error)); });
    return () => { active = false; };
  }, [attempt, requestedCdc]);

  useEffect(() => {
    if (!options || selected || manual || query.trim().length < 2) { setSearchState('idle'); setMatches([]); return; }
    let active = true;
    const controller = new AbortController();
    setSearchState('loading'); setMatches([]); setActiveIndex(-1);
    const timer = setTimeout(() => {
      api.get(`/children/cho-matches/?q=${encodeURIComponent(query.trim())}${cdcId ? `&record_cdc=${cdcId}` : ''}`, { signal: controller.signal }).then(({ data }) => {
        if (!active) return;
        setMatches(data.results); setHasMore(data.has_more); setSearchState('ready'); setExpanded(true);
      }).catch(() => { if (active) { setSearchState('error'); setExpanded(false); } });
    }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, selected, manual, options, searchAttempt, cdcId]);

  const cdc = options?.cdcs.find(item => String(item.id) === cdcId);
  const alreadyEnrolled = selected?.cdc && (selected.current_status === 'enrolled' || (cdcId && String(selected.cdc) !== cdcId));
  const eligible = selected ? [3, 4].includes(Number(selected.computed_age ?? selected.age)) : true;
  const age = selected ? selected.computed_age ?? selected.age : form.date_of_birth && options ? profileAge(form, options.academic_year.start_date)?.years : form.age;
  const choose = child => {
    setTransferSent(false); setTransferConfirm(false); setSelected(child); setQuery(child.name); setExpanded(false); setManual(false); setConfirmed(false); setSaveError(''); setConflict(null);
    setForm({ ...blank, guardian_name: child.guardian_name || child.parent_guardian_name || '', contact_number: child.contact_number || child.contact_information || '' });
  };
  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setConfirmed(false); setConflict(null); };
  const resetSelection = () => { setSelected(null); setManual(false); setForm(blank); setConfirmed(false); setSaveError(''); setConflict(null); setExpanded(true); };
  const requestTransfer = async () => {
    if (!cdc?.can_enroll || !selected || saving) return;
    setSaving(true); setSaveError('');
    try {
      await api.post('/children/transfers/', { child_id: selected.id, cdc: cdc.id });
      setTransferSent(true); setTransferConfirm(false);
    } catch (error) { setSaveError(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (saving || !confirmed || !cdc?.can_enroll || alreadyEnrolled || !eligible || (!selected && !manual)) return;
    setSaving(true); setSaveError(''); setConflict(null);
    try {
      const body = { cdc: cdc.id, academic_year: options.academic_year.id, enrollment_date: enrollmentDate };
      if (selected) Object.assign(body, { child_id: selected.id, guardian_name: form.guardian_name.trim(), contact_number: form.contact_number.trim() });
      else {
        Object.assign(body, form, { name: form.name.trim(), guardian_name: form.guardian_name.trim(), contact_number: form.contact_number.trim() });
        if (body.date_of_birth) delete body.age;
        else { delete body.date_of_birth; body.age = Number(body.age); }
      }
      const { data } = await api.post('/children/enroll/', body);
      navigate(`/cdw/students/${data.id}`, { replace: true, state: { enrollmentNotice: 'Child enrolled successfully.', returnTo: '/cdw/students?group=enrolled' } });
    } catch (error) {
      setSaveError(errorMessage(error)); setConfirmed(false);
      if (error.response?.status === 409) setConflict(error.response.data);
    } finally { setSaving(false); }
  };

  return <section className="mx-auto max-w-5xl space-y-5 pb-8">
    <header><Link to="/cdw/students" className="text-sm font-semibold text-[#0f4b94]">&larr; Back to Records</Link><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Add Child</h1><p className="mt-2 text-sm text-slate-500">Find a child, review their details, and confirm enrollment.</p></header>
    {loadError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{loadError}<button onClick={() => setAttempt(attempt + 1)} className="ml-3 font-semibold underline">Retry</button></div> : !options ? <p role="status" className="p-5 text-sm text-slate-500">Loading enrollment details...</p> : <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={saving} className="min-w-0 space-y-5">
        {!options.cdcs.some(item => item.can_enroll) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No assigned CDC is available for enrollment. Ask CSWDO to check your assignment and Grant to Operate.</p>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-slate-900">1. Find a child</h2>
          <div className="relative mt-4"><label htmlFor="cho-name" className="text-sm font-medium text-slate-700">Child's name</label><input id="cho-name" role="combobox" aria-autocomplete="list" aria-expanded={expanded && matches.length > 0} aria-controls="cho-results" aria-activedescendant={expanded && activeIndex >= 0 ? `cho-option-${activeIndex}` : undefined} autoComplete="off" disabled={Boolean(selected) || manual || saving} value={query} onFocus={() => setExpanded(true)} onChange={event => { setQuery(event.target.value); setConfirmed(false); setConflict(null); }} onKeyDown={event => {
            if (event.key === 'Escape') { setExpanded(false); setActiveIndex(-1); }
            if (['ArrowDown', 'ArrowUp'].includes(event.key) && matches.length) { event.preventDefault(); setExpanded(true); setActiveIndex(index => event.key === 'ArrowDown' ? Math.min(index + 1, matches.length - 1) : Math.max(index - 1, 0)); }
            if (event.key === 'Enter' && !selected && !manual) { event.preventDefault(); if (expanded && activeIndex >= 0) choose(matches[activeIndex]); }
          }} placeholder="Type at least 2 letters" className={control} />
            {!selected && !manual && expanded && matches.length > 0 && <ul id="cho-results" role="listbox" aria-label="Matching CHO children" className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">{matches.map((child, index) => <li key={child.id} id={`cho-option-${index}`} role="option" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(child); } }} aria-selected={activeIndex === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(child)} className={`cursor-pointer border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-blue-50 ${activeIndex === index ? 'bg-blue-50' : ''}`}><div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{child.name}</span>{child.cdc && child.current_status === 'enrolled' && <span className="text-xs font-semibold text-amber-700">Enrolled at {child.cdc_name}</span>}</div><p className="mt-1 text-xs text-slate-500">{dateLabel(child.date_of_birth)} / {label(child.sex)} / {child.barangay_name || 'Barangay not recorded'}</p><p className="mt-1 text-xs text-slate-400">{child.student_id || `Record ${child.id}`}{child.cdc_name ? ` / ${child.cdc_name} / ${child.academic_year_name}` : ''}</p></li>)}</ul>}
          </div>
          {selected || manual ? <button type="button" onClick={resetSelection} className="mt-3 text-sm font-semibold text-[#0f4b94]">Search for another child</button> : <div className="mt-3 text-sm text-slate-500" role="status">
            {searchState === 'loading' && 'Searching validated CHO records...'}
            {searchState === 'error' && <span>Search unavailable. <button type="button" onClick={() => setSearchAttempt(value => value + 1)} className="font-semibold text-[#0f4b94]">Retry search</button></span>}
            {searchState === 'ready' && <><p>{matches.length ? hasMore ? 'More matches available. Refine the name to narrow the list.' : `${matches.length} matching ${matches.length === 1 ? 'record' : 'records'}. Select a child above.` : 'No matching child found in the validated CHO records available to you.'}</p><button type="button" onClick={() => { setManual(true); setExpanded(false); setForm({ ...blank, name: query.trim() }); setConfirmed(false); }} className="mt-2 font-semibold text-[#0f4b94]">Child not listed? Add manually</button></>}
          </div>}
        </section>

        {(selected || manual) && <>
          {selected?.can_view_profile !== false && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-900">2. Review child information</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{selected ? 'Existing CHO record' : 'Manual entry'}</span></div>
            {selected ? <><dl className="mt-5 grid gap-5 sm:grid-cols-2">{[['Full name', selected.name], ['Record ID', selected.student_id], ['Date of birth', dateLabel(selected.date_of_birth)], ['Sex', label(selected.sex)], ['Barangay', selected.barangay_name], ['Age at period start', age === null || age === undefined ? '' : `${age} years`], ['Address', selected.complete_address], ['Father', selected.father_name], ['Mother', selected.mother_name], ['CHO source', selected.population_source_title]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'Not recorded'}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-500">Review the existing record here. Permitted changes can be made in View Profile.</p></> : <div className="mt-5 grid gap-4 sm:grid-cols-2">{[['name', 'Full name'], ['date_of_birth', 'Date of birth', 'date'], ['sex', 'Sex'], ['age', 'Reported age (years)', 'number'], ['complete_address', 'Address'], ['father_name', "Father's name"], ['mother_name', "Mother's name"]].map(([key, name, type]) => <label key={key} className="text-sm font-medium text-slate-700">{name}{key === 'sex' ? <select className={control} value={form.sex} onChange={event => change(key, event.target.value)}>{['unspecified', 'male', 'female'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select> : <input className={control} type={type || 'text'} value={key === 'age' && form.date_of_birth ? age ?? '' : form[key]} disabled={key === 'age' && Boolean(form.date_of_birth)} required={key === 'name' || (key === 'age' && !form.date_of_birth)} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 17 : undefined} onChange={event => change(key, event.target.value)} />}</label>)}</div>}
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">{[['guardian_name', 'Parent / guardian'], ['contact_number', 'Contact number']].map(([key, name]) => <label key={key} className="text-sm font-medium text-slate-700">{name}<input className={control} value={form[key]} required disabled={Boolean(selected?.[key])} onChange={event => change(key, event.target.value)} /></label>)}</div>
          </section>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-slate-900">{selected?.can_view_profile === false ? '2. Enrollment status' : '3. Confirm enrollment'}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium text-slate-700">Assigned CDC</p><p className="mt-2 text-sm font-semibold text-slate-900">{cdc?.name || 'No CDC available'}</p></div><div><p className="text-sm font-medium text-slate-700">Enrollment period</p><p className="mt-2 text-sm font-semibold text-slate-900">{options.academic_year.name}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(options.academic_year.start_date)} - {dateLabel(options.academic_year.end_date)}</p></div>{!alreadyEnrolled && <label className="text-sm font-medium text-slate-700">Enrollment date<input required type="date" className={control} min={options.academic_year.start_date} max={options.academic_year.end_date} value={enrollmentDate} onChange={event => { setEnrollmentDate(event.target.value); setConfirmed(false); }} /></label>}{cdc && <div><p className="text-sm font-medium text-slate-700">CDC barangay</p><p className="mt-3 text-sm text-slate-600">{cdc.barangay_name}</p></div>}</div>
            {alreadyEnrolled ? <div role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>This child already has an enrollment in {selected.cdc_name || 'a CDC'} for {selected.academic_year_name || options.academic_year.name}.</p>{selected.can_view_profile !== false && <Link to={`/cdw/students/${selected.id}`} className="mt-2 inline-block font-semibold underline">View existing profile</Link>}
              {cdcId && String(selected.cdc) !== cdcId && <div className="mt-3">{transferSent ? <p className="font-semibold">Transfer requested · awaiting approval</p> : transferConfirm ? <><p>Request transfer to {cdc?.name}? The current center must approve.</p><button type="button" disabled={saving} onClick={requestTransfer} className="mt-3 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white">Send request</button><button type="button" onClick={() => setTransferConfirm(false)} className="ml-3">Cancel</button></> : <button type="button" disabled={!cdc?.can_enroll} onClick={() => setTransferConfirm(true)} className="rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white disabled:opacity-50">Request transfer</button>}</div>}</div> : !eligible ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Daycare enrollment requires age 3 or 4 at the start of the academic year. <Link to={`/cdw/students/${selected.id}`} className="font-semibold underline">Review profile</Link></p> : <label className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>I confirm the child details, assigned CDC, and enrollment period.</span></label>}
          </section>
        </>}
      </fieldset>
      {saveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><p>{saveError}</p>{conflict?.child_id && <Link to={`/cdw/students/${conflict.child_id}`} className="mt-2 inline-block font-semibold underline">View existing profile</Link>}</div>}
      {(selected || manual) && <div className="flex items-center justify-end gap-3"><Link to="/cdw/students" className={`rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 ${saving ? 'pointer-events-none' : ''}`}>Cancel</Link><button type="submit" disabled={saving || !confirmed || !cdc?.can_enroll || alreadyEnrolled || !eligible} className="rounded-xl bg-[#0f4b94] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Enrolling...' : 'Enroll Child'}</button></div>}
    </form>}
  </section>;
}
