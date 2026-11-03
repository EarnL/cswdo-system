import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AppIcon from './AppIcon';
import { profileAge } from '../utils/profileAge';

const missing = value => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const words = value => value ? value.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase()) : 'Not recorded';
const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const statuses = ['enrolled', 'not_enrolled', 'graduated', 'transferred', 'dropped', 'aged_out'];
// These are existing Child model fields. Relationships and derived fields remain read-only.
const groups = [
  { title: 'Personal Information', icon: 'profile', fields: [
    ['name', 'Full name'], ['first_name', 'First name'], ['middle_name', 'Middle name'], ['last_name', 'Last name'],
    ['date_of_birth', 'Date of birth', 'date'], ['sex', 'Sex', 'sex'], ['place_of_birth', 'Place of birth'], ['complete_address', 'Address', 'textarea'],
  ] },
  { title: 'Enrollment Information', icon: 'building', fields: [
    ['student_id', 'Record ID', 'readonly'], ['cdc_name', 'Child Development Center', 'readonly'], ['barangay_name', 'Barangay', 'readonly'],
    ['assigned_cdw_name', 'Assigned CDW', 'readonly'], ['academic_year_name', 'Academic year', 'readonly'],
    ['enrollment_date', 'Enrollment date', 'date'], ['current_status', 'Status', 'status'],
    ['computed_age', 'Age at academic-year start (years)', 'readonly'], ['population_source_title', 'CHO source', 'readonly'],
  ] },
  { title: 'Parent / Guardian Information', icon: 'users', fields: [
    ['father_name', "Father's name"], ['mother_name', "Mother's name"], ['guardian_name', 'Guardian name'], ['guardian_relationship', 'Relationship'],
    ['contact_number', 'Contact number'], ['alternate_contact_number', 'Alternate contact'], ['occupation', 'Occupation'],
    ['emergency_contact_person', 'Emergency contact'], ['emergency_contact_number', 'Emergency number'],
  ] },
  { title: 'Health Information', icon: 'health', fields: [
    ['height', 'Height (cm)', 'number'], ['weight', 'Weight (kg)', 'number'], ['bmi', 'BMI', 'readonly'], ['blood_type', 'Blood type'],
    ['allergies', 'Allergies', 'textarea'], ['medical_conditions', 'Medical conditions', 'textarea'],
    ['immunization_status', 'Immunization status'], ['nutritional_status', 'Nutritional status'], ['health_remarks', 'Health remarks', 'textarea'],
  ] },
  { title: 'Additional Support & Follow-up', icon: 'children', fields: [
    ['is_special_needs', 'Special needs recorded', 'boolean'], ['type_of_special_need', 'Type of special need'],
    ['special_needs_assessment_date', 'Assessment date', 'date'], ['special_needs_assessed_by', 'Assessed by'],
    ['areas_needing_support', 'Areas needing support', 'textarea'], ['recommended_intervention', 'Recommended intervention', 'textarea'], ['follow_up_notes', 'Follow-up notes', 'textarea'],
  ] },
];

function FieldValue({ field, child }) {
  const [key, , type] = field;
  const value = child[key];
  if (type === 'date') return dateLabel(value);
  if (type === 'boolean') return value === true ? 'Yes' : value === false ? 'No' : 'Not recorded';
  if (type === 'sex' || type === 'status') return words(value);
  return missing(value);
}

function Photo({ src, name }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return src && !failed ? <img src={src} alt={name} onError={() => setFailed(true)} className="h-36 w-32 rounded-xl border border-slate-200 object-cover sm:h-44 sm:w-40" /> : <div role="img" aria-label="No child photo available" className="flex h-36 w-32 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 sm:h-44 sm:w-40"><AppIcon name="profile" className="h-12 w-12" /><span className="text-xs">No photo</span></div>;
}

