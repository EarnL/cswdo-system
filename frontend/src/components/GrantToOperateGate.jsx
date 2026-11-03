import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import RoleLayout from './RoleLayout';

function GrantGuide({ cdc }) {
  const status = cdc?.grant_to_operate_status || {};
  const guide = cdc?.grant_to_operate_guide || {};
  const steps = guide.requirement_steps || status.requirement_steps || [];
  const missing = guide.missing_requirements || status.missing_requirements || [];
  const restricted = guide.restricted_features || status.restricted_features || [];
  const actions = guide.current_actions || status.current_actions || [];
  const readiness = Number(guide.readiness_percent ?? status.readiness_percent ?? 0);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Grant to Operate Required</p>
        <h1 className="mt-2 text-2xl font-black text-amber-950">{cdc?.name || 'Assigned CDC'}</h1>
        <p className="mt-2 text-sm font-semibold text-amber-900">
          {status.next_step || guide.next_step || 'Complete the accreditation requirements before using operating features.'}
        </p>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm font-black text-amber-900">
            <span>Readiness</span>
            <span>{Math.round(readiness)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/70">
            <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Current Status</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{guide.title || status.label || 'Not yet issued'}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {status.stage?.replaceAll('_', ' ') || 'pre grant'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to={cdc?.id ? `/cdw/accreditation-requirements/${cdc.id}/basic` : '/cdw/accreditation-requirements'} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800 hover:border-[#0f4b94] hover:bg-sky-50">
              Prepare Center Details
            </Link>
            <Link to={cdc?.id ? `/cdw/accreditation-requirements/${cdc.id}/documents` : '/cdw/accreditation-requirements'} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800 hover:border-[#0f4b94] hover:bg-sky-50">
              Upload Requirements
            </Link>
            <Link to="/cdw/accreditation" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800 hover:border-[#0f4b94] hover:bg-sky-50">
              Accreditation Request
            </Link>
            <Link to="/cdw/notifications" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800 hover:border-[#0f4b94] hover:bg-sky-50">
              Check CSWDO Notices
            </Link>
          </div>

          {steps.length ? (
            <div className="mt-5 grid gap-2">
              {steps.map((step, index) => (
                <div key={step.key || step.label} className={`rounded-lg border px-3 py-2 text-sm font-bold ${step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  {step.done ? 'OK' : index + 1}. {step.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Still Needed</p>
          {!missing.length ? (
            <p className="mt-4 text-sm font-semibold text-slate-600">No missing requirement was detected. Wait for CSWDO action or check returned remarks.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {missing.map((item) => (
                <div key={item} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {restricted.length ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Temporarily Locked</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {restricted.map((feature) => (
              <span key={feature} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {feature}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {actions.length ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f4b94]">Next Actions</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((item) => (
              <span key={item} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">{item}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GrantToOperateGate({ children, wrapLayout = false }) {
  const [cdc, setCdc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadAssignedCdc() {
      setLoading(true);
      try {
        const response = await api.get('/cdcs/', { params: { assigned_to_me: true } });
        const cdcs = Array.isArray(response.data) ? response.data : [];
        if (mounted) setCdc(cdcs[0] || null);
      } catch (error) {
        if (mounted) setCdc(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAssignedCdc();
    return () => {
      mounted = false;
    };
  }, []);

  if (!loading && cdc?.has_valid_grant_to_operate) {
    return children;
  }

  const content = loading
    ? <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500">Checking Grant to Operate status...</section>
    : <GrantGuide cdc={cdc} />;

  return wrapLayout ? <RoleLayout role="cdw">{content}</RoleLayout> : content;
}

export default GrantToOperateGate;
