import React from 'react';

function toneClasses(priority) {
  if (priority === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (priority === 'medium') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function ReminderPanel({ title = 'Deadline Reminders', reminders = [], emptyMessage = 'No reminders right now.' }) {
  return (
    <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Due Items</h2>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-[#0f4b94]">
          {reminders.length} items
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reminders.map((item) => (
            <div key={`${item.title}-${item.due_on}-${item.link}`} className={`rounded-[24px] border p-4 ${toneClasses(item.priority)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">{item.category}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                </div>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {item.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.message}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-600">
                  Due {new Date(item.due_on).toLocaleDateString()}
                </span>
                {item.link ? (
                  <a href={item.link} className="font-semibold text-[#0f4b94] hover:text-[#0b3b76]">
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ReminderPanel;