export default function ChildProfileInformation({ child, onUpdated, backTo }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const referenceDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const age = profileAge(child, referenceDate);
  const ageText = !age ? 'Not recorded' : age.exact ? `${age.years} ${age.years === 1 ? 'year' : 'years'} old / ${age.months} ${age.months === 1 ? 'month' : 'months'} old` : `${age.years} ${age.years === 1 ? 'year' : 'years'} (reported)`;
  const name = child.name || [child.first_name, child.middle_name, child.last_name].filter(Boolean).join(' ') || 'Not recorded';
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link to={backTo} className="text-sm font-semibold text-[#0f4b94] hover:underline">&larr; Back to Records</Link><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Child Information</h1></div>
      {child.can_edit && <button onClick={() => setEditing(true)} className="rounded-xl border border-[#0f4b94] bg-white px-5 py-2.5 text-sm font-semibold text-[#0f4b94] hover:bg-blue-50">Edit Profile</button>}
    </div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section aria-label="Child profile summary" className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:p-6">
      <div className="shrink-0"><Photo src={child.photo} name={name} />{child.can_edit && <button onClick={() => setEditing(true)} className="mt-2 w-full text-xs font-semibold text-[#0f4b94] hover:underline">{child.photo ? 'Update photo' : 'Add photo'}</button>}</div>
      <div className="min-w-0 flex-1 sm:py-2"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-2xl font-bold text-slate-900 sm:text-3xl">{name}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${child.current_status === 'enrolled' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{words(child.current_status)}</span></div><p className="mt-2 text-sm text-slate-500">{missing(child.student_id)}</p>
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_1.5fr_1.5fr]">{[['Sex', words(child.sex)], ['Age', ageText], ['Date of birth', dateLabel(child.date_of_birth)]].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-slate-900">{value}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-slate-400">{age?.exact ? `Age as of ${dateLabel(referenceDate)} (Manila)` : age ? 'Birth date unavailable; months not recorded.' : 'Birth date or reported age not recorded.'}</p>
      </div>
    </section>
    <div className="grid items-start gap-5 lg:grid-cols-2">{groups.map(group => <section key={group.title} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${group.title === 'Additional Support & Follow-up' ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4"><AppIcon name={group.icon} className="h-5 w-5 text-[#0f4b94]" /><h2 className="text-base font-semibold text-slate-900">{group.title}</h2></div>
      <dl className="divide-y divide-slate-100 px-5 py-2">{group.fields.map(field => <div key={field[0]} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(130px,0.85fr)_minmax(0,1.15fr)] sm:gap-5"><dt className="text-slate-500">{field[1]}</dt><dd className="whitespace-pre-wrap break-words font-medium text-slate-800"><FieldValue field={field} child={child} /></dd></div>)}</dl>
    </section>)}</div>
    {editing && <ProfileEditor child={child} onClose={() => setEditing(false)} onSaved={updated => { onUpdated(updated); setEditing(false); setNotice('Profile updated.'); }} />}
  </>;
}

function ProfileEditor({ child, onClose, onSaved }) {
  const dialog = useRef(null);
  const [form, setForm] = useState({ ...child });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(child.photo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const structuredName = Boolean(child.first_name || child.middle_name || child.last_name);
  const editGroups = groups.map(group => ({ ...group, fields: group.fields.filter(([key, , type]) => type !== 'readonly' && !(key === 'name' && structuredName)) }));
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    setError('');
    const payload = {};
    editGroups.flatMap(group => group.fields).forEach(([key, , type]) => {
      if (String(form[key] ?? '') !== String(child[key] ?? '')) payload[key] = form[key] === '' && ['date', 'number'].includes(type) ? null : form[key];
    });
    if (!Object.keys(payload).length && !photo) { onClose(); return; }
    setSaving(true);
    try {
      let body = payload;
      if (photo) {
        body = new FormData();
        Object.entries(payload).forEach(([key, value]) => body.append(key, value === null ? '' : value));
        body.append('photo', photo);
      }
      const { data } = await api.patch(`/children/${child.id}/`, body);
      onSaved(data);
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.entries(data).map(([key, value]) => `${words(key)}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' ') : 'Unable to save. Please try again.');
    } finally { setSaving(false); }
  };
  const control = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
  return <dialog ref={dialog} aria-labelledby="edit-profile-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl rounded-2xl border-0 p-0 shadow-xl backdrop:bg-slate-950/40">
    <form onSubmit={submit}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5"><h2 id="edit-profile-title" className="text-xl font-semibold text-slate-900">Edit Profile</h2><button type="button" onClick={onClose} disabled={saving} className="text-sm text-slate-500">Close</button></div>
      <fieldset disabled={saving} className="space-y-6 p-5">
        <div className="flex flex-wrap items-center gap-5"><Photo src={preview} name={child.name} /><label className="text-sm font-semibold text-slate-700">Child photo<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block max-w-full text-xs font-normal" onChange={event => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG, PNG, or WebP photo smaller than 5 MB.'); event.target.value = ''; return; }
          setError(''); setPhoto(file);
        }} /><span className="mt-2 block text-xs font-normal text-slate-500">JPEG, PNG or WebP. Up to 5 MB.</span></label></div>
        {editGroups.map(group => <section key={group.title}><h3 className="border-b border-slate-100 pb-3 font-semibold text-[#0f4b94]">{group.title}</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{group.fields.map(([key, label, type]) => <label key={key} className={`text-sm font-medium text-slate-700 ${type === 'textarea' ? 'sm:col-span-2' : ''}`}>{label}
          {['sex', 'status', 'boolean'].includes(type) ? <select className={control} value={String(form[key] ?? '')} onChange={event => update(key, type === 'boolean' ? event.target.value === 'true' : event.target.value)}>{(type === 'sex' ? ['unspecified', 'male', 'female'] : type === 'status' ? statuses : ['false', 'true']).map(value => <option key={value} value={value}>{type === 'boolean' ? value === 'true' ? 'Yes' : 'No' : words(value)}</option>)}</select> : type === 'textarea' ? <textarea rows={2} className={control} value={form[key] ?? ''} onChange={event => update(key, event.target.value)} /> : <input className={control} type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} required={key === 'name'} value={form[key] ?? ''} onChange={event => update(key, event.target.value)} />}
        </label>)}</div></section>)}
      </fieldset>
      {error && <p role="alert" className="mx-5 mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button><button disabled={saving} type="submit" className="rounded-lg bg-[#0f4b94] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  </dialog>;
}
