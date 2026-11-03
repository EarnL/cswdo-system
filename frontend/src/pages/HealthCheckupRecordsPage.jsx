import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';

const panel = 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm';
const date = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const measurement = (value, unit) => value == null || value === '' ? 'Not recorded' : `${value} ${unit}`;

async function allPages(path) {
  const rows = [];
  while (path) {
    const { data } = await api.get(path);
    rows.push(...(Array.isArray(data) ? data : data.results || []));
    path = Array.isArray(data) ? null : data.next;
  }
  return rows;
}

function Details({ items }) {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => (
    <div key={label}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{value === null || value === undefined || value === '' ? 'Not recorded' : value}</dd></div>
  ))}</dl>;
}

export default function HealthCheckupRecordsPage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([allPages('/children/'), allPages('/child-health-records/')]).then(([children, health]) => {
      if (!active) return;
      setStudents(children.filter((child) => child.enrollment_match_status?.value === 'enrolled'));
      setRecords(health);
    }).catch(() => { if (active) setError('Unable to load health records. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const child = students.find((student) => String(student.id) === childId);
  const history = child ? records.filter((record) => String(record.child) === String(child.id)).sort((a, b) => String(b.screening_date).localeCompare(String(a.screening_date)) || b.id - a.id) : [];
  const latest = history[0];
  const matches = students.filter((student) => `${student.name} ${student.student_id || ''} ${student.cdc_name || ''}`.toLowerCase().includes(search.toLowerCase()));

  return <section className="space-y-4">
    <header className={panel}>
      <Link to="/cdw/students" className="text-sm font-bold text-[#0f4b94]">← Child Profiles</Link>
      <h1 className="mt-3 text-2xl font-black text-slate-950">Health Check-up Records</h1>
      <p className="mt-1 text-sm text-slate-500">View enrolled students’ health information, screening results, and check-up history.</p>
    </header>
    {loading ? <div className={panel} role="status">Loading health records…</div> : error ? <div className={panel} role="alert"><p>{error}</p><button className="mt-3 font-bold text-[#0f4b94]" onClick={() => setAttempt(attempt + 1)}>Try again</button></div> : <>
      <div className={panel}>
        <label htmlFor="health-student" className="text-sm font-bold text-slate-700">Enrolled student</label>
        <select id="health-student" value={childId || ''} onChange={(event) => navigate(event.target.value ? `/cdw/students/${event.target.value}/health-records` : '/cdw/students/health-records')} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm">
          <option value="">Select an enrolled student</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name} — {student.student_id || student.cdc_name}</option>)}
        </select>
      </div>
      {childId && !child ? <div className={panel}>This student is unavailable or is not currently enrolled.</div> : child ? <>
        <section className={panel}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">{child.name}</h2><p className="mt-1 text-sm text-slate-500">{child.student_id} · {child.cdc_name}</p></div><Link to={`/cdw/students/${child.id}`} className="text-sm font-bold text-[#0f4b94]">View child profile</Link></div>
          <Details items={[
            ['Age / Sex', `${child.computed_age ?? child.age} / ${child.sex || 'Not recorded'}`], ['Academic year', child.academic_year_name], ['Guardian', child.parent_guardian_name],
            ['Contact number', child.contact_information], ['Emergency contact', child.emergency_contact_person], ['Emergency number', child.emergency_contact_number],
          ]} />
        </section>
        <section className={panel}><h2 className="mb-4 text-base font-black">Health information</h2><Details items={[
          ['Blood type', child.blood_type], ['Allergies', child.allergies], ['Medical conditions', child.medical_conditions], ['Immunization status', child.immunization_status], ['Health remarks', child.health_remarks],
          ['Latest check-up', date(latest?.screening_date)], ['Latest recorded height', measurement(latest?.height, 'cm')], ['Latest recorded weight', measurement(latest?.weight, 'kg')], ['Latest nutrition assessment', latest?.nutritional_status_label],
        ]} /></section>
        <section className="space-y-3"><h2 className="text-lg font-black text-slate-950">Check-up history ({history.length})</h2>
          {!history.length && <div className={panel}>No health check-ups have been recorded for this student.</div>}
          {history.map((record, index) => <details key={record.id} open={index === 0} className={panel}>
            <summary className="cursor-pointer font-bold text-slate-900">{date(record.screening_date)} · {record.checkup_type_label || 'Health check-up'} <span className="ml-2 inline-block rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-800">{record.status_label || 'Not recorded'}</span></summary>
            <div className="mt-5"><Details items={[
              ['Conducted by', record.conducted_by_name || record.conducted_by_label], ['Height', measurement(record.height, 'cm')], ['Weight', measurement(record.weight, 'kg')], ['Nutritional status', record.nutritional_status_label],
              ['Health findings', record.health_findings], ['Symptoms observed', record.symptoms_observed], ['Medicine given', record.medicine_given], ['Advice given', record.advice_given],
              ['Vision screening', record.vision_screening_result], ['Hearing screening', record.hearing_screening_result], ['Oral health', record.oral_health_result], ['Allergies at check-up', record.allergies], ['Dietary restrictions', record.dietary_restrictions], ['Medical notes', record.medical_notes], ['Medical clearance date', date(record.medical_clearance_date)],
              ['Referral needed', record.needs_referral ? 'Yes' : 'No'], ...(record.needs_referral ? [['Referred to', record.referred_to_label], ['Referral reason', record.referral_reason]] : []),
              ['Follow-up needed', record.follow_up_needed ? 'Yes' : 'No'], ...(record.follow_up_needed ? [['Follow-up date', date(record.follow_up_date)], ['Follow-up instructions', record.follow_up_instruction]] : []),
              ['Recorded by', record.recorded_by_name], ['Verified by', record.verified_by_name], ['Review remarks', record.review_remarks],
            ]} /></div>
          </details>)}
        </section>
      </> : <section className={panel}>
        <h2 className="text-lg font-black">Enrolled students ({students.length})</h2>
        <label htmlFor="health-search" className="mt-4 block text-sm font-bold">Search students</label>
        <input id="health-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, student ID, or CDC" className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" />
        <div className="mt-4 divide-y divide-slate-100">{matches.map((student) => <Link key={student.id} to={`/cdw/students/${student.id}/health-records`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 hover:bg-slate-50"><div><p className="font-bold text-slate-900">{student.name}</p><p className="text-xs text-slate-500">{student.student_id} · {student.cdc_name}</p></div><span className="text-sm font-bold text-[#0f4b94]">View health records →</span></Link>)}</div>
        {!matches.length && <p className="py-6 text-sm text-slate-500">{students.length ? 'No students match your search.' : 'No enrolled students are available.'}</p>}
      </section>}
    </>}
  </section>;
}
