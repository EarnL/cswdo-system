import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { buildProgramCards, statusClasses } from '../data/programDefinitions';

const normalizeList = (payload) => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

const formatLabel = (key) => key.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${formatLabel(key)}: ${formatValue(item)}`).join(' | ');
  return String(value);
};

function AdminProgramRecordDetailPage() {
  const { programId, recordId } = useParams();
  const [program, setProgram] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState({});
  const [reviewingId, setReviewingId] = useState('');
  const activeRole = localStorage.getItem('role') || 'admin';
  const programBasePath = activeRole === 'staff' ? '/staff/operations' : '/admin/programs';

  useEffect(() => {
    let isMounted = true;

    async function loadRecord() {
      setLoading(true);
      setError('');

      try {
        const [cdcRes, snpRes, feedingRes, specialNeedsRes, healthRecordsRes] = await Promise.allSettled([
          api.get('/cdcs/'),
          api.get('/snps/'),
          api.get('/feeding-programs/'),
          api.get('/special-needs-assessments/'),
          api.get('/child-health-records/'),
        ]);

        if (!isMounted) return;
        const cards = buildProgramCards({
          cdcs: cdcRes.status === 'fulfilled' ? normalizeList(cdcRes.value.data) : [],
          snpPrograms: snpRes.status === 'fulfilled' ? normalizeList(snpRes.value.data) : [],
          feedingPrograms: feedingRes.status === 'fulfilled' ? normalizeList(feedingRes.value.data) : [],
          specialNeedsAssessments: specialNeedsRes.status === 'fulfilled' ? normalizeList(specialNeedsRes.value.data) : [],
          childHealthRecords: healthRecordsRes.status === 'fulfilled' ? normalizeList(healthRecordsRes.value.data) : [],
        });
        const selectedProgram = cards.find((card) => card.id === programId) || null;
        const selectedRecord = selectedProgram?.items.find((item) => item.id === recordId) || null;
        setProgram(selectedProgram);
        setRecord(selectedRecord);
      } catch (err) {
        console.log(err);
        if (isMounted) setError('Failed to load program record.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRecord();
    return () => {
      isMounted = false;
    };
  }, [programId, recordId]);

  const detailFields = useMemo(() => {
    if (!program || !record) return [];
    return (program.detailFields?.(record.source || {}) || [])
      .filter(([, value]) => value !== null && value !== undefined && value !== '');
  }, [program, record]);

  const detailSections = useMemo(() => {
    if (!program || !record) return [];
    return (program.detailSections?.(record.source || {}) || [])
      .map((section) => ({
        ...section,
        rows: (section.rows || []).map((row) => row.filter(([, value]) => value !== null && value !== undefined && value !== '')),
      }))
      .filter((section) => section.rows.length > 0);
  }, [program, record]);

  const canReviewHealth = program?.id === 'health' && ['admin', 'staff', 'cho'].includes(activeRole);
  const healthRecords = program?.id === 'health' ? (record?.source?.records || []) : [];

  const handleHealthReview = async (healthRecordId, action) => {
    setReviewingId(`${action}-${healthRecordId}`);
    setReviewMessage('');
    setError('');
    try {
      const endpoint = action === 'verify'
        ? 'verify'
        : action === 'return'
          ? 'return_for_revision'
          : 'start_review';
      const response = await api.post(`/child-health-records/${healthRecordId}/${endpoint}/`, {
        review_remarks: reviewRemarks[healthRecordId] || '',
      });
      setRecord((current) => {
        if (!current?.source?.records) return current;
        return {
          ...current,
          source: {
            ...current.source,
            records: current.source.records.map((item) => (
              item.id === healthRecordId ? { ...item, ...response.data } : item
            )),
          },
        };
      });
      setReviewMessage(action === 'verify' ? 'Health record verified.' : action === 'return' ? 'Health record returned with remarks.' : 'Health record marked under review.');
    } catch (err) {
      console.error('Failed to review health record', err);
      setError(err.response?.data?.error || 'Failed to update health record.');
    } finally {
      setReviewingId('');
    }
  };

  if (loading) {
    return <div className="lgu-card text-sm font-semibold text-slate-500">Loading submitted record...</div>;
  }

  if (error || !program || !record) {
    return (
      <div className="lgu-card">
        <p className="text-sm font-semibold text-rose-700">{error || 'Submitted record not found.'}</p>
        <Link to={`${programBasePath}/${programId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0f4b94]">
          <AppIcon name="chevronLeft" className="h-4 w-4" />
          Back to program records
        </Link>
      </div>
    );
  }

  return (
    <div className="program-record-detail-page space-y-4">
      <section className="program-record-detail-hero">
        <Link to={`${programBasePath}/${program.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#0f4b94]">
          <AppIcon name="chevronLeft" className="h-4 w-4" />
          Back to {program.title}
        </Link>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{program.title}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{record.cdcName}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{record.barangay}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClasses(record.status)}`}>{record.status}</span>
        </div>
      </section>

      <section className="program-record-panel">
        <div className="grid gap-3 md:grid-cols-3">
          {[record.infoA, record.infoB, record.infoC].map((info, index) => (
            <div key={info} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Summary {index + 1}</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{info}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="program-record-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Submitted Program Information</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Record Details</h2>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{detailFields.length} fields</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detailFields.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{formatLabel(label)}</p>
              <p className="mt-1 break-words text-sm font-bold text-slate-800">{formatValue(value)}</p>
            </div>
          ))}
        </div>
      </section>

      {canReviewHealth ? (
        <section className="program-record-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Staff Review</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Check-up Verification</h2>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{healthRecords.length} records</span>
          </div>
          {reviewMessage ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{reviewMessage}</div> : null}
          <div className="mt-4 grid gap-3">
            {healthRecords.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-black text-slate-950">{item.child_name || 'Child'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{item.screening_date || 'No date'} | {item.checkup_type_label || item.checkup_type || 'Check-up'}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClasses(item.status_label || item.status)}`}>{item.status_label || item.status}</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-black uppercase text-slate-400">Finding</p><p className="mt-1 text-sm font-bold text-slate-800">{item.health_findings || 'No concern noted'}</p></div>
                  <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-black uppercase text-slate-400">Referral</p><p className="mt-1 text-sm font-bold text-slate-800">{item.needs_referral ? item.referred_to_label || 'Needed' : 'No'}</p></div>
                  <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-black uppercase text-slate-400">Follow-up</p><p className="mt-1 text-sm font-bold text-slate-800">{item.follow_up_needed ? item.follow_up_date || 'Needed' : 'No'}</p></div>
                </div>
                <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                  <input
                    value={reviewRemarks[item.id] || ''}
                    onChange={(event) => setReviewRemarks((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Remarks for return or verification"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleHealthReview(item.id, 'review')} disabled={Boolean(reviewingId)} className="lgu-button-secondary px-3 py-2 text-xs">Review</button>
                    <button type="button" onClick={() => handleHealthReview(item.id, 'verify')} disabled={Boolean(reviewingId)} className="lgu-button-primary px-3 py-2 text-xs">{reviewingId === `verify-${item.id}` ? 'Saving...' : 'Verify'}</button>
                    <button type="button" onClick={() => handleHealthReview(item.id, 'return')} disabled={Boolean(reviewingId)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100">Return</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {detailSections.map((section) => (
        <section key={section.title} className="program-record-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#0f4b94]">Program Record Log</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{section.title}</h2>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{section.rows.length} entries</span>
          </div>

          <div className="mt-4 grid gap-3">
            {section.rows.map((row, rowIndex) => (
              <article key={`${section.title}-${rowIndex}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 md:grid-cols-3">
                  {row.map(([label, value]) => (
                    <div key={`${rowIndex}-${label}`} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-800">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default AdminProgramRecordDetailPage;
