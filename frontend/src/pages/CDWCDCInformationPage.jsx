import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

function CDWCDCInformationPage() {
  const [loading, setLoading] = useState(true);
  const [assignedCdc, setAssignedCdc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAssignedCdc() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/cdcs/?assigned_to_me=true');
        const cdcs = Array.isArray(response.data) ? response.data : [];

        if (!isMounted) {
          return;
        }

        setAssignedCdc(cdcs[0] || null);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load assigned CDC:', err);
        setError('Unable to load your assigned CDC information.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAssignedCdc();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
        Loading your assigned CDC information...
      </div>
    );
  }

  if (assignedCdc?.has_valid_grant_to_operate) {
    return <Navigate to={`/cdw/cdc-information/${assignedCdc.id}`} replace />;
  }

  if (assignedCdc) {
    return <Navigate to="/cdw/accreditation-requirements" replace />;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <p className="lgu-kicker">CDC Information</p>
      <h1 className="mt-2 text-2xl font-black text-slate-950">No CDC assigned yet</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        {error || 'Your CDW account does not have an assigned Child Development Center yet. Please contact CSWDO staff to assign your CDC.'}
      </p>
    </section>
  );
}

export default CDWCDCInformationPage;
