import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

const labels = { first: 'First assessment', second: 'Second assessment', third: 'Third assessment' };
const formatDate = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not recorded';

export function AssessmentResults({ child }) {
  const latest = child.latest_special_needs_assessment;
  const history = child.assessment_history || [];
  const completed = new Set(history.filter((record) => record.status === 'submitted').map((record) => record.assessment_type));
  const next = ['first', 'second', 'third'].find((type) => !completed.has(type));
  const action = !latest ? 'Start first assessment' : next === 'second' ? 'Begin second assessment' : next === 'third' ? 'Begin third assessment' : 'Open assessment for review';
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#0f4b94]">Child development</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Special Needs Assessment Results</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Recorded assessment outcomes for {child.name}. Review progress and identify areas that may need support.</p>
      </div>
      <div className="p-6 sm:p-8">
        {latest ? <>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Latest recorded result</p>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${latest.status === 'draft' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-white text-blue-800'}`}>{latest.status_label || latest.status}</span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-950">{latest.result_label || 'Result not recorded'}</h3>
            <p className="mt-2 text-sm text-slate-600">{labels[latest.assessment_type] || 'Assessment'} · {formatDate(latest.assessment_date)}</p>
            {latest.status === 'draft' && <p className="mt-3 text-sm text-amber-800">Draft result — this assessment has not been submitted.</p>}
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessed by</dt><dd className="mt-2 text-sm font-medium text-slate-900">{latest.examiner_name || 'Not recorded'}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment notes</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{latest.remarks || 'No additional notes recorded.'}</dd></div>
          </dl>
          <h3 className="mb-3 mt-8 text-sm font-bold text-slate-900">Developmental domain results</h3>
          <div className="grid gap-3 sm:grid-cols-2">{(latest.domains || []).map((domain) => <div key={domain.key} className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{domain.label}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-500">Score: {domain.raw_score} / {domain.total || 'N/A'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${domain.requires_attention ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{domain.status_label || 'Not recorded'}</span></div>
          </div>)}</div>
          {!latest.domains?.length && <p className="text-sm text-slate-500">No domain scores were recorded for this assessment.</p>}
        </> : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center"><h3 className="font-semibold text-slate-900">No assessment results yet</h3><p className="mt-2 text-sm text-slate-500">Results will appear here once this child's first assessment is recorded.</p></div>}
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div><h3 className="text-sm font-semibold text-slate-900">{latest ? 'Ready for a follow-up assessment?' : 'Begin this child’s assessment'}</h3><p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">{latest ? 'Open the Special Needs page to reassess this child or complete the next assessment.' : 'Open the Special Needs page to complete the first assessment.'}</p></div>
        <Link to={`/cdw/special-needs?child=${child.id}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0f4b94] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b3f7e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{action}<span aria-hidden="true" className="ml-2">→</span></Link>
      </div>
    </section>
    {history.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-lg font-bold text-slate-950">Assessment history</h2><p className="mt-1 text-sm text-slate-500">Previous results, from most recent to oldest.</p><div className="mt-5 divide-y divide-slate-100">{history.map((record) => <article key={record.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div><p className="text-xs font-semibold text-slate-500">{labels[record.assessment_type] || 'Assessment'} · {formatDate(record.assessment_date)}</p><h3 className="mt-1 text-sm font-semibold text-slate-900">{record.result_label || 'Result not recorded'}</h3><p className="mt-1 text-xs text-slate-500">{record.examiner_name || 'Examiner not recorded'}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{record.status_label || record.status}</span></article>)}</div></section>}
  </div>;
}

export default function StudentAssessmentResultsPage() {
  const { childId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    async function load() {
      try {
        if (childId) {
          const response = await api.get(`/children/${childId}/`);
          if (active) setData(response.data);
        } else {
          let path = '/children/?status=enrolled';
          const students = [];
          while (path) {
            const { data: page } = await api.get(path);
            students.push(...(Array.isArray(page) ? page : page.results || []));
            path = Array.isArray(page) ? null : page.next;
          }
          if (active) setData(students.filter((student) => student.enrollment_match_status?.value === 'enrolled'));
        }
      } catch { if (active) setError('Assessment results could not be loaded. Please try again.'); }
    }
    load();
    return () => { active = false; };
  }, [childId, attempt]);
  return <section className="mx-auto max-w-6xl space-y-6">
    <Link to={childId ? `/cdw/students/${childId}` : '/cdw/students'} className="inline-flex text-sm font-semibold text-[#0f4b94] hover:underline">← {childId ? 'Back to child profile' : 'Back to Child Profiles'}</Link>
    {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><p>{error}</p><button onClick={() => setAttempt(attempt + 1)} className="mt-3 font-semibold text-[#0f4b94]">Try again</button></div> : !data ? <p role="status" className="p-6 text-sm text-slate-500">Loading assessment results…</p> : childId ? <>
      <header><h1 className="text-2xl font-bold tracking-tight text-slate-950">{data.name}</h1><p className="mt-2 text-sm text-slate-500">{data.student_id || 'Student ID not recorded'} · {data.cdc_name || 'CDC not recorded'}</p></header>
      <AssessmentResults child={data} />
    </> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Special Needs Assessment Results</h1><p className="mt-2 text-sm text-slate-500">Select an enrolled child to view their assessment results and progress.</p>
      <label htmlFor="assessment-student-search" className="mt-6 block text-sm font-semibold text-slate-700">Find a child</label><input id="assessment-student-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or student ID" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
      <div className="mt-5 divide-y divide-slate-100">{data.filter((student) => `${student.name} ${student.student_id || ''}`.toLowerCase().includes(search.toLowerCase())).map((student) => <Link key={student.id} to={`/cdw/students/${student.id}/assessment-results`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 hover:bg-slate-50"><div><p className="font-semibold text-slate-900">{student.name}</p><p className="mt-1 text-xs text-slate-500">{student.latest_special_needs_assessment?.result_label || 'No assessment results yet'}</p></div><span className="text-sm font-semibold text-[#0f4b94]">View results →</span></Link>)}</div>
      {!data.some((student) => `${student.name} ${student.student_id || ''}`.toLowerCase().includes(search.toLowerCase())) && <p className="py-8 text-center text-sm text-slate-500">{data.length ? 'No children match your search.' : 'No enrolled children are available.'}</p>}
    </section>}
  </section>;
}
