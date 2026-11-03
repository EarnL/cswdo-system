import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

const getScoreTone = (score) => {
  if (score >= 85) return { label: 'Strong', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 70) return { label: 'Stable', badge: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500' };
  if (score >= 55) return { label: 'Watch', badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' };
  return { label: 'Priority', badge: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500' };
};

const PerformanceTable = ({ rows: providedRows, limit, compact = false }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (providedRows) return;

    api.get('/performance/', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access')}`,
      },
    })
      .then((res) => setData(res.data))
      .catch((err) => console.log(err));
  }, [providedRows]);

  const rows = useMemo(() => {
    const source = providedRows || data;
    const sorted = [...source].sort((left, right) => Number(right.overall_score || 0) - Number(left.overall_score || 0));
    return limit ? sorted.slice(0, limit) : sorted;
  }, [data, limit, providedRows]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">CDC</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Score</th>
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Status</th>
              {!compact ? (
                <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Reward</th>
              ) : null}
              <th className="bg-slate-950 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-white">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cdc, index) => {
              const score = Number(cdc.overall_score || 0);
              const tone = getScoreTone(score);
              return (
                <tr key={cdc.id || cdc.cdc || `${cdc.cdc_name}-${index}`} className="group hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-black text-slate-950">{cdc.cdc_name || cdc.cdc}</p>
                        <p className="text-xs text-slate-500">{cdc.rating || 'No rating yet'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-14 text-sm font-black text-slate-950">{score ? `${score.toFixed(1)}%` : 'N/A'}</span>
                      <span className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-200">
                        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <span className={`rounded-xl border px-3 py-1.5 text-xs font-black ${tone.badge}`}>{tone.label}</span>
                  </td>
                  {!compact ? (
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{cdc.reward || 'None'}</td>
                  ) : null}
                  <td className="border-b border-slate-100 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {score >= 85 ? 'Maintain quality' : score >= 70 ? 'Monitor trend' : score >= 55 ? 'Review support' : 'Prioritize intervention'}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">No performance records available yet.</div>
      ) : null}
    </div>
  );
};

export default PerformanceTable;
