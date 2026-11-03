import React from 'react';

function ActivityLogPanel({ title = 'Activity Log', activities = [], emptyMessage = 'No recent activity was recorded yet.' }) {
  return (
    <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Recent Actions</h2>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {activities.length} entries
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {activities.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.action.replaceAll('_', ' ')}</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{item.summary}</h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {item.actor_username || 'System'}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ActivityLogPanel;
