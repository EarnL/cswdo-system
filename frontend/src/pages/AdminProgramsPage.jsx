import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AppIcon from '../components/AppIcon';
import { buildProgramCards } from '../data/programDefinitions';

const normalizeList = (payload) => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

function AdminProgramsPage() {
  const [cdcs, setCdcs] = useState([]);
  const [snpPrograms, setSnpPrograms] = useState([]);
  const [feedingPrograms, setFeedingPrograms] = useState([]);
  const [specialNeedsAssessments, setSpecialNeedsAssessments] = useState([]);
  const [childHealthRecords, setChildHealthRecords] = useState([]);
  const [programCards, setProgramCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      setLoading(true);
      setError('');
      setWarning('');

      try {
        const [cdcRes, snpRes, feedingRes, specialNeedsRes, healthRecordsRes] = await Promise.allSettled([
          api.get('/cdcs/'),
          api.get('/snps/'),
          api.get('/feeding-programs/'),
          api.get('/special-needs-assessments/'),
          api.get('/child-health-records/'),
        ]);

        if (!isMounted) return;
        setCdcs(cdcRes.status === 'fulfilled' ? normalizeList(cdcRes.value.data) : []);
        setSnpPrograms(snpRes.status === 'fulfilled' ? normalizeList(snpRes.value.data) : []);
        setFeedingPrograms(feedingRes.status === 'fulfilled' ? normalizeList(feedingRes.value.data) : []);
        setSpecialNeedsAssessments(specialNeedsRes.status === 'fulfilled' ? normalizeList(specialNeedsRes.value.data) : []);
        setChildHealthRecords(healthRecordsRes.status === 'fulfilled' ? normalizeList(healthRecordsRes.value.data) : []);

        if ([cdcRes, snpRes, feedingRes, specialNeedsRes, healthRecordsRes].some((result) => result.status === 'rejected')) {
          setWarning('Some program records are temporarily unavailable. Other program data is still loaded.');
        }
      } catch (err) {
        console.log(err);
        if (isMounted) setError('Failed to load program data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setProgramCards(buildProgramCards({ cdcs, snpPrograms, feedingPrograms, specialNeedsAssessments, childHealthRecords }));
  }, [cdcs, feedingPrograms, snpPrograms, specialNeedsAssessments, childHealthRecords]);

  const totalVisiblePrograms = programCards.filter((program) => program.count > 0).length;
  const totalRecords = programCards.reduce((sum, program) => sum + program.count, 0);
  const activeRole = localStorage.getItem('role') || 'admin';
  const programBasePath = activeRole === 'staff' ? '/staff/operations' : '/admin/programs';

  return (
    <div className="programs-page space-y-4">
      <section className="programs-hero">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-sky-700">Program Catalog</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">CSWDO Programs</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">Review program records by type. Staff users only see records allowed by staff permissions.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="programs-hero-stat">
            <span>Programs with records</span>
            <strong>{loading ? '...' : totalVisiblePrograms}</strong>
          </div>
          <div className="programs-hero-stat">
            <span>Total records</span>
            <strong>{loading ? '...' : totalRecords}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="lgu-alert-error">{error}</div> : null}
      {warning ? <div className="lgu-alert-warning">{warning}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {programCards.map((program) => (
          <Link key={program.id} to={`${programBasePath}/${program.id}`} className="program-card group">
            <img src={program.image} alt={`${program.title} program`} loading="lazy" />
            <div className="program-card-overlay" />
            <div className="program-card-content">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/80">{program.subtitle}</p>
                <h2 className="mt-2 text-xl font-black text-white">{program.title}</h2>
              </div>
              <div className="program-card-footer">
                <span>{program.count} records</span>
                <span>{program.barangayCount} barangays</span>
                <span className="ml-auto inline-flex items-center gap-1">
                  View <AppIcon name="chevronRight" className="h-4 w-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default AdminProgramsPage;
