import { reportDisplayName } from '../utils/reportLabels';
import React from 'react';

function DraftsPanel({
  drafts = [],
  activeDraftId = null,
  title = 'Saved Drafts',
  emptyMessage = 'No saved drafts yet.',
  onLoad,
  onDelete,
}) {
  return (
    <section className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[#0f4b94]">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Resume work without losing progress</h2>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-[#0f4b94]">
          {drafts.length} drafts
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className={`rounded-[24px] border p-5 ${
                activeDraftId === draft.id
                  ? 'border-[#0f4b94] bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{reportDisplayName(draft.report_type_label)}</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {reportDisplayName(draft.title) || `${draft.cdc_name} - Q${draft.quarter} ${draft.year}`}
              </h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-700">CDC:</span> {draft.cdc_name}</p>
                <p><span className="font-semibold text-slate-700">Barangay:</span> {draft.barangay_name}</p>
                <p><span className="font-semibold text-slate-700">Updated:</span> {new Date(draft.updated_at).toLocaleString()}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onLoad?.(draft)}
                  className="rounded-full bg-[#0f4b94] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3b76]"
                >
                  Load Draft
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(draft.id)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default DraftsPanel;
